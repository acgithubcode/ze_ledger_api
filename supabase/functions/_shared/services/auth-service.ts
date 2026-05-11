import bcrypt from 'npm:bcryptjs@2.4.3';

import type { DbClient } from '../db.ts';
import { AppError } from '../errors.ts';
import { createToken } from '../auth.ts';

const sanitizeUser = (user: {
  id: string | number;
  name: string;
  email: string;
  role: string;
  isGuest: boolean;
  createdAt: string;
  updatedAt: string;
}) => ({
  id: String(user.id),
  name: user.name,
  email: user.email,
  role: user.role,
  isGuest: Boolean(user.isGuest),
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

export const authService = {
  async register(
    db: DbClient,
    payload: { name: string; email: string; password: string },
  ) {
    const email = payload.email.toLowerCase();
    const existingRows = await db.query<{ id: number }>('SELECT id FROM users WHERE email = $1', [email]);

    if (existingRows.length > 0) {
      throw new AppError('A user with this email already exists', 409);
    }

    const hashedPassword = await bcrypt.hash(payload.password, 12);
    const rows = await db.query<{
      id: number;
      name: string;
      email: string;
      role: string;
      isGuest: boolean;
      createdAt: string;
      updatedAt: string;
    }>(
      `INSERT INTO users (name, email, password, role, is_guest)
       VALUES ($1, $2, $3, 'admin', false)
       RETURNING id, name, email, role, is_guest AS "isGuest", created_at AS "createdAt", updated_at AS "updatedAt"`,
      [payload.name, email, hashedPassword],
    );

    const user = rows[0];

    return {
      token: createToken(user),
      user: sanitizeUser(user),
    };
  },

  async login(db: DbClient, payload: { email: string; password: string }) {
    const rows = await db.query<{
      id: number;
      name: string;
      email: string;
      password: string;
      role: string;
      isGuest: boolean;
      createdAt: string;
      updatedAt: string;
    }>(
      `SELECT id, name, email, password, role, is_guest AS "isGuest", created_at AS "createdAt", updated_at AS "updatedAt"
       FROM users WHERE email = $1`,
      [payload.email.toLowerCase()],
    );

    const user = rows[0];

    if (!user) {
      throw new AppError('Invalid email or password', 401);
    }

    const isPasswordValid = await bcrypt.compare(payload.password, user.password);

    if (!isPasswordValid) {
      throw new AppError('Invalid email or password', 401);
    }

    return {
      token: createToken(user),
      user: sanitizeUser(user),
    };
  },

  async loginAsGuest(db: DbClient, payload: { name: string }) {
    const timestamp = Date.now();
    const guestPassword = `Guest@${timestamp}`;
    const hashedPassword = await bcrypt.hash(guestPassword, 12);
    const rows = await db.query<{
      id: number;
      name: string;
      email: string;
      role: string;
      isGuest: boolean;
      createdAt: string;
      updatedAt: string;
    }>(
      `INSERT INTO users (name, email, password, role, is_guest)
       VALUES ($1, $2, $3, 'guest', true)
       RETURNING id, name, email, role, is_guest AS "isGuest", created_at AS "createdAt", updated_at AS "updatedAt"`,
      [payload.name, `guest_${timestamp}@zeledger.local`, hashedPassword],
    );

    const user = rows[0];

    return {
      token: createToken(user),
      user: sanitizeUser(user),
    };
  },

  async getProfile(db: DbClient, userId: string | number) {
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
       FROM users WHERE id = $1`,
      [userId],
    );

    const user = rows[0];

    if (!user) {
      throw new AppError('User not found', 404);
    }

    return sanitizeUser(user);
  },
};
