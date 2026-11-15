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
  const filter = pick(req.query, ['player', 'slug', 'prefixFilter']);
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
  const filter = pick(req.body, ['player', 'slug', 'key']);
  await scoreService.deleteScore(filter);
  res.status(httpStatus.NO_CONTENT).send();
});

let scoreboardNamesCache: { data: string[]; ts: number } | null = null;
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

export const getScoreboardNames = catchAsync(async (_req: Request, res: Response) => {
  if (!scoreboardNamesCache || Date.now() - scoreboardNamesCache.ts > CACHE_TTL) {
    scoreboardNamesCache = { data: await scoreService.getScoreboardNames(), ts: Date.now() };
  }
  res.set('Cache-Control', 'public, max-age=3600');
  res.send(scoreboardNamesCache.data);
});
