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

export const listPlayers = async (since?: string, runType?: string, until?: string) => {
  const query: Record<string, unknown> = { isAllowedToPlayDO2: true };
  if (since) query['lastQueuedAt'] = { ...(query['lastQueuedAt'] as object ?? {}), $gte: new Date(since) };
  if (until) query['lastQueuedAt'] = { ...(query['lastQueuedAt'] as object ?? {}), $lt: new Date(until) };

  const claimMatch: Record<string, unknown> = { 'metadata.end-time': { $exists: true } };
  const claimDateFilter: Record<string, Date> = {};
  if (since) claimDateFilter['$gte'] = new Date(since);
  if (until) claimDateFilter['$lt'] = new Date(until);
  if (Object.keys(claimDateFilter).length) claimMatch['createdAt'] = claimDateFilter;
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

export const getPlayerData = async (name: string, since?: string, until?: string, runType?: string) => {
  const dateFilter: Record<string, Date> = {};
  if (since) dateFilter['$gte'] = new Date(since);
  if (until) dateFilter['$lt'] = new Date(until);

  const runTypeMatch: Record<string, unknown> = {};
  if (runType) {
    const longForm = { p: 'practice', c: 'competitive', h: 'hardcore' }[runType] ?? runType;
    runTypeMatch['metadata.run-type'] = { $in: [runType, longForm] };
  }

  const [scores, claims, nemesisResult] = await Promise.all([
    Score.find({ player: { $regex: name, $options: 'i' } })
      .sort({ key: 1 })
      .lean(),
    Claim.find({
      player: { $regex: name, $options: 'i' },
      ...(Object.keys(dateFilter).length ? { createdAt: dateFilter } : {}),
      ...runTypeMatch,
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
        ...runTypeMatch,
      }},
      { $sort: { createdAt: 1 } },
      { $group: { _id: '$metadata.run-id', killer: { $first: effectiveKiller } } },
      { $match: { killer: { $nin: [null, '', 'unknown', 'nothing, they survived Decked Out'] } } },
      { $lookup: { from: 'events', let: { rid: '$_id' }, pipeline: [
        { $match: { $expr: { $and: [{ $eq: ['$metadata.run-id', '$$rid'] }, { $eq: ['$name', 'game-won'] }] } } },
        { $limit: 1 },
      ], as: '_won' } },
      { $match: { _won: { $size: 0 } } },
      { $group: { _id: '$killer', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 1 },
    ]),
  ]);

  const completedClaims = claims.filter((c) => {
    const meta = c.metadata as unknown as Record<string, string>;
    return !!meta['end-time'];
  });

  // Claims with game-won metadata set
  const wonFromMeta = new Set<string>();
  const missingWonRunIds: string[] = [];
  for (const c of completedClaims) {
    const meta = c.metadata as unknown as Record<string, string>;
    const runId = meta['run-id'] ?? '';
    if (meta['game-won'] === 'true') {
      wonFromMeta.add(runId);
    } else if (runId) {
      missingWonRunIds.push(runId);
    }
  }

  // Look up game-won events for claims missing the metadata
  const wonFromEvents = new Set<string>();
  if (missingWonRunIds.length) {
    const wonEvents = await Event.find({
      name: 'game-won',
      'metadata.run-id': { $in: missingWonRunIds },
    }).lean();
    for (const e of wonEvents) {
      const rid = (e.metadata as unknown as Record<string, string>)['run-id'];
      if (rid) wonFromEvents.add(rid);
    }
  }

  const isWin = (c: typeof completedClaims[0]) => {
    const rid = (c.metadata as unknown as Record<string, string>)['run-id'] ?? '';
    return wonFromMeta.has(rid) || wonFromEvents.has(rid);
  };

  const wins = completedClaims.filter(isWin).length;

  const byDifficulty: Record<string, { total: number; wins: number }> = {};
  for (const c of completedClaims) {
    const meta = c.metadata as unknown as Record<string, string>;
    const diff = meta['difficulty'] ?? 'unknown';
    if (!byDifficulty[diff]) byDifficulty[diff] = { total: 0, wins: 0 };
    byDifficulty[diff].total++;
    if (isWin(c)) byDifficulty[diff].wins++;
  }

  const runIdFilter = completedClaims.map((c) => (c.metadata as unknown as Record<string, string>)['run-id']).filter(Boolean);

  // Aggregate card stats from events for the filtered runs
  const cardStatsResult = runIdFilter.length ? await Event.aggregate([
    { $match: {
      'metadata.run-id': { $in: runIdFilter },
      name: { $regex: /^card-(played|bought|available)-/ },
    }},
    { $group: {
      _id: '$name',
      count: { $sum: 1 },
    }},
  ]) : [];

  const cardStats = { played: {} as Record<string, number>, bought: {} as Record<string, number>, available: {} as Record<string, number> };
  for (const r of cardStatsResult) {
    const name = r._id as string;
    if (name.startsWith('card-played-')) cardStats.played[name.slice(12)] = (cardStats.played[name.slice(12)] ?? 0) + (r.count as number);
    else if (name.startsWith('card-bought-')) cardStats.bought[name.slice(12)] = (cardStats.bought[name.slice(12)] ?? 0) + (r.count as number);
    else if (name.startsWith('card-available-')) cardStats.available[name.slice(15)] = (cardStats.available[name.slice(15)] ?? 0) + (r.count as number);
  }

  const nemesis = nemesisResult[0] ? { killer: nemesisResult[0]._id as string, count: nemesisResult[0].count as number } : null;

  return {
    player: name,
    scores: scores.map((s) => ({ key: s.key, value: s.value })),
    recentRuns: { total: completedClaims.length, wins, losses: completedClaims.length - wins, byDifficulty },
    nemesis,
    cardStats,
  };
};
