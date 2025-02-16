import httpStatus from 'http-status';
import mongoose from 'mongoose';
import Card from './card.model';
import ApiError from '../errors/ApiError';
import { IOptions, QueryResult } from '../paginate/paginate';
import { DeleteCard, ICardDoc, NewCreatedCard, OverwritePlayerDeckFilter, UpdateCardBody } from './card.interfaces';
import Player from '../event/player.model';
import { logger } from '../logger';

/**
 * Create a Card, associating it with a Player's deck
 * @param {NewCreatedCard} cardBody
 * @returns {Promise<ICardDoc>}
 */
export const createCard = async (cardBody: NewCreatedCard): Promise<ICardDoc> => {
  const player = await Player.findOne({ playerName: cardBody.player }).exec();
  if (!player) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Player does not exist');
  }
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
export const updateCardById = async (cardId: mongoose.Types.ObjectId, updateBody: UpdateCardBody): Promise<ICardDoc | null> => {
  const card = await getCardById(cardId);
  if (!card) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Card not found');
  }
  Object.assign(card, updateBody);
  await card.save();
  return card;
};

/**
 * Delete card using a filter
 * @param {DeleteCard} filter
 * @returns {Promise<ICardDoc | null>}
 */
export const deleteCard = async (filter: DeleteCard): Promise<ICardDoc | null> => {
  const card = await Card.findOne(filter).exec();
  if (!card) {
    const filterString = JSON.stringify(filter);
    logger.error(`Card not found for filter ${filterString}`);
    throw new ApiError(httpStatus.NOT_FOUND, `Card not found for filter ${filterString}`);
  }
  await card.deleteOne();
  return card;
};

/**
 * Overwrites the existing player deck with the supplied list of cards.
 * @param {OverwritePlayerDeckFilter} filter - filters to determine which deck to overwrite
 * @param {Pick<ICard, 'name'>[]} cards - The array of new cards to overwrite with
 */
export const overwritePlayerDeck = async (filter: OverwritePlayerDeckFilter, cards: string[]) => {
  const { player, server, deckType } = filter;

  await Card.deleteMany(filter).exec();

  const newCards = cards.map((name) => ({
    name,
    player,
    server,
    deckType,
  }));

  await Card.insertMany(newCards);
};
