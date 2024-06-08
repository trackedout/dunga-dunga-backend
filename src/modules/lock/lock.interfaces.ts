import { Model, Document } from 'mongoose';
import { QueryResult } from '../paginate/paginate';

export interface ILock {
  type: string;
  target: string;
  until: Date;
}

export interface ILockDoc extends ILock, Document {}

export interface ILockModel extends Model<ILockDoc> {
  paginate(filter: Record<string, any>, options: Record<string, any>): Promise<QueryResult>;
}
