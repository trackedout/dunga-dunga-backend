import Joi from 'joi';

export const getFeed = {
  query: Joi.object().keys({
    limit: Joi.number().integer().min(1).max(100),
    page: Joi.number().integer().min(1),
    runType: Joi.string().valid('p', 'c', 'h'),
    outcome: Joi.string().valid('win', 'loss'),
    player: Joi.string().min(1),
  }),
};
