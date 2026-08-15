import logger from '../logger/logger';
import League from './league.model';
import { ILeagueDoc } from './league.interfaces';

/**
 * Checks all leagues with autoTransition enabled and transitions phases
 * whose end time has passed.
 */
export async function checkPhaseTransitions(): Promise<void> {
  const leagues = await League.find({
    'phaseTransition.autoTransition': true,
    'phases.state': 'ACTIVE',
  }).exec();

  if (leagues.length === 0) {
    logger.debug('No leagues with autoTransition enabled and an active phase');
    return;
  }

  const now = new Date();

  for (const league of leagues) {
    await processLeaguePhaseTransition(league, now);
  }
}

async function processLeaguePhaseTransition(league: ILeagueDoc, now: Date): Promise<void> {
  const activePhase = league.phases.find((p) => p.state === 'ACTIVE');
  if (!activePhase) {
    return;
  }

  const phaseEndTime = new Date(activePhase.end);
  if (now <= phaseEndTime) {
    return;
  }

  logger.info(`[phase-automation] League "${league.slug}" phase ${activePhase.phase} has ended (end: ${activePhase.end}). Transitioning...`);

  // Mark current phase as COMPLETED
  await League.updateOne(
    { _id: league._id, 'phases.phase': activePhase.phase },
    { $set: { 'phases.$.state': 'COMPLETED' } }
  ).exec();

  logger.info(`[phase-automation] League "${league.slug}" phase ${activePhase.phase} marked as COMPLETED`);

  // Find next phase (next sequential NOT_STARTED phase)
  const nextPhase = league.phases
    .filter((p) => p.state === 'NOT_STARTED' && p.phase > activePhase.phase)
    .sort((a, b) => a.phase - b.phase)[0];

  if (nextPhase) {
    await League.updateOne(
      { _id: league._id, 'phases.phase': nextPhase.phase },
      { $set: { 'phases.$.state': 'ACTIVE' } }
    ).exec();

    logger.info(`[phase-automation] League "${league.slug}" phase ${nextPhase.phase} marked as ACTIVE`);
  } else {
    logger.info(`[phase-automation] League "${league.slug}" has no more phases to activate`);
  }

  // Log actions that would be taken
  const actions = league.phaseTransition?.actions || [];
  if (actions.length > 0) {
    logger.info(
      `[phase-automation] League "${league.slug}" phase transition actions (not yet implemented): ${actions.join(', ')}`
    );
  }
}
