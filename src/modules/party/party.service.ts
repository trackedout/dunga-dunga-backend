import httpStatus from 'http-status';
import mongoose from 'mongoose';
import Party from './party.model';
import Players from '../event/player.model';
import ApiError from '../errors/ApiError';
import { IPartyDoc, PartyStates } from './party.interfaces';
import { QueueStates } from '../event/player.interfaces';
import { GameRegistry } from '../gameRegistry';
import { Claim } from '../claim';
import { ClaimStates, ClaimTypes } from '../claim/claim.interfaces';
import { logger } from '../logger';

export const createParty = async (leader: string, game: string): Promise<IPartyDoc> => {
  const gameEntry = await GameRegistry.findOne({ name: game, enabled: true }).exec();
  if (!gameEntry) {
    throw new ApiError(httpStatus.BAD_REQUEST, `Game '${game}' does not exist or is not enabled`);
  }

  const player = await Players.findOne({ playerName: leader }).exec();
  if (!player) {
    throw new ApiError(httpStatus.NOT_FOUND, `Player '${leader}' not found`);
  }

  const existingParty = await Party.findOne({
    $or: [{ members: leader }, { leader: leader }],
    state: { $ne: PartyStates.DISBANDED },
  }).exec();
  if (existingParty) {
    throw new ApiError(httpStatus.CONFLICT, `Player '${leader}' is already in a party`);
  }

  return Party.create({
    leader,
    game,
    members: [leader],
    invites: [],
    state: PartyStates.FORMING,
  });
};

export const getActivePartyForPlayer = async (playerName: string): Promise<IPartyDoc | null> => {
  return Party.findOne({
    $or: [{ members: playerName }, { leader: playerName }],
    state: { $ne: PartyStates.DISBANDED },
  }).exec();
};

export const getPartyById = async (id: string): Promise<IPartyDoc | null> => {
  return Party.findById(new mongoose.Types.ObjectId(id)).exec();
};

export const invitePlayer = async (partyId: string, requester: string, target: string): Promise<IPartyDoc> => {
  const party = await getPartyById(partyId);
  if (!party) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Party not found');
  }

  if (party.leader !== requester) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Only the party leader can invite players');
  }

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
  const party = await getPartyById(partyId);
  if (!party) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Party not found');
  }

  if (party.state !== PartyStates.FORMING) {
    throw new ApiError(httpStatus.PRECONDITION_FAILED, 'Party is not in forming state');
  }

  if (!party.invites.includes(playerName)) {
    throw new ApiError(httpStatus.FORBIDDEN, `Player '${playerName}' does not have an invite to this party`);
  }

  const gameEntry = await GameRegistry.findOne({ name: party.game }).exec();
  if (!gameEntry) {
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, `Game '${party.game}' not found in registry`);
  }

  if (party.members.length >= gameEntry.maxPlayers) {
    throw new ApiError(httpStatus.PRECONDITION_FAILED, 'Party is full');
  }

  party.invites = party.invites.filter((i) => i !== playerName);
  party.members.push(playerName);
  await party.save();
  return party;
};

export const leaveParty = async (partyId: string, playerName: string): Promise<IPartyDoc> => {
  const party = await getPartyById(partyId);
  if (!party) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Party not found');
  }

  if (party.leader === playerName) {
    return disbandParty(partyId, playerName);
  }

  party.members = party.members.filter((m) => m !== playerName);
  await party.save();
  return party;
};

export const kickPlayer = async (partyId: string, requester: string, target: string): Promise<IPartyDoc> => {
  const party = await getPartyById(partyId);
  if (!party) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Party not found');
  }

  if (party.leader !== requester) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Only the party leader can kick players');
  }

  if (!party.members.includes(target)) {
    throw new ApiError(httpStatus.NOT_FOUND, `Player '${target}' is not a member of this party`);
  }

  party.members = party.members.filter((m) => m !== target);
  party.invites = party.invites.filter((i) => i !== target);
  await party.save();
  return party;
};

export const queueParty = async (partyId: string, requester: string): Promise<IPartyDoc> => {
  const party = await getPartyById(partyId);
  if (!party) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Party not found');
  }

  if (party.leader !== requester) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Only the party leader can queue the party');
  }

  if (party.state !== PartyStates.FORMING) {
    throw new ApiError(httpStatus.PRECONDITION_FAILED, 'Party must be in forming state to queue');
  }

  const gameEntry = await GameRegistry.findOne({ name: party.game }).exec();
  if (!gameEntry) {
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, `Game '${party.game}' not found in registry`);
  }

  if (party.members.length < gameEntry.minPlayers) {
    throw new ApiError(
      httpStatus.PRECONDITION_FAILED,
      `Not enough players. Need at least ${gameEntry.minPlayers}, have ${party.members.length}`
    );
  }

  const memberPlayers = await Players.find({ playerName: { $in: party.members } }).exec();
  for (const member of memberPlayers) {
    if (member.state !== QueueStates.IN_LOBBY) {
      throw new ApiError(httpStatus.PRECONDITION_FAILED, `Player '${member.playerName}' is not in the lobby (state: ${member.state})`);
    }
  }

  const claim = await Claim.create({
    player: party.leader,
    type: ClaimTypes.DUNGEON,
    state: ClaimStates.PENDING,
    metadata: {
      'dungeon-type': party.game,
      'party-id': party._id.toString(),
      'party-players': party.members.join(','),
      slug: 'party',
    },
  });

  await Players.updateMany(
    { playerName: { $in: party.members } },
    {
      state: QueueStates.IN_QUEUE,
      activeClaimId: claim.id,
      lastQueuedAt: new Date(),
    }
  ).exec();

  party.state = PartyStates.QUEUED;
  party.claimId = claim.id;
  await party.save();

  logger.info(`Party ${party._id} queued for game '${party.game}' with members: ${party.members.join(', ')}`);
  return party;
};

export const disbandParty = async (partyId: string, requester: string): Promise<IPartyDoc> => {
  const party = await getPartyById(partyId);
  if (!party) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Party not found');
  }

  if (party.leader !== requester) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Only the party leader can disband the party');
  }

  party.state = PartyStates.DISBANDED;
  await party.save();

  return party;
};
