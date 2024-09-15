import httpStatus from 'http-status';
import mongoose from 'mongoose';
import Item from './item.model';
import ApiError from '../errors/ApiError';
import { IOptions, QueryResult } from '../paginate/paginate';
import { DeleteCard, ICardDoc, NewCreatedCard, UpdateCardBody } from '../card/card.interfaces';
import Player from '../event/player.model';

/**
 * Create a Item, associating it with a Player's deck
 * @param {NewCreatedCard} itemBody
 * @returns {Promise<ICardDoc>}
 */
export const createItem = async (itemBody: NewCreatedCard): Promise<ICardDoc> => {
  const player = await Player.findOne({ playerName: itemBody.player }).exec();
  if (!player) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Player does not exist');
  }
  return Item.create(itemBody);
};

/**
 * Query for items
 * @param {Object} filter - Mongo filter
 * @param {Object} options - Query options
 * @returns {Promise<QueryResult>}
 */
export const queryItems = async (filter: Record<string, any>, options: IOptions): Promise<QueryResult> => {
  return Item.paginate(filter, options);
};

/**
 * Get item by id
 * @param {mongoose.Types.ObjectId} id
 * @returns {Promise<ICardDoc | null>}
 */
export const getItemById = async (id: mongoose.Types.ObjectId): Promise<ICardDoc | null> => Item.findById(id);

/**
 * Update item by id
 * @param {mongoose.Types.ObjectId} itemId
 * @param {UpdateCardBody} updateBody
 * @returns {Promise<ICardDoc | null>}
 */
export const updateItemById = async (itemId: mongoose.Types.ObjectId, updateBody: UpdateCardBody): Promise<ICardDoc | null> => {
  const item = await getItemById(itemId);
  if (!item) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Item not found');
  }
  Object.assign(item, updateBody);
  await item.save();
  return item;
};

/**
 * Delete item using a filter
 * @param {DeleteCard} filter
 * @returns {Promise<ICardDoc | null>}
 */
export const deleteItem = async (filter: DeleteCard): Promise<ICardDoc | null> => {
  const item = await Item.findOne(filter).exec();
  if (!item) {
    throw new ApiError(httpStatus.NOT_FOUND, `Item not found for filter ${filter}`);
  }
  await item.deleteOne();
  return item;
};
