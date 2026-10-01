// Sprint 5Z-7: the double-entry general ledger (GLAccount, JournalEntry), the chart of accounts, balanced postings,
// asset transfers, the balance sheet, bank statement reconciliation, and Event.IntakeSessionStatus.
import { describe, expect, it } from 'vitest';
import {
  assertBalancedLines,
  BusinessRuleError,
  buildBalanceSheet,
  buildChartOfAccounts,
  cleanJournalDate,
  cleanJournalLines,
  EVENT_INTAKE_SESSION_STATUSES,
  GL_ACCOUNT_TYPES,
  matchBankStatement,
  mayPostGeneralLedger,
  mayReadGeneralLedger,
  parseBankStatementCsv,
  planAssetTransfer,
  RECORD_REFERENCES,
  type DataService,
  type GLAccount,
  type JournalEntry,
  type JournalLineInput,
  type MemberWriteActor,
} from '@kofc/shared';
import { MemoryDataService } from '../apps/web/services/drivers/memory';
import { drivers, expectRule, MEMBER, NOW, type DriverUnderTest } from './helpers';
import { openDatabases } from './shims/expo-sqlite';

// Dev seed: council 1 is 15295 (Super Admin 1 who is Grand Knight, Admin 2 who is Financial Secretary, Member 3);
// council 2 exists. Seed.sql's baseline gives council 1 its chart of accounts, GLAccount ids 1-14, and since
// Sprint 5Z-8 Opening Balance Equity (15).
const OWN = 1;
const OTHER = 2;
const ACCT = {
  checking: 1,
  goal1: 2,
  goal2: 3,
  savings: 4,
  charitySavings: 5,
  physical: 6,
  dues: 7,
  parking: 8,
  fundraising: 9,
  donations: 10,
  charitable: 11,
  eventCosts: 12,
  councilCosts: 13,
  supreme: 14,
  openingEquity: 15,
} as const;

const code = (fn: () => unknown): string | undefined => {
  try {
    fn();
  } catch (e) {
    return (e as BusinessRuleError).code;
  }
  return undefined;
};

const account = (over: Partial<GLAccount> = {}): GLAccount => ({
  id: 1,
  CouncilID: OWN,
  AccountName: 'Operating Checking',
  AccountType: 'Asset',
  ParentAccountID: null,
  IsVirtualGoal: 0,
  TargetGoalAmount: 0,
  ...over,
});

const entry = (over: Partial<JournalEntry> = {}): JournalEntry => ({
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
  TransactionID: 'txn-1',
  ...over,
});

const actor = (over: Partial<MemberWriteActor> = {}): MemberWriteActor => ({
  memberId: 50,
  councilId: OWN,
  memberType: 'Member',
  active: true,
  roles: [],
  officer: false,
  ...over,
});

/** Dues deposited into checking: debit checking, credit dues revenue. */
const dues = (amount: number, over: Partial<JournalLineInput> = {}): JournalLineInput[] => [
  { GLAccountID: ACCT.checking, DebitAmount: amount, Description: 'Dues deposit', DateLogged: '2026-09-10', ...over },
  { GLAccountID: ACCT.dues, CreditAmount: amount, Description: 'Dues deposit', DateLogged: '2026-09-10', ...over },
];

/** Gives a member a Role straight in the backing store; the data service has no role-assignment method. */
function grantRole(d: DriverUnderTest, db: DataService, memberId: number, role: string): void {
  if (d.name === 'memory') {
    const store = (db as MemoryDataService).debugStore;
    store.insert('MemberRoles', { RoleID: store.rows('Role').find((r) => r.Role === role)!.id, MemberID: memberId });
  } else {
    openDatabases.at(-1)!.prepare('INSERT INTO [MemberRoles] ([RoleID], [MemberID]) SELECT [id], ? FROM [Role] WHERE [Role] = ?').run(memberId, role);
  }
}

/** A GL account of another council, straight in the backing store; the service has no account maintenance yet. */
function otherCouncilAccount(d: DriverUnderTest, db: DataService): number {
  if (d.name === 'memory') {
    return (db as MemoryDataService).debugStore.insert('GLAccount', { CouncilID: OTHER, AccountName: 'Checking', AccountType: 'Asset' }).id as number;
  }
  const res = openDatabases.at(-1)!.prepare("INSERT INTO [GLAccount] ([CouncilID], [AccountName], [AccountType]) VALUES (?, 'Checking', 'Asset')").run(OTHER);
  return Number(res.lastInsertRowid);
}

