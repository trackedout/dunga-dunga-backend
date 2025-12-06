import httpStatus from 'http-status';
import mongoose, { Types } from 'mongoose';
import Event from './event.model';
import Players from './player.model';
import DungeonInstance from './instance.model';
import ApiError from '../errors/ApiError';
import { IOptions, QueryResult } from '../paginate/paginate';
import { IEventDoc, NewCreatedEvent, PlayerEvents, ServerEvents, TradeEvents, UpdateEventBody } from './event.interfaces';
import { IPlayer, QueueStates } from './player.interfaces';
import Task from '../task/task.model';
import { logger } from '../logger';
import { notifyOps, notifyPlayer } from '../task';
import { InstanceStates } from './instance.interfaces';
import { Card } from '../card';
import { Claim } from '../claim';
import { ClaimFilters, ClaimStates, ClaimTypes, DungeonTypes, RunTypes } from '../claim/claim.interfaces';
import { v4 as uuidv4 } from 'uuid';
import { ClaimRelatedEvent, EventWithServer, notifyDiscord, notifyLobby, withClaimMetadata } from './discord';
import { Score } from '../score';
import { getSelectedDeck } from '../card/card.controller';
import { getEventMetadata } from '../utils';
import { sendBugReportToDiscord } from './discordBugReporter';
import { invalidateClaimAndNotify } from '../../worker';

/**
 * Create an event, and potentially react to the event depending on DB state
 * @param {NewCreatedEvent} eventBody
 * @returns {Promise<IEventDoc>}
 */
export const createEvent = async (eventBody: NewCreatedEvent): Promise<IEventDoc> => {
  let shouldNotify = true;
  const notify = async () => {
    if (shouldNotify) {
      shouldNotify = false;
      await notifyDiscord(eventBody);
      await notifyLobby(eventBody);
    }
  };

  try {
    switch (eventBody.name) {
      case PlayerEvents.ALLOWED_TO_PLAY:
        await allowPlayerToPlayDO2(eventBody);
        break;

      case PlayerEvents.JOINED_QUEUE:
        await addPlayerToQueue(eventBody);
        break;

      case PlayerEvents.JOINED_NETWORK:
        await notify();
        await createPlayerRecordIfMissing(eventBody);
        await warnPlayerIfUnsupportedVersion(eventBody);
        break;

      case PlayerEvents.JOINED_SERVER:
        await updatePlayerStateForCurrentServer(eventBody);
        break;

      case PlayerEvents.LEFT_NETWORK:
        await updatePlayerStateForCurrentServer(eventBody);
        break;

      // Sent from Citadel / Agronet. Contains in-game location
      case PlayerEvents.SEEN:
        await updatePlayerStateAndLocation(eventBody);
        break;

      // Sent from proxy. Does NOT contain in-game location
      case ServerEvents.PROXY_PING:
        await updatePlayerStateAndLocation(eventBody);
        break;

      case ServerEvents.SERVER_ONLINE:
        await createDungeonInstanceRecordIfMissing(eventBody);
        break;

      case ServerEvents.SERVER_CLOSING:
        await markDungeonAsStale(eventBody);
        break;

      case PlayerEvents.DUNGEON_READY:
        await markDungeonAvailable(eventBody);
        break;

      case PlayerEvents.DUNGEON_OFFLINE:
        await removeDungeonInstance(eventBody);
        break;

      case PlayerEvents.CLEAR_DUNGEON:
        await clearDungeon(eventBody);
        await markDungeonAvailable(eventBody);
        break;

      case ServerEvents.SHUTDOWN_ALL_EMPTY_DUNGEONS:
        await shutdownAllEmptyDungeons();
        break;

      case TradeEvents.TRADE_REQUESTED:
        await performTrade(eventBody);
        break;

      case PlayerEvents.CARD_VISIBILITY_UPDATED:
        await updateCardVisibility(eventBody);
        break;

      case PlayerEvents.HARDCORE_DECK_RESET:
        await resetHardcoreDeck(eventBody);
        break;

      case PlayerEvents.BUG_REPORT:
        await sendBugReportToDiscord(eventBody);
        break;

      case PlayerEvents.GAME_WON:
      case PlayerEvents.PLAYER_DIED:
      case ServerEvents.CLAIM_INVALIDATED: // TODO: This event is never routed here
        await notify(); // Ensure game-won metadata is stored on claim
        await handleHardcoreGameOver(eventBody);
        break;

      default:
        break;
    }

    notify();
    return await Event.create(eventBody);
  } catch (e) {
    await Event.create({ ...eventBody, processingFailed: true, error: `${e}` });
    throw e;
  }
};

