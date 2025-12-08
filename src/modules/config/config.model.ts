import mongoose from 'mongoose';
import toJSON from '../toJSON/toJSON';
import paginate from '../paginate/paginate';
import { IConfigDoc, IConfigModel } from './config.interfaces';

const configSchema = new mongoose.Schema<IConfigDoc, IConfigModel>(
  {
    entity: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    key: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    value: {
      type: String,
      required: true,
      index: true,
    },
    metadata: {
      type: Map<String, String>,
      required: false,
      index: false,
    },
  },
  {
    timestamps: true,
  }
);

configSchema.index({ entity: 1, key: 1 });
configSchema.index({ entity: 1, key: 1, value: 1 });
configSchema.index({ key: 1, value: 1 });

// add plugin that converts mongoose to json
configSchema.plugin(toJSON);
configSchema.plugin(paginate);

configSchema.pre('save', async function (next) {
  next();
});

const Config = mongoose.model<IConfigDoc, IConfigModel>('Config', configSchema);

export default Config;
