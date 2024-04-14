import express, { Router } from 'express';
import docsRoute from './swagger.route';
import eventRoute from './event.route';
import cardRoute from './card.route';
import tasksRoute from './tasks.route';
import statusRoute from './status.route';
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
    path: '/tasks',
    route: tasksRoute,
  },
  {
    path: '/status',
    route: statusRoute,
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
