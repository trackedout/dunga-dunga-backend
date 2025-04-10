import httpStatus from 'http-status';
import mongoose from 'mongoose';
import Score from './score.model';
import ApiError from '../errors/ApiError';
import Player from '../event/player.model';
import { IOptions, QueryResult } from '../paginate/paginate';
import { DeleteScore, IScoreDoc, NewCreatedScore, UpdateScoreBody } from './score.interfaces';
import { eventService } from '../../modules/event';
import { PlayerEvents } from '../event/event.interfaces';
import { getMetadata } from '../utils'
import { logger } from '../logger';

export const createScore = async (scoreBody: NewCreatedScore): Promise<IScoreDoc> => {
  const player = await Player.findOne({ playerName: scoreBody.player }).exec();
  if (!player) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Player does not exist');
  }
  return Score.create(scoreBody);
};

export const createScores = async (scores: NewCreatedScore[]): Promise<IScoreDoc[]> => {
  if (scores.length === 0) {
    return [];
  }
  const playerName = scores[0]!!.player;

  // First find existing scores, then log an event showing the score diff (score-modified)
  const existingScores = await Score.find({
    player: playerName,
    key: scores.map((s) => s.key),
  });
  for (const existingScore of existingScores) {
    const newScore = scores.find(s => s.key === existingScore.key);
    if (!newScore) {
      continue;
    }

    const diff = newScore.value - existingScore.value;
    if (diff === 0) {
      continue;
    }

    logger.info(`Emitting '${PlayerEvents.SCORE_MODIFIED}' event for ${playerName} - ${existingScore.key}: ${existingScore.value} -> ${newScore.value} (diff: ${diff})`);
    logger.debug(`New score: ${JSON.stringify(newScore, null, 4)}`);

    await eventService.createEvent({
      name: PlayerEvents.SCORE_MODIFIED,
      count: 1,

      player: playerName,
      x: 0,
      y: 0,
      z: 0,

      server: 'dunga-dunga',
      sourceIP: '127.0.0.1',

      metadata: new Map([
        ...getMetadata(newScore.metadata),
        ...getMetadata({
          'score-key': existingScore.key,
          'score-original-value': `${existingScore.value}`,
          'score-new-value': `${newScore.value}`,
          'score-diff': `${diff}`,
        }),
      ]),
    });
  }

  await Score.deleteMany({
    player: playerName,
    key: scores.map((s) => s.key),
  });

  return Score.create(scores);
};

export const queryScores = async (filter: Record<string, any>, options: IOptions): Promise<QueryResult> => {
  return Score.paginate(filter, options);
};

export const getScoreById = async (id: mongoose.Types.ObjectId): Promise<IScoreDoc | null> => Score.findById(id);

export const updateScoreById = async (scoreId: mongoose.Types.ObjectId, updateBody: UpdateScoreBody): Promise<IScoreDoc | null> => {
  const score = await getScoreById(scoreId);
  if (!score) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Score not found');
  }
  Object.assign(score, updateBody);
  await score.save();
  return score;
};

export const deleteScore = async (filter: DeleteScore): Promise<IScoreDoc | null> => {
  const score = await Score.findOne(filter).exec();
  if (!score) {
    throw new ApiError(httpStatus.NOT_FOUND, `Score not found for filter ${filter}`);
  }
  await score.deleteOne();
  return score;
};
