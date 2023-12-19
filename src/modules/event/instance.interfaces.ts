import { Model, Document } from 'mongoose';
import { QueryResult } from '../paginate/paginate';

export interface IInstance {
  name: string;
  ip: string;
  activePlayers: number;
  inUse: boolean;
  requiresRebuild: boolean;
}

export interface IInstanceDoc extends IInstance, Document {
}

export interface IInstanceModel extends Model<IInstanceDoc> {
  paginate(filter: Record<string, any>, options: Record<string, any>): Promise<QueryResult>;
}
