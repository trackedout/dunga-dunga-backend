import express, { Router } from 'express';
import { validate } from '../../modules/validate';
import { itemController, itemValidation } from '../../modules/item';

const router: Router = express.Router();

router
  .route('/items')
  .get(validate(itemValidation.getItems), itemController.getItems);

router
  .route('/add-item')
  .post(validate(itemValidation.createItem), itemController.createItem)

router
  .route('/delete-item')
  .post(validate(itemValidation.deleteItem), itemController.deleteItem)

router
  .route('/overwrite-player-deck')
  .put(validate(itemValidation.overwritePlayerDeck), itemController.overwritePlayerDeck)

router
  .route('/:itemId')
  .get(validate(itemValidation.getItem), itemController.getItem)

export default router;

/**
 * @swagger
 * tags:
 *   name: Inventory
 *   description: Inventory management and retrieval
 */

/**
 * @swagger
 * /inventory/add-item:
 *   post:
 *     summary: Add a item to a player's deck
 *     description: Add a item to a player's deck from one of the Decked Out 2 instances or the lobby server.
 *     tags: [Inventory]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Item'
 *     responses:
 *       "201":
 *         description: Created
 *         content:
 *           application/json:
 *             schema:
 *                $ref: '#/components/schemas/Item'
 *       "400":
 *         $ref: '#/components/responses/DuplicateEmail'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *
 * /inventory/items:
 *   get:
 *     summary: Get all items
 *     description: Only admins can retrieve all items.
 *     tags: [Inventory]
 *     parameters:
 *       - in: query
 *         name: name
 *         schema:
 *           type: string
 *         description: Item name
 *       - in: query
 *         name: player
 *         schema:
 *           type: string
 *         description: Player
 *       - in: query
 *         name: deckId
 *         schema:
 *           type: string
 *         default: 1
 *         description: Deck ID
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
 *         default: 50
 *         description: Maximum number of items
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
 *                     $ref: '#/components/schemas/Item'
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

/**
 * @swagger
 * /inventory/delete-item:
 *   post:
 *     summary: Delete a item
 *     description: Remove a item from a player's deck. If multiple copies of this item exist, only one will be removed.
 *     tags: [Inventory]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Item'
 *     responses:
 *       "200":
 *         description: No content
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 */

/**
 * @swagger
 * /inventory/overwrite-player-deck:
 *   put:
 *     summary: Overwrites the player's deck with the supplied list of items
 *     description: Remove all existing items and create a new deck with the list of items provided.
 *     tags: [Inventory]
 *     parameters:
 *       - in: query
 *         name: player
 *         schema:
 *           type: string
 *         description: Player
 *       - in: query
 *         name: server
 *         schema:
 *           type: string
 *         default: lobby_1
 *         description: Server
 *       - in: query
 *         name: deckId
 *         schema:
 *           type: string
 *         default: 1
 *         description: Deck ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *                type: string
 *             example: ["moment_of_clarity", "suit_up"]
 *     responses:
 *       "200":
 *         description: No content
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 */
