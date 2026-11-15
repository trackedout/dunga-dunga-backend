import { Model, Document } from 'mongoose';
import { QueryResult } from '../paginate/paginate';

export interface IScore {
  player: string;
  // The league namespace this score belongs to (e.g. do2-s2-comp). A score key
  // is only unique within a slug: do2.wins in do2-s2-comp and in do2-s2-practice
  // are two different scores.
  slug: string;
  key: string;
  value: number;
  metadata: Map<string, string>;
}

export interface IScoreDoc extends IScore, Document {
  createdAt: Date;
  updatedAt: Date;
}

export interface IScoreModel extends Model<IScoreDoc> {
  paginate(filter: Record<string, any>, options: Record<string, any>): Promise<QueryResult>;
}

export type UpdateScoreBody = Partial<IScore>;

export type NewCreatedScore = Required<IScore>;

export type DeleteScore = Pick<IScore, 'player' | 'slug' | 'key'>;
