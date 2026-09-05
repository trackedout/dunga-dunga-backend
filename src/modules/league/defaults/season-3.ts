import { ILeague } from '../league.interfaces';
import { standardItems } from './items';

const season3League: ILeague = {
  slug: 'season-3',
  displayName: 'Season 3',
  description: 'The third competitive season of Decked Out 2',
  owner: '4Ply',

  display: {
    runTypeId: 2,
    colour: 0xff55ff,
    material: 'MAGENTA_SHULKER_BOX',
  },

  members: [],
  joinPolicy: 'auto',

  items: {
    ...standardItems('season-3'),
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
    type: 'season-2',
    claimFilters: {},
  },

  phases: [],

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

  state: 'active',
};

export default season3League;