async function createPlayerRecordIfMissing(eventBody: NewCreatedEvent) {
  await updatePlayerStateForCurrentServer(eventBody);

  await allowPlayerToPlayDO2(eventBody).catch((_) => {
    // Ignored
  });

  await ensureDeckIsSeeded(eventBody.player, 'p1');
  await ensureDeckIsSeeded(eventBody.player, 'c1');

  await ensureScoreboardIsSeeded(eventBody.player, 'do2.inventory.shards.practice', 32);
  await ensureScoreboardIsSeeded(eventBody.player, 'do2.inventory.shards.competitive', 21);
  await ensureScoreboardIsSeeded(eventBody.player, 'do2.inventory.filter-mode-id', 1); // run-mode
}

async function warnPlayerIfUnsupportedVersion(eventBody: NewCreatedEvent) {
  const metadata = await withClaimMetadata(eventBody);
  const protocol = metadata.get('mc-protocol');

  if (protocol !== '1.20') {
    const messages = [
      '<gold>Warning: We officially support Minecraft version 1.20.1',
      '<gold>Other versions should work, but if you encounter texture issues then try using version 1.20.1 to play',
    ];
    await notifyPlayer(eventBody.player, ...messages);
  }
}

async function updatePlayerStateForCurrentServer(eventBody: NewCreatedEvent) {
  const playerName = eventBody.player;
  let player = await Players.findOne({
    playerName,
  }).exec();

  const metadata = await withClaimMetadata(eventBody);
  const server = metadata.get('server') || eventBody.server;

  if (!player) {
    player = await Players.create({
      playerName,
      server,
      state: QueueStates.SOMEWHERE_ELSE,
    });
  }

  await updatePlayerStateAndLocation(eventBody);

  // Invalidate PENDING or IN_USE claims
  if (server === 'lobby') {
    await invalidateActiveClaimsForPlayer(eventBody.player, `${playerName} moved to the lobby`);
  } else if (eventBody.name === PlayerEvents.JOINED_NETWORK) {
    await invalidateActiveClaimsForPlayer(eventBody.player, `${playerName} joined the network`);
  } else if (eventBody.name === PlayerEvents.LEFT_NETWORK) {
    await invalidateActiveClaimsForPlayer(eventBody.player, `${playerName} left the network`);
  } else {
    console.log(`${playerName} joined ${server}, not updating claim states`);
  }
}

async function invalidateActiveClaimsForPlayer(playerName: string, reason: string) {
  await invalidateInUseClaimsForPlayer(playerName, reason);
  await invalidatePendingClaimsForPlayer(playerName, reason);
}

// Invalidate IN_USE claims, and notify discord about it
async function invalidateInUseClaimsForPlayer(playerName: string, reason: string) {
  const claim = await Claim.findOne({
    player: playerName,
    type: ClaimTypes.DUNGEON,
    state: ClaimStates.IN_USE,
  });
  if (claim) {
    await invalidateClaimAndNotify(claim, reason);
  }
}

// Invalidate PENDING claims for the target player
async function invalidatePendingClaimsForPlayer(playerName: string, reason: string) {
  console.log(reason);
  await Claim.updateMany(
    {
      player: playerName,
      type: ClaimTypes.DUNGEON,
      state: ClaimStates.PENDING,
    },
    {
      state: ClaimStates.INVALID,
      stateReason: reason,
    }
  );
}

// Just update player state and location based on current server, but don't invalidate claims
async function updatePlayerStateAndLocation(eventBody: NewCreatedEvent) {
  const player = await Players.findOne({
    playerName: eventBody.player,
  }).exec();

  const metadata = await withClaimMetadata(eventBody);
  const server = metadata.get('server') || eventBody.server;

  if (player) {
    const state = getNewStateBasedOnPlayerLocation(player, server);

    let update: any = {
      lastSeen: new Date(),
      state: state,
      server: server,
    };

    if (eventBody.x + eventBody.y + eventBody.z !== 0) {
      update.lastLocation = {
        x: eventBody.x,
        y: eventBody.y,
        z: eventBody.z,
      };
    }

    await player.updateOne(update).exec();
  }
}

