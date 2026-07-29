import express, { Router } from 'express';
import { validate } from '../../modules/validate';
import { gameRegistryController, gameRegistryValidation } from '../../modules/gameRegistry';

const router: Router = express.Router();

router
  .route('/')
  .get(gameRegistryController.getEnabledGames)
  .post(validate(gameRegistryValidation.upsertGame), gameRegistryController.upsertGame);

router
  .route('/:name')
  .get(validate(gameRegistryValidation.getGameByName), gameRegistryController.getGameByName);

export default router;

/**
 * @swagger
 * tags:
 *   name: GameRegistry
 *   description: Minigame registry management
 */

/**
 * @swagger
 * /game-registry:
 *   get:
 *     summary: Get all enabled minigames
 *     description: Returns a list of all enabled minigame configurations.
 *     operationId: gameRegistryGet
 *     tags: [GameRegistry]
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
 *                     $ref: '#/components/schemas/GameRegistryEntry'
 *
 *   post:
 *     summary: Create or update a minigame
 *     description: Upsert a minigame configuration by name.
 *     operationId: gameRegistryPost
 *     tags: [GameRegistry]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/GameRegistryEntry'
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/GameRegistryEntry'
 */

/**
 * @swagger
 * /game-registry/{name}:
 *   get:
 *     summary: Get a minigame by name
 *     description: Returns a specific minigame configuration.
 *     operationId: gameRegistryNameGet
 *     tags: [GameRegistry]
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *         description: Minigame name
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/GameRegistryEntry'
 *       "404":
 *         description: Not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
