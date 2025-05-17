import { logger } from '../logger';
import Player from './player.model';
import Event from './event.model';
import { IEvent, PlayerEvents, ServerEvents } from './event.interfaces';
import DungeonInstance from './instance.model';
import { EmbedBuilder, EmbedField, WebhookClient } from 'discord.js';
import { Claim } from '../claim';
import { ClaimTypes, IClaimDoc } from '../claim/claim.interfaces';
import { EventMetadataContainer, getEventMetadata, getMetadata } from '../utils';
import Task from '../task/task.model';
import moment from 'moment';
import { notifyPlayer } from '../task';

let webhookClient: WebhookClient | null = null;

export interface EventWithServer {
  name: string;
  player: string;
  server: string;
}

interface EventPlayerContainer {
  player: string;
}

export type ClaimRelatedEvent = EventMetadataContainer & EventPlayerContainer;

interface InvalidatedEvent {
  invalidationReason?: string;
}

if (process.env['DISCORD_WEBHOOK_URL']) {
  webhookClient = new WebhookClient({
    url: process.env['DISCORD_WEBHOOK_URL'],
  });
  logger.info(`Discord webhook notifications enabled`);
} else {
  logger.warn(`Missing Discord webhook URL`);
}

export async function notifyDiscord(event: EventWithServer & ClaimRelatedEvent & InvalidatedEvent) {
  let message = await getDiscordMessageForEvent(event);

  if (webhookClient) {
    const embeds = [];
    // Supports both strings and regexes
    const eventsToEnrich = [
      PlayerEvents.JOINED_QUEUE,
      /game-*/,
      /difficulty-selected-*/,
      /card-bought-.*/,
      ServerEvents.CLAIM_INVALIDATED,
      PlayerEvents.PLAYER_DIED,
    ];

    // Only edit messages for some events, notably excluding things like 'played-seen'
    const eventsToEdit = [...eventsToEnrich];

    if (eventsToEnrich.some((e) => (typeof e === 'string' ? e === event.name : e.test(event.name)))) {
      embeds.push(...(await getGameEndedEmbeds(event)));
    }

    let options: {
      content?: string;
      username: string;
      embeds: Array<EmbedBuilder>;
    } = {
      username: 'Dunga-Dunga',
      embeds: embeds,
    };

    if (message) {
      options.content = message;
    }

    let lastMessageID: string | null = null;
    if (eventsToEdit.some((e) => (typeof e === 'string' ? e === event.name : e.test(event.name)))) {
      lastMessageID = await getDiscordMessageID(event);
      if (lastMessageID) {
        try {
          await webhookClient.editMessage(lastMessageID, options);
        } catch (error) {
          logger.error(`Failed to edit message: ${error}`);
          lastMessageID = null; // Reset if editing fails
        }
      }
    }

    // Either this is the first message, or editing failed
    if (!lastMessageID && message) {
      const sentMessage = await webhookClient.send(options);
      await storeDiscordMessageID(event, sentMessage.id);
    }
  }
}

export async function notifyLobby(event: EventWithServer & ClaimRelatedEvent) {
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

  const instances = await DungeonInstance.find({}).exec();
  for (let instance of instances) {
    await Task.create({
      server: instance.name,
      type: 'broadcast-message',
      arguments: [message],
      state: 'SCHEDULED',
      sourceIP: '127.0.0.1',
    });
  }
}

