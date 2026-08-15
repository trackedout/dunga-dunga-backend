import League from './league.model';
import LeaguePhaseState from './league-phase.model';
import { ILeague, ILeagueDoc } from './league.interfaces';
import { PhaseState } from './league-phase.interfaces';
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

// Phase states for the competitive league's initial seeding
const defaultCompetitivePhaseStates: { phase: number; state: PhaseState }[] = [
  { phase: 1, state: 'COMPLETED' },
  { phase: 2, state: 'COMPLETED' },
  { phase: 3, state: 'COMPLETED' },
  { phase: 4, state: 'COMPLETED' },
  { phase: 5, state: 'COMPLETED' },
  { phase: 6, state: 'COMPLETED' },
  { phase: 7, state: 'COMPLETED' },
  { phase: 8, state: 'COMPLETED' },
  { phase: 9, state: 'ACTIVE' },
];

export const seedDefaultPhases = async (): Promise<void> => {
  const leagueSlug = 'competitive';
  const existing = await LeaguePhaseState.findOne({ leagueSlug }).exec();
  if (existing) {
    logger.info(`Phase states for '${leagueSlug}' already exist, skipping seed`);
    return;
  }

  const phases = defaultCompetitivePhaseStates.map((p) => ({ ...p, leagueSlug }));
  await LeaguePhaseState.insertMany(phases);
  logger.info(`Seeded ${phases.length} phase states for '${leagueSlug}'`);
};
