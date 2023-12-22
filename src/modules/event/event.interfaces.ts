import { Model, Document } from 'mongoose';
import { QueryResult } from '../paginate/paginate';

export enum PlayerEvents {
  JOINED_QUEUE = 'joined-queue',
  READY_FOR_DUNGEON = 'ready-for-dungeon',
  DUNGEON_STARTED = 'dungeon-started',
  DUNGEON_ENDED = 'dungeon-ended',

  JOINED_NETWORK = 'joined-network',
}

export enum ServerEvents {
  SERVER_ONLINE = 'server-online',
}

export interface IEvent {
  name: PlayerEvents | ServerEvents;
  count: number;

  player: string;
  x: number;
  y: number;
  z: number;

  server: string;
  sourceIP: string;
}

export interface IEventDoc extends IEvent, Document {
  processingFailed: boolean;
  error: Error;
}

export interface IEventModel extends Model<IEventDoc> {
  paginate(filter: Record<string, any>, options: Record<string, any>): Promise<QueryResult>;
}

export type UpdateEventBody = Partial<IEvent>;

export type NewCreatedEvent = Required<IEvent>;
