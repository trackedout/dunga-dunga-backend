import League from './league.model';
import { ILeague, ILeagueDoc } from './league.interfaces';
import defaultLeagues from './defaults';
import logger from '../logger/logger';

export const upsertLeague = async (league: ILeague): Promise<ILeagueDoc> => {
  const existing = await League.findOne({ slug: league.slug }).exec();
  if (existing) {
    Object.assign(existing, league);
    await existing.save();
    return existing;
  }
  return League.create(league);
};

export const getLeagueBySlug = async (slug: string): Promise<ILeagueDoc | null> => {
  return League.findOne({ slug }).exec();
};

export const getLeagueByShortId = async (shortId: string): Promise<ILeagueDoc | null> => {
  return League.findOne({ 'display.shortId': shortId }).exec();
};

export const getActiveLeagues = async (): Promise<ILeagueDoc[]> => {
  return League.find({ state: 'active' }).exec();
};

export const seedDefaultLeagues = async (): Promise<void> => {
  for (const league of defaultLeagues) {
    await League.findOneAndUpdate({ slug: league.slug }, league, { upsert: true });
    logger.info(`Synced default league '${league.slug}'`);
  }
};
