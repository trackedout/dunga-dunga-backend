import { Request, Response } from 'express';
import catchAsync from '../utils/catchAsync';
import DungeonInstance from '../event/instance.model';
import Player from '../event/player.model';
import { QueueStates } from '../event/player.interfaces';

export const getStatus = catchAsync(async (_req: Request, res: Response) => {
  // const filter = pick(req.query, ['name', 'server', 'player', 'deckId']);
  // const options: IOptions = pick(req.query, ['sortBy', 'limit', 'page', 'projectBy']);

  const instances = await DungeonInstance.find({
    name: {
      $regex: /^d[0-9]{3}/,
    },
  }).exec();
  const players = await Player.find({}).exec();

  const status = [
    {
      header: `§3Instances (${instances.length} total)`,
      lines: [
        {
          key: '§aAvailable',
          value: instances.filter((instance) => {
            return !instance.inUse && !instance.requiresRebuild && instance.activePlayers === 0;
          }).length,
        },
        {
          key: '§bIn use',
          value: instances.filter((instance) => instance.inUse && !instance.requiresRebuild).length,
        },
        {
          key: '§cRebuilding',
          value: instances.filter((instance) => instance.requiresRebuild).length,
        },
      ],
    },
    {
      header: `§3Players (${players.length} stored in DB)`,
      lines: [
        {
          key: '§aIn game',
          value: players.filter((player) => player.state === QueueStates.IN_DUNGEON).length,
        },
        {
          key: '§bIn lobby',
          value: players.filter((player) => player.state === QueueStates.IN_LOBBY).length,
        },
        {
          key: '§6In queue',
          value: players.filter((player) => player.state === QueueStates.IN_QUEUE).length,
        },
      ],
    },
  ];

  res.send(status);
});