async function getDiscordMessageForEvent(event: EventWithServer & ClaimRelatedEvent & InvalidatedEvent) {
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

      // 2 weeks ago
      const cutoffDateForDiscordReminder = new Date(Date.now() - 1000 * 60 * 60 * 24 * 14);
      if (!player || ((!player.lastSeen || player.lastSeen < cutoffDate) && player.createdAt >= cutoffDateForDiscordReminder)) {
        const link = `<aqua><click:open_url:'https://discord.gg/XzxzcFEa4S'>https://discord.gg/XzxzcFEa4S</click></aqua>`;
        await notifyPlayer(event.player, `<gray>Do you know we have a Discord server? Join here:</gray> ${link}`);
      }

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
      await storeGameWon(event);
      return `[${await getFullRunTypeWithClaim(event)}] ${playerNameBold} survived Decked Out! :tada:`;

    case 'game-lost':
      await storeEndTime(event, new Date());
      const killer = await getKiller(event);
      const extra = killer && killer !== 'unknown' ? ` (specifically by ${killer})` : '';
      return `[${await getFullRunTypeWithClaim(event)}] ${playerNameBold} was defeated by the dungeon${extra} <:Ravager:1166890345188040846>`;

    case PlayerEvents.PLAYER_DIED: {
      const killer = getEventMetadata(event).get('killer');
      if (killer && killer !== 'unknown') {
        await storeKiller(event, killer);
      }

      const deathMessage = getEventMetadata(event).get('death-message');
      if (deathMessage && !deathMessage.includes('slain by nothing')) {
        await storeDeathMessage(event, deathMessage);
      }

      return '';
    }

    case PlayerEvents.JOINED_QUEUE:
      const metadata = getEventMetadata(event);
      return `[${getFullRunTypeFromMetadata(metadata)}] ${playerNameBold} queued for a run (Deck #${getDeckId(metadata)})`;

    case ServerEvents.CLAIM_INVALIDATED:
      const claim = await findClaim(event);
      if (claim && claim.metadata.get('end-time')) {
        return ''; // Skip processing if the game had already ended
      }

      await storeEndTime(event, new Date());
      return `[${await getFullRunTypeWithClaim(event)}] ${playerNameBold}'s dungeon claim has been invalidated :warning: \n**Reason**: \`${event.invalidationReason}\``;

    case 'difficulty-selected-easy':
    case 'difficulty-selected-medium':
    case 'difficulty-selected-hard':
    case 'difficulty-selected-deadly':
      const difficulty = event.name.toString().split('-')[2];
      await storeDifficulty(event, difficulty!!);
      await storeStartTime(event, new Date());
      return `[${await getFullRunTypeWithClaim(event)}] ${playerNameBold} started a run on *${difficulty}* mode!`;
    case 'difficulty-selected-deepfrost':
      await storeDifficulty(event, 'deepfrost');
      await storeStartTime(event, new Date());
      return `[${await getFullRunTypeWithClaim(event)}] ${playerNameBold} started a run on *DEEPFROST* mode!? Flee with extra flee!!`;
  }

  return '';
}

async function getLobbyMessageForEvent(event: EventWithServer & ClaimRelatedEvent) {
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
      return `[${await getFullRunTypeWithClaim(event)}] ${playerName} survived Decked Out!`;

    // case 'game-lost':
    //   const killer = await getKiller(event);
    //   const extra = killer && killer !== 'unknown' ? ` (specifically by ${killer})` : '';
    //   return `[${await getFullRunTypeWithClaim(event)}] ${playerName} was defeated by the dungeon${extra}`;

    case PlayerEvents.PLAYER_DIED: {
      const metadata = getEventMetadata(event);
      const deathMessage = metadata.get('death-message');
      if (!deathMessage) {
        return '';
      }

      const claim = await findClaim(event);
      if (claim && claim.metadata.get('end-time')) {
        // if game ended more than 10 seconds ago, don't send message
        if (new Date(parseInt(claim.metadata.get('end-time') || '0') * 1000) < new Date(Date.now() - 1000 * 10)) {
          return '';
        }
      }

      return `[${await getFullRunTypeWithClaim(event)}] ${deathMessage}`;
    }

    case PlayerEvents.JOINED_QUEUE:
      const metadata = getEventMetadata(event);
      return `[${getFullRunTypeFromMetadata(metadata)}] ${playerName} queued for a run (Deck #${getDeckId(metadata)})`;

    case 'difficulty-selected-easy':
    case 'difficulty-selected-medium':
    case 'difficulty-selected-hard':
    case 'difficulty-selected-deadly':
      const difficulty = event.name.toString().split('-')[2];
      return `[${await getFullRunTypeWithClaim(event)}] ${playerName} started a run on ${difficulty} mode!`;
    case 'difficulty-selected-deepfrost':
      return `[${await getFullRunTypeWithClaim(event)}] ${playerName} started a run on DEEPFROST mode!? Flee with extra flee!!`;
  }

  return '';
}

