import Joi from 'joi';

export const getStats = {
  query: Joi.object().keys({
    runType: Joi.string().valid('p', 'c', 'h'),
    since: Joi.string().isoDate(),
    until: Joi.string().isoDate(),
    phase: Joi.number().integer().min(1),
  }),
};
