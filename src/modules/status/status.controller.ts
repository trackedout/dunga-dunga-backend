import { Request, Response } from 'express';
import catchAsync from '../utils/catchAsync';
import DungeonInstance from '../event/instance.model';
import Player from '../event/player.model';
import { QueueStates } from '../event/player.interfaces';
import { InstanceStates } from '../event/instance.interfaces';

export const getStatus = catchAsync(async (_req: Request, res: Response) => {
  // const filter = pick(req.query, ['name', 'server', 'player', 'deckId']);
  // const options: IOptions = pick(req.query, ['sortBy', 'limit', 'page', 'projectBy']);

  const instances = await DungeonInstance.find({
    name: {
      $regex: /^d[0-9]{3}/,
    },
  }).exec();

  const staleCutoff = new Date();
  staleCutoff.setMinutes(staleCutoff.getMinutes() - 2);

  const players = await Player.find({
    lastSeen: { $gte: staleCutoff },
  }).exec();

  const stalePlayers = await Player.find({
    lastSeen: { $lt: staleCutoff },
  }).exec();

  const status = [
    {
      header: `<dark_aqua>Instances (${instances.length} total)</dark_aqua>`,
      lines: [
        {
          key: '<green>Available</green>',
          value: instances.filter((instance) => {
            return instance.state === InstanceStates.AVAILABLE && !instance.requiresRebuild && instance.activePlayers === 0;
          }).length,
        },
        {
          key: '<aqua>In use</aqua>',
          value: instances.filter((instance) => {
            return instance.state === InstanceStates.IN_USE && !instance.requiresRebuild;
          }).length,
        },
        {
          key: '<gold>Awaiting player</gold>',
          value: instances.filter((instance) => {
            return [InstanceStates.AWAITING_PLAYER, InstanceStates.RESERVED].includes(instance.state) && !instance.requiresRebuild;
          }).length,
        },
        {
          key: '<red>Rebuilding</red>',
          value: instances.filter((instance) => {
            return [InstanceStates.BUILDING, InstanceStates.UNREACHABLE].includes(instance.state) || instance.requiresRebuild;
          }).length,
        },
      ],
    },
    {
      header: `<dark_aqua>Players (${players.length + stalePlayers.length} stored in DB</dark_aqua>)`,
      lines: [
        {
          key: '<green>In game</green>',
          value: players.filter((player) => player.state === QueueStates.IN_DUNGEON).length,
        },
        {
          key: '<gold>In queue</gold>',
          value: players.filter((player) => player.state === QueueStates.IN_QUEUE).length,
        },
        {
          key: '<gold>In transit</gold>',
          value: players.filter((player) => player.state === QueueStates.IN_TRANSIT_TO_DUNGEON).length,
        },
        {
          key: '<aqua>In lobby</aqua>',
          value: players.filter((player) => player.state === QueueStates.IN_LOBBY).length,
        },
        {
          key: '<dark_green>In builders</dark_green>',
          value: players.filter((player) => player.state === QueueStates.IN_BUILDERS).length,
        },
        {
          key: '<red>Offline</red>',
          value: stalePlayers.length,
        },
      ],
    },
  ];

  res.send(status);
});