async function getGameEndedEmbeds(event: EventWithServer & ClaimRelatedEvent): Promise<Array<EmbedBuilder>> {
  const metadata = await withClaimMetadata(event);

  const embeds: Array<EmbedBuilder> = [];
  if (!metadata || metadata.size === 0) {
    return embeds;
  }

  const runId = metadata.get('run-id');
  if (runId) {
    const fields = [];

    const claim = await findClaim(event);
    const endTime = metadata.get('end-time');

    if (endTime || event.name === ServerEvents.CLAIM_INVALIDATED) {
      fields.push(
        ...(await mapAndCountEvents({
          runId,
          playerName: event.player,
          title: 'Dangers encountered',
          nameFilterRegex: /(hazard-activated|clank-generated)/,
        }))
      );

      fields.push(
        ...(await mapAndCountEvents({
          runId,
          playerName: event.player,
          title: 'Cards played',
          nameFilterRegex: /card-played-*/,
          prefixToRemove: 'card-played-',
        }))
      );

      fields.push(...(await getPingStats(event.player, claim?.claimant || '', endTime)));

      if (metadata.get('run-type') !== 'c') {
        fields.push(
          ...(await mapAndCountEvents({
            runId,
            playerName: event.player,
            title: 'Cards bought',
            nameFilterRegex: /card-bought-*/,
            prefixToRemove: 'card-bought-',
          }))
        );
      }
    }

    const embed = new EmbedBuilder()
      .setDescription(await getRunDescription(runId, claim))
      .setFields(fields)
      .setColor(0x00ffff);
    embeds.push(embed);
  }

  return embeds;
}

interface MapAndCountEventsParams {
  title: string;
  playerName: string;
  runId: string;
  nameFilterRegex: RegExp;
  prefixToRemove?: string;
  inline?: boolean;
}

async function mapAndCountEvents({
  title,
  playerName,
  runId,
  nameFilterRegex,
  prefixToRemove,
  inline,
}: MapAndCountEventsParams): Promise<Array<EmbedField>> {
  const events = await Event.find({
    player: {
      $in: [playerName, '@'],
    },
    name: nameFilterRegex,
    'metadata.run-id': runId,
  }).exec();

  if (events.length > 0) {
    return [
      {
        name: title,
        value: Array.from(
          events
            .map((event: IEvent) => (prefixToRemove && event.name.replace(prefixToRemove, '')) || event.name)
            .sort()
            .reduce((acc, e) => acc.set(e, (acc.get(e) || 0) + 1), new Map())
        )
          .map(([k, v]) => `- ${k}: \`${v}\``)
          .join('\n'),
        inline: inline === undefined || inline,
      },
    ];
  }

  return [];
}

async function getPingStats(playerName: string, dungeon: string, endTime: string): Promise<Array<EmbedField>> {
  // Look at the 30 seconds leading to the end date (e.g. to when the player died)
  const cutoffDate = new Date(parseInt(endTime) * 1000 - 1000 * 30);

  const events = await Event.find({
    player: playerName,
    name: 'proxy-ping',
    'metadata.server': dungeon,
    createdAt: {
      $gte: cutoffDate,
      $lte: new Date(parseInt(endTime) * 1000),
    },
  }).exec();

  if (events.length > 0) {
    const pings = events
      .map((event: IEvent) => parseInt(getEventMetadata(event).get('ping') || '0', 10))
      .filter((ping: number) => ping > 0);
    // logger.debug("Pings: " + events);
    const minPing = Math.min(...pings);
    const avgPing = pings.reduce((acc, ping) => acc + ping, 0) / pings.length;
    const maxPing = Math.max(...pings);
    const value = `- Min: \`${minPing}\`\n- Avg: \`${avgPing.toFixed(2)}\`\n- Max: \`${maxPing}\``;

    return [
      {
        name: 'Ping (last 30s)',
        value: value,
        inline: true,
      },
    ];
  }

  return [];
}

