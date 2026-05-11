import type { DbClient } from '../db.ts';
import { withTransaction } from '../db.ts';
import { AppError } from '../errors.ts';

const formatParty = (party: Record<string, unknown>) => ({
  id: String(party.id),
  name: String(party.name),
  phone: String(party.phone),
  gstin: String(party.gstin ?? ''),
  currentBalance: Number(party.currentBalance),
  status: String(party.status),
  openingBalance: Number(party.openingBalance),
  lastPaymentDate: party.lastPaymentDate,
  totalDebit: Number(party.totalDebit),
  totalCredit: Number(party.totalCredit),
  closingBalance: Number(party.closingBalance),
  createdAt: party.createdAt,
  updatedAt: party.updatedAt,
});

const parseInvoiceData = (value: unknown) => {
  if (!value) {
    return null;
  }

  if (typeof value === 'object') {
    return value;
  }

  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  return null;
};

const formatEntry = (entry: Record<string, unknown>) => ({
  id: String(entry.id),
  partyId: String(entry.partyId),
  date: entry.date,
  type: String(entry.type),
  reference: String(entry.reference),
  invoiceData: parseInvoiceData(entry.invoiceData),
  debitAmount: entry.debitAmount === null ? null : Number(entry.debitAmount),
  creditAmount: entry.creditAmount === null ? null : Number(entry.creditAmount),
  balance: Number(entry.balance),
  statusLabel: String(entry.statusLabel),
  createdAt: entry.createdAt,
  updatedAt: entry.updatedAt,
});

const normalizeKey = (value: unknown) =>
  String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();

const roundCurrency = (value: unknown) => Number(Number(value).toFixed(2));

const serializeInvoiceData = (
  payload: Record<string, unknown>,
  party: Record<string, unknown>,
  entryDate: Date,
) => {
  if (!payload.invoiceData || typeof payload.invoiceData !== 'object') {
    return null;
  }

  const invoiceData = payload.invoiceData as Record<string, unknown>;

  return JSON.stringify({
    ...invoiceData,
    partyName: invoiceData.partyName || party.name,
    generatedAt: entryDate.toISOString(),
  });
};

