import mongoose from 'mongoose';
import toJSON from '../toJSON/toJSON';
import paginate from '../paginate/paginate';
import { IPlayerDoc, IPlayerModel } from './player.interfaces';

const playerSchema = new mongoose.Schema<IPlayerDoc, IPlayerModel>(
  {
    playerName: {
      type: String,
      required: true,
      trim: true,
    },
    server: {
      type: String,
      required: true,
      trim: true,
    },
    state: {
      type: String,
      required: true,
      trim: true,
    },
    isAllowedToPlayDO2: {
      type: Boolean,
      required: true,
      default: false,
    },
    lastSelectedDeck: {
      type: String,
      required: false,
      trim: true,
    },
    lastSeen: {
      type: Date,
      required: false,
    },
    lastLocation: {
      type: {
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
      },
      required: false,
    },
  },
  {
    timestamps: true,
  }
);

// add plugin that converts mongoose to json
playerSchema.plugin(toJSON);
playerSchema.plugin(paginate);

playerSchema.pre('save', async function (next) {
  next();
});

const Player = mongoose.model<IPlayerDoc, IPlayerModel>('Player', playerSchema);

export default Player;
