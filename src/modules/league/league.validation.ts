import Joi from 'joi';

export const getLeagueBySlug = {
  params: Joi.object().keys({
    slug: Joi.string().required(),
  }),
};

export const upsertLeague = {
  body: Joi.object().keys({
    slug: Joi.string().required(),
    displayName: Joi.string().required(),
    description: Joi.string().allow(''),
    owner: Joi.string().required(),
    display: Joi.object().required(),
    members: Joi.array().items(Joi.string()),
    joinPolicy: Joi.string().valid('auto', 'open', 'invite-only', 'approval'),
    items: Joi.object().required(),
    trades: Joi.array(),
    deck: Joi.object().required(),
    dungeon: Joi.object().required(),
    phaseTransition: Joi.object(),
    scoring: Joi.object().allow(null),
    eventHandlers: Joi.array(),
    state: Joi.string().valid('draft', 'active', 'completed', 'archived'),
  }),
};
