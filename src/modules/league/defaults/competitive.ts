import { ILeague } from '../league.interfaces';
import { standardItems } from './items';

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
    prefix: 'c',
    defaultCards: ['MOC', 'SNE', 'TRH'],
  },

  dungeon: {
    type: 'season-2',
    claimFilters: {},
  },

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
