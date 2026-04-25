import Player from '../event/player.model';
import DungeonInstance from '../event/instance.model';
import Config from '../config/config.model';
import Claim from '../claim/claim.model';

export const getOverview = async () => {
  const [players, dungeons, dungeonTypeConfigs] = await Promise.all([
    Player.find({ lastSeen: { $gte: new Date(Date.now() - 5 * 60 * 1000) }, playerName: { $ne: 'TangoCam' } })
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

  // Fetch claims for dungeons that have a claimId
  const claimIds = dungeons.map((d) => d.claimId).filter(Boolean) as string[];
  const claims = claimIds.length
    ? await Claim.find({ _id: { $in: claimIds } }).lean()
    : [];
  const claimMap = new Map(claims.map((c) => {
    const meta = c.metadata as unknown as Record<string, string>;
    return [c._id.toString(), { runId: meta['run-id'] ?? null, difficulty: meta['difficulty'] ?? null, runType: meta['run-type'] ?? null }];
  }));

  return {
    onlinePlayers: players.map((p) => ({
      name: p.playerName,
      state: p.state,
      server: p.server,
      lastSeen: p.lastSeen,
    })),
    dungeons: dungeons.map((d) => ({
      name: d.name,
      state: d.state,
      reservedBy: d.reservedBy,
      requiresRebuild: d.requiresRebuild,
      dungeonType: dungeonType(d.name),
      claim: d.claimId ? (claimMap.get(d.claimId) ?? null) : null,
    })),
  };
};
