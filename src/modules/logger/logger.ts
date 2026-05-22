import winston from 'winston';
import { TransformableInfo } from 'logform';
import { AsyncLocalStorage } from 'async_hooks';
import config from '../../config/config';

const asyncContext = new AsyncLocalStorage<string>();

export function withContext<T>(label: string, fn: () => T): T {
  return asyncContext.run(label, fn);
}

const enumerateErrorFormat = winston.format((info: TransformableInfo) => {
  if (info instanceof Error) {
    Object.assign(info, { message: info.stack });
  }
  return info;
});

const logger = winston.createLogger({
  level: config.env === 'development' ? 'debug' : 'info',
  format: winston.format.combine(
    enumerateErrorFormat(),
    config.env === 'development' ? winston.format.colorize() : winston.format.uncolorize(),
    winston.format.splat(),
    winston.format.printf((info: TransformableInfo) => {
      const ctx = asyncContext.getStore();
      return ctx ? `${info['level']} [${ctx}] ${info['message']}` : `${info['level']} ${info['message']}`;
    })
  ),
  transports: [
    new winston.transports.Console({
      stderrLevels: ['error'],
    }),
  ],
});

export default logger;
