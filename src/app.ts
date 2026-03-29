import express, { Express } from 'express';
import helmet from 'helmet';
import { inHTMLData } from 'xss-filters';
import ExpressMongoSanitize from 'express-mongo-sanitize';
import compression from 'compression';
import cors from 'cors';
import httpStatus from 'http-status';
import config from './config/config';
import { morgan } from './modules/logger';
import { authLimiter } from './modules/utils';
import { ApiError, errorConverter, errorHandler } from './modules/errors';
import routes from './routes/v1';

const app: Express = express();

console.log('Config:', config);

if (config.env !== 'test') {
  app.use(morgan.successHandler);
  app.use(morgan.errorHandler);
}

// set security HTTP headers
app.use(helmet());

// enable cors
app.use(cors());
app.options('/{*path}', cors());

// parse json request body
app.use(express.json());

// parse urlencoded request body
app.use(express.urlencoded({ extended: true }));

// sanitize request data
// eslint-disable-next-line @typescript-eslint/no-explicit-any
// xss sanitization (replacement for xss-clean which is incompatible with Express 5)
const xssClean = (obj: unknown): unknown => {
  if (typeof obj === 'string') return inHTMLData(obj).trim();
  if (Array.isArray(obj)) return obj.map(xssClean);
  if (obj && typeof obj === 'object') {
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, xssClean(v)]));
  }
  return obj;
};
app.use((req, _res, next) => {
  if (req.body) req.body = xssClean(req.body);
  if (req.params) req.params = xssClean(req.params) as Record<string, string>;
  Object.assign(req.query, xssClean({ ...req.query }));
  next();
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
// express-mongo-sanitize is incompatible with Express 5 (direct req.query assignment)
app.use((req, _res, next) => {
  if (req.body) req.body = ExpressMongoSanitize.sanitize(req.body);
  if (req.params) req.params = ExpressMongoSanitize.sanitize(req.params);
  Object.assign(req.query, ExpressMongoSanitize.sanitize({ ...req.query }));
  next();
});

// gzip compression
// eslint-disable-next-line @typescript-eslint/no-explicit-any
app.use(compression() as any);

// limit repeated failed requests to auth endpoints
if (config.env === 'production') {
  app.use('/v1/auth', authLimiter);
}

// v1 api routes
app.use('/v1', routes);

// send back a 404 error for any unknown api request
app.use((_req, _res, next) => {
  next(new ApiError(httpStatus.NOT_FOUND, 'Not found'));
});

// convert error to ApiError, if needed
app.use(errorConverter);

// handle error
app.use(errorHandler);

export default app;
