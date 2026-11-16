import { Model, Document } from 'mongoose';

// --- Item Definitions ---
// An item is either a single scoreboard (direct value),
// or a pair of earned/spent scoreboards (effective value = earned - spent)

export interface ISingleScoreboardItem {
  scoreboard: string;
  startingAmount?: number;
}

export interface IEarnedSpentItem {
  earned: string;
  spent: string;
}

export type ILeagueItem = ISingleScoreboardItem | IEarnedSpentItem;

// --- Trade Definitions ---

export interface ITradeSource {
  item: string;
  amount: number;
}

export interface ITradeTargetItem {
  item: string;
  amount: number;
}

export interface ITradeTargetQueue {
  type: 'queue';
}

export type ITradeTarget = ITradeTargetItem | ITradeTargetQueue | null;

export interface ITrade {
  id: string;
  source: ITradeSource;
  target: ITradeTarget;
}

// --- Display ---

export interface ILeagueDisplay {
  // runTypeId is the datapack "mode of code to run" (1=practice, 2=competitive,
  // 3=hardcore, ...). It is NOT the run-mode identifier — that is the league slug
  // (see the per-player `filter-mode-slug` config). All season-N competitive
  // leagues share runTypeId 2.
  runTypeId: number;
  colour: number;
  material: string;
}

// --- Deck ---
// One deck per league; its identifier is the league slug (Card.deckType == slug).
// There is no separate deck prefix.

export interface ILeagueDeck {
  defaultCards: string[];
}

// --- Server (authoritative per-league runtime config) ---
//
// The league doc is the single source of truth for how a league's servers
// (dungeons that play this league's world, and the build sandbox) are
// provisioned. On save these fields are PROJECTED into the flat per-entity
// `Config` docs (entity=<slug>) that the container entrypoints already read
// (see league.service projectServerConfigs), so the runtime contract is
// unchanged — humans edit the league doc, not the configs.

// Where a dungeon of this league sources its world:
//   - 'restic'      restore the league's own latest restic snapshot
//                   (tracked-out-sandboxes-<env>/<slug>). If the snapshot is
//                   missing the instance FAILS to start — there is no silent
//                   fallthrough to the shared builders S3 zip.
//   - 's3-zip'      pull the shared prebuilt dungeon world zip from the backups
//                   S3 bucket (dungeon-latest.zip; the legacy path, opt-in for
//                   the shared season worlds that have no restic repo of their own).
export type WorldSource = 'restic' | 's3-zip';

export interface ILeagueMinecraft {
  // MC server version override (e.g. "1.21.8"); empty/undefined = image default.
  version?: string;
  // Network protocol number matching `version` (e.g. 763 for 1.20.1). When set,
  // queuing is rejected unless the player's client reports this same protocol.
  // Undefined/0 disables the check.
  protocol?: number;
}

// A downloadable release asset (datapack zip or mod jar) pulled from a GitHub
// releases API at container start by download-release.sh. The image already
// supports multiple of each: fast-start.sh copies every file in the datapack /
// mod download dirs into the server, so a league can layer on extra
// datapacks/mods without an image rebuild.
export interface ILeagueAsset {
  // GitHub repo in "owner/name" form, e.g. "trackedout/Brilliance".
  repo: string;
  // Release asset filename to download, e.g. "brilliance-datapack.zip".
  asset: string;
  // Release tag to pull ("latest" or a pinned tag).
  version: string;
  // Whether this asset is installed. Disabled entries are skipped.
  enabled: boolean;
  // Whether the download must send the GITHUB_TOKEN auth header (private repos
  // / rate-limit relief). Public assets can set this false.
  authenticated: boolean;
}

export interface ILeagueResourcePack {
  url?: string;
  sha1?: string;
  modernUrl?: string;
  modernSha1?: string;
}

