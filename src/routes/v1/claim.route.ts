import express, { Router } from 'express';
import { validate } from '../../modules/validate';
import { claimController, claimValidation } from '../../modules/claim';

const router: Router = express.Router();

router
  .route('/')
  .get(validate(claimValidation.getClaims), claimController.getClaims)
  .post(validate(claimValidation.createClaims), claimController.createClaims);

router.route('/add-claim').post(validate(claimValidation.createClaim), claimController.createClaim);

router.route('/:claimId').patch(validate(claimValidation.updateClaim), claimController.updateClaim);

router.route('/delete-claim').post(validate(claimValidation.deleteClaim), claimController.deleteClaim);

export default router;

/**
 * @swagger
 * tags:
 *   name: Claim
 *   description: Claim management and retrieval
 */

/**
 * @swagger
 * /claims/add-claim:
 *   post:
 *     summary: Add a claim
 *     description: Add a claim for a player
 *     tags: [Claim]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Claim'
 *     responses:
 *       "201":
 *         description: Created
 *         content:
 *           application/json:
 *             schema:
 *                $ref: '#/components/schemas/Claim'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 */

/**
 * @swagger
 * /claims:
 *   get:
 *     summary: Get all claims
 *     description: Only admins can retrieve all claims.
 *     tags: [Claim]
 *     parameters:
 *       - in: query
 *         name: player
 *         schema:
 *           type: string
 *         description: Player
 *       - in: query
 *         name: state
 *         schema:
 *           type: string
 *         description: Claim state
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *         description: Claim type
 *       - in: query
 *         name: claimant
 *         schema:
 *           type: string
 *         description: Claimant
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
 *         description: Maximum number of claims
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
 *                     $ref: '#/components/schemas/Claim'
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
 * /claims/{id}:
 *   patch:
 *     summary: Edit a claim
 *     description: Add a claim for a player
 *     tags: [Claim]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Claim ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Claim'
 *     responses:
 *       "201":
 *         description: Created
 *         content:
 *           application/json:
 *             schema:
 *                $ref: '#/components/schemas/Claim'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 */

/**
 * @swagger
 * /claims/delete-claim:
 *   post:
 *     summary: Delete a claim
 *     description: Remove a claim from a player's deck. If multiple copies of this claim exist, only one will be removed.
 *     tags: [Claim]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Claim'
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
 * /claims:
 *   post:
 *     summary: Batch update or insert claims
 *     description: Batch update or insert claims
 *     tags: [Claim]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               $ref: '#/components/schemas/Claim'
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
 *                     $ref: '#/components/schemas/Claim'
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
