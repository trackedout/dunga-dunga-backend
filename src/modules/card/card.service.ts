import httpStatus from 'http-status';
import mongoose from 'mongoose';
import Card from './card.model';
import ApiError from '../errors/ApiError';
import { IOptions, QueryResult } from '../paginate/paginate';
import { ICardDoc, NewCreatedCard, UpdateCardBody } from './card.interfaces';

/**
 * Create a Card, associating it with a Player's deck
 * @param {NewCreatedCard} cardBody
 * @returns {Promise<ICardDoc>}
 */
export const createCard = async (cardBody: NewCreatedCard): Promise<ICardDoc> => {
  return Card.create(cardBody);
};

/**
 * Query for cards
 * @param {Object} filter - Mongo filter
 * @param {Object} options - Query options
 * @returns {Promise<QueryResult>}
 */
export const queryCards = async (filter: Record<string, any>, options: IOptions): Promise<QueryResult> => {
  return Card.paginate(filter, options);
};

/**
 * Get card by id
 * @param {mongoose.Types.ObjectId} id
 * @returns {Promise<ICardDoc | null>}
 */
export const getCardById = async (id: mongoose.Types.ObjectId): Promise<ICardDoc | null> => Card.findById(id);

/**
 * Update card by id
 * @param {mongoose.Types.ObjectId} cardId
 * @param {UpdateCardBody} updateBody
 * @returns {Promise<ICardDoc | null>}
 */
export const updateCardById = async (
  cardId: mongoose.Types.ObjectId,
  updateBody: UpdateCardBody
): Promise<ICardDoc | null> => {
  const card = await getCardById(cardId);
  if (!card) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Card not found');
  }
  Object.assign(card, updateBody);
  await card.save();
  return card;
};

/**
 * Delete card by id
 * @param {mongoose.Types.ObjectId} cardId
 * @returns {Promise<ICardDoc | null>}
 */
export const deleteCardById = async (cardId: mongoose.Types.ObjectId): Promise<ICardDoc | null> => {
  const card = await getCardById(cardId);
  if (!card) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Card not found');
  }
  await card.deleteOne();
  return card;
};
