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

export const createLeague = {
  body: Joi.object().keys({
    slug: Joi.string().required().pattern(/^[a-z0-9-]+$/),
    displayName: Joi.string().required(),
    owner: Joi.string().required(),
    builders: Joi.object().keys({
      players: Joi.array().items(Joi.string()),
      idleTimeoutMinutes: Joi.number().integer().min(5).max(120),
      forkSource: Joi.object().keys({
        repo: Joi.string().required(),
        snapshotId: Joi.string(),
      }),
    }),
  }),
};

export const publishLeague = {
  params: Joi.object().keys({
    slug: Joi.string().required(),
  }),
};

export const leagueMember = {
  params: Joi.object().keys({
    slug: Joi.string().required(),
  }),
  body: Joi.object().keys({
    player: Joi.string().required(),
  }),
};
