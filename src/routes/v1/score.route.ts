import express, { Router } from 'express';
import { validate } from '../../modules/validate';
import { scoreController, scoreValidation } from '../../modules/score';

const router: Router = express.Router();

router
  .route('/')
  .get(validate(scoreValidation.getScores), scoreController.getScores)
  .post(validate(scoreValidation.createScores), scoreController.createScores);

router.route('/add-score').post(validate(scoreValidation.createScore), scoreController.createScore);

router.route('/delete-score').post(validate(scoreValidation.deleteScore), scoreController.deleteScore);

export default router;

/**
 * @swagger
 * tags:
 *   name: Score
 *   description: Score management and retrieval
 */

/**
 * @swagger
 * /scores/add-score:
 *   post:
 *     summary: Add a score
 *     description: Add a score for a player
 *     tags: [Score]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Score'
 *     responses:
 *       "201":
 *         description: Created
 *         content:
 *           application/json:
 *             schema:
 *                $ref: '#/components/schemas/Score'
 */

/**
 * @swagger
 * /scores:
 *   get:
 *     summary: Get all scores
 *     description: Only admins can retrieve all scores.
 *     tags: [Score]
 *     parameters:
 *       - in: query
 *         name: player
 *         schema:
 *           type: string
 *         description: Player
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
 *         name: prefixFilter
 *         schema:
 *           type: string
 *         description: filter by prefix
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *         default: 50
 *         description: Maximum number of scores
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
 *                     $ref: '#/components/schemas/Score'
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
 */

/**
 * @swagger
 * /scores/delete-score:
 *   post:
 *     summary: Delete a score
 *     description: Remove a score from a player's deck. If multiple copies of this score exist, only one will be removed.
 *     tags: [Score]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Score'
 *     responses:
 *       "200":
 *         description: No content
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 */

/**
 * @swagger
 * /scores:
 *   post:
 *     summary: Batch update or insert scores
 *     description: Batch update or insert scores
 *     tags: [Score]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               $ref: '#/components/schemas/Score'
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Score'
 */
