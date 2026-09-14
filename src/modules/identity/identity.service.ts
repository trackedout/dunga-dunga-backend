import IdentityMapping from './identity.model';
import { IIdentityMappingDoc, ResolvedIdentity } from './identity.interfaces';

// Resolve a forwarded email claim to a mapped identity. Returns null when no
// mapping exists — the caller decides whether that is a 403 (known auth, but
// not linked to a player) so the user gets an actionable message.
export const resolveByEmail = async (email: string): Promise<ResolvedIdentity | null> => {
  const mapping: IIdentityMappingDoc | null = await IdentityMapping.findOne({ email: email.toLowerCase() }).exec();
  if (!mapping) return null;
  return {
    email: mapping.email,
    playerName: mapping.playerName,
    admin: mapping.admin,
  };
};
