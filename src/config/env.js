import dotenv from 'dotenv';
import Joi from 'joi';

dotenv.config();

const schema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().port().default(5000),
  API_PREFIX: Joi.string().default('/api/v1'),
  DATABASE_URL: Joi.string().uri({ scheme: ['postgres', 'postgresql'] }).required(),
  DB_SSL: Joi.boolean().truthy('true').truthy('1').falsy('false').falsy('0').default(false),
  DB_CONNECTION_LIMIT: Joi.number().integer().positive().default(10),
  JWT_SECRET: Joi.string().min(24).required(),
  JWT_EXPIRES_IN: Joi.string().default('7d'),
  CORS_ORIGIN: Joi.string().allow('').default(''),
  RATE_LIMIT_WINDOW_MS: Joi.number().integer().positive().default(15 * 60 * 1000),
  RATE_LIMIT_MAX_REQUESTS: Joi.number().integer().positive().default(200),
  LOG_LEVEL: Joi.string().valid('fatal', 'error', 'warn', 'info', 'debug', 'trace').default('info'),
  SEED_ON_BOOT: Joi.boolean().truthy('true').truthy('1').falsy('false').falsy('0').default(false),
}).unknown();

const { error, value } = schema.validate(process.env, {
  abortEarly: false,
  convert: true,
});

if (error) {
  throw new Error(`Environment validation failed: ${error.message}`);
}

export const env = {
  nodeEnv: value.NODE_ENV,
  port: value.PORT,
  apiPrefix: value.API_PREFIX,
  databaseUrl: value.DATABASE_URL,
  dbSsl: value.DB_SSL,
  dbConnectionLimit: value.DB_CONNECTION_LIMIT,
  jwtSecret: value.JWT_SECRET,
  jwtExpiresIn: value.JWT_EXPIRES_IN,
  corsOrigin: value.CORS_ORIGIN,
  rateLimitWindowMs: value.RATE_LIMIT_WINDOW_MS,
  rateLimitMaxRequests: value.RATE_LIMIT_MAX_REQUESTS,
  logLevel: value.LOG_LEVEL,
  seedOnBoot: value.SEED_ON_BOOT,
};
