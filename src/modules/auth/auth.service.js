import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { StatusCodes } from 'http-status-codes';

import { getPool } from '../../config/database.js';
import { env } from '../../config/env.js';
import { AppError } from '../../common/errors/app-error.js';

const createToken = (user) =>
  jwt.sign(
    {
      sub: String(user.id),
      email: user.email,
      role: user.role,
    },
    env.jwtSecret,
    {
      expiresIn: env.jwtExpiresIn,
    },
  );

const sanitizeUser = (user) => ({
  id: String(user.id),
  name: user.name,
  email: user.email,
  role: user.role,
  isGuest: Boolean(user.isGuest),
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

export const authService = {
  async register(payload) {
    const email = payload.email.toLowerCase();
    const [existingRows] = await getPool().query('SELECT id FROM users WHERE email = ?', [email]);
    if (existingRows.length > 0) {
      throw new AppError('A user with this email already exists', StatusCodes.CONFLICT);
    }

    const hashedPassword = await bcrypt.hash(payload.password, 12);
    const [result] = await getPool().query(
      `INSERT INTO users (name, email, password, role, is_guest)
       VALUES (?, ?, ?, 'admin', false)`,
      [payload.name, email, hashedPassword],
    );
    const [rows] = await getPool().query(
      `SELECT id, name, email, role, is_guest AS isGuest, created_at AS createdAt, updated_at AS updatedAt
       FROM users WHERE id = ?`,
      [result.insertId],
    );
    const user = rows[0];

    return {
      token: createToken(user),
      user: sanitizeUser(user),
    };
  },

  async login(payload) {
    const [rows] = await getPool().query(
      `SELECT id, name, email, password, role, is_guest AS isGuest, created_at AS createdAt, updated_at AS updatedAt
       FROM users WHERE email = ?`,
      [payload.email.toLowerCase()],
    );
    const user = rows[0];
    if (!user) {
      throw new AppError('Invalid email or password', StatusCodes.UNAUTHORIZED);
    }

    const isPasswordValid = await bcrypt.compare(payload.password, user.password);
    if (!isPasswordValid) {
      throw new AppError('Invalid email or password', StatusCodes.UNAUTHORIZED);
    }

    return {
      token: createToken(user),
      user: sanitizeUser(user),
    };
  },

  async loginAsGuest(payload) {
    const timestamp = Date.now();
    const guestPassword = `Guest@${timestamp}`;
    const hashedPassword = await bcrypt.hash(guestPassword, 12);
    const [result] = await getPool().query(
      `INSERT INTO users (name, email, password, role, is_guest)
       VALUES (?, ?, ?, 'guest', true)`,
      [payload.name, `guest_${timestamp}@zeledger.local`, hashedPassword],
    );
    const [rows] = await getPool().query(
      `SELECT id, name, email, role, is_guest AS isGuest, created_at AS createdAt, updated_at AS updatedAt
       FROM users WHERE id = ?`,
      [result.insertId],
    );
    const user = rows[0];

    return {
      token: createToken(user),
      user: sanitizeUser(user),
    };
  },

  async getProfile(userId) {
    const [rows] = await getPool().query(
      `SELECT id, name, email, role, is_guest AS isGuest, created_at AS createdAt, updated_at AS updatedAt
       FROM users WHERE id = ?`,
      [userId],
    );
    const user = rows[0];
    if (!user) {
      throw new AppError('User not found', StatusCodes.NOT_FOUND);
    }

    return sanitizeUser(user);
  },
};
