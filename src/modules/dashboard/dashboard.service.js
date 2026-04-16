import { getPool } from '../../config/database.js';
import { endOfDay, startOfDay } from './date-range.js';

const formatCurrencySum = (value) => Number(value ?? 0);

export const dashboardService = {
  async getSummary(userId) {
    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());

    const [partiesResult, salesResult, paymentsResult, recentActivityResult] = await Promise.all([
      getPool().query(
        'SELECT current_balance AS currentBalance FROM parties WHERE created_by = ?',
        [userId],
      ),
      getPool().query(
        `SELECT debit_amount AS debitAmount, party_id AS partyId
         FROM ledger_entries
         WHERE created_by = ? AND type = 'sale' AND date BETWEEN ? AND ?`,
        [userId, todayStart, todayEnd],
      ),
      getPool().query(
        `SELECT credit_amount AS creditAmount
         FROM ledger_entries
         WHERE created_by = ? AND type = 'payment' AND date BETWEEN ? AND ?`,
        [userId, todayStart, todayEnd],
      ),
      getPool().query(
        `SELECT
           l.id,
           l.party_id AS partyId,
           l.type,
           l.reference,
           l.debit_amount AS debitAmount,
           l.credit_amount AS creditAmount,
           l.date,
           p.name AS partyName
         FROM ledger_entries l
         INNER JOIN parties p ON p.id = l.party_id
         WHERE l.created_by = ?
         ORDER BY l.date DESC, l.created_at DESC
         LIMIT 5`,
        [userId],
      ),
    ]);
    const parties = partiesResult[0];
    const salesEntries = salesResult[0];
    const paymentEntries = paymentsResult[0];
    const recentActivities = recentActivityResult[0];

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
      recentActivities: recentActivities.map((entry) => ({
        id: String(entry.id),
        partyId: String(entry.partyId),
        partyName: entry.partyName,
        type: entry.type,
        reference: entry.reference,
        amount: Number(entry.type === 'payment' ? entry.creditAmount : entry.debitAmount ?? 0),
        date: entry.date,
      })),
    };
  },

  async getPartySummary(userId, partyId) {
    const [partyResult, entriesResult] = await Promise.all([
      getPool().query(
        `SELECT
           id,
           name,
           phone,
           current_balance AS currentBalance,
           status,
           opening_balance AS openingBalance,
           total_debit AS totalDebit,
           total_credit AS totalCredit,
           closing_balance AS closingBalance,
           last_payment_date AS lastPaymentDate
         FROM parties
         WHERE id = ? AND created_by = ?`,
        [partyId, userId],
      ),
      getPool().query(
        `SELECT
           id,
           type,
           reference,
           debit_amount AS debitAmount,
           credit_amount AS creditAmount,
           balance,
           status_label AS statusLabel,
           date
         FROM ledger_entries
         WHERE party_id = ? AND created_by = ?
         ORDER BY date DESC, created_at DESC
         LIMIT 5`,
        [partyId, userId],
      ),
    ]);
    const party = partyResult[0][0];
    const entries = entriesResult[0];

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
