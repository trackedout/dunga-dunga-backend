import { ILeague } from '../league.interfaces';

const metroMayhemLeague: ILeague = {
  slug: 'metro-mayhem',
  displayName: 'Metro Mayhem',
  description: 'A parkour race minigame built by impulseSV, inspired by MCC Ace Race',
  owner: '4Ply',

  display: {
    shortId: 'mm',
    runTypeId: 5,
    colour: 0xff5555,
    material: 'RED_SHULKER_BOX',
  },

  members: [],
  joinPolicy: 'auto',

  items: {},

  trades: [],

  deck: {
    prefix: 'mm',
    defaultCards: [],
  },

  dungeon: {
    type: 'metro-mayhem',
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

  state: 'active',
};

export default metroMayhemLeague;
