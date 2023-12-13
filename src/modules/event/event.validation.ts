import Joi from 'joi';
import { password, objectId } from '../validate/custom.validation';
import { NewCreatedEvent } from './event.interfaces';

const createEventBody: Record<keyof NewCreatedEvent, any> = {
  name: Joi.string().required().min(3),
  player: Joi.string().required().min(3),
  server: Joi.string().required().min(3),
  count: Joi.number().required().integer(),
};

export const createEvent = {
  body: Joi.object().keys(createEventBody),
};

export const getEvents = {
  query: Joi.object().keys({
    name: Joi.string(),
    role: Joi.string(),
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
