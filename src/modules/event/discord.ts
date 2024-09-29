import { logger } from '../logger';
import Player from './player.model';
import Event from './event.model';
import { IEvent, NewCreatedEvent, PlayerEvents } from './event.interfaces';
import { EmbedBuilder, EmbedField, WebhookClient } from 'discord.js';
import { Claim } from '../claim';
import { ClaimTypes } from '../claim/claim.interfaces';
import Task from '../task/task.model';

let webhookClient: WebhookClient | null = null;

if (process.env['DISCORD_WEBHOOK_URL']) {
  webhookClient = new WebhookClient({
    url: process.env['DISCORD_WEBHOOK_URL'],
  });
  logger.info(`Discord webhook notifications enabled`);
} else {
  logger.warn(`Missing Discord webhook URL`);
}

export async function notifyDiscord(event: NewCreatedEvent) {
  let message = await getDiscordMessageForEvent(event);
  if (!message) {
    return;
  }

  if (webhookClient) {
    const embeds = [];
    if (event.name.toString() === 'game-won' || event.name.toString() === 'game-lost') {
      embeds.push(...(await getGameEndedEmbeds(event)));
    }

    await webhookClient.send({
      content: message,
      username: 'Dunga-Dunga',
      embeds: embeds,
    });
  }
}

export async function notifyLobby(event: NewCreatedEvent) {
  let message = await getLobbyMessageForEvent(event);
  if (!message) {
    return;
  }

  await Task.create({
    server: 'lobby',
    type: 'broadcast-message',
    arguments: [message],
    state: 'SCHEDULED',
    sourceIP: '127.0.0.1',
  });
}

function getFullRunType(metadata: Map<string, any>) {
  switch (metadata.get('run-type')) {
    case 'c':
      return 'Competitive';
    case 'p':
      return 'Practice';
    default:
      return 'Unknown';
  }
}

function getDeckId(metadata: Map<string, string>) {
  return metadata.get('deck-id')?.substring(1);
}

async function getDiscordMessageForEvent(event: NewCreatedEvent) {
  if (event.player.toLowerCase() === 'tangocam') {
    return;
  }

  const playerNameBold = `**${event.player}**`;

  switch (event.name.toString()) {
    case PlayerEvents.SEEN:
      // 5 minutes ago
      const cutoffDate = new Date(Date.now() - 1000 * 60 * 5);

      const player = await Player.findOne({
        playerName: event.player,
      }).exec();

      if (!player || (!player.lastSeen && player.createdAt >= cutoffDate)) {
        if (event.server === 'lobby') {
          return `${playerNameBold} joined the network for the first time! Welcome! :leaves:`;
        } else {
          return '';
        }
      } else if (!player.lastSeen || player.lastSeen < cutoffDate) {
        return `${playerNameBold} joined the network`;
      } else {
        return '';
      }

    case 'game-won':
      return `${playerNameBold} survived Decked Out! :tada:`;

    case 'game-lost':
      return `${playerNameBold} was defeated by the dungeon <:Ravager:1166890345188040846>`;

    case PlayerEvents.JOINED_QUEUE:
      const metadata = new Map(Object.entries(event.metadata));
      return `${playerNameBold} queued for a ${getFullRunType(metadata)} run (Deck #${getDeckId(metadata)})`;

    case 'difficulty-selected-easy':
    case 'difficulty-selected-medium':
    case 'difficulty-selected-hard':
    case 'difficulty-selected-deadly':
      const difficulty = event.name.toString().split('-')[2];
      return `${playerNameBold} started a run on *${difficulty}* mode!`;
    case 'difficulty-selected-deepfrost':
      return `${playerNameBold} started a run on *DEEPFROST* mode!? Flee with extra flee!!`;
  }

  return '';
}

