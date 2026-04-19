import Joi from 'joi';

const DIFFICULTIES = ['easy', 'medium', 'hard', 'deadly', 'deepfrost'] as const;

export const getFeed = {
  query: Joi.object().keys({
    limit: Joi.number().integer().min(1).max(100),
    page: Joi.number().integer().min(1),
    runType: Joi.string().valid('p', 'c', 'h'),
    outcome: Joi.string().valid('win', 'loss'),
    difficulty: Joi.alternatives().try(
      Joi.string().valid(...DIFFICULTIES),
      Joi.array().items(Joi.string().valid(...DIFFICULTIES))
    ),
    player: Joi.string().min(1),
    phase: Joi.number().integer().min(1),
  }),
};
