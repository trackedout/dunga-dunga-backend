import { Model, Document } from 'mongoose';
import { QueryResult } from '../paginate/paginate';

export interface ITask {
  type: string;
  arguments: string[];
  targetPlayer: string;
  state: "SCHEDULED" | "IN_PROGRESS" | "SUCCEEDED" | "FAILED";

  server: string;
  sourceIP: string;
}

export interface ITaskDoc extends ITask, Document {
  processingFailed: boolean;
  error: Error;
}

export interface ITaskModel extends Model<ITaskDoc> {
  paginate(filter: Record<string, any>, options: Record<string, any>): Promise<QueryResult>;
}

export type UpdateTaskBody = Partial<ITask>;

export type NewCreatedTask = Required<ITask>;
