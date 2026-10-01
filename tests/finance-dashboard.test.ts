// Sprint 5Z-8: transaction grouping (JournalEntry.TransactionID), the Opening Balance Equity account and goal targets,
// the account drill-down (finance.getAccountLedger), the liquidity gauges, the balance sheet's year-to-date surplus,
// the presentation ledger, and the general ledger screens' permission mirrors.
import { describe, expect, it } from 'vitest';
import {
  buildBalanceSheet,
  buildChartOfAccounts,
  buildLiquidityGauges,
  canPostGeneralLedger,
  canReadGeneralLedger,
  formatTransactionId,
  portalAreas,
  type DataService,
  type GLAccount,
  type JournalEntry,
  type JournalLineInput,
} from '@kofc/shared';
import { MemoryDataService } from '../apps/web/services/drivers/memory';
import { SqliteDataService } from '../apps/mobile/services/drivers/sqlite';
import { drivers, expectRule, MEMBER, NOW } from './helpers';
import { openDatabases } from './shims/expo-sqlite';

// Dev seed: council 1 is 15295 (Admin 2 is its Financial Secretary, Member 3 a plain member); council 2 exists.
const OWN = 1;
const ACCT = { checking: 1, goal1: 2, goal2: 3, savings: 4, physical: 6, dues: 7, councilCosts: 13, openingEquity: 15 } as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const account = (over: Partial<GLAccount>): GLAccount => ({
  id: 1,
  CouncilID: OWN,
  AccountName: 'Account',
  AccountType: 'Asset',
  ParentAccountID: null,
  IsVirtualGoal: 0,
  TargetGoalAmount: 0,
  ...over,
});

const entry = (over: Partial<JournalEntry>): JournalEntry => ({
  id: 1,
  CouncilID: OWN,
  GLAccountID: 1,
  DateLogged: '2026-09-10 00:00:00',
  Description: 'Entry',
  DebitAmount: 0,
  CreditAmount: 0,
  LinkedEventID: null,
  LinkedMeetingID: null,
  IsBankReconciled: 0,
  CheckNumber: null,
  TransactionID: 't1',
  ...over,
});

const opening = (amount: number, date = '2026-07-01'): JournalLineInput[] => [
  { GLAccountID: ACCT.checking, DebitAmount: amount, Description: 'Opening balance', DateLogged: date },
  { GLAccountID: ACCT.openingEquity, CreditAmount: amount, Description: 'Opening balance', DateLogged: date },
];

describe('transaction ids (pure)', () => {
  it('formats 16 random bytes as a version 4 UUID', () => {
    expect(formatTransactionId(new Uint8Array(16))).toBe('00000000-0000-4000-8000-000000000000');
    expect(formatTransactionId(new Uint8Array(16).fill(255))).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff');
    expect(formatTransactionId(globalThis.crypto.getRandomValues(new Uint8Array(16)))).toMatch(UUID);
    expect(() => formatTransactionId(new Uint8Array(8))).toThrow();
  });
});

describe('liquidity gauges and the year-to-date surplus (pure)', () => {
  const accounts = [
    account({ id: 1, AccountName: 'Operating Checking' }),
    account({ id: 2, AccountName: 'Goal Account #1', ParentAccountID: 1, IsVirtualGoal: 1, TargetGoalAmount: 4000 }),
    account({ id: 3, AccountName: 'Goal Account #2', ParentAccountID: 1, IsVirtualGoal: 1, TargetGoalAmount: 0 }),
    account({ id: 4, AccountName: 'General Savings' }),
    account({ id: 7, AccountName: 'Dues', AccountType: 'Revenue' }),
    account({ id: 13, AccountName: 'Costs', AccountType: 'Expense' }),
    account({ id: 15, AccountName: 'Opening Balance Equity', AccountType: 'Equity' }),
  ];
  const entries = [
    entry({ id: 1, GLAccountID: 1, DebitAmount: 5000, DateLogged: '2026-06-01 00:00:00', TransactionID: 'a' }),
    entry({ id: 2, GLAccountID: 15, CreditAmount: 5000, DateLogged: '2026-06-01 00:00:00', TransactionID: 'a' }),
    entry({ id: 3, GLAccountID: 1, DebitAmount: 300, DateLogged: '2026-06-30 00:00:00', TransactionID: 'b' }),
    entry({ id: 4, GLAccountID: 7, CreditAmount: 300, DateLogged: '2026-06-30 00:00:00', TransactionID: 'b' }),
    entry({ id: 5, GLAccountID: 1, DebitAmount: 200, DateLogged: '2026-07-01 00:00:00', TransactionID: 'c' }),
    entry({ id: 6, GLAccountID: 7, CreditAmount: 200, DateLogged: '2026-07-01 00:00:00', TransactionID: 'c' }),
    entry({ id: 7, GLAccountID: 13, DebitAmount: 50.25, DateLogged: '2026-09-01 00:00:00', TransactionID: 'd' }),
    entry({ id: 8, GLAccountID: 1, CreditAmount: 50.25, DateLogged: '2026-09-01 00:00:00', TransactionID: 'd' }),
    entry({ id: 9, GLAccountID: 2, DebitAmount: 1000, TransactionID: 'e' }),
    entry({ id: 10, GLAccountID: 1, CreditAmount: 1000, TransactionID: 'e' }),
  ];

  it('shows each bank account with goals as cash, reserved and liquid', () => {
    const [gauge, ...rest] = buildLiquidityGauges(buildChartOfAccounts(OWN, accounts, entries));
    expect(rest).toEqual([]);
    expect(gauge).toMatchObject({ totalCash: 5449.75, reserved: 1000, liquid: 4449.75 });
    expect(gauge.account.AccountName).toBe('Operating Checking');
    expect(gauge.goals.map((g) => [g.account.id, g.balance, g.target, g.percentFunded])).toEqual([
      [2, 1000, 4000, 25],
      [3, 0, 0, null],
    ]);
  });

  it('splits the surplus at the fraternal year July 1', () => {
    const sheet = buildBalanceSheet(OWN, accounts, entries, NOW);
    expect(sheet).toMatchObject({ fraternalYear: '2026-2027', netSurplus: 449.75, yearToDateSurplus: 149.75, priorYearsSurplus: 300, isBalanced: true });
    expect(sheet.equity.lines.map((l) => [l.accountName, l.balance])).toEqual([['Opening Balance Equity', 5000]]);
  });
});

