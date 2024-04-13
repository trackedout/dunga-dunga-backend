import mongoose from 'mongoose';
import toJSON from '../toJSON/toJSON';
import paginate from '../paginate/paginate';
import { IItemDoc, IItemModel } from './item.interfaces';

const itemSchema = new mongoose.Schema<IItemDoc, IItemModel>(
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
itemSchema.plugin(toJSON);
itemSchema.plugin(paginate);

itemSchema.pre('save', async function (next) {
  next();
});

const Item = mongoose.model<IItemDoc, IItemModel>('Item', itemSchema);

export default Item;
