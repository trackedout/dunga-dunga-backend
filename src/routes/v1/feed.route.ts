import express, { Router } from 'express';
import { validate } from '../../modules/validate';
import { feedController, feedValidation } from '../../modules/feed';

const router: Router = express.Router();

router.route('/').get(validate(feedValidation.getFeed), feedController.getFeedHandler);

export default router;
