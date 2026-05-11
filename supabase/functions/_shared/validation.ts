import Joi from 'npm:joi@17.13.3';

import { AppError } from './errors.ts';

export const validate = <T>(schema: Joi.ObjectSchema<T>, input: Record<string, unknown>) => {
  const { error, value } = schema.validate(input, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    throw new AppError(
      'Validation failed',
      400,
      error.details.map((detail) => detail.message),
    );
  }

  return value;
};

export const readJsonBody = async (request: Request) => {
  const rawBody = await request.text();

  if (!rawBody.trim()) {
    return {};
  }

  try {
    return JSON.parse(rawBody);
  } catch {
    throw new AppError('Request body must be valid JSON', 400);
  }
};
