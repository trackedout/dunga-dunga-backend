import mongoose from 'mongoose';
import toJSON from '../toJSON/toJSON';
import paginate from '../paginate/paginate';
import { ITaskDoc, ITaskModel } from './task.interfaces';

const taskSchema = new mongoose.Schema<ITaskDoc, ITaskModel>(
  {
    type: {
      type: String,
      required: true,
      trim: true,
    },
    arguments: {
      type: [String],
      required: false,
    },
    server: {
      type: String,
      required: true,
      trim: true,
    },
    targetPlayer: {
      type: String,
      required: false,
      trim: true,
    },
    state: {
      type: String,
      required: true,
      trim: true,
    },
    sourceIP: {
      type: String,
      required: true,
      trim: true,
    },
    processingFailed: {
      type: Boolean,
      required: false,
      default: false,
    },
    error: {
      type: String,
      required: false,
    },
  },
  {
    timestamps: true,
  }
);

taskSchema.index({ createdAt: 1 });

// add plugin that converts mongoose to json
taskSchema.plugin(toJSON);
taskSchema.plugin(paginate);

taskSchema.pre('save', async function (next) {
  next();
});

const Task = mongoose.model<ITaskDoc, ITaskModel>('Task', taskSchema);

export default Task;
