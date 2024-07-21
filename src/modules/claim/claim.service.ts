import httpStatus from 'http-status';
import mongoose from 'mongoose';
import Claim from './claim.model';
import ApiError from '../errors/ApiError';
import { IOptions, QueryResult } from '../paginate/paginate';
import { DeleteClaim, IClaimDoc, NewCreatedClaim, UpdateClaimBody } from './claim.interfaces';

export const createClaims = async (claims: NewCreatedClaim[]): Promise<IClaimDoc[]> => {
  if (claims.length === 0) {
    return [];
  }

  return Claim.create(claims);
};

export const queryClaims = async (filter: Record<string, any>, options: IOptions): Promise<QueryResult> => {
  return Claim.paginate(filter, options);
};

export const getClaimById = async (id: mongoose.Types.ObjectId): Promise<IClaimDoc | null> => Claim.findById(id);

export const updateClaimById = async (claimId: mongoose.Types.ObjectId, updateBody: UpdateClaimBody): Promise<IClaimDoc | null> => {
  const claim = await getClaimById(claimId);
  if (!claim) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Claim not found');
  }
  Object.assign(claim, updateBody);
  await claim.save();
  return claim;
};

export const deleteClaim = async (filter: DeleteClaim): Promise<IClaimDoc | null> => {
  const claim = await Claim.findOne(filter).exec();
  if (!claim) {
    throw new ApiError(httpStatus.NOT_FOUND, `Claim not found for filter ${filter}`);
  }
  await claim.deleteOne();
  return claim;
};
