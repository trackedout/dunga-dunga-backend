import { Model, Document } from 'mongoose';
import { QueryResult } from '../paginate/paginate';

export interface IGameRegistry {
  name: string;
  displayName: string;
  minPlayers: number;
  maxPlayers: number;
  permission: string;
  tokenCost: number;
  tokenType: string;
  enabled: boolean;
  snapshotSource: string;
  resourcePackUrl: string;
  resourcePackSha1: string;
  datapackVersion: string;
}

export interface IGameRegistryDoc extends IGameRegistry, Document {
  createdAt: Date;
  updatedAt: Date;
}

export interface IGameRegistryModel extends Model<IGameRegistryDoc> {
  paginate(filter: Record<string, any>, options: Record<string, any>): Promise<QueryResult>;
}

export type UpdateGameRegistryBody = Partial<IGameRegistry>;

export type NewGameRegistry = Omit<IGameRegistry, 'tokenType' | 'resourcePackUrl' | 'resourcePackSha1'> &
  Partial<Pick<IGameRegistry, 'tokenType' | 'resourcePackUrl' | 'resourcePackSha1'>>;
