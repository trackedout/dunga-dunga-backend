import httpStatus from 'http-status';
import mongoose from 'mongoose';
import Party from './party.model';
import Players from '../event/player.model';
import ApiError from '../errors/ApiError';
import { IPartyDoc, PartyStates } from './party.interfaces';
import { QueueStates } from '../event/player.interfaces';
import { Claim } from '../claim';
import { ClaimStates, IClaimDoc } from '../claim/claim.interfaces';
import { getLeagueBySlug } from '../league/league.service';
import { ILeagueDoc, ILeagueParty } from '../league/league.interfaces';
import { logger } from '../logger';
import { notifyPlayer } from '../task';

const SOLO_ONLY: ILeagueParty = { minPlayers: 1, maxPlayers: 1 };

// Claim states during which the party's run is still ahead of it or under way
const ACTIVE_CLAIM_STATES = [ClaimStates.PENDING, ClaimStates.ACQUIRED, ClaimStates.IN_USE];

// Member states that mean "waiting to be sent into the party's dungeon"
const AWAITING_DUNGEON_STATES = [QueueStates.IN_QUEUE, QueueStates.IN_TRANSIT_TO_DUNGEON];

export const partyLimits = (league: ILeagueDoc | null): ILeagueParty => league?.party ?? SOLO_ONLY;

const supportsParties = (league: ILeagueDoc) => partyLimits(league).maxPlayers > 1;

async function getPartyLeague(slug: string): Promise<ILeagueDoc> {
  const league = await getLeagueBySlug(slug);
  if (!league || league.state !== 'active') {
    throw new ApiError(httpStatus.BAD_REQUEST, `League '${slug}' does not exist or is not active`);
  }

  if (!supportsParties(league)) {
    throw new ApiError(httpStatus.BAD_REQUEST, `${league.displayName} does not support parties`);
  }

  return league;
}

export const createParty = async (leader: string, slug: string): Promise<IPartyDoc> => {
  await getPartyLeague(slug);

  const player = await Players.findOne({ playerName: leader }).exec();
  if (!player) {
    throw new ApiError(httpStatus.NOT_FOUND, `Player '${leader}' not found`);
  }

  if (await getActivePartyForPlayer(leader)) {
    throw new ApiError(httpStatus.CONFLICT, `Player '${leader}' is already in a party`);
  }

  return Party.create({
    leader,
    slug,
    members: [leader],
    invites: [],
    state: PartyStates.FORMING,
  });
};

export const getActivePartyForPlayer = async (playerName: string): Promise<IPartyDoc | null> => {
  const party = await Party.findOne({
    $or: [{ members: playerName }, { leader: playerName }],
    state: { $ne: PartyStates.DISBANDED },
  }).exec();

  return party && returnToFormingIfRunEnded(party);
};

export const getPartyById = async (id: string): Promise<IPartyDoc | null> => {
  const party = await Party.findById(new mongoose.Types.ObjectId(id)).exec();
  return party && returnToFormingIfRunEnded(party);
};

// A queued party goes back to forming once its run is over (or was cancelled),
// so the same group can queue again without re-inviting everyone
async function returnToFormingIfRunEnded(party: IPartyDoc): Promise<IPartyDoc> {
  if (party.state !== PartyStates.QUEUED) {
    return party;
  }

  const claim = party.claimId ? await Claim.findById(party.claimId).exec() : null;
  if (claim && ACTIVE_CLAIM_STATES.includes(claim.state)) {
    return party;
  }

  party.state = PartyStates.FORMING;
  party.claimId = undefined;
  await party.save();
  return party;
}

async function getPartyOrThrow(partyId: string): Promise<IPartyDoc> {
  const party = await getPartyById(partyId);
  if (!party) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Party not found');
  }
  return party;
}

function assertLeader(party: IPartyDoc, requester: string, action: string) {
  if (party.leader !== requester) {
    throw new ApiError(httpStatus.FORBIDDEN, `Only the party leader can ${action}`);
  }
}

