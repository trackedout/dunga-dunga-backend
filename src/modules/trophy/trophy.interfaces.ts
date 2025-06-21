import { Model, Document } from 'mongoose';
import { QueryResult } from '../paginate/paginate';

export interface ITrophy {
  totKey: string;
  armorStand?: {
    head: string;
    x: number;
    y: number;
    z: number;
  };
  sign: {
    text: [string, string, string, string];
    x: number;
    y: number;
    z: number;
  };
}

export interface ITrophyDoc extends ITrophy, Document {}

export interface ITrophyModel extends Model<ITrophyDoc> {
  paginate(filter: Record<string, any>, options: Record<string, any>): Promise<QueryResult>;
}
