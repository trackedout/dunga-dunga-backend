import { Model, Document } from 'mongoose';
import { QueryResult } from '../paginate/paginate';

export interface IClaim {
  player: string;
  claimant: string; // Usually the server name
  type: ClaimTypes;
  state: ClaimStates;
  stateReason: string;

  metadata: Map<string, string>;
}

/*
  Claim:
    player=4Ply
    type=dungeon
    state=pending
    metadata:
      deck-id=1
      run-id=123123-123-123-123-123
      run-type=practice
      tome-count=1
 */

export enum ClaimTypes {
  DUNGEON = 'dungeon',
}

export enum RunTypes {
  PRACTICE = 'practice',
  COMPETITIVE = 'competitive',
}

export enum DungeonTypes {
  DEFAULT = 'default',
  SEASON_2 = 'season-2',
}

export enum ClaimStates {
  PENDING = 'pending',
  ACQUIRED = 'acquired', // dungeon instances query for this state

  IN_USE = 'in-use',
  INVALID = 'invalid',

  // Maybe
  PERSISTING = 'persisting', // Finalizing state (writing scores to DB)
  FINALIZED = 'finalized',
}

export enum ClaimFilters {
  DUNGEON_TYPE = 'dungeon-type',
}

export interface IClaimDoc extends IClaim, Document {}

export interface IClaimModel extends Model<IClaimDoc> {
  paginate(filter: Record<string, any>, options: Record<string, any>): Promise<QueryResult>;
}

export type UpdateClaimBody = Partial<IClaim>;

export type NewCreatedClaim = Required<IClaim>;

export type DeleteClaim = Pick<IClaim, 'player' | 'type' | 'state'>;
