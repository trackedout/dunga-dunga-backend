import Joi from 'joi';

export const getStatus = {
  query: Joi.object().keys({
    server: Joi.string(),

    sortBy: Joi.string(),
    projectBy: Joi.string(),
    limit: Joi.number().integer(),
    page: Joi.number().integer(),
  }),
};