describe('ledger rules (pure)', () => {
  it('lists the account types and intake statuses', () => {
    expect(GL_ACCOUNT_TYPES).toEqual(['Asset', 'Liability', 'Equity', 'Revenue', 'Expense']);
    expect(EVENT_INTAKE_SESSION_STATUSES).toEqual(['Inactive', 'Active']);
  });

  it('cleans journal dates, defaulting to now', () => {
    expect(cleanJournalDate('2026-09-10', NOW)).toBe('2026-09-10 00:00:00');
    expect(cleanJournalDate('2026-09-10T14:30', NOW)).toBe('2026-09-10 14:30:00');
    expect(cleanJournalDate('2026-09-10 14:30:15', NOW)).toBe('2026-09-10 14:30:15');
    expect(cleanJournalDate(undefined, NOW)).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    for (const bad of ['2026-02-30', '2026-09-10 25:00', 'yesterday', 7]) expect(code(() => cleanJournalDate(bad, NOW))).toMatch(/INVALID_/);
  });

  it('accepts a balanced transaction and refuses malformed lines', () => {
    const clean = cleanJournalLines(dues(25), NOW);
    expect(clean).toHaveLength(2);
    expect(clean[0]).toMatchObject({ GLAccountID: ACCT.checking, DebitAmount: 25, CreditAmount: 0, DateLogged: '2026-09-10 00:00:00', CheckNumber: null });
    const line = dues(25)[0];
    expect(code(() => cleanJournalLines([line], NOW))).toBe('INVALID_INPUT');
    expect(code(() => cleanJournalLines([{ ...line, CreditAmount: 25 }, dues(25)[1]], NOW))).toBe('INVALID_INPUT');
    expect(code(() => cleanJournalLines([{ ...line, DebitAmount: 0 }, dues(25)[1]], NOW))).toBe('INVALID_INPUT');
    expect(code(() => cleanJournalLines([{ ...line, DebitAmount: 25.001 }, dues(25)[1]], NOW))).toBe('INVALID_INPUT');
    expect(code(() => cleanJournalLines([{ ...line, DebitAmount: -5 }, dues(25)[1]], NOW))).toBe('INVALID_INPUT');
    expect(code(() => cleanJournalLines([{ ...line, Description: '  ' }, dues(25)[1]], NOW))).toBe('INVALID_INPUT');
    expect(code(() => cleanJournalLines([{ ...line, GLAccountID: 0 }, dues(25)[1]], NOW))).toBe('INVALID_INPUT');
  });

  it('refuses an unbalanced transaction to the cent', () => {
    const err = (() => {
      try {
        cleanJournalLines([...dues(25).slice(0, 1), { GLAccountID: ACCT.dues, CreditAmount: 24.99, Description: 'Short' }], NOW);
      } catch (e) {
        return e as BusinessRuleError;
      }
      throw new Error('expected a rejection');
    })();
    expect(err.code).toBe('UNBALANCED_TRANSACTION');
    expect(err.details).toEqual({ debits: 25, credits: 24.99, difference: 0.01 });
    // Sums are taken in cents, so 0.1 + 0.2 balances 0.3.
    expect(() => assertBalancedLines([{ DebitAmount: 0.1, CreditAmount: 0 }, { DebitAmount: 0.2, CreditAmount: 0 }, { DebitAmount: 0, CreditAmount: 0.3 }])).not.toThrow();
  });

  it('plans an asset transfer as a target debit and a source credit, never overdrawing the source', () => {
    const checking = account();
    const goal = account({ id: 2, AccountName: 'Goal Account #1', ParentAccountID: 1, IsVirtualGoal: 1 });
    const plan = planAssetTransfer(checking, goal, 40, 100, NOW, { dateLogged: '2026-09-11' });
    expect(plan.councilId).toBe(OWN);
    expect(plan.lines).toEqual([
      expect.objectContaining({ GLAccountID: 2, DebitAmount: 40, CreditAmount: 0, Description: 'Transfer from Operating Checking to Goal Account #1' }),
      expect.objectContaining({ GLAccountID: 1, DebitAmount: 0, CreditAmount: 40, DateLogged: '2026-09-11 00:00:00' }),
    ]);
    expect(code(() => planAssetTransfer(checking, goal, 100.01, 100, NOW))).toBe('INSUFFICIENT_FUNDS');
    expect(code(() => planAssetTransfer(checking, checking, 1, 100, NOW))).toBe('INVALID_INPUT');
    expect(code(() => planAssetTransfer(checking, account({ id: 7, AccountType: 'Revenue' }), 1, 100, NOW))).toBe('INVALID_INPUT');
    expect(code(() => planAssetTransfer(checking, account({ id: 9, CouncilID: OTHER }), 1, 100, NOW))).toBe('INVALID_INPUT');
    expect(code(() => planAssetTransfer(checking, goal, 0, 100, NOW))).toBe('INVALID_INPUT');
    expect(code(() => planAssetTransfer(null, goal, 1, 100, NOW))).toBe('INVALID_INPUT');
  });

  it('builds the chart as a tree with own and rolled-up balances', () => {
    const accounts = [
      account(),
      account({ id: 2, AccountName: 'Goal Account #1', ParentAccountID: 1, IsVirtualGoal: 1 }),
      account({ id: 7, AccountName: 'Member Dues Collections', AccountType: 'Revenue' }),
      account({ id: 11, AccountName: 'Charitable Disbursements', AccountType: 'Expense' }),
    ];
    const entries = [
      entry({ id: 1, GLAccountID: 1, DebitAmount: 100 }),
      entry({ id: 2, GLAccountID: 7, CreditAmount: 100 }),
      entry({ id: 3, GLAccountID: 2, DebitAmount: 30 }),
      entry({ id: 4, GLAccountID: 1, CreditAmount: 30 }),
    ];
    const chart = buildChartOfAccounts(OWN, accounts, entries);
    expect(chart.accounts.map((n) => n.account.AccountName)).toEqual(['Operating Checking', 'Member Dues Collections', 'Charitable Disbursements']);
    const checking = chart.accounts[0];
    expect(checking).toMatchObject({ depth: 0, debitTotal: 100, creditTotal: 30, balance: 70, rolledUpBalance: 100 });
    expect(checking.children).toEqual([expect.objectContaining({ depth: 1, balance: 30, rolledUpBalance: 30 })]);
    expect(chart.accounts[1].balance).toBe(100);
  });

  it('balances the balance sheet with the current surplus, to the penny', () => {
    const accounts = [
      account(),
      account({ id: 6, AccountName: 'Physical Assets' }),
      account({ id: 7, AccountName: 'Member Dues Collections', AccountType: 'Revenue' }),
      account({ id: 13, AccountName: 'Council Operational Costs', AccountType: 'Expense' }),
      account({ id: 20, AccountName: 'Loan', AccountType: 'Liability' }),
    ];
    const entries = [
      entry({ id: 1, GLAccountID: 1, DebitAmount: 500.1 }),
      entry({ id: 2, GLAccountID: 7, CreditAmount: 500.1 }),
      entry({ id: 3, GLAccountID: 13, DebitAmount: 0.2 }),
      entry({ id: 4, GLAccountID: 1, CreditAmount: 0.2 }),
      entry({ id: 5, GLAccountID: 6, DebitAmount: 250 }),
      entry({ id: 6, GLAccountID: 20, CreditAmount: 250 }),
    ];
    const sheet = buildBalanceSheet(OWN, accounts, entries, NOW);
    expect(sheet).toMatchObject({
      totalAssets: 749.9,
      totalLiabilities: 250,
      netSurplus: 499.9,
      totalEquity: 499.9,
      totalLiabilitiesAndEquity: 749.9,
      difference: 0,
      isBalanced: true,
      entryCount: 6,
    });
    expect(sheet.assets.lines.map((l) => [l.accountName, l.balance])).toEqual([
      ['Operating Checking', 499.9],
      ['Physical Assets', 250],
    ]);
    // A lopsided (hand-edited) ledger is reported, not hidden.
    expect(buildBalanceSheet(OWN, accounts, entries.slice(0, 1), NOW)).toMatchObject({ isBalanced: false, difference: 500.1 });
  });

  it('parses bank statement CSVs with signed or split amount columns', () => {
    const signed = parseBankStatementCsv(
      'Date,Description,Amount,Check Number\r\n09/10/2026,"Deposit, dues",25.00,\r\n2026-09-12,Check 1042,"($1,200.50)",1042\r\n2026-09-13,Balance,0,\r\n\r\n',
    );
    expect(signed).toEqual([
      { line: 2, date: '2026-09-10', description: 'Deposit, dues', amount: 25, checkNumber: null },
      { line: 3, date: '2026-09-12', description: 'Check 1042', amount: -1200.5, checkNumber: '1042' },
    ]);
    const split = parseBankStatementCsv('Posted Date,Memo,Withdrawal,Deposit\n2026-09-10,ATM,40.00,\n2026-09-11,Dues,,15');
    expect(split.map((r) => r.amount)).toEqual([-40, 15]);
    for (const bad of ['', 'Date,Description\n2026-09-10,x', 'Date,Amount\n2026-13-01,5', 'Date,Amount\n2026-09-10,5.123', 'Date,Amount\n2026-09-10,0', 'Date,Amount\n"2026-09-10,5']) {
      expect(code(() => parseBankStatementCsv(bad)), bad).toBe('INVALID_INPUT');
    }
  });

  it('matches deposits to debits and withdrawals to credits, checks by number first', () => {
    const rows = parseBankStatementCsv('Date,Amount,Check\n2026-09-12,-100,1042\n2026-09-12,-100,\n2026-09-11,25,\n2026-09-30,25,\n2026-09-12,-7,999');
    const candidates = [
      entry({ id: 1, GLAccountID: 1, CreditAmount: 100, DateLogged: '2026-09-11 00:00:00' }),
      entry({ id: 2, GLAccountID: 1, CreditAmount: 100, DateLogged: '2026-09-01 00:00:00', CheckNumber: '1042' }),
      entry({ id: 3, GLAccountID: 1, DebitAmount: 25, DateLogged: '2026-09-15 00:00:00' }),
      entry({ id: 4, GLAccountID: 1, DebitAmount: 25, DateLogged: '2026-09-10 00:00:00' }),
      entry({ id: 5, GLAccountID: 1, CreditAmount: 7, IsBankReconciled: 1, CheckNumber: '999' }),
    ];
    const { matched, unmatched } = matchBankStatement(rows, candidates);
    expect(matched.map((m) => [m.row.line, m.journalEntryId])).toEqual([
      [2, 2], // the check, despite its older date
      [3, 1], // the plain withdrawal takes the other $100 credit
      [4, 4], // the closest-dated $25 debit
    ]);
    expect(unmatched.map((m) => m.row.line)).toEqual([5, 6]); // 09-30 is 15 days from the remaining debit; 999 is reconciled
  });

  it('opens the books to council officers and keeps posting with the finance officers', () => {
    expect(mayReadGeneralLedger(actor({ roles: ['Grand Knight'], officer: true }), OWN)).toBe(true);
    expect(mayReadGeneralLedger(actor({ roles: ['Recorder'], officer: true }), OWN)).toBe(true);
    expect(mayReadGeneralLedger(actor({ memberType: 'Admin' }), OWN)).toBe(true);
    expect(mayReadGeneralLedger(actor(), OWN)).toBe(false);
    expect(mayReadGeneralLedger(actor({ roles: ['Recorder'], officer: true }), OTHER)).toBe(false);
    expect(mayReadGeneralLedger(actor({ memberType: 'Super Admin' }), OTHER)).toBe(true);

    expect(mayPostGeneralLedger(actor({ roles: ['Treasurer'], officer: true }), OWN)).toBe(true);
    expect(mayPostGeneralLedger(actor({ roles: ['Financial Secretary'], officer: true }), OWN)).toBe(true);
    expect(mayPostGeneralLedger(actor({ roles: ['Treasurer'], officer: true }), OTHER)).toBe(false);
    expect(mayPostGeneralLedger(actor({ memberType: 'Admin' }), OWN)).toBe(false);
    expect(mayPostGeneralLedger(actor({ roles: ['Grand Knight'], officer: true }), OWN)).toBe(false);
    expect(mayPostGeneralLedger(actor({ roles: ['Treasurer'], active: false }), OWN)).toBe(false);
    expect(mayPostGeneralLedger(actor({ memberType: 'Super Admin' }), OTHER)).toBe(true);
  });

  it('blocks deleting a council that keeps books', () => {
    const tables = RECORD_REFERENCES.Council.map((r) => r.table);
    expect(tables).toContain('GLAccount');
    expect(tables).toContain('JournalEntry');
  });
});

