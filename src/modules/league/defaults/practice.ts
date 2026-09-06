import { ILeague } from '../league.interfaces';
import { standardItems } from './items';

const practiceLeague: ILeague = {
  slug: 'practice',
  displayName: 'Practice',
  description: 'Unlimited practice runs with auto-replenishing shards',
  owner: '4Ply',

  display: {
    runTypeId: 1,
    colour: 0x55ff55,
    material: 'LIME_SHULKER_BOX',
  },

  members: [],
  // Build world is owned by the persistent build server that produces this
  // league's restic snapshot. Block on-demand s4xx sandboxes so a second writer
  // can't diverge from that snapshot.
  builders: {
    players: [],
    idleTimeoutMinutes: 30,
    preventSandboxing: true,
  },
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
    defaultCards: ['MOC', 'SNE', 'TRH'],
  },

  server: {
    dungeonType: 'season-2',
    claimFilters: {},
    worldSource: 's3-zip',
    minecraft: {},
    datapacks: [
      { repo: 'trackedout/Brilliance', asset: 'brilliance-datapack.zip', version: 'latest', enabled: true, authenticated: true },
    ],
    mods: [
      { repo: 'trackedout/agronet-fabric', asset: 'agronet-1.0.0.jar', version: 'latest', enabled: true, authenticated: true },
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
