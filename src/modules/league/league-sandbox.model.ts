import mongoose from 'mongoose';
import toJSON from '../toJSON/toJSON';
import { ILeagueSandboxDoc, ILeagueSandboxModel } from './league-sandbox.interfaces';

const leagueSandboxSchema = new mongoose.Schema<ILeagueSandboxDoc, ILeagueSandboxModel>(
  {
    leagueSlug: { type: String, required: true, unique: true, index: true },
    slot: { type: String, required: true },
    taskArn: { type: String, default: '' },
    privateIp: { type: String, default: '' },
    state: {
      type: String,
      required: true,
      enum: ['LAUNCHING', 'RUNNING', 'STOPPING', 'STOPPED'],
      default: 'LAUNCHING',
    },
    lastPlayerActivity: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    collection: 'leagueSandboxInstances',
  }
);

leagueSandboxSchema.plugin(toJSON);

const LeagueSandbox = mongoose.model<ILeagueSandboxDoc, ILeagueSandboxModel>('LeagueSandbox', leagueSandboxSchema);

export default LeagueSandbox;