function getNewStateBasedOnPlayerLocation(player: IPlayer, server: String) {
  let state = player.state;

  if (state === QueueStates.IN_TRANSIT_TO_DUNGEON && server.match(/^d[0-9]{3}/)) {
    state = QueueStates.IN_DUNGEON;
  } else if (![QueueStates.IN_TRANSIT_TO_DUNGEON, QueueStates.IN_DUNGEON].includes(state) && server.match(/^d[0-9]{3}/)) {
    state = QueueStates.SPECTATING;
  } else if (server.startsWith('builders')) {
    state = QueueStates.IN_BUILDERS;
  } else if (![QueueStates.IN_QUEUE, QueueStates.IN_TRANSIT_TO_DUNGEON].includes(state) && server.startsWith('lobby')) {
    state = QueueStates.IN_LOBBY;
  } else if (server.startsWith('survival')) {
    state = QueueStates.IN_SURVIVAL;
  } else if (server.startsWith('velocity')) {
    state = QueueStates.SOMEWHERE_ELSE;
  }

  return state;
}

async function ensureDeckIsSeeded(playerName: string, deckId: string) {
  if (!(await Card.findOne({ player: playerName, deckType: deckId[0] }).exec())) {
    logger.warn(`${playerName} has no cards in ${deckId}, adding initial cards`);
    await addDefaultCards(playerName, deckId);
  }
}

async function addDefaultCards(playerName: string, deckId: string) {
  await Card.create({ name: 'MOC', player: playerName, server: 'lobby', deckId: deckId, deckType: deckId[0] });
  await Card.create({ name: 'SNE', player: playerName, server: 'lobby', deckId: deckId, deckType: deckId[0] });
  await Card.create({ name: 'TRH', player: playerName, server: 'lobby', deckId: deckId, deckType: deckId[0] });
}

async function resetScoreboard(playerName: string, key: string, value: number) {
  await Score.deleteOne({ player: playerName, key: key }).exec();

  await ensureScoreboardIsSeeded(playerName, key, value);
}

async function ensureScoreboardIsSeeded(playerName: string, key: string, defaultValue: number) {
  if (!(await Score.findOne({ player: playerName, key: key }).exec())) {
    logger.warn(`${playerName} does not have score value set for ${key}, setting it to ${defaultValue}`);
    await Score.create({ player: playerName, key: key, value: defaultValue });

    await Task.create({
      server: 'lobby',
      type: 'update-inventory',
      state: 'SCHEDULED',
      targetPlayer: playerName,
      sourceIP: '127.0.0.1',
    });
  }
}

export async function handleHardcoreGameOver(eventBody: ClaimRelatedEvent & EventWithServer) {
  const playerName = eventBody.player;
  const metadata = await withClaimMetadata(eventBody);

  const logPrefix = '[Hardcore stats]';
  const prefix = `Intercepted '${eventBody.name}' event for ${playerName}`;
  const runType = metadata.get('run-type');
  if (runType !== 'h') {
    const msg = `${prefix} but this is not a hardcore run, skipping stats update`;
    logger.info(`${logPrefix} ${msg}`);
    return;
  }

  if (!metadata.get('start-time')) {
    const msg = `${prefix} but they did not start their game, ignoring`;
    logger.info(`${logPrefix} ${msg}`);

    // TODO: Refund shard if it's a claim-invalidated event
    return;
  }

  if (metadata.get('game-won') === 'true') {
    const msg = `${prefix} but they won their game, storing their best stats`;
    logger.info(`${logPrefix} ${msg}`);

    await storeBestHardcoreStats(eventBody);
    return;
  } else {
    const msg = `${prefix} but they lost their game, resetting their hardcore deck`;
    logger.info(`${logPrefix} ${msg}`);

    await resetHardcoreDeck(eventBody);
  }
}

