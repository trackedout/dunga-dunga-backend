import { logger } from '../logger';
import Player from './player.model';
import Event from './event.model';
import { IEvent, NewCreatedEvent, PlayerEvents } from './event.interfaces';
import { EmbedBuilder, EmbedField, WebhookClient } from 'discord.js';
import { Claim } from '../claim';
import { ClaimTypes, IClaimDoc } from '../claim/claim.interfaces';
import { getEventMetadata, getMetadata } from '../utils'
import Task from '../task/task.model';
import moment from 'moment';

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
    const eventsToEnrich = [
      PlayerEvents.JOINED_QUEUE,
      'game-won',
      'game-lost',
      'difficulty-selected-easy',
      'difficulty-selected-medium',
      'difficulty-selected-hard',
      'difficulty-selected-deadly',
      'difficulty-selected-deepfrost',
    ];
    if (eventsToEnrich.includes(event.name.toString())) {
      embeds.push(...(await getGameEndedEmbeds(event)));
    }

    const options = {
      content: message,
      username: 'Dunga-Dunga',
      embeds: embeds,
    };

    let lastMessageID: string | null = await getDiscordMessageID(event);
    if (lastMessageID) {
      try {
        await webhookClient.editMessage(lastMessageID, options);
      } catch (error) {
        logger.error(`Failed to edit message: ${error}`);
        lastMessageID = null; // Reset if editing fails
      }
    }

    // Either this is the first message, or editing failed
    if (!lastMessageID) {
      const sentMessage = await webhookClient.send(options);
      await storeDiscordMessageID(event, sentMessage.id);
    }
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

