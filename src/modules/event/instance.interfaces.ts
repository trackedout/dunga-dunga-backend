import { Model, Document } from 'mongoose';
import { QueryResult } from '../paginate/paginate';

export interface IInstance {
  name: string;
  ip: string;
  state: InstanceStates;
  reservedBy: string;
  reservedDate: Date;
  activePlayers: number;
  requiresRebuild: boolean;
  unhealthySince: Date;
}

export enum InstanceStates {
  AVAILABLE = 'available', // ready for use
  RESERVED = 'reserved', // assigned to a player, waiting for the player to be notified
  AWAITING_PLAYER = 'awaiting-player', // player notified + attempted teleport to the dungeon
  IN_USE = 'in-use', // player has connected to the dungeon
  BUILDING = 'building', // starting up / rebuilding
  UNREACHABLE = 'unreachable', // health-checks failed
}

export interface IInstanceDoc extends IInstance, Document {}

export interface IInstanceModel extends Model<IInstanceDoc> {
  paginate(filter: Record<string, any>, options: Record<string, any>): Promise<QueryResult>;
}
