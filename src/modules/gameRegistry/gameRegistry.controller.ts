import httpStatus from 'http-status';
import { Request, Response } from 'express';
import catchAsync from '../utils/catchAsync';
import * as gameRegistryService from './gameRegistry.service';

export const getEnabledGames = catchAsync(async (_req: Request, res: Response) => {
  const games = await gameRegistryService.getEnabledGames();
  res.send({ results: games });
});

export const getGameByName = catchAsync(async (req: Request, res: Response) => {
  const game = await gameRegistryService.getGameByName(req.params['name'] as string);
  res.send(game);
});

export const upsertGame = catchAsync(async (req: Request, res: Response) => {
  const game = await gameRegistryService.upsertGameRegistry(req.body);
  res.status(httpStatus.OK).send(game);
});
