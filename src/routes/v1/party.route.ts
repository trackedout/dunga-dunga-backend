import express, { Router } from 'express';
import { validate } from '../../modules/validate';
import { partyController, partyValidation } from '../../modules/party';

const router: Router = express.Router();

router
  .route('/')
  .get(validate(partyValidation.getParty), partyController.getParty)
  .post(validate(partyValidation.createParty), partyController.createParty);

router
  .route('/:id/invite')
  .post(validate(partyValidation.invitePlayer), partyController.invitePlayer);

router
  .route('/:id/join')
  .post(validate(partyValidation.joinParty), partyController.joinParty);

router
  .route('/:id/leave')
  .post(validate(partyValidation.leaveParty), partyController.leaveParty);

router
  .route('/:id/kick')
  .post(validate(partyValidation.kickPlayer), partyController.kickPlayer);

router
  .route('/:id')
  .delete(validate(partyValidation.disbandParty), partyController.disbandParty);

export default router;

/**
 * @swagger
 * tags:
 *   name: Parties
 *   description: Parties that play a league run together
 */

/**
 * @swagger
 * /parties:
 *   get:
 *     summary: Get a player's active party
 *     description: Returns the active party for a given player.
 *     operationId: partiesGet
 *     tags: [Parties]
 *     parameters:
 *       - in: query
 *         name: player
 *         required: true
 *         schema:
 *           type: string
 *         description: Player name
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Party'
 *       "404":
 *         description: Not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 *   post:
 *     summary: Create a party
 *     description: Create a new party for a league that supports parties.
 *     operationId: partiesPost
 *     tags: [Parties]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - leader
 *               - slug
 *             properties:
 *               leader:
 *                 type: string
 *               slug:
 *                 type: string
 *                 description: League the party plays
 *     responses:
 *       "201":
 *         description: Created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Party'
 */

/**
 * @swagger
 * /parties/{id}/invite:
 *   post:
 *     summary: Invite a player to the party
 *     description: Leader invites a player to join the party.
 *     operationId: partiesInvitePost
 *     tags: [Parties]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Party ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - player
 *             properties:
 *               player:
 *                 type: string
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Party'
 */

/**
 * @swagger
 * /parties/{id}/join:
 *   post:
 *     summary: Join a party
 *     description: Accept an invite and join the party.
 *     operationId: partiesJoinPost
 *     tags: [Parties]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Party ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - player
 *             properties:
 *               player:
 *                 type: string
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Party'
 */

/**
 * @swagger
 * /parties/{id}/leave:
 *   post:
 *     summary: Leave a party
 *     description: Leave the current party.
 *     operationId: partiesLeavePost
 *     tags: [Parties]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Party ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - player
 *             properties:
 *               player:
 *                 type: string
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Party'
 */

/**
 * @swagger
 * /parties/{id}/kick:
 *   post:
 *     summary: Kick a player from the party
 *     description: Leader removes a player from the party.
 *     operationId: partiesKickPost
 *     tags: [Parties]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Party ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - player
 *             properties:
 *               player:
 *                 type: string
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Party'
 */

/**
 * @swagger
 * /parties/{id}:
 *   delete:
 *     summary: Disband a party
 *     description: Leader disbands the party.
 *     operationId: partiesDelete
 *     tags: [Parties]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Party ID
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Party'
 */