describe.each(drivers)('general ledger ($name driver)', (d) => {
  it('seeds council 15295 with the standard chart of accounts, every balance at zero', async () => {
    const db = await d.make();
    const chart = await db.finance.listChartOfAccounts(MEMBER.admin, OWN);
    const names = (nodes: typeof chart.accounts): string[] => nodes.flatMap((n) => [n.account.AccountName, ...names(n.children)]);
    expect(names(chart.accounts)).toEqual([
      'Operating Checking',
      'Goal Account #1',
      'Goal Account #2',
      'General Savings',
      'Charity Savings',
      'Physical Assets',
      'Opening Balance Equity',
      'Member Dues Collections',
      'Parking Fundraising',
      'General Fundraising',
      'General Donations',
      'Charitable Disbursements',
      'Event Operational Costs',
      'Council Operational Costs',
      'Supreme Assessments',
    ]);
    const checking = chart.accounts[0];
    expect(checking.children.map((c) => [c.account.id, c.account.IsVirtualGoal, c.account.ParentAccountID])).toEqual([
      [ACCT.goal1, 1, ACCT.checking],
      [ACCT.goal2, 1, ACCT.checking],
    ]);
    // Sprint 5Z-8 targets.
    expect(checking.children.map((c) => c.account.TargetGoalAmount)).toEqual([4000, 1500]);
    expect(names(chart.accounts.filter((n) => n.rolledUpBalance !== 0))).toEqual([]);
    expect(d.count(db, 'JournalEntry')).toBe(0);
    expect((await db.finance.listChartOfAccounts(MEMBER.superAdmin, OTHER)).accounts).toEqual([]);
  });

  it('defaults a new event to an Inactive intake session', async () => {
    const db = await d.make();
    expect(d.count(db, 'Event')).toBeGreaterThan(0);
    if (d.name === 'memory') {
      expect((db as MemoryDataService).debugStore.rows('Event').every((e) => e.IntakeSessionStatus === 'Inactive')).toBe(true);
    } else {
      const rows = openDatabases.at(-1)!.prepare('SELECT DISTINCT [IntakeSessionStatus] AS s FROM [Event]').all() as { s: string }[];
      expect(rows.map((r) => r.s)).toEqual(['Inactive']);
    }
  });

  it('posts a balanced transaction atomically and refuses an unbalanced one without writing', async () => {
    const db = await d.make();
    const lines = await db.finance.logDoubleEntryTransaction(MEMBER.admin, dues(125.5, { CheckNumber: 'D-1' }));
    expect(lines).toEqual([
      expect.objectContaining({ CouncilID: OWN, GLAccountID: ACCT.checking, DebitAmount: 125.5, CreditAmount: 0, IsBankReconciled: 0, CheckNumber: 'D-1' }),
      expect.objectContaining({ CouncilID: OWN, GLAccountID: ACCT.dues, DebitAmount: 0, CreditAmount: 125.5, DateLogged: '2026-09-10 00:00:00' }),
    ]);
    await expectRule(
      db.finance.logDoubleEntryTransaction(MEMBER.admin, [dues(10)[0], { GLAccountID: ACCT.dues, CreditAmount: 9.99, Description: 'Short' }]),
      'UNBALANCED_TRANSACTION',
    );
    await expectRule(db.finance.logDoubleEntryTransaction(MEMBER.admin, [dues(10)[0], { ...dues(10)[1], GLAccountID: 999 }]), 'INVALID_INPUT');
    expect(d.count(db, 'JournalEntry')).toBe(2);
  });

  it('keeps every transaction inside one council and checks its links', async () => {
    const db = await d.make();
    const foreign = otherCouncilAccount(d, db);
    await expectRule(db.finance.logDoubleEntryTransaction(MEMBER.superAdmin, [dues(10)[0], { ...dues(10)[1], GLAccountID: foreign }]), 'INVALID_INPUT');
    await expectRule(db.finance.logDoubleEntryTransaction(MEMBER.admin, dues(10, { LinkedEventID: 99999 })), 'INVALID_INPUT');
    await expectRule(db.finance.logDoubleEntryTransaction(MEMBER.admin, dues(10, { LinkedMeetingID: 99999 })), 'INVALID_INPUT');
    const meeting = (await db.meetings.listUpcoming(OWN))[0];
    const posted = await db.finance.logDoubleEntryTransaction(MEMBER.admin, dues(10, { LinkedMeetingID: meeting.id }));
    expect(posted.every((l) => l.LinkedMeetingID === meeting.id)).toBe(true);
    expect(d.count(db, 'JournalEntry')).toBe(2);
  });

  it('lets only finance officers and Super Admins post, each in their own council', async () => {
    const db = await d.make();
    await expectRule(db.finance.logDoubleEntryTransaction(MEMBER.member, dues(5)), 'FINANCE_OFFICER_REQUIRED');
    await expectRule(db.finance.logDoubleEntryTransaction(9999, dues(5)), 'MEMBER_NOT_FOUND');
    grantRole(d, db, MEMBER.member, 'Treasurer');
    await db.finance.logDoubleEntryTransaction(MEMBER.member, dues(5));
    await db.finance.logDoubleEntryTransaction(MEMBER.superAdmin, dues(5));
    const foreign = otherCouncilAccount(d, db);
    await expectRule(db.finance.transferAssetFunds(MEMBER.member, foreign, foreign, 1), 'COUNCIL_ACCESS_DENIED');
    expect(d.count(db, 'JournalEntry')).toBe(4);
  });

  it('transfers between asset accounts and funds virtual goals, never overdrawing', async () => {
    const db = await d.make();
    await db.finance.logDoubleEntryTransaction(MEMBER.admin, dues(300));
    const moved = await db.finance.transferAssetFunds(MEMBER.admin, ACCT.checking, ACCT.goal1, 120.25, { dateLogged: '2026-09-11' });
    expect(moved.map((l) => [l.GLAccountID, l.DebitAmount, l.CreditAmount])).toEqual([
      [ACCT.goal1, 120.25, 0],
      [ACCT.checking, 0, 120.25],
    ]);
    await expectRule(db.finance.transferAssetFunds(MEMBER.admin, ACCT.checking, ACCT.savings, 179.76), 'INSUFFICIENT_FUNDS');
    await expectRule(db.finance.transferAssetFunds(MEMBER.admin, ACCT.checking, ACCT.dues, 1), 'INVALID_INPUT');
    await expectRule(db.finance.transferAssetFunds(MEMBER.admin, ACCT.checking, 9999, 1), 'INVALID_INPUT');
    await db.finance.transferAssetFunds(MEMBER.admin, ACCT.checking, ACCT.physical, 179.75);

    const chart = await db.finance.listChartOfAccounts(MEMBER.admin, OWN);
    const checking = chart.accounts[0];
    expect([checking.balance, checking.rolledUpBalance]).toEqual([0, 120.25]);
    expect(checking.children[0].balance).toBe(120.25);
    expect(d.count(db, 'JournalEntry')).toBe(6);
  });

  it('reports a balanced balance sheet including physical property', async () => {
    const db = await d.make();
    await db.finance.logDoubleEntryTransaction(MEMBER.admin, dues(1000));
    await db.finance.logDoubleEntryTransaction(MEMBER.admin, [
      { GLAccountID: ACCT.supreme, DebitAmount: 333.33, Description: 'Per capita' },
      { GLAccountID: ACCT.checking, CreditAmount: 333.33, Description: 'Per capita', CheckNumber: '1043' },
    ]);
    await db.finance.transferAssetFunds(MEMBER.admin, ACCT.checking, ACCT.physical, 400);
    const sheet = await db.finance.getLatestBalanceSheet(MEMBER.admin, OWN);
    expect(sheet).toMatchObject({
      councilId: OWN,
      totalAssets: 666.67,
      totalLiabilities: 0,
      netSurplus: 666.67,
      totalLiabilitiesAndEquity: 666.67,
      difference: 0,
      isBalanced: true,
      entryCount: 6,
    });
    expect(sheet.assets.lines.find((l) => l.accountName === 'Physical Assets')!.balance).toBe(400);
    expect(sheet.expenses.total).toBe(333.33);
  });

  it('opens the books to officers and refuses plain members and other councils', async () => {
    const db = await d.make();
    await expectRule(db.finance.getLatestBalanceSheet(MEMBER.member, OWN), 'ADMIN_REQUIRED');
    await expectRule(db.finance.listChartOfAccounts(MEMBER.admin, OTHER), 'COUNCIL_ACCESS_DENIED');
    await expectRule(db.finance.getLatestBalanceSheet(MEMBER.superAdmin, 9999), 'INVALID_INPUT');
    grantRole(d, db, MEMBER.member, 'Recorder');
    expect((await db.finance.getLatestBalanceSheet(MEMBER.member, OWN)).isBalanced).toBe(true);
  });

  it('reconciles a bank statement against the council bank accounts in one pass', async () => {
    const db = await d.make();
    const [deposit] = await db.finance.logDoubleEntryTransaction(MEMBER.admin, dues(250));
    const [, check] = await db.finance.logDoubleEntryTransaction(MEMBER.admin, [
      { GLAccountID: ACCT.councilCosts, DebitAmount: 80, Description: 'Hall rental', DateLogged: '2026-09-02' },
      { GLAccountID: ACCT.checking, CreditAmount: 80, Description: 'Hall rental', DateLogged: '2026-09-02', CheckNumber: '1044' },
    ]);
    const [goal] = await db.finance.transferAssetFunds(MEMBER.admin, ACCT.checking, ACCT.goal1, 50, { dateLogged: '2026-09-10' });
    const csv = 'Date,Description,Amount,Check #\n09/11/2026,Deposit,250.00,\n09/15/2026,Check,-80.00,1044\n09/10/2026,Unknown,50.00,\n';
    const result = await db.finance.uploadBankStatementReconciliation(MEMBER.admin, csv);
    expect(result).toMatchObject({ councilId: OWN, glAccountId: null, statementRows: 3, reconciledEntryIds: [deposit.id, check.id] });
    // The $50 goal funding is a virtual earmark, never a bank movement.
    expect(result.unmatched.map((m) => m.row.line)).toEqual([4]);
    expect(goal.IsBankReconciled).toBe(0);

    // Reconciled entries are not matched twice.
    const again = await db.finance.uploadBankStatementReconciliation(MEMBER.admin, csv);
    expect(again.reconciledEntryIds).toEqual([]);
    expect(again.unmatched).toHaveLength(3);

    await expectRule(db.finance.uploadBankStatementReconciliation(MEMBER.admin, csv, { glAccountId: ACCT.goal1 }), 'INVALID_INPUT');
    await expectRule(db.finance.uploadBankStatementReconciliation(MEMBER.admin, 'Date,Amount\nbad,1'), 'INVALID_INPUT');
    await expectRule(db.finance.uploadBankStatementReconciliation(MEMBER.member, csv), 'FINANCE_OFFICER_REQUIRED');
    await expectRule(db.finance.uploadBankStatementReconciliation(MEMBER.admin, csv, { councilId: OTHER }), 'COUNCIL_ACCESS_DENIED');
    const chart = await db.finance.listChartOfAccounts(MEMBER.admin, OWN);
    expect(chart.accounts[0].debitTotal).toBe(250);
  });

  it('limits a reconciliation to one bank account when asked', async () => {
    const db = await d.make();
    await db.finance.logDoubleEntryTransaction(MEMBER.admin, dues(250));
    await db.finance.transferAssetFunds(MEMBER.admin, ACCT.checking, ACCT.savings, 100, { dateLogged: '2026-09-12' });
    const csv = 'Date,Amount\n2026-09-12,100.00\n';
    const savings = await db.finance.uploadBankStatementReconciliation(MEMBER.admin, csv, { glAccountId: ACCT.savings });
    expect(savings.reconciledEntryIds).toHaveLength(1);
    const checkingOnly = await db.finance.uploadBankStatementReconciliation(MEMBER.admin, 'Date,Amount\n2026-09-12,-100.00\n', { glAccountId: ACCT.checking });
    expect(checkingOnly.reconciledEntryIds).toHaveLength(1);
  });
});
