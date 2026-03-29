import express from 'express';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import swaggerDefinition from '../../modules/swagger/swagger.definition';

const router = express.Router();

const specs = swaggerJsdoc({
  swaggerDefinition,
  apis: ['packages/components.yaml', 'dist/routes/v1/*.js'],
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
router.use('/', ...(swaggerUi.serve as any[]));
router.get(
  '/',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  swaggerUi.setup(specs, {
    explorer: true,
  }) as any
);
router.get('/swagger.json', (_, res) => res.json(specs));

export default router;
