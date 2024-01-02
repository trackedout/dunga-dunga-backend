import httpStatus from 'http-status';
import mongoose from 'mongoose';
import Task from './task.model';
import ApiError from '../errors/ApiError';
import { IOptions, QueryResult } from '../paginate/paginate';
import { ITaskDoc, NewCreatedTask, UpdateTaskBody } from './task.interfaces';

/**
 * Create an task, and potentially react to the task depending on DB state
 * @param {NewCreatedTask} taskBody
 * @returns {Promise<ITaskDoc>}
 */
export const createTask = async (taskBody: NewCreatedTask): Promise<ITaskDoc> => {
  try {
    return await Task.create(taskBody);
  } catch (e) {
    await Task.create({ ...taskBody, processingFailed: true, error: `${e}` });
    throw e;
  }
};

/**
 * Query for tasks
 * @param {Object} filter - Mongo filter
 * @param {Object} options - Query options
 * @returns {Promise<QueryResult>}
 */
export const queryTasks = async (filter: Record<string, any>, options: IOptions): Promise<QueryResult> => {
  return Task.paginate(filter, options);
};

/**
 * Get task by id
 * @param {mongoose.Types.ObjectId} id
 * @returns {Promise<ITaskDoc | null>}
 */
export const getTaskById = async (id: mongoose.Types.ObjectId): Promise<ITaskDoc | null> => Task.findById(id);

/**
 * Update task by id
 * @param {mongoose.Types.ObjectId} taskId
 * @param {UpdateTaskBody} updateBody
 * @returns {Promise<ITaskDoc | null>}
 */
export const updateTaskById = async (
  taskId: mongoose.Types.ObjectId,
  updateBody: UpdateTaskBody
): Promise<ITaskDoc | null> => {
  const task = await getTaskById(taskId);
  if (!task) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Task not found');
  }
  Object.assign(task, updateBody);
  await task.save();
  return task;
};

/**
 * Delete task by id
 * @param {mongoose.Types.ObjectId} taskId
 * @returns {Promise<ITaskDoc | null>}
 */
export const deleteTaskById = async (taskId: mongoose.Types.ObjectId): Promise<ITaskDoc | null> => {
  const task = await getTaskById(taskId);
  if (!task) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Task not found');
  }
  await task.deleteOne();
  return task;
};
