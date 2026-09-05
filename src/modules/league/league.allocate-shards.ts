import mongoose from 'mongoose';
import logger from '../logger/logger';
import Score from '../score/score.model';
import Event from '../event/event.model';
import { getLeagueBySlug } from './league.service';
import { asMap } from '../utils';

interface PlayerAllocation {
  player: string;
  remainingShards: number;
  totalCompRuns: number;
  totalEscapedEmbers: number;
  potentialEmberValue: number;
  shardsToAllocatePreCap: number;
  shardsToAllocate: number;
}

/**
 * Allocates shards to players based on the ember-potential formula.
 *
 * Formula:
 *   potentialEmberValue = totalEscapedEmbers + (totalEscapedEmbers / totalCompRuns) * remainingShards
 *   shardsToAllocatePreCap = 17 - (pev - min) / (max - min) * 10
 *   shardsToAllocate = min(22, remainingShards + shardsToAllocatePreCap) - remainingShards
 *
 * Players with zero competitive runs get zero shards.
 * Allocation is delivered via trade-requested events that the backend processes.
 */
export async function allocateShards(
  leagueSlug: string,
  phaseNumber: number
): Promise<void> {
  const league = await getLeagueBySlug(leagueSlug);
  if (!league) {
    logger.error(`[allocate-shards] League "${leagueSlug}" not found`);
    return;
  }

  const excludedPlayers = new Set(league.phaseTransition?.excludedPlayers || []);

  // items is a Mongoose Map at runtime but typed as Record
  const items = asMap(league.items);
  const shardItem = items.get('shards');
  if (!shardItem || !shardItem.scoreboard) {
    logger.error(`[allocate-shards] League "${leagueSlug}" has no shards scoreboard defined`);
    return;
  }

  const shardKey: string = shardItem.scoreboard;

  const emberItem = items.get('embers');
  if (!emberItem || !emberItem.scoreboard) {
    logger.error(`[allocate-shards] League "${leagueSlug}" has no embers scoreboard defined`);
    return;
  }

  const emberKey: string = emberItem.scoreboard;

  // Get all players with shards in this league
  const shardScores = await Score.find({ key: shardKey }).exec();
  // Get all players' ember scores
  const emberScores = await Score.find({ key: emberKey }).exec();
  const emberMap = new Map(emberScores.map((s) => [s.player, s.value]));

  // Get competitive run counts from the latest phase stats
  const db = mongoose.connection.db;
  if (!db) {
    logger.error('[allocate-shards] No database connection');
    return;
  }

  // Sum comp runs across all completed phases
  const completedPhases = league.phases?.filter((p) => p.phase < phaseNumber) || [];
  const compRunsMap = new Map<string, number>();

  for (const phase of completedPhases) {
    const collection = db.collection(`playerStatsPhase${phase.phase}`);
    const stats = await collection.find({}).toArray();
    for (const stat of stats) {
      const player = stat['player'] as string;
      const compTotal = (stat['stats'] as any)?.competitive?.total || 0;
      const existing = compRunsMap.get(player) || 0;
      compRunsMap.set(player, existing + compTotal);
    }
  }

  // Build player data for all players who have shards (excluding ignored players)
  const players: PlayerAllocation[] = shardScores
    .filter((score) => !excludedPlayers.has(score.player))
    .map((score) => {
    const remainingShards = score.value;
    const totalCompRuns = compRunsMap.get(score.player) || 0;
    const totalEscapedEmbers = emberMap.get(score.player) || 0;

    const potentialEmberValue =
      totalCompRuns === 0
        ? 0
        : totalEscapedEmbers + (totalEscapedEmbers / totalCompRuns) * remainingShards;

    return {
      player: score.player,
      remainingShards,
      totalCompRuns,
      totalEscapedEmbers,
      potentialEmberValue,
      shardsToAllocatePreCap: 0,
      shardsToAllocate: 0,
    };
  });

  // Filter to players who have actually played
  const activePlayers = players.filter((p) => p.totalCompRuns > 0 && p.potentialEmberValue > 50);
  const allPEV = activePlayers.map((p) => p.potentialEmberValue);

  if (allPEV.length === 0) {
    logger.info(`[allocate-shards] No active players found for league "${leagueSlug}"`);
    return;
  }

  const minPEV = Math.min(...allPEV);
  const maxPEV = Math.max(...allPEV);
  const range = maxPEV - minPEV || 1; // Avoid division by zero

  // Calculate allocations
  for (const player of players) {
    if (player.totalCompRuns === 0) {
      player.shardsToAllocatePreCap = 0;
      player.shardsToAllocate = 0;
      continue;
    }

    player.shardsToAllocatePreCap = 17 - ((player.potentialEmberValue - minPEV) / range) * 10;
    player.shardsToAllocate = Math.round(
      Math.min(22, player.remainingShards + player.shardsToAllocatePreCap) - player.remainingShards
    );

    // Never take shards away
    if (player.shardsToAllocate < 0) {
      player.shardsToAllocate = 0;
    }
  }

  const toAllocate = players.filter((p) => p.shardsToAllocate > 0);
  logger.info(
    `[allocate-shards] Allocating shards to ${toAllocate.length} players for league "${leagueSlug}" phase ${phaseNumber}`
  );

  // Create trade-requested events to give shards
  for (const player of toAllocate) {
    await Event.create({
      name: 'trade-requested',
      server: 'lobby',
      player: player.player,
      count: 1,
      x: 0,
      y: 0,
      z: 0,
      metadata: {
        slug: league.slug,
        'source-scoreboard': '',
        'source-inversion-scoreboard': '',
        'source-count': '0',
        'target-scoreboard': shardKey,
        'target-count': String(player.shardsToAllocate),
        'reason': `Phase ${phaseNumber} start`,
      },
      sourceIP: '127.0.0.1',
    });

    logger.info(
      `[allocate-shards] ${player.player}: +${player.shardsToAllocate} shards (PEV=${player.potentialEmberValue.toFixed(0)}, remaining=${player.remainingShards})`
    );
  }
}
