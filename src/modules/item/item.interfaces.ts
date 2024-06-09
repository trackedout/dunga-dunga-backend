import { Model, Document } from 'mongoose';
import { QueryResult } from '../paginate/paginate';

export interface IItem {
  name: string;
  player: string;
  server: string;
  deckId: string;
}

export interface IItemDoc extends IItem, Document {}

export interface IItemModel extends Model<IItemDoc> {
  paginate(filter: Record<string, any>, options: Record<string, any>): Promise<QueryResult>;
}

export type UpdateItemBody = Partial<IItem>;

export type NewCreatedItem = Required<IItem>;

export type DeleteItem = Pick<IItem, 'name' | 'player' | 'deckId'>;
