import express, { Router } from 'express';
import { validate } from '../../modules/validate';
import { leagueController, leagueValidation } from '../../modules/league';

const router: Router = express.Router();

router
  .route('/')
  .get(leagueController.getActiveLeagues)
  .post(validate(leagueValidation.upsertLeague), leagueController.upsertLeague);

router
  .route('/:slug')
  .get(validate(leagueValidation.getLeagueBySlug), leagueController.getLeagueBySlug);

export default router;

/**
 * @swagger
 * tags:
 *   name: Leagues
 *   description: League management
 */

/**
 * @swagger
 * /leagues:
 *   get:
 *     summary: Get all active leagues
 *     description: Returns a list of all active league configurations.
 *     operationId: leaguesGet
 *     tags: [Leagues]
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
 *                     $ref: '#/components/schemas/League'
 *
 *   post:
 *     summary: Create or update a league
 *     description: Upsert a league configuration by slug.
 *     operationId: leaguesPost
 *     tags: [Leagues]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/League'
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/League'
 */

/**
 * @swagger
 * /leagues/{slug}:
 *   get:
 *     summary: Get a league by slug
 *     description: Returns a specific league configuration.
 *     operationId: leaguesSlugGet
 *     tags: [Leagues]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *         description: League slug
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/League'
 *       "404":
 *         description: Not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
