import mongoose from 'mongoose';
import logger from '../logger/logger';
import { getLeagueBySlug } from './league.service';

/**
 * Computes player stats for a league phase by running an aggregation pipeline
 * on the events collection, filtering by the league's shortId (run-type).
 *
 * Outputs to a collection named `playerStatsPhase${phaseNumber}`.
 */
export async function computePhaseStats(
  leagueSlug: string,
  phaseNumber: number,
  startDate: Date,
  endDate: Date
): Promise<void> {
  const league = await getLeagueBySlug(leagueSlug);
  if (!league) {
    logger.error(`[compute-stats] League "${leagueSlug}" not found`);
    return;
  }

  const runType = league.display.shortId;
  const outputCollection = `playerStatsPhase${phaseNumber}`;
  const db = mongoose.connection.db;

  if (!db) {
    logger.error('[compute-stats] No database connection available');
    return;
  }

  // Drop the output collection if it exists
  const collections = await db.listCollections({ name: outputCollection }).toArray();
  if (collections.length > 0) {
    logger.info(`[compute-stats] Dropping existing collection ${outputCollection}`);
    await db.collection(outputCollection).drop();
  }

  logger.info(
    `[compute-stats] Computing stats for league "${leagueSlug}" phase ${phaseNumber} ` +
      `(run-type: "${runType}", ${startDate.toISOString()} to ${endDate.toISOString()})`
  );

  const pipeline = [
    {
      $match: {
        server: { $regex: /d[0-9]{3}|lobby/ },
        createdAt: {
          $gte: startDate,
          $lt: endDate,
        },
        $or: [
          { name: { $regex: /^game-(won|lost)$/ } },
          { name: 'trade-requested', 'metadata.source-scoreboard': 'competitive-do2.lifetime.escaped.tomes' },
          { name: { $regex: /^difficulty-selected-.*/ } },
        ],
      },
    },
    {
      $lookup: {
        from: 'claims',
        localField: 'metadata.run-id',
        foreignField: 'metadata.run-id',
        as: 'claimDetails',
      },
    },
    {
      $unwind: {
        path: '$claimDetails',
        preserveNullAndEmptyArrays: true,
      },
    },
    // Filter to only include events matching the league's run-type
    {
      $match: {
        'claimDetails.metadata.run-type': runType,
      },
    },
    {
      $group: {
        _id: '$player',
        totalPractice: {
          $sum: { $cond: [{ $eq: ['$claimDetails.metadata.run-type', 'p'] }, 1, 0] },
        },
        totalCompetitive: {
          $sum: { $cond: [{ $eq: ['$claimDetails.metadata.run-type', 'c'] }, 1, 0] },
        },
        totalPracticeWins: {
          $sum: {
            $cond: [
              { $and: [{ $eq: ['$name', 'game-won'] }, { $eq: ['$claimDetails.metadata.run-type', 'p'] }] },
              1,
              0,
            ],
          },
        },
        totalPracticeLosses: {
          $sum: {
            $cond: [
              { $and: [{ $eq: ['$name', 'game-lost'] }, { $eq: ['$claimDetails.metadata.run-type', 'p'] }] },
              1,
              0,
            ],
          },
        },
        totalCompetitiveWins: {
          $sum: {
            $cond: [
              { $and: [{ $eq: ['$name', 'game-won'] }, { $eq: ['$claimDetails.metadata.run-type', 'c'] }] },
              1,
              0,
            ],
          },
        },
        totalCompetitiveLosses: {
          $sum: {
            $cond: [
              { $and: [{ $eq: ['$name', 'game-lost'] }, { $eq: ['$claimDetails.metadata.run-type', 'c'] }] },
              1,
              0,
            ],
          },
        },
        totalTomes: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$name', 'trade-requested'] },
                  { $eq: ['$metadata.source-scoreboard', 'competitive-do2.lifetime.escaped.tomes'] },
                ],
              },
              { $toInt: '$metadata.source-count' },
              0,
            ],
          },
        },
        totalEasyPractice: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$name', 'difficulty-selected-easy'] },
                  { $eq: ['$claimDetails.metadata.run-type', 'p'] },
                ],
              },
              1,
              0,
            ],
          },
        },
        totalMediumPractice: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$name', 'difficulty-selected-medium'] },
                  { $eq: ['$claimDetails.metadata.run-type', 'p'] },
                ],
              },
              1,
              0,
            ],
          },
        },
        totalHardPractice: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$name', 'difficulty-selected-hard'] },
                  { $eq: ['$claimDetails.metadata.run-type', 'p'] },
                ],
              },
              1,
              0,
            ],
          },
        },
        totalDeadlyPractice: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$name', 'difficulty-selected-deadly'] },
                  { $eq: ['$claimDetails.metadata.run-type', 'p'] },
                ],
              },
              1,
              0,
            ],
          },
        },
        totalDeepFrostPractice: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$name', 'difficulty-selected-deepfrost'] },
                  { $eq: ['$claimDetails.metadata.run-type', 'p'] },
                ],
              },
              1,
              0,
            ],
          },
        },
        totalEasyCompetitive: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$name', 'difficulty-selected-easy'] },
                  { $eq: ['$claimDetails.metadata.run-type', 'c'] },
                ],
              },
              1,
              0,
            ],
          },
        },
        totalMediumCompetitive: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$name', 'difficulty-selected-medium'] },
                  { $eq: ['$claimDetails.metadata.run-type', 'c'] },
                ],
              },
              1,
              0,
            ],
          },
        },
        totalHardCompetitive: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$name', 'difficulty-selected-hard'] },
                  { $eq: ['$claimDetails.metadata.run-type', 'c'] },
                ],
              },
              1,
              0,
            ],
          },
        },
        totalDeadlyCompetitive: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$name', 'difficulty-selected-deadly'] },
                  { $eq: ['$claimDetails.metadata.run-type', 'c'] },
                ],
              },
              1,
              0,
            ],
          },
        },
        totalDeepFrostCompetitive: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$name', 'difficulty-selected-deepfrost'] },
                  { $eq: ['$claimDetails.metadata.run-type', 'c'] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
    {
      $addFields: {
        totalPracticeRuns: { $add: ['$totalPracticeWins', '$totalPracticeLosses'] },
        totalCompetitiveRuns: { $add: ['$totalCompetitiveWins', '$totalCompetitiveLosses'] },
      },
    },
    {
      $addFields: {
        totalRuns: { $add: ['$totalPracticeRuns', '$totalCompetitiveRuns'] },
      },
    },
    {
      $project: {
        _id: 0,
        player: '$_id',
        stats: {
          total: '$totalRuns',
          practice: {
            total: '$totalPracticeRuns',
            easy: '$totalEasyPractice',
            medium: '$totalMediumPractice',
            hard: '$totalHardPractice',
            deadly: '$totalDeadlyPractice',
            deepFrost: '$totalDeepFrostPractice',
            wins: '$totalPracticeWins',
            losses: '$totalPracticeLosses',
          },
          competitive: {
            total: '$totalCompetitiveRuns',
            easy: '$totalEasyCompetitive',
            medium: '$totalMediumCompetitive',
            hard: '$totalHardCompetitive',
            deadly: '$totalDeadlyCompetitive',
            deepFrost: '$totalDeepFrostCompetitive',
            wins: '$totalCompetitiveWins',
            losses: '$totalCompetitiveLosses',
          },
          tomesSubmitted: '$totalTomes',
        },
      },
    },
    {
      $out: outputCollection,
    },
  ];

  await db.collection('events').aggregate(pipeline).toArray();

  logger.info(`[compute-stats] Phase ${phaseNumber} stats written to collection "${outputCollection}"`);
}
