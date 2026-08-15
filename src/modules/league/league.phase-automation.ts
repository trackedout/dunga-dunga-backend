import logger from '../logger/logger';
import League from './league.model';
import LeaguePhaseState from './league-phase.model';
import { computePhaseStats } from './league.stats';
import { allocateShards } from './league.allocate-shards';
import { publishLeaderboard } from './league.publish-leaderboard';
import { notifyPlayers } from './league.notify-players';

/**
 * Checks all leagues with autoTransition enabled and transitions phases
 * whose end time has passed.
 *
 * Phase schedule (start/end) lives in the league document.
 * Phase state (ACTIVE/COMPLETED/NOT_STARTED) lives in leaguePhaseStates collection.
 */
export async function checkPhaseTransitions(): Promise<void> {
  const leagues = await League.find({ 'phaseTransition.autoTransition': true }).exec();

  if (leagues.length === 0) {
    return;
  }

  const now = new Date();

  for (const league of leagues) {
    if (!league.phases || league.phases.length === 0) {
      continue;
    }

    // Get current phase states for this league
    const phaseStates = await LeaguePhaseState.find({ leagueSlug: league.slug }).exec();
    const stateMap = new Map(phaseStates.map((ps) => [ps.phase, ps.state]));

    // Find the active phase
    const activePhaseNum = [...stateMap.entries()].find(([_, state]) => state === 'ACTIVE')?.[0];
    if (activePhaseNum === undefined) {
      continue;
    }

    // Get the phase config (schedule) from the league
    const activePhaseConfig = league.phases.find((p) => p.phase === activePhaseNum);
    if (!activePhaseConfig) {
      continue;
    }

    const phaseEndTime = new Date(activePhaseConfig.end);
    if (now <= phaseEndTime) {
      continue;
    }

    logger.info(
      `[phase-automation] League "${league.slug}" phase ${activePhaseNum} has ended (end: ${activePhaseConfig.end}). Transitioning...`
    );

    // Mark current phase as COMPLETED
    await LeaguePhaseState.updateOne(
      { leagueSlug: league.slug, phase: activePhaseNum },
      { $set: { state: 'COMPLETED' } }
    ).exec();

    logger.info(`[phase-automation] League "${league.slug}" phase ${activePhaseNum} marked as COMPLETED`);

    // Find the next phase config (by phase number)
    const nextPhaseConfig = league.phases
      .filter((p) => p.phase > activePhaseNum)
      .sort((a, b) => a.phase - b.phase)[0];

    if (nextPhaseConfig) {
      // Ensure state doc exists for next phase, then mark ACTIVE
      await LeaguePhaseState.updateOne(
        { leagueSlug: league.slug, phase: nextPhaseConfig.phase },
        { $set: { state: 'ACTIVE' } },
        { upsert: true }
      ).exec();

      logger.info(`[phase-automation] League "${league.slug}" phase ${nextPhaseConfig.phase} marked as ACTIVE`);
    } else {
      logger.info(`[phase-automation] League "${league.slug}" has no more phases to activate`);
    }

    // Execute phase transition actions
    const actions = league.phaseTransition?.actions || [];
    const nextPhaseNum = nextPhaseConfig?.phase ?? null;

    for (const action of actions) {
      try {
        switch (action) {
          case 'compute-stats': {
            const phaseStart = new Date(activePhaseConfig.start);
            const phaseEnd = new Date(activePhaseConfig.end);
            logger.info(
              `[phase-automation] Running compute-stats for league "${league.slug}" phase ${activePhaseNum}`
            );
            await computePhaseStats(league.slug, activePhaseNum, phaseStart, phaseEnd);
            break;
          }
          case 'allocate-shards': {
            if (!nextPhaseConfig) {
              logger.info(`[phase-automation] Skipping allocate-shards — no next phase`);
              break;
            }
            logger.info(
              `[phase-automation] Running allocate-shards for league "${league.slug}" phase ${nextPhaseConfig.phase}`
            );
            await allocateShards(league.slug, nextPhaseConfig.phase);
            break;
          }
          case 'publish-leaderboard': {
            logger.info(
              `[phase-automation] Running publish-leaderboard for league "${league.slug}" phase ${activePhaseNum}`
            );
            await publishLeaderboard(league.slug, activePhaseNum);
            break;
          }
          case 'notify-players': {
            logger.info(
              `[phase-automation] Running notify-players for league "${league.slug}"`
            );
            await notifyPlayers(league.slug, activePhaseNum, nextPhaseNum);
            break;
          }
          default:
            logger.warn(`[phase-automation] Unknown action "${action}" for league "${league.slug}"`);
        }
      } catch (err) {
        logger.error(`[phase-automation] Action "${action}" failed for league "${league.slug}": ${err}`);
      }
    }
  }
}
