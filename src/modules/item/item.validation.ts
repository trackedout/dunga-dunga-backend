import Joi from 'joi';
import { password, objectId } from '../validate/custom.validation';
import { NewCreatedItem } from './item.interfaces';

const createItemBody: Record<keyof NewCreatedItem, any> = {
  name: Joi.string().required().min(3),
  player: Joi.string().required().min(1),
  server: Joi.string().required().min(1),
  deckId: Joi.string().optional().min(1),
};

export const createItem = {
  body: Joi.object().keys(createItemBody),
};

export const getItems = {
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

export const getItem = {
  params: Joi.object().keys({
    itemId: Joi.string().custom(objectId),
  }),
};

export const updateItem = {
  params: Joi.object().keys({
    itemId: Joi.required().custom(objectId),
  }),
  body: Joi.object()
    .keys({
      email: Joi.string().email(),
      password: Joi.string().custom(password),
      name: Joi.string(),
    })
    .min(1),
};

export const deleteItem = {
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
