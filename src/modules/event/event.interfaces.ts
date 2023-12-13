import { Model, Document } from 'mongoose';
import { QueryResult } from '../paginate/paginate';

export interface IEvent {
  name: string;
  player: string;
  count: number;
  server: string;
}

export interface IEventDoc extends IEvent, Document {
}

export interface IEventModel extends Model<IEventDoc> {
  paginate(filter: Record<string, any>, options: Record<string, any>): Promise<QueryResult>;
}

export type UpdateEventBody = Partial<IEvent>;

export type NewCreatedEvent = Required<IEvent>;
