import mongoose from 'mongoose';
import toJSON from '../toJSON/toJSON';
import { ILeaguePhaseDoc, ILeaguePhaseModel } from './league-phase.interfaces';

const leaguePhaseSchema = new mongoose.Schema<ILeaguePhaseDoc, ILeaguePhaseModel>(
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
    start: {
      type: String,
      required: true,
    },
    end: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
    collection: 'leaguePhases',
  }
);

leaguePhaseSchema.index({ leagueSlug: 1, phase: 1 }, { unique: true });
leaguePhaseSchema.plugin(toJSON);

const LeaguePhase = mongoose.model<ILeaguePhaseDoc, ILeaguePhaseModel>('LeaguePhase', leaguePhaseSchema);

export default LeaguePhase;
