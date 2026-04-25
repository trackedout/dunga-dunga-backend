import { Request, Response } from 'express';
import catchAsync from '../utils/catchAsync';
import pick from '../utils/pick';
import { getCardStats } from './cardStats.service';

export const getCardStatsHandler = catchAsync(async (req: Request, res: Response) => {
  const query = pick(req.query, ['runType', 'since']) as { runType?: string; since?: string };
  const result = await getCardStats(query.runType, query.since);
  res.send(result);
});
