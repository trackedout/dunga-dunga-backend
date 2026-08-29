import League from './league.model';
import LeaguePhaseState from './league-phase.model';
import Config from '../config/config.model';
import { ILeague, ILeagueDoc, ILeagueDisplay } from './league.interfaces';
import { PhaseState } from './league-phase.interfaces';
import { standardItems } from './defaults/items';
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

// Editors of a league are its builders (owner + builders.players). This is the
// set allowed to build in the sandbox, publish, and run /do league play. There
// is no separate "editors" list — builders.players IS the editor list.
export const isLeagueEditor = (league: ILeague, playerName: string): boolean => {
  if (league.owner === playerName) return true;
  return (league.builders?.players || []).includes(playerName);
};

export const addEditor = async (slug: string, playerName: string): Promise<ILeagueDoc | null> => {
  return League.findOneAndUpdate({ slug }, { $addToSet: { 'builders.players': playerName } }, { new: true }).exec();
};

export const removeEditor = async (slug: string, playerName: string): Promise<ILeagueDoc | null> => {
  return League.findOneAndUpdate({ slug }, { $pull: { 'builders.players': playerName } }, { new: true }).exec();
};

export const addMember = async (slug: string, playerName: string): Promise<ILeagueDoc | null> => {
  return League.findOneAndUpdate({ slug }, { $addToSet: { members: playerName } }, { new: true }).exec();
};

export const removeMember = async (slug: string, playerName: string): Promise<ILeagueDoc | null> => {
  return League.findOneAndUpdate({ slug }, { $pull: { members: playerName } }, { new: true }).exec();
};

// Pick a display shortId + runTypeId that no other league is using. shortId is
// what the lobby uses to key decks/scoreboards and must be unique across
// leagues; runTypeId is the numeric equivalent stored in the filter-mode
// scoreboard. Built-in leagues occupy the single-letter ids (p/c/h/...), so we
// derive a candidate from the slug and fall back to numeric suffixes on clash.
const allocateDisplay = async (league: ILeagueDoc): Promise<ILeagueDisplay> => {
  // Already allocated a real display (not the placeholder from create).
  if (league.display?.shortId && league.display.runTypeId > 0) {
    return league.display;
  }

  const leagues = await League.find({ slug: { $ne: league.slug } }).select('display').lean().exec();
  const usedShortIds = new Set(leagues.map((l) => l.display?.shortId).filter(Boolean));
  const usedRunTypeIds = new Set(leagues.map((l) => l.display?.runTypeId).filter((n) => typeof n === 'number'));

  const base = league.slug.replace(/[^a-z0-9]/g, '');
  let shortId = base.substring(0, 2) || 'l';
  for (let n = 0; usedShortIds.has(shortId); n += 1) {
    shortId = `${base.substring(0, 1)}${n}`;
  }

  // Custom leagues get runTypeIds well clear of the built-in ids (1/2/3/...).
  let runTypeId = 100;
  while (usedRunTypeIds.has(runTypeId)) {
    runTypeId += 1;
  }

  return {
    shortId,
    runTypeId,
    colour: league.display?.colour ?? 0xaaaaaa,
    material: league.display?.material ?? 'WHITE_SHULKER_BOX',
  };
};

// Publish a draft league so it becomes a selectable, playable mode. Fills in the
// playable fields (display id, standard items, a shard→queue trade, and a deck)
// only where they haven't been set, transitions the league to `active` so it
// surfaces in GET /leagues (the lobby's league cache), and points its dungeon
// type at the league's own latest restic snapshot via a `snapshot-source`
// config of `restic:<slug>` (consumed by import-dungeon.sh).
export const publishLeague = async (slug: string): Promise<ILeagueDoc | null> => {
  const league = await League.findOne({ slug }).exec();
  if (!league) return null;

  const display = await allocateDisplay(league);
  const prefix = display.shortId;

  // Only seed items/trades/deck when the league doesn't already define them, so
  // republishing an edited league doesn't clobber customisations. `items` is a
  // Mongoose Map at runtime.
  const itemsMap = league.items as unknown as Map<string, unknown> | undefined;
  if (!itemsMap || itemsMap.size === 0) {
    league.set('items', standardItems(prefix));
  }

  const hasQueueTrade = (league.trades || []).some((t) => t.target && (t.target as { type?: string }).type === 'queue');
  if (!hasQueueTrade) {
    league.trades = [
      ...(league.trades || []),
      { id: 'queue', source: { item: 'shards', amount: 1 }, target: { type: 'queue' } },
    ];
  }

  if (!league.deck || !league.deck.prefix) {
    league.deck = { prefix, defaultCards: league.deck?.defaultCards || [] };
  }

  league.display = display;
  // The league plays its own world: dungeons of this type restore the league's
  // latest restic snapshot rather than the shared builders snapshot.
  league.dungeon = { type: slug, claimFilters: league.dungeon?.claimFilters || {} };
  league.state = 'active';

  await league.save();

  await Config.findOneAndUpdate(
    { entity: slug, key: 'snapshot-source' },
    { entity: slug, key: 'snapshot-source', value: `restic:${slug}` },
    { upsert: true, new: true }
  ).exec();

  logger.info(`Published league '${slug}' as playable mode (shortId=${display.shortId}, dungeon-type=${slug}, snapshot=restic:${slug})`);
  return league;
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
