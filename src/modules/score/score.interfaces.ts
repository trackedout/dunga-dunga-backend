import { Model, Document } from 'mongoose';
import { QueryResult } from '../paginate/paginate';

export interface IScore {
  player: string;
  key: string;
  value: number;
}

export interface IScoreDoc extends IScore, Document {}

export interface IScoreModel extends Model<IScoreDoc> {
  paginate(filter: Record<string, any>, options: Record<string, any>): Promise<QueryResult>;
}

export type UpdateScoreBody = Partial<IScore>;

export type NewCreatedScore = Required<IScore>;

export type DeleteScore = Pick<IScore, 'player' | 'key' | 'value'>;
