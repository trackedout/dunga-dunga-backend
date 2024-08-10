import { Model, Document } from 'mongoose';
import { QueryResult } from '../paginate/paginate';

export interface ICard {
  name: string;
  player: string;
  server: string;
  deckType: string;
  hiddenInDecks: string[];
}

export interface ICardDoc extends ICard, Document {}

export interface ICardModel extends Model<ICardDoc> {
  paginate(filter: Record<string, any>, options: Record<string, any>): Promise<QueryResult>;
}

export type UpdateCardBody = Partial<ICard>;

export type NewCreatedCard = Required<ICard>;

export type DeleteCard = Pick<ICard, 'name' | 'player' | 'deckType'>;

export type OverwritePlayerDeckFilter = Required<Pick<ICard, 'player' | 'server' | 'deckType'>>;
