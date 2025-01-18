import mongoose from 'mongoose';
import toJSON from '../toJSON/toJSON';
import paginate from '../paginate/paginate';
import { IClaimDoc, IClaimModel } from './claim.interfaces';

const claimSchema = new mongoose.Schema<IClaimDoc, IClaimModel>(
  {
    player: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    state: {
      type: String,
      required: true,
      trim: true,
    },
    stateReason: {
      type: String,
      required: false,
      trim: true,
    },
    claimant: {
      type: String,
      required: false,
      trim: true,
    },
    metadata: {
      type: Map<String, String>,
      required: false,
      index: false,
    },
  },
  {
    timestamps: true,
  }
);

claimSchema.index({ type: 1, state: 1, claimant: 1 });
claimSchema.index({ player: 1, type: 1, state: 1 });

// add plugin that converts mongoose to json
claimSchema.plugin(toJSON);
claimSchema.plugin(paginate);

claimSchema.pre('save', async function (next) {
  next();
});

const Claim = mongoose.model<IClaimDoc, IClaimModel>('Claim', claimSchema);

export default Claim;
