import Joi from 'joi';
import { password, objectId } from '../validate/custom.validation';
import { NewCreatedCard } from './card.interfaces';

const createCardBody: Record<keyof NewCreatedCard, any> = {
  name: Joi.string().required().min(3),
  player: Joi.string().required().min(1),
  server: Joi.string().required().min(1),
  deckType: Joi.string().required().min(1),
  hiddenInDecks: Joi.array().items(Joi.string().required()).min(0),
};

export const createCard = {
  body: Joi.object().keys(createCardBody),
};

export const getCards = {
  query: Joi.object().keys({
    name: Joi.string(),
    player: Joi.string().required(),
    server: Joi.string(),
    deckType: Joi.string().min(1),
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
  body: Joi.object().keys({
    id: Joi.string(),
    name: Joi.string().required(),
    player: Joi.string().required(),
    deckType: Joi.string().required().min(1),
    deckId: Joi.string(),
    server: Joi.string(),
    hiddenInDecks: Joi.any().optional(),
  }),
};

export const overwritePlayerDeck = {
  query: Joi.object().keys({
    player: Joi.string().required().min(1),
    server: Joi.string().required().min(1),
    deckType: Joi.string().required().min(1),
    deckId: Joi.string(),
  }),
  body: Joi.array().items(Joi.string()),
};
