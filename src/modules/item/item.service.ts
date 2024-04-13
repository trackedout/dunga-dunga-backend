import httpStatus from 'http-status';
import mongoose from 'mongoose';
import Item from './item.model';
import ApiError from '../errors/ApiError';
import { IOptions, QueryResult } from '../paginate/paginate';
import { DeleteItem, IItemDoc, NewCreatedItem, OverwritePlayerDeckFilter, UpdateItemBody } from './item.interfaces';
import Player from '../event/player.model';

/**
 * Create a Item, associating it with a Player's deck
 * @param {NewCreatedItem} itemBody
 * @returns {Promise<IItemDoc>}
 */
export const createItem = async (itemBody: NewCreatedItem): Promise<IItemDoc> => {
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
 * @returns {Promise<IItemDoc | null>}
 */
export const getItemById = async (id: mongoose.Types.ObjectId): Promise<IItemDoc | null> => Item.findById(id);

/**
 * Update item by id
 * @param {mongoose.Types.ObjectId} itemId
 * @param {UpdateItemBody} updateBody
 * @returns {Promise<IItemDoc | null>}
 */
export const updateItemById = async (itemId: mongoose.Types.ObjectId, updateBody: UpdateItemBody): Promise<IItemDoc | null> => {
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
 * @param {DeleteItem} filter
 * @returns {Promise<IItemDoc | null>}
 */
export const deleteItem = async (filter: DeleteItem): Promise<IItemDoc | null> => {
  const item = await Item.findOne(filter).exec();
  if (!item) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Item not found');
  }
  await item.deleteOne();
  return item;
};

/**
 * Overwrites the existing player deck with the supplied list of items.
 * @param {OverwritePlayerDeckFilter} filter - filters to determine which deck to overwrite
 * @param {Pick<IItem, 'name'>[]} items - The array of new items to overwrite with
 */
export const overwritePlayerDeck = async (filter: OverwritePlayerDeckFilter, items: string[]) => {
  const { player, server, deckId } = filter;

  await Item.deleteMany(filter).exec();

  const newItems = items.map((name) => ({
    name,
    player,
    server,
    deckId,
  }));

  await Item.insertMany(newItems);
};
