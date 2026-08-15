import { Model, Document } from 'mongoose';

export type PhaseState = 'ACTIVE' | 'COMPLETED' | 'NOT_STARTED';

export interface ILeaguePhase {
  leagueSlug: string;
  phase: number;
  state: PhaseState;
  start: string;
  end: string;
}

export interface ILeaguePhaseDoc extends ILeaguePhase, Document {
  createdAt: Date;
  updatedAt: Date;
}

export interface ILeaguePhaseModel extends Model<ILeaguePhaseDoc> {}
