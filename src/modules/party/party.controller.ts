import httpStatus from 'http-status';
import { Request, Response } from 'express';
import catchAsync from '../utils/catchAsync';
import ApiError from '../errors/ApiError';
import * as partyService from './party.service';

export const createParty = catchAsync(async (req: Request, res: Response) => {
  const { leader, game } = req.body;
  const party = await partyService.createParty(leader, game);
  res.status(httpStatus.CREATED).send(party);
});

export const getParty = catchAsync(async (req: Request, res: Response) => {
  const playerName = req.query['player'] as string;
  if (!playerName) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Query parameter "player" is required');
  }
  const party = await partyService.getActivePartyForPlayer(playerName);
  if (!party) {
    throw new ApiError(httpStatus.NOT_FOUND, `No active party found for player '${playerName}'`);
  }
  res.send(party);
});

export const invitePlayer = catchAsync(async (req: Request, res: Response) => {
  const { player } = req.body;
  const partyId = req.params['id'] as string;
  const party = await partyService.getPartyById(partyId);
  if (!party) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Party not found');
  }
  const result = await partyService.invitePlayer(partyId, party.leader, player);
  res.send(result);
});

export const joinParty = catchAsync(async (req: Request, res: Response) => {
  const { player } = req.body;
  const party = await partyService.joinParty(req.params['id'] as string, player);
  res.send(party);
});

export const leaveParty = catchAsync(async (req: Request, res: Response) => {
  const { player } = req.body;
  const party = await partyService.leaveParty(req.params['id'] as string, player);
  res.send(party);
});

export const kickPlayer = catchAsync(async (req: Request, res: Response) => {
  const { player } = req.body;
  const partyId = req.params['id'] as string;
  const party = await partyService.getPartyById(partyId);
  if (!party) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Party not found');
  }
  const result = await partyService.kickPlayer(partyId, party.leader, player);
  res.send(result);
});

export const queueParty = catchAsync(async (req: Request, res: Response) => {
  const { player } = req.body;
  const party = await partyService.queueParty(req.params['id'] as string, player);
  res.send(party);
});

export const disbandParty = catchAsync(async (req: Request, res: Response) => {
  const partyId = req.params['id'] as string;
  const party = await partyService.getPartyById(partyId);
  if (!party) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Party not found');
  }
  const result = await partyService.disbandParty(partyId, party.leader);
  res.status(httpStatus.OK).send(result);
});
