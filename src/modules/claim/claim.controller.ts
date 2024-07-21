import httpStatus from 'http-status';
import { Request, Response } from 'express';
import mongoose from 'mongoose';
import catchAsync from '../utils/catchAsync';
import ApiError from '../errors/ApiError';
import pick from '../utils/pick';
import { IOptions } from '../paginate/paginate';
import * as claimService from './claim.service';

export const createClaim = catchAsync(async (req: Request, res: Response) => {
  const claim = await claimService.createClaims([req.body]);
  res.status(httpStatus.CREATED).send(claim);
});

export const createClaims = catchAsync(async (req: Request, res: Response) => {
  const claims = await claimService.createClaims(req.body);
  res.status(httpStatus.CREATED).send(claims);
});

export const getClaims = catchAsync(async (req: Request, res: Response) => {
  const filter = pick(req.query, ['player', 'claimant', 'type', 'state']);
  const options: IOptions = pick(req.query, ['sortBy', 'limit', 'page', 'projectBy']);
  const result = await claimService.queryClaims(filter, options);
  res.send(result);
});

export const getClaim = catchAsync(async (req: Request, res: Response) => {
  if (typeof req.params['claimId'] === 'string') {
    const claim = await claimService.getClaimById(new mongoose.Types.ObjectId(req.params['claimId']));
    if (!claim) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Claim not found');
    }
    res.send(claim);
  }
});

export const updateClaim = catchAsync(async (req: Request, res: Response) => {
  if (typeof req.params['claimId'] === 'string') {
    const claim = await claimService.updateClaimById(new mongoose.Types.ObjectId(req.params['claimId']), req.body);
    res.send(claim);
  }
});

export const deleteClaim = catchAsync(async (req: Request, res: Response) => {
  const filter = pick(req.body, ['id', 'player', 'state', 'type']);
  await claimService.deleteClaim(filter);
  res.status(httpStatus.NO_CONTENT).send();
});