export const invitePlayer = async (partyId: string, requester: string, target: string): Promise<IPartyDoc> => {
  const party = await getPartyOrThrow(partyId);
  assertLeader(party, requester, 'invite players');

  if (party.members.includes(target) || party.invites.includes(target)) {
    throw new ApiError(httpStatus.CONFLICT, `Player '${target}' is already a member or has a pending invite`);
  }

  const targetPlayer = await Players.findOne({ playerName: target }).exec();
  if (!targetPlayer) {
    throw new ApiError(httpStatus.NOT_FOUND, `Player '${target}' not found`);
  }

  if (targetPlayer.state !== QueueStates.IN_LOBBY) {
    throw new ApiError(httpStatus.PRECONDITION_FAILED, `Player '${target}' is not in the lobby`);
  }

  party.invites.push(target);
  await party.save();
  return party;
};

export const joinParty = async (partyId: string, playerName: string): Promise<IPartyDoc> => {
  const party = await getPartyOrThrow(partyId);

  if (party.state !== PartyStates.FORMING) {
    throw new ApiError(httpStatus.PRECONDITION_FAILED, 'The party is already queued, wait for its run to finish');
  }

  if (!party.invites.includes(playerName)) {
    throw new ApiError(httpStatus.FORBIDDEN, `Player '${playerName}' does not have an invite to this party`);
  }

  if (await getActivePartyForPlayer(playerName)) {
    throw new ApiError(httpStatus.CONFLICT, `Player '${playerName}' is already in a party`);
  }

  const { maxPlayers } = partyLimits(await getLeagueBySlug(party.slug));
  if (party.members.length >= maxPlayers) {
    throw new ApiError(httpStatus.PRECONDITION_FAILED, `The party is full (${maxPlayers} players)`);
  }

  party.invites = party.invites.filter((i) => i !== playerName);
  party.members.push(playerName);
  await party.save();
  return party;
};

export const leaveParty = async (partyId: string, playerName: string): Promise<IPartyDoc> => {
  const party = await getPartyOrThrow(partyId);

  if (party.leader === playerName) {
    return disbandParty(partyId, playerName);
  }

  party.members = party.members.filter((m) => m !== playerName);
  await party.save();
  await detachFromPartyRun(party, [playerName]);
  return party;
};

export const kickPlayer = async (partyId: string, requester: string, target: string): Promise<IPartyDoc> => {
  const party = await getPartyOrThrow(partyId);
  assertLeader(party, requester, 'kick players');

  if (!party.members.includes(target)) {
    throw new ApiError(httpStatus.NOT_FOUND, `Player '${target}' is not a member of this party`);
  }

  if (target === party.leader) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'The party leader cannot be kicked, disband the party instead');
  }

  party.members = party.members.filter((m) => m !== target);
  party.invites = party.invites.filter((i) => i !== target);
  await party.save();
  await detachFromPartyRun(party, [target]);
  return party;
};

export const disbandParty = async (partyId: string, requester: string): Promise<IPartyDoc> => {
  const party = await getPartyOrThrow(partyId);
  assertLeader(party, requester, 'disband the party');

  party.state = PartyStates.DISBANDED;
  await party.save();

  // The leader's own run carries on solo
  await detachFromPartyRun(
    party,
    party.members.filter((m) => m !== party.leader)
  );
  return party;
};

// Players who leave a queued party stop waiting for its dungeon and are no
// longer sent in with the leader
async function detachFromPartyRun(party: IPartyDoc, playerNames: string[]) {
  if (!party.claimId || playerNames.length === 0) {
    return;
  }

  const claim = await Claim.findById(party.claimId).exec();
  if (!claim || !ACTIVE_CLAIM_STATES.includes(claim.state)) {
    return;
  }

  const remaining = partyPlayersOf(claim.metadata?.get('party-players')).filter((p) => !playerNames.includes(p));
  claim.metadata?.set('party-players', remaining.join(','));
  await claim.save();

  await Players.updateMany(
    { playerName: { $in: playerNames }, activeClaimId: claim.id, state: { $in: AWAITING_DUNGEON_STATES } },
    { state: QueueStates.IN_LOBBY, activeClaimId: '' }
  ).exec();
}

