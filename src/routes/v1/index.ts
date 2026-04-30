import express, { Router } from 'express';
import docsRoute from './swagger.route';
import eventRoute from './event.route';
import cardRoute from './card.route';
import itemRoute from './item.route';
import scoreRoute from './score.route';
import claimRoute from './claim.route';
import tasksRoute from './tasks.route';
import statusRoute from './status.route';
import configRoute from './config.route';
import config from '../../config/config';

const router = express.Router();

interface IRoute {
  path: string;
  route: Router;
}

const defaultIRoute: IRoute[] = [
  {
    path: '/events',
    route: eventRoute,
  },
  {
    path: '/inventory',
    route: cardRoute,
  },
  {
    path: '/scores',
    route: scoreRoute,
  },
  {
    path: '/claims',
    route: claimRoute,
  },
  {
    path: '/storage',
    route: itemRoute,
  },
  {
    path: '/tasks',
    route: tasksRoute,
  },
  {
    path: '/status',
    route: statusRoute,
  },
  {
    path: '/configs',
    route: configRoute,
  },
];

const devIRoute: IRoute[] = [
  // IRoute available only in development mode
  {
    path: '/docs',
    route: docsRoute,
  },
];

defaultIRoute.forEach((route) => {
  router.use(route.path, route.route);
});

/* istanbul ignore next */
if (config.env === 'development') {
  devIRoute.forEach((route) => {
    router.use(route.path, route.route);
  });
}

export default router;
