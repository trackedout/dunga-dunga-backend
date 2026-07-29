import Joi from 'joi';

export const upsertGame = {
  body: Joi.object().keys({
    name: Joi.string().required().min(1),
    displayName: Joi.string().required().min(1),
    minPlayers: Joi.number().integer().min(1).default(1),
    maxPlayers: Joi.number().integer().min(1).default(1),
    permission: Joi.string().required().min(1),
    tokenCost: Joi.number().integer().min(0).default(0),
    tokenType: Joi.string().optional().allow(''),
    enabled: Joi.boolean().default(true),
    snapshotSource: Joi.string().required().min(1),
    resourcePackUrl: Joi.string().optional().allow(''),
    resourcePackSha1: Joi.string().optional().allow(''),
    datapackVersion: Joi.string().default('latest'),
  }),
};

export const getGameByName = {
  params: Joi.object().keys({
    name: Joi.string().required().min(1),
  }),
};
