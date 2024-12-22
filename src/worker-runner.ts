import mongoose from 'mongoose';
import worker from './worker';
import config from './config/config';
import logger from './modules/logger/logger';

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function runWorker() {
  worker
    .run()
    .then(async () => {
      await sleep(5000);
      runWorker();
    })
    .catch(async (err) => {
      logger.error('Error running background worker:', err);
      await sleep(5000);
      runWorker();
    });
}

mongoose.connect(config.mongoose.url).then(() => {
  logger.info('Connected to MongoDB');

  runWorker();
});

const exitHandler = () => {
  process.exit(1);
};

const unexpectedErrorHandler = (error: string) => {
  logger.error(error);
  exitHandler();
};

process.on('uncaughtException', unexpectedErrorHandler);
process.on('unhandledRejection', unexpectedErrorHandler);

process.on('SIGTERM', () => {
  logger.info('SIGTERM received');
});
