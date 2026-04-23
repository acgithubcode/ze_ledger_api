import { StatusCodes } from 'http-status-codes';

import { AppError } from '../../common/errors/app-error.js';
import { getPool, withTransaction } from '../../config/database.js';

const formatParty = (party) => ({
  id: String(party.id),
  name: party.name,
  phone: party.phone,
  gstin: party.gstin || '',
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
  invoiceData: parseInvoiceData(entry.invoiceData),
  debitAmount: entry.debitAmount === null ? null : Number(entry.debitAmount),
  creditAmount: entry.creditAmount === null ? null : Number(entry.creditAmount),
  balance: Number(entry.balance),
  statusLabel: entry.statusLabel,
  createdAt: entry.createdAt,
  updatedAt: entry.updatedAt,
});

const normalizeKey = (value) =>
  String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();

const parseInvoiceData = (value) => {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const roundCurrency = (value) => Number(Number(value).toFixed(2));

const serializeInvoiceData = (payload, party, entryDate) => {
  if (!payload.invoiceData) {
    return null;
  }

  return JSON.stringify({
    ...payload.invoiceData,
    partyName: payload.invoiceData.partyName || party.name,
    generatedAt: entryDate.toISOString(),
  });
};

export const partyService = {
  async listParties(userId, search = '') {
    const searchPattern = `%${search}%`;
    const [parties] = await getPool().query(
      `SELECT
         id,
         name,
         phone,
         gstin,
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
         (name, phone, gstin, current_balance, status, opening_balance, last_payment_date, total_debit, total_credit, closing_balance, created_by)
         VALUES (?, ?, ?, ?, ?, ?, NULL, ?, 0, ?, ?)`,
        [
          payload.name,
          payload.phone,
          payload.gstin?.trim() || null,
          openingBalance,
          initialStatus,
          openingBalance,
          totalDebit,
          openingBalance,
          userId,
        ],
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
           gstin,
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
         invoice_data AS invoiceData,
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
      const invoiceData = payload.invoiceData ?? null;

      if (invoiceData && !isSale) {
        throw new AppError('Invoice data can only be attached to sale entries', StatusCodes.BAD_REQUEST);
      }

      if (invoiceData) {
        const roundedInvoiceTotal = roundCurrency(invoiceData.total);
        const roundedAmount = roundCurrency(amount);
        if (roundedInvoiceTotal !== roundedAmount) {
          throw new AppError('Invoice total must match the sale amount', StatusCodes.BAD_REQUEST);
        }
      }

      const updatedBalance = Number(party.currentBalance) + (isSale ? amount : -amount);
      const updatedDebit = isSale ? Number(party.totalDebit) + amount : Number(party.totalDebit);
      const updatedCredit = isSale ? Number(party.totalCredit) : Number(party.totalCredit) + amount;
      const entryDate = payload.date ? new Date(payload.date) : new Date();
      const serializedInvoiceData = serializeInvoiceData(payload, party, entryDate);

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
         (party_id, date, type, reference, invoice_data, debit_amount, credit_amount, balance, status_label, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          partyId,
          entryDate,
          payload.type,
          payload.reference,
          serializedInvoiceData,
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
           invoice_data AS invoiceData,
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

  async deleteLedgerEntry(userId, partyId, entryId) {
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

      const [entryRows] = await connection.query(
        `SELECT
           id,
           party_id AS partyId,
           date,
           type,
           reference,
           debit_amount AS debitAmount,
           credit_amount AS creditAmount,
           balance,
           created_at AS createdAt
         FROM ledger_entries
         WHERE id = ? AND party_id = ? AND created_by = ?
         LIMIT 1
         FOR UPDATE`,
        [entryId, partyId, userId],
      );
      const entry = entryRows[0];

      if (!entry) {
        throw new AppError('Ledger entry not found', StatusCodes.NOT_FOUND);
      }

      if (entry.type !== 'sale') {
        throw new AppError('Only sale entries can be deleted', StatusCodes.BAD_REQUEST);
      }

      const amount = Number(entry.debitAmount ?? 0);

      await connection.query(
        `DELETE FROM ledger_entries
         WHERE id = ? AND party_id = ? AND created_by = ?`,
        [entryId, partyId, userId],
      );

      await connection.query(
        `UPDATE ledger_entries
         SET balance = balance - ?
         WHERE party_id = ? AND created_by = ?
           AND (
             date > ?
             OR (date = ? AND created_at > ?)
             OR (date = ? AND created_at = ? AND id > ?)
           )`,
        [
          amount,
          partyId,
          userId,
          entry.date,
          entry.date,
          entry.createdAt,
          entry.date,
          entry.createdAt,
          entry.id,
        ],
      );

      const updatedBalance = Number(party.currentBalance) - amount;
      const updatedDebit = Number(party.totalDebit) - amount;

      const [latestPaymentRows] = await connection.query(
        `SELECT date
         FROM ledger_entries
         WHERE party_id = ? AND created_by = ? AND type = 'payment'
         ORDER BY date DESC, created_at DESC, id DESC
         LIMIT 1`,
        [partyId, userId],
      );

      await connection.query(
        `UPDATE parties
         SET current_balance = ?,
             total_debit = ?,
             closing_balance = ?,
             status = ?,
             last_payment_date = ?
         WHERE id = ?`,
        [
          updatedBalance,
          updatedDebit,
          updatedBalance,
          updatedBalance >= 0 ? 'Dr' : 'Cr',
          latestPaymentRows[0]?.date ?? null,
          partyId,
        ],
      );

      return {
        id: String(entry.id),
        partyId: String(entry.partyId),
        type: entry.type,
        amount,
      };
    });
  },

  async importSales(userId, payload) {
    return withTransaction(async (connection) => {
      const [partyRows] = await connection.query(
      `SELECT
         id,
         name,
         phone,
         gstin,
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
         WHERE created_by = ?`,
        [userId],
      );

      const partyMap = new Map(
        partyRows.map((party) => [normalizeKey(party.name), { ...party }]),
      );
      const createdParties = [];
      const imported = [];
      const duplicates = [];
      const skipped = [];

      for (const row of payload.rows) {
        const normalizedPartyName = normalizeKey(row.partyName);
        let party = partyMap.get(normalizedPartyName);
        const importReference = `${row.reference.trim()} (${row.monthName})`;

        if (!party && payload.createMissingParties) {
          const [createPartyResult] = await connection.query(
            `INSERT INTO parties
             (name, phone, gstin, current_balance, status, opening_balance, last_payment_date, total_debit, total_credit, closing_balance, created_by)
             VALUES (?, ?, ?, 0, 'Dr', 0, NULL, 0, 0, 0, ?)`,
            [row.partyName.trim(), '0000000000', row.gstin?.trim() || null, userId],
          );

          const [newPartyRows] = await connection.query(
            `SELECT
               id,
               name,
               phone,
               gstin,
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
            [createPartyResult.insertId],
          );
          party = newPartyRows[0];
          partyMap.set(normalizedPartyName, { ...party });
          createdParties.push(formatParty(party));
        }

        if (!party) {
          skipped.push({
            monthName: row.monthName,
            reference: row.reference,
            partyName: row.partyName,
            reason: 'Party not found',
          });
          continue;
        }

        const [duplicateRows] = await connection.query(
          `SELECT id
           FROM ledger_entries
           WHERE created_by = ? AND party_id = ? AND type = 'sale' AND reference = ?
           LIMIT 1`,
          [userId, party.id, importReference],
        );

        if (duplicateRows.length > 0) {
          duplicates.push({
            monthName: row.monthName,
            reference: row.reference,
            partyName: row.partyName,
          });
          continue;
        }

        const amount = Number(row.amount);
        const updatedBalance = Number(party.currentBalance) + amount;
        const updatedDebit = Number(party.totalDebit) + amount;
        const entryDate = new Date(row.date);

        await connection.query(
          `UPDATE parties
           SET current_balance = ?,
               total_debit = ?,
               closing_balance = ?,
               status = 'Dr'
           WHERE id = ?`,
          [updatedBalance, updatedDebit, updatedBalance, party.id],
        );

        const [insertResult] = await connection.query(
          `INSERT INTO ledger_entries
           (party_id, date, type, reference, debit_amount, credit_amount, balance, status_label, created_by)
           VALUES (?, ?, 'sale', ?, ?, NULL, ?, 'Imported', ?)`,
          [party.id, entryDate, importReference, amount, updatedBalance, userId],
        );

        party.currentBalance = updatedBalance;
        party.totalDebit = updatedDebit;
        party.closingBalance = updatedBalance;
        party.status = 'Dr';
        partyMap.set(normalizedPartyName, party);

        imported.push({
          id: String(insertResult.insertId),
          monthName: row.monthName,
          reference: importReference,
          partyId: String(party.id),
          partyName: party.name,
          amount,
          quantity: row.quantity ?? null,
          date: entryDate,
        });
      }

      return {
        totalRows: payload.rows.length,
        importedCount: imported.length,
        duplicateCount: duplicates.length,
        skippedCount: skipped.length,
        createdPartiesCount: createdParties.length,
        imported,
        duplicates,
        skipped,
        createdParties,
      };
    });
  },
};
