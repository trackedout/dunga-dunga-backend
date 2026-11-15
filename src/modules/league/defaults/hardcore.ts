import { ILeague } from '../league.interfaces';
import { standardItems } from './items';

const hardcoreLeague: ILeague = {
  slug: 'do2-s2-hardcore',
  displayName: 'Hardcore',
  description: 'High-stakes runs — lose your deck and progress on death',
  owner: '4Ply',

  display: {
    runTypeId: 3,
    colour: 0xff5555,
    material: 'RED_SHULKER_BOX',
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
    ...standardItems('do2-s2-hardcore'),
    shards: { scoreboard: 'do2.inventory.shards.do2-s2-hardcore', startingAmount: 64 },
    runs: { scoreboard: 'do2-s2-hardcore-do2.runs' },
    wins: { scoreboard: 'do2-s2-hardcore-do2.wins' },
    rustyRepairs: { scoreboard: 'do2-s2-hardcore-do2.rustyrepairs' },
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
    dungeonType: 'do2-s2-comp',
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
      id: 'reset-on-death',
      trigger: { event: 'game-lost' },
      actions: [
        { type: 'reset-deck' },
        { type: 'reset-scoreboard', scoreboard: 'do2.inventory.shards.do2-s2-hardcore', value: 64 },
        { type: 'reset-scoreboards', pattern: 'do2-s2-hardcore-do2\\..*', value: 0 },
        { type: 'store-best-scores', sourcePattern: 'do2-s2-hardcore-do2\\.', targetPrefix: 'leaderboard-do2-s2-hardcore-do2.' },
        { type: 'set-filter-mode' },
      ],
    },
  ],

  state: 'active',
};

export default hardcoreLeague;
