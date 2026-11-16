import { Model, Document } from 'mongoose';
import { QueryResult } from '../paginate/paginate';

export enum PartyStates {
  FORMING = 'forming',
  QUEUED = 'queued',
  IN_GAME = 'in-game',
  DISBANDED = 'disbanded',
}

export interface IParty {
  leader: string;
  // League the party plays
  slug: string;
  members: string[];
  invites: string[];
  state: PartyStates;
  claimId?: string | undefined;
}

export interface IPartyDoc extends IParty, Document {
  createdAt: Date;
  updatedAt: Date;
}

export interface IPartyModel extends Model<IPartyDoc> {
  paginate(filter: Record<string, any>, options: Record<string, any>): Promise<QueryResult>;
}
