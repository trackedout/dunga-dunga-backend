import mongoose from 'mongoose';
import toJSON from '../toJSON/toJSON';
import paginate from '../paginate/paginate';
import { IEventDoc, IEventModel } from './event.interfaces';

const eventSchema = new mongoose.Schema<IEventDoc, IEventModel>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    player: {
      type: String,
      required: true,
      trim: true,
    },
    count: {
      type: Number,
      required: false,
      default: 1,
    },
    server: {
      type: String,
      required: true,
      trim: true,
    },
    runId: {
      type: String,
      required: false,
      trim: true,
    },
    x: {
      type: Number,
      required: true,
    },
    y: {
      type: Number,
      required: true,
    },
    z: {
      type: Number,
      required: true,
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

// add plugin that converts mongoose to json
eventSchema.plugin(toJSON);
eventSchema.plugin(paginate);

eventSchema.pre('save', async function (next) {
  next();
});

const Event = mongoose.model<IEventDoc, IEventModel>('Event', eventSchema);

export default Event;
