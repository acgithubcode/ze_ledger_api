import type { DbClient } from '../db.ts';
import { endOfDay, startOfDay } from '../date-range.ts';

const formatCurrencySum = (value: number | null | undefined) => Number(value ?? 0);

const formatRecentActivity = (entry: {
  id: number;
  partyId: number;
  partyName: string;
  type: string;
  reference: string;
  debitAmount: number | null;
  creditAmount: number | null;
  date: string;
}) => ({
  id: String(entry.id),
  partyId: String(entry.partyId),
  partyName: entry.partyName,
  type: entry.type,
  reference: entry.reference,
  amount: Number(entry.type === 'payment' ? entry.creditAmount : entry.debitAmount ?? 0),
  date: entry.date,
});

const recentActivityQuery = `SELECT
  l.id,
  l.party_id AS "partyId",
  l.type,
  l.reference,
  l.debit_amount AS "debitAmount",
  l.credit_amount AS "creditAmount",
  l.date,
  p.name AS "partyName"
 FROM ledger_entries l
 INNER JOIN parties p ON p.id = l.party_id
 WHERE l.created_by = $1
 ORDER BY l.date DESC, l.created_at DESC
 LIMIT $2`;

export const dashboardService = {
  async getSummary(db: DbClient, userId: string | number) {
    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());

    const [parties, salesEntries, paymentEntries, recentActivities] = await Promise.all([
      db.query<{ currentBalance: number }>(
        'SELECT current_balance AS "currentBalance" FROM parties WHERE created_by = $1',
        [userId],
      ),
      db.query<{ debitAmount: number | null; partyId: number }>(
        `SELECT debit_amount AS "debitAmount", party_id AS "partyId"
         FROM ledger_entries
         WHERE created_by = $1 AND type = 'sale' AND date BETWEEN $2 AND $3`,
        [userId, todayStart, todayEnd],
      ),
      db.query<{ creditAmount: number | null }>(
        `SELECT credit_amount AS "creditAmount"
         FROM ledger_entries
         WHERE created_by = $1 AND type = 'payment' AND date BETWEEN $2 AND $3`,
        [userId, todayStart, todayEnd],
      ),
      db.query<{
        id: number;
        partyId: number;
        partyName: string;
        type: string;
        reference: string;
        debitAmount: number | null;
        creditAmount: number | null;
        date: string;
      }>(recentActivityQuery, [userId, 5]),
    ]);

    const overdueParties = parties.filter((party) => party.currentBalance > 0);

    return {
      todaySales: formatCurrencySum(salesEntries.reduce((sum, entry) => sum + (entry.debitAmount ?? 0), 0)),
      todayCollection: formatCurrencySum(
        paymentEntries.reduce((sum, entry) => sum + (entry.creditAmount ?? 0), 0),
      ),
      totalOutstanding: formatCurrencySum(
        overdueParties.reduce((sum, party) => sum + party.currentBalance, 0),
      ),
      overduePartiesCount: overdueParties.length,
      overdueAmount: formatCurrencySum(
        overdueParties.reduce((sum, party) => sum + party.currentBalance, 0),
      ),
      dueTodayPartiesCount: new Set(salesEntries.map((entry) => entry.partyId.toString())).size,
      dueTodayAmount: formatCurrencySum(
        salesEntries.reduce((sum, entry) => sum + (entry.debitAmount ?? 0), 0),
      ),
      recentActivities: recentActivities.map(formatRecentActivity),
    };
  },

  async getRecentActivity(db: DbClient, userId: string | number, limit = 50) {
    const rows = await db.query<{
      id: number;
      partyId: number;
      partyName: string;
      type: string;
      reference: string;
      debitAmount: number | null;
      creditAmount: number | null;
      date: string;
    }>(recentActivityQuery, [userId, limit]);

    return rows.map(formatRecentActivity);
  },

  async getPartySummary(db: DbClient, userId: string | number, partyId: string | number) {
    const [partyRows, entries] = await Promise.all([
      db.query<{
        id: number;
        name: string;
        phone: string;
        currentBalance: number;
        status: string;
        openingBalance: number;
        totalDebit: number;
        totalCredit: number;
        closingBalance: number;
        lastPaymentDate: string | null;
      }>(
        `SELECT
           id,
           name,
           phone,
           current_balance AS "currentBalance",
           status,
           opening_balance AS "openingBalance",
           total_debit AS "totalDebit",
           total_credit AS "totalCredit",
           closing_balance AS "closingBalance",
           last_payment_date AS "lastPaymentDate"
         FROM parties
         WHERE id = $1 AND created_by = $2`,
        [partyId, userId],
      ),
      db.query<{
        id: number;
        type: string;
        reference: string;
        debitAmount: number | null;
        creditAmount: number | null;
        balance: number;
        statusLabel: string;
        date: string;
      }>(
        `SELECT
           id,
           type,
           reference,
           debit_amount AS "debitAmount",
           credit_amount AS "creditAmount",
           balance,
           status_label AS "statusLabel",
           date
         FROM ledger_entries
         WHERE party_id = $1 AND created_by = $2
         ORDER BY date DESC, created_at DESC
         LIMIT 5`,
        [partyId, userId],
      ),
    ]);

    const party = partyRows[0];

    return {
      party: party
        ? {
            id: String(party.id),
            name: party.name,
            phone: party.phone,
            currentBalance: Number(party.currentBalance),
            status: party.status,
            openingBalance: Number(party.openingBalance),
            totalDebit: Number(party.totalDebit),
            totalCredit: Number(party.totalCredit),
            closingBalance: Number(party.closingBalance),
            lastPaymentDate: party.lastPaymentDate,
          }
        : null,
      recentEntries: entries.map((entry) => ({
        id: String(entry.id),
        type: entry.type,
        reference: entry.reference,
        debitAmount: entry.debitAmount === null ? null : Number(entry.debitAmount),
        creditAmount: entry.creditAmount === null ? null : Number(entry.creditAmount),
        balance: Number(entry.balance),
        statusLabel: entry.statusLabel,
        date: entry.date,
      })),
    };
  },
};
