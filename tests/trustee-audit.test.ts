// Sprints 6M / 6N (Phase 5 Financial Extension): saved budget target ceilings (schema 50), the Semiannual Trustee Audit
// Desk with its period locks and Form 1295 report (schema 51), the Council Balance Sheet & Equity Ledger card, and the
// 15-minute oral history recording ceiling with its countdown meter.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  assertLedgerPeriodsOpen,
  auditPeriodOf,
  auditPeriodOptions,
  auditWindow,
  buildBudgetAnalysis,
  buildCouncilNetWorth,
  canVerifyCouncilAudit,
  cleanForm1295Payload,
  isCashAccount,
  mayVerifyCouncilAudit,
  ORAL_HISTORY_MAX_SECONDS,
  oralHistoryCountdown,
  parseAuditSignatures,
  portalAreas,
  portalSidebar,
  RECORD_REFERENCES,
  storedTargetSpendingCeiling,
  type CouncilAudit,
  type CouncilBudgetForecast,
  type DataService,
  type GLAccount,
  type JournalEntry,
  type JournalLineInput,
  type MemberWriteActor,
} from '@kofc/shared';
import { MemoryDataService } from '../apps/web/services/drivers/memory';
import { TABLES } from '../apps/web/services/generated/schema.generated';
import { drivers, expectRule, MEMBER, type DriverUnderTest } from './helpers';
import { openDatabases } from './shims/expo-sqlite';

const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');
const OWN = 1;
const OTHER = 2;
const ACCT = { checking: 1, goal1: 2, savings: 4, charitySavings: 5, physical: 6, dues: 7, councilCosts: 13, openingEquity: 15 };
const ENDED = { year: '2025-2026', period: 'JAN-JUN' as const };
const OPEN = { year: '2026-2027', period: 'JUL-DEC' as const };

/** Writes a row straight into the backing store; resolves to its id. */
function raw(d: DriverUnderTest, db: DataService, table: string, row: Record<string, string | number | null>): number {
  if (d.name === 'memory') return (db as MemoryDataService).debugStore.insert(table, row).id as number;
  const cols = Object.keys(row);
  const res = openDatabases
    .at(-1)!
    .prepare(`INSERT INTO [${table}] (${cols.map((c) => `[${c}]`).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`)
    .run(...Object.values(row));
  return Number(res.lastInsertRowid);
}

function rows(d: DriverUnderTest, db: DataService, table: string): Record<string, unknown>[] {
  if (d.name === 'memory') return (db as MemoryDataService).debugStore.rows(table).map((r) => ({ ...r }));
  return openDatabases.at(-1)!.prepare(`SELECT * FROM [${table}] ORDER BY [id]`).all() as Record<string, unknown>[];
}

function grantRole(d: DriverUnderTest, db: DataService, memberId: number, role: string): void {
  if (d.name === 'memory') {
    const store = (db as MemoryDataService).debugStore;
    store.insert('MemberRoles', { RoleID: store.rows('Role').find((r) => r.Role === role)!.id, MemberID: memberId });
  } else {
    openDatabases.at(-1)!.prepare('INSERT INTO [MemberRoles] ([RoleID], [MemberID]) SELECT [id], ? FROM [Role] WHERE [Role] = ?').run(memberId, role);
  }
}

const pair = (debit: number, credit: number, amount: number, date: string, description: string, over: Partial<JournalLineInput> = {}): JournalLineInput[] => [
  { GLAccountID: debit, DebitAmount: amount, Description: description, DateLogged: date, ...over },
  { GLAccountID: credit, CreditAmount: amount, Description: description, DateLogged: date, ...over },
];

