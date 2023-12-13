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
      required: true,
    },
    server: {
      type: String,
      required: true,
      trim: true,
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