describe('general ledger screens (permissions)', () => {
  const actor = (over: Partial<Parameters<typeof portalAreas>[0]> = {}) => ({ memberId: 10, councilId: OWN, memberType: 'Member' as const, isOfficer: false, ...over });
  const FINANCE_AREAS = ['finance/dashboard', 'finance/ledger', 'finance/balance-sheet'];

  it('opens the ledger screens to seated officers, Admins and Super Admins, never to plain members', () => {
    for (const u of [actor({ isOfficer: true, roles: ['Recorder'] }), actor({ memberType: 'Admin' }), actor({ memberType: 'Super Admin' })]) {
      expect(portalAreas(u)).toEqual(expect.arrayContaining(FINANCE_AREAS));
      expect(canReadGeneralLedger(u, OWN)).toBe(true);
    }
    expect(portalAreas(actor()).filter((a) => a.startsWith('finance/'))).toEqual([]);
    expect(canReadGeneralLedger(actor(), OWN)).toBe(false);
    expect(canReadGeneralLedger(actor({ isOfficer: true }), 2)).toBe(false);
    expect(canReadGeneralLedger(actor({ memberType: 'Super Admin' }), 2)).toBe(true);
  });

  it('keeps the quick actions with the finance officers and Super Admins', () => {
    expect(canPostGeneralLedger(actor({ isOfficer: true, roles: ['Treasurer'] }), OWN)).toBe(true);
    expect(canPostGeneralLedger(actor({ isOfficer: true, roles: ['Financial Secretary'] }), OWN)).toBe(true);
    expect(canPostGeneralLedger(actor({ isOfficer: true, roles: ['Treasurer'] }), 2)).toBe(false);
    expect(canPostGeneralLedger(actor({ memberType: 'Admin' }), OWN)).toBe(false);
    expect(canPostGeneralLedger(actor({ isOfficer: true, roles: ['Grand Knight'] }), OWN)).toBe(false);
    expect(canPostGeneralLedger(actor({ memberType: 'Super Admin' }), 2)).toBe(true);
  });
});