/** The books the audit tests read: one opening balance before January, four postings in it, one in July. */
async function postBooks(db: DataService): Promise<void> {
  await db.finance.logDoubleEntryTransaction(MEMBER.admin, pair(ACCT.checking, ACCT.openingEquity, 1000, '2025-12-15', 'Opening balance'));
  await db.finance.logDoubleEntryTransaction(MEMBER.admin, pair(ACCT.checking, ACCT.dues, 200, '2026-02-10', 'February dues'));
  await db.finance.logDoubleEntryTransaction(MEMBER.admin, pair(ACCT.councilCosts, ACCT.checking, 50, '2026-03-05', 'Hall rental', { CheckNumber: '1001' }));
  await db.finance.transferAssetFunds(MEMBER.admin, ACCT.checking, ACCT.savings, 300, { dateLogged: '2026-04-01' });
  await db.finance.logDoubleEntryTransaction(MEMBER.admin, pair(ACCT.physical, ACCT.checking, 400, '2026-05-01', 'Folding tables'));
  await db.finance.logDoubleEntryTransaction(MEMBER.admin, pair(ACCT.checking, ACCT.dues, 75, '2026-07-15', 'July dues'));
}

// ---- pure ------------------------------------------------------------------------------------------------------

describe('audit periods and cash accounts', () => {
  it('splits a fraternal year into its two audit windows', () => {
    expect(auditWindow('2026-2027', 'JUL-DEC')).toEqual({ fromDate: '2026-07-01', throughDate: '2026-12-31', label: 'July-December 2026' });
    expect(auditWindow('2026-2027', 'JAN-JUN')).toEqual({ fromDate: '2027-01-01', throughDate: '2027-06-30', label: 'January-June 2027' });
    expect(auditPeriodOf(new Date(2026, 9, 8))).toEqual({ fiscalYear: '2026-2027', period: 'JUL-DEC' });
    expect(auditPeriodOf(new Date(2027, 2, 1))).toEqual({ fiscalYear: '2026-2027', period: 'JAN-JUN' });
    expect(auditPeriodOptions(new Date(2026, 9, 8), 4).map((o) => `${o.fiscalYear} ${o.period}`)).toEqual([
      '2026-2027 JUL-DEC',
      '2025-2026 JAN-JUN',
      '2025-2026 JUL-DEC',
      '2024-2025 JAN-JUN',
    ]);
    expect(() => auditWindow('2026', 'JUL-DEC')).toThrow();
  });

  it('counts every Asset account but physical property as cash', () => {
    const acct = (AccountName: string, AccountType: GLAccount['AccountType'] = 'Asset') => ({ AccountName, AccountType });
    expect(isCashAccount(acct('Operating Checking'))).toBe(true);
    expect(isCashAccount(acct('Goal Account #1'))).toBe(true);
    expect(isCashAccount(acct('Physical Assets'))).toBe(false);
    expect(isCashAccount(acct('Hall Equipment'))).toBe(false);
    expect(isCashAccount(acct('Member Dues Collections', 'Revenue'))).toBe(false);
  });

  it('refuses postings dated inside a locked period only', () => {
    const audit = { id: 1, council_id: OWN, fiscal_year: '2025-2026', audit_period: 'JAN-JUN', execution_status: 'LOCKED', created_at: '' } as CouncilAudit;
    expect(() => assertLedgerPeriodsOpen([{ DateLogged: '2026-03-01' }], [audit])).toThrow(/locked/);
    expect(() => assertLedgerPeriodsOpen([{ DateLogged: '2026-07-01' }], [audit])).not.toThrow();
    expect(() => assertLedgerPeriodsOpen([{ DateLogged: '2026-03-01' }], [{ ...audit, execution_status: 'DRAFT' }])).not.toThrow();
  });

  it('reads stored signatures defensively', () => {
    expect(parseAuditSignatures(null)).toEqual([]);
    expect(parseAuditSignatures('not json')).toEqual([]);
    expect(parseAuditSignatures('[{"memberId":3,"name":"A B","role":"Trustee 1","signedAt":"x"},{"bad":1}]')).toHaveLength(1);
  });

  it('gives the checkmarks to Trustees of the council and Super Admins', () => {
    const actor = (over: Partial<MemberWriteActor>): MemberWriteActor => ({ memberId: 9, councilId: OWN, memberType: 'Member', active: true, roles: [], officer: false, ...over });
    expect(mayVerifyCouncilAudit(actor({ roles: ['Trustee 2'], officer: true }), OWN)).toBe(true);
    expect(mayVerifyCouncilAudit(actor({ roles: ['Trustee 2'], officer: true }), OTHER)).toBe(false);
    expect(mayVerifyCouncilAudit(actor({ roles: ['Trustee 2'], active: false }), OWN)).toBe(false);
    expect(mayVerifyCouncilAudit(actor({ roles: ['Treasurer'], officer: true }), OWN)).toBe(false);
    expect(mayVerifyCouncilAudit(actor({ memberType: 'Admin' }), OWN)).toBe(false);
    expect(mayVerifyCouncilAudit(actor({ memberType: 'Super Admin' }), OTHER)).toBe(true);
    const user = { memberId: 9, councilId: OWN, memberType: 'Member' as const, isOfficer: true };
    expect(canVerifyCouncilAudit({ ...user, roles: ['Trustee 3'] }, OWN)).toBe(true);
    expect(canVerifyCouncilAudit({ ...user, roles: ['Grand Knight'] }, OWN)).toBe(false);
  });

  it('opens the desk to every reader of the books in the Finances pillar', () => {
    const officer = { memberId: 9, councilId: OWN, memberType: 'Member' as const, isOfficer: true, roles: ['Trustee 1'] };
    expect(portalAreas(officer)).toContain('finance/audit');
    expect(portalAreas({ ...officer, isOfficer: false, roles: [] })).not.toContain('finance/audit');
    expect(portalSidebar(officer).find((g) => g.id === 'finances')!.entries.map((e) => e.item)).toContain('finance/audit');
  });

  it('checks the Form 1295 report body', () => {
    const workspace = { councilId: OWN, fiscalYear: '2025-2026', period: 'JAN-JUN', lines: [], signatures: [] };
    expect(cleanForm1295Payload({ council: { id: OWN, number: 15295, name: 'St. Jude' }, workspace }).council.number).toBe(15295);
    expect(() => cleanForm1295Payload({ workspace })).toThrow();
    expect(() => cleanForm1295Payload({ council: { id: OTHER, number: 1, name: 'x' }, workspace })).toThrow(/belongs to council/);
    expect(() => cleanForm1295Payload({ council: { id: OWN, number: 1, name: 'x' }, workspace: { ...workspace, period: 'Q3' } })).toThrow();
  });
});

