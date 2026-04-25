import { Request, Response } from 'express';
import catchAsync from '../utils/catchAsync';
import pick from '../utils/pick';
import { getStats } from './stats.service';

export const getStatsHandler = catchAsync(async (req: Request, res: Response) => {
  const query = pick(req.query, ['runType', 'since', 'until', 'phase']) as { runType?: string; since?: string; until?: string; phase?: string };
  const result = await getStats(query.runType, query.since, query.until, query.phase ? parseInt(query.phase, 10) : undefined);
  res.send(result);
});
