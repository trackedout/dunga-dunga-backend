import { Request, Response } from 'express';
import catchAsync from '../utils/catchAsync';
import { getOverview } from './overview.service';

export const getOverviewHandler = catchAsync(async (_req: Request, res: Response) => {
  const result = await getOverview();
  res.send(result);
});
