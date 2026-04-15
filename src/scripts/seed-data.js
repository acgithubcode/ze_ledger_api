import bcrypt from 'bcryptjs';

import { getPool, withTransaction } from '../config/database.js';

const demoUser = {
  name: 'Demo Admin',
  email: 'admin@zeledger.local',
  password: 'Admin@123',
  role: 'admin',
  isGuest: false,
};

const partySeeds = [
  {
    name: 'ABC Forging',
    phone: '9876543210',
    openingBalance: 20000,
    totalDebit: 70000,
    totalCredit: 15000,
    closingBalance: 75000,
    currentBalance: 80000,
    status: 'Dr',
    lastPaymentDate: new Date('2026-04-05T00:00:00.000Z'),
  },
  {
    name: 'XYZ Industries',
    phone: '9876500011',
    openingBalance: 15000,
    totalDebit: 68000,
    totalCredit: 18000,
    closingBalance: 65000,
    currentBalance: 65000,
    status: 'Dr',
    lastPaymentDate: new Date('2026-04-10T00:00:00.000Z'),
  },
  {
    name: 'PQR Metals',
    phone: '9876500012',
    openingBalance: 10000,
    totalDebit: 32000,
    totalCredit: 8000,
    closingBalance: 42000,
    currentBalance: 42000,
    status: 'Dr',
    lastPaymentDate: new Date('2026-04-08T00:00:00.000Z'),
  },
];

const ledgerSeedMap = {
  'ABC Forging': [
    {
      type: 'opening_balance',
      reference: 'Opening',
      debitAmount: null,
      creditAmount: null,
      balance: 20000,
      statusLabel: 'Opening',
      date: new Date('2026-04-01T00:00:00.000Z'),
    },
    {
      type: 'sale',
      reference: 'Invoice #101',
      debitAmount: 30000,
      creditAmount: null,
      balance: 50000,
      statusLabel: 'Pending',
      date: new Date('2026-04-03T00:00:00.000Z'),
    },
    {
      type: 'payment',
      reference: 'Bank Transfer',
      debitAmount: null,
      creditAmount: 15000,
      balance: 35000,
      statusLabel: 'Paid',
      date: new Date('2026-04-05T00:00:00.000Z'),
    },
    {
      type: 'sale',
      reference: 'Invoice #109',
      debitAmount: 45000,
      creditAmount: null,
      balance: 80000,
      statusLabel: 'Pending',
      date: new Date(),
    },
  ],
  'XYZ Industries': [
    {
      type: 'opening_balance',
      reference: 'Opening',
      debitAmount: null,
      creditAmount: null,
      balance: 15000,
      statusLabel: 'Opening',
      date: new Date('2026-04-01T00:00:00.000Z'),
    },
    {
      type: 'sale',
      reference: 'Invoice #205',
      debitAmount: 30000,
      creditAmount: null,
      balance: 45000,
      statusLabel: 'Pending',
      date: new Date('2026-04-04T00:00:00.000Z'),
    },
    {
      type: 'payment',
      reference: 'Cash Collection',
      debitAmount: null,
      creditAmount: 10000,
      balance: 35000,
      statusLabel: 'Paid',
      date: new Date('2026-04-10T00:00:00.000Z'),
    },
    {
      type: 'sale',
      reference: 'Invoice #210',
      debitAmount: 30000,
      creditAmount: null,
      balance: 65000,
      statusLabel: 'Pending',
      date: new Date(),
    },
  ],
  'PQR Metals': [
    {
      type: 'opening_balance',
      reference: 'Opening',
      debitAmount: null,
      creditAmount: null,
      balance: 10000,
      statusLabel: 'Opening',
      date: new Date('2026-04-01T00:00:00.000Z'),
    },
    {
      type: 'sale',
      reference: 'Invoice #303',
      debitAmount: 22000,
      creditAmount: null,
      balance: 32000,
      statusLabel: 'Pending',
      date: new Date('2026-04-07T00:00:00.000Z'),
    },
    {
      type: 'payment',
      reference: 'UPI Payment',
      debitAmount: null,
      creditAmount: 8000,
      balance: 24000,
      statusLabel: 'Paid',
      date: new Date('2026-04-08T00:00:00.000Z'),
    },
    {
      type: 'sale',
      reference: 'Invoice #304',
      debitAmount: 18000,
      creditAmount: null,
      balance: 42000,
      statusLabel: 'Pending',
      date: new Date(),
    },
  ],
};

export const seedDatabaseIfNeeded = async () => {
  const [partyCountRows] = await getPool().query('SELECT COUNT(*) AS count FROM parties');
  if (partyCountRows[0].count > 0) {
    return;
  }

  await withTransaction(async (connection) => {
    const [existingUserRows] = await connection.query('SELECT id FROM users WHERE email = ?', [demoUser.email]);

    let adminUserId = existingUserRows[0]?.id;
    if (!adminUserId) {
      const hashedPassword = await bcrypt.hash(demoUser.password, 12);
      const [userResult] = await connection.query(
        `INSERT INTO users (name, email, password, role, is_guest)
         VALUES (?, ?, ?, ?, ?)`,
        [demoUser.name, demoUser.email, hashedPassword, demoUser.role, demoUser.isGuest],
      );
      adminUserId = userResult.insertId;
    }

    for (const partySeed of partySeeds) {
      const [partyResult] = await connection.query(
        `INSERT INTO parties
         (name, phone, opening_balance, total_debit, total_credit, closing_balance, current_balance, status, last_payment_date, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          partySeed.name,
          partySeed.phone,
          partySeed.openingBalance,
          partySeed.totalDebit,
          partySeed.totalCredit,
          partySeed.closingBalance,
          partySeed.currentBalance,
          partySeed.status,
          partySeed.lastPaymentDate,
          adminUserId,
        ],
      );

      const entries = ledgerSeedMap[partySeed.name] || [];
      for (const entry of entries) {
        await connection.query(
          `INSERT INTO ledger_entries
           (party_id, date, type, reference, debit_amount, credit_amount, balance, status_label, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            partyResult.insertId,
            entry.date,
            entry.type,
            entry.reference,
            entry.debitAmount,
            entry.creditAmount,
            entry.balance,
            entry.statusLabel,
            adminUserId,
          ],
        );
      }
    }
  });
};
