import mongoose from 'mongoose';
import toJSON from '../toJSON/toJSON';
import paginate from '../paginate/paginate';
import { ITrophyDoc, ITrophyModel } from './trophy.interfaces';

/**
{
  "tot_key": "death_loop_loop",
  "armor_stand": {
    "head": "4Ply",
    "x": 0,
    "y": 0,
    "z": 0,
  },
  "sign": {
    "text": [
      "",
      "4Ply",
      "2025-02-24",
      ""
    ],
    "x": 0,
    "y": 0,
    "z": 0,
  },
  "createdAt": ...,
  "updatedAt": ...
}
/*/

const trophySchema = new mongoose.Schema<ITrophyDoc, ITrophyModel>(
  {
    totKey: {
      type: String,
      required: true,
      trim: true,
      index: true,
      unique: true,
    },
    armorStand: {
      type: new mongoose.Schema(
        {
          head: { type: String, required: true },
          x: { type: Number, required: true },
          y: { type: Number, required: true },
          z: { type: Number, required: true },
        },
        { _id: false }
      ),
      required: false,
    },
    sign: {
      type: new mongoose.Schema(
        {
          text: {
            type: [String],
            validate: {
              validator: (arr: string[]) => arr.length === 4,
              message: 'sign.text must have exactly 4 elements',
            },
            required: true,
          },
          x: { type: Number, required: true },
          y: { type: Number, required: true },
          z: { type: Number, required: true },
        },
        { _id: false }
      ),
      required: false,
    },
  },
  {
    timestamps: true,
  }
);

// trophySchema.index({ totKey: 1 }, { unique: true });

// add plugin that converts mongoose to json
trophySchema.plugin(toJSON);
trophySchema.plugin(paginate);

trophySchema.pre('save', async function (next) {
  next();
});

const Trophy = mongoose.model<ITrophyDoc, ITrophyModel>('Trophy', trophySchema);

export default Trophy;
