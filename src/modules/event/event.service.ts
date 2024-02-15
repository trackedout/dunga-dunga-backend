import httpStatus from 'http-status';
import mongoose from 'mongoose';
import * as net from 'net';
import Event from './event.model';
import Players from './player.model';
import DungeonInstance from './instance.model';
import ApiError from '../errors/ApiError';
import { IOptions, QueryResult } from '../paginate/paginate';
import { IEventDoc, NewCreatedEvent, PlayerEvents, ServerEvents, UpdateEventBody } from './event.interfaces';
import { QueueStates } from './player.interfaces';
import Task from '../task/task.model';

/**
 * Create an event, and potentially react to the event depending on DB state
 * @param {NewCreatedEvent} eventBody
 * @returns {Promise<IEventDoc>}
 */
export const createEvent = async (eventBody: NewCreatedEvent): Promise<IEventDoc> => {
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

      case ServerEvents.SERVER_ONLINE:
        await createDungeonInstanceRecordIfMissing(eventBody);
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

  if (!player) {
    await Players.create({
      playerName: eventBody.player,
      server: eventBody.server,
      state: QueueStates.IN_LOBBY,
    });
  } else {
    player.updateOne({
      server: eventBody.server,
      state: QueueStates.IN_LOBBY,
    });
  }
}

async function createDungeonInstanceRecordIfMissing(eventBody: NewCreatedEvent) {
  const instance = await DungeonInstance.findOne({
    name: eventBody.server,
    ip: eventBody.sourceIP,
  }).exec();

  if (!instance) {
    await DungeonInstance.create({
      name: eventBody.server,
      ip: eventBody.sourceIP,
      inUse: false,
      requiresRebuild: false,
    });
  } else {
    await instance.updateOne({
      inUse: false,
      requiresRebuild: false,
    });
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
  console.log(`Set ${player.playerName} as allowed to play Decked Out 2`);
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

  await player.updateOne({
    state: QueueStates.IN_QUEUE,
    server: eventBody.server,
  });
  console.log(`Placed ${player.playerName} in the dungeon queue`);
}

// similar to bash `nc -z -w <timeout> <ip> <port>`
// e.g. `nc -z -w 1 dungeon 25565`
function checkIfIpIsReachable(ip: string, port: number = 25565, timeout: number = 1000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();

    // Set up the timeout
    const timer = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, timeout);

    socket
      .once('connect', () => {
        clearTimeout(timer);
        socket.destroy();
        resolve(true);
      })
      .once('error', () => {
        clearTimeout(timer);
        resolve(false);
      })
      .connect(port, ip);
  });
}

async function movePlayerToDungeon(eventBody: NewCreatedEvent) {
  const queuedPlayer = await Players.findOne({
    playerName: eventBody.player,
    state: QueueStates.IN_QUEUE,
    isAllowedToPlayDO2: true,
  })
    .sort({ queueTime: -1 })
    .exec();

  if (!queuedPlayer) {
    throw new ApiError(httpStatus.BAD_REQUEST, `Player '${eventBody.player}' is not in the queue`);
  }

  const dungeonInstance = await DungeonInstance.findOne({
    inUse: false,
    requiresRebuild: false,
    name: {
      $regex: /^d[0-9]{3}/,
    },
  }).exec();
  if (!dungeonInstance) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'No available dungeon instances found!');
  }
  // validate dungeon instance before connecting
  // Removes unreachable instances from pool
  await checkIfIpIsReachable(dungeonInstance.ip).catch((e) => {
    dungeonInstance.deleteOne();
    console.error(`Could not reach dungeon instance ${dungeonInstance.name} at ${dungeonInstance.ip}. Removing it from the pool.`);
    throw new ApiError(httpStatus.BAD_REQUEST, `Failed to connect to the dungeon instance: ${e}`);
  });

  console.log(`ip: ${dungeonInstance.ip}`);

  console.log(`Removing ${queuedPlayer.playerName} from queue and moving them to dungeon instance ${dungeonInstance.name}`);

  await dungeonInstance.updateOne({
    inUse: true,
    requiresRebuild: true,
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
    state: QueueStates.IN_DUNGEON,
    server: dungeonInstance.name,
  });
}

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
    inUse: false,
    requiresRebuild: false,
  });
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

  // send players back to lobby

  const players = await Players.find({
    server: eventBody.server,
    state: QueueStates.IN_DUNGEON,
  }).exec();

  const tasks = players.map((player) =>
    Task.create({
      server: eventBody.server,
      type: 'bungee-message',
      state: 'SCHEDULED',
      targetPlayer: player.playerName,
      arguments: ['Connect', 'lobby'],
      sourceIP: eventBody.sourceIP,
    })
  );
  await Promise.all(tasks);

  const playerTasks = players.map((player) =>
    player.updateOne({
      state: QueueStates.IN_LOBBY,
      server: 'lobby',
    })
  );

  await Promise.all(playerTasks);
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
