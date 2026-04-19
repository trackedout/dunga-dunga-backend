import Joi from 'joi';
import 'dotenv/config';

const envVarsSchema = Joi.object()
  .keys({
    NODE_ENV: Joi.string().valid('production', 'development', 'test').required(),
    PORT: Joi.number().default(3000),
    PUBLIC_PORT: Joi.number().default(3001),
    MONGODB_URL: Joi.string().required().description('Mongo DB url'),
    PUBLIC_CORS_ORIGINS: Joi.string().description('Comma-separated allowed origins for public API'),
  })
  .unknown();

const { value: envVars, error } = envVarsSchema.prefs({ errors: { label: 'key' } }).validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

const config = {
  env: envVars.NODE_ENV,
  port: envVars.PORT,
  publicPort: envVars.PUBLIC_PORT,
  mongoose: {
    url: envVars.MONGODB_URL + (envVars.NODE_ENV === 'test' ? '-test' : ''),
    options: {
      useCreateIndex: true,
      useNewUrlParser: true,
      useUnifiedTopology: true,
      poolSize: 50,
    },
  },
  publicCorsOrigins: envVars.PUBLIC_CORS_ORIGINS
    ? (envVars.PUBLIC_CORS_ORIGINS as string).split(',').map((s: string) => s.trim())
    : [],
};

export default config;
