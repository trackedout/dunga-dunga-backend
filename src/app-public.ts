import express, { Express } from 'express';
import helmet from 'helmet';
import { inHTMLData } from 'xss-filters';
import ExpressMongoSanitize from 'express-mongo-sanitize';
import compression from 'compression';
import cors from 'cors';
import httpStatus from 'http-status';
import config from './config/config';
import { morgan } from './modules/logger';
import { ApiError, errorConverter, errorHandler } from './modules/errors';
import feedRoute from './routes/v1/feed.route';
import { feedController } from './modules/feed';

const ALLOWED_ORIGINS = config.publicCorsOrigins ?? [];

const app: Express = express();

console.log('Config:', config);

app.use(morgan.successHandler);
app.use(morgan.errorHandler);

app.use(helmet());
app.use(
  cors({
    origin: ALLOWED_ORIGINS.length > 0 ? ALLOWED_ORIGINS : false,
    methods: ['GET'],
  })
);
app.use(express.json({ limit: '10kb' }));
app.use(compression() as any);

// XSS sanitization
const xssClean = (obj: unknown): unknown => {
  if (typeof obj === 'string') return inHTMLData(obj).trim();
  if (Array.isArray(obj)) return obj.map(xssClean);
  if (obj && typeof obj === 'object') return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, xssClean(v)]));
  return obj;
};
app.use((req, _res, next) => {
  Object.assign(req.query, xssClean({ ...req.query }));
  next();
});

// MongoDB operator injection sanitization
app.use((req, _res, next) => {
  Object.assign(req.query, ExpressMongoSanitize.sanitize({ ...req.query }));
  next();
});

app.use('/v1/feed', feedRoute);
app.use('/v1/runs/:runId', feedController.getRunHandler);

app.use((_req, _res, next) => {
  next(new ApiError(httpStatus.NOT_FOUND, 'Not found'));
});

app.use(errorConverter);
app.use(errorHandler);

export default app;
