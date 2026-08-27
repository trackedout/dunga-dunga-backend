import { Model, Document } from 'mongoose';

export type SandboxState = 'LAUNCHING' | 'RUNNING' | 'STOPPING' | 'STOPPED';

export interface ILeagueSandbox {
  leagueSlug: string;
  slot: string;
  taskArn: string;
  privateIp: string;
  state: SandboxState;
  lastPlayerActivity: Date;
}

export interface ILeagueSandboxDoc extends ILeagueSandbox, Document {
  createdAt: Date;
  updatedAt: Date;
}

export interface ILeagueSandboxModel extends Model<ILeagueSandboxDoc> {}
