import { Request, Response } from 'express';
import catchAsync from '../utils/catchAsync';
import DungeonInstance from '../event/instance.model';
import Player from '../event/player.model';
import { QueueStates } from '../event/player.interfaces';
import { InstanceStates } from '../event/instance.interfaces';
import { logger } from '../logger';

export const getStatus = catchAsync(async (_req: Request, res: Response) => {
  // const filter = pick(req.query, ['name', 'server', 'player', 'deckId']);
  // const options: IOptions = pick(req.query, ['sortBy', 'limit', 'page', 'projectBy']);

  const instances = await DungeonInstance.find({
    name: {
      $regex: /^d[0-9]{3}/,
    },
  }).exec();

  const staleCutoff = new Date();
  staleCutoff.setMinutes(staleCutoff.getMinutes() - 5);

  const players = await Player.find({
    lastSeen: { $gte: staleCutoff },
  }).exec();

  const stalePlayers = await Player.find({
    lastSeen: { $lt: staleCutoff },
  }).exec();

  logger.info(`Players: ${JSON.stringify(players)}`);

  const status = [
    {
      header: `§3Instances (${instances.length} total)`,
      lines: [
        {
          key: '§aAvailable',
          value: instances.filter((instance) => {
            return instance.state === InstanceStates.AVAILABLE && !instance.requiresRebuild && instance.activePlayers === 0;
          }).length,
        },
        {
          key: '§bIn use',
          value: instances.filter((instance) => {
            return instance.state === InstanceStates.IN_USE && !instance.requiresRebuild;
          }).length,
        },
        {
          key: '§6Awaiting player',
          value: instances.filter((instance) => {
            return [InstanceStates.AWAITING_PLAYER, InstanceStates.RESERVED].includes(instance.state) && !instance.requiresRebuild;
          }).length,
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
          key: '§6In queue',
          value: players.filter((player) => player.state === QueueStates.IN_QUEUE).length,
        },
        {
          key: '§6In transit',
          value: players.filter((player) => player.state === QueueStates.IN_TRANSIT_TO_DUNGEON).length,
        },
        {
          key: '§bIn lobby',
          value: players.filter((player) => player.state === QueueStates.IN_LOBBY).length,
        },
        {
          key: '§cOffline',
          value: stalePlayers.length,
        },
      ],
    },
  ];

  res.send(status);
});