export async function resetHardcoreDeck(eventBody: ClaimRelatedEvent & EventWithServer) {
  const playerName = eventBody.player;
  const metadata = await withClaimMetadata(eventBody);

  const logPrefix = '[Hardcore deck reset]';
  const prefix = `Intercepted '${eventBody.name}' event for ${playerName}`;

  const runType = metadata.get('run-type');
  if (runType !== 'h') {
    const msg = `${prefix} but this is not a hardcore run, skipping deck deletion`;
    logger.info(`${logPrefix} ${msg}`);
    return;
  }

  if (eventBody.name !== PlayerEvents.HARDCORE_DECK_RESET) {
    if (!metadata.get('start-time')) {
      const msg = `${prefix} but they did not start their game, skipping deck deletion`;
      logger.info(`${logPrefix} ${msg}`);
      await notifyOps(msg);
      return;
    }

    if (metadata.get('game-won') === 'true') {
      const msg = `${prefix} but they won their game, skipping deck deletion`;
      logger.info(`${logPrefix} ${msg}`);
      await notifyOps(msg);
      return;
    }
  }

  let msg: string;
  if (eventBody.name === PlayerEvents.PLAYER_DIED) {
    msg = `${prefix} and they died in hardcore mode, deleting their hardcore deck`;
  } else if (eventBody.name === PlayerEvents.HARDCORE_DECK_RESET) {
    msg = `${prefix}, deleting their hardcore deck`;

    const shards = await Score.findOne({ player: playerName, key: 'do2.inventory.shards.hardcore' }).exec();
    if (!shards) {
      await notifyPlayer(playerName, `<red>Hardcore mode has been enabled, good luck.</red>`);
    } else {
      await notifyPlayer(playerName, `<red>Your Hardcore deck has been reset</red>`);
    }
  } else {
    msg = `${prefix} and their claim was invalidated, deleting their hardcore deck`;
  }
  logger.info(`${logPrefix} ${msg}`);
  await notifyOps(msg);

  await Card.deleteMany({
    player: playerName,
    deckType: runType,
  }).exec();

  await Score.updateMany(
    {
      player: playerName,
      key: {
        $regex: /^hardcore-do2\./,
      },
    },
    {
      $set: {
        value: 0,
      },
    }
  ).exec();

  await ensureDeckIsSeeded(eventBody.player, 'h1');
  await resetScoreboard(eventBody.player, 'do2.inventory.shards.hardcore', 10);
}

export async function storeBestHardcoreStats(eventBody: ClaimRelatedEvent & EventWithServer) {
  const playerName = eventBody.player;
  const prefix = `Intercepted '${eventBody.name}' event for ${playerName}`;

  // Update leaderboard score, storing the highest values for each score
  await updateLeaderboardScore(prefix, playerName, 'hardcore-do2.lifetime.escaped.tomes');
  await updateLeaderboardScore(prefix, playerName, 'hardcore-do2.lifetime.escaped.crowns');
  await updateLeaderboardScore(prefix, playerName, 'hardcore-do2.lifetime.escaped.tomes');
  await updateLeaderboardScore(prefix, playerName, 'hardcore-do2.rustyrepairs');
  await updateLeaderboardScore(prefix, playerName, 'hardcore-do2.wins');
}

async function updateLeaderboardScore(prefix: string, playerName: string, key: string) {
  const currentScore = await Score.findOne({
    player: playerName,
    key: key,
  }).exec();

  const leaderboardScore = await Score.findOne({
    player: playerName,
    key: 'leaderboard-' + key,
  }).exec();

  if (!currentScore) {
    logger.warn(`${prefix} but the player does not have a score for ${key}, skipping`);
    return;
  }

  if (!leaderboardScore || leaderboardScore.value < currentScore.value) {
    if (leaderboardScore) {
      await leaderboardScore
        .updateOne({
          value: currentScore.value,
        })
        .exec();
    } else {
      await Score.create({
        player: playerName,
        key: 'leaderboard-' + key,
        value: currentScore.value,
      });
    }
  }
}

