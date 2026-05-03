import Player from '../event/player.model';
import DungeonInstance from '../event/instance.model';
import Config from '../config/config.model';
import Claim from '../claim/claim.model';

export const getOverview = async () => {
  const [players, dungeons, dungeonTypeConfigs] = await Promise.all([
    Player.find({ lastSeen: { $gte: new Date(Date.now() - 5 * 60 * 1000) }, playerName: { $ne: 'TangoCam' }, state: { $ne: 'somewhere-else' } })
      .sort({ lastSeen: -1 })
      .lean(),
    DungeonInstance.find({}).sort({ name: 1 }).lean(),
    Config.find({ key: 'dungeon-type' }).lean(),
  ]);

  const typeMap = new Map(dungeonTypeConfigs.map((c) => [c.entity, c.value]));
  const dungeonType = (name: string) => {
    const t = typeMap.get(name) ?? 'default';
    return t === 'default' ? 'season-1' : t;
  };

  // Fetch all relevant claims (from dungeons + online players)
  const dungeonClaimIds = dungeons.map((d) => d.claimId).filter(Boolean) as string[];
  const playerClaimIds = players.map((p) => p.activeClaimId).filter(Boolean) as string[];
  const allClaimIds = [...new Set([...dungeonClaimIds, ...playerClaimIds])];
  const allClaims = allClaimIds.length
    ? await Claim.find({ _id: { $in: allClaimIds } }).lean()
    : [];
  const claimMap = new Map(allClaims.map((c) => {
    const meta = c.metadata as unknown as Record<string, string>;
    return [c._id.toString(), { runId: meta['run-id'] ?? null, difficulty: meta['difficulty'] ?? null, runType: meta['run-type'] ?? null, startTime: meta['start-time'] ? new Date(parseInt(meta['start-time'], 10) * 1000).toISOString() : null, state: (c as any).state ?? null }];
  }));

  // Pending claims: players with activeClaimId not assigned to any dungeon AND actively queuing
  const assignedClaimIds = new Set(dungeonClaimIds);
  const pendingPlayers = await Player.find({
    activeClaimId: { $exists: true, $nin: ['', null, ...Array.from(assignedClaimIds)] },
    state: { $in: ['in-queue', 'in-transit-to-dungeon'] },
    lastSeen: { $gte: new Date(Date.now() - 5 * 60 * 1000) },
    playerName: { $ne: 'TangoCam' },
  }).lean();

  const pendingClaimMap = new Map(allClaims
    .filter((c) => pendingPlayers.some((p) => p.activeClaimId === c._id.toString()))
    .map((c) => {
      const meta = c.metadata as unknown as Record<string, string>;
      return [c._id.toString(), { difficulty: meta['difficulty'] ?? null, runType: meta['run-type'] ?? null }];
    }));

  return {
    onlinePlayers: players.map((p) => ({
      name: p.playerName,
      state: p.state,
      server: p.server,
      lastSeen: p.lastSeen,
      ...(p.activeClaimId && claimMap.has(p.activeClaimId) ? { claim: claimMap.get(p.activeClaimId) } : {}),
    })),
    dungeons: dungeons.map((d) => ({
      name: d.name,
      state: d.state,
      reservedBy: d.reservedBy,
      requiresRebuild: d.requiresRebuild,
      dungeonType: dungeonType(d.name),
      claim: d.claimId ? (claimMap.get(d.claimId) ?? null) : null,
    })),
    pendingClaims: pendingPlayers.map((p) => ({
      player: p.playerName,
      ...(pendingClaimMap.get(p.activeClaimId ?? '') ?? { difficulty: null, runType: null }),
      queuedAt: p.lastQueuedAt ?? null,
    })),
  };
};
