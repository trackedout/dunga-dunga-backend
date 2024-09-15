import mongoose from 'mongoose';
import { ICardDoc, ICardModel } from '../card/card.interfaces';
import { Card } from '../card';

const Item = mongoose.model<ICardDoc, ICardModel>('Item', Card.schema);

export default Item;
