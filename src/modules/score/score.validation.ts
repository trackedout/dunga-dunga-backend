import Joi from 'joi';
import { password, objectId } from '../validate/custom.validation';
import { NewCreatedScore } from './score.interfaces';

const createScoreBody: Record<keyof NewCreatedScore, any> = {
  player: Joi.string().required().min(1),
  key: Joi.string().required().min(3),
  value: Joi.number().required().min(0),
};

export const createScore = {
  body: Joi.object().keys(createScoreBody),
};

export const createScores = {
  body: Joi.array().items(createScoreBody).min(1),
};

export const getScores = {
  query: Joi.object().keys({
    player: Joi.string().required(),

    sortBy: Joi.string(),
    projectBy: Joi.string(),
    limit: Joi.number().integer(),
    page: Joi.number().integer(),
  }),
};

export const getScore = {
  params: Joi.object().keys({
    scoreId: Joi.string().custom(objectId),
  }),
};

export const updateScore = {
  params: Joi.object().keys({
    scoreId: Joi.required().custom(objectId),
  }),
  body: Joi.object()
    .keys({
      email: Joi.string().email(),
      password: Joi.string().custom(password),
      name: Joi.string(),
    })
    .min(1),
};

export const deleteScore = {
  body: Joi.object().keys({
    id: Joi.string(),
    name: Joi.string(),
    player: Joi.string().required(),
    deckId: Joi.string().required(),
    server: Joi.string(),
  }),
};
