import express, { Request, Response, Router } from 'express';
import DungeonInstance from '../../modules/event/instance.model';
import { catchAsync } from '../../modules/utils';

const router: Router = express.Router();

router.route('/').get(
  catchAsync(async (_req: Request, res: Response) => {
    const instances = await DungeonInstance.find().sort({ name: 1 }).exec();
    res.json(instances);
  })
);

export default router;

/**
 * @swagger
 * tags:
 *   name: Instances
 *   description: Dungeon instance management
 */

/**
 * @swagger
 * /instances:
 *   get:
 *     summary: Get all dungeon instances
 *     description: Returns a list of all dungeon instances and their current state.
 *     operationId: getInstances
 *     tags: [Instances]
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   name:
 *                     type: string
 *                   ip:
 *                     type: string
 *                   state:
 *                     type: string
 *                     enum: [available, reserved, awaiting-player, in-use, building, unreachable]
 *                   reservedBy:
 *                     type: string
 *                   claimId:
 *                     type: string
 *                   activePlayers:
 *                     type: integer
 *                   requiresRebuild:
 *                     type: boolean
 *                   healthySince:
 *                     type: string
 *                     format: date-time
 *                   unhealthySince:
 *                     type: string
 *                     format: date-time
 */
