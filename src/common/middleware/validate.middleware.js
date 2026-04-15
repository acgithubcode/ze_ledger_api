import { StatusCodes } from 'http-status-codes';

import { AppError } from '../errors/app-error.js';

export const validate = (schema) => (request, _response, next) => {
  const { error, value } = schema.validate(
    {
      body: request.body,
      query: request.query,
      params: request.params,
    },
    {
      abortEarly: false,
      stripUnknown: true,
    },
  );

  if (error) {
    next(
      new AppError('Validation failed', StatusCodes.BAD_REQUEST, error.details.map((detail) => detail.message)),
    );
    return;
  }

  request.body = value.body ?? request.body;
  request.query = value.query ?? request.query;
  request.params = value.params ?? request.params;
  next();
};
