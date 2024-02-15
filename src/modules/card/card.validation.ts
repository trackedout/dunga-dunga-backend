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
    player: Joi.string().required(),
    server: Joi.string(),
    deckId: Joi.string().required(),

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
  body: Joi.object().keys({
    name: Joi.string(),
    player: Joi.string().required(),
    deckId: Joi.string().required(),
  }),
};

export const overwritePlayerDeck = {
  query: Joi.object().keys({
    player: Joi.string().required().min(3),
    server: Joi.string().required().min(1),
    deckId: Joi.string().required().min(1),
  }),
  body: Joi.array().items(Joi.string()),
};