describe('net worth (pure)', () => {
  it('adds cash and active equipment and subtracts unpaid approved sheets', () => {
    const accounts = [
      { id: 1, CouncilID: OWN, AccountName: 'Operating Checking', AccountType: 'Asset', ParentAccountID: null, IsVirtualGoal: 0, TargetGoalAmount: 0 },
      { id: 2, CouncilID: OWN, AccountName: 'Goal Account #1', AccountType: 'Asset', ParentAccountID: 1, IsVirtualGoal: 1, TargetGoalAmount: 500 },
      { id: 6, CouncilID: OWN, AccountName: 'Physical Assets', AccountType: 'Asset', ParentAccountID: null, IsVirtualGoal: 0, TargetGoalAmount: 0 },
    ] as GLAccount[];
    const entry = (id: number, GLAccountID: number, DebitAmount: number, CreditAmount = 0) =>
      ({ id, CouncilID: OWN, GLAccountID, DebitAmount, CreditAmount, DateLogged: '2026-07-01 00:00:00', Description: '', IsBankReconciled: 0, TransactionID: 't' }) as JournalEntry;
    const worth = buildCouncilNetWorth({
      councilId: OWN,
      accounts,
      entries: [entry(1, 1, 1000.1), entry(2, 2, 200), entry(3, 1, 0, 200), entry(4, 6, 999)],
      assets: [
        { id: 1, council_id: OWN, asset_name: 'Grill', purchase_date: '2026-08-01 00:00:00', cost_basis: 425, current_status: 'ACTIVE' },
        { id: 2, council_id: OWN, asset_name: 'Old banner', purchase_date: '2020-01-01 00:00:00', cost_basis: 80, current_status: 'DISPOSED' },
      ],
      unpaidReports: [{ reportId: 7, amount: 50.25, approvedAt: null }],
      now: new Date(Date.UTC(2026, 9, 8, 12)),
    });
    expect(worth.cashAccounts).toEqual([{ accountId: 1, accountName: 'Operating Checking', balance: 1000.1 }]);
    expect(worth).toMatchObject({ liquidCash: 1000.1, equipmentValue: 425, unpaidApprovedExpenses: 50.25, netWorth: 1374.85 });
    expect(worth.equipment.map((a) => a.assetName)).toEqual(['Grill']);
  });
});

