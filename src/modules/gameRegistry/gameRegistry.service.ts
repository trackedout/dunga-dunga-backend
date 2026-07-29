import httpStatus from 'http-status';
import GameRegistry from './gameRegistry.model';
import ApiError from '../errors/ApiError';
import { IGameRegistryDoc, NewGameRegistry } from './gameRegistry.interfaces';

export const upsertGameRegistry = async (body: NewGameRegistry): Promise<IGameRegistryDoc> => {
  const existing = await GameRegistry.findOne({ name: body.name }).exec();
  if (existing) {
    Object.assign(existing, body);
    await existing.save();
    return existing;
  }
  return GameRegistry.create(body);
};

export const getEnabledGames = async (): Promise<IGameRegistryDoc[]> => {
  return GameRegistry.find({ enabled: true }).exec();
};

export const getGameByName = async (name: string): Promise<IGameRegistryDoc | null> => {
  const game = await GameRegistry.findOne({ name }).exec();
  if (!game) {
    throw new ApiError(httpStatus.NOT_FOUND, `Game '${name}' not found`);
  }
  return game;
};
