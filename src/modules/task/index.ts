import * as taskController from './task.controller';
import * as taskInterfaces from './task.interfaces';
import Task from './task.model';
import * as taskService from './task.service';
import * as taskValidation from './task.validation';

function notifyOps(message: string, lobbyServer: string = 'lobby') {
  return Task.create({
    server: lobbyServer,
    type: 'message-ops',
    state: 'SCHEDULED',
    arguments: [message],
    sourceIP: '127.0.0.1',
  });
}

export { taskController, taskInterfaces, Task, taskService, taskValidation, notifyOps };