export const partyPlayersOf = (partyPlayers: string | undefined): string[] => (partyPlayers ?? '').split(',').filter((m) => m.length > 0);

// Called when a player queues for a run. A leader's party comes along with
// them; a member cannot queue on their own while they are in a party.
// Returns the party to attach to the run's claim, or null for a solo run.
export const getPartyReadyToQueue = async (playerName: string, slug: string): Promise<IPartyDoc | null> => {
  const party = await getActivePartyForPlayer(playerName);
  if (!party) {
    return null;
  }

  if (party.leader !== playerName) {
    throw new ApiError(
      httpStatus.PRECONDITION_FAILED,
      `You are in ${party.leader}'s party, only the party leader can queue. Leave the party to queue on your own`
    );
  }

  if (party.state !== PartyStates.FORMING) {
    throw new ApiError(httpStatus.PRECONDITION_FAILED, 'Your party is already queued');
  }

  if (party.slug !== slug) {
    throw new ApiError(
      httpStatus.PRECONDITION_FAILED,
      `Your party is for '${party.slug}'. Switch to that run mode, or disband the party to queue for '${slug}'`
    );
  }

  const { minPlayers } = partyLimits(await getPartyLeague(slug));
  if (party.members.length < minPlayers) {
    throw new ApiError(httpStatus.PRECONDITION_FAILED, `Your party needs at least ${minPlayers} players, it has ${party.members.length}`);
  }

  const membersNotInLobby = await Players.find({
    playerName: { $in: party.members.filter((m) => m !== playerName) },
    state: { $ne: QueueStates.IN_LOBBY },
  }).exec();
  if (membersNotInLobby.length > 0) {
    throw new ApiError(
      httpStatus.PRECONDITION_FAILED,
      `Party members must be in the lobby to queue: ${membersNotInLobby.map((p) => p.playerName).join(', ')}`
    );
  }

  return party;
};

export const partyClaimMetadata = (party: IPartyDoc): Record<string, string> => ({
  'party-id': party._id.toString(),
  'party-players': party.members.join(','),
});

// Members wait in the queue on the leader's claim. The worker only assigns a
// dungeon to the claim owner, and sends the members in when the leader enters.
export const markPartyQueued = async (party: IPartyDoc, claimId: string) => {
  const members = party.members.filter((m) => m !== party.leader);
  await Players.updateMany(
    { playerName: { $in: members } },
    { state: QueueStates.IN_QUEUE, activeClaimId: claimId, lastQueuedAt: new Date() }
  ).exec();

  for (const member of members) {
    await notifyPlayer(member, `<aqua>${party.leader} queued the party. You will be sent in when they pass through the dungeon door`);
  }

  party.state = PartyStates.QUEUED;
  party.claimId = claimId;
  await party.save();

  logger.info(`Party ${party._id} queued for '${party.slug}' with members: ${party.members.join(', ')}`);
};

// When a party's claim is invalidated, members still waiting on it go back to
// the lobby. Returns the members that were released.
export const releasePartyMembersFromClaim = async (claim: IClaimDoc): Promise<string[]> => {
  const members = partyPlayersOf(claim.metadata?.get('party-players')).filter((m) => m !== claim.player);
  if (members.length === 0) {
    return [];
  }

  const waitingMembers = await Players.find({
    playerName: { $in: members },
    activeClaimId: claim.id,
    state: { $in: AWAITING_DUNGEON_STATES },
  }).exec();
  const waitingNames = waitingMembers.map((p) => p.playerName);

  await Players.updateMany(
    { playerName: { $in: waitingNames }, activeClaimId: claim.id },
    { state: QueueStates.IN_LOBBY, activeClaimId: '' }
  ).exec();

  return waitingNames;
};
