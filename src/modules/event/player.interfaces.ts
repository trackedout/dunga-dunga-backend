import { Model, Document } from 'mongoose';
import { QueryResult } from '../paginate/paginate';

export enum QueueStates {
  READY_FOR_DUNGEON = 'ready-for-dungeon',
  IN_DUNGEON = 'in-dungeon',
  IN_LOBBY = 'in-lobby',
  IN_QUEUE = 'in-queue',
}

export interface IPlayer {
  playerName: string;
  server: string;
  state: QueueStates;
  isAllowedToPlayDO2: boolean;
}

export interface IPlayerDoc extends IPlayer, Document {}

export interface IPlayerModel extends Model<IPlayerDoc> {
  paginate(filter: Record<string, any>, options: Record<string, any>): Promise<QueryResult>;
}

export type UpdatePlayerBody = Partial<IPlayer>;

export type NewCreatedPlayer = Required<IPlayer>;
