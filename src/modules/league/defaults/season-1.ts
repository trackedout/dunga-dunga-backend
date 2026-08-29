import { ILeague } from '../league.interfaces';
import { standardItems } from './items';

// Season 1 predates the league system. It is a historical/archival league: its
// competitive runs are backfilled to the `season-1` slug (events/claims before
// season 2's phase-1 start, 2026-03-15). No phase automation runs on it — it is
// `completed` and kept only so `season-1` resolves to a real league doc for
// lookups and stats. Like season 2, it points at the legacy `competitive-*`
// scoreboards (the per-season scoreboard convention started with season 3).
const season1League: ILeague = {
  slug: 'season-1',
  displayName: 'Season 1',
  description: 'The first competitive season of Decked Out 2',
  owner: '4Ply',

  display: {
    runTypeId: 2,
    colour: 0x5555ff,
    material: 'BLUE_SHULKER_BOX',
  },

  members: [],
  joinPolicy: 'auto',

  items: {
    ...standardItems('competitive'),
  },

  trades: [
    {
      id: 'buy-shard-with-crowns',
      source: { item: 'crowns', amount: 10 },
      target: { item: 'shards', amount: 1 },
    },
    {
      id: 'submit-tomes',
      source: { item: 'tomes', amount: 1 },
      target: null,
    },
    {
      id: 'queue',
      source: { item: 'shards', amount: 1 },
      target: { type: 'queue' },
    },
  ],

  deck: {
    defaultCards: ['MOC', 'SNE', 'TRH'],
  },

  dungeon: {
    type: 'season-1',
    claimFilters: {},
  },

  phases: [],

  phaseTransition: {
    autoTransition: false,
    allocation: { type: 'none' },
    actions: [],
    excludedPlayers: [],
  },

  scoring: null,

  eventHandlers: [],

  state: 'completed',
};

export default season1League;
