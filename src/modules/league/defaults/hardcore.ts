import { ILeague } from '../league.interfaces';

const hardcoreLeague: ILeague = {
  slug: 'hardcore',
  displayName: 'Hardcore',
  description: 'High-stakes runs — lose your deck and progress on death',
  owner: '4Ply',

  display: {
    shortId: 'h',
    colour: 0xff5555,
    material: 'RED_SHULKER_BOX',
  },

  members: [],
  joinPolicy: 'auto',

  items: {
    shards: {
      scoreboard: 'do2.inventory.shards.hardcore',
      startingAmount: 64,
    },
    crowns: {
      earned: 'hardcore-do2.lifetime.escaped.crowns',
      spent: 'hardcore-do2.lifetime.spent.crowns',
    },
    tomes: {
      earned: 'hardcore-do2.lifetime.escaped.tomes',
      spent: 'hardcore-do2.lifetime.spent.tomes',
    },
    shardFragments: {
      earned: 'hardcore-do2.lifetime.escaped.shard_fragments',
      spent: 'hardcore-do2.lifetime.spent.shard_fragments',
    },
    embers: {
      scoreboard: 'hardcore-do2.lifetime.escaped.embers',
    },
    runs: {
      scoreboard: 'hardcore-do2.runs',
    },
    wins: {
      scoreboard: 'hardcore-do2.wins',
    },
    rustyRepairs: {
      scoreboard: 'hardcore-do2.rustyrepairs',
    },
  },

  trades: [
    {
      id: 'queue',
      source: { item: 'shards', amount: 1 },
      target: { type: 'queue' },
    },
  ],

  deck: {
    prefix: 'h',
    defaultCards: ['MOC', 'SNE', 'TRH'],
  },

  dungeon: {
    type: 'season-2',
    claimFilters: {},
  },

  phases: [],

  phaseTransition: {
    autoTransition: false,
    allocation: { type: 'none' },
    actions: [],
  },

  scoring: {
    metric: 'tomes',
    pointsForPosition: [],
  },

  eventHandlers: [
    {
      id: 'reset-on-death',
      trigger: { event: 'game-lost' },
      actions: [
        { type: 'reset-deck' },
        { type: 'reset-scoreboard', scoreboard: 'do2.inventory.shards.hardcore', value: 64 },
        { type: 'reset-scoreboards', pattern: 'hardcore-do2\\..*', value: 0 },
        { type: 'store-best-scores', sourcePattern: 'hardcore-do2\\.', targetPrefix: 'leaderboard-hardcore-do2.' },
        { type: 'set-filter-mode' },
      ],
    },
  ],

  state: 'active',
};

export default hardcoreLeague;
