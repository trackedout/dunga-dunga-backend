import { Request, Response, NextFunction } from 'express';
import httpStatus from 'http-status';
import ApiError from '../errors/ApiError';
import catchAsync from '../utils/catchAsync';
import logger from '../logger/logger';
import { resolveByEmail } from '../identity/identity.service';
import { ResolvedIdentity } from '../identity/identity.interfaces';
import { getLeagueBySlug, isLeagueEditor } from '../league/league.service';

// Augment Express Request with the resolved identity. Populated by
// requireIdentity; downstream handlers/middleware read req.identity.
declare module 'express-serve-static-core' {
  interface Request {
    identity?: ResolvedIdentity;
  }
}

// oauth2-proxy forwards the authenticated user's email in this header after a
// successful Dex login. nginx is configured to pass it through only from the
// trusted auth subrequest, and the admin app is not otherwise reachable, so a
// present header means an authenticated session.
const EMAIL_HEADER = 'x-auth-request-email';

const headerValue = (req: Request, name: string): string | undefined => {
  const raw = req.headers[name];
  if (Array.isArray(raw)) return raw[0];
  return raw;
};

// Gate 1 (authentication + linkage): require a forwarded identity that maps to
// a Minecraft player. Rejects when the header is missing (not authenticated at
// the edge) or when no identityMappings row links the email to a player.
export const requireIdentity = catchAsync(async (req: Request, _res: Response, next: NextFunction) => {
  const email = headerValue(req, EMAIL_HEADER);
  if (!email) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Not authenticated');
  }

  const identity = await resolveByEmail(email);
  if (!identity) {
    logger.warn(`Authenticated user '${email}' has no identityMappings entry`);
    throw new ApiError(httpStatus.FORBIDDEN, 'No linked Minecraft player for this account');
  }

  req.identity = identity;
  next();
});

// Gate 2 (per-league authorization): require the resolved identity to be an
// editor of the league named by the :slug route param, or a network admin.
// Owners edit their own leagues; admins edit any. Must run after requireIdentity.
export const requireLeagueEditor = catchAsync(async (req: Request, _res: Response, next: NextFunction) => {
  const { identity } = req;
  if (!identity) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Not authenticated');
  }

  if (identity.admin) {
    next();
    return;
  }

  const slug = req.params['slug'] as string;
  const league = await getLeagueBySlug(slug);
  if (!league) {
    throw new ApiError(httpStatus.NOT_FOUND, 'League not found');
  }

  if (!isLeagueEditor(league, identity.playerName)) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Not an editor of this league');
  }

  next();
});

// Require network admin (for create/global operations not tied to an existing
// league the caller already owns).
export const requireAdmin = catchAsync(async (req: Request, _res: Response, next: NextFunction) => {
  const { identity } = req;
  if (!identity) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Not authenticated');
  }
  if (!identity.admin) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Admin access required');
  }
  next();
});
