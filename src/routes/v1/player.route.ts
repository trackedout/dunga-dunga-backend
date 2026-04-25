import express, { Router } from 'express';
import { validate } from '../../modules/validate';
import { playerController, playerValidation } from '../../modules/player';

const router: Router = express.Router();

router.route('/').get(validate(playerValidation.getPlayers), playerController.getPlayers);
router.route('/:name').get(validate(playerValidation.getPlayer), playerController.getPlayer);

export default router;
