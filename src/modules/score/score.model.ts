import mongoose from 'mongoose';
import toJSON from '../toJSON/toJSON';
import paginate from '../paginate/paginate';
import { IScoreDoc, IScoreModel } from './score.interfaces';

const scoreSchema = new mongoose.Schema<IScoreDoc, IScoreModel>(
  {
    player: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    key: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    value: {
      type: Number,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// add plugin that converts mongoose to json
scoreSchema.plugin(toJSON);
scoreSchema.plugin(paginate);

scoreSchema.pre('save', async function (next) {
  next();
});

const Score = mongoose.model<IScoreDoc, IScoreModel>('Score', scoreSchema);

export default Score;