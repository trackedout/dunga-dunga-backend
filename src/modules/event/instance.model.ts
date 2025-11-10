import mongoose from 'mongoose';
import toJSON from '../toJSON/toJSON';
import paginate from '../paginate/paginate';
import { IInstanceDoc, IInstanceModel } from './instance.interfaces';

const instanceSchema = new mongoose.Schema<IInstanceDoc, IInstanceModel>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    ip: {
      type: String,
      required: true,
      trim: true,
    },
    reservedBy: {
      type: String,
      required: false,
      trim: true,
    },
    inUseDate: {
      type: Date,
      required: false,
    },
    reservedDate: {
      type: Date,
      required: false,
    },
    activePlayers: {
      type: Number,
      required: false,
      default: 0,
    },
    state: {
      type: String,
      required: true,
      trim: true,
    },
    claimId: {
      type: String,
      required: false,
      trim: true,
    },
    requiresRebuild: {
      type: Boolean,
      required: true,
      default: false,
    },
    healthySince: {
      type: Date,
      required: false,
    },
    unhealthySince: {
      type: Date,
      required: false,
    },
    claimFilters: {
      type: Map<String, Array<String>>,
      required: false,
    },
  },
  {
    timestamps: true,
  }
);

instanceSchema.index({ state: 1, reservedBy: 1, requiresRebuild: 1, reservedDate: 1, name: 1 });
instanceSchema.index({ 'metadata.run-id': 1, name: 1 });

// add plugin that converts mongoose to json
instanceSchema.plugin(toJSON);
instanceSchema.plugin(paginate);

instanceSchema.pre('save', async function (next) {
  next();
});

const DungeonInstance = mongoose.model<IInstanceDoc, IInstanceModel>('Instance', instanceSchema);

export default DungeonInstance;
