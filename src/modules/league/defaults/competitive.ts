import { ILeague } from '../league.interfaces';

const competitiveLeague: ILeague = {
  slug: 'competitive',
  displayName: 'Competitive',
  description: 'The main competitive season',
  owner: '4Ply',

  display: {
    shortId: 'c',
    colour: 0x55ffff,
    material: 'CYAN_SHULKER_BOX',
  },

  members: [],
  joinPolicy: 'auto',

  items: {
    shards: {
      scoreboard: 'do2.inventory.shards.competitive',
      startingAmount: 22,
    },
    crowns: {
      earned: 'competitive-do2.lifetime.escaped.crowns',
      spent: 'competitive-do2.lifetime.spent.crowns',
    },
    tomes: {
      earned: 'competitive-do2.lifetime.escaped.tomes',
      spent: 'competitive-do2.lifetime.spent.tomes',
    },
    shardFragments: {
      earned: 'competitive-do2.lifetime.escaped.shard_fragments',
      spent: 'competitive-do2.lifetime.spent.shard_fragments',
    },
    embers: {
      scoreboard: 'competitive-do2.lifetime.escaped.embers',
    },
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
    prefix: 'c',
    defaultCards: ['MOC', 'SNE', 'TRH'],
  },

  dungeon: {
    type: 'season-2',
    claimFilters: {},
  },

  phases: [
    { phase: 1, state: 'COMPLETED', start: '2026-03-15T00:00:00Z', end: '2026-03-28T21:00:00Z' },
    { phase: 2, state: 'COMPLETED', start: '2026-03-28T22:00:00Z', end: '2026-04-14T05:00:00Z' },
    { phase: 3, state: 'COMPLETED', start: '2026-04-14T06:00:00Z', end: '2026-04-25T21:00:00Z' },
    { phase: 4, state: 'COMPLETED', start: '2026-04-25T22:00:00Z', end: '2026-05-09T21:30:00Z' },
    { phase: 5, state: 'COMPLETED', start: '2026-05-09T22:00:00Z', end: '2026-06-06T21:00:00Z' },
    { phase: 6, state: 'COMPLETED', start: '2026-06-07T00:00:00Z', end: '2026-06-21T00:45:00Z' },
    { phase: 7, state: 'COMPLETED', start: '2026-06-21T01:30:00Z', end: '2026-07-04T22:00:00Z' },
    { phase: 8, state: 'COMPLETED', start: '2026-07-04T22:30:00Z', end: '2026-07-26T05:20:00Z' },
    { phase: 9, state: 'ACTIVE', start: '2026-07-26T05:30:00Z', end: '2026-08-15T21:00:00Z' },
  ],

  phaseTransition: {
    autoTransition: true,
    allocation: { type: 'ember-potential' },
    actions: ['compute-stats', 'allocate-shards', 'publish-leaderboard', 'notify-players'],
  },

  scoring: {
    metric: 'tomes',
    pointsForPosition: [25, 21, 18, 16, 14, 12, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1],
  },

  eventHandlers: [],

  state: 'active',
};

export default competitiveLeague;
