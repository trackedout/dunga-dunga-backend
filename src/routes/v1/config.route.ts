import express, { Router } from 'express';
import { validate } from '../../modules/validate';
import { configController, configValidation } from '../../modules/config';

const router: Router = express.Router();

router
  .route('/')
  .get(validate(configValidation.getConfig), configController.getConfig)
  .post(validate(configValidation.createConfigs), configController.createConfigs);

router.route('/list').get(validate(configValidation.getConfigs), configController.getConfigs);

router.route('/add-config').post(validate(configValidation.createConfig), configController.createConfig);

router.route('/delete-config').post(validate(configValidation.deleteConfig), configController.deleteConfig);

export default router;

/**
 * @swagger
 * tags:
 *   name: Config
 *   description: Config management and retrieval
 */

/**
 * @swagger
 * /configs:
 *   get:
 *     summary: Get a single config
 *     description: Get a single config
 *     tags: [Config]
 *     parameters:
 *       - in: query
 *         name: server
 *         schema:
 *           type: string
 *         description: Server
 *       - in: query
 *         name: key
 *         schema:
 *           type: string
 *         description: Config key
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
 *                     $ref: '#/components/schemas/Config'
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
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 */

/**
 * @swagger
 * /configs/add-config:
 *   post:
 *     summary: Add a config
 *     description: Add a config for a server
 *     tags: [Config]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Config'
 *     responses:
 *       "201":
 *         description: Created
 *         content:
 *           application/json:
 *             schema:
 *                $ref: '#/components/schemas/Config'
 */

/**
 * @swagger
 * /configs/list:
 *   get:
 *     summary: Get all configs
 *     description: Only admins can retrieve all configs.
 *     tags: [Config]
 *     parameters:
 *       - in: query
 *         name: server
 *         schema:
 *           type: string
 *         description: Server
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
 *         description: Maximum number of configs
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
 *               $ref: '#/components/schemas/Config'
 */

/**
 * @swagger
 * /configs/delete-config:
 *   post:
 *     summary: Delete a config
 *     description: Remove a config
 *     tags: [Config]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Config'
 *     responses:
 *       "200":
 *         description: No content
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 */