async function createDungeonInstanceRecordIfMissing(eventBody: NewCreatedEvent) {
  const metadata = getEventMetadata(eventBody);
  const dungeonType = metadata.get(ClaimFilters.DUNGEON_TYPE) || DungeonTypes.DEFAULT;

  // remove old records with the same hostname or IP address
  const existingInstance = await DungeonInstance.findOne({
    name: eventBody.server,
    ip: eventBody.sourceIP,
  }).exec();

  if (existingInstance) {
    // Delete any other copies that are not the one we found above
    await deleteDungeons(eventBody.server, eventBody.sourceIP, existingInstance._id);

    // Update instance
    const update = {
      state: existingInstance.state,
      inUseDate: existingInstance.inUseDate || new Date(),
      requiresRebuild: existingInstance.requiresRebuild, // || (existingInstance.activePlayers > 0 && eventBody.count === 0),
      activePlayers: eventBody.count,
      claimFilters: {
        [ClaimFilters.DUNGEON_TYPE]: dungeonType,
      },
    };
    if (eventBody.count > 0) {
      update.state = InstanceStates.IN_USE;
    }

    await existingInstance.updateOne(update).exec();

    const anUpdateOccurred =
      existingInstance.state !== update.state ||
      existingInstance.requiresRebuild !== update.requiresRebuild ||
      existingInstance.activePlayers !== update.activePlayers;
    if (anUpdateOccurred) {
      await notifyOps(`Updated ${eventBody.server}: state=${update.state} activePlayers=${update.activePlayers}`);
    }
  } else {
    await deleteDungeons(eventBody.server, eventBody.sourceIP);

    // Register the dungeon as a new instance
    await DungeonInstance.create({
      name: eventBody.server,
      ip: eventBody.sourceIP,
      state: InstanceStates.UNREACHABLE,
      claimFilters: {
        [ClaimFilters.DUNGEON_TYPE]: dungeonType,
      },
      requiresRebuild: false,
      activePlayers: eventBody.count,
      unhealthySince: new Date(),
      healthySince: null,
    });

    await notifyOps(`Registered new dungeon: ${eventBody.server}@${eventBody.sourceIP}`);
  }
}

async function deleteDungeons(name: String, ip: String, existingInstanceId: Types.ObjectId | null = null) {
  logger.debug(`Deleting dungeons based on query: { name=${name}, ip=${ip}, _id=${existingInstanceId} }`);
  const existingInstances = await DungeonInstance.find({
    $or: [
      {
        name: name,
      },
      {
        ip: ip,
      },
    ],
    _id: {
      $ne: existingInstanceId,
    },
  }).exec();

  for (const instance of existingInstances) {
    await notifyOps(`Deleting conflicting dungeon: ${instance.name}@${instance.ip} (conflicts with new instance: ${name}@${ip})`);
    await instance.deleteOne().exec();
  }
}

async function allowPlayerToPlayDO2(eventBody: NewCreatedEvent) {
  const player = await Players.findOne({
    playerName: eventBody.player,
  }).exec();

  if (!player) {
    throw new ApiError(httpStatus.NOT_FOUND, `Player '${eventBody.player}' not found`);
  }

  if (player.isAllowedToPlayDO2) {
    throw new ApiError(httpStatus.NOT_MODIFIED, `Player '${eventBody.player}' is already allowed to play Decked Out 2`);
  }

  await player.updateOne({
    isAllowedToPlayDO2: true,
  });
  logger.info(`Set ${player.playerName} as allowed to play Decked Out 2`);
}

async function addPlayerToQueue(eventBody: NewCreatedEvent) {
  const player = await Players.findOne({
    playerName: eventBody.player,
  }).exec();

  if (!player) {
    throw new ApiError(httpStatus.NOT_FOUND, `Player '${eventBody.player}' not found`);
  }

  if (!player.isAllowedToPlayDO2) {
    throw new ApiError(httpStatus.PRECONDITION_FAILED, `Player '${eventBody.player}' is not allowed to play Decked Out 2`);
  }

  if (player.state !== QueueStates.IN_LOBBY) {
    throw new ApiError(httpStatus.PRECONDITION_FAILED, `Player '${eventBody.player}' is in state ${player.state}, preventing re-queue`);
  }

  if (!(await Card.findOne({ player: player.playerName }).exec())) {
    throw new ApiError(httpStatus.PRECONDITION_FAILED, `Player '${eventBody.player}' has no cards`);
  }

  if (
    await Claim.findOne({
      player: player.playerName,
      type: ClaimTypes.DUNGEON,
      state: {
        $nin: [ClaimStates.PERSISTING, ClaimStates.FINALIZED, ClaimStates.INVALID],
      },
    }).exec()
  ) {
    throw new ApiError(httpStatus.PRECONDITION_FAILED, `Active claim already exists for this player`);
  }

  const metadata = new Map(Object.entries(eventBody.metadata));
  const deckId = metadata.get('deck-id') || 'p1'; // TODO: Throw error if missing

  const runId = metadata.get('run-id') || uuidv4();
  const claim = await Claim.create({
    player: player.playerName,
    type: ClaimTypes.DUNGEON,
    state: ClaimStates.PENDING,
    metadata: {
      'run-id': runId,
      'deck-id': deckId,
      // TODO: Set the default based on deck ID, or just throw an error
      'run-type': metadata.get('run-type') || RunTypes.PRACTICE,

      // Claim Filters
      [ClaimFilters.DUNGEON_TYPE]: metadata.get(ClaimFilters.DUNGEON_TYPE) || DungeonTypes.DEFAULT,
    },
  });
  metadata.set('run-id', runId);
  eventBody.metadata = new Map(Object.entries(Object.fromEntries(metadata)));
  logger.debug(`New event metadata after setting run-id -> ${JSON.stringify(Object.fromEntries(eventBody.metadata), null, 4)}`);

  await player.updateOne({
    state: QueueStates.IN_QUEUE,
    server: eventBody.server,
    lastSelectedDeck: deckId,
    activeClaimId: claim.id,
    lastQueuedAt: new Date(),
  });
  logger.info(`Placed ${player.playerName} in the dungeon queue with Deck #${eventBody.count}`);
}

