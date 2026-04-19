import express, { Express } from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import httpStatus from 'http-status';
import { morgan } from './modules/logger';
import { ApiError, errorConverter, errorHandler } from './modules/errors';
import feedRoute from './routes/v1/feed.route';

const app: Express = express();

app.use(morgan.successHandler);
app.use(morgan.errorHandler);

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(compression() as any);

app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.use('/v1/feed', feedRoute);

app.use((_req, _res, next) => {
  next(new ApiError(httpStatus.NOT_FOUND, 'Not found'));
});

app.use(errorConverter);
app.use(errorHandler);

export default app;
