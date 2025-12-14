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

function notifyPlayer(playerName: string, ...messages: string[]) {
  return Task.create({
    server: 'lobby', // Only Citadel listens for this task
    type: 'message-player',
    state: 'SCHEDULED',
    targetPlayer: playerName,
    arguments: messages,
    sourceIP: '127.0.0.1',
  });
}

export function sendTitle(playerName: string, title: string, subtitle: string = '') {
  return Task.create({
    server: 'lobby', // Only Citadel listens for this task
    type: 'send-title',
    state: 'SCHEDULED',
    targetPlayer: playerName,
    arguments: [title, subtitle],
    sourceIP: '127.0.0.1',
  });
}

export function playSound(playerName: string, sound: string) {
  return Task.create({
    server: 'lobby', // Only Citadel listens for this task
    type: 'play-sound',
    state: 'SCHEDULED',
    targetPlayer: playerName,
    arguments: [sound],
    sourceIP: '127.0.0.1',
  });
}

export { taskController, taskInterfaces, Task, taskService, taskValidation, notifyOps, notifyPlayer };
