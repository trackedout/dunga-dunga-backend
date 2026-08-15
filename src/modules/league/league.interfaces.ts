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
  shortId: string;
  colour: number;
  material: string;
}

// --- Deck ---

export interface ILeagueDeck {
  prefix: string;
  defaultCards: string[];
}

// --- Dungeon Routing ---

export interface ILeagueDungeon {
  type: string;
  claimFilters: Record<string, string[]>;
}

// --- Phase Transition ---

export interface IPhaseAllocation {
  type: string; // "ember-potential" | "flat" | "none"
}

export interface IPhaseTransition {
  autoTransition: boolean;
  allocation: IPhaseAllocation;
  actions: string[];
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
  joinPolicy: JoinPolicy;

  items: Record<string, ILeagueItem>;

  trades: ITrade[];

  deck: ILeagueDeck;

  dungeon: ILeagueDungeon;

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
