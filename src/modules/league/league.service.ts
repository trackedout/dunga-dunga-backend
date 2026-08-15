import League from './league.model';
import LeaguePhase from './league-phase.model';
import { ILeague, ILeagueDoc } from './league.interfaces';
import { ILeaguePhase } from './league-phase.interfaces';
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

const defaultCompetitivePhases: Omit<ILeaguePhase, 'leagueSlug'>[] = [
  { phase: 1, state: 'COMPLETED', start: '2026-03-15T00:00:00Z', end: '2026-03-28T21:00:00Z' },
  { phase: 2, state: 'COMPLETED', start: '2026-03-28T22:00:00Z', end: '2026-04-14T05:00:00Z' },
  { phase: 3, state: 'COMPLETED', start: '2026-04-14T06:00:00Z', end: '2026-04-25T21:00:00Z' },
  { phase: 4, state: 'COMPLETED', start: '2026-04-25T22:00:00Z', end: '2026-05-09T21:30:00Z' },
  { phase: 5, state: 'COMPLETED', start: '2026-05-09T22:00:00Z', end: '2026-06-06T21:00:00Z' },
  { phase: 6, state: 'COMPLETED', start: '2026-06-07T00:00:00Z', end: '2026-06-21T00:45:00Z' },
  { phase: 7, state: 'COMPLETED', start: '2026-06-21T01:30:00Z', end: '2026-07-04T22:00:00Z' },
  { phase: 8, state: 'COMPLETED', start: '2026-07-04T22:30:00Z', end: '2026-07-26T05:20:00Z' },
  { phase: 9, state: 'ACTIVE', start: '2026-07-26T05:30:00Z', end: '2026-08-15T21:00:00Z' },
];

export const seedDefaultPhases = async (): Promise<void> => {
  const leagueSlug = 'competitive';
  const existing = await LeaguePhase.findOne({ leagueSlug }).exec();
  if (existing) {
    logger.info(`Phases for '${leagueSlug}' already exist, skipping seed`);
    return;
  }

  const phases = defaultCompetitivePhases.map((p) => ({ ...p, leagueSlug }));
  await LeaguePhase.insertMany(phases);
  logger.info(`Seeded ${phases.length} phases for '${leagueSlug}'`);
};
