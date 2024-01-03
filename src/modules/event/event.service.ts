import httpStatus from 'http-status';
import mongoose from 'mongoose';
import Event from './event.model';
import Players from './player.model';
import DungeonInstance from './instance.model';
import ApiError from '../errors/ApiError';
import { IOptions, QueryResult } from '../paginate/paginate';
import { IEventDoc, NewCreatedEvent, PlayerEvents, ServerEvents, UpdateEventBody } from './event.interfaces';
import { QueueStates } from './player.interfaces';
import Task from "../task/task.model";

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
      $regex: /^do2-/,
    },
  }).exec();
  if (!dungeonInstance) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'No available dungeon instances found!');
  }

  console.log(`Removing ${queuedPlayer.playerName} from queue and moving them to dungeon instance ${dungeonInstance.name}`);

  await dungeonInstance.updateOne({
    inUse: true,
    requiresRebuild: true,
  });

  const currentServer = queuedPlayer.server;

  await Task.create({
    server: currentServer,
    type: "bungee-message",
    state: "SCHEDULED",
    targetPlayer: queuedPlayer.playerName,
    arguments: ["Connect", dungeonInstance.name],
    sourceIP: eventBody.sourceIP,
  });

  await queuedPlayer.updateOne({
    state: QueueStates.IN_DUNGEON,
    server: dungeonInstance.name,
  });
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
export const updateEventById = async (
  eventId: mongoose.Types.ObjectId,
  updateBody: UpdateEventBody
): Promise<IEventDoc | null> => {
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
