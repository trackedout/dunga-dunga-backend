import logger from '../modules/logger/logger';
import moment from 'moment';
import { Score } from '../modules/score';
import { Trophy } from '../modules/trophy';
import { ITrophy } from '../modules/trophy/trophy.interfaces';
import { Event, Player } from '../modules/event';
import { IEventDoc } from '../modules/event/event.interfaces';
import { IPlayerDoc } from '../modules/event/player.interfaces';
import { withClaimMetadata } from '../modules/event/discord';
import { RunTypes } from '../modules/claim/claim.interfaces';

const runWorker = async () => {
  logger.info('Running background TOT worker...');

  const players = await Player.find().exec();
  const wins = await Event.find({ name: 'game-won' }).sort({ createdAt: 1 }).exec();
  const losses = await Event.find({ name: 'game-lost' }).sort({ createdAt: 1 }).exec();

  await technicallyTheWinner();
  await eliteEntrance(players, wins, losses); // expensive
  await momentumMaster();
};

async function technicallyTheWinner() {
  const scores = await Score.find(
    {
      key: 'competitive-do2.wins',
    },
    {
      player: 1,
      key: 1,
      value: 1,
      updatedAt: 1,
    }
  )
    .sort({ value: -1 })
    .limit(3)
    .exec();

  await updateTOT({
    totKey: 'Technically the winner',
    sign: {
      text: [scores[0]?.player || '', '', `${scores[0]?.value} wins`, `${formatDate(scores[0]?.updatedAt)}`],
      x: -428,
      y: 65,
      z: 2032,
    },
  });
}

async function eliteEntrance(players: IPlayerDoc[], wins: IEventDoc[], losses: IEventDoc[]) {
  const playerData = await Promise.all(
    players.map(async (player) => {
      const firstLoss = (await eventsForCompPlayer(losses, player))[0];
      if (!firstLoss) {
        return null;
      }

      let winsBeforeLoss = (await eventsForCompPlayer(wins, player)).filter((win) => win.createdAt < firstLoss.createdAt);

      return {
        playerName: player.playerName,
        winsBeforeLoss,
        winCount: winsBeforeLoss.length,
        lossDate: firstLoss.createdAt,
      };
    })
  );

  const p = playerData.filter((player) => !!player).sort((a, b) => b.winCount - a.winCount)[0];

  await updateTOT({
    totKey: 'Elite Entrance',
    sign: {
      text: [p?.playerName || '', '', `${p?.winCount} win start`, `${formatDate(p?.lossDate)}`],
      x: -428,
      y: 65,
      z: 2036,
    },
  });
}

async function momentumMaster() {
  const scores = await Score.find(
    {
      key: 'competitive-do2.win_streak',
    },
    {
      player: 1,
      key: 1,
      value: 1,
      updatedAt: 1,
    }
  )
    .sort({ value: -1 })
    .limit(3)
    .exec();

  await updateTOT({
    totKey: 'Momentum Master',
    sign: {
      text: [scores[0]?.player || '', '', `${scores[0]?.value} win streak`, `${formatDate(scores[0]?.updatedAt)}`],
      x: -420,
      y: 65,
      z: 2032,
    },
  });
}

// Expensive!
async function eventsForCompPlayer(events: IEventDoc[], player: IPlayerDoc) {
  const eventsWithContext = await Promise.all(
    eventsForPlayer(events, player).map(async (event) => {
      event.metadata = await withClaimMetadata(event);
      return event;
    })
  );

  return eventsWithContext.filter((event) => [RunTypes.COMPETITIVE, 'c'].includes(event.metadata.get('run-type') || ''));
}

function eventsForPlayer(events: IEventDoc[], player: IPlayerDoc) {
  return events.filter((event) => event.player === player.playerName);
}

function formatDate(date: Date | undefined) {
  if (!date) {
    return '';
  }

  return moment.utc(date).fromNow();
}

async function updateTOT(data: ITrophy) {
  // If the player's name is blank, make the whole sign blank
  if (!data.sign.text[0]) {
    data.sign.text = ['', '', '', ''];
  }

  await Trophy.findOneAndUpdate(
    { totKey: data.totKey },
    { $set: data },
    { upsert: true, new: true } // create if not found, return updated doc
  );
}

const worker = {
  run: runWorker,
};

export default worker;
