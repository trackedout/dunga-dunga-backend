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
    activePlayers: {
      type: Number,
      required: false,
      default: 0,
    },
    inUse: {
      type: Boolean,
      required: true,
      default: false,
    },
    requiresRebuild: {
      type: Boolean,
      required: true,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// add plugin that converts mongoose to json
instanceSchema.plugin(toJSON);
instanceSchema.plugin(paginate);

instanceSchema.pre('save', async function (next) {
  next();
});

const DungeonInstance = mongoose.model<IInstanceDoc, IInstanceModel>('Instance', instanceSchema);

export default DungeonInstance;