export interface ILeagueServer {
  // Replaces the former `dungeon.type`. The dungeon-type / queue-routing key
  // for this league (equals the slug for a published league).
  dungeonType: string;
  // Claim routing filters (formerly dungeon.claimFilters).
  claimFilters: Record<string, string[]>;
  worldSource: WorldSource;
  // Only used when worldSource is 's3-zip': the world zip to pull, either a
  // full "s3://bucket/key" URI or a key relative to the backups bucket (e.g.
  // "snapshots/builders2/dungeon-latest.zip"). Unset keeps the legacy
  // per-dungeon-type prefix.
  worldZip?: string;
  minecraft: ILeagueMinecraft;
  // Datapacks layered onto this league's world, in order.
  datapacks: ILeagueAsset[];
  // Mods installed on this league's servers (agronet is just one entry).
  mods: ILeagueAsset[];
  resourcePack: ILeagueResourcePack;
}

// --- Phase Config (schedule only, no mutable state) ---

export interface IPhaseConfig {
  phase: number;
  start: string;
  end: string;
}

// --- Phase Transition ---

export interface IPhaseAllocation {
  type: string; // "ember-potential" | "flat" | "none"
}

export interface IPhaseTransition {
  autoTransition: boolean;
  allocation: IPhaseAllocation;
  actions: string[];
  excludedPlayers: string[];
}

// --- Scoring ---

export interface ILeagueScoring {
  metric: string;
  pointsForPosition: number[];
}

// --- Event Handlers ---

export interface IEventTriggerCondition {
  item?: string;
  below?: number;
}

export interface IEventTrigger {
  event: string;
  condition?: IEventTriggerCondition;
}

export interface IEventAction {
  type: string;
  scoreboard?: string;
  value?: number;
  pattern?: string;
  sourcePattern?: string;
  targetPrefix?: string;
}

export interface IEventHandler {
  id: string;
  trigger: IEventTrigger;
  actions: IEventAction[];
}

// --- Builders (sandbox build servers) ---

export interface ILeagueBuilders {
  players: string[];
  idleTimeoutMinutes: number;
  // When true, this league's build world is owned by a persistent build server
  // (builders / builders2) that produces the league's restic snapshot. Launching
  // an on-demand s4xx sandbox would create a second writer against the same world
  // and diverge from the persistent server's snapshot, so sandbox launch is
  // refused for these leagues (e.g. do2-s1-comp / do2-s2-comp).
  preventSandboxing?: boolean;
  // Restic fork source: which repo (within the sandbox bucket) and snapshot the
  // league bootstraps its world from on first launch. `repo` is a repo name in
  // the sandbox bucket — "_base" for a fresh league, or another league's slug
  // when forking. `snapshotId` defaults to "latest".
  forkSource?: {
    repo: string;
    snapshotId?: string;
  };
}

// --- Party ---

// How many players a party for this league may hold, leader included. A league
// with maxPlayers 1 does not offer parties.
export interface ILeagueParty {
  minPlayers: number;
  maxPlayers: number;
}

// --- Join Policy ---

export type JoinPolicy = 'auto' | 'open' | 'invite-only' | 'approval';

// --- League State ---

export type LeagueState = 'draft' | 'active' | 'completed' | 'archived';

// --- Main League Interface ---

export interface ILeague {
  slug: string;
  displayName: string;
  description: string;
  owner: string;

  display: ILeagueDisplay;

  members: string[];
  builders?: ILeagueBuilders;
  joinPolicy: JoinPolicy;

  items: Record<string, ILeagueItem>;

  trades: ITrade[];

  deck: ILeagueDeck;

  server: ILeagueServer;

  party?: ILeagueParty;

  phases: IPhaseConfig[];

  phaseTransition: IPhaseTransition;

  scoring: ILeagueScoring | null;

  eventHandlers: IEventHandler[];

  state: LeagueState;
}

export interface ILeagueDoc extends ILeague, Document {
  createdAt: Date;
  updatedAt: Date;
}

export interface ILeagueModel extends Model<ILeagueDoc> {}
