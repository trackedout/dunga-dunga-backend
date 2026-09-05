import { ILeague } from '../league.interfaces';

const metroMayhemLeague: ILeague = {
  slug: 'metro-mayhem',
  displayName: 'Metro Mayhem',
  description: 'A parkour race minigame built by impulseSV, inspired by MCC Ace Race',
  owner: '4Ply',

  display: {
    runTypeId: 5,
    colour: 0xff5555,
    material: 'RED_SHULKER_BOX',
  },

  members: [],
  joinPolicy: 'auto',

  items: {},

  trades: [],

  deck: {
    defaultCards: [],
  },

  server: {
    dungeonType: 'metro-mayhem',
    claimFilters: {},
    worldSource: 'restic',
    minecraft: { version: '1.21.8' },
    datapacks: [
      { repo: 'trackedout/Brilliance', asset: 'brilliance-datapack.zip', version: 'latest', enabled: false, authenticated: true },
    ],
    mods: [
      { repo: 'trackedout/agronet-fabric', asset: 'agronet-1.0.0.jar', version: 'latest', enabled: false, authenticated: true },
    ],
    resourcePack: {},
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
