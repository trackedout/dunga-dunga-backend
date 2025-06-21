import logger from '../modules/logger/logger';
import moment from 'moment';
import { Score } from '../modules/score';
import { Trophy } from '../modules/trophy';
import { ITrophy } from '../modules/trophy/trophy.interfaces';

const runWorker = async () => {
  logger.info('Running background TOT worker...');

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
      text: ['', scores[0]?.player || '', `${scores[0]?.value} wins`, `${formatDate(scores[0]?.updatedAt)}`],
      x: -428,
      y: 65,
      z: 2032,
    },
  });

  console.log(scores);
};

function formatDate(date: Date | undefined) {
  if (!date) {
    return '';
  }

  return moment.utc(date).fromNow();
}

async function updateTOT(data: ITrophy) {
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
