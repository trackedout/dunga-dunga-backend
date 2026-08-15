import mongoose from 'mongoose';
import toJSON from '../toJSON/toJSON';
import { ILeagueDoc, ILeagueModel } from './league.interfaces';

const leagueItemSchema = new mongoose.Schema(
  {
    scoreboard: { type: String },
    startingAmount: { type: Number },
    earned: { type: String },
    spent: { type: String },
  },
  { _id: false, strict: false }
);

const tradeSourceSchema = new mongoose.Schema(
  {
    item: { type: String, required: true },
    amount: { type: Number, required: true },
  },
  { _id: false }
);

const tradeTargetSchema = new mongoose.Schema(
  {
    type: { type: String },
    item: { type: String },
    amount: { type: Number },
  },
  { _id: false, strict: false }
);

const tradeSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    source: { type: tradeSourceSchema, required: true },
    target: { type: tradeTargetSchema, default: null },
  },
  { _id: false }
);

const displaySchema = new mongoose.Schema(
  {
    shortId: { type: String, required: true },
    runTypeId: { type: Number, required: true },
    colour: { type: Number, required: true },
    material: { type: String, required: true },
  },
  { _id: false }
);

const deckSchema = new mongoose.Schema(
  {
    prefix: { type: String, required: true },
    defaultCards: { type: [String], required: true },
  },
  { _id: false }
);

const dungeonSchema = new mongoose.Schema(
  {
    type: { type: String, required: true, default: 'default' },
    claimFilters: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

const phaseConfigSchema = new mongoose.Schema(
  {
    phase: { type: Number, required: true },
    start: { type: String, required: true },
    end: { type: String, required: true },
  },
  { _id: false }
);

const phaseAllocationSchema = new mongoose.Schema(
  {
    type: { type: String, required: true, default: 'none' },
  },
  { _id: false }
);

const phaseTransitionSchema = new mongoose.Schema(
  {
    autoTransition: { type: Boolean, default: false },
    allocation: { type: phaseAllocationSchema, default: { type: 'none' } },
    actions: { type: [String], default: [] },
  },
  { _id: false }
);

const scoringSchema = new mongoose.Schema(
  {
    metric: { type: String, required: true },
    pointsForPosition: { type: [Number], default: [] },
  },
  { _id: false }
);

const eventTriggerConditionSchema = new mongoose.Schema(
  {
    item: { type: String },
    below: { type: Number },
  },
  { _id: false }
);

const eventTriggerSchema = new mongoose.Schema(
  {
    event: { type: String, required: true },
    condition: { type: eventTriggerConditionSchema },
  },
  { _id: false }
);

const eventActionSchema = new mongoose.Schema(
  {
    type: { type: String, required: true },
    scoreboard: { type: String },
    value: { type: Number },
    pattern: { type: String },
    sourcePattern: { type: String },
    targetPrefix: { type: String },
  },
  { _id: false }
);

const eventHandlerSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    trigger: { type: eventTriggerSchema, required: true },
    actions: { type: [eventActionSchema], required: true },
  },
  { _id: false }
);

const leagueSchema = new mongoose.Schema<ILeagueDoc, ILeagueModel>(
  {
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    owner: {
      type: String,
      required: true,
      trim: true,
    },
    display: {
      type: displaySchema,
      required: true,
    },
    members: {
      type: [String],
      default: [],
    },
    joinPolicy: {
      type: String,
      required: true,
      enum: ['auto', 'open', 'invite-only', 'approval'],
      default: 'auto',
    },
    items: {
      type: Map,
      of: leagueItemSchema,
      required: true,
    },
    trades: {
      type: [tradeSchema],
      default: [],
    },
    deck: {
      type: deckSchema,
      required: true,
    },
    dungeon: {
      type: dungeonSchema,
      required: true,
    },
    phases: {
      type: [phaseConfigSchema],
      default: [],
    },
    phaseTransition: {
      type: phaseTransitionSchema,
      default: { autoTransition: false, allocation: { type: 'none' }, actions: [] },
    },
    scoring: {
      type: scoringSchema,
      default: null,
    },
    eventHandlers: {
      type: [eventHandlerSchema],
      default: [],
    },
    state: {
      type: String,
      required: true,
      enum: ['draft', 'active', 'completed', 'archived'],
      default: 'active',
    },
  },
  {
    timestamps: true,
    collection: 'leagues',
  }
);

leagueSchema.plugin(toJSON);

const League = mongoose.model<ILeagueDoc, ILeagueModel>('League', leagueSchema);

export default League;
