import { Model, Document } from 'mongoose';
import { QueryResult } from '../paginate/paginate';

export interface IConfig {
  entity: string;
  key: string;
  value: string;
  metadata: Map<string, string>;
}

export interface IConfigDoc extends IConfig, Document {}

export interface IConfigModel extends Model<IConfigDoc> {
  paginate(filter: Record<string, any>, options: Record<string, any>): Promise<QueryResult>;
}

export type UpdateConfigBody = Partial<IConfig>;

export type NewCreatedConfig = Required<IConfig>;

export type GetConfig = Required<Pick<IConfig, 'entity' | 'key'>>;

export type DeleteConfig = Pick<IConfig, 'entity' | 'key' | 'value'>;
