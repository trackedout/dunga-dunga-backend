import { logger } from '../logger';
import { EmbedBuilder, WebhookClient } from 'discord.js';
import { EventMetadataContainer, getEventMetadata } from '../utils';
import { findClaim, getFullRunTypeWithClaim, getRunDescription, setMetadataValue, withClaimMetadata } from './discord';

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

if (process.env['DISCORD_BUG_REPORT_WEBHOOK_URL']) {
  webhookClient = new WebhookClient({
    url: process.env['DISCORD_BUG_REPORT_WEBHOOK_URL'],
  });
  logger.info(`Discord bug report webhook notifications enabled`);
} else {
  logger.warn(`Missing Discord webhook URL for bug reports`);
}

export async function sendBugReportToDiscord(event: EventWithServer & ClaimRelatedEvent & InvalidatedEvent) {
  const playerNameBold = `**${event.player}**`;
  let message = `[${await getFullRunTypeWithClaim(event)}] ${playerNameBold} has submitted a bug report!`;

  let bugReportMessage = getEventMetadata(event).get('message');
  logger.info(`Bug report from ${event.player}: ${bugReportMessage}`);

  await addBugReportMessage(event, bugReportMessage);

  if (webhookClient) {
    const embeds = [];

    embeds.push(...(await getEmbeds(event)));

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
    if (!lastMessageID && message) {
      const sentMessage = await webhookClient.send(options);
      await storeDiscordMessageID(event, sentMessage.id);
    }
  }
}

async function getDiscordMessageID(event: ClaimRelatedEvent): Promise<string> {
  const metadata = await withClaimMetadata(event);
  const runId = metadata.get('run-id');
  const messageID = metadata.get('discord-bug-report-message-id');

  if (messageID) {
    logger.debug(`Discord bug report message ID for run ${runId} is ${messageID}`);
    return messageID;
  } else {
    logger.warn(`Could not find Discord bug report message ID for run ${runId}`);
  }

  return '';
}

async function storeDiscordMessageID(event: ClaimRelatedEvent, messageID: String) {
  await setMetadataValue(event, 'discord-bug-report-message-id', messageID);
}

async function addBugReportMessage(event: ClaimRelatedEvent, message: String) {
  const metadata = await withClaimMetadata(event);
  let bugReports = (metadata.get('bug-reports') || '').split('\n');

  // Append the new bug report, with a timestamp
  const reportTime = ((new Date().getTime() / 1000) | 0).toString();
  bugReports.push(`<t:${reportTime}:T> ${message.replace('\n', '')}`);

  await setMetadataValue(event, 'bug-reports', bugReports.join('\n').trim());
}

async function getEmbeds(event: EventWithServer & ClaimRelatedEvent): Promise<Array<EmbedBuilder>> {
  const metadata = await withClaimMetadata(event);

  const embeds: Array<EmbedBuilder> = [];
  if (!metadata || metadata.size === 0) {
    return embeds;
  }

  const claim = await findClaim(event);
  if (claim) {
    const metadata = await withClaimMetadata(event);
    embeds.push(new EmbedBuilder().setDescription(await getRunDescription(metadata.get('run-id'), claim)).setColor(0x00ffff));

    const bugReportsMetadata = metadata.get('bug-reports');
    if (bugReportsMetadata) {
      let bugReports = bugReportsMetadata.split('\n').map((msg: string) => `- ${msg}`);

      if (bugReports) {
        let description = [`**Bug Reports:**`, ...bugReports].join('\n');
        embeds.push(new EmbedBuilder().setDescription(description).setColor(0x00ffff));
      }
    }
  }

  return embeds;
}
