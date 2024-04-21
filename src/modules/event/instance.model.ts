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
    requiresRebuild: {
      type: Boolean,
      required: true,
      default: false,
    },
    unhealthySince: {
      type: Date,
      required: false,
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
