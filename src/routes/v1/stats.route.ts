import express, { Router } from 'express';
import { validate } from '../../modules/validate';
import { statsController, statsValidation } from '../../modules/stats';

const router: Router = express.Router();

router.route('/').get(validate(statsValidation.getStats), statsController.getStatsHandler);

export default router;
