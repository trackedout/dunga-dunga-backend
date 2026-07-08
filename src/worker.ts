import { Rcon } from 'rcon-client';
import Players from './modules/event/player.model';
import Player from './modules/event/player.model';
import logger, { withContext } from './modules/logger/logger';
import { IPlayerDoc, QueueStates } from './modules/event/player.interfaces';
import DungeonInstance from './modules/event/instance.model';
import Event from './modules/event/event.model';
import Task from './modules/task/task.model';
import Lock from './modules/lock/lock.model';
import { notifyOps, notifyPlayer } from './modules/task';
import { IInstanceDoc, InstanceStates } from './modules/event/instance.interfaces';
import config from './config/config';
import { IEvent, ServerEvents, SpammyEvents } from './modules/event/event.interfaces';
import { Claim } from './modules/claim';
import { ClaimFilters, ClaimStates, ClaimTypes, IClaimDoc } from './modules/claim/claim.interfaces';
import { notifyDiscord } from './modules/event/discord';
import { handleHardcoreGameOver } from './modules/event/event.service';
import { getMetadata } from './modules/utils';
import { cardService } from './modules/card';
import { eventService } from './modules/event';
import { Score } from './modules/score';
import Config from './modules/config/config.model';

async function checkIfIpIsReachableWithRetry(
  ip: string,
  port: number = 25575,
  timeout: number = 1000,
  retries: number = 3
): Promise<boolean> {
  for (let i = 0; i < retries; i++) {
    try {
      logger.info(`Checking if ${ip} is reachable (attempt ${i + 1}/${retries})`);
      return await checkIfIpIsReachable(ip, port, timeout);
    } catch (err: any) {
      logger.warn(`Retry ${i + 1} for ${ip}:${port} failed: ${err.message}`);
      // Exponential backoff: 500ms, 1000ms, 2000ms
      if (i < retries - 1) {
        const delay = 500 * Math.pow(2, i);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw new Error(`Failed to connect to ${ip}:${port} after ${retries} retries`);
}

async function checkIfIpIsReachable(ip: string, port: number = 25575, timeout: number = 1000): Promise<boolean> {
  return new Promise(async (resolve, reject) => {
    const rconOptions = {
      host: ip,
      port: port,
      password: 'mc',
    };

    const rcon = new Rcon(rconOptions);

    const timer = setTimeout(() => {
      const errorMessage = `Failed to connect to ${ip}:${port} (timeout after ${timeout}ms)`;
      logger.error(errorMessage);
      rcon.end().catch((err) => logger.warn(`Error closing RCON connection: ${err.message}`));
      reject(new Error(errorMessage));
    }, timeout);

    try {
      await rcon.connect();
      logger.info(`Connected to ${ip}:${port} using RCON, considering this dungeon as healthy`);

      // Send a simple command to check the server status
      const response = await rcon.send('list'); // The 'list' command returns the players currently online
      logger.debug(`RCON response from ${ip}:${port}: ${response}`);

      clearTimeout(timer);
      await rcon.end().catch((err) => logger.warn(`Error closing RCON connection: ${err.message}`));
      resolve(true);
    } catch (error: any) {
      const errorMessage = `Failed to connect to ${ip}:${port} using RCON (error encountered during socket connection): ${error.message}`;
      logger.error(errorMessage);
      clearTimeout(timer);
      await rcon.end().catch((err) => logger.warn(`Error closing RCON connection: ${err.message}`));
      reject(new Error(errorMessage));
    }
  });
}

async function movePlayerToDungeon(player: IPlayerDoc, lobbyServer: string, targetServer: string, retry = false) {
  const playerName = player.playerName;
  logger.info(`Moving ${playerName} to ${targetServer}`);
  await notifyOps(`Sending ${playerName} to ${targetServer}`, lobbyServer);

  let message = `Sending you to ${targetServer}`;
  if (retry) {
    message = `You haven't joined your dungeon yet, sending you to ${targetServer}`;

    await Task.create({
      server: player.server,
      type: 'message-player',
      state: 'SCHEDULED',
      targetPlayer: playerName,
      arguments: [message],
      sourceIP: '127.0.0.1',
    });
  }

  // Prevent automatic teleportation attempts for 15 seconds
  await takeLock('move-to-dungeon', `${targetServer}/${playerName}`, 15);

  // We can also move the player immediately, but we may disable this in the future
  await Task.create({
    server: lobbyServer,
    type: 'bungee-message',
    state: 'SCHEDULED',
    arguments: ['ConnectOther', playerName, targetServer],
    sourceIP: '127.0.0.1',
  });
}

async function degradeDungeon(dungeon: IInstanceDoc) {
  logger.warn(`Could not reach dungeon instance ${dungeon.name} at ${dungeon.ip}. Marking it as unhealthy`);

  const dungeonRebuildCutoffDate = new Date();
  // Dungeons have 5 minutes to rebuild before we drop them from the DB
  dungeonRebuildCutoffDate.setMinutes(dungeonRebuildCutoffDate.getMinutes() - 5);

  if (dungeon.unhealthySince && dungeon.unhealthySince <= dungeonRebuildCutoffDate) {
    const message = `Dungeon ${dungeon.name} at ${dungeon.ip} has been unhealthy for 5 minutes. Removing it from the pool`;
    logger.warn(message);
    await notifyOps(message);
    await dungeon.deleteOne();
  } else {
    // Mark the dungeon as unreachable
    const update = {
      state: InstanceStates.UNREACHABLE,
      unhealthySince: dungeon.unhealthySince,
      healthySince: null,
    };
    if (!dungeon.unhealthySince) {
      update.unhealthySince = new Date();
    }

    await dungeon.updateOne(update).exec();
  }

  const activeClaims = await Claim.find({
    type: ClaimTypes.DUNGEON,
    state: [ClaimStates.PENDING, ClaimStates.IN_USE],
    claimant: dungeon.name,
  });

  await Promise.all(activeClaims.map((claim) => invalidateClaimAndNotify(claim, 'Dungeon is unhealthy')));
}

async function assignQueuedPlayersToDungeons() {
  const playersInQueue = await Players.find({
    state: QueueStates.IN_QUEUE,
    isAllowedToPlayDO2: true,
    lastSeen: {
      // Seen in the last 3 minutes
      $gte: new Date(Date.now() - 1000 * 60 * 3),
    },
  })
    .sort({ lastQueuedAt: 1 })
    .exec();

  if (playersInQueue.length > 0) {
    logger.debug(`Players in queue: ${playersInQueue.map((p: IPlayerDoc) => p.playerName)}`);

    for (let player of playersInQueue) {
      await attemptToAssignPlayerToDungeon(player).catch((e) => {
        logger.error(e);
      });
    }
  } else {
    logger.debug(`There are no players in queue, skipping queue processing`);
  }
}

async function attemptToAssignPlayerToDungeon(player: IPlayerDoc) {
  const { playerName, activeClaimId } = player;
  logger.info(`Attempting to find an available dungeon for ${playerName} (claimID: ${activeClaimId})`);

  const minHealthyDateCutoff = new Date();
  minHealthyDateCutoff.setSeconds(minHealthyDateCutoff.getSeconds() - 5);

  const claim = await Claim.findById(activeClaimId);
  if (!claim) {
    throw new Error(`${playerName} is in queue without an active claim`);
  }

  const dungeons: IInstanceDoc[] = await DungeonInstance.find({
    state: InstanceStates.AVAILABLE,
    requiresRebuild: false,
    name: {
      $regex: /^d[0-9]{3}/,
    },
    healthySince: {
      $lte: minHealthyDateCutoff,
    },
  }).sort({ healthySince: 1 });

  // Prioritize d7xx over d8xx
  dungeons.sort((a, b) => {
    const aType = a.name.startsWith('d7') ? 7 : 8;
    const bType = b.name.startsWith('d7') ? 7 : 8;

    if (aType !== bType) {
      return aType - bType; // 7 comes before 8
    }

    // If they are the same type, they are already sorted by healthySince from the query
    return 0;
  });

  let dungeon: IInstanceDoc | null = null;
  for (let availableDungeon of dungeons) {
    if (isClaimSupportedByDungeon(availableDungeon, claim)) {
      dungeon = availableDungeon;
      break;
    }
  }

  if (!dungeon) {
    const metadata = getMetadata(claim.metadata);
    const message = `Could not find an available dungeon for ${playerName} (run-type: ${metadata.get('run-type')}, queue-type: ${metadata.get('dungeon-type')}). Will retry in 5 seconds`;
    logger.warn(message);

    // Don't spam operators
    if (
      await tryTakeLock(
        'find-dungeon',
        `${playerName}/run-type-${metadata.get('run-type')}/dungeon-type-${metadata.get('dungeon-type')}`,
        60
      )
    ) {
      await notifyOps(message);
    }

    // Attempt to launch Fargate dungeon if k3s dungeons unavailable
    await launchFargateDungeonIfNeeded(player, claim).catch((e) => {
      logger.error(`Failed to launch Fargate dungeon for ${playerName}: ${e.message}`);
    });

    return;
  }

  logger.debug(`Found matching dungeon for claim: ${dungeon}`);
  const dungeonId = dungeon.id;
  dungeon = await DungeonInstance.findOneAndUpdate(
    {
      _id: dungeonId,
      state: dungeon.state,
      ip: dungeon.ip,
    },
    {
      state: InstanceStates.RESERVED,
      reservedBy: playerName,
      reservedDate: Date.now(),
      claimId: activeClaimId,
    },
    {
      // Return the updated document after executing this update
      new: true,
      sort: { healthySince: 1 },
    }
  ).exec();

  if (!dungeon) {
    const message = `Failed to update dungeon ${dungeonId} during processing of claim ${activeClaimId} for player ${playerName} (dungeon state changed in the background)`;
    logger.error(message);
    await notifyOps(message);
    throw new Error(message);
  }

  logger.info(`Acquired an available dungeon for ${playerName}: ${dungeon}`);

  // Update player state BEFORE the reachability check to prevent the next worker cycle
  // from assigning a second dungeon while we're waiting on the network check
  logger.info(`Setting ${playerName}'s state as ${QueueStates.IN_TRANSIT_TO_DUNGEON}`);
  await player
    .updateOne({
      state: QueueStates.IN_TRANSIT_TO_DUNGEON,
    })
    .exec();

  // Validate dungeon is responding to socket requests before connecting
  // Removes unreachable instances from pool
  await checkIfIpIsReachableWithRetry(dungeon.ip).catch(async () => {
    const message = `${dungeon.name}@${dungeon.ip} became unreachable after being reserved by ${playerName}. This should self-recover`;
    logger.error(message);
    await notifyOps(message);

    // Revert player state so they can be re-assigned on next cycle
    await player
      .updateOne({
        state: QueueStates.IN_QUEUE,
      })
      .exec();

    await degradeDungeon(dungeon);
    throw new Error(message);
  });
  logger.debug(`Finished checking ${dungeon.ip}'s health`);

  logger.info(`Setting Claim ${claim.id}'s state as ${ClaimStates.ACQUIRED}`);
  await claim
    .updateOne({
      state: ClaimStates.ACQUIRED,
      stateReason: `Acquired dungeon ${dungeon.name} for ${playerName}`,
      claimant: dungeon.name,
    })
    .exec();

  await notifyOps(`Acquired dungeon ${dungeon.name} for ${playerName}`);

  await Task.create({
    server: dungeon.name,
    type: 'prepare-for-player',
    state: 'SCHEDULED',
    targetPlayer: playerName,
    arguments: [],
    sourceIP: '127.0.0.1',
  });

  // Player will be messaged when the 'preperation-completed' event is sent back to us
}

function isClaimSupportedByDungeon(dungeon: IInstanceDoc, claim: IClaimDoc) {
  if (dungeon.claimFilters && claim.metadata) {
    for (let [key, values] of dungeon.claimFilters) {
      if (claim.metadata.has(key) && !values.includes(<string>claim.metadata.get(key))) {
        logger.warn(`${dungeon.name} cannot support claim ${claim.id} as ${key} only allows ${values}`);
        return false;
      }
    }
  }

  return true;
}

async function markDungeonAsHealthy(dungeon: IInstanceDoc) {
  if (dungeon.state === InstanceStates.UNREACHABLE) {
    const message = `Dungeon instance ${dungeon.name} at ${dungeon.ip} is now healthy`;
    logger.info(message);

    await dungeon
      .updateOne({
        state: InstanceStates.AVAILABLE,
        unhealthySince: null,
        healthySince: new Date(),
      })
      .exec();

    await notifyOps(message);
  }

  return dungeon;
}

async function releaseDungeonIfLeaseExpired(dungeon: IInstanceDoc) {
  if (dungeon.name.startsWith('builders')) {
    return dungeon;
  }

  const cutoffMinutes = config.env === 'development' ? 1 : 5;
  const reservationCutoffDate = new Date();
  reservationCutoffDate.setMinutes(reservationCutoffDate.getMinutes() - cutoffMinutes); // You have 5 minutes to enter the instance
  if (dungeon.state === InstanceStates.RESERVED && dungeon.reservedDate <= reservationCutoffDate) {
    const message = `Dungeon instance ${dungeon.name} was reserved but unused for over ${cutoffMinutes} minutes, shutting it down`;
    logger.info(message);
    await notifyOps(message);

    const playerName = dungeon.reservedBy;
    const player = await Players.findOne({
      playerName,
      state: QueueStates.IN_TRANSIT_TO_DUNGEON,
    }).exec();
    await player
      ?.updateOne({
        state: QueueStates.IN_LOBBY,
      })
      .exec();

    await Task.create({
      server: player?.server || 'lobby',
      type: 'message-player',
      state: 'SCHEDULED',
      targetPlayer: playerName,
      arguments: [`<red>You did not join your dungeon within ${cutoffMinutes} minutes. Your dungeon has been released`],
      sourceIP: '127.0.0.1',
    });

    const activeClaims = await Claim.find({
      player: playerName,
      type: ClaimTypes.DUNGEON,
      state: [ClaimStates.PENDING, ClaimStates.IN_USE, ClaimStates.ACQUIRED],
      claimant: dungeon.name,
    });

    await Promise.all(
      activeClaims.map((claim) => invalidateClaimAndNotify(claim, `Player did not enter dungeon within ${cutoffMinutes} minutes`))
    );

    await dungeon
      .updateOne({
        state: InstanceStates.BUILDING,
        reservedBy: null,
        reservedDate: null,
        claimId: null,
      })
      .exec();

    await Task.create({
      server: dungeon.name,
      type: 'shutdown-server-if-empty',
      state: 'SCHEDULED',
      sourceIP: '127.0.0.1',
    });

    // Terminate Fargate dungeon after lease expires
    await terminateFargateDungeonIfNeeded(dungeon).catch((e) => {
      logger.error(`Failed to terminate Fargate dungeon ${dungeon.name}: ${e.message}`);
    });
  }

  return dungeon;
}

async function invalidateClaims() {
  const activeClaims = await Claim.find({
    type: ClaimTypes.DUNGEON,
    state: [ClaimStates.PENDING, ClaimStates.ACQUIRED],
    updatedAt: {
      // Updated more than 30 seconds ago, to prevent eventual consistency issues with player states not yet being updated
      $lte: new Date(Date.now() - 1000 * 30),
    },
  });

  await Promise.all(
    activeClaims.map(async (claim: IClaimDoc) => {
      const playerName = claim.player;
      const player = await Players.findOne({
        playerName,
      }).exec();

      // If claim is ACQUIRED and dungeon is not marked as reserved, invalidate the claim
      if (claim.state === ClaimStates.ACQUIRED) {
        const dungeonInstance = await DungeonInstance.findOne({
          state: [InstanceStates.RESERVED, InstanceStates.AWAITING_PLAYER, InstanceStates.IN_USE],
          name: claim.claimant,
          requiresRebuild: false,
        }).exec();

        if (!dungeonInstance) {
          const message = `Dungeon instance ${claim.claimant} for claim ${claim.id} is no longer available. Invalidating claim`;
          logger.warn(message);
          await notifyOps(message);

          await invalidateClaimAndNotify(claim, message);
          // Place the player back in the lobby
          await player
            ?.updateOne({
              state: QueueStates.IN_LOBBY,
            })
            .exec();
          await notifyPlayer(
            playerName,
            `<red>Your dungeon (${claim.claimant}) encountered an error and is no longer available. Please re-queue and contact a moderator for a shard refund.`
          );

          return;
        }
      }

      if (!player) {
        const message = `Player ${playerName} does not exist. Invalidating claim ${claim.id}`;
        logger.warn(message);
        await notifyOps(message);

        await invalidateClaimAndNotify(claim, message);
        await releaseDungeonLeaseForPlayer(playerName);
      } else {
        logger.info(`Checking if ${playerName} is in a disallowed state for claim ${claim.id}`);
        if (![QueueStates.IN_QUEUE, QueueStates.IN_DUNGEON, QueueStates.IN_TRANSIT_TO_DUNGEON].includes(player.state)) {
          const message = `Player ${playerName} is in state ${player?.state} with an active claim. Invalidating claim ${claim.id}`;
          logger.warn(message);
          await notifyOps(message);

          await invalidateClaimAndNotify(claim, message);
          await releaseDungeonLeaseForPlayer(playerName);
        }
      }
    })
  );
}

export async function invalidateClaimAndNotify(claim: IClaimDoc, message: string) {
  await claim.updateOne({
    state: ClaimStates.INVALID,
    stateReason: message,
  });

  const claimMetadata = getMetadata(claim.metadata);

  // This generates 'item-refunded-<name>' events
  await refundClaim(claim, claimMetadata);

  await notifyDiscord({
    name: ServerEvents.CLAIM_INVALIDATED,
    player: claim.player,
    server: '',
    metadata: claimMetadata,
    invalidationReason: message,
  });

  await handleHardcoreGameOver({
    name: ServerEvents.CLAIM_INVALIDATED,
    player: claim.player,
    server: '',
    metadata: claimMetadata,
  });
}

// Refund spent items, shards, etc for a given run, if the run hasn't started yet
// This generates 'item-refunded-<name>' events
async function refundClaim(claim: IClaimDoc, metadata: Map<string, any>) {
  await refundShardForClaim(claim, metadata);
  await refundCardsAndItemsForClaim(claim, metadata);
}

async function refundShardForClaim(claim: IClaimDoc, metadata: Map<string, any>) {
  const playerName = claim.player;
  const runId = metadata.get('run-id');
  const runType = metadata.get('run-type');
  const startTime = metadata.get('start-time');

  if (startTime) {
    logger.warn(`${playerName}'s run ${runId} was started, refusing to refund their shard`);
    return;
  }

  const updatedClaim = await Claim.updateOne(
    {
      _id: claim._id,
      'metadata.shard-refund-processed': { $exists: false },
    },
    {
      'metadata.shard-refund-processed': 'true',
    }
  ).exec();

  if (!updatedClaim || updatedClaim.modifiedCount < 1) {
    logger.warn(
      `Claim ${claim._id} for ${playerName}'s run ${runId} has already had its shard refund processed, refusing to refund the shard again`
    );
    return;
  }

  logger.info(`Refunding shard (runType: ${runType}) for ${playerName}'s run ${runId}`);

  const shardScoreboardKey = getShardScoreboardForRunType(runType);
  // Increase scoreboard by one
  await Score.updateOne({ player: playerName, key: shardScoreboardKey }, { $inc: { value: 1 } });

  await createItemRefundedEvent(playerName, 'SHARD', metadata);
  logger.info(`Refunded shard to ${playerName} (runType: ${runType})`);

  await Task.create({
    server: 'lobby',
    type: 'update-inventory',
    state: 'SCHEDULED',
    targetPlayer: playerName,
    sourceIP: '127.0.0.1',
  });
}

function getShardScoreboardForRunType(runType: String | undefined) {
  switch (runType) {
    case 'c':
      return 'do2.inventory.shards.competitive';
    case 'p':
      return 'do2.inventory.shards.practice';
    case 'h':
      return 'do2.inventory.shards.hardcore';
    default:
      return null;
  }
}

async function refundCardsAndItemsForClaim(claim: IClaimDoc, metadata: Map<string, any>) {
  const playerName = claim.player;
  const eventNameFilterRegex = /^(card|item)-deleted-*/;
  const runId = metadata.get('run-id');
  const runType = metadata.get('run-type');
  const startTime = metadata.get('start-time');

  const events = await Event.find({
    player: {
      $in: [playerName, '@'],
    },
    name: eventNameFilterRegex,
    'metadata.run-id': runId,
  }).exec();

  if (events.length > 0) {
    const cardsToRefund = events.map((event: IEvent) => event.name.replace('card-deleted-', '').replace('item-deleted-', ''));
    logger.info(`Cards to restore for ${playerName}'s run ${runId}: ${cardsToRefund}`);

    if (startTime) {
      logger.warn(`${playerName}'s run ${runId} was started, refusing to refund played cards`);
      return;
    }

    const updatedClaim = await Claim.updateOne(
      {
        _id: claim._id,
        'metadata.card-refunds-processed': { $exists: false },
      },
      {
        'metadata.card-refunds-processed': 'true',
      }
    ).exec();

    if (!updatedClaim || updatedClaim.modifiedCount < 1) {
      logger.warn(
        `Claim ${claim._id} for ${playerName}'s run ${runId} has already had its card refunds processed, refusing to refund cards again`
      );
      return;
    }

    logger.info(`Refunding ${cardsToRefund.length} cards for ${playerName}'s run ${runId}: ${cardsToRefund}`);
    for (const cardName of cardsToRefund) {
      await cardService.createCard({
        name: cardName,
        player: playerName,
        server: 'refund',
        deckType: runType,
        hiddenInDecks: [],
      });
      logger.info(`Refunded ${cardName} to ${playerName} (runType: ${runType})`);

      await createItemRefundedEvent(playerName, cardName, metadata);
    }
  }
}

async function createItemRefundedEvent(playerName: string, itemName: string, metadata: Map<string, string>) {
  await eventService.createEvent({
    name: `item-refunded-${itemName}`,
    count: 1,

    player: playerName,
    x: 0,
    y: 0,
    z: 0,

    server: 'dunga-dunga',
    sourceIP: '127.0.0.1',

    metadata,
  });
}

async function releaseDungeonLeaseForPlayer(playerName: string) {
  const dungeonInstance = await DungeonInstance.findOne({
    state: [InstanceStates.RESERVED, InstanceStates.AWAITING_PLAYER],
    reservedBy: playerName,
    requiresRebuild: false,
    reservedDate: {
      // Reserved in the last 4min 45s
      $gte: new Date(Date.now() - 1000 * 60 * 4.5),
    },
    name: {
      $regex: /^d[0-9]{3}/,
    },
  }).exec();

  if (dungeonInstance) {
    await dungeonInstance
      .updateOne({
        state: InstanceStates.BUILDING,
        reservedBy: null,
        reservedDate: null,
      })
      .exec();

    await Task.create({
      server: dungeonInstance.name,
      type: 'shutdown-server-if-empty',
      state: 'SCHEDULED',
      sourceIP: '127.0.0.1',
    });

    await terminateFargateDungeonIfNeeded(dungeonInstance).catch((e) => {
      logger.error(`Failed to terminate Fargate dungeon ${dungeonInstance.name}: ${e.message}`);
    });
  }
}

async function tearDownDungeonIfEmpty(dungeon: IInstanceDoc) {
  if (dungeon.name.startsWith('builders')) {
    return dungeon;
  }

  const cutoffMinutes = 1;
  const inUseCutoffDate = new Date();
  logger.debug(`Checking whether ${dungeon.name} should be rebuilt`);
  inUseCutoffDate.setMinutes(inUseCutoffDate.getMinutes() - cutoffMinutes); // If dungeon is empty but marked as in-use, shut it down
  if (dungeon.state === InstanceStates.IN_USE && dungeon.activePlayers === 0 && dungeon.inUseDate <= inUseCutoffDate) {
    if (await isLockPresent('tear-down-empty-dungeon', dungeon.name)) {
      const message = `Lock is present for teardown task for ${dungeon.name}, skipping`;
      logger.info(message);

      return dungeon;
    }

    await takeLock('tear-down-empty-dungeon', dungeon.name, 60);

    const message = `Dungeon instance ${dungeon.name} was marked as in-use without any online players for over ${cutoffMinutes} minute, tearing it down`;
    logger.info(message);
    await notifyOps(message);

    const playerName = dungeon.reservedBy;
    const player = await Players.findOne({
      playerName,
      server: dungeon.name,
      state: [QueueStates.IN_DUNGEON, QueueStates.IN_TRANSIT_TO_DUNGEON],
    }).exec();
    await player
      ?.updateOne({
        state: QueueStates.IN_LOBBY,
      })
      .exec();

    await Task.create({
      server: dungeon.name,
      type: 'shutdown-server-if-empty',
      state: 'SCHEDULED',
      sourceIP: '127.0.0.1',
    });

    // Terminate Fargate dungeon after it becomes empty
    await terminateFargateDungeonIfNeeded(dungeon).catch((e) => {
      logger.error(`Failed to terminate Fargate dungeon ${dungeon.name}: ${e.message}`);
    });
  }

  return dungeon;
}

async function launchFargateDungeonIfNeeded(player: IPlayerDoc, claim: IClaimDoc) {
  const playerName = player.playerName;
  const metadata = getMetadata(claim.metadata);

  // Check if Fargate launches are globally disabled
  const fargateEnabled = await Config.findOne({ entity: 'global', key: 'enable-fargate-launches' }).exec();
  if (fargateEnabled && fargateEnabled.value === 'false') {
    logger.info(`Fargate launches are globally disabled, skipping launch for ${playerName}`);
    return;
  }

  // Check if Fargate launches are disabled for this player
  const playerFargateEnabled = await Config.findOne({ entity: playerName, key: 'enable-fargate-launches' }).exec();
  if (playerFargateEnabled && playerFargateEnabled.value === 'false') {
    logger.info(`Fargate launches are disabled for ${playerName}, skipping`);
    return;
  }

  // Check if rebuilding d8xx dungeons will cover demand (they start faster than Fargate)
  const dungeonType = metadata.get('dungeon-type') || 'default';
  const rebuildingD8xxDungeons = await DungeonInstance.find({
    name: { $regex: /^d8[0-9]{2}$/ },
    $or: [{ state: { $in: [InstanceStates.BUILDING, InstanceStates.UNREACHABLE] } }, { requiresRebuild: true }],
  });

  // Filter to those matching this claim's dungeon type
  // Dungeons in bootstrap phase (IP ends with -bootstrap) don't have accurate claimFilters,
  // but we count them as matching anyway
  const matchingRebuilding = rebuildingD8xxDungeons.filter((d) => {
    if (d.ip.endsWith('-bootstrap')) return true;
    if (!d.claimFilters) return true;
    const allowedTypes = d.claimFilters.get(ClaimFilters.DUNGEON_TYPE);
    return !allowedTypes || allowedTypes.includes(dungeonType);
  });

  // Count queued players needing this dungeon type
  const queuedPlayers = await Players.find({
    state: QueueStates.IN_QUEUE,
    isAllowedToPlayDO2: true,
    lastSeen: { $gte: new Date(Date.now() - 1000 * 60 * 3) },
  }).exec();

  const queuedForType = await Promise.all(
    queuedPlayers.map(async (p) => {
      const playerClaim = await Claim.findById(p.activeClaimId);
      if (!playerClaim) return false;
      const claimMeta = getMetadata(playerClaim.metadata);
      return (claimMeta.get('dungeon-type') || 'default') === dungeonType;
    })
  );
  const playersNeedingThisType = queuedForType.filter(Boolean).length;

  if (matchingRebuilding.length >= playersNeedingThisType) {
    logger.info(
      `Skipping Fargate launch for ${playerName}: ${matchingRebuilding.length} d8xx dungeons rebuilding for type '${dungeonType}' ` +
        `covers ${playersNeedingThisType} queued player(s)`
    );
    return;
  }

  logger.info(
    `Fargate launch proceeding for ${playerName}: ${matchingRebuilding.length} rebuilding d8xx (type '${dungeonType}') < ${playersNeedingThisType} queued player(s)`
  );

  // Check concurrency limit (max 10 Fargate dungeons at once)
  const activeFargateDungeons = await DungeonInstance.countDocuments({
    name: { $regex: /^d7[0-9]{2}$/ },
    state: {
      $in: [
        InstanceStates.AVAILABLE,
        InstanceStates.RESERVED,
        InstanceStates.AWAITING_PLAYER,
        InstanceStates.IN_USE,
        InstanceStates.UNREACHABLE,
      ],
    },
  });

  if (activeFargateDungeons >= 20) {
    logger.warn(`Cannot launch Fargate dungeon for ${playerName}: already at concurrency limit (${activeFargateDungeons}/10)`);
    return;
  }

  // Take distributed lock to prevent duplicate launches for this player
  const lockKey = `launch-fargate/${playerName}/${claim.id}`;
  if (!(await tryTakeLock('launch-fargate', lockKey, 120))) {
    logger.info(`Fargate launch already in progress for ${playerName}, skipping`);
    return;
  }

  // Check if there's already a recent launch task for this player (any state, within 5 minutes)
  const recentLaunchTask = await Task.findOne({
    type: 'launch-ecs-dungeon',
    targetPlayer: playerName,
    createdAt: { $gte: new Date(Date.now() - 5 * 60 * 1000) },
  });

  if (recentLaunchTask) {
    logger.info(
      `Recent Fargate launch task exists for ${playerName} (task: ${recentLaunchTask.id}, state: ${recentLaunchTask.state}), skipping`
    );
    return;
  }

  // Allocate next available dungeon name in d700-d799 range
  const dungeonName = await allocateFargateDungeonName();
  if (!dungeonName) {
    logger.error(`Cannot allocate Fargate dungeon name for ${playerName}: all d700-d799 slots in use`);
    await notifyOps(`Failed to allocate Fargate dungeon for ${playerName}: all d700-d799 slots exhausted`);
    return;
  }

  const env = config.env === 'production' ? 'prod' : 'dev';

  logger.info(`Launching Fargate dungeon ${dungeonName} for ${playerName} in ${env} environment`);
  await notifyOps(`Launching Fargate dungeon ${dungeonName} for ${playerName} (claim: ${claim.id})`);

  // Notify the player that a dungeon is being prepared
  await notifyPlayer(
    playerName,
    '<yellow>No dungeons are currently available.',
    '<yellow>Launching a new dungeon for you...',
    '<gray>This will take about 2 minutes. Please wait!'
  );

  // Set dungeon-type config so the dungeon knows what type it should be
  await Config.findOneAndUpdate(
    { entity: dungeonName, key: 'dungeon-type' },
    { entity: dungeonName, key: 'dungeon-type', value: dungeonType },
    { upsert: true, new: true }
  );

  logger.info(`Set dungeon-type config for ${dungeonName} to ${dungeonType}`);

  // Create task for job-scheduler to pick up
  await Task.create({
    server: 'job-scheduler',
    type: 'launch-ecs-dungeon',
    state: 'SCHEDULED',
    targetPlayer: playerName,
    arguments: [`launch-ecs-dungeon-${env}`, dungeonName, `player=${playerName}`, `dungeon-type=${dungeonType}`],
    sourceIP: '127.0.0.1',
  });

  // Prevent the player from re-queueing immediately if they leave (capacity already allocated)
  await takeLock('queue-cooldown', playerName, 60);
}

async function allocateFargateDungeonName(): Promise<string | null> {
  // Find next available dungeon name in d700-d799 range
  const existingDungeons = await DungeonInstance.find({
    name: { $regex: /^d7[0-9]{2}$/ },
  })
    .select('name')
    .lean();

  const usedNumbers = new Set(existingDungeons.map((d) => parseInt(d.name.substring(1))));

  // Also check for pending launch tasks to avoid race conditions
  const pendingLaunches = await Task.find({
    type: 'launch-ecs-dungeon',
    state: { $in: ['SCHEDULED', 'IN_PROGRESS'] },
  })
    .select('arguments')
    .lean();

  pendingLaunches.forEach((task) => {
    if (task.arguments && task.arguments.length >= 2) {
      const dungeonName = task.arguments[1];
      if (dungeonName && dungeonName.match(/^d7[0-9]{2}$/)) {
        usedNumbers.add(parseInt(dungeonName.substring(1)));
      }
    }
  });

  // Find first available slot
  for (let i = 700; i <= 799; i++) {
    if (!usedNumbers.has(i)) {
      return `d${i}`;
    }
  }

  return null;
}

async function terminateFargateDungeonIfNeeded(dungeon: IInstanceDoc) {
  // Only terminate Fargate dungeons (d700-d799)
  if (!dungeon.name.match(/^d7[0-9]{2}$/)) {
    return;
  }

  // Don't terminate if already terminating or recently terminated
  const recentCutoff = new Date();
  recentCutoff.setSeconds(recentCutoff.getSeconds() - 60);

  const existingTerminateTask = await Task.findOne({
    type: 'terminate-ecs-dungeon',
    arguments: { $elemMatch: { $eq: dungeon.name } },
    createdAt: { $gte: recentCutoff },
  });

  if (existingTerminateTask) {
    logger.debug(`Termination task for ${dungeon.name} was already created recently, skipping`);
    return;
  }

  const env = config.env === 'production' ? 'prod' : 'dev';

  logger.info(`Terminating Fargate dungeon ${dungeon.name} in ${env} environment (state: ${dungeon.state})`);
  await notifyOps(`Terminating Fargate dungeon ${dungeon.name} (state: ${dungeon.state})`);

  await Task.create({
    server: 'job-scheduler',
    type: 'terminate-ecs-dungeon',
    state: 'SCHEDULED',
    arguments: [`terminate-ecs-dungeon-${env}`, dungeon.name],
    sourceIP: '127.0.0.1',
  });

  // Remove from pool immediately - no point keeping a terminated Fargate dungeon around
  await dungeon.deleteOne();
}

async function terminateIdleFargateDungeons() {
  const idleCutoffDate = new Date();
  idleCutoffDate.setMinutes(idleCutoffDate.getMinutes() - 5);

  // Find Fargate dungeons idle for >5 minutes in non-active states
  // Note: UNREACHABLE dungeons are handled by degradeDungeon() and don't need termination
  const idleFargateDungeons = await DungeonInstance.find({
    name: { $regex: /^d7[0-9]{2}$/ },
    state: {
      $in: [InstanceStates.AVAILABLE, InstanceStates.RESERVED],
    },
    $or: [
      { healthySince: { $lte: idleCutoffDate } },
      { unhealthySince: { $lte: idleCutoffDate } },
      { reservedDate: { $lte: idleCutoffDate } },
    ],
  });

  if (idleFargateDungeons.length > 0) {
    logger.info(`Found ${idleFargateDungeons.length} idle Fargate dungeons to terminate (failsafe)`);

    for (const dungeon of idleFargateDungeons) {
      const idleMinutes = Math.round(
        (Date.now() - (dungeon.healthySince || dungeon.unhealthySince || dungeon.reservedDate).getTime()) / 60000
      );
      logger.warn(`Failsafe: terminating idle Fargate dungeon ${dungeon.name} (state: ${dungeon.state}, idle for ${idleMinutes} minutes)`);

      await terminateFargateDungeonIfNeeded(dungeon).catch((e) => {
        logger.error(`Failsafe termination failed for ${dungeon.name}: ${e.message}`);
      });
    }
  }
}

export async function tryMovePlayerToDungeon(player: IPlayerDoc, lockDuration = 15) {
  const { playerName, activeClaimId } = player;

  if (!(await tryTakeLock('move-to-dungeon', `${playerName}/${activeClaimId}`, lockDuration))) {
    return null;
  }

  // TODO: Match against the player's current claim in case multiple dungeons are still waiting for them
  const dungeonInstance = await DungeonInstance.findOne({
    state: InstanceStates.RESERVED,
    reservedBy: playerName,
    requiresRebuild: false,
    claimId: activeClaimId,
    reservedDate: {
      // Reserved in the last 4min 45s
      $gte: new Date(Date.now() - 1000 * 60 * 4.5),
    },
    name: {
      $regex: /^d[0-9]{3}/,
    },
  }).exec();

  if (!dungeonInstance) {
    const message = `Could not find reserved instance for ${playerName}, and therefore cannot move them to their instance`;
    logger.warn(message);
    await notifyOps(message);
    await notifyPlayer(
      playerName,
      `<red>Could not find your reserved dungeon instance. Please re-queue and contact a moderator for a shard refund.`
    );
    return null;
  }

  return movePlayerToDungeon(player, player.server, dungeonInstance.name);
}

async function tryTakeLock(type: string, target: string, secondsToExpiry: number) {
  if (await isLockPresent(type, target)) {
    const message = `Lock is present for ${type}/${target}, skipping`;
    logger.info(message);

    return false;
  }

  await takeLock(type, target, secondsToExpiry);
  return true;
}

async function isLockPresent(type: string, target: string) {
  const lock = await Lock.findOne({
    type,
    target,
    until: {
      $gte: new Date(),
    },
  });

  return lock !== undefined && lock !== null;
}

async function takeLock(type: string, target: string, secondsToExpiry: number) {
  const until = new Date();
  until.setSeconds(until.getSeconds() + secondsToExpiry);
  logger.info(`Acquiring ${type} lock for ${target} (expires: ${until})`);

  return Lock.create({
    type,
    target,
    until,
  });
}

async function releaseLock(type: string, target: string) {
  await Lock.deleteMany({
    type,
    target,
    until: {
      $gte: new Date(),
    },
  });
}

async function checkInstanceNetworkConnection() {
  const instances = await DungeonInstance.find({}).exec();
  await Promise.all(
    instances.map(async (dungeon) => {
      try {
        await checkIfIpIsReachableWithRetry(dungeon.ip);
        await markDungeonAsHealthy(dungeon);
        await releaseDungeonIfLeaseExpired(dungeon);
        await tearDownDungeonIfEmpty(dungeon);
      } catch (e) {
        await degradeDungeon(dungeon);
      }
    })
  );
}

async function cleanupStaleRecords() {
  // 2 Days ago
  const cutoffDate = new Date(Date.now() - 1000 * 60 * 60 * 24 * 2);

  await Event.deleteMany({
    name: SpammyEvents,
    createdAt: { $lte: cutoffDate },
  }).exec();

  await Lock.deleteMany({ createdAt: { $lte: cutoffDate } }).exec();
  await Task.deleteMany({ createdAt: { $lte: cutoffDate } }).exec();
}

async function execCommand(commands: string[]) {
  await Task.create({
    server: 'lobby',
    type: 'execute-command',
    state: 'SCHEDULED',
    arguments: commands,
    sourceIP: '127.0.0.1',
  });
}

async function openDoor() {
  // Prevent opening door again for 35 seconds.
  // Animation takes about 32 seconds to get to the 'close door' bit.
  if (await tryTakeLock('open-door', 'lobby', 35)) {
    await releaseLock('close-door', 'lobby');

    await execCommand(['setblock -546 118 1985 air', 'setblock -538 110 1984 minecraft:redstone_block']);
  }
}

async function closeDoor() {
  if (await tryTakeLock('open-door', 'lobby', 3)) {
    if (await tryTakeLock('close-door', 'lobby', 60 * 30)) {
      await execCommand([
        'setblock -547 118 1985 air replace',
        'setblock -546 118 1985 minecraft:repeater[facing=west,delay=2]',
        'setblock -547 118 1985 minecraft:redstone_block replace',
      ]);
    }
  }
}

async function updateDoorState() {
  const players = await Player.aggregate([
    {
      $match: {
        state: QueueStates.IN_TRANSIT_TO_DUNGEON,
        lastSeen: {
          $gte: new Date(Date.now() - 1000 * 60), // Seen in the last minute
        },
      },
    },
    {
      $lookup: {
        from: 'configs',
        localField: 'playerName',
        foreignField: 'entity',
        as: 'config',
      },
    },
    {
      $addFields: {
        skipDoor: {
          $anyElementTrue: {
            $map: {
              input: '$config',
              as: 'conf',
              in: {
                $and: [{ $eq: ['$$conf.key', 'skip-door'] }, { $eq: ['$$conf.value', 'true'] }],
              },
            },
          },
        },
      },
    },
    {
      $match: { skipDoor: { $ne: true } }, // Include players where skip-door is unset or false
    },
  ]);

  if (players.length > 0) {
    // There's at least one player in the queue. Open the door.
    logger.info(`Found ${players.length} players in transit to their dungeon. Opening dungeon door`);
    await openDoor();
  } else {
    // Nobody is in the queue. Close the door.
    await closeDoor();
  }
}

async function teleportPlayersInEntrance() {
  const players = await Player.find({
    server: 'lobby',
    'lastLocation.x': {
      $lte: -544,
      $gte: -553,
    },
    'lastLocation.z': {
      $gte: 1977,
      $lte: 1983,
    },
    'lastLocation.y': {
      $gte: 112,
      $lte: 119,
    },
    lastSeen: {
      // Seen in the last minute
      $gte: new Date(Date.now() - 1000 * 60),
    },
  });

  if (players.length > 0) {
    logger.info(`Found ${players.length} players in the dungeon entrance`);

    for (let player of players) {
      if (player.state === QueueStates.IN_TRANSIT_TO_DUNGEON) {
        // Teleport player to dungeon instance
        logger.info(`Attempting to teleport ${player.playerName} into their dungeon`);
        await tryMovePlayerToDungeon(player);
      } else {
        // Move them out of the entrance if they are not meant to be there
        if (await tryTakeLock('teleport-out-of-entrance', player.playerName, 10)) {
          await execCommand([`tp ${player.playerName} -512 114 1980 90 0`]);
        }
      }
    }
  }
}

// TODO: WIP
async function teleportPlayersWithInstantQueue() {
  const playersThatNeedToMove = await Players.find({
    state: QueueStates.IN_TRANSIT_TO_DUNGEON,
    lastSeen: {
      // Seen in the last minute
      $gte: new Date(Date.now() - 1000 * 60),
    },
  })
    .sort({ lastQueuedAt: 1 })
    .exec();

  if (playersThatNeedToMove.length > 0) {
    logger.debug(`Players that need to enter their dungeon: ${playersThatNeedToMove.map((p: IPlayerDoc) => p.playerName)}`);

    // const jobs = playersThatNeedToMove.map(tryMovePlayerToDungeon);
    // await Promise.all(jobs);
  } else {
    logger.debug(`There are no players in queue, skipping teleport processing`);
  }
}

let mergeActive = false;

export async function mergeMetadataOntoEvents() {
  if (mergeActive) {
    logger.info(`[Recon Main] Merge active, skipping`);
    return [];
  }
  mergeActive = true;

  logger.info(`[Recon Main] Searching for run-ids that need to be retrofitted with event metadata`);
  let start = Date.now();

  const reconLookbackMs = 1000 * 60 * 60 * 24; // 24 hours
  const runIds = await Event.aggregate([
    {
      $match: {
        createdAt: { $gte: new Date(Date.now() - reconLookbackMs) },
        'metadata.run-type': { $exists: false },
        'metadata.run-id': { $exists: true },
        name: { $nin: SpammyEvents },
      },
    },
    { $group: { _id: '$metadata.run-id' } },
  ]).exec();

  const concurrency = 10;
  const queue = [...runIds];

  logger.info(
    `[Recon Main] Found ${runIds.length} run-ids that need to be retrofitted with event metadata (query took ${(Date.now() - start) / 1000} seconds)`
  );
  start = Date.now();

  const workers = Array.from({ length: concurrency }).map(async (_, workerId: number) => {
    while (queue.length) {
      const { _id: runId } = queue.pop()!;
      logger.info(`[Recon ${workerId}] Updating events matching run-id ${runId}`);

      try {
        const claim = await Claim.findOne({ 'metadata.run-id': runId }).lean().exec();
        const claimMeta: Record<string, string> = claim?.metadata ? Object.fromEntries(Object.entries(claim.metadata)) : {};
        if (!claimMeta['run-type']) claimMeta['run-type'] = 'unknown';
        // Just use the first character (p / c / u)
        claimMeta['run-type'] = '' + claimMeta['run-type'][0];

        const cutoffDateForClaimRecon = new Date(Date.now() - 1000 * 60 * 60);
        if (!!claim && claim.createdAt >= cutoffDateForClaimRecon && !claimMeta['end-time']) {
          logger.info(
            `[Recon ${workerId}] Claim ${claim._id} was created under 1 hour ago, and does not yet have the 'end-time' metadata, skipping for now`
          );
          continue;
        }

        const result = await Event.updateMany(
          {
            'metadata.run-id': runId,
            // Ignore spammy events
            name: { $nin: SpammyEvents },
          },
          [
            {
              $set: {
                metadata: { $mergeObjects: ['$metadata', claimMeta] },
              },
            },
          ],
          { updatePipeline: true }
        );

        logger.info(
          `[Recon ${workerId}] Updated ${result.modifiedCount} events for run-id ${runId} with run-type ${claimMeta['run-type']}`
        );
      } catch (err: any) {
        logger.warn(`[Recon ${workerId}] Failed to process run-id ${runId}: ${err.message}`);
      }
    }
  });

  await Promise.allSettled(workers);

  mergeActive = false;

  logger.info(`[Recon Main] Finished processing ${runIds.length} run-ids in ${(Date.now() - start) / 1000} seconds`);

  return runIds;
}

async function monitorInUseDungeonHealth() {
  const inUseDungeons = await DungeonInstance.find({
    state: InstanceStates.IN_USE,
    activePlayers: { $gt: 0 },
  });

  if (inUseDungeons.length === 0) {
    return;
  }

  logger.debug(`Monitoring health of ${inUseDungeons.length} IN_USE dungeons`);

  for (const dungeon of inUseDungeons) {
    try {
      await checkIfIpIsReachableWithRetry(dungeon.ip);
      logger.debug(`IN_USE dungeon ${dungeon.name} health check passed (player: ${dungeon.reservedBy})`);
    } catch (e: any) {
      logger.error(`IN_USE dungeon ${dungeon.name} health check failed - player ${dungeon.reservedBy} may be affected: ${e.message}`);
      await notifyOps(`⚠️ IN_USE dungeon ${dungeon.name} is unresponsive - player ${dungeon.reservedBy} affected`);
    }
  }
}

const runWorker = async () => {
  logger.info('Running background worker...');

  await withContext('invalidate-claims', () => invalidateClaims());
  await withContext('assign-queued-players-to-dungeons', () => assignQueuedPlayersToDungeons());
  await withContext('check-instance-network-connection', () => checkInstanceNetworkConnection());
  await withContext('monitor-in-use-dungeon-health', () => monitorInUseDungeonHealth());

  await withContext('update-door-state', () => updateDoorState());
  await withContext('teleport-players-in-entrance', () => teleportPlayersInEntrance());
  await withContext('teleport-players-with-instant-queue', () => teleportPlayersWithInstantQueue());

  await withContext('cleanup-stale-records', () => cleanupStaleRecords());

  // Terminate idle Fargate dungeons (failsafe)
  await withContext('terminate-idle-fargate-dungeons', () => terminateIdleFargateDungeons()).catch((e) => {
    logger.error(`Failed to terminate idle Fargate dungeons: ${e.message}`);
  });

  withContext('recon', () => mergeMetadataOntoEvents()).catch((e) => {
    logger.error(e);
    mergeActive = false;
    return {};
  });
};

const worker = {
  run: runWorker,
};

export default worker;
