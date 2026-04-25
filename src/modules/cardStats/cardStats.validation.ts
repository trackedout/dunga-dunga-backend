import Joi from 'joi';

export const getCardStats = {
  query: Joi.object().keys({
    runType: Joi.string().valid('p', 'c', 'h'),
    since: Joi.string().isoDate(),
    until: Joi.string().isoDate(),
  }),
};
