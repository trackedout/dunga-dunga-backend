import Event from '../event/event.model';
import Config from '../config/config.model';

const cache = new Map<string, { data: unknown; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000;

export const getStats = async (runType?: string, since?: string, until?: string, phase?: number) => {
  const key = `${runType ?? ''}|${since ?? ''}|${until ?? ''}|${phase ?? ''}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  const match: Record<string, unknown> = {
    name: { $in: ['game-won', 'game-lost'] },
    server: { $ne: 'builders' },
  };

  if (phase != null) {
    const entity = `phase-${phase}`;
    const phaseDocs = await Config.find({ entity, key: { $in: ['start-time', 'end-time'] } }).lean();
    const startDoc = phaseDocs.find((d) => d.key === 'start-time');
    const endDoc = phaseDocs.find((d) => d.key === 'end-time');
    const dateFilter: Record<string, Date> = {};
    if (startDoc) dateFilter['$gte'] = new Date(startDoc.value);
    if (endDoc) dateFilter['$lte'] = new Date(endDoc.value);
    if (Object.keys(dateFilter).length) match['createdAt'] = dateFilter;
    match['metadata.run-type'] = { $in: ['c', 'competitive'] };
  } else {
    if (runType) {
      const longForm = { p: 'practice', c: 'competitive', h: 'hardcore' }[runType] ?? runType;
      match['metadata.run-type'] = { $in: [runType, longForm] };
    }
    const dateFilter: Record<string, Date> = {};
    if (since) dateFilter['$gte'] = new Date(since);
    if (until) dateFilter['$lt'] = new Date(until);
    if (Object.keys(dateFilter).length) match['createdAt'] = dateFilter;
  }

  const results = await Event.aggregate([
    { $match: match },
    { $sort: { createdAt: 1 } },
    {
      $group: {
        _id: '$metadata.run-id',
        outcome: { $last: '$name' },
        player: { $first: '$player' },
      },
    },
    {
      $lookup: {
        from: 'claims',
        let: { rid: '$_id' },
        pipeline: [
          { $match: { $expr: { $eq: ['$metadata.run-id', '$$rid'] } } },
          { $limit: 1 },
          { $project: { _id: 0, difficulty: '$metadata.difficulty' } },
        ],
        as: '_claim',
      },
    },
    { $addFields: { difficulty: { $arrayElemAt: ['$_claim.difficulty', 0] } } },
    {
      $facet: {
        totals: [
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              wins: { $sum: { $cond: [{ $eq: ['$outcome', 'game-won'] }, 1, 0] } },
            },
          },
        ],
        byDifficulty: [
          { $match: { difficulty: { $ne: null } } },
          {
            $group: {
              _id: '$difficulty',
              total: { $sum: 1 },
              wins: { $sum: { $cond: [{ $eq: ['$outcome', 'game-won'] }, 1, 0] } },
            },
          },
          { $sort: { total: -1 } },
          { $project: { _id: 0, difficulty: '$_id', total: 1, wins: 1 } },
        ],
        byPlayer: [
          {
            $group: {
              _id: '$player',
              runs: { $sum: 1 },
              wins: { $sum: { $cond: [{ $eq: ['$outcome', 'game-won'] }, 1, 0] } },
              easy: { $sum: { $cond: [{ $eq: ['$difficulty', 'easy'] }, 1, 0] } },
              medium: { $sum: { $cond: [{ $eq: ['$difficulty', 'medium'] }, 1, 0] } },
              hard: { $sum: { $cond: [{ $eq: ['$difficulty', 'hard'] }, 1, 0] } },
              deadly: { $sum: { $cond: [{ $eq: ['$difficulty', 'deadly'] }, 1, 0] } },
              deepfrost: { $sum: { $cond: [{ $eq: ['$difficulty', 'deepfrost'] }, 1, 0] } },
            },
          },
          { $sort: { runs: -1 } },
          { $project: { _id: 0, player: '$_id', runs: 1, wins: 1, easy: 1, medium: 1, hard: 1, deadly: 1, deepfrost: 1 } },
        ],
      },
    },
  ]);

  const facet = results[0];
  const data = {
    total: facet.totals[0]?.total ?? 0,
    wins: facet.totals[0]?.wins ?? 0,
    byDifficulty: facet.byDifficulty,
    byPlayer: facet.byPlayer,
  };

  cache.set(key, { data, ts: Date.now() });
  return data;
};
