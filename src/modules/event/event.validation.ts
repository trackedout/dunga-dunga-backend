import Joi from 'joi';
import { password, objectId } from '../validate/custom.validation';
import { NewCreatedEvent } from './event.interfaces';

const createEventBody: Record<keyof NewCreatedEvent, any> = {
  name: Joi.string().required().min(3),
  player: Joi.string().required().min(1),
  server: Joi.string().required().min(1),
  x: Joi.number().default(0),
  y: Joi.number().default(0),
  z: Joi.number().default(0),
  count: Joi.number().integer().default(1),
  sourceIP: Joi.string().optional(),
  metadata: Joi.any(),
};

export const createEvent = {
  body: Joi.object().keys(createEventBody),
};

export const getEvents = {
  query: Joi.object().keys({
    name: Joi.string(),
    player: Joi.string(),
    server: Joi.string(),
    sourceIP: Joi.string().ip(),
    x: Joi.string(),
    y: Joi.string(),
    z: Joi.string(),
    count: Joi.number().integer(),

    sortBy: Joi.string(),
    projectBy: Joi.string(),
    limit: Joi.number().integer(),
    page: Joi.number().integer(),
  }),
};

export const getEvent = {
  params: Joi.object().keys({
    eventId: Joi.string().custom(objectId),
  }),
};

export const updateEvent = {
  params: Joi.object().keys({
    eventId: Joi.required().custom(objectId),
  }),
  body: Joi.object()
    .keys({
      email: Joi.string().email(),
      password: Joi.string().custom(password),
      name: Joi.string(),
    })
    .min(1),
};

export const deleteEvent = {
  params: Joi.object().keys({
    eventId: Joi.string().custom(objectId),
  }),
};
