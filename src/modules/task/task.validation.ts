import Joi from 'joi';
import { objectId } from '../validate/custom.validation';
import { NewCreatedTask } from './task.interfaces';

const createTaskBody: Record<keyof NewCreatedTask, any> = {
  type: Joi.string().required().min(1),
  arguments: Joi.array<String>().required(),
  targetPlayer: Joi.string().optional().min(1),
  state: Joi.string().optional().valid("SCHEDULED", "IN_PROGRESS", "SUCCEEDED", "FAILED").default("SCHEDULED"),
  server: Joi.string().required().min(1),
  sourceIP: Joi.string().optional(),
};

export const createTask = {
  body: Joi.object().keys(createTaskBody),
};

export const getTasks = {
  query: Joi.object().keys({
    type: Joi.string(),
    targetPlayer: Joi.string(),
    server: Joi.string(),
    state: Joi.string(),
    sourceIP: Joi.string().ip(),

    sortBy: Joi.string(),
    projectBy: Joi.string(),
    limit: Joi.number().integer(),
    page: Joi.number().integer(),
  }),
};

export const getTask = {
  params: Joi.object().keys({
    taskId: Joi.string().custom(objectId),
  }),
};

export const updateTask = {
  params: Joi.object().keys({
    taskId: Joi.string().custom(objectId),
  }),
  body: Joi.object()
    .keys({
      state: Joi.string().required().valid("SCHEDULED", "IN_PROGRESS", "SUCCEEDED", "FAILED"),
    })
    .min(1),
};
