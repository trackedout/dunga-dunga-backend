import mongoose from 'mongoose';
import toJSON from '../toJSON/toJSON';
import paginate from '../paginate/paginate';
import { ICardDoc, ICardModel } from './card.interfaces';

const cardSchema = new mongoose.Schema<ICardDoc, ICardModel>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    player: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    server: {
      type: String,
      required: true,
      trim: true,
    },
    deckId: {
      type: String,
      required: true,
      default: '1',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// add plugin that converts mongoose to json
cardSchema.plugin(toJSON);
cardSchema.plugin(paginate);

cardSchema.pre('save', async function (next) {
  next();
});

const Card = mongoose.model<ICardDoc, ICardModel>('Card', cardSchema);

export default Card;