describe.each(drivers)('transaction grouping and drill-down ($name driver)', (d) => {
  it('seeds Opening Balance Equity and the goal targets', async () => {
    const db = await d.make();
    const sheet = await db.finance.getLatestBalanceSheet(MEMBER.admin, OWN);
    expect(sheet.equity.lines.map((l) => [l.accountId, l.accountName])).toEqual([[ACCT.openingEquity, 'Opening Balance Equity']]);
    const gauges = buildLiquidityGauges(await db.finance.listChartOfAccounts(MEMBER.admin, OWN));
    expect(gauges.map((g) => g.goals.map((x) => [x.account.AccountName, x.target]))).toEqual([
      [
        ['Goal Account #1', 4000],
        ['Goal Account #2', 1500],
      ],
    ]);
  });

  it('stamps every line of one posting with one new UUID, and each posting with its own', async () => {
    const db = await d.make();
    const first = await db.finance.logDoubleEntryTransaction(MEMBER.admin, [
      { GLAccountID: ACCT.checking, DebitAmount: 600, Description: 'Opening' },
      { GLAccountID: ACCT.savings, DebitAmount: 400, Description: 'Opening' },
      { GLAccountID: ACCT.openingEquity, CreditAmount: 1000, Description: 'Opening' },
    ]);
    const transfer = await db.finance.transferAssetFunds(MEMBER.admin, ACCT.checking, ACCT.goal1, 100);
    expect(first[0].TransactionID).toMatch(UUID);
    expect(new Set(first.map((l) => l.TransactionID)).size).toBe(1);
    expect(new Set(transfer.map((l) => l.TransactionID)).size).toBe(1);
    expect(transfer[0].TransactionID).not.toBe(first[0].TransactionID);
  });

  it('drills into an account: oldest first, running balance, and every line of each posting', async () => {
    const db = await d.make();
    await db.finance.logDoubleEntryTransaction(MEMBER.admin, opening(1000));
    await db.finance.logDoubleEntryTransaction(MEMBER.admin, [
      { GLAccountID: ACCT.councilCosts, DebitAmount: 75.5, Description: 'Hall rental', DateLogged: '2026-07-05', CheckNumber: '1201' },
      { GLAccountID: ACCT.checking, CreditAmount: 75.5, Description: 'Hall rental', DateLogged: '2026-07-05', CheckNumber: '1201' },
    ]);
    // Posted later but dated earlier: the ledger reads by date.
    await db.finance.logDoubleEntryTransaction(MEMBER.admin, [
      { GLAccountID: ACCT.checking, DebitAmount: 20, Description: 'Late-entered dues', DateLogged: '2026-06-30' },
      { GLAccountID: ACCT.dues, CreditAmount: 20, Description: 'Late-entered dues', DateLogged: '2026-06-30' },
    ]);
    const ledger = await db.finance.getAccountLedger(MEMBER.admin, ACCT.checking);
    expect(ledger).toMatchObject({ balance: 944.5, debitTotal: 1020, creditTotal: 75.5 });
    expect(ledger.rows.map((r) => [r.entry.Description, r.runningBalance])).toEqual([
      ['Late-entered dues', 20],
      ['Opening balance', 1020],
      ['Hall rental', 944.5],
    ]);
    expect(ledger.rows[2].entry.CheckNumber).toBe('1201');
    expect(ledger.rows[2].transactionLines.map((l) => [l.accountName, l.entry.DebitAmount, l.entry.CreditAmount])).toEqual([
      ['Council Operational Costs', 75.5, 0],
      ['Operating Checking', 0, 75.5],
    ]);
    const equity = await db.finance.getAccountLedger(MEMBER.admin, ACCT.openingEquity);
    expect(equity.balance).toBe(1000);
  });

  it('guards the drill-down like the rest of the books', async () => {
    const db = await d.make();
    await expectRule(db.finance.getAccountLedger(MEMBER.admin, 9999), 'RECORD_NOT_FOUND');
    await expectRule(db.finance.getAccountLedger(MEMBER.member, ACCT.checking), 'ADMIN_REQUIRED');
  });
});

describe('presentation ledger (Seed.sql below @presentation-data)', () => {
  const make: [string, () => Promise<DataService>][] = [
    ['memory', async () => {
      const db = new MemoryDataService({ now: () => new Date(NOW), presentationData: true });
      await db.init();
      return db;
    }],
    ['sqlite', async () => {
      openDatabases.length = 0;
      const db = new SqliteDataService({ now: () => new Date(NOW), presentationData: true });
      await db.init();
      return db;
    }],
  ];

  it.each(make)('balances every posting and the whole sheet (%s)', async (_name, create) => {
    const db = await create();
    const sheet = await db.finance.getLatestBalanceSheet(MEMBER.admin, OWN);
    expect(sheet).toMatchObject({ isBalanced: true, difference: 0, totalAssets: 18680.6, entryCount: 31 });
    const chart = await db.finance.listChartOfAccounts(MEMBER.admin, OWN);
    const [gauge] = buildLiquidityGauges(chart);
    expect(gauge).toMatchObject({ totalCash: 10530.6, reserved: 2850, liquid: 7680.6 });
    // Each seeded posting balances on its own.
    const accounts = [...new Set(chart.accounts.flatMap(function ids(n): number[] { return [n.account.id, ...n.children.flatMap(ids)]; }))];
    const lines = (await Promise.all(accounts.map((id) => db.finance.getAccountLedger(MEMBER.admin, id)))).flatMap((l) => l.rows.map((r) => r.entry));
    const net = new Map<string, number>();
    for (const l of lines) net.set(l.TransactionID, (net.get(l.TransactionID) ?? 0) + Math.round(l.DebitAmount * 100) - Math.round(l.CreditAmount * 100));
    expect(net.size).toBe(14);
    expect([...net.values()].every((v) => v === 0)).toBe(true);
  });
});
