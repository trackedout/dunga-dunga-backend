import express, { Router } from 'express';
import { validate } from '../../modules/validate';
import { leagueController, leagueValidation, sandboxController } from '../../modules/league';

const router: Router = express.Router();

router
  .route('/')
  .get(leagueController.getActiveLeagues)
  .post(validate(leagueValidation.upsertLeague), leagueController.upsertLeague);

router
  .route('/create')
  .post(validate(leagueValidation.createLeague), sandboxController.createLeagueWithSeed);

router
  .route('/sandbox/update')
  .post(sandboxController.updateSandboxFromEvent);

router
  .route('/sandbox/active')
  .get(sandboxController.getActiveSandboxes);

router
  .route('/:slug')
  .get(validate(leagueValidation.getLeagueBySlug), leagueController.getLeagueBySlug);

router
  .route('/:slug/sandbox')
  .get(validate(leagueValidation.getLeagueBySlug), sandboxController.getSandboxInstance);

router
  .route('/:slug/sandbox/launch')
  .post(validate(leagueValidation.getLeagueBySlug), sandboxController.launchSandbox);

router
  .route('/:slug/sandbox/stop')
  .post(validate(leagueValidation.getLeagueBySlug), sandboxController.stopSandbox);

router
  .route('/:slug/builder-allowlist')
  .get(validate(leagueValidation.getLeagueBySlug), sandboxController.getBuilderAllowlist);

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
 * /leagues/create:
 *   post:
 *     summary: Create a league with world seed
 *     description: Creates a new league and seeds its world from builders2 dungeon snapshot.
 *     operationId: leaguesCreate
 *     tags: [Leagues]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - slug
 *               - displayName
 *               - owner
 *             properties:
 *               slug:
 *                 type: string
 *                 pattern: '^[a-z0-9-]+$'
 *               displayName:
 *                 type: string
 *               owner:
 *                 type: string
 *               builders:
 *                 type: object
 *                 properties:
 *                   players:
 *                     type: array
 *                     items:
 *                       type: string
 *                   idleTimeoutMinutes:
 *                     type: integer
 *                     minimum: 5
 *                     maximum: 120
 *     responses:
 *       "201":
 *         description: Created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/League'
 *       "409":
 *         description: League already exists
 */

/**
 * @swagger
 * /leagues/sandbox/update:
 *   post:
 *     summary: Update sandbox instance state (internal)
 *     description: Called by job-scheduler to update sandbox state after ECS task changes.
 *     operationId: sandboxUpdate
 *     tags: [Leagues]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               slot:
 *                 type: string
 *               state:
 *                 type: string
 *                 enum: [LAUNCHING, RUNNING, STOPPING, STOPPED]
 *               taskArn:
 *                 type: string
 *               privateIp:
 *                 type: string
 *     responses:
 *       "200":
 *         description: Updated
 *       "404":
 *         description: No instance for slot
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
 */

/**
 * @swagger
 * /leagues/{slug}/sandbox:
 *   get:
 *     summary: Get sandbox instance for a league
 *     description: Returns the active sandbox instance for the given league.
 *     operationId: leagueSandboxGet
 *     tags: [Leagues]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LeagueSandboxInstance'
 *       "404":
 *         description: No active sandbox instance
 */

/**
 * @swagger
 * /leagues/{slug}/sandbox/launch:
 *   post:
 *     summary: Launch a sandbox build server for a league
 *     description: Allocates a slot and schedules an ECS task to start the sandbox.
 *     operationId: leagueSandboxLaunch
 *     tags: [Leagues]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       "202":
 *         description: Accepted (launching)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LeagueSandboxInstance'
 *       "404":
 *         description: League not found
 */

/**
 * @swagger
 * /leagues/{slug}/sandbox/stop:
 *   post:
 *     summary: Stop a sandbox build server for a league
 *     description: Schedules the ECS task for termination.
 *     operationId: leagueSandboxStop
 *     tags: [Leagues]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       "200":
 *         description: Stopping
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LeagueSandboxInstance'
 *       "404":
 *         description: No active sandbox instance
 */

/**
 * @swagger
 * /leagues/{slug}/builder-allowlist:
 *   get:
 *     summary: Get builder allowlist for a league
 *     description: Returns the whitelist of players allowed to join the league's build server.
 *     operationId: leagueBuilderAllowlist
 *     tags: [Leagues]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/LeagueBuilderAllowlistEntry'
 *                 properties:
 *                   name:
 *                     type: string
 *       "404":
 *         description: League not found
 */
