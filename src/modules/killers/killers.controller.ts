import { Request, Response } from 'express';
import catchAsync from '../utils/catchAsync';
import pick from '../utils/pick';
import { getKillers, getKillerDetail } from './killers.service';

export const getKillersHandler = catchAsync(async (req: Request, res: Response) => {
  const query = pick(req.query, ['limit', 'runType', 'since']) as { limit?: string; runType?: string; since?: string };
  const limit = query.limit ? parseInt(query.limit, 10) : 100;
  const result = await getKillers(limit, query.runType, query.since);
  res.send(result);
});

export const getKillerDetailHandler = catchAsync(async (req: Request, res: Response) => {
  const query = pick(req.query, ['runType', 'since']) as { runType?: string; since?: string };
  const result = await getKillerDetail(req.params['killer'] as string, query.runType, query.since);
  res.send(result);
});
