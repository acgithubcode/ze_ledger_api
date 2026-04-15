import { StatusCodes } from 'http-status-codes';

import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { AppError } from '../errors/app-error.js';

export const notFoundHandler = (request, _response, next) => {
  next(new AppError(`Route not found: ${request.method} ${request.originalUrl}`, StatusCodes.NOT_FOUND));
};

export const errorHandler = (error, request, response, _next) => {
  const statusCode = error instanceof AppError ? error.statusCode : StatusCodes.INTERNAL_SERVER_ERROR;
  const payload = {
    success: false,
    message: error.message || 'Internal server error',
    ...(error instanceof AppError && error.details ? { details: error.details } : {}),
    ...(env.nodeEnv !== 'production' ? { stack: error.stack } : {}),
  };

  logger.error(
    {
      error: {
        message: error.message,
        stack: error.stack,
      },
      request: {
        method: request.method,
        url: request.originalUrl,
      },
    },
    'Unhandled application error',
  );

  response.status(statusCode).json(payload);
};
