import League from './league.model';
import LeaguePhaseState from './league-phase.model';
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

// Build the metadata.slug filter for a run-type query parameter. An unknown
// value is returned unchanged, so unknown/test values still filter to themselves.
// The API filters runs by a league slug, or by a run mode code that spans every
// league of that mode: p = practice, c = competitive (all seasons), h = hardcore.
// The mode of a league is its display.runTypeId.
const RUN_MODE_TYPE_IDS: Record<string, number> = { p: 1, c: 2, h: 3 };

export const slugFilterForRunType = async (input: string): Promise<string | { $in: string[] }> => {
  const league = await getLeagueBySlug(input);
  if (league) return league.slug;

  const runTypeId = RUN_MODE_TYPE_IDS[input];
  if (runTypeId === undefined) return input;

  const leagues = await League.find({ 'display.runTypeId': runTypeId }).select({ slug: 1 }).lean().exec();
  return { $in: leagues.map((l) => l.slug) };
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
// surfaces in GET /leagues (the lobby's league cache), and sets its authoritative
// `server` block (worldSource=restic by default: the league plays its own world,
// fetched by the instance via GET /leagues/:slug/server-spec).
export const publishLeague = async (slug: string): Promise<ILeagueDoc | null> => {
  const league = await League.findOne({ slug }).exec();
  if (!league) return null;

  const display = allocateRunTypeId(league);

  // Only seed items/trades/deck when the league doesn't already define them, so
  // republishing an edited league doesn't clobber customisations. `items` is a
  // Mongoose Map at runtime.
  const itemsMap = asMap(league.items);
  if (itemsMap.size === 0) {
    league.set('items', standardItems());
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
  // latest restic snapshot rather than the shared builders snapshot. Preserve
  // any existing server config; only fill in the authoritative defaults.
  league.server = {
    dungeonType: slug,
    claimFilters: league.server?.claimFilters || {},
    worldSource: league.server?.worldSource || 'restic',
    minecraft: league.server?.minecraft || {},
    datapacks: league.server?.datapacks || [
      { repo: 'trackedout/Brilliance', asset: 'brilliance-datapack.zip', version: 'latest', enabled: true, authenticated: true },
    ],
    mods: league.server?.mods || [
      { repo: 'trackedout/agronet-fabric', asset: 'agronet-1.0.0.jar', version: 'latest', enabled: true, authenticated: true },
    ],
    resourcePack: league.server?.resourcePack || {},
  };
  league.state = 'active';

  await league.save();

  logger.info(`Published league '${slug}' as playable mode (runTypeId=${display.runTypeId}, dungeonType=${slug}, worldSource=${league.server.worldSource})`);
  return league;
};

// Insert-only bootstrap of the source-defined leagues. The DB is the source of
// truth for a league once it exists: leagues are edited via the management UI,
// so an existing slug is NEVER overwritten here (otherwise a redeploy would
// clobber web edits with the stale `defaults/` version). The `defaults/` files
// only seed a fresh environment; to intentionally reset a league to its default
// you delete its DB doc first.
export const seedDefaultLeagues = async (): Promise<void> => {
  for (const league of defaultLeagues) {
    const existing = await League.findOne({ slug: league.slug }).select({ _id: 1 }).exec();
    if (existing) {
      logger.info(`Default league '${league.slug}' already exists, leaving DB copy authoritative`);
      continue;
    }
    await League.create(league);
    logger.info(`Seeded default league '${league.slug}'`);
  }
};

// Phase states for the do2-s2-comp (competitive) league's initial seeding
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
  const leagueSlug = 'do2-s2-comp';
  const existing = await LeaguePhaseState.findOne({ leagueSlug }).exec();
  if (existing) {
    logger.info(`Phase states for '${leagueSlug}' already exist, skipping seed`);
    return;
  }

  const phases = defaultCompetitivePhaseStates.map((p) => ({ ...p, leagueSlug }));
  await LeaguePhaseState.insertMany(phases);
  logger.info(`Seeded ${phases.length} phase states for '${leagueSlug}'`);
};
