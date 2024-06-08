import mongoose from 'mongoose';
import toJSON from '../toJSON/toJSON';
import paginate from '../paginate/paginate';
import { ILockDoc, ILockModel } from './lock.interfaces';

const lockSchema = new mongoose.Schema<ILockDoc, ILockModel>(
  {
    type: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    target: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    until: {
      type: Date,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// add plugin that converts mongoose to json
lockSchema.plugin(toJSON);
lockSchema.plugin(paginate);

lockSchema.pre('save', async function (next) {
  next();
});

const Lock = mongoose.model<ILockDoc, ILockModel>('Lock', lockSchema);

export default Lock;
