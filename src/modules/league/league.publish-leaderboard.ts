import logger from '../logger/logger';
import Config from '../config/config.model';

/**
 * Updates the `comp-season/current-phase` config value so that the Citadel
 * LeaderboardTaskRunner picks up the latest phase stats.
 *
 * The in-game leaderboard reads from `playerStatsPhaseN` collections for
 * phases 1..current-phase, so advancing this value makes the new phase's
 * data visible.
 */
export async function publishLeaderboard(
  leagueSlug: string,
  phaseNumber: number
): Promise<void> {
  logger.info(
    `[publish-leaderboard] Setting current-phase to ${phaseNumber} for league "${leagueSlug}"`
  );

  await Config.findOneAndUpdate(
    { entity: 'comp-season', key: 'current-phase' },
    { $set: { value: String(phaseNumber) } },
    { upsert: true }
  ).exec();

  // Ensure the leaderboard is visible
  await Config.findOneAndUpdate(
    { entity: 'lobby', key: 'show-leaderboard' },
    { $set: { value: 'true' } },
    { upsert: true }
  ).exec();

  logger.info(`[publish-leaderboard] Leaderboard updated to phase ${phaseNumber}`);
}
