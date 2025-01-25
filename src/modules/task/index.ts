import * as taskController from './task.controller';
import * as taskInterfaces from './task.interfaces';
import Task from './task.model';
import * as taskService from './task.service';
import * as taskValidation from './task.validation';

function notifyOps(message: string, server: string = 'lobby') {
  return Task.create({
    server: server,
    type: 'message-ops',
    state: 'SCHEDULED',
    arguments: [message],
    sourceIP: '127.0.0.1',
  });
}

function notifyPlayer(playerName: string, message: string, server: string = 'lobby') {
  return Task.create({
    server: server,
    type: 'message-player',
    state: 'SCHEDULED',
    targetPlayer: playerName,
    arguments: [message],
    sourceIP: '127.0.0.1',
  });
}

export { taskController, taskInterfaces, Task, taskService, taskValidation, notifyOps, notifyPlayer };
