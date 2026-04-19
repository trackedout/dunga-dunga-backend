import { Request, Response } from 'express';
import catchAsync from '../utils/catchAsync';
import pick from '../utils/pick';
import { getFeed, FeedOptions } from './feed.service';

export const getFeedHandler = catchAsync(async (req: Request, res: Response) => {
  const options = pick(req.query, ['limit', 'page', 'runType', 'outcome', 'difficulty', 'player', 'phase']) as FeedOptions;
  if (options.limit) options.limit = parseInt(options.limit as unknown as string, 10);
  if (options.page) options.page = parseInt(options.page as unknown as string, 10);
  if (options.phase) options.phase = parseInt(options.phase as unknown as string, 10);
  const result = await getFeed(options);
  res.send(result);
});
