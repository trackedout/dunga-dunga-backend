import httpStatus from 'http-status';
import mongoose from 'mongoose';
import Event from './event.model';
import Players from './player.model';
import DungeonInstance from './instance.model';
import ApiError from '../errors/ApiError';
import { IOptions, QueryResult } from '../paginate/paginate';
import { IEventDoc, NewCreatedEvent, PlayerEvents, ServerEvents, TradeEvents, UpdateEventBody } from './event.interfaces';
import { QueueStates } from './player.interfaces';
import Task from '../task/task.model';
import { logger } from '../logger';
import { notifyOps } from '../task';
import { InstanceStates } from './instance.interfaces';
import { Card } from '../card';
import { Claim } from '../claim';
import { ClaimStates, ClaimTypes, RunTypes } from '../claim/claim.interfaces';
import { v4 as uuidv4 } from 'uuid';
import { notifyDiscord, notifyLobby } from './discord';
import { Score } from '../score';
import { getSelectedDeck } from '../card/card.controller';

/**
 * Create an event, and potentially react to the event depending on DB state
 * @param {NewCreatedEvent} eventBody
 * @returns {Promise<IEventDoc>}
 */
export const createEvent = async (eventBody: NewCreatedEvent): Promise<IEventDoc> => {
  notifyDiscord(eventBody);
  notifyLobby(eventBody);

  try {
    switch (eventBody.name) {
      case PlayerEvents.ALLOWED_TO_PLAY:
        await allowPlayerToPlayDO2(eventBody);
        break;

      case PlayerEvents.JOINED_QUEUE:
        await addPlayerToQueue(eventBody);
        break;

      case PlayerEvents.READY_FOR_DUNGEON:
        await movePlayerToDungeon(eventBody);
        break;

      case PlayerEvents.JOINED_NETWORK:
        await createPlayerRecordIfMissing(eventBody);
        break;

      case PlayerEvents.SEEN:
        await updatePlayerLastSeenDate(eventBody);
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

      default:
        break;
    }

    return await Event.create(eventBody);
  } catch (e) {
    await Event.create({ ...eventBody, processingFailed: true, error: `${e}` });
    throw e;
  }
};

async function createPlayerRecordIfMissing(eventBody: NewCreatedEvent) {
  const player = await Players.findOne({
    playerName: eventBody.player,
  }).exec();

  await Claim.updateMany({
    player: eventBody.player,
    type: ClaimTypes.DUNGEON,
    state: ClaimStates.PENDING,
  }, {
    state: ClaimStates.INVALID,
    stateReason: 'Player joined lobby (JOINED_NETWORK event)',
  });

  if (!player) {
    await Players.create({
      playerName: eventBody.player,
      server: eventBody.server,
      state: QueueStates.IN_LOBBY,
    });
  } else {
    await player.updateOne({
      server: eventBody.server,
      state: QueueStates.IN_LOBBY,
    });
  }

  await allowPlayerToPlayDO2(eventBody);

  await ensureDeckIsSeeded(eventBody.player, 'p1');
  await ensureDeckIsSeeded(eventBody.player, 'c1');

  await ensureScoreboardIsSeeded(eventBody.player, 'do2.inventory.shards.practice', 32);
  await ensureScoreboardIsSeeded(eventBody.player, 'do2.inventory.shards.competitive', 8);
}

async function ensureDeckIsSeeded(playerName: string, deckId: string) {
  if (!(await Card.findOne({ player: playerName, deckType: deckId[0] }).exec())) {
    logger.warn(`${playerName} has no cards in ${deckId}, adding initial cards`);
    await addDefaultCards(playerName, deckId);
  }
}

