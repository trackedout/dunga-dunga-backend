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
import { validate } from './modules/validate';
import { leagueController, leagueValidation } from './modules/league';
import { requireIdentity, requireLeagueEditor, requireAdmin } from './modules/auth/adminAuth.middleware';

const ALLOWED_ORIGINS = config.publicCorsOrigins ?? [];

const app: Express = express();

console.log('Config:', config);

app.use(morgan.successHandler);
app.use(morgan.errorHandler);

app.use(helmet());
app.use(
  cors({
    origin: ALLOWED_ORIGINS.length > 0 ? ALLOWED_ORIGINS : false,
    // The management UI reads and mutates leagues.
    methods: ['GET', 'POST', 'DELETE'],
    // Forward the oauth2-proxy identity headers and allow credentials so the
    // browser sends the session cookie on same-site XHR.
    credentials: true,
  })
);
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true }));
app.use(compression() as any);

// XSS sanitization
const xssClean = (obj: unknown): unknown => {
  if (typeof obj === 'string') return inHTMLData(obj).trim();
  if (Array.isArray(obj)) return obj.map(xssClean);
  if (obj && typeof obj === 'object') return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, xssClean(v)]));
  return obj;
};
app.use((req, _res, next) => {
  if (req.body) req.body = xssClean(req.body);
  if (req.params) req.params = xssClean(req.params) as Record<string, string>;
  Object.assign(req.query, xssClean({ ...req.query }));
  next();
});

// MongoDB operator injection sanitization
app.use((req, _res, next) => {
  if (req.body) req.body = ExpressMongoSanitize.sanitize(req.body);
  if (req.params) req.params = ExpressMongoSanitize.sanitize(req.params);
  Object.assign(req.query, ExpressMongoSanitize.sanitize({ ...req.query }));
  next();
});

// Unauthenticated liveness/readiness probe. Mounted before the identity gate so
// k8s can health-check the pod without a forwarded identity.
app.get('/healthz', (_req, res) => {
  res.status(httpStatus.OK).send({ status: 'ok' });
});

// Every league-management route requires an authenticated, player-linked
// identity. The edge (oauth2-proxy + Dex) authenticates; requireIdentity
// resolves the forwarded email to a Minecraft player and rejects
// unlinked/anonymous callers.
app.use('/leagues', requireIdentity);

// Who am I: lets the UI show the resolved player and admin flag, and decide
// which leagues to surface as editable. Identity-gated only.
app.get('/leagues/me', (req, res) => {
  res.send(req.identity);
});

// Read: any linked identity may list/view leagues (the UI filters to the ones
// the caller can edit; viewing is not sensitive).
app.get('/leagues', leagueController.getActiveLeagues);
app.get('/leagues/:slug', validate(leagueValidation.getLeagueBySlug), leagueController.getLeagueBySlug);

// Create a brand-new league: network admin only (a new slug has no owner yet
// to authorize against).
app.post('/leagues', requireAdmin, validate(leagueValidation.upsertLeague), leagueController.upsertLeague);

// Mutate an existing league: must be an editor (owner/builder) of that league,
// or a network admin.
app.post('/leagues/:slug', requireLeagueEditor, validate(leagueValidation.upsertLeague), leagueController.upsertLeague);
app.post('/leagues/:slug/publish', requireLeagueEditor, validate(leagueValidation.publishLeague), leagueController.publishLeague);

app.post('/leagues/:slug/editors', requireLeagueEditor, validate(leagueValidation.leagueMember), leagueController.addEditor);
app.delete('/leagues/:slug/editors', requireLeagueEditor, validate(leagueValidation.leagueMember), leagueController.removeEditor);

app.post('/leagues/:slug/members', requireLeagueEditor, validate(leagueValidation.leagueMember), leagueController.addMember);
app.delete('/leagues/:slug/members', requireLeagueEditor, validate(leagueValidation.leagueMember), leagueController.removeMember);

app.use((_req, _res, next) => {
  next(new ApiError(httpStatus.NOT_FOUND, 'Not found'));
});

app.use(errorConverter);
app.use(errorHandler);

export default app;
