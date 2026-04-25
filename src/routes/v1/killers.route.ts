import express, { Router } from 'express';
import { validate } from '../../modules/validate';
import { killersController, killersValidation } from '../../modules/killers';

const router: Router = express.Router();

router.route('/').get(validate(killersValidation.getKillers), killersController.getKillersHandler);
router.route('/:killer').get(validate(killersValidation.getKillerDetail), killersController.getKillerDetailHandler);

export default router;
