import jwt from 'npm:jsonwebtoken@9.0.2';

import type { DbClient } from './db.ts';
import { AppError } from './errors.ts';

const jwtSecret = Deno.env.get('JWT_SECRET');
const jwtExpiresIn = Deno.env.get('JWT_EXPIRES_IN') ?? '7d';

if (!jwtSecret) {
  throw new Error('JWT_SECRET secret is required');
}

export const createToken = (user: { id: string | number; email: string; role: string }) =>
  jwt.sign(
    {
      sub: String(user.id),
      email: user.email,
      role: user.role,
    },
    jwtSecret,
    {
      expiresIn: jwtExpiresIn,
    },
  );

export const requireUser = async (request: Request, db: DbClient) => {
  const authorizationHeader = request.headers.get('authorization') ?? '';
  const token = authorizationHeader.startsWith('Bearer ')
    ? authorizationHeader.slice(7)
    : null;

  if (!token) {
    throw new AppError('Authentication token is required', 401);
  }

  try {
    const decoded = jwt.verify(token, jwtSecret) as { sub: string };
    const rows = await db.query<{
      id: number;
      name: string;
      email: string;
      role: string;
      isGuest: boolean;
      createdAt: string;
      updatedAt: string;
    }>(
      `SELECT id, name, email, role, is_guest AS "isGuest", created_at AS "createdAt", updated_at AS "updatedAt"
       FROM users
       WHERE id = $1`,
      [decoded.sub],
    );

    const user = rows[0];

    if (!user) {
      throw new AppError('User not found for token', 401);
    }

    return user;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError('Invalid or expired token', 401);
  }
};
