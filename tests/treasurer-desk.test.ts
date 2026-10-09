// Sprint 6Q (schema 56): the Treasurer Ledger Audit Desk, expense sheets linked to long-running activities, and the
// Treasurer's '💰 Log Concluded Event Revenues' card (finance.logConcludedRevenue). The three-signature workflow itself
// is covered in expenses.test.ts and expense-budget-binding.test.ts.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  assertExpenseLedgerAccount,
  canLogConcludedRevenue,
  canOpenTreasurerDesk,
  cleanExpenseReportInput,
  concludedRevenueAccounts,
  eventHasConcluded,
  expenseLedgerAccountChoices,
  expenseLedgerCodeBlock,
  planConcludedRevenue,
  portalAreas,
  RECORD_REFERENCES,
  type DataService,
  type GLAccount,
} from '@kofc/shared';
import { TABLES } from '../apps/web/services/generated/schema.generated';
import { drivers, expectRule, MEMBER, NOW, treasurerCode } from './helpers';

const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');
const OWN = 1;
const ULTRASOUND = 10; // Activities id 10 in the baseline seed
const OPERATING_CHECKING = 1;
const PARKING_FUNDRAISING = 8; // a Revenue account
const EVENT_COSTS = 12; // an Expense account

const account = (id: number, AccountName: string, AccountType: GLAccount['AccountType'], over: Partial<GLAccount> = {}): GLAccount => ({
  id,
  CouncilID: OWN,
  AccountName,
  AccountType,
  ParentAccountID: null,
  IsVirtualGoal: 0,
  TargetGoalAmount: 0,
  ...over,
});
const CHART = [
  account(1, 'Operating Checking', 'Asset'),
  account(2, 'Goal Account #1', 'Asset', { ParentAccountID: 1, IsVirtualGoal: 1 }),
  account(6, 'Physical Assets', 'Asset'),
  account(8, 'Parking Fundraising', 'Revenue'),
  account(9, 'General Fundraising', 'Revenue'),
  account(12, 'Event Operational Costs', 'Expense'),
  account(13, 'Council Operational Costs', 'Expense'),
  account(40, 'Other Council Costs', 'Expense', { CouncilID: 2 }),
];

describe('schema 56', () => {
  it('adds the Treasurer signature, the ledger account and the activity links, and bumps the phone database', () => {
    const schema = read('Schema.sql');
    for (const column of ['TreasurerMemberID', 'TreasurerReviewedAt', 'general_ledger_account_id', 'LinkedActivityID']) {
      expect(TABLES.ExpenseReport.columns.find((c) => c.name === column), column).toMatchObject({ notNull: false });
    }
    expect(TABLES.JournalEntry.columns.find((c) => c.name === 'LinkedActivityID')).toMatchObject({ notNull: false });
    expect(schema).toMatch(/ADD FOREIGN KEY\(\[general_ledger_account_id\]\)\s+REFERENCES \[GLAccount\]\(\[id\]\)/);
    expect(schema).toMatch(/ADD FOREIGN KEY\(\[TreasurerMemberID\]\)\s+REFERENCES \[Member\]\(\[id\]\)/);
    expect(read('apps/mobile/services/drivers/sqlite.ts')).toMatch(/const SCHEMA_VERSION = (5[6-9]|[6-9]\d);/);
    expect(read('data_dictionary.md')).toContain('general_ledger_account_id');
    // An activity named by an expense sheet or a ledger posting cannot be deleted out from under it.
    expect(RECORD_REFERENCES.Activities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ table: 'ExpenseReport', column: 'LinkedActivityID' }),
        expect.objectContaining({ table: 'JournalEntry', column: 'LinkedActivityID' }),
      ]),
    );
  });
});

