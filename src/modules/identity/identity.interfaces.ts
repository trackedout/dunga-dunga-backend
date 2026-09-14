import { Model, Document } from 'mongoose';

// Maps an external OIDC identity (issued by Dex, originally from a GitHub or —
// later — Discord connector) to a Minecraft player name. This is the bridge
// between "who logged in on the website" and the player name that league
// ownership (owner / builders.players) is expressed in.
//
// Option B (manually populated): a super-admin creates these rows. The
// authorization layer never trusts a browser-supplied player name — it always
// resolves the player from the forwarded OIDC identity via this collection.

// The connector that produced the identity. `email` is the primary match key
// because oauth2-proxy reliably forwards a verified email for the GitHub
// connector; `subject` (the stable OIDC `sub`) is stored for future providers
// where email may be absent or mutable.
export type IdentityProvider = 'github' | 'discord';

export interface IIdentityMapping {
  // Lower-cased email claim forwarded by oauth2-proxy (X-Auth-Request-Email).
  // Primary lookup key. Unique across the collection.
  email: string;
  // Which connector this identity came through.
  provider: IdentityProvider;
  // Stable OIDC subject (Dex `sub`), stored for auditing / future lookup when
  // email is unavailable. Optional because manual rows may only know the email.
  subject?: string;
  // The Minecraft player name this identity acts as. Matched against
  // league.owner and league.builders.players by isLeagueEditor.
  playerName: string;
  // Grants network-wide league management regardless of per-league ownership.
  admin: boolean;
}

export interface IIdentityMappingDoc extends IIdentityMapping, Document {
  createdAt: Date;
  updatedAt: Date;
}

export interface IIdentityMappingModel extends Model<IIdentityMappingDoc> {}

// The resolved identity attached to a request after the middleware runs.
export interface ResolvedIdentity {
  email: string;
  playerName: string;
  admin: boolean;
}
