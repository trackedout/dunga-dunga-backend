import express, { Router } from 'express';
import { overviewController } from '../../modules/overview';

const router: Router = express.Router();

router.route('/').get(overviewController.getOverviewHandler);

export default router;
