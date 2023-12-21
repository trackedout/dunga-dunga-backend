import Joi from 'joi';
import { password, objectId } from '../validate/custom.validation';
import { NewCreatedCard } from './card.interfaces';

const createCardBody: Record<keyof NewCreatedCard, any> = {
  name: Joi.string().required().min(3),
  player: Joi.string().required().min(1),
  server: Joi.string().required().min(1),
  deckId: Joi.string().optional().min(1),
};

export const createCard = {
  body: Joi.object().keys(createCardBody),
};

export const getCards = {
  query: Joi.object().keys({
    name: Joi.string(),
    player: Joi.string(),
    server: Joi.string(),
    deckId: Joi.string(),

    sortBy: Joi.string(),
    projectBy: Joi.string(),
    limit: Joi.number().integer(),
    page: Joi.number().integer(),
  }),
};

export const getCard = {
  params: Joi.object().keys({
    cardId: Joi.string().custom(objectId),
  }),
};

export const updateCard = {
  params: Joi.object().keys({
    cardId: Joi.required().custom(objectId),
  }),
  body: Joi.object()
    .keys({
      email: Joi.string().email(),
      password: Joi.string().custom(password),
      name: Joi.string(),
    })
    .min(1),
};

export const deleteCard = {
  params: Joi.object().keys({
    cardId: Joi.string().custom(objectId),
  }),
};