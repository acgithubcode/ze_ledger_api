import mysql from 'mysql2/promise';

import { env } from './env.js';
import { logger } from './logger.js';

let pool;

const ensureColumn = async (tableName, columnName, definition) => {
  const [rows] = await pool.query(
    `SELECT 1
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
      LIMIT 1`,
    [tableName, columnName],
  );

  if (rows.length > 0) {
    return;
  }

  await pool.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
};

const createTables = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      name VARCHAR(80) NOT NULL,
      email VARCHAR(255) NOT NULL,
      password VARCHAR(255) NOT NULL,
      role ENUM('admin', 'staff', 'guest') NOT NULL DEFAULT 'staff',
      is_guest BOOLEAN NOT NULL DEFAULT FALSE,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_users_email (email)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS parties (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      name VARCHAR(120) NOT NULL,
      phone VARCHAR(20) NOT NULL,
      current_balance DECIMAL(12,2) NOT NULL DEFAULT 0,
      status ENUM('Dr', 'Cr') NOT NULL DEFAULT 'Dr',
      opening_balance DECIMAL(12,2) NOT NULL DEFAULT 0,
      last_payment_date DATETIME NULL,
      total_debit DECIMAL(12,2) NOT NULL DEFAULT 0,
      total_credit DECIMAL(12,2) NOT NULL DEFAULT 0,
      closing_balance DECIMAL(12,2) NOT NULL DEFAULT 0,
      created_by BIGINT UNSIGNED NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_parties_created_by (created_by),
      KEY idx_parties_name (name),
      CONSTRAINT fk_parties_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE CASCADE
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ledger_entries (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      party_id BIGINT UNSIGNED NOT NULL,
      date DATETIME NOT NULL,
      type ENUM('opening_balance', 'sale', 'payment') NOT NULL,
      reference VARCHAR(120) NOT NULL,
      debit_amount DECIMAL(12,2) NULL,
      credit_amount DECIMAL(12,2) NULL,
      balance DECIMAL(12,2) NOT NULL,
      status_label VARCHAR(30) NOT NULL,
      created_by BIGINT UNSIGNED NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_ledger_party_date (party_id, date),
      KEY idx_ledger_created_by_date (created_by, date),
      CONSTRAINT fk_ledger_party FOREIGN KEY (party_id) REFERENCES parties (id) ON DELETE CASCADE,
      CONSTRAINT fk_ledger_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE CASCADE
    )
  `);

  await ensureColumn('ledger_entries', 'invoice_data', 'LONGTEXT NULL AFTER reference');
};

export const connectDatabase = async () => {
  pool = mysql.createPool({
    host: env.dbHost,
    port: env.dbPort,
    database: env.dbName,
    user: env.dbUser,
    password: env.dbPassword,
    waitForConnections: true,
    connectionLimit: env.dbConnectionLimit,
    decimalNumbers: true,
    namedPlaceholders: true,
  });

  await pool.query('SELECT 1');
  await createTables();
  logger.info('Connected to MySQL');
};

export const getPool = () => {
  if (!pool) {
    throw new Error('Database pool has not been initialized');
  }

  return pool;
};

export const withTransaction = async (handler) => {
  const connection = await getPool().getConnection();

  try {
    await connection.beginTransaction();
    const result = await handler(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};
