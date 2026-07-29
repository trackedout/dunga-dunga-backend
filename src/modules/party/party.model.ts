import mongoose from 'mongoose';
import toJSON from '../toJSON/toJSON';
import paginate from '../paginate/paginate';
import { IPartyDoc, IPartyModel, PartyStates } from './party.interfaces';

const partySchema = new mongoose.Schema<IPartyDoc, IPartyModel>(
  {
    leader: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    game: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    members: {
      type: [String],
      required: true,
      default: [],
    },
    invites: {
      type: [String],
      default: [],
    },
    state: {
      type: String,
      required: true,
      enum: Object.values(PartyStates),
      index: true,
    },
    claimId: {
      type: String,
      required: false,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

partySchema.index({ members: 1, state: 1 });
partySchema.index({ leader: 1, state: 1 });

partySchema.plugin(toJSON);
partySchema.plugin(paginate);

const Party = mongoose.model<IPartyDoc, IPartyModel>('Party', partySchema);

export default Party;
