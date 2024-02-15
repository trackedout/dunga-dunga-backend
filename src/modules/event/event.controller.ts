import httpStatus from 'http-status';
import { Request, Response } from 'express';
import mongoose from 'mongoose';
import catchAsync from '../utils/catchAsync';
import ApiError from '../errors/ApiError';
import pick from '../utils/pick';
import { IOptions } from '../paginate/paginate';
import * as eventService from './event.service';
import config from '../../config/config';

export const createEvent = catchAsync(async (req: Request, res: Response) => {
  const sourceIP = config.env === 'development' ? req.body.sourceIP : null;

  const event = await eventService.createEvent({
    ...req.body,
    sourceIP: sourceIP || req.ip?.split(':').slice(-1)[0],
  });
  res.status(httpStatus.CREATED).send(event);
});

export const getEvents = catchAsync(async (req: Request, res: Response) => {
  const filter = pick(req.query, ['name', 'server', 'player']);
  const options: IOptions = pick(req.query, ['sortBy', 'limit', 'page', 'projectBy']);
  const result = await eventService.queryEvents(filter, options);
  res.send(result);
});

export const getEvent = catchAsync(async (req: Request, res: Response) => {
  if (typeof req.params['eventId'] === 'string') {
    const event = await eventService.getEventById(new mongoose.Types.ObjectId(req.params['eventId']));
    if (!event) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Event not found');
    }
    res.send(event);
  }
});

export const updateEvent = catchAsync(async (req: Request, res: Response) => {
  if (typeof req.params['eventId'] === 'string') {
    const event = await eventService.updateEventById(new mongoose.Types.ObjectId(req.params['eventId']), req.body);
    res.send(event);
  }
});

export const deleteEvent = catchAsync(async (req: Request, res: Response) => {
  if (typeof req.params['eventId'] === 'string') {
    await eventService.deleteEventById(new mongoose.Types.ObjectId(req.params['eventId']));
    res.status(httpStatus.NO_CONTENT).send();
  }
});