describe('saved target ceiling (pure)', () => {
  const line = (id: number, over: Partial<CouncilBudgetForecast> = {}): CouncilBudgetForecast => ({
    id,
    CouncilID: OWN,
    FraternalYear: '2026-2027',
    CategoryType: 'Operational',
    LineItemName: `Line ${id}`,
    PrePopulatedAmount: 0,
    ProposedBudgetAmount: 1000,
    ApprovedBudgetAmount: 1000,
    BudgetStatus: 'Approved',
    ...over,
  });

  it('tracks the saved ceiling unless a what-if is given', () => {
    const lines = [line(1, { target_spending_ceiling: 2500 }), line(2, { target_spending_ceiling: 2500 })];
    expect(storedTargetSpendingCeiling(lines)).toBe(2500);
    expect(storedTargetSpendingCeiling([line(3)])).toBeNull();
    const base = { councilId: OWN, fraternalYear: '2026-2027', lines, priorLines: [] };
    expect(buildBudgetAnalysis(base)).toMatchObject({ storedTargetSpendingCeiling: 2500, ceiling: { ceiling: 2500, buffer: 500, status: 'Within Ceiling' } });
    expect(buildBudgetAnalysis({ ...base, targetSpendingCeiling: 1500 }).ceiling).toMatchObject({ ceiling: 1500, status: 'Over Ceiling' });
    expect(buildBudgetAnalysis({ ...base, targetSpendingCeiling: null }).ceiling).toBeNull();
  });
});

describe('oral history recording ceiling', () => {
  it('caps every session at exactly 15 minutes', () => {
    expect(ORAL_HISTORY_MAX_SECONDS).toBe(900);
  });

  it('counts down the minutes and seconds left', () => {
    expect(oralHistoryCountdown(0)).toMatchObject({ remainingSeconds: 900, remainingLabel: '15:00', remainingSpoken: '15 minutes', percentRemaining: 100, warning: false, expired: false });
    expect(oralHistoryCountdown(55)).toMatchObject({ remainingLabel: '14:05', remainingSpoken: '14 minutes 5 seconds' });
    expect(oralHistoryCountdown(840)).toMatchObject({ remainingLabel: '01:00', warning: true });
    expect(oralHistoryCountdown(899)).toMatchObject({ remainingLabel: '00:01', remainingSpoken: '1 second' });
    expect(oralHistoryCountdown(5000)).toMatchObject({ remainingSeconds: 0, remainingLabel: '00:00', expired: true, percentRemaining: 0 });
    expect(oralHistoryCountdown(-3).remainingSeconds).toBe(900);
  });

  it('puts the countdown meter on the recording screen', () => {
    const recorder = read('apps/web/components/OralHistoryRecorder.tsx');
    expect(recorder).toContain('oralHistoryCountdown(elapsed)');
    expect(recorder).toContain('role="timer"');
    expect(recorder).toContain('border-4 border-hc-gold bg-black');
    expect(recorder).toContain('Time left before automatic stop');
  });
});

// ---- schema and wiring -----------------------------------------------------------------------------------------

