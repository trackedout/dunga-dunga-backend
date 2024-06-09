import httpStatus from 'http-status';
import mongoose from 'mongoose';
import Score from './score.model';
import ApiError from '../errors/ApiError';
import { IOptions, QueryResult } from '../paginate/paginate';
import { DeleteScore, IScoreDoc, NewCreatedScore, UpdateScoreBody } from './score.interfaces';
import Player from '../event/player.model';

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

  await Score.deleteMany({
    player: scores[0]!!.player,
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
