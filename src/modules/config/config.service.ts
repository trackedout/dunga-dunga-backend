import httpStatus from 'http-status';
import mongoose from 'mongoose';
import Config from './config.model';
import ApiError from '../errors/ApiError';
import { IOptions, QueryResult } from '../paginate/paginate';
import { DeleteConfig, GetConfig, IConfigDoc, NewCreatedConfig, UpdateConfigBody } from './config.interfaces';
import { logger } from '../logger';

export const createConfigs = async (configs: NewCreatedConfig[]): Promise<IConfigDoc[]> => {
  if (configs.length === 0) {
    return [];
  }
  const serverName = configs[0]!!.server;

  // First find existing configs, then log an event showing the config diff (config-modified)
  const existingConfigs = await Config.find({
    server: serverName,
    key: configs.map((s) => s.key),
  });

  for (const existingConfig of existingConfigs) {
    const newConfig = configs.find((s) => s.key === existingConfig.key);
    if (!newConfig) {
      continue;
    }

    if (newConfig.value === existingConfig.value) {
      continue;
    }

    logger.debug(`New config: ${JSON.stringify(newConfig, null, 4)}`);
  }

  await Config.deleteMany({
    server: serverName,
    key: configs.map((s) => s.key),
  });

  return Config.create(configs);
};

export const queryConfigs = async (filter: Record<string, any>, options: IOptions): Promise<QueryResult> => {
  return Config.paginate(filter, options);
};

export const getConfigById = async (id: mongoose.Types.ObjectId): Promise<IConfigDoc | null> => Config.findById(id);

export const getConfig = async (filter: GetConfig): Promise<IConfigDoc | null> => {
  const config = await Config.findOne(filter).exec();
  if (!config) {
    throw new ApiError(httpStatus.NOT_FOUND, `Config not found for filter ${filter}`);
  }
  return config;
};

export const updateConfigById = async (configId: mongoose.Types.ObjectId, updateBody: UpdateConfigBody): Promise<IConfigDoc | null> => {
  const config = await getConfigById(configId);
  if (!config) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Config not found');
  }
  Object.assign(config, updateBody);
  await config.save();
  return config;
};

export const deleteConfig = async (filter: DeleteConfig): Promise<IConfigDoc | null> => {
  const config = await Config.findOne(filter).exec();
  if (!config) {
    throw new ApiError(httpStatus.NOT_FOUND, `Config not found for filter ${filter}`);
  }
  await config.deleteOne();
  return config;
};