export const partyService = {
  async listParties(db: DbClient, userId: string | number, search = '') {
    const searchPattern = `%${search}%`;
    const parties = await db.query<Record<string, unknown>>(
      `SELECT
         id,
         name,
         phone,
         gstin,
         current_balance AS "currentBalance",
         status,
         opening_balance AS "openingBalance",
         last_payment_date AS "lastPaymentDate",
         total_debit AS "totalDebit",
         total_credit AS "totalCredit",
         closing_balance AS "closingBalance",
         created_at AS "createdAt",
         updated_at AS "updatedAt"
       FROM parties
       WHERE created_by = $1
         AND ($2 = '' OR name ILIKE $3 OR phone ILIKE $3)
       ORDER BY updated_at DESC`,
      [userId, search, searchPattern],
    );

    return parties.map(formatParty);
  },

  async getPartyById(db: DbClient, userId: string | number, partyId: string | number) {
    const rows = await db.query<Record<string, unknown>>(
      `SELECT
         id,
         name,
         phone,
         gstin,
         current_balance AS "currentBalance",
         status,
         opening_balance AS "openingBalance",
         last_payment_date AS "lastPaymentDate",
         total_debit AS "totalDebit",
         total_credit AS "totalCredit",
         closing_balance AS "closingBalance",
         created_at AS "createdAt",
         updated_at AS "updatedAt"
       FROM parties
       WHERE id = $1 AND created_by = $2`,
      [partyId, userId],
    );

    const party = rows[0];

    if (!party) {
      throw new AppError('Party not found', 404);
    }

    return formatParty(party);
  },

  async createParty(userId: string | number, payload: Record<string, unknown>) {
    return withTransaction(async (db) => {
      const openingBalance = Number(payload.openingBalance ?? 0);
      const initialStatus = openingBalance >= 0 ? 'Dr' : 'Cr';
      const totalDebit = openingBalance > 0 ? openingBalance : 0;

      const rows = await db.query<Record<string, unknown>>(
        `INSERT INTO parties
         (name, phone, gstin, current_balance, status, opening_balance, last_payment_date, total_debit, total_credit, closing_balance, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, NULL, $7, 0, $8, $9)
         RETURNING id, name, phone, gstin, current_balance AS "currentBalance", status, opening_balance AS "openingBalance",
                   last_payment_date AS "lastPaymentDate", total_debit AS "totalDebit", total_credit AS "totalCredit",
                   closing_balance AS "closingBalance", created_at AS "createdAt", updated_at AS "updatedAt"`,
        [
          payload.name,
          payload.phone,
          String(payload.gstin ?? '').trim() || null,
          openingBalance,
          initialStatus,
          openingBalance,
          totalDebit,
          openingBalance,
          userId,
        ],
      );

      const party = rows[0];

      if (openingBalance > 0) {
        await db.query(
          `INSERT INTO ledger_entries
           (party_id, date, type, reference, debit_amount, credit_amount, balance, status_label, created_by)
           VALUES ($1, $2, 'opening_balance', 'Opening', NULL, NULL, $3, 'Opening', $4)`,
          [party.id, new Date(), openingBalance, userId],
        );
      }

      return formatParty(party);
    });
  },

  async listLedgerEntries(db: DbClient, userId: string | number, partyId: string | number) {
    const partyRows = await db.query<{ id: number }>(
      'SELECT id FROM parties WHERE id = $1 AND created_by = $2',
      [partyId, userId],
    );

    if (partyRows.length === 0) {
      throw new AppError('Party not found', 404);
    }

    const entries = await db.query<Record<string, unknown>>(
      `SELECT
         id,
         party_id AS "partyId",
         date,
         type,
         reference,
         invoice_data AS "invoiceData",
         debit_amount AS "debitAmount",
         credit_amount AS "creditAmount",
         balance,
         status_label AS "statusLabel",
         created_at AS "createdAt",
         updated_at AS "updatedAt"
       FROM ledger_entries
       WHERE party_id = $1 AND created_by = $2
       ORDER BY date DESC, created_at DESC`,
      [partyId, userId],
    );

    return entries.map(formatEntry);
  },

  async addLedgerEntry(userId: string | number, partyId: string | number, payload: Record<string, unknown>) {
    return withTransaction(async (db) => {
      const partyRows = await db.query<Record<string, unknown>>(
        `SELECT
           id,
           name,
           current_balance AS "currentBalance",
           total_debit AS "totalDebit",
           total_credit AS "totalCredit",
           last_payment_date AS "lastPaymentDate"
         FROM parties
         WHERE id = $1 AND created_by = $2
         FOR UPDATE`,
        [partyId, userId],
      );

      const party = partyRows[0];

      if (!party) {
        throw new AppError('Party not found', 404);
      }

      const amount = Number(payload.amount);
      const isSale = payload.type === 'sale';
      const invoiceData = payload.invoiceData as Record<string, unknown> | undefined;

      if (invoiceData && !isSale) {
        throw new AppError('Invoice data can only be attached to sale entries', 400);
      }

      if (invoiceData) {
        const roundedInvoiceTotal = roundCurrency(invoiceData.total);
        const roundedAmount = roundCurrency(amount);

        if (roundedInvoiceTotal !== roundedAmount) {
          throw new AppError('Invoice total must match the sale amount', 400);
        }
      }

      const updatedBalance = Number(party.currentBalance) + (isSale ? amount : -amount);
      const updatedDebit = isSale ? Number(party.totalDebit) + amount : Number(party.totalDebit);
      const updatedCredit = isSale ? Number(party.totalCredit) : Number(party.totalCredit) + amount;
      const entryDate = payload.date ? new Date(String(payload.date)) : new Date();
      const serializedInvoiceData = serializeInvoiceData(payload, party, entryDate);

      await db.query(
        `UPDATE parties
         SET current_balance = $1,
             total_debit = $2,
             total_credit = $3,
             closing_balance = $4,
             status = $5,
             last_payment_date = $6
         WHERE id = $7`,
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

      const rows = await db.query<Record<string, unknown>>(
        `INSERT INTO ledger_entries
         (party_id, date, type, reference, invoice_data, debit_amount, credit_amount, balance, status_label, created_by)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10)
         RETURNING id, party_id AS "partyId", date, type, reference, invoice_data AS "invoiceData",
                   debit_amount AS "debitAmount", credit_amount AS "creditAmount", balance,
                   status_label AS "statusLabel", created_at AS "createdAt", updated_at AS "updatedAt"`,
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

      return formatEntry(rows[0]);
    });
  },

  async deleteLedgerEntry(userId: string | number, partyId: string | number, entryId: string | number) {
    return withTransaction(async (db) => {
      const partyRows = await db.query<Record<string, unknown>>(
        `SELECT
           id,
           current_balance AS "currentBalance",
           total_debit AS "totalDebit",
           total_credit AS "totalCredit",
           last_payment_date AS "lastPaymentDate"
         FROM parties
         WHERE id = $1 AND created_by = $2
         FOR UPDATE`,
        [partyId, userId],
      );

      const party = partyRows[0];

      if (!party) {
        throw new AppError('Party not found', 404);
      }

      const entryRows = await db.query<Record<string, unknown>>(
        `SELECT
           id,
           party_id AS "partyId",
           date,
           type,
           reference,
           debit_amount AS "debitAmount",
           credit_amount AS "creditAmount",
           balance,
           created_at AS "createdAt"
         FROM ledger_entries
         WHERE id = $1 AND party_id = $2 AND created_by = $3
         LIMIT 1
         FOR UPDATE`,
        [entryId, partyId, userId],
      );

      const entry = entryRows[0];

      if (!entry) {
        throw new AppError('Ledger entry not found', 404);
      }

      if (entry.type !== 'sale') {
        throw new AppError('Only sale entries can be deleted', 400);
      }

      const amount = Number(entry.debitAmount ?? 0);

      await db.query(
        `DELETE FROM ledger_entries
         WHERE id = $1 AND party_id = $2 AND created_by = $3`,
        [entryId, partyId, userId],
      );

      await db.query(
        `UPDATE ledger_entries
         SET balance = balance - $1
         WHERE party_id = $2 AND created_by = $3
           AND (
             date > $4
             OR (date = $5 AND created_at > $6)
             OR (date = $7 AND created_at = $8 AND id > $9)
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
      const latestPaymentRows = await db.query<{ date: string | null }>(
        `SELECT date
         FROM ledger_entries
         WHERE party_id = $1 AND created_by = $2 AND type = 'payment'
         ORDER BY date DESC, created_at DESC, id DESC
         LIMIT 1`,
        [partyId, userId],
      );

      await db.query(
        `UPDATE parties
         SET current_balance = $1,
             total_debit = $2,
             closing_balance = $3,
             status = $4,
             last_payment_date = $5
         WHERE id = $6`,
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
        type: String(entry.type),
        amount,
      };
    });
  },

  async importSales(userId: string | number, payload: { createMissingParties?: boolean; rows: Record<string, unknown>[] }) {
    return withTransaction(async (db) => {
      const partyRows = await db.query<Record<string, unknown>>(
        `SELECT
           id,
           name,
           phone,
           gstin,
           current_balance AS "currentBalance",
           status,
           opening_balance AS "openingBalance",
           last_payment_date AS "lastPaymentDate",
           total_debit AS "totalDebit",
           total_credit AS "totalCredit",
           closing_balance AS "closingBalance",
           created_at AS "createdAt",
           updated_at AS "updatedAt"
         FROM parties
         WHERE created_by = $1`,
        [userId],
      );

      const partyMap = new Map(partyRows.map((party) => [normalizeKey(party.name), { ...party }]));
      const createdParties: ReturnType<typeof formatParty>[] = [];
      const imported: Record<string, unknown>[] = [];
      const duplicates: Record<string, unknown>[] = [];
      const skipped: Record<string, unknown>[] = [];

      for (const row of payload.rows) {
        const normalizedPartyName = normalizeKey(row.partyName);
        let party = partyMap.get(normalizedPartyName);
        const importReference = `${String(row.reference).trim()} (${String(row.monthName)})`;

        if (!party && payload.createMissingParties) {
          const createdRows = await db.query<Record<string, unknown>>(
            `INSERT INTO parties
             (name, phone, gstin, current_balance, status, opening_balance, last_payment_date, total_debit, total_credit, closing_balance, created_by)
             VALUES ($1, $2, $3, 0, 'Dr', 0, NULL, 0, 0, 0, $4)
             RETURNING id, name, phone, gstin, current_balance AS "currentBalance", status, opening_balance AS "openingBalance",
                       last_payment_date AS "lastPaymentDate", total_debit AS "totalDebit", total_credit AS "totalCredit",
                       closing_balance AS "closingBalance", created_at AS "createdAt", updated_at AS "updatedAt"`,
            [String(row.partyName).trim(), '0000000000', String(row.gstin ?? '').trim() || null, userId],
          );

          party = createdRows[0];
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

        const duplicateRows = await db.query<{ id: number }>(
          `SELECT id
           FROM ledger_entries
           WHERE created_by = $1 AND party_id = $2 AND type = 'sale' AND reference = $3
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
        const entryDate = new Date(String(row.date));

        await db.query(
          `UPDATE parties
           SET current_balance = $1,
               total_debit = $2,
               closing_balance = $3,
               status = 'Dr'
           WHERE id = $4`,
          [updatedBalance, updatedDebit, updatedBalance, party.id],
        );

        const rows = await db.query<Record<string, unknown>>(
          `INSERT INTO ledger_entries
           (party_id, date, type, reference, debit_amount, credit_amount, balance, status_label, created_by)
           VALUES ($1, $2, 'sale', $3, $4, NULL, $5, 'Imported', $6)
           RETURNING id`,
          [party.id, entryDate, importReference, amount, updatedBalance, userId],
        );

        party.currentBalance = updatedBalance;
        party.totalDebit = updatedDebit;
        party.closingBalance = updatedBalance;
        party.status = 'Dr';
        partyMap.set(normalizedPartyName, party);

        imported.push({
          id: String(rows[0].id),
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
