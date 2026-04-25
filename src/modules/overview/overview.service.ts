import Player from '../event/player.model';
import DungeonInstance from '../event/instance.model';

export const getOverview = async () => {
  const [players, dungeons] = await Promise.all([
    Player.find({ lastSeen: { $gte: new Date(Date.now() - 5 * 60 * 1000) } })
      .sort({ lastSeen: -1 })
      .lean(),
    DungeonInstance.find({}).sort({ name: 1 }).lean(),
  ]);

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
      activePlayers: d.activePlayers,
      requiresRebuild: d.requiresRebuild,
    })),
  };
};
