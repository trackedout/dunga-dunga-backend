import Joi from 'joi';

export const getKillers = {
  query: Joi.object().keys({
    limit: Joi.number().integer().min(1).max(100),
    runType: Joi.string().valid('p', 'c', 'h'),
    since: Joi.string().isoDate(),
  }),
};

export const getKillerDetail = {
  params: Joi.object().keys({
    killer: Joi.string().required(),
  }),
  query: Joi.object().keys({
    runType: Joi.string().valid('p', 'c', 'h'),
    since: Joi.string().isoDate(),
  }),
};