async function markDungeonAvailable(eventBody: NewCreatedEvent) {
  const dungeonInstance = await DungeonInstance.findOne({
    name: eventBody.server,
    ip: eventBody.sourceIP,
  }).exec();

  if (!dungeonInstance) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'No matching dungeon instance found!');
  }

  await dungeonInstance.updateOne({
    state: InstanceStates.AVAILABLE,
    requiresRebuild: false,
  });
}

async function markDungeonAsStale(eventBody: NewCreatedEvent) {
  const dungeonInstance = await DungeonInstance.findOne({
    name: eventBody.server,
    ip: eventBody.sourceIP,
  }).exec();

  if (!dungeonInstance) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'No matching dungeon instance found!');
  }

  await dungeonInstance.updateOne({
    state: InstanceStates.BUILDING,
    unhealthySince: new Date(),
  });

  await notifyOps(`${eventBody.server}@${eventBody.sourceIP} is shutting down`);
}

// runs when instance shuts down or when polling determines the dungeon is unreachable / offline
async function removeDungeonInstance(eventBody: NewCreatedEvent) {
  const dungeonInstance = await DungeonInstance.findOne({
    name: eventBody.server,
    ip: eventBody.sourceIP,
  }).exec();

  if (!dungeonInstance) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'No matching dungeon instance found!');
  }

  await dungeonInstance.deleteOne();
}

// clear-dungeon
// - run ended, move player(s) back to lobby (datapack)
// - calls dungeon-ready
// Runs when a dungeon run ends
async function clearDungeon(eventBody: NewCreatedEvent) {
  const dungeonInstance = await DungeonInstance.findOne({
    name: eventBody.server,
    ip: eventBody.sourceIP,
  }).exec();

  if (!dungeonInstance) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'No matching dungeon instance found!');
  }

  // Send players back to lobby
  const players = await Players.find({
    server: eventBody.server,
    state: QueueStates.IN_DUNGEON,
  }).exec();

  // Try to move the players using Paper plugin messaging (currently this is not working)
  await Promise.all(
    players.map((player) =>
      Task.create({
        server: 'lobby',
        type: 'bungee-message',
        state: 'SCHEDULED',
        arguments: ['ConnectOther', player.playerName, 'lobby'],
        sourceIP: eventBody.sourceIP,
      })
    )
  );

  // Tell the dungeon instance to kick the players
  await Promise.all(
    players.map((player) =>
      Task.create({
        server: eventBody.server,
        type: 'kick-player',
        state: 'SCHEDULED',
        targetPlayer: player.playerName,
        arguments: ['Sending you back to the lobby'],
        sourceIP: eventBody.sourceIP,
      })
    )
  );
}

async function shutdownAllEmptyDungeons() {
  const message = 'Shutting down all empty instances!';
  logger.info(message);
  await notifyOps(message);

  const instances = await DungeonInstance.find({
    name: {
      $regex: /^d[0-9]{3}/,
    },
  }).exec();

  await Promise.all(
    instances.map((dungeon) =>
      Task.create({
        server: dungeon.name,
        type: 'shutdown-server-if-empty',
        state: 'SCHEDULED',
        sourceIP: '127.0.0.1',
      })
    )
  );
}