describe('schemas 50 and 51', () => {
  it('stores the ceiling and the two audit tables', () => {
    expect(TABLES.CouncilBudgetForecast.columns.find((c) => c.name === 'target_spending_ceiling')).toMatchObject({ notNull: false });
    expect(TABLES.CouncilAudits.columns.map((c) => c.name)).toEqual([
      'id',
      'council_id',
      'audit_period',
      'fiscal_year',
      'execution_status',
      'verified_by_trustees',
      'cash_balance_beginning',
      'cash_balance_ending',
      'locked_at',
      'created_at',
    ]);
    expect(TABLES.CouncilAudits.columns.find((c) => c.name === 'execution_status')).toMatchObject({ default: { kind: 'literal', value: 'DRAFT' } });
    expect(TABLES.AuditVerifiedLines.columns.map((c) => c.name)).toEqual(['id', 'audit_id', 'journal_entry_id', 'verified_by_member_id', 'verified_at']);
    expect(read('apps/mobile/services/drivers/sqlite.ts')).toMatch(/const SCHEMA_VERSION = (5[1-9]|[6-9]\d);/);
    expect(read('data_dictionary.md')).toContain('[CouncilAudits]');
    expect(RECORD_REFERENCES.Council.some((r) => r.table === 'CouncilAudits')).toBe(true);
  });

  it('ships the ReportLab Form 1295 script, its route and its disclaimers', () => {
    const script = read('scripts/form_1295_report.py');
    expect(script).toContain('from reportlab');
    expect(script).toContain("'generated' / 'Form_1295_Audit_Report.pdf'");
    expect(script).toMatch(/NOT an\s+'\s*'official Knights of Columbus Supreme Council form/);
    expect(read('scripts/requirements.txt')).toContain('reportlab');
    const route = read('apps/web/app/api/finance/form-1295/route.ts');
    expect(route).toContain('mayReadGeneralLedger');
    expect(route).toContain('execFile(');
    expect(read('apps/web/app/finance/audit/page.tsx')).toContain('🔎 Semiannual Trustee Audit Desk (Form 1295)');
    expect(read('apps/web/components/NetWorthParts.tsx')).toContain('🏛️ Council Balance Sheet & Equity Ledger');
    expect(read('apps/web/components/BudgetAnalyzerParts.tsx')).not.toContain('localStorage');
  });
});

// ---- drivers ---------------------------------------------------------------------------------------------------

describe.each(drivers)('$name driver: budget.setTargetSpendingCeiling', (d) => {
  const YEAR = '2026-2027';
  const addLine = (db: DataService, over: Record<string, string | number | null> = {}) =>
    raw(d, db, 'CouncilBudgetForecast', {
      CouncilID: OWN,
      FraternalYear: YEAR,
      CategoryType: 'Operational',
      ReferenceSourceID: null,
      LineItemName: 'Bank Fees',
      PrePopulatedAmount: 0,
      ProposedBudgetAmount: 1200,
      ApprovedBudgetAmount: 1200,
      BudgetStatus: 'Approved',
      ...over,
    });

  it('saves the ceiling on every row of the year and tracks it for every reader', async () => {
    const db = await d.make();
    addLine(db);
    addLine(db, { LineItemName: 'Website', ProposedBudgetAmount: 800, ApprovedBudgetAmount: 800 });
    const saved = await db.budget.setTargetSpendingCeiling(MEMBER.admin, OWN, YEAR, 2500);
    expect(saved).toMatchObject({ storedTargetSpendingCeiling: 2500, ceiling: { ceiling: 2500, allocated: 2000, buffer: 500 } });
    expect(rows(d, db, 'CouncilBudgetForecast').filter((r) => r.FraternalYear === YEAR).map((r) => r.target_spending_ceiling)).toEqual([2500, 2500]);

    // An amendment's new version without the column still reads the year's ceiling.
    addLine(db, { budget_version: 2, ProposedBudgetAmount: 1300, ApprovedBudgetAmount: 1300 });
    const read = await db.budget.getBudgetAnalysis(MEMBER.member, OWN, YEAR);
    expect(read).toMatchObject({ storedTargetSpendingCeiling: 2500, approvedTotal: 2100, ceiling: { ceiling: 2500, buffer: 400 } });
    expect((await db.budget.getBudgetAnalysis(MEMBER.member, OWN, YEAR, { targetSpendingCeiling: 2000 })).ceiling).toMatchObject({ ceiling: 2000, status: 'Over Ceiling' });
    expect((await db.budget.getBudgetAnalysis(MEMBER.member, OWN, YEAR, { targetSpendingCeiling: null })).ceiling).toBeNull();

    const cleared = await db.budget.setTargetSpendingCeiling(MEMBER.admin, OWN, YEAR, null);
    expect(cleared).toMatchObject({ storedTargetSpendingCeiling: null, ceiling: null });
  });

  it('belongs to the budget editors and needs the year to have lines', async () => {
    const db = await d.make();
    addLine(db);
    await expectRule(db.budget.setTargetSpendingCeiling(MEMBER.member, OWN, YEAR, 100), 'ADMIN_REQUIRED');
    await expectRule(db.budget.setTargetSpendingCeiling(MEMBER.admin, OTHER, YEAR, 100), 'COUNCIL_ACCESS_DENIED');
    await expectRule(db.budget.setTargetSpendingCeiling(MEMBER.admin, OWN, '2030-2031', 100), 'INVALID_INPUT');
    await expectRule(db.budget.setTargetSpendingCeiling(MEMBER.admin, OWN, YEAR, -1), 'INVALID_INPUT');
    await expectRule(db.budget.setTargetSpendingCeiling(MEMBER.admin, OWN, YEAR, 10.005), 'INVALID_INPUT');
    expect(rows(d, db, 'CouncilBudgetForecast').every((r) => r.target_spending_ceiling === null)).toBe(true);
    expect((await db.budget.setTargetSpendingCeiling(MEMBER.superAdmin, OWN, YEAR, 0)).storedTargetSpendingCeiling).toBe(0);
  });
});