describe('Treasurer desk rules (pure)', () => {
  const user = (over = {}) => ({ memberId: 10, councilId: OWN, memberType: 'Member' as const, isOfficer: true, roles: [] as string[], ...over });
  const sheet = (over = {}) => ({ CouncilID: OWN, SubmitterMemberID: 11, FinancialSecretaryMemberID: 12, ...over });

  it('opens the desk to the Treasurer and Admins, and the coding and revenue card to the Treasurer and Super Admins', () => {
    const treasurer = user({ roles: ['Treasurer'] });
    expect(canOpenTreasurerDesk(treasurer, OWN)).toBe(true);
    expect(canOpenTreasurerDesk(treasurer, 2)).toBe(false);
    expect(canOpenTreasurerDesk(user({ memberType: 'Admin' }), OWN)).toBe(true);
    expect(canOpenTreasurerDesk(user({ roles: ['Financial Secretary'] }), OWN)).toBe(false);
    expect(canLogConcludedRevenue(treasurer, OWN)).toBe(true);
    expect(canLogConcludedRevenue(user({ memberType: 'Admin' }), OWN)).toBe(false);
    expect(canLogConcludedRevenue(user({ memberType: 'Super Admin' }), 2)).toBe(true);
    expect(expenseLedgerCodeBlock(treasurer, sheet())).toBeNull();
    expect(expenseLedgerCodeBlock(treasurer, sheet({ SubmitterMemberID: 10 }))).toBe('own-report');
    expect(expenseLedgerCodeBlock(treasurer, sheet({ FinancialSecretaryMemberID: 10 }))).toBe('collusion');
    expect(expenseLedgerCodeBlock(user({ memberType: 'Admin' }), sheet())).toBe('seat');
    expect(portalAreas(treasurer)).toContain('finance/treasurer-desk');
    expect(portalAreas(user({ roles: ['Grand Knight'] }))).not.toContain('finance/treasurer-desk');
  });

  it("offers the council's expense accounts, plus physical property for a long-term asset", () => {
    expect(expenseLedgerAccountChoices(CHART, { CouncilID: OWN, is_long_term_asset: 0 }).map((a) => a.id)).toEqual([12, 13]);
    expect(expenseLedgerAccountChoices(CHART, { CouncilID: OWN, is_long_term_asset: 1 }).map((a) => a.id)).toEqual([6, 12, 13]);
    expect(assertExpenseLedgerAccount(CHART, { CouncilID: OWN, is_long_term_asset: 0 }, 13)).toBe(13);
    expect(() => assertExpenseLedgerAccount(CHART, { CouncilID: OWN, is_long_term_asset: 0 }, 8)).toThrow(/not an expense account/);
    expect(() => assertExpenseLedgerAccount(CHART, { CouncilID: OWN, is_long_term_asset: 0 }, 40)).toThrow(/not an account of council 1/);
    expect(() => assertExpenseLedgerAccount(CHART, { CouncilID: OWN, is_long_term_asset: 0 }, null)).toThrow(/Choose the ledger account/);
  });

  it('keeps an activity link apart from event and meeting links', () => {
    expect(cleanExpenseReportInput({ Status: 'Draft', LinkedActivityID: ULTRASOUND }).LinkedActivityID).toBe(ULTRASOUND);
    expect(cleanExpenseReportInput({ Status: 'Draft' }).LinkedActivityID).toBeNull();
    expect(() => cleanExpenseReportInput({ Status: 'Draft', LinkedActivityID: ULTRASOUND, LinkedEventID: 4 })).toThrow(/cannot also name an event/);
    expect(() => cleanExpenseReportInput({ Status: 'Draft', LinkedActivityID: 0 })).toThrow(/record id/);
  });

  it('plans concluded revenue as a balanced debit to cash and credit to revenue', () => {
    expect(concludedRevenueAccounts(CHART, OWN)).toEqual({ revenue: [CHART[3], CHART[4]], deposit: [CHART[0]] });
    expect(eventHasConcluded({ EndDate: '2026-09-20' }, '2026-09-20')).toBe(true);
    expect(eventHasConcluded({ EndDate: '2026-09-21 00:00:00' }, '2026-09-20')).toBe(false);
    const source = { kind: 'activity' as const, activity: { id: ULTRASOUND, ActivityName: 'Ultrasound', CouncilID: OWN } };
    const lines = planConcludedRevenue(OWN, { LinkedActivityID: ULTRASOUND, Amount: 250.5, RevenueAccountID: 9, DateLogged: '2026-09-19' }, source, CHART, NOW);
    expect(lines).toEqual([
      expect.objectContaining({ GLAccountID: 1, DebitAmount: 250.5, CreditAmount: 0, LinkedActivityID: ULTRASOUND, LinkedEventID: null, Description: 'Revenue collected: Ultrasound' }),
      expect.objectContaining({ GLAccountID: 9, DebitAmount: 0, CreditAmount: 250.5, LinkedActivityID: ULTRASOUND, DateLogged: '2026-09-19 00:00:00' }),
    ]);
    const plan = (over: object) => () => planConcludedRevenue(OWN, { LinkedActivityID: ULTRASOUND, Amount: 10, RevenueAccountID: 9, ...over }, source, CHART, NOW);
    expect(plan({ RevenueAccountID: 12 })).toThrow(/not a revenue account/);
    expect(plan({ DepositAccountID: 2 })).toThrow(/not a cash account/);
    expect(plan({ DepositAccountID: 6 })).toThrow(/not a cash account/);
    expect(plan({ Amount: 0 })).toThrow(/above \$0.00/);
    expect(plan({ Amount: 1.005 })).toThrow();
    expect(plan({ DateLogged: '2026-09-21' })).toThrow(/future/);
    expect(plan({ LinkedEventID: 3 })).toThrow(/one past event or one activity/);
  });
});

