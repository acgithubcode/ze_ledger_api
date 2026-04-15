import { StatusCodes } from 'http-status-codes';

import { AppError } from '../../common/errors/app-error.js';
import { getPool, withTransaction } from '../../config/database.js';

const formatParty = (party) => ({
  id: String(party.id),
  name: party.name,
  phone: party.phone,
  currentBalance: Number(party.currentBalance),
  status: party.status,
  openingBalance: Number(party.openingBalance),
  lastPaymentDate: party.lastPaymentDate,
  totalDebit: Number(party.totalDebit),
  totalCredit: Number(party.totalCredit),
  closingBalance: Number(party.closingBalance),
  createdAt: party.createdAt,
  updatedAt: party.updatedAt,
});

const formatEntry = (entry) => ({
  id: String(entry.id),
  partyId: String(entry.partyId),
  date: entry.date,
  type: entry.type,
  reference: entry.reference,
  debitAmount: entry.debitAmount === null ? null : Number(entry.debitAmount),
  creditAmount: entry.creditAmount === null ? null : Number(entry.creditAmount),
  balance: Number(entry.balance),
  statusLabel: entry.statusLabel,
  createdAt: entry.createdAt,
  updatedAt: entry.updatedAt,
});

export const partyService = {
  async listParties(userId, search = '') {
    const searchPattern = `%${search}%`;
    const [parties] = await getPool().query(
      `SELECT
         id,
         name,
         phone,
         current_balance AS currentBalance,
         status,
         opening_balance AS openingBalance,
         last_payment_date AS lastPaymentDate,
         total_debit AS totalDebit,
         total_credit AS totalCredit,
         closing_balance AS closingBalance,
         created_at AS createdAt,
         updated_at AS updatedAt
       FROM parties
       WHERE created_by = ?
         AND (? = '' OR name LIKE ? OR phone LIKE ?)
       ORDER BY updated_at DESC`,
      [userId, search, searchPattern, searchPattern],
    );
    return parties.map(formatParty);
  },

  async getPartyById(userId, partyId) {
    const [rows] = await getPool().query(
      `SELECT
         id,
         name,
         phone,
         current_balance AS currentBalance,
         status,
         opening_balance AS openingBalance,
         last_payment_date AS lastPaymentDate,
         total_debit AS totalDebit,
         total_credit AS totalCredit,
         closing_balance AS closingBalance,
         created_at AS createdAt,
         updated_at AS updatedAt
       FROM parties
       WHERE id = ? AND created_by = ?`,
      [partyId, userId],
    );
    const party = rows[0];
    if (!party) {
      throw new AppError('Party not found', StatusCodes.NOT_FOUND);
    }

    return formatParty(party);
  },

  async createParty(userId, payload) {
    return withTransaction(async (connection) => {
      const openingBalance = Number(payload.openingBalance ?? 0);
      const initialStatus = openingBalance >= 0 ? 'Dr' : 'Cr';
      const totalDebit = openingBalance > 0 ? openingBalance : 0;

      const [result] = await connection.query(
        `INSERT INTO parties
         (name, phone, current_balance, status, opening_balance, last_payment_date, total_debit, total_credit, closing_balance, created_by)
         VALUES (?, ?, ?, ?, ?, NULL, ?, 0, ?, ?)`,
        [payload.name, payload.phone, openingBalance, initialStatus, openingBalance, totalDebit, openingBalance, userId],
      );

      if (openingBalance > 0) {
        await connection.query(
          `INSERT INTO ledger_entries
           (party_id, date, type, reference, debit_amount, credit_amount, balance, status_label, created_by)
           VALUES (?, ?, 'opening_balance', 'Opening', NULL, NULL, ?, 'Opening', ?)`,
          [result.insertId, new Date(), openingBalance, userId],
        );
      }

      const [rows] = await connection.query(
        `SELECT
           id,
           name,
           phone,
           current_balance AS currentBalance,
           status,
           opening_balance AS openingBalance,
           last_payment_date AS lastPaymentDate,
           total_debit AS totalDebit,
           total_credit AS totalCredit,
           closing_balance AS closingBalance,
           created_at AS createdAt,
           updated_at AS updatedAt
         FROM parties
         WHERE id = ?`,
        [result.insertId],
      );

      return formatParty(rows[0]);
    });
  },

  async listLedgerEntries(userId, partyId) {
    const [partyRows] = await getPool().query('SELECT id FROM parties WHERE id = ? AND created_by = ?', [partyId, userId]);
    if (partyRows.length === 0) {
      throw new AppError('Party not found', StatusCodes.NOT_FOUND);
    }

    const [entries] = await getPool().query(
      `SELECT
         id,
         party_id AS partyId,
         date,
         type,
         reference,
         debit_amount AS debitAmount,
         credit_amount AS creditAmount,
         balance,
         status_label AS statusLabel,
         created_at AS createdAt,
         updated_at AS updatedAt
       FROM ledger_entries
       WHERE party_id = ? AND created_by = ?
       ORDER BY date DESC, created_at DESC`,
      [partyId, userId],
    );
    return entries.map(formatEntry);
  },

  async addLedgerEntry(userId, partyId, payload) {
    return withTransaction(async (connection) => {
      const [partyRows] = await connection.query(
        `SELECT
           id,
           current_balance AS currentBalance,
           total_debit AS totalDebit,
           total_credit AS totalCredit,
           last_payment_date AS lastPaymentDate
         FROM parties
         WHERE id = ? AND created_by = ?
         FOR UPDATE`,
        [partyId, userId],
      );
      const party = partyRows[0];

      if (!party) {
          throw new AppError('Party not found', StatusCodes.NOT_FOUND);
      }

      const amount = Number(payload.amount);
      const isSale = payload.type === 'sale';
      const updatedBalance = Number(party.currentBalance) + (isSale ? amount : -amount);
      const updatedDebit = isSale ? Number(party.totalDebit) + amount : Number(party.totalDebit);
      const updatedCredit = isSale ? Number(party.totalCredit) : Number(party.totalCredit) + amount;
      const entryDate = payload.date ? new Date(payload.date) : new Date();

      await connection.query(
        `UPDATE parties
         SET current_balance = ?,
             total_debit = ?,
             total_credit = ?,
             closing_balance = ?,
             status = ?,
             last_payment_date = ?
         WHERE id = ?`,
        [
          updatedBalance,
          updatedDebit,
          updatedCredit,
          updatedBalance,
          updatedBalance >= 0 ? 'Dr' : 'Cr',
          isSale ? party.lastPaymentDate : entryDate,
          partyId,
        ],
      );

      const [insertResult] = await connection.query(
        `INSERT INTO ledger_entries
         (party_id, date, type, reference, debit_amount, credit_amount, balance, status_label, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          partyId,
          entryDate,
          payload.type,
          payload.reference,
          isSale ? amount : null,
          isSale ? null : amount,
          updatedBalance,
          isSale ? 'Pending' : 'Paid',
          userId,
        ],
      );

      const [rows] = await connection.query(
        `SELECT
           id,
           party_id AS partyId,
           date,
           type,
           reference,
           debit_amount AS debitAmount,
           credit_amount AS creditAmount,
           balance,
           status_label AS statusLabel,
           created_at AS createdAt,
           updated_at AS updatedAt
         FROM ledger_entries
         WHERE id = ?`,
        [insertResult.insertId],
      );

      return formatEntry(rows[0]);
    });
  },
};
