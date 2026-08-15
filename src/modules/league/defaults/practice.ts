import { ILeague } from '../league.interfaces';
import { standardItems } from './items';

const practiceLeague: ILeague = {
  slug: 'practice',
  displayName: 'Practice',
  description: 'Unlimited practice runs with auto-replenishing shards',
  owner: '4Ply',

  display: {
    shortId: 'p',
    runTypeId: 1,
    colour: 0x55ff55,
    material: 'LIME_SHULKER_BOX',
  },

  members: [],
  joinPolicy: 'auto',

  items: {
    ...standardItems('practice'),
    shards: { scoreboard: 'do2.inventory.shards.practice', startingAmount: 32 },
  },

  trades: [
    {
      id: 'queue',
      source: { item: 'shards', amount: 1 },
      target: { type: 'queue' },
    },
  ],

  deck: {
    prefix: 'p',
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

  scoring: null,

  eventHandlers: [
    {
      id: 'auto-replenish-shards',
      trigger: {
        event: 'trade-requested',
        condition: { item: 'shards', below: 10 },
      },
      actions: [
        { type: 'set-scoreboard', scoreboard: 'do2.inventory.shards.practice', value: 64 },
      ],
    },
  ],

  state: 'active',
};

export default practiceLeague;
