import express, { Router } from 'express';
import { validate } from '../../modules/validate';
import { feedController, feedValidation } from '../../modules/feed';

const router: Router = express.Router();

router.route('/').get(validate(feedValidation.getFeed), feedController.getFeedHandler);
router.route('/runs/:runId').get(feedController.getRunHandler);

export default router;
