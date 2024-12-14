import express, { Router } from 'express';
import { validate } from '../../modules/validate';
import { statusController, statusValidation } from '../../modules/status';

const router: Router = express.Router();

router.route('/').get(validate(statusValidation.getStatus), statusController.getStatus);

export default router;

/**
 * @swagger
 * tags:
 *   name: Status
 *   description: Status of the network
 */

/**
 * @swagger
 * /status:
 *   get:
 *     summary: Get status
 *     description: Return the last know status of the network
 *     operationId: getStatus
 *     tags: [Status]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *         default: 50
 *         description: Maximum number of statuses
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Status'
 */