async function getDiscordMessageForEvent(event: NewCreatedEvent) {
  if (event.player.toLowerCase() === 'tangocam') {
    return;
  }

  const playerNameBold = `**${event.player}**`;

  switch (event.name.toString()) {
    // This is run before the event handler
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

    // These are run after the event handler
    case 'game-won':
      await storeEndTime(event, new Date());
      return `${playerNameBold} survived Decked Out! :tada:`;

    case 'game-lost':
      await storeEndTime(event, new Date());
      return `${playerNameBold} was defeated by the dungeon <:Ravager:1166890345188040846>`;

    case PlayerEvents.JOINED_QUEUE:
      const metadata = getEventMetadata(event);
      return `${playerNameBold} queued for a ${getFullRunTypeFromMetadata(metadata)} run (Deck #${getDeckId(metadata)})`;

    case 'difficulty-selected-easy':
    case 'difficulty-selected-medium':
    case 'difficulty-selected-hard':
    case 'difficulty-selected-deadly':
      const difficulty = event.name.toString().split('-')[2];
      await storeDifficulty(event, difficulty!!);
      await storeStartTime(event, new Date());
      return `${playerNameBold} started a ${getFullRunTypeFromMetadata(await withClaimMetadata(event))} run on *${difficulty}* mode!`;
    case 'difficulty-selected-deepfrost':
      await storeDifficulty(event, 'deepfrost');
      await storeStartTime(event, new Date());
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
      const metadata = getEventMetadata(event);
      return `${playerName} queued for a ${getFullRunTypeFromMetadata(metadata)} run (Deck #${getDeckId(metadata)})`;

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
  const metadata = await withClaimMetadata(event);

  const embeds: Array<EmbedBuilder> = [];
  if (!metadata || metadata.size === 0) {
    return embeds;
  }

  const runId = metadata.get('run-id');
  if (runId) {
    const fields = [];

    const claim = await findClaim(event);
    const endTime = claim && claim.metadata.get('end-time');
    if (endTime) {
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
    }

    const embed = new EmbedBuilder()
      .setDescription((await getRunDescription(runId, claim)))
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

async function getRunDescription(runId: string, claim: IClaimDoc | null): Promise<string> {
  const items = [
    `**Run ID**: ${runId}`,
  ];

  if (claim) {
    items.push(...[
      `**Run Type**: ${getFullRunType(claim.metadata.get('run-type')) || 'unknown'}`,
//       `**Deck ID**: ${claim.metadata.get('deck-id') || 'unknown'}`,
    ]);

    const difficulty = claim.metadata.get('difficulty');
    if (difficulty) {
      items.push(`**Difficulty**: ${difficulty}`);
    }

    const startTime = claim.metadata.get('start-time');
    const endTime = claim.metadata.get('end-time');
    if (startTime) {
      if (endTime) {
        const diff = (parseInt(endTime) - parseInt(startTime)) * 1000;
        const diffFormatted = moment.utc(diff).format('mm:ss');
        items.push(`**Time**: <t:${startTime}:T> to <t:${endTime}:T> (${diffFormatted})`);
      } else {
        items.push(`**Start Time**: <t:${startTime}:R>`);
      }
    }

  }

  return items.join('\n');
}

function getDeckId(metadata: Map<string, string>) {
  return metadata.get('deck-id')?.substring(1);
}

function getFullRunTypeFromMetadata(metadata: Map<string, any>) {
  return getFullRunType(metadata.get('run-type'));
}

function getFullRunType(runType: String | undefined) {
  switch (runType) {
    case 'c':
      return 'Competitive';
    case 'p':
      return 'Practice';
    default:
      return 'Unknown';
  }
}

async function findClaim(event: IEvent): Promise<IClaimDoc | null> {
  const metadata = getEventMetadata(event);
  const runId = metadata.get('run-id');
  if (!runId) {
      logger.debug(`'metadata.run-id' not set on event, cannot find associated claim`);
      return null;
  }

  const claims = await Claim.find({
    player: event.player,
    type: ClaimTypes.DUNGEON,
    'metadata.run-id': runId,
  }).exec();

  logger.debug(`Found ${claims.length} matching claims for run ${runId}`);
  if (claims && claims.length > 0) {
    const claim = claims[0]!!;
    return claim;
  }

  return null;
}

async function getDiscordMessageID(event: IEvent): Promise<string> {
  const metadata = getEventMetadata(event);
  const runId = metadata.get('run-id');

  const claim = await findClaim(event);
  if (claim) {
    const messageID = claim.metadata.get('discord-message-id') || '';
    logger.debug(`Discord message ID for run ${runId} is ${messageID}`);
    return messageID;
  } else {
    logger.warn(`Could not find Discord message ID for run ${runId}`);
  }

  return '';
}

async function withClaimMetadata(event: IEvent): Promise<Map<string, any>> {
  const eventMetadata = getEventMetadata(event);
  let claimMetadata = getMetadata({});
  const claim = await findClaim(event);
  if (claim) {
    claimMetadata = getMetadata(claim.metadata);
  } else {
    logger.warn(`Could not find claim metadata, returning event metadata only`);
  }

  // Merge claim and event metadata
  const metadata = new Map([...claimMetadata.entries(), ...eventMetadata.entries()]);
  logger.debug(`Merged event metadata: ${JSON.stringify(Object.fromEntries(metadata), null, 4)}`);

  return metadata;
}

async function storeDiscordMessageID(event: IEvent, messageID: String) {
  await setMetadataValue(event, 'discord-message-id', messageID);
}

async function storeDifficulty(event: IEvent, difficulty: String) {
  await setMetadataValue(event, 'difficulty', difficulty);
}

async function storeStartTime(event: IEvent, startTime: Date) {
  await setMetadataValue(event, 'start-time', (startTime.getTime() / 1000 | 0).toString());
}

async function storeEndTime(event: IEvent, endTime: Date) {
  await setMetadataValue(event, 'end-time', (endTime.getTime() / 1000 | 0).toString());
}

async function setMetadataValue(event: IEvent, metadataKey: String, value: String) {
  const metadata = getEventMetadata(event);
  const runId = metadata.get('run-id');
  logger.debug(`Updating 'metadata.${metadataKey}' for run ${runId} to ${value}`);

  const claim = await findClaim(event);
  if (claim) {
    await claim.updateOne({
      [`metadata.${metadataKey}`]: value,
    }).exec();
  }
}
