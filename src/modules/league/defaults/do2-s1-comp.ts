import { ILeague } from '../league.interfaces';
import { standardItems } from './items';

// Season 1 predates the league system. It is a historical/archival league: its
// competitive runs are backfilled to the `do2-s1-comp` slug (events/claims before
// season 2's phase-1 start, 2026-03-15). No phase automation runs on it — it is
// `completed` and kept only so `do2-s1-comp` resolves to a real league doc for
// lookups and stats.
const do2S1CompLeague: ILeague = {
  slug: 'do2-s1-comp',
  displayName: 'Season 1',
  description: 'The first competitive season of Decked Out 2',
  owner: '4Ply',

  display: {
    runTypeId: 2,
    colour: 0x5555ff,
    material: 'BLUE_SHULKER_BOX',
  },

  members: [],
  // Season 1's build world is owned by the persistent `builders` server, which
  // produces its restic snapshot. Block on-demand s4xx sandboxes so a second
  // writer can't diverge from that snapshot.
  builders: {
    players: [],
    idleTimeoutMinutes: 30,
    preventSandboxing: true,
  },
  joinPolicy: 'auto',

  items: {
    ...standardItems(),
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

  server: {
    dungeonType: 'do2-s1-comp',
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

  eventHandlers: [],

  state: 'completed',
};

export default do2S1CompLeague;
