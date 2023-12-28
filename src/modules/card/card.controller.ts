import httpStatus from 'http-status';
import { Request, Response } from 'express';
import mongoose from 'mongoose';
import catchAsync from '../utils/catchAsync';
import ApiError from '../errors/ApiError';
import pick from '../utils/pick';
import { IOptions } from '../paginate/paginate';
import * as cardService from './card.service';

export const createCard = catchAsync(async (req: Request, res: Response) => {
  const card = await cardService.createCard({
    ...req.body,
    // sourceIP: req.ip?.split(":").slice(-1)[0],
  });
  res.status(httpStatus.CREATED).send(card);
});

export const getCards = catchAsync(async (req: Request, res: Response) => {
  const filter = pick(req.query, ['name', 'server', 'player', 'deckId']);
  const options: IOptions = pick(req.query, ['sortBy', 'limit', 'page', 'projectBy']);
  const result = await cardService.queryCards(filter, options);
  res.send(result);
});

export const getCard = catchAsync(async (req: Request, res: Response) => {
  if (typeof req.params['cardId'] === 'string') {
    const card = await cardService.getCardById(new mongoose.Types.ObjectId(req.params['cardId']));
    if (!card) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Card not found');
    }
    res.send(card);
  }
});

export const updateCard = catchAsync(async (req: Request, res: Response) => {
  if (typeof req.params['cardId'] === 'string') {
    const card = await cardService.updateCardById(new mongoose.Types.ObjectId(req.params['cardId']), req.body);
    res.send(card);
  }
});

export const deleteCard = catchAsync(async (req: Request, res: Response) => {
  const filter = pick(req.query, ['name', 'player', 'deckId']);
  await cardService.deleteCard(filter);
  res.status(httpStatus.NO_CONTENT).send();
});