async function getLobbyMessageForEvent(event: NewCreatedEvent) {
  if (event.player.toLowerCase() === 'tangocam') {
    return;
  }

  const playerName = `${event.player}`;

  switch (event.name.toString()) {
    case PlayerEvents.SEEN:
      // 5 minutes ago
      const cutoffDate = new Date(Date.now() - 1000 * 60 * 5);

      const player = await Player.findOne({
        playerName: event.player,
      }).exec();

      if (!player || (!player.lastSeen && player.createdAt >= cutoffDate)) {
        if (event.server === 'lobby') {
          return `${playerName} joined the network for the first time! Welcome!`;
        } else {
          return '';
        }
      } else {
        return '';
      }

    case 'game-won':
      return `${playerName} survived Decked Out!`;

    case 'game-lost':
      return `${playerName} was defeated by the dungeon`;

    case PlayerEvents.JOINED_QUEUE:
      const metadata = new Map(Object.entries(event.metadata));
      return `${playerName} queued for a ${getFullRunType(metadata)} run (Deck #${getDeckId(metadata)})`;

    case 'difficulty-selected-easy':
    case 'difficulty-selected-medium':
    case 'difficulty-selected-hard':
    case 'difficulty-selected-deadly':
      const difficulty = event.name.toString().split('-')[2];
      return `${playerName} started a run on ${difficulty} mode!`;
    case 'difficulty-selected-deepfrost':
      return `${playerName} started a run on DEEPFROST mode!? Flee with extra flee!!`;
  }

  return '';
}

async function getGameEndedEmbeds(event: NewCreatedEvent): Promise<Array<EmbedBuilder>> {
  logger.debug(`Event metadata: ${JSON.stringify(event.metadata, null, 4)}`);

  const embeds: Array<EmbedBuilder> = [];
  if (!event.metadata) {
    return embeds;
  }

  const metadata = new Map(Object.entries(event.metadata));
  const runId = metadata.get('run-id');
  if (runId) {
    const fields = [];

    fields.push(...(await mapAndCountEvents({
      event, runId,
      title: 'Dangers encountered',
      nameFilterRegex: /(hazard-activated|clank-generated)/,
    })));

    fields.push(...(await mapAndCountEvents({
      event, runId,
      title: 'Cards played',
      nameFilterRegex: /card-played-*/,
      prefixToRemove: 'card-played-',
    })));

    fields.push(...(await mapAndCountEvents({
      event, runId,
      title: 'Cards bought',
      nameFilterRegex: /card-bought-*/,
      prefixToRemove: 'card-bought-',
    })));

    const embed = new EmbedBuilder()
      .setDescription((await getRunDescription(event, runId)))
      .setFields(fields)
      .setColor(0x00ffff);
    embeds.push(embed);
  }

  return embeds;
}

interface MapAndCountEventsParams {
  title: string;
  event: Required<IEvent>;
  runId: string;
  nameFilterRegex: RegExp;
  prefixToRemove?: string;
  inline?: boolean;
}

async function mapAndCountEvents({ title, event, runId, nameFilterRegex, prefixToRemove, inline }: MapAndCountEventsParams): Promise<Array<EmbedField>> {
  const events = await Event.find({
    player: {
      $in: [event.player, '@'],
    },
    name: nameFilterRegex,
    'metadata.run-id': runId,
  }).exec();

  if (events.length > 0) {
    return [{
      name: title,
      value: Array.from(events.map((event: IEvent) => prefixToRemove && event.name.replace(prefixToRemove, '') || event.name)
        .sort()
        .reduce((acc, e) => acc.set(e, (acc.get(e) || 0) + 1), new Map()))
        .map(([k, v]) => `- ${k}: \`${v}\``)
        .join('\n'),
      inline: inline === undefined || inline,
    }];
  }

  return [];
}

async function getRunDescription(event: IEvent, runId: string): Promise<string> {
  const claims = await Claim.find({
    player: event.player,
    type: ClaimTypes.DUNGEON,
    'metadata.run-id': runId,
  }).exec();

  const items = [
    `**Run ID**: ${runId}`,
  ];

  if (claims && claims.length > 0) {
    const claim = claims[0]!!;
    logger.debug(`Claim for run ${runId} is: ${JSON.stringify(claim.metadata, null, 4)}`);

    items.push(...[
      `**Run type**: ${claim.metadata.get('run-type') || 'unknown'}`,
      `**Deck ID**: ${claim.metadata.get('deck-id') || 'unknown'}`,
    ]);
  }

  return items.join('\n');
}