describe.each(drivers)('Sprint 6Q ($name driver)', (d) => {
  const receipt = { DateOfExpense: '2026-09-15', Amount: 80, VendorName: 'Clinic Supply', ReceiptPhotoURL: null, ExpenseDescription: 'Ultrasound gel' };
  const event = (db: DataService, StartDate: string, EndDate: string) =>
    db.events.create({ EventName: `Parking ${StartDate}`, EventDescription: 'Lot', OwnerID: MEMBER.admin, StartDate, EndDate, Location: 'Lot', CategoryID: 1 }, [OWN]);

  it('files an expense against a long-running activity with no window, and refuses another council’s activity', async () => {
    const db = await d.make();
    const { report } = await db.expenses.submitReport(MEMBER.member, { Status: 'Submitted', LinkedActivityID: ULTRASOUND }, [receipt]);
    expect(report).toMatchObject({ Status: 'Submitted', LinkedActivityID: ULTRASOUND, LinkedEventID: null, LinkedMeetingID: null });
    await expectRule(db.expenses.submitReport(MEMBER.member, { Status: 'Draft', LinkedActivityID: 9999 }, []), 'INVALID_INPUT');
    const foreign = await db.activities.create(MEMBER.superAdmin, { ActivityName: 'Elsewhere drive', ActivityDescription: 'Another council', CategoryID: 2, CouncilID: 2 });
    await expectRule(db.expenses.submitReport(MEMBER.member, { Status: 'Draft', LinkedActivityID: foreign.id }, []), 'INVALID_INPUT');

    // It runs the whole signing path and stays linked; an activity in use cannot be deleted.
    await db.expenses.financialSecretaryAuditOrder(MEMBER.admin, report.id);
    await treasurerCode(db, report.id, { generalLedgerAccountId: EVENT_COSTS });
    const approved = await db.expenses.grandKnightAuthorizeOrder(MEMBER.superAdmin, report.id);
    expect(approved.report).toMatchObject({ Status: 'Approved', LinkedActivityID: ULTRASOUND, general_ledger_account_id: EVENT_COSTS });
    await expectRule(db.activities.remove(MEMBER.superAdmin, ULTRASOUND), 'RECORD_IN_USE');
  });

  it("logs a past event's and an activity's revenue straight into the ledger, for the Treasurer only", async () => {
    const db = await d.make();
    const past = await event(db, '2026-09-12', '2026-09-13');
    const future = await event(db, '2026-10-03', '2026-10-03');
    const before = await db.finance.getLatestBalanceSheet(MEMBER.superAdmin, OWN);

    const input = { LinkedEventID: past.id, Amount: 1240, RevenueAccountID: PARKING_FUNDRAISING, DateLogged: '2026-09-14' };
    await expectRule(db.finance.logConcludedRevenue(MEMBER.admin, OWN, input), 'TREASURER_REQUIRED');
    await expectRule(db.finance.logConcludedRevenue(MEMBER.member, OWN, input), 'TREASURER_REQUIRED');
    await expectRule(db.finance.logConcludedRevenue(MEMBER.superAdmin, OWN, { ...input, LinkedEventID: future.id }), 'INVALID_INPUT');
    await expectRule(db.finance.logConcludedRevenue(MEMBER.superAdmin, OWN, { ...input, RevenueAccountID: EVENT_COSTS }), 'INVALID_INPUT');
    expect(d.count(db, 'JournalEntry')).toBe(0);

    const lines = await db.finance.logConcludedRevenue(MEMBER.superAdmin, OWN, input);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ GLAccountID: OPERATING_CHECKING, DebitAmount: 1240, LinkedEventID: past.id, DateLogged: '2026-09-14 00:00:00' });
    expect(lines[1]).toMatchObject({ GLAccountID: PARKING_FUNDRAISING, CreditAmount: 1240, LinkedEventID: past.id });
    expect(lines[0].TransactionID).toBe(lines[1].TransactionID);
    expect(lines[0].Description).toBe(`Revenue collected: ${past.EventName}`);

    // A Treasurer of the council logs an activity's money too.
    const treasurer = MEMBER.member;
    if (d.name === 'memory') {
      const store = (db as unknown as { debugStore: { insert(t: string, r: object): unknown } }).debugStore;
      store.insert('MemberRoles', { RoleID: 6, MemberID: treasurer });
    } else {
      const { openDatabases } = await import('./shims/expo-sqlite');
      openDatabases.at(-1)!.prepare('INSERT INTO [MemberRoles] ([RoleID], [MemberID]) VALUES (6, ?)').run(treasurer);
    }
    const [debit] = await db.finance.logConcludedRevenue(treasurer, OWN, { LinkedActivityID: ULTRASOUND, Amount: 300, RevenueAccountID: 10 });
    expect(debit).toMatchObject({ LinkedActivityID: ULTRASOUND, DebitAmount: 300 });
    expect(debit.DateLogged.slice(0, 10)).toBe('2026-09-20'); // stamped now, in UTC like every other posting
    await expectRule(db.finance.logConcludedRevenue(treasurer, 2, { LinkedActivityID: ULTRASOUND, Amount: 300, RevenueAccountID: 10 }), 'COUNCIL_ACCESS_DENIED');

    const after = await db.finance.getLatestBalanceSheet(MEMBER.superAdmin, OWN);
    expect(after.totalAssets - before.totalAssets).toBe(1540);
    expect(after.isBalanced).toBe(true);
  });
});