async function getRunDescription(runId: string, claim: IClaimDoc | null): Promise<string> {
  const items = [`**Run ID**: ${runId}`];

  if (claim) {
    items.push(
      ...[
        `**Run Type**: ${getFullRunType(claim.metadata.get('run-type')) || 'unknown'}`,
        //       `**Deck ID**: ${claim.metadata.get('deck-id') || 'unknown'}`,
      ]
    );

    const difficulty = claim.metadata.get('difficulty');
    if (difficulty) {
      items.push(`**Difficulty**: ${difficulty}`);
    }

    const deathMessage = claim.metadata.get('death-message');
    if (deathMessage) {
      items.push(`**Death**: ${deathMessage}`);
    }

    const dungeon = claim.claimant;
    if (dungeon) {
      items.push(`**Dungeon**: ${dungeon}`);
    }

    const startTime = claim.metadata.get('start-time');
    const endTime = claim.metadata.get('end-time');
    if (startTime) {
      if (endTime) {
        const diff = (parseInt(endTime) - parseInt(startTime)) * 1000;
        const diffFormatted = diff < 3600000 ? moment.utc(diff).format('mm:ss') : moment.utc(diff).format('H[h]:mm[m]:ss[s]');
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

async function getFullRunTypeWithClaim(event: ClaimRelatedEvent) {
  return getFullRunTypeFromMetadata(await withClaimMetadata(event));
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
    case 'h':
      return 'Hardcore';
    default:
      return 'Unknown';
  }
}

export async function findClaim(event: ClaimRelatedEvent): Promise<IClaimDoc | null> {
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
    return claims[0]!!;
  }

  return null;
}

async function getDiscordMessageID(event: ClaimRelatedEvent): Promise<string> {
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

export async function withClaimMetadata(event: ClaimRelatedEvent): Promise<Map<string, any>> {
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

async function storeDiscordMessageID(event: ClaimRelatedEvent, messageID: String) {
  await setMetadataValue(event, 'discord-message-id', messageID);
}

async function storeDifficulty(event: ClaimRelatedEvent, difficulty: String) {
  await setMetadataValue(event, 'difficulty', difficulty);
}

async function storeStartTime(event: ClaimRelatedEvent, startTime: Date) {
  await setMetadataValue(event, 'start-time', ((startTime.getTime() / 1000) | 0).toString());
}

async function storeEndTime(event: ClaimRelatedEvent, endTime: Date) {
  await setMetadataValue(event, 'end-time', ((endTime.getTime() / 1000) | 0).toString());
}

async function storeGameWon(event: ClaimRelatedEvent) {
  await setMetadataValue(event, 'game-won', 'true');
}

async function storeKiller(event: ClaimRelatedEvent, killer: String) {
  await setMetadataValue(event, 'killer', killer);
}

async function storeDeathMessage(event: ClaimRelatedEvent, message: String) {
  await setMetadataValue(event, 'death-message', message);
}

async function getKiller(event: EventWithServer & ClaimRelatedEvent): Promise<string | undefined> {
  const metadata = getEventMetadata(event);
  const killer = metadata.get('killer');
  if (killer) {
    return killer;
  }

  const claim = await findClaim(event);
  if (claim) {
    return claim.metadata.get('killer');
  }

  return '';
}

async function setMetadataValue(event: ClaimRelatedEvent, metadataKey: String, value: String) {
  const metadata = getEventMetadata(event);
  const runId = metadata.get('run-id');
  logger.debug(`Updating 'metadata.${metadataKey}' for run ${runId} to ${value}`);

  const claim = await findClaim(event);
  if (claim) {
    await claim
      .updateOne({
        [`metadata.${metadataKey}`]: value,
      })
      .exec();
  }
}
