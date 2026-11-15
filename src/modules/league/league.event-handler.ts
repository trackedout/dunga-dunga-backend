import { getLeagueByRunType } from './league.service';
import { IEventAction, ILeagueDoc } from './league.interfaces';
import Score from '../score/score.model';
import Card from '../card/card.model';
import Config from '../config/config.model';
import logger from '../logger/logger';

export async function executeLeagueEventHandlers(
  eventName: string,
  playerName: string,
  metadata: Map<string, string>
): Promise<void> {
  const runType = metadata.get('slug');
  if (!runType) return;

  const league = await getLeagueByRunType(runType);
  if (!league) return;

  const matchingHandlers = league.eventHandlers.filter((h) => h.trigger.event === eventName);

  for (const handler of matchingHandlers) {
    logger.info(`[event-handler] Executing handler '${handler.id}' for player ${playerName}`);
    for (const action of handler.actions) {
      await executeAction(action, playerName, league);
    }
  }
}

async function executeAction(action: IEventAction, playerName: string, league: ILeagueDoc): Promise<void> {
  switch (action.type) {
    case 'reset-deck':
      await resetDeck(playerName, league);
      break;
    case 'reset-scoreboard':
      await resetScoreboard(playerName, league.slug, action.scoreboard!, action.value!);
      break;
    case 'reset-scoreboards':
      await resetScoreboards(playerName, league.slug, action.pattern!, action.value!);
      break;
    case 'store-best-scores':
      await storeBestScores(playerName, league.slug, action.sourcePattern!, action.targetPrefix!);
      break;
    case 'set-filter-mode':
      await setFilterMode(playerName, league);
      break;
    default:
      logger.info(`[event-handler] Unknown action type: ${action.type}`);
  }
}

async function resetDeck(playerName: string, league: ILeagueDoc): Promise<void> {
  const deckType = league.slug;
  logger.info(`[event-handler] Resetting deck '${deckType}' for ${playerName}`);
  await Card.deleteMany({ player: playerName, deckType }).exec();
  await ensureDeckIsSeeded(playerName, league);
}

async function ensureDeckIsSeeded(playerName: string, league: ILeagueDoc): Promise<void> {
  const existing = await Card.findOne({ player: playerName, deckType: league.slug }).exec();
  if (!existing) {
    logger.info(`[event-handler] Seeding default cards for ${playerName} in deck '${league.slug}'`);
    for (const cardName of league.deck.defaultCards) {
      await Card.create({ name: cardName, player: playerName, server: 'lobby', deckType: league.slug });
    }
  }
}

// Every score action is scoped to the league's own namespace (slug), so a
// handler can never touch another league's scores.
async function resetScoreboard(playerName: string, slug: string, scoreboard: string, value: number): Promise<void> {
  logger.info(`[event-handler] Resetting scoreboard '${slug}/${scoreboard}' to ${value} for ${playerName}`);
  await Score.updateOne({ player: playerName, slug, key: scoreboard }, { $set: { value } }, { upsert: true }).exec();
}

async function resetScoreboards(playerName: string, slug: string, pattern: string, value: number): Promise<void> {
  logger.info(`[event-handler] Resetting scoreboards in '${slug}' matching '${pattern}' to ${value} for ${playerName}`);
  await Score.updateMany({ player: playerName, slug, key: { $regex: new RegExp(pattern) } }, { $set: { value } }).exec();
}

async function storeBestScores(playerName: string, slug: string, sourcePattern: string, targetPrefix: string): Promise<void> {
  logger.info(`[event-handler] Storing best scores in '${slug}' for ${playerName} (source: '${sourcePattern}', target: '${targetPrefix}')`);
  const scores = await Score.find({ player: playerName, slug, key: { $regex: new RegExp(sourcePattern) } }).exec();

  for (const score of scores) {
    const targetKey = score.key.replace(new RegExp(sourcePattern), targetPrefix);
    const existing = await Score.findOne({ player: playerName, slug, key: targetKey }).exec();

    if (!existing || score.value > existing.value) {
      await Score.updateOne({ player: playerName, slug, key: targetKey }, { $set: { value: score.value } }, { upsert: true }).exec();
    }
  }
}

async function setFilterMode(playerName: string, league: ILeagueDoc): Promise<void> {
  // Run mode is the league slug, stored per-player in the `filter-mode-slug`
  // config (the numeric filter-mode-id scoreboard was dropped — it was ambiguous
  // since all season-N leagues share runTypeId 2). Citadel reads this config.
  logger.info(`[event-handler] Setting filter-mode-slug to ${league.slug} for ${playerName}`);
  await Config.updateOne(
    { entity: playerName, key: 'filter-mode-slug' },
    { $set: { value: league.slug } },
    { upsert: true }
  ).exec();
}
