import express, { Router } from 'express';
import { validate } from '../../modules/validate';
import { cardStatsController, cardStatsValidation } from '../../modules/cardStats';

const router: Router = express.Router();

router.route('/').get(validate(cardStatsValidation.getCardStats), cardStatsController.getCardStatsHandler);

export default router;
