import httpStatus from 'http-status';
import { Request, Response } from 'express';
import mongoose from 'mongoose';
import catchAsync from '../utils/catchAsync';
import ApiError from '../errors/ApiError';
import pick from '../utils/pick';
import { IOptions } from '../paginate/paginate';
import * as scoreService from './score.service';

export const createScore = catchAsync(async (req: Request, res: Response) => {
  const score = await scoreService.createScores([req.body]);
  res.status(httpStatus.CREATED).send(score);
});

export const createScores = catchAsync(async (req: Request, res: Response) => {
  const scores = await scoreService.createScores(req.body);
  res.status(httpStatus.CREATED).send(scores);
});

export const getScores = catchAsync(async (req: Request, res: Response) => {
  const filter = pick(req.query, ['player', 'prefixFilter']);
  if (filter.prefixFilter) {
    filter.key = new RegExp(`^${filter.prefixFilter}`);
    delete(filter.prefixFilter);
  }

  const options: IOptions = pick(req.query, ['sortBy', 'limit', 'page', 'projectBy']);
  const result = await scoreService.queryScores(filter, options);
  res.send(result);
});

export const getScore = catchAsync(async (req: Request, res: Response) => {
  if (typeof req.params['scoreId'] === 'string') {
    const score = await scoreService.getScoreById(new mongoose.Types.ObjectId(req.params['scoreId']));
    if (!score) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Score not found');
    }
    res.send(score);
  }
});

export const updateScore = catchAsync(async (req: Request, res: Response) => {
  if (typeof req.params['scoreId'] === 'string') {
    const score = await scoreService.updateScoreById(new mongoose.Types.ObjectId(req.params['scoreId']), req.body);
    res.send(score);
  }
});

export const deleteScore = catchAsync(async (req: Request, res: Response) => {
  const filter = pick(req.body, ['id', 'name', 'player', 'deckId']);
  await scoreService.deleteScore(filter);
  res.status(httpStatus.NO_CONTENT).send();
});
