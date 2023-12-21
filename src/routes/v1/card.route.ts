import express, { Router } from 'express';
import { validate } from '../../modules/validate';
import { cardController, cardValidation } from '../../modules/card';

const router: Router = express.Router();

router
  .route('/cards')
  .get(validate(cardValidation.getCards), cardController.getCards);

router
  .route('/add-card')
  .post(validate(cardValidation.createCard), cardController.createCard)

router
  .route('/delete-card')
  .delete(validate(cardValidation.deleteCard), cardController.deleteCard)

router
  .route('/:cardId')
  .get(validate(cardValidation.getCard), cardController.getCard)

export default router;

/**
 * @swagger
 * tags:
 *   name: Inventory
 *   description: Inventory management and retrieval
 */

/**
 * @swagger
 * /inventory/add-card:
 *   post:
 *     summary: Add a card to a player's deck
 *     description: Add a card to a player's deck from one of the Decked Out 2 instances or the lobby server.
 *     tags: [Inventory]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Card'
 *     responses:
 *       "201":
 *         description: Created
 *         content:
 *           application/json:
 *             schema:
 *                $ref: '#/components/schemas/Card'
 *       "400":
 *         $ref: '#/components/responses/DuplicateEmail'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *
 * /inventory/cards:
 *   get:
 *     summary: Get all cards
 *     description: Only admins can retrieve all cards.
 *     tags: [Inventory]
 *     parameters:
 *       - in: query
 *         name: name
 *         schema:
 *           type: string
 *         description: Card name
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
 *         description: Maximum number of cards
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
 *                     $ref: '#/components/schemas/Card'
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
 * /inventory/delete-card:
 *   post:
 *     summary: Delete a card
 *     description: Remove a card from a player's deck. If multiple copies of this card exist, only one will be removed.
 *     tags: [Inventory]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Card'
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