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
    slug: {
      type: String,
      required: true,
      trim: true,
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

// Legacy scores from before namespacing have no slug, so the uniqueness
// constraint only applies to scores that have one.
scoreSchema.index({ slug: 1, player: 1, key: 1 }, { unique: true, partialFilterExpression: { slug: { $type: 'string' } } });
scoreSchema.index({ slug: 1, key: 1, value: 1 });
scoreSchema.index({ player: 1, key: 1 });
scoreSchema.index({ player: 1, key: 1, value: 1 });
scoreSchema.index({ key: 1, value: 1 });

// add plugin that converts mongoose to json
scoreSchema.plugin(toJSON);
scoreSchema.plugin(paginate);

const Score = mongoose.model<IScoreDoc, IScoreModel>('Score', scoreSchema);

export default Score;
