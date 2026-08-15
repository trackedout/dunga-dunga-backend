import logger from '../logger/logger';
import { notifyOps } from '../task';

/**
 * Notifies all online players (via ops broadcast) that a phase has transitioned.
 * Creates a task document that Citadel picks up and broadcasts in-game.
 */
export async function notifyPlayers(
  leagueSlug: string,
  completedPhase: number,
  nextPhase: number | null
): Promise<void> {
  const message = nextPhase
    ? `[${leagueSlug}] Phase ${completedPhase} has ended! Phase ${nextPhase} is now active.`
    : `[${leagueSlug}] Phase ${completedPhase} has ended! The season is now complete.`;

  logger.info(`[notify-players] Broadcasting: ${message}`);
  await notifyOps(message, 'lobby');
}
