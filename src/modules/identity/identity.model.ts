import mongoose from 'mongoose';
import toJSON from '../toJSON/toJSON';
import { IIdentityMappingDoc, IIdentityMappingModel } from './identity.interfaces';

const identityMappingSchema = new mongoose.Schema<IIdentityMappingDoc, IIdentityMappingModel>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    provider: {
      type: String,
      required: true,
      enum: ['github', 'discord'],
      default: 'github',
    },
    subject: {
      type: String,
      trim: true,
    },
    playerName: {
      type: String,
      required: true,
      trim: true,
    },
    admin: {
      type: Boolean,
      required: true,
      default: false,
    },
  },
  {
    timestamps: true,
    collection: 'identityMappings',
  }
);

identityMappingSchema.plugin(toJSON);

const IdentityMapping = mongoose.model<IIdentityMappingDoc, IIdentityMappingModel>('IdentityMapping', identityMappingSchema);

export default IdentityMapping;
