import League from './league.model';
import LeaguePhaseState from './league-phase.model';
import Config from '../config/config.model';
import { ILeague, ILeagueDoc, ILeagueDisplay } from './league.interfaces';
import { PhaseState } from './league-phase.interfaces';
import { asMap } from '../utils';
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

// Resolve a league from a run identifier. Post-migration the identifier is
// always the league slug (metadata.slug / cards.deckType), so this is a slug
// lookup. Kept as a named helper for the ingestion/worker call sites.
export const getLeagueByRunType = async (runType: string): Promise<ILeagueDoc | null> => {
  if (!runType) return null;
  return getLeagueBySlug(runType);
};

// Normalise a run identifier to a canonical league slug for query filters.
// Returns the input unchanged when no league matches (so unknown/test values
// still filter to themselves).
export const resolveRunTypeSlug = async (input: string): Promise<string> => {
  const league = await getLeagueBySlug(input);
  return league?.slug ?? input;
};

export const getActiveLeagues = async (): Promise<ILeagueDoc[]> => {
  return League.find({ state: 'active' }).exec();
};

// Every league regardless of state. The lobby/agronet league caches need this
// so completed leagues (e.g. a finished competitive season) still resolve by
// slug — players can select and view their old decks; playing is gated at queue
// time. Deck/shard SEEDING deliberately still uses getActiveLeagues (you only
// seed decks for active leagues).
export const getAllLeagues = async (): Promise<ILeagueDoc[]> => {
  return League.find({}).exec();
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

// Ensure a league has a datapack run mode (display.runTypeId). runTypeId tells
// the dungeon datapack which mode of code to run: 1=practice, 2=competitive,
// 3=hardcore. A newly-published custom league is a competitive-style league, so
// it defaults to competitive mode (2). An already-set runTypeId is preserved.
const allocateRunTypeId = (league: ILeagueDoc): ILeagueDisplay => {
  const COMPETITIVE_MODE = 2;
  return {
    runTypeId: league.display?.runTypeId && league.display.runTypeId > 0 ? league.display.runTypeId : COMPETITIVE_MODE,
    colour: league.display?.colour ?? 0xaaaaaa,
    material: league.display?.material ?? 'WHITE_SHULKER_BOX',
  };
};

// Publish a draft league so it becomes a selectable, playable mode. Fills in the
// playable fields (run mode, standard items, a shard→queue trade, and a deck)
// only where they haven't been set, transitions the league to `active` so it
// surfaces in GET /leagues (the lobby's league cache), and points its dungeon
// type at the league's own latest restic snapshot via a `snapshot-source`
// config of `restic:<slug>` (consumed by import-dungeon.sh).
export const publishLeague = async (slug: string): Promise<ILeagueDoc | null> => {
  const league = await League.findOne({ slug }).exec();
  if (!league) return null;

  const display = allocateRunTypeId(league);
  // Scoreboards are slug-keyed, so a published league is slug-native from birth:
  // its item scoreboards use the slug as the prefix. display.runTypeId
  // remain only for the numeric filter-mode scoreboard.
  const scoreboardPrefix = league.slug;

  // Only seed items/trades/deck when the league doesn't already define them, so
  // republishing an edited league doesn't clobber customisations. `items` is a
  // Mongoose Map at runtime.
  const itemsMap = asMap(league.items);
  if (itemsMap.size === 0) {
    league.set('items', standardItems(scoreboardPrefix));
  }

  const hasQueueTrade = (league.trades || []).some((t) => t.target && (t.target as { type?: string }).type === 'queue');
  if (!hasQueueTrade) {
    league.trades = [
      ...(league.trades || []),
      { id: 'queue', source: { item: 'shards', amount: 1 }, target: { type: 'queue' } },
    ];
  }

  if (!league.deck || !league.deck.defaultCards) {
    league.deck = { defaultCards: league.deck?.defaultCards || [] };
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

  logger.info(`Published league '${slug}' as playable mode (runTypeId=${display.runTypeId}, dungeon-type=${slug}, snapshot=restic:${slug})`);
  return league;
};

export const seedDefaultLeagues = async (): Promise<void> => {
  for (const league of defaultLeagues) {
    await League.findOneAndUpdate({ slug: league.slug }, league, { upsert: true });
    logger.info(`Synced default league '${league.slug}'`);
  }
};

// Phase states for the season-2 (competitive) league's initial seeding
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
  const leagueSlug = 'season-2';
  const existing = await LeaguePhaseState.findOne({ leagueSlug }).exec();
  if (existing) {
    logger.info(`Phase states for '${leagueSlug}' already exist, skipping seed`);
    return;
  }

  const phases = defaultCompetitivePhaseStates.map((p) => ({ ...p, leagueSlug }));
  await LeaguePhaseState.insertMany(phases);
  logger.info(`Seeded ${phases.length} phase states for '${leagueSlug}'`);
};
