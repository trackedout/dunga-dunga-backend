import { Model, Document } from 'mongoose';

export type PhaseState = 'ACTIVE' | 'COMPLETED' | 'NOT_STARTED';

// Only stores mutable state — the schedule (start/end) lives in the league document
export interface ILeaguePhaseState {
  leagueSlug: string;
  phase: number;
  state: PhaseState;
}

export interface ILeaguePhaseStateDoc extends ILeaguePhaseState, Document {
  createdAt: Date;
  updatedAt: Date;
}

export interface ILeaguePhaseStateModel extends Model<ILeaguePhaseStateDoc> {}
