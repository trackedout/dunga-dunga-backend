import { getLeagueByShortId } from './league.service';
import { IEventAction, ILeagueDoc } from './league.interfaces';
import Score from '../score/score.model';
import Card from '../card/card.model';
import logger from '../logger/logger';

const RUN_TYPE_ID_MAP: Record<string, number> = { p: 1, c: 2, h: 3 };

export async function executeLeagueEventHandlers(
  eventName: string,
  playerName: string,
  metadata: Map<string, string>
): Promise<void> {
  const runType = metadata.get('run-type');
  if (!runType) return;

  const league = await getLeagueByShortId(runType);
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
      await resetScoreboard(playerName, action.scoreboard!, action.value!);
      break;
    case 'reset-scoreboards':
      await resetScoreboards(playerName, action.pattern!, action.value!);
      break;
    case 'store-best-scores':
      await storeBestScores(playerName, action.sourcePattern!, action.targetPrefix!);
      break;
    case 'set-filter-mode':
      await setFilterMode(playerName, league);
      break;
    default:
      logger.info(`[event-handler] Unknown action type: ${action.type}`);
  }
}

async function resetDeck(playerName: string, league: ILeagueDoc): Promise<void> {
  const deckPrefix = league.deck.prefix;
  logger.info(`[event-handler] Resetting deck '${deckPrefix}' for ${playerName}`);
  await Card.deleteMany({ player: playerName, deckType: deckPrefix }).exec();
  await ensureDeckIsSeeded(playerName, league);
}

async function ensureDeckIsSeeded(playerName: string, league: ILeagueDoc): Promise<void> {
  const existing = await Card.findOne({ player: playerName, deckType: league.deck.prefix }).exec();
  if (!existing) {
    logger.info(`[event-handler] Seeding default cards for ${playerName} in deck '${league.deck.prefix}'`);
    for (const cardName of league.deck.defaultCards) {
      await Card.create({ name: cardName, player: playerName, server: 'lobby', deckType: league.deck.prefix });
    }
  }
}

async function resetScoreboard(playerName: string, scoreboard: string, value: number): Promise<void> {
  logger.info(`[event-handler] Resetting scoreboard '${scoreboard}' to ${value} for ${playerName}`);
  await Score.updateOne({ player: playerName, key: scoreboard }, { $set: { value } }, { upsert: true }).exec();
}

async function resetScoreboards(playerName: string, pattern: string, value: number): Promise<void> {
  logger.info(`[event-handler] Resetting scoreboards matching '${pattern}' to ${value} for ${playerName}`);
  await Score.updateMany({ player: playerName, key: { $regex: new RegExp(pattern) } }, { $set: { value } }).exec();
}

async function storeBestScores(playerName: string, sourcePattern: string, targetPrefix: string): Promise<void> {
  logger.info(`[event-handler] Storing best scores for ${playerName} (source: '${sourcePattern}', target: '${targetPrefix}')`);
  const scores = await Score.find({ player: playerName, key: { $regex: new RegExp(sourcePattern) } }).exec();

  for (const score of scores) {
    const targetKey = score.key.replace(new RegExp(sourcePattern), targetPrefix);
    const existing = await Score.findOne({ player: playerName, key: targetKey }).exec();

    if (!existing || score.value > existing.value) {
      await Score.updateOne({ player: playerName, key: targetKey }, { $set: { value: score.value } }, { upsert: true }).exec();
    }
  }
}

async function setFilterMode(playerName: string, league: ILeagueDoc): Promise<void> {
  const runTypeId = RUN_TYPE_ID_MAP[league.display.shortId] ?? league.display.shortId.charCodeAt(0);
  logger.info(`[event-handler] Setting filter-mode-id to ${runTypeId} for ${playerName}`);
  await Score.updateOne(
    { player: playerName, key: 'do2.inventory.filter-mode-id' },
    { $set: { value: runTypeId } },
    { upsert: true }
  ).exec();
}
