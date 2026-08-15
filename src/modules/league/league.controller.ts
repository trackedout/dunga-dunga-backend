import httpStatus from 'http-status';
import { Request, Response } from 'express';
import catchAsync from '../utils/catchAsync';
import * as leagueService from './league.service';

export const getActiveLeagues = catchAsync(async (_req: Request, res: Response) => {
  const leagues = await leagueService.getActiveLeagues();
  res.send({ results: leagues });
});

export const getLeagueBySlug = catchAsync(async (req: Request, res: Response) => {
  const league = await leagueService.getLeagueBySlug(req.params['slug'] as string);
  if (!league) {
    res.status(httpStatus.NOT_FOUND).send({ code: 404, message: 'League not found' });
    return;
  }
  res.send(league);
});

export const upsertLeague = catchAsync(async (req: Request, res: Response) => {
  const league = await leagueService.upsertLeague(req.body);
  res.status(httpStatus.OK).send(league);
});
