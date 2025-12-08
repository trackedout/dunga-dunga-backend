import Joi from 'joi';
import { NewCreatedConfig } from './config.interfaces';

const createConfigBody: Record<keyof NewCreatedConfig, any> = {
  entity: Joi.string().required().min(1),
  key: Joi.string().required().min(1),
  value: Joi.string().required().min(0),
  metadata: Joi.any(),
};

export const createConfig = {
  body: Joi.object().keys(createConfigBody),
};

export const createConfigs = {
  body: Joi.array().items(createConfigBody).min(1),
};

export const getConfigs = {
  query: Joi.object()
    .keys({
      entity: Joi.string().optional(),
      server: Joi.string().optional(),

      sortBy: Joi.string(),
      projectBy: Joi.string(),
      limit: Joi.number().integer(),
      page: Joi.number().integer(),
    })
    .or('entity', 'server'),
};

export const getConfig = {
  query: Joi.object()
    .keys({
      id: Joi.string(),
      entity: Joi.string().optional(),
      server: Joi.string().optional(),
      key: Joi.string().required(),
    })
    .or('entity', 'server'),
};

export const deleteConfig = {
  body: Joi.object().keys({
    id: Joi.string(),
    entity: Joi.string(),
    key: Joi.string(),
    value: Joi.string(),
  }),
};
