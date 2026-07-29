import mongoose from 'mongoose';
import toJSON from '../toJSON/toJSON';
import paginate from '../paginate/paginate';
import { IGameRegistryDoc, IGameRegistryModel } from './gameRegistry.interfaces';

const gameRegistrySchema = new mongoose.Schema<IGameRegistryDoc, IGameRegistryModel>(
  {
    name: {
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
    minPlayers: {
      type: Number,
      required: true,
      default: 1,
    },
    maxPlayers: {
      type: Number,
      required: true,
      default: 1,
    },
    permission: {
      type: String,
      required: true,
      trim: true,
    },
    tokenCost: {
      type: Number,
      default: 0,
    },
    tokenType: {
      type: String,
      required: false,
      trim: true,
    },
    enabled: {
      type: Boolean,
      default: true,
    },
    snapshotSource: {
      type: String,
      required: true,
      trim: true,
    },
    resourcePackUrl: {
      type: String,
      required: false,
      trim: true,
    },
    resourcePackSha1: {
      type: String,
      required: false,
      trim: true,
    },
    datapackVersion: {
      type: String,
      default: 'latest',
      trim: true,
    },
  },
  {
    timestamps: true,
    collection: 'gameRegistry',
  }
);

gameRegistrySchema.plugin(toJSON);
gameRegistrySchema.plugin(paginate);

const GameRegistry = mongoose.model<IGameRegistryDoc, IGameRegistryModel>('GameRegistry', gameRegistrySchema);

export default GameRegistry;
