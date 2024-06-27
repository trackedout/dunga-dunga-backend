import { Model, Document } from 'mongoose';
import { QueryResult } from '../paginate/paginate';

export enum PlayerEvents {
  ALLOWED_TO_PLAY = 'allowed-to-play',
  JOINED_QUEUE = 'joined-queue',
  READY_FOR_DUNGEON = 'ready-for-dungeon',

  DUNGEON_READY = 'dungeon-ready',
  DUNGEON_OFFLINE = 'dungeon-closed',
  CLEAR_DUNGEON = 'clear-dungeon',

  // Really means connected to Lobby server
  JOINED_NETWORK = 'joined-network',
  SEEN = 'player-seen',
}

export enum ServerEvents {
  SERVER_ONLINE = 'server-online',
  SERVER_CLOSING = 'server-closing',

  SHUTDOWN_ALL_EMPTY_DUNGEONS = 'shutdown-all-empty-dungeons',
}

export interface IEvent {
  name: PlayerEvents | ServerEvents;
  count: number;

  player: string;
  x: number;
  y: number;
  z: number;

  server: string;
  runId: string;
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