describe.each(drivers)('$name driver: Semiannual Trustee Audit Desk', (d) => {
  it('lists the window’s cash lines and ties out the cash', async () => {
    const db = await d.make();
    await postBooks(db);
    const ws = await db.finance.getTrusteeAudit(MEMBER.admin, OWN, ENDED.year, ENDED.period);
    expect(ws).toMatchObject({
      status: 'NOT_STARTED',
      periodEnded: true,
      fromDate: '2026-01-01',
      throughDate: '2026-06-30',
      cashBalanceBeginning: 1000,
      receipts: 200,
      disbursements: 450,
      cashBalanceEnding: 750,
      difference: 0,
      lineCount: 5,
      verifiedCount: 0,
      readyToSign: false,
    });
    expect(ws.lines.map((l) => [l.entry.DateLogged.slice(0, 10), l.accountName, l.transfer])).toEqual([
      ['2026-02-10', 'Operating Checking', false],
      ['2026-03-05', 'Operating Checking', false],
      ['2026-04-01', 'General Savings', true],
      ['2026-04-01', 'Operating Checking', true],
      ['2026-05-01', 'Operating Checking', false],
    ]);
    expect(ws.cashAccounts.map((a) => a.accountName)).not.toContain('Physical Assets');
    expect(d.count(db, 'CouncilAudits')).toBe(0);
  });

  it('lets Trustees tick lines, then sign and lock the period against new postings', async () => {
    const db = await d.make();
    await postBooks(db);
    const { year, period } = ENDED;
    const first = (await db.finance.getTrusteeAudit(MEMBER.admin, OWN, year, period)).lines;
    const july = (await db.finance.getTrusteeAudit(MEMBER.admin, OWN, OPEN.year, OPEN.period)).lines[0];

    await expectRule(db.finance.setAuditLineVerified(MEMBER.member, OWN, year, period, first[0].entry.id, true), 'TRUSTEE_REQUIRED');
    await expectRule(db.finance.setAuditLineVerified(MEMBER.admin, OWN, year, period, first[0].entry.id, true), 'TRUSTEE_REQUIRED');
    grantRole(d, db, MEMBER.member, 'Trustee 1');
    await expectRule(db.finance.setAuditLineVerified(MEMBER.member, OWN, year, period, july.entry.id, true), 'INVALID_INPUT');
    await expectRule(db.finance.setAuditLineVerified(MEMBER.member, OWN, year, period, first[0].entry.id, 'yes' as unknown as boolean), 'INVALID_INPUT');
    await expectRule(db.finance.setAuditLineVerified(MEMBER.member, OTHER, year, period, first[0].entry.id, true), 'COUNCIL_ACCESS_DENIED');
    expect(d.count(db, 'CouncilAudits')).toBe(0);

    let ws = await db.finance.setAuditLineVerified(MEMBER.member, OWN, year, period, first[0].entry.id, true);
    expect(ws).toMatchObject({ status: 'DRAFT', verifiedCount: 1 });
    expect(ws.lines[0]).toMatchObject({ verified: true, verifiedByMemberId: MEMBER.member });
    ws = await db.finance.setAuditLineVerified(MEMBER.member, OWN, year, period, first[0].entry.id, true); // idempotent
    expect(ws.verifiedCount).toBe(1);
    ws = await db.finance.setAuditLineVerified(MEMBER.member, OWN, year, period, first[0].entry.id, false);
    expect(ws.verifiedCount).toBe(0);
    for (const line of first.slice(0, 4)) await db.finance.setAuditLineVerified(MEMBER.member, OWN, year, period, line.entry.id, true);

    await expectRule(db.finance.signTrusteeAudit(MEMBER.member, OWN, year, period), 'AUDIT_INCOMPLETE');
    ws = await db.finance.setAuditLineVerified(MEMBER.member, OWN, year, period, first[4].entry.id, true);
    expect(ws.readyToSign).toBe(true);

    ws = await db.finance.signTrusteeAudit(MEMBER.member, OWN, year, period);
    expect(ws).toMatchObject({ status: 'LOCKED', readyToSign: false, cashBalanceBeginning: 1000, cashBalanceEnding: 750 });
    expect(ws.signatures).toEqual([expect.objectContaining({ memberId: MEMBER.member, role: 'Trustee 1' })]);
    expect(ws.audit).toMatchObject({ execution_status: 'LOCKED', cash_balance_beginning: 1000, cash_balance_ending: 750 });

    // The period is locked: no posting, transfer or checkmark inside it.
    await expectRule(db.finance.logDoubleEntryTransaction(MEMBER.admin, pair(ACCT.checking, ACCT.dues, 5, '2026-03-10', 'Late dues')), 'AUDIT_PERIOD_LOCKED');
    await expectRule(db.finance.transferAssetFunds(MEMBER.admin, ACCT.checking, ACCT.savings, 5, { dateLogged: '2026-06-30' }), 'AUDIT_PERIOD_LOCKED');
    await expectRule(db.finance.setAuditLineVerified(MEMBER.member, OWN, year, period, first[0].entry.id, false), 'AUDIT_PERIOD_LOCKED');
    await db.finance.logDoubleEntryTransaction(MEMBER.admin, pair(ACCT.checking, ACCT.dues, 5, '2026-07-20', 'Dues after the window'));

    // Later signatures are added; nobody signs twice.
    await expectRule(db.finance.signTrusteeAudit(MEMBER.member, OWN, year, period), 'INVALID_INPUT');
    ws = await db.finance.signTrusteeAudit(MEMBER.superAdmin, OWN, year, period);
    expect(ws.signatures.map((s) => s.role)).toEqual(['Trustee 1', 'Super Admin']);
    expect(ws.cashBalanceEnding).toBe(750);

    const list = await db.finance.listTrusteeAudits(MEMBER.admin, OWN);
    expect(list.map((a) => [a.fiscal_year, a.audit_period, a.execution_status])).toEqual([[year, period, 'LOCKED']]);
  });

  it('waits for the period to end before the first signature', async () => {
    const db = await d.make();
    await postBooks(db);
    grantRole(d, db, MEMBER.member, 'Trustee 2');
    const ws = await db.finance.getTrusteeAudit(MEMBER.member, OWN, OPEN.year, OPEN.period);
    expect(ws.periodEnded).toBe(false);
    await db.finance.setAuditLineVerified(MEMBER.member, OWN, OPEN.year, OPEN.period, ws.lines[0].entry.id, true);
    await expectRule(db.finance.signTrusteeAudit(MEMBER.member, OWN, OPEN.year, OPEN.period), 'AUDIT_PERIOD_OPEN');
    expect((await db.finance.listTrusteeAudits(MEMBER.member, OWN)).map((a) => a.execution_status)).toEqual(['DRAFT']);
    // An empty, ended period can be signed straight away.
    expect((await db.finance.signTrusteeAudit(MEMBER.member, OWN, '2024-2025', 'JUL-DEC')).status).toBe('LOCKED');
  });

  it('is read by the books’ readers only', async () => {
    const db = await d.make();
    await expectRule(db.finance.getTrusteeAudit(MEMBER.member, OWN, ENDED.year, ENDED.period), 'ADMIN_REQUIRED');
    await expectRule(db.finance.getTrusteeAudit(MEMBER.admin, OTHER, ENDED.year, ENDED.period), 'COUNCIL_ACCESS_DENIED');
    await expectRule(db.finance.getTrusteeAudit(MEMBER.admin, OWN, ENDED.year, 'Q1' as never), 'INVALID_INPUT');
    await expectRule(db.finance.getTrusteeAudit(MEMBER.admin, OWN, '2026', ENDED.period), 'INVALID_INPUT');
    await expectRule(db.finance.listTrusteeAudits(MEMBER.member, OWN), 'ADMIN_REQUIRED');
    expect((await db.finance.getTrusteeAudit(MEMBER.superAdmin, OTHER, ENDED.year, ENDED.period)).lines).toEqual([]);
  });
});

