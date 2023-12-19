import httpStatus from 'http-status';
import mongoose from 'mongoose';
import Event from './event.model';
import Players from "./player.model";
import DungeonInstance from "./instance.model";
import ApiError from '../errors/ApiError';
import { IOptions, QueryResult } from '../paginate/paginate';
import { IEventDoc, NewCreatedEvent, PlayerEvents, ServerEvents, UpdateEventBody } from './event.interfaces';
import { QueueStates } from "./player.interfaces";

/**
 * Create an event, and potentially react to the event depending on DB state
 * @param {NewCreatedEvent} eventBody
 * @returns {Promise<IEventDoc>}
 */
export const createEvent = async (eventBody: NewCreatedEvent): Promise<IEventDoc> => {
  try {
    switch (eventBody.name) {
      case PlayerEvents.JOINED_NETWORK:
        await createPlayerRecordIfMissing(eventBody);
        break;

      case ServerEvents.SERVER_ONLINE:
        await createDungeonInstanceRecordIfMissing(eventBody);
        break;

      default:
        break;
    }

    return Event.create(eventBody);
  } catch (e) {
    return Event.create({ ...eventBody, processingFailed: true, error: `${e}` });
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
    });
  }
}

/**
 * Query for events
 * @param {Object} filter - Mongo filter
 * @param {Object} options - Query options
 * @returns {Promise<QueryResult>}
 */
export const queryEvents = async (filter: Record<string, any>, options: IOptions): Promise<QueryResult> => {
  return await Event.paginate(filter, options);
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
