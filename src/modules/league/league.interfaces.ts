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

// --- Dungeon Routing ---

export interface ILeagueDungeon {
  type: string;
  claimFilters: Record<string, string[]>;
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
  // Restic fork source: which repo (within the sandbox bucket) and snapshot the
  // league bootstraps its world from on first launch. `repo` is a repo name in
  // the sandbox bucket — "_base" for a fresh league, or another league's slug
  // when forking. `snapshotId` defaults to "latest".
  forkSource?: {
    repo: string;
    snapshotId?: string;
  };
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

  dungeon: ILeagueDungeon;

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
