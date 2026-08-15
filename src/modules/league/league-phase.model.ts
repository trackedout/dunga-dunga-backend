import mongoose from 'mongoose';
import { ILeaguePhaseStateDoc, ILeaguePhaseStateModel } from './league-phase.interfaces';

const leaguePhaseStateSchema = new mongoose.Schema<ILeaguePhaseStateDoc, ILeaguePhaseStateModel>(
  {
    leagueSlug: {
      type: String,
      required: true,
      index: true,
    },
    phase: {
      type: Number,
      required: true,
    },
    state: {
      type: String,
      required: true,
      enum: ['ACTIVE', 'COMPLETED', 'NOT_STARTED'],
      default: 'NOT_STARTED',
    },
  },
  {
    timestamps: true,
    collection: 'leaguePhaseStates',
  }
);

leaguePhaseStateSchema.index({ leagueSlug: 1, phase: 1 }, { unique: true });

const LeaguePhaseState = mongoose.model<ILeaguePhaseStateDoc, ILeaguePhaseStateModel>(
  'LeaguePhaseState',
  leaguePhaseStateSchema
);

export default LeaguePhaseState;
