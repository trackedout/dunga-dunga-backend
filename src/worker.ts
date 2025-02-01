import { Rcon } from 'rcon-client';
import Players from './modules/event/player.model';
import Player from './modules/event/player.model';
import logger from './modules/logger/logger';
import { IPlayerDoc, QueueStates } from './modules/event/player.interfaces';
import DungeonInstance from './modules/event/instance.model';
import Event from './modules/event/event.model';
import Task from './modules/task/task.model';
import Lock from './modules/lock/lock.model';
import { notifyOps, notifyPlayer } from './modules/task';
import { IInstanceDoc, InstanceStates } from './modules/event/instance.interfaces';
import config from './config/config';
import { PlayerEvents, ServerEvents } from './modules/event/event.interfaces';
import { Claim } from './modules/claim';
import { ClaimStates, ClaimTypes, IClaimDoc } from './modules/claim/claim.interfaces';
import { notifyDiscord } from './modules/event/discord';

async function checkIfIpIsReachableWithRetry(ip: string, port: number = 25575, timeout: number = 1000, retries: number = 3): Promise<boolean> {
  for (let i = 0; i < retries; i++) {
    try {
      logger.info(`Checking if ${ip} is reachable (attempt ${i + 1}/${retries})`);
      return await checkIfIpIsReachable(ip, port, timeout);
    } catch (err: any) {
      logger.warn(`Retry ${i + 1} for ${ip}:${port} failed: ${err.message}`);
      // Retry after 500ms
      await new Promise((resolve) => setTimeout(resolve, 500));
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
  await takeLock('move-to-dungeon', playerName, 15);

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

  if (dungeon.unhealthySince <= dungeonRebuildCutoffDate) {
    logger.warn(`Dungeon ${dungeon.name} at ${dungeon.ip} has been unhealthy for 5 minutes. Removing it from the pool`);
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

  await Promise.all(activeClaims.map(claim => invalidateClaimAndNotify(claim, 'Dungeon is unhealthy' )));
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
  minHealthyDateCutoff.setSeconds(minHealthyDateCutoff.getSeconds() - 15);

  const claim = await Claim.findById(activeClaimId);
  if (!claim) {
    throw new Error(`${playerName} is in queue without an active claim`);
  }

  const dungeons: IInstanceDoc[] = await DungeonInstance.find(
    {
      state: InstanceStates.AVAILABLE,
      requiresRebuild: false,
      name: {
        $regex: /^d[0-9]{3}/,
      },
      healthySince: {
        $lte: minHealthyDateCutoff,
      },
    },
  ).sort({ healthySince: 1 });

  let dungeon: IInstanceDoc | null = null;
  for (let availableDungeon of dungeons) {
    if (isClaimSupportedByDungeon(availableDungeon, claim)) {
      dungeon = availableDungeon;
      break;
    }
  }

  if (!dungeon) {
    logger.warn(`Could not find an available dungeon for ${playerName}`);
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
    },
  ).exec();

  if (!dungeon) {
    const message = `Failed to update dungeon ${dungeonId} during processing of claim ${activeClaimId} for player ${playerName} (dungeon state changed in the background)`;
    logger.error(message);
    await notifyOps(message);
    throw new Error(message);
  }

  logger.info(`Acquired an available dungeon for ${playerName}: ${dungeon}`);

  // Validate dungeon is responding to socket requests before connecting
  // Removes unreachable instances from pool
  await checkIfIpIsReachableWithRetry(dungeon.ip).catch(async () => {
    const message = `${dungeon.name}@${dungeon.ip} became unreachable after being reserved by ${playerName}. This should self-recover`;
    logger.error(message);
    await notifyOps(message);

    await degradeDungeon(dungeon);
    throw new Error(message);
  });
  logger.debug(`Finished checking ${dungeon.ip}'s health`);

  logger.info(`Setting ${playerName}'s state as ${QueueStates.IN_TRANSIT_TO_DUNGEON}`);
  await player.updateOne({
    state: QueueStates.IN_TRANSIT_TO_DUNGEON,
  }).exec();

  logger.info(`Setting Claim ${claim.id}'s state as ${ClaimStates.ACQUIRED}`);
  await claim.updateOne({
    state: ClaimStates.ACQUIRED,
    stateReason: `Acquired dungeon ${dungeon.name} for ${playerName}`,
    claimant: dungeon.name,
  }).exec();

  await notifyOps(`Acquired dungeon ${dungeon.name} for ${playerName}`);

  await Task.create({
    server: dungeon.name,
    type: 'prepare-for-player',
    state: 'SCHEDULED',
    targetPlayer: playerName,
    arguments: [],
    sourceIP: '127.0.0.1',
  });

  const message = '<aqua>Your dungeon is ready! Pass through the door to get teleported to your instance';
  await notifyPlayer(playerName, message);
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

    await Promise.all(activeClaims.map(claim => invalidateClaimAndNotify(claim, `Player did not enter dungeon within ${cutoffMinutes} minutes` )));

    await dungeon
      .updateOne({
        state: InstanceStates.BUILDING,
        reservedBy: null,
        reservationDate: null,
        claimId: null,
      })
      .exec();

    await Task.create({
      server: dungeon.name,
      type: 'shutdown-server-if-empty',
      state: 'SCHEDULED',
      sourceIP: '127.0.0.1',
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

  await Promise.all(activeClaims.map(async (claim: IClaimDoc) => {
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
        await player?.updateOne({
          state: QueueStates.IN_LOBBY,
        }).exec();
        await notifyPlayer(playerName, `<red>Your dungeon (${claim.claimant}) encountered an error and is no longer available. Please re-queue and contact a moderator for a shard refund.`);

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
      if (![
        QueueStates.IN_QUEUE,
        QueueStates.IN_DUNGEON,
        QueueStates.IN_TRANSIT_TO_DUNGEON,
      ].includes(player.state)) {
        const message = `Player ${playerName} is in state ${player?.state} with an active claim. Invalidating claim ${claim.id}`;
        logger.warn(message);
        await notifyOps(message);

        await invalidateClaimAndNotify(claim, message);
        await releaseDungeonLeaseForPlayer(playerName);
      }
    }
  }));
}

async function invalidateClaimAndNotify(claim: IClaimDoc, message: string) {
  await claim.updateOne({
    state: ClaimStates.INVALID,
    stateReason: message,
  });

  notifyDiscord({
    name: 'claim-invalidated',
    player: claim.player,
    server: '',
    metadata: claim.metadata,
    invalidationReason: message,
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
        reservationDate: null,
      })
      .exec();

    await Task.create({
      server: dungeonInstance.name,
      type: 'shutdown-server-if-empty',
      state: 'SCHEDULED',
      sourceIP: '127.0.0.1',
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

    const message = `Dungeon instance ${dungeon.name} was marked as in-use without any online players over ${cutoffMinutes} minute, tearing it down`;
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
  }

  return dungeon;
}

async function tryMovePlayerToDungeon(player: IPlayerDoc) {
  const { playerName } = player;

  if (!await tryTakeLock('move-to-dungeon', playerName, 15)) {
    return null;
  }

  const dungeonInstance = await DungeonInstance.findOne({
    state: InstanceStates.RESERVED,
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

  if (!dungeonInstance) {
    const message = `Could not find reserved instance for ${playerName}, and therefore cannot move them to their instance`;
    logger.warn(message);
    await notifyOps(message);
    await notifyPlayer(playerName, `<red>Could not find your reserved dungeon instance. Please re-queue and contact a moderator for a shard refund.`);
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
  instances.forEach((dungeon) => {
    checkIfIpIsReachableWithRetry(dungeon.ip)
      .then(() => markDungeonAsHealthy(dungeon))
      .then(() => releaseDungeonIfLeaseExpired(dungeon))
      .then(() => tearDownDungeonIfEmpty(dungeon))
      .catch(async () => {
        await degradeDungeon(dungeon);

        return null;
      });
  });
}

async function cleanupStaleRecords() {
  // 2 Days ago
  const cutoffDate = new Date(Date.now() - 1000 * 60 * 60 * 24 * 2);

  await Event.deleteMany({
    name: [ServerEvents.SERVER_ONLINE, ServerEvents.SERVER_CLOSING, PlayerEvents.SEEN],
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

    await execCommand([
      'setblock -546 118 1985 air',
      'setblock -538 110 1984 minecraft:redstone_block',
    ]);
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
  const players = await Player.find({
    state: [QueueStates.IN_TRANSIT_TO_DUNGEON],
    lastSeen: {
      // Seen in the last minute
      $gte: new Date(Date.now() - 1000 * 60),
    },
  });

  if (players.length > 0) {
    // There's at least one player in the queue. Open the door.
    logger.info(`Found ${players.length} players in queue. Opening dungeon door`);
    await openDoor();
  } else {
    // Nobody is in the queue. Close the door.
    await closeDoor();
  }
}

async function teleportPlayersInEntrance() {
  const players = await Player.find({
    // state: [QueueStates.IN_TRANSIT_TO_DUNGEON],
    'lastLocation.x': {
      $lte: -544,
      $gte: -553,
    },
    'lastLocation.z': {
      $gte: 1977,
      $lte: 1983,
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
          await execCommand([
            `tp ${player.playerName} -512 114 1980 90 0`,
          ]);
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

const runWorker = async () => {
  logger.info('Running background worker...');

  await invalidateClaims();
  await assignQueuedPlayersToDungeons();
  // TODO: Run health check for inUse dungeons
  await checkInstanceNetworkConnection();

  await updateDoorState();
  await teleportPlayersInEntrance();
  await teleportPlayersWithInstantQueue();

  await cleanupStaleRecords();
};

const worker = {
  run: runWorker,
};

export default worker;
