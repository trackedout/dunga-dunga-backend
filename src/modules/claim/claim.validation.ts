import Joi from 'joi';
import { objectId } from '../validate/custom.validation';
import { NewCreatedClaim } from './claim.interfaces';

const createClaimBody: Record<keyof NewCreatedClaim, any> = {
  player: Joi.string().required().min(1),
  type: Joi.string().required().min(1),
  state: Joi.string().required().min(1),
  claimant: Joi.string().required(),
  metadata: Joi.any(),
  stateReason: Joi.string(),
};

export const createClaim = {
  body: Joi.object().keys(createClaimBody),
};

export const createClaims = {
  body: Joi.array().items(createClaimBody).min(1),
};

export const getClaims = {
  query: Joi.object().keys({
    player: Joi.string(),
    type: Joi.string(),
    state: Joi.string(),
    claimant: Joi.string(),

    sortBy: Joi.string(),
    projectBy: Joi.string(),
    limit: Joi.number().integer(),
    page: Joi.number().integer(),
  }),
};

export const getClaim = {
  params: Joi.object().keys({
    claimId: Joi.string().custom(objectId),
  }),
};

export const updateClaim = {
  params: Joi.object().keys({
    claimId: Joi.required().custom(objectId),
  }),
  body: Joi.object()
    .keys(createClaimBody)
    .min(1),
};

export const deleteClaim = {
  body: Joi.object().keys({
    id: Joi.string(),
    player: Joi.string().required(),
    type: Joi.string().required(),
    state: Joi.string(),
  }),
};
