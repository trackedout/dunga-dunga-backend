import Joi from 'joi';

export const getPlayer = {
  params: Joi.object().keys({
    name: Joi.string().required(),
  }),
  query: Joi.object().keys({
    since: Joi.string().isoDate().optional(),
    until: Joi.string().isoDate().optional(),
  }),
};

export const getPlayers = {
  query: Joi.object().keys({
    since: Joi.string().isoDate().optional(),
    runType: Joi.string().valid('p', 'c', 'h').optional(),
  }),
};
