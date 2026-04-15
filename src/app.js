import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import hpp from 'hpp';
import morgan from 'morgan';

import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { errorHandler, notFoundHandler } from './common/middleware/error.middleware.js';
import { apiRouter } from './routes/index.js';

const app = express();

const allowedOrigins = env.corsOrigin
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.set('trust proxy', 1);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('Origin not allowed by CORS'));
    },
    credentials: true,
  }),
);

app.use(helmet());
app.use(
  rateLimit({
    windowMs: env.rateLimitWindowMs,
    max: env.rateLimitMaxRequests,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(hpp());
app.use(
  morgan('combined', {
    stream: {
      write: (message) => logger.info(message.trim()),
    },
  }),
);

app.get('/', (_request, response) => {
  response.json({
    success: true,
    message: 'ZE Ledger API is running.',
    docs: `${env.apiPrefix}/health`,
  });
});

app.use(env.apiPrefix, apiRouter);
app.use(notFoundHandler);
app.use(errorHandler);

export { app };