async function addDefaultCards(playerName: string, deckId: string) {
  await Card.create({ name: 'moment_of_clarity', player: playerName, server: 'lobby', deckId: deckId, deckType: deckId[0] });
  await Card.create({ name: 'sneak', player: playerName, server: 'lobby', deckId: deckId, deckType: deckId[0] });
  await Card.create({ name: 'treasure_hunter', player: playerName, server: 'lobby', deckId: deckId, deckType: deckId[0] });
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

async function updatePlayerLastSeenDate(eventBody: NewCreatedEvent) {
  const player = await Players.findOne({
    playerName: eventBody.player,
  }).exec();

  if (player) {
    let state = player.state;
    if (state === QueueStates.IN_TRANSIT_TO_DUNGEON && eventBody.server.match(/^d[0-9]{3}/)) {
      state = QueueStates.IN_DUNGEON;
    } else if (eventBody.server === 'builders') {
      state = QueueStates.IN_BUILDERS;
    }

    await player
      .updateOne({
        lastSeen: new Date(),
        state: state,
        lastLocation: {
          x: eventBody.x,
          y: eventBody.y,
          z: eventBody.z,
        },
      })
      .exec();
  }
}

async function createDungeonInstanceRecordIfMissing(eventBody: NewCreatedEvent) {
  // remove old records with the same hostname or IP address
  const existingInstance = await DungeonInstance.findOne({
    name: eventBody.server,
    ip: eventBody.sourceIP,
  }).exec();

  if (existingInstance) {
    // Delete any other copies that are not the one we found above
    await DungeonInstance.deleteMany({
      $or: [
        {
          name: eventBody.server,
        },
        {
          ip: eventBody.sourceIP,
        },
      ],
      _id: {
        $ne: existingInstance._id,
      },
    })
      .deleteMany()
      .exec();

    // Update instance
    const update = {
      state: existingInstance.state,
      inUseDate: existingInstance.inUseDate || new Date(),
      requiresRebuild: existingInstance.requiresRebuild, // || (existingInstance.activePlayers > 0 && eventBody.count === 0),
      activePlayers: eventBody.count,
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
      await notifyOps(
        `Updated ${eventBody.server}: state=${update.state} requiresRebuild=${update.requiresRebuild} activePlayers=${update.activePlayers}`,
      );
    }
  } else {
    await DungeonInstance.find({
      name: eventBody.server,
    })
      .deleteMany()
      .exec();
    await DungeonInstance.find({
      ip: eventBody.sourceIP,
    })
      .deleteMany()
      .exec();

    // create new instance
    await DungeonInstance.create({
      name: eventBody.server,
      ip: eventBody.sourceIP,
      state: InstanceStates.UNREACHABLE,
      requiresRebuild: false,
      activePlayers: eventBody.count,
      unhealthySince: new Date(),
      healthySince: null,
    });

    await notifyOps(`Registered new dungeon: ${eventBody.server}@${eventBody.sourceIP}`);
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
    server: eventBody.server,
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

  if (await Claim.findOne({
    player: player.playerName,
    type: ClaimTypes.DUNGEON,
    state: {
      $nin: [ClaimStates.PERSISTING, ClaimStates.FINALIZED, ClaimStates.INVALID],
    },
  }).exec()) {
    throw new ApiError(httpStatus.PRECONDITION_FAILED, `Active claim already exists for this player`);
  }

  const metadata = new Map(Object.entries(eventBody.metadata));
  const deckId = metadata.get('deck-id') || 'p1'; // TODO: Throw error if missing

  const claim = await Claim.create({
    player: player.playerName,
    type: ClaimTypes.DUNGEON,
    state: ClaimStates.PENDING,
    metadata: {
      'run-id': uuidv4(),
      'deck-id': deckId,
      // TODO: Set the default based on deck ID, or just throw an error
      'run-type': metadata.get('run-type') || RunTypes.PRACTICE,
    },
  });

  await player.updateOne({
    state: QueueStates.IN_QUEUE,
    server: eventBody.server,
    lastSelectedDeck: deckId,
    activeClaimId: claim.id,
  });
  logger.info(`Placed ${player.playerName} in the dungeon queue with Deck #${eventBody.count}`);
}

async function movePlayerToDungeon(eventBody: NewCreatedEvent) {
  const playerName = eventBody.player;
  const queuedPlayer = await Players.findOne({
    playerName,
    state: QueueStates.IN_QUEUE,
    isAllowedToPlayDO2: true,
  })
    .sort({ queueTime: -1 })
    .exec();

  if (!queuedPlayer) {
    throw new ApiError(httpStatus.BAD_REQUEST, `Player '${playerName}' is not in the queue`);
  }

  const dungeonInstance = await DungeonInstance.findOne({
    state: InstanceStates.RESERVED,
    reservedBy: playerName,
    requiresRebuild: false,
    name: {
      $regex: /^d[0-9]{3}/,
    },
  }).exec();
  if (!dungeonInstance) {
    throw new ApiError(httpStatus.BAD_REQUEST, `No dungeon instance reserved by ${playerName} found!`);
  }

  // validate dungeon instance before connecting
  // Removes unreachable instances from pool
  // await checkIfIpIsReachable(dungeonInstance.ip).catch((e) => {
  //   dungeonInstance.deleteOne();
  //   logger.error(`Could not reach dungeon instance ${dungeonInstance.name} at ${dungeonInstance.ip}. Removing it from the pool.`);
  //   throw new ApiError(httpStatus.BAD_REQUEST, `Failed to connect to the dungeon instance: ${e}`);
  // });

  logger.debug(`Dungeon IP: ${dungeonInstance.ip}`);

  logger.info(`Removing ${queuedPlayer.playerName} from queue and moving them to dungeon instance ${dungeonInstance.name}`);

  await dungeonInstance.updateOne({
    state: InstanceStates.AWAITING_PLAYER,
  });

  const currentServer = queuedPlayer.server;

  await Task.create({
    server: currentServer,
    type: 'bungee-message',
    state: 'SCHEDULED',
    targetPlayer: queuedPlayer.playerName,
    arguments: ['Connect', dungeonInstance.name],
    sourceIP: eventBody.sourceIP,
  });

  await queuedPlayer.updateOne({
    state: QueueStates.IN_TRANSIT_TO_DUNGEON,
    server: dungeonInstance.name,
  });
}

// TODO: Agronet does not send this event
// dungeon-ready
// - mark instance free at end of run
// called from instance if players disconnect unexpectedly
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
      }),
    ),
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
      }),
    ),
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
      }),
    ),
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
    if (await Claim.findOne({
      player: player.playerName,
      type: ClaimTypes.DUNGEON,
      state: {
        $nin: [ClaimStates.PERSISTING, ClaimStates.FINALIZED, ClaimStates.INVALID],
      },
    }).exec()) {
      throw new ApiError(httpStatus.PRECONDITION_FAILED, `Active claim already exists for this player`);
    }

    const activeDeckId = await getSelectedDeck(player.playerName, runType);
    const cardCount = await Card.countDocuments({
      player: playerName,
      deckType: runType,
      hiddenInDecks: { '$ne': activeDeckId },
    }).exec();

    logger.info(`Player has ${cardCount} cards in Deck ${activeDeckId}`);
    if (cardCount === 0) {
      throw new ApiError(httpStatus.PRECONDITION_FAILED, `Deck ${activeDeckId} is empty`);
    }

    targetScoreboard = '';
  }

  if (sourceScoreboard !== '') {
    if (!sourceScore) {
      throw new ApiError(httpStatus.BAD_REQUEST, `Source scoreboard '${sourceScoreboard}' does not exist but source is not empty (this should never happen here)`);
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
        throw new ApiError(httpStatus.BAD_REQUEST, `Calculated score of '${sourceScoreboard}' - ${sourceInversionScoreboard} is ${currentValue} which is too low for this trade`);
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
        throw new ApiError(httpStatus.BAD_REQUEST, `Calculated score of '${sourceScoreboard}' - ${sourceInversionScoreboard} is ${currentValue} which is too low for this trade`);
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
            cardUpdates.push(card.updateOne({
              hiddenInDecks: card.hiddenInDecks.filter(id => id !== deckId),
            }));
            hidden--;
          } else if (hidden < numberToHide && !thisCardIsHidden) {
            cardUpdates.push(card.updateOne({
              hiddenInDecks: [...card.hiddenInDecks, deckId],
            }));
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
        cardUpdates.push(card.updateOne({
          hiddenInDecks: card.hiddenInDecks.filter(id => id !== deckId),
        }));
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
