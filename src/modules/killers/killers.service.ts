import Event from '../event/event.model';

// Aggregation expression: use killer if known, else strip player name from death-message
const effectiveKiller = {
  $cond: {
    if: { $and: [{ $ne: ['$metadata.killer', 'unknown'] }, { $ne: ['$metadata.killer', ''] }, { $ne: ['$metadata.killer', null] }] },
    then: '$metadata.killer',
    else: {
      $cond: {
        if: { $and: [{ $ne: ['$metadata.death-message', null] }, { $ne: ['$metadata.death-message', ''] }] },
        // Strip leading "<player> " from death message
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

export const getKillers = async (limit: number, runType?: string, since?: string) => {
  const match: Record<string, unknown> = {
    name: 'player-died',
    $or: [
      { 'metadata.killer': { $exists: true, $nin: ['unknown', '', null] } },
      { 'metadata.death-message': { $exists: true, $nin: ['', null] } },
    ],
  };
  if (runType) match['metadata.run-type'] = runType;
  if (since) match['createdAt'] = { $gte: new Date(since) };

  const results = await Event.aggregate([
    { $match: match },
    { $sort: { createdAt: 1 } },
    {
      $group: {
        _id: '$metadata.run-id',
        killer: { $first: effectiveKiller },
        killerType: { $first: '$metadata.killer-type' },
        player: { $first: '$player' },
      },
    },
    { $match: { killer: { $nin: [null, '', 'unknown'] } } },
    {
      $group: {
        _id: { killer: '$killer', killerType: '$killerType' },
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
    { $limit: limit },
    { $project: { _id: 0, killer: '$_id.killer', killerType: '$_id.killerType', count: 1 } },
  ]);

  return { results };
};

export const getKillerDetail = async (killer: string, runType?: string, since?: string) => {
  const match: Record<string, unknown> = {
    name: 'player-died',
    $or: [
      { 'metadata.killer': killer },
      {
        'metadata.killer': { $in: ['unknown', '', null] },
        'metadata.death-message': { $regex: `^${killer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
      },
      // Also match messages that start with "<player> <killer>"
      {
        'metadata.killer': { $in: ['unknown', '', null] },
        'metadata.death-message': { $regex: killer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' },
      },
    ],
  };
  if (runType) match['metadata.run-type'] = runType;
  if (since) match['createdAt'] = { $gte: new Date(since) };

  const results = await Event.aggregate([
    { $match: match },
    // Filter to only events where effectiveKiller matches
    { $addFields: { effectiveKiller } },
    { $match: { effectiveKiller: killer } },
    { $sort: { createdAt: 1 } },
    {
      $group: {
        _id: '$metadata.run-id',
        player: { $first: '$player' },
        killerType: { $first: '$metadata.killer-type' },
      },
    },
    {
      $group: {
        _id: '$player',
        count: { $sum: 1 },
        killerType: { $first: '$killerType' },
      },
    },
    { $sort: { count: -1 } },
    { $project: { _id: 0, player: '$_id', count: 1, killerType: 1 } },
  ]);

  const total = results.reduce((sum: number, r: { count: number }) => sum + r.count, 0);
  return { killer, results, total };
};
