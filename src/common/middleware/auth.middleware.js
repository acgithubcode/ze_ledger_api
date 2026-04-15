import jwt from 'jsonwebtoken';
import { StatusCodes } from 'http-status-codes';

import { getPool } from '../../config/database.js';
import { env } from '../../config/env.js';
import { AppError } from '../errors/app-error.js';

export const authenticate = async (request, _response, next) => {
  try {
    const authorizationHeader = request.headers.authorization || '';
    const token = authorizationHeader.startsWith('Bearer ')
      ? authorizationHeader.slice(7)
      : null;

    if (!token) {
      throw new AppError('Authentication token is required', StatusCodes.UNAUTHORIZED);
    }

    const decoded = jwt.verify(token, env.jwtSecret);
    const [rows] = await getPool().query(
      `SELECT id, name, email, role, is_guest AS isGuest, created_at AS createdAt, updated_at AS updatedAt
       FROM users
       WHERE id = ?`,
      [decoded.sub],
    );
    const user = rows[0];

    if (!user) {
      throw new AppError('User not found for token', StatusCodes.UNAUTHORIZED);
    }

    request.user = user;
    next();
  } catch (error) {
    next(
      error instanceof AppError
        ? error
        : new AppError('Invalid or expired token', StatusCodes.UNAUTHORIZED),
    );
  }
};
