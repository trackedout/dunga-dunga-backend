import morgan from 'morgan';
import { Request, Response } from 'express';
import config from '../../config/config';
import logger from './logger';

const formatLine = (req: Request, res: Response, responseTime: string) => {
  const ip = config.env === 'production' ? `${req.ip} - ` : '';
  let extra = '';
  if (req.method === 'POST' && req.originalUrl.includes('/events') && req.body) {
    extra = req.body.name ? ` ${req.body.name}` : '';
    if (req.body.metadata?.['run-id']) extra += ` run=${req.body.metadata['run-id']}`;
  }
  return `${ip}${req.method} ${req.originalUrl} ${res.statusCode}${extra} - ${responseTime} ms`;
};

const successHandler = morgan((tokens, req: Request, res: Response) => {
  return formatLine(req, res, tokens['response-time']!(req, res) || '0');
}, {
  skip: (_req: Request, res: Response) => res.statusCode >= 400,
  stream: { write: (message: string) => logger.info(message.trim()) },
});

const errorHandler = morgan((tokens, req: Request, res: Response) => {
  const line = formatLine(req, res, tokens['response-time']!(req, res) || '0');
  const errMsg = res.locals['errorMessage'] || '';
  return errMsg ? `${line} - message: ${errMsg}` : line;
}, {
  skip: (_req: Request, res: Response) => res.statusCode < 400,
  stream: { write: (message: string) => logger.error(message.trim()) },
});

export default {
  successHandler,
  errorHandler,
};