async function performTrade(eventBody: NewCreatedEvent) {
  const playerName = eventBody.player;
  const player = await Players.findOne({
    playerName: playerName,
  }).exec();

  if (!player) {
    throw new ApiError(httpStatus.NOT_FOUND, `Player '${playerName}' not found`);
  }

  logger.debug(`Event metadata: ${JSON.stringify(eventBody.metadata, null, 4)}`);
  const metadata = new Map(Object.entries(eventBody.metadata));
  /*
      "run-type" to trade.runType,
      "source-scoreboard" to trade.sourceScoreboardName,
      "source-inversion-scoreboard" to trade.sourceInversionScoreboardName,
      "source-count" to trade.sourceItemCount.toString(),
      "target-scoreboard" to trade.targetScoreboardName,
      "target-count" to trade.targetItemCount.toString(),

      Example:
      {
        "run-type": "competitive",
        "source-scoreboard": "do2.inventory.shards.competitive",
        "source-inversion-scoreboard": "do2.inventory.shards.competitive",
        "source-count": "1",
        "target-scoreboard": "queue",
        "target-count": "1"
      }
   */

  const runType = metadata.get('run-type')[0].toLowerCase();
  const sourceScoreboard = metadata.get('source-scoreboard');
  const sourceInversionScoreboard = metadata.get('source-inversion-scoreboard');
  const sourceCount = parseInt(metadata.get('source-count'));
  let targetScoreboard = metadata.get('target-scoreboard');
  const targetCount = parseInt(metadata.get('target-count'));

  const sourceScore = await Score.findOne({
    player: playerName,
    key: sourceScoreboard,
  }).exec();

  if (!sourceScore && sourceScoreboard !== '') {
    throw new ApiError(httpStatus.BAD_REQUEST, `Source scoreboard '${sourceScoreboard}' does not exist`);
  }

  if (targetScoreboard === 'queue') {
    if (player.state !== QueueStates.IN_LOBBY) {
      throw new ApiError(httpStatus.PRECONDITION_FAILED, `Player '${eventBody.player}' is in state ${player.state}, preventing re-queue`);
    }
    if (
      await Claim.findOne({
        player: player.playerName,
        type: ClaimTypes.DUNGEON,
        state: {
          $nin: [ClaimStates.PERSISTING, ClaimStates.FINALIZED, ClaimStates.INVALID],
        },
      }).exec()
    ) {
      throw new ApiError(httpStatus.PRECONDITION_FAILED, `Active claim already exists for this player`);
    }

    const activeDeckId = await getSelectedDeck(player.playerName, runType);
    const cardCount = await Card.countDocuments({
      player: playerName,
      deckType: runType,
      hiddenInDecks: { $ne: activeDeckId },
    }).exec();

    logger.info(`Player has ${cardCount} cards in Deck ${activeDeckId}`);
    if (cardCount === 0) {
      throw new ApiError(httpStatus.PRECONDITION_FAILED, `Deck ${activeDeckId} is empty`);
    }

    targetScoreboard = '';
  }

  if (sourceScoreboard !== '') {
    if (!sourceScore) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Source scoreboard '${sourceScoreboard}' does not exist but source is not empty (this should never happen here)`
      );
    }

    if (sourceScoreboard !== sourceInversionScoreboard) {
      let sourceInversionScore = await Score.findOne({
        player: playerName,
        key: sourceInversionScoreboard,
      }).exec();

      let inversionScore = 0;
      if (sourceInversionScore) {
        inversionScore = sourceInversionScore.value;
      }
      const currentValue = sourceScore.value - inversionScore;
      if (currentValue - sourceCount < 0) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          `Calculated score of '${sourceScoreboard}' - ${sourceInversionScoreboard} is ${currentValue} which is too low for this trade`
        );
      }

      if (!sourceInversionScore) {
        await Score.create({
          player: playerName,
          key: sourceInversionScoreboard,
          value: sourceCount,
        });
      } else {
        await sourceInversionScore.updateOne({
          value: sourceInversionScore.value + sourceCount,
        });
      }
    } else {
      // Source scoreboard and inversion scoreboard is the same, so just remove from source scoreboard
      const currentValue = sourceScore.value;
      if (currentValue - sourceCount < 0) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          `Calculated score of '${sourceScoreboard}' - ${sourceInversionScoreboard} is ${currentValue} which is too low for this trade`
        );
      }

      await sourceScore.updateOne({
        value: currentValue - sourceCount,
      });
    }
  }

  if (targetScoreboard === '') {
    // Dummy scoreboard should not get updated
    return;
  }

  let targetScore = await Score.findOne({
    player: playerName,
    key: targetScoreboard,
  }).exec();
  if (!targetScore) {
    await Score.create({
      player: playerName,
      key: targetScoreboard,
      value: targetCount,
    });
  } else {
    await targetScore.updateOne({
      value: targetScore.value + targetCount,
    });
  }
}

async function updateCardVisibility(eventBody: NewCreatedEvent) {
  const playerName = eventBody.player;
  const player = await Players.findOne({
    playerName: playerName,
  }).exec();

  if (!player) {
    throw new ApiError(httpStatus.NOT_FOUND, `Player '${playerName}' not found`);
  }

  logger.debug(`Event metadata: ${JSON.stringify(eventBody.metadata, null, 4)}`);
  const metadata = new Map(Object.entries(eventBody.metadata));
  /*
      metadata = mapOf(
        "run-type" to deckIdToUpdate.shortRunType(),
        "deck-id" to deckIdToUpdate,
      ).plus(cardsToHide.map { "hide-card-${it.key}" to it.value.toString() })
   */

  const runType = metadata.get('run-type');
  const deckId = metadata.get('deck-id');

  if (!runType || !deckId) {
    throw new ApiError(httpStatus.NOT_FOUND, `At least one metadata field not found: [run-type, deck-id]`);
  }

  const cards = await Card.find({
    player: playerName,
    deckType: runType,
  }).exec();

  let cardUpdates: Promise<any>[] = [];

  let cardsToHide: string[] = [];
  for (let key of metadata.keys()) {
    if (key.startsWith('hide-card-')) {
      const cardName = key.replace('hide-card-', '');
      const numberToHide = metadata.get(key);
      cardsToHide.push(cardName);
      let hidden = 0;

      for (let card of cards) {
        if (card.name === cardName) {
          const thisCardIsHidden = card.hiddenInDecks.includes(deckId);
          if (thisCardIsHidden) {
            hidden++;
          }

          if (hidden > numberToHide && thisCardIsHidden) {
            cardUpdates.push(
              card.updateOne({
                hiddenInDecks: card.hiddenInDecks.filter((id) => id !== deckId),
              })
            );
            hidden--;
          } else if (hidden < numberToHide && !thisCardIsHidden) {
            cardUpdates.push(
              card.updateOne({
                hiddenInDecks: [...card.hiddenInDecks, deckId],
              })
            );
            hidden++;
          }
        }
      }
    }
  }

  // Show cards that are currently hidden but should no longer be.
  for (let card of cards) {
    if (!cardsToHide.includes(card.name)) {
      if (card.hiddenInDecks.includes(deckId)) {
        cardUpdates.push(
          card.updateOne({
            hiddenInDecks: card.hiddenInDecks.filter((id) => id !== deckId),
          })
        );
      }
    }
  }

  await Promise.all(cardUpdates);
}

/**
 * Query for events
 * @param {Object} filter - Mongo filter
 * @param {Object} options - Query options
 * @returns {Promise<QueryResult>}
 */
export const queryEvents = async (filter: Record<string, any>, options: IOptions): Promise<QueryResult> => {
  return Event.paginate(filter, options);
};

/**
 * Get event by id
 * @param {mongoose.Types.ObjectId} id
 * @returns {Promise<IEventDoc | null>}
 */
export const getEventById = async (id: mongoose.Types.ObjectId): Promise<IEventDoc | null> => Event.findById(id);

/**
 * Update event by id
 * @param {mongoose.Types.ObjectId} eventId
 * @param {UpdateEventBody} updateBody
 * @returns {Promise<IEventDoc | null>}
 */
export const updateEventById = async (eventId: mongoose.Types.ObjectId, updateBody: UpdateEventBody): Promise<IEventDoc | null> => {
  const event = await getEventById(eventId);
  if (!event) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Event not found');
  }
  Object.assign(event, updateBody);
  await event.save();
  return event;
};

/**
 * Delete event by id
 * @param {mongoose.Types.ObjectId} eventId
 * @returns {Promise<IEventDoc | null>}
 */
export const deleteEventById = async (eventId: mongoose.Types.ObjectId): Promise<IEventDoc | null> => {
  const event = await getEventById(eventId);
  if (!event) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Event not found');
  }
  await event.deleteOne();
  return event;
};
