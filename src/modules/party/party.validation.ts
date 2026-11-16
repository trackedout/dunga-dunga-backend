import Joi from 'joi';
import { objectId } from '../validate/custom.validation';

export const createParty = {
  body: Joi.object().keys({
    leader: Joi.string().required().min(1),
    slug: Joi.string().required().min(1),
  }),
};

export const getParty = {
  query: Joi.object().keys({
    player: Joi.string().required().min(1),
  }),
};

export const invitePlayer = {
  params: Joi.object().keys({
    id: Joi.string().custom(objectId).required(),
  }),
  body: Joi.object().keys({
    player: Joi.string().required().min(1),
  }),
};

export const joinParty = {
  params: Joi.object().keys({
    id: Joi.string().custom(objectId).required(),
  }),
  body: Joi.object().keys({
    player: Joi.string().required().min(1),
  }),
};

export const leaveParty = {
  params: Joi.object().keys({
    id: Joi.string().custom(objectId).required(),
  }),
  body: Joi.object().keys({
    player: Joi.string().required().min(1),
  }),
};

export const kickPlayer = {
  params: Joi.object().keys({
    id: Joi.string().custom(objectId).required(),
  }),
  body: Joi.object().keys({
    player: Joi.string().required().min(1),
  }),
};

export const disbandParty = {
  params: Joi.object().keys({
    id: Joi.string().custom(objectId).required(),
  }),
};
