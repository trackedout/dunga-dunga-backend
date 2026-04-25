import Event from '../event/event.model';
import Score from '../score/score.model';
import Claim from '../claim/claim.model';
import Player from '../event/player.model';

const effectiveKiller = {
  $cond: {
    if: { $and: [{ $ne: ['$metadata.killer', 'unknown'] }, { $ne: ['$metadata.killer', ''] }, { $ne: ['$metadata.killer', null] }] },
    then: '$metadata.killer',
    else: {
      $cond: {
        if: { $and: [{ $ne: ['$metadata.death-message', null] }, { $ne: ['$metadata.death-message', ''] }] },
        then: {
          $ltrim: {
            input: {
              $cond: {
                if: { $eq: [{ $indexOfCP: ['$metadata.death-message', '$player'] }, 0] },
                then: { $substr: ['$metadata.death-message', { $add: [{ $strLenCP: '$player' }, 1] }, -1] },
                else: '$metadata.death-message',
              },
            },
          },
        },
        else: null,
      },
    },
  },
};

export const listPlayers = async (since?: string, runType?: string) => {
  const query: Record<string, unknown> = { isAllowedToPlayDO2: true };
  if (since) query['lastQueuedAt'] = { $gte: new Date(since) };

  const claimMatch: Record<string, unknown> = { 'metadata.end-time': { $exists: true } };
  if (since) claimMatch['createdAt'] = { $gte: new Date(since) };
  if (runType) {
    const longForm = { p: 'practice', c: 'competitive', h: 'hardcore' }[runType] ?? runType;
    claimMatch['metadata.run-type'] = { $in: [runType, longForm] };
  }

  const [players, claimStats] = await Promise.all([
    Player.find(query).sort({ lastQueuedAt: -1 }).select('playerName state lastSeen lastQueuedAt').lean(),
    Claim.aggregate([
      { $match: claimMatch },
      { $group: {
        _id: { $toLower: '$player' },
        runs: { $sum: 1 },
        wins: { $sum: { $cond: [{ $eq: ['$metadata.game-won', 'true'] }, 1, 0] } },
      }},
    ]),
  ]);

  const statsMap = new Map(claimStats.map((s) => [s._id as string, { runs: s.runs as number, wins: s.wins as number }]));

  return { results: players.map((p) => {
    const s = statsMap.get(p.playerName.toLowerCase()) ?? { runs: 0, wins: 0 };
    return {
      name: p.playerName,
      state: p.state,
      lastSeen: p.lastSeen ?? null,
      lastQueuedAt: p.lastQueuedAt ?? null,
      runs: s.runs,
      wins: s.wins,
      losses: s.runs - s.wins,
    };
  }) };
};

export const getPlayerData = async (name: string, since?: string, until?: string) => {
  const dateFilter: Record<string, Date> = {};
  if (since) dateFilter['$gte'] = new Date(since);
  if (until) dateFilter['$lt'] = new Date(until);

  const [scores, claims, nemesisResult] = await Promise.all([
    Score.find({ player: { $regex: name, $options: 'i' } })
      .sort({ key: 1 })
      .lean(),
    Claim.find({
      player: { $regex: name, $options: 'i' },
      ...(Object.keys(dateFilter).length ? { createdAt: dateFilter } : {}),
    }).lean(),
    Event.aggregate([
      { $match: {
        name: 'player-died',
        player: { $regex: `^${name}$`, $options: 'i' },
        $or: [
          { 'metadata.killer': { $exists: true, $nin: ['unknown', '', null] } },
          { 'metadata.death-message': { $exists: true, $nin: ['', null] } },
        ],
        ...(Object.keys(dateFilter).length ? { createdAt: dateFilter } : {}),
      }},
      { $sort: { createdAt: 1 } },
      { $group: { _id: '$metadata.run-id', killer: { $first: effectiveKiller } } },
      { $match: { killer: { $nin: [null, '', 'unknown', 'nothing, they survived Decked Out'] } } },
      { $group: { _id: '$killer', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 1 },
    ]),
  ]);

  const completedClaims = claims.filter((c) => {
    const meta = c.metadata as unknown as Record<string, string>;
    return !!meta['end-time'];
  });

  const wins = completedClaims.filter((c) => {
    const meta = c.metadata as unknown as Record<string, string>;
    return meta['game-won'] === 'true';
  }).length;

  const nemesis = nemesisResult[0] ? { killer: nemesisResult[0]._id as string, count: nemesisResult[0].count as number } : null;

  return {
    player: name,
    scores: scores.map((s) => ({ key: s.key, value: s.value })),
    recentRuns: { total: completedClaims.length, wins, losses: completedClaims.length - wins },
    nemesis,
  };
};
