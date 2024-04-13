import httpStatus from 'http-status';
import { Request, Response } from 'express';
import mongoose from 'mongoose';
import catchAsync from '../utils/catchAsync';
import ApiError from '../errors/ApiError';
import pick from '../utils/pick';
import { IOptions } from '../paginate/paginate';
import * as itemService from './item.service';

export const createItem = catchAsync(async (req: Request, res: Response) => {
  const item = await itemService.createItem({
    ...req.body,
    // sourceIP: req.ip?.split(":").slice(-1)[0],
  });
  res.status(httpStatus.CREATED).send(item);
});

export const getItems = catchAsync(async (req: Request, res: Response) => {
  const filter = pick(req.query, ['name', 'server', 'player', 'deckId']);
  const options: IOptions = pick(req.query, ['sortBy', 'limit', 'page', 'projectBy']);
  const result = await itemService.queryItems(filter, options);
  res.send(result);
});

export const getItem = catchAsync(async (req: Request, res: Response) => {
  if (typeof req.params['itemId'] === 'string') {
    const item = await itemService.getItemById(new mongoose.Types.ObjectId(req.params['itemId']));
    if (!item) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Item not found');
    }
    res.send(item);
  }
});

export const updateItem = catchAsync(async (req: Request, res: Response) => {
  if (typeof req.params['itemId'] === 'string') {
    const item = await itemService.updateItemById(new mongoose.Types.ObjectId(req.params['itemId']), req.body);
    res.send(item);
  }
});

export const deleteItem = catchAsync(async (req: Request, res: Response) => {
  const filter = pick(req.body, ['name', 'player', 'deckId']);
  await itemService.deleteItem(filter);
  res.status(httpStatus.NO_CONTENT).send();
});

export const overwritePlayerDeck = catchAsync(async (req: Request, res: Response) => {
  const filter = pick(req.query, ['player', 'server', 'deckId'])
  await itemService.overwritePlayerDeck(filter, req.body);
  res.status(httpStatus.NO_CONTENT).send();
});
