import { Request, Response } from 'express';
import catchAsync from '../utils/catchAsync';
import { getPlayerData, listPlayers } from './player.service';

export const getPlayer = catchAsync(async (req: Request, res: Response) => {
  const result = await getPlayerData(
    req.params['name'] as string,
    req.query['since'] as string | undefined,
    req.query['until'] as string | undefined,
  );
  res.send(result);
});

export const getPlayers = catchAsync(async (req: Request, res: Response) => {
  const result = await listPlayers(req.query['since'] as string | undefined, req.query['runType'] as string | undefined);
  res.send(result);
});
