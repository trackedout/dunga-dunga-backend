import { ILeague } from '../league.interfaces';
import { standardItems } from './items';

const season2League: ILeague = {
  slug: 'season-2',
  displayName: 'Season 2',
  description: 'The second competitive season of Decked Out 2',
  owner: '4Ply',

  display: {
    runTypeId: 2,
    colour: 0x55ffff,
    material: 'CYAN_SHULKER_BOX',
  },

  members: [],
  joinPolicy: 'auto',

  // Scoreboards are prefixed with the league slug. The legacy `competitive-*`
  // scoreboards are migrated to `season-2-*` by the slug backfill; new play
  // writes straight to `season-2-*`.
  items: {
    ...standardItems('season-2'),
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
    // deckType is the league slug (one deck per league).
    defaultCards: ['MOC', 'SNE', 'TRH'],
  },

  dungeon: {
    type: 'season-2',
    claimFilters: {},
  },

  phases: [
    { phase: 1, start: '2026-03-15T00:00:00Z', end: '2026-03-28T21:00:00Z' },
    { phase: 2, start: '2026-03-28T22:00:00Z', end: '2026-04-14T05:00:00Z' },
    { phase: 3, start: '2026-04-14T06:00:00Z', end: '2026-04-25T21:00:00Z' },
    { phase: 4, start: '2026-04-25T22:00:00Z', end: '2026-05-09T21:30:00Z' },
    { phase: 5, start: '2026-05-09T22:00:00Z', end: '2026-06-06T21:00:00Z' },
    { phase: 6, start: '2026-06-07T00:00:00Z', end: '2026-06-21T00:45:00Z' },
    { phase: 7, start: '2026-06-21T01:30:00Z', end: '2026-07-04T22:00:00Z' },
    { phase: 8, start: '2026-07-04T22:30:00Z', end: '2026-07-26T05:20:00Z' },
    { phase: 9, start: '2026-07-26T05:30:00Z', end: '2026-08-15T21:00:00Z' },
  ],

  phaseTransition: {
    autoTransition: true,
    allocation: { type: 'ember-potential' },
    actions: ['compute-stats', 'allocate-shards', 'publish-leaderboard', 'notify-players'],
    excludedPlayers: ['4Ply', 'jaek95', 'FrustratedCPU', 'VioletMaze', 'FinnyMarigold58', 'CrazyEyedOldMan', 'softshadows', 'Bavadn'],
  },

  scoring: {
    metric: 'tomes',
    pointsForPosition: [25, 21, 18, 16, 14, 12, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1],
  },

  eventHandlers: [],

  state: 'completed',
};

export default season2League;
