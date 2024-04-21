import net from 'net';
import Players from './modules/event/player.model';
import logger from './modules/logger/logger';
import { IPlayerDoc, QueueStates } from './modules/event/player.interfaces';
import DungeonInstance from './modules/event/instance.model';
import Task from './modules/task/task.model';
import { notifyOps } from './modules/task';
import { IInstanceDoc, InstanceStates } from './modules/event/instance.interfaces';
import config from './config/config';

// similar to bash `nc -z -w <timeout> <ip> <port>`
// e.g. `nc -z -w 1 dungeon 25565`
function checkIfIpIsReachable(ip: string, port: number = 25565, timeout: number = 1000): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();

    logger.debug(`Checking if ${ip} is reachable`);
    // Set up the timeout
    const timer = setTimeout(() => {
      const errorMessage = `Failed to connect to ${ip}:${port} (timeout after ${timeout}ms)`;
      logger.error(errorMessage);
      socket.destroy();
      reject(new Error(errorMessage));
    }, timeout);

    socket
      .once('connect', () => {
        logger.info(`Connected to ${ip}:${port}, considering this dungeon as healthy`);
        clearTimeout(timer);
        socket.destroy();
        resolve(true);
      })
      .once('error', () => {
        const errorMessage = `Failed to connect to ${ip}:${port} (error encountered during socket connection)`;
        logger.error(errorMessage);
        clearTimeout(timer);
        reject(new Error(errorMessage));
      })
      .connect(port, ip);
  });
}

async function movePlayerToDungeon(playerName: string, lobbyServer: string, targetServer: string) {
  logger.info(`Notifying ${playerName} that their dungeon is ready, and moving them to that server`);

  await notifyOps(`Sending ${playerName} to ${targetServer}`, lobbyServer);

  await Task.create({
    server: lobbyServer,
    type: 'message-player',
    state: 'SCHEDULED',
    targetPlayer: playerName,
    arguments: [`Your dungeon is ready! Sending you to ${targetServer}`],
    sourceIP: '127.0.0.1',
  });

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
    logger.warn(`Dungeon ${dungeon.name} at ${dungeon.ip} has been unhealthy for 5 minutes. Removing it from the pool.`);
    await dungeon.deleteOne();
  } else {
    // Mark the dungeon as unreachable
    const update = {
      state: InstanceStates.UNREACHABLE,
      unhealthySince: dungeon.unhealthySince,
    };
    if (!dungeon.unhealthySince) {
      update.unhealthySince = new Date();
    }

    await dungeon.updateOne(update).exec();
  }
}

async function attemptToAssignPlayerToDungeon(player: IPlayerDoc) {
  const { playerName } = player;
  logger.info(`Attempting to find an available dungeon for ${playerName}`);

  const dungeon = await DungeonInstance.findOneAndUpdate(
    {
      state: InstanceStates.AVAILABLE,
      requiresRebuild: false,
      name: {
        $regex: /^d[0-9]{3}/,
      },
    },
    {
      state: InstanceStates.RESERVED,
      reservedBy: playerName,
      reservedDate: Date.now(),
    },
    {
      // Return the updated document after executing this update
      new: true,
    }
  ).exec();

  if (dungeon) {
    logger.info(`Acquired an available dungeon for ${playerName}: ${dungeon}`);

    // Validate dungeon is responding to socket requests before connecting
    // Removes unreachable instances from pool
    await checkIfIpIsReachable(dungeon.ip).catch(async () => {
      await degradeDungeon(dungeon);
      throw new Error(`${dungeon.name} at ${dungeon.ip} is unreachable`);
    });
    logger.debug(`Finished checking ${dungeon.ip}'s health`);

    logger.debug(`Setting ${playerName}'s state as ${QueueStates.IN_TRANSIT_TO_DUNGEON}`);
    await player.updateOne({
      state: QueueStates.IN_TRANSIT_TO_DUNGEON,
    });

    await movePlayerToDungeon(playerName, player.server, dungeon.name);
  } else {
    logger.warn(`Could not find an available dungeon for ${playerName}`);
  }
}

async function assignQueuedPlayersToDungeons() {
  const playersInQueue = await Players.find({
    state: QueueStates.IN_QUEUE,
    isAllowedToPlayDO2: true,
  })
    .sort({ queueTime: -1 })
    .exec();

  if (playersInQueue.length > 0) {
    logger.debug(`Players in queue: ${playersInQueue.map((p: IPlayerDoc) => p.playerName)}`);

    const jobs = playersInQueue.map((player) => attemptToAssignPlayerToDungeon(player));
    await Promise.all(jobs);
  } else {
    logger.debug(`There are no players in queue, skipping queue processing`);
  }
}

async function markDungeonAsHealthy(dungeon: IInstanceDoc) {
  if (dungeon.state === InstanceStates.UNREACHABLE) {
    const message = `Dungeon instance ${dungeon.name} at ${dungeon.ip} is now healthy`;
    logger.info(message);

    await dungeon
      .updateOne({
        state: InstanceStates.AVAILABLE,
        unhealthySince: null,
      })
      .exec();

    await notifyOps(message);
  }

  return dungeon;
}

async function releaseDungeonIfLeaseExpired(dungeon: IInstanceDoc) {
  const cutoffMinutes = config.env === 'development' ? 1 : 5;
  const reservationCutoffDate = new Date();
  reservationCutoffDate.setMinutes(reservationCutoffDate.getMinutes() - cutoffMinutes); // You have 5 minutes to enter the instance
  if (dungeon.state === InstanceStates.RESERVED && dungeon.reservedDate <= reservationCutoffDate) {
    const message = `Dungeon instance ${dungeon.name} was reserved but unused for over ${cutoffMinutes} minutes, marking it as available`;
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
      arguments: [`You did not join your dungeon within ${cutoffMinutes} minutes. Your dungeon has been released`],
      sourceIP: '127.0.0.1',
    });

    await dungeon
      .updateOne({
        state: InstanceStates.AVAILABLE,
        reservedBy: null,
        reservationDate: null,
      })
      .exec();
  }
}

async function checkInstanceNetworkConnection() {
  const instances = await DungeonInstance.find({}).exec();
  instances.forEach((dungeon) => {
    checkIfIpIsReachable(dungeon.ip)
      .then(() => markDungeonAsHealthy(dungeon))
      .then(() => releaseDungeonIfLeaseExpired(dungeon))
      .catch(async () => {
        await degradeDungeon(dungeon);

        return null;
      });
  });
}

const runWorker = async () => {
  logger.info('Running background worker...');
  await assignQueuedPlayersToDungeons();
  // TODO: Run health check for inUse dungeons
  await checkInstanceNetworkConnection();
};

const worker = {
  run: runWorker,
};

export default worker;