describe.each(drivers)('$name driver: finance.getCouncilNetWorth', (d) => {
  it('adds cash and equipment and subtracts approved sheets not yet paid', async () => {
    const db = await d.make();
    await db.finance.logDoubleEntryTransaction(MEMBER.admin, [
      { GLAccountID: ACCT.checking, DebitAmount: 1000, Description: 'Opening', DateLogged: '2026-07-01' },
      { GLAccountID: ACCT.goal1, DebitAmount: 200, Description: 'Opening', DateLogged: '2026-07-01' },
      { GLAccountID: ACCT.savings, DebitAmount: 300, Description: 'Opening', DateLogged: '2026-07-01' },
      { GLAccountID: ACCT.physical, DebitAmount: 500, Description: 'Opening', DateLogged: '2026-07-01' },
      { GLAccountID: ACCT.openingEquity, CreditAmount: 2000, Description: 'Opening', DateLogged: '2026-07-01' },
    ]);
    raw(d, db, 'CouncilAssetsInventory', { council_id: OWN, asset_name: 'Grill', purchase_date: '2026-08-01 00:00:00', cost_basis: 450.1, current_status: 'ACTIVE' });
    raw(d, db, 'CouncilAssetsInventory', { council_id: OWN, asset_name: 'Old tent', purchase_date: '2019-08-01 00:00:00', cost_basis: 99, current_status: 'DISPOSED' });
    const sheet = (Status: string, amounts: number[]) => {
      const id = raw(d, db, 'ExpenseReport', { CouncilID: OWN, SubmitterMemberID: MEMBER.member, Status });
      for (const Amount of amounts) raw(d, db, 'ExpenseLineItem', { ExpenseReportID: id, DateOfExpense: '2026-08-02', Amount, VendorName: 'Store', ExpenseDescription: 'Supplies' });
      return id;
    };
    const approved = sheet('Approved', [20.25, 30]);
    sheet('Reimbursed', [100]);
    sheet('Submitted', [70]);

    const worth = await db.finance.getCouncilNetWorth(MEMBER.admin, OWN);
    expect(worth.cashAccounts).toEqual([
      { accountId: ACCT.checking, accountName: 'Operating Checking', balance: 1200 },
      { accountId: ACCT.savings, accountName: 'General Savings', balance: 300 },
      { accountId: ACCT.charitySavings, accountName: 'Charity Savings', balance: 0 },
    ]);
    expect(worth).toMatchObject({ liquidCash: 1500, equipmentValue: 450.1, unpaidApprovedExpenses: 50.25, netWorth: 1899.85 });
    expect(worth.unpaidReports).toEqual([{ reportId: approved, amount: 50.25, approvedAt: null }]);

    await expectRule(db.finance.getCouncilNetWorth(MEMBER.member, OWN), 'ADMIN_REQUIRED');
    await expectRule(db.finance.getCouncilNetWorth(MEMBER.admin, OTHER), 'COUNCIL_ACCESS_DENIED');
  });
});
