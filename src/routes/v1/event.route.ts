import express, { Router } from 'express';
import { validate } from '../../modules/validate';
import { eventController, eventValidation } from '../../modules/event';

const router: Router = express.Router();

router
  .route('/')
  .post(validate(eventValidation.createEvent), eventController.createEvent)
  .get(validate(eventValidation.getEvents), eventController.getEvents);

export default router;

/**
 * @swagger
 * tags:
 *   name: Events
 *   description: Event management and retrieval
 */

/**
 * @swagger
 * /events:
 *   post:
 *     summary: Create an event
 *     description: Log a dungeon event from one of the Decked Out 2 instances.
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - player
 *               - server
 *               - x
 *               - y
 *               - z
 *               - count
 *             properties:
 *               name:
 *                 type: string
 *               player:
 *                 type: string
 *               server:
 *                 type: string
 *               sourceIP:
 *                 type: string
 *               x:
 *                  type: double
 *                  default: 0
 *               y:
 *                  type: double
 *                  default: 0
 *               z:
 *                  type: double
 *                  default: 0
 *               count:
 *                 type: integer
 *                 default: 1
 *             example:
 *               name: run-started
 *               player: 4Ply
 *               server: do_1
 *               sourceIP: 127.0.0.1
 *               x: 0
 *               y: 0
 *               z: 0
 *               count: 1
 *     responses:
 *       "201":
 *         description: Created
 *         content:
 *           application/json:
 *             schema:
 *                $ref: '#/components/schemas/Event'
 *       "400":
 *         $ref: '#/components/responses/DuplicateEmail'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *
 *   get:
 *     summary: Get all events
 *     description: Only admins can retrieve all events.
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: name
 *         schema:
 *           type: string
 *         description: Event name
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *         description: Event role
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *         description: sort by query in the form of field:desc/asc (ex. name:asc)
 *       - in: query
 *         name: projectBy
 *         schema:
 *           type: string
 *         description: project by query in the form of field:hide/include (ex. name:hide)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *         default: 10
 *         description: Maximum number of events
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
 *               type: object
 *               properties:
 *                 results:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Event'
 *                 page:
 *                   type: integer
 *                   example: 1
 *                 limit:
 *                   type: integer
 *                   example: 10
 *                 totalPages:
 *                   type: integer
 *                   example: 1
 *                 totalResults:
 *                   type: integer
 *                   example: 1
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 */
