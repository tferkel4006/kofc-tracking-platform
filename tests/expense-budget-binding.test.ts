// Sprint 6G Extension (Phase 5): Expense Budget Binding - schema 45's ExpenseReport.budget_line_id and
// charity_request_id. Since Sprint 6Q only the Treasurer's ledger coding saves the 'Assign Ledger Budget Line Item'
// pick on the sheet, together with its general ledger account; the budget engine charges approved sheets only to that saved line
// (attributeBudgetSpend, read through amendments by currentBudgetLineIdOf), and the desks pre-select a meeting's
// expenses by universal category (findMeetingBudgetLine) and a charity-linked sheet by its request's line.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  assertExpenseBudgetLine,
  attributeBudgetSpend,
  cleanExpenseReportInput,
  currentBudgetLineIdOf,
  defaultExpenseBudgetLineId,
  findMeetingBudgetLine,
  MEETING_EXPENSE_UNIVERSAL_CATEGORY,
  planExpenseBudgetLineSave,
  type CouncilBudgetForecast,
  type DataService,
  type ExpenseLineItemInput,
} from '@kofc/shared';
import { MemoryDataService } from '../apps/web/services/drivers/memory';
import { SqliteDataService } from '../apps/mobile/services/drivers/sqlite';
import { TABLES } from '../apps/web/services/generated/schema.generated';
import { drivers, expectRule, ledgerCoder, MEMBER, NOW, type DriverUnderTest } from './helpers';
import { openDatabases } from './shims/expo-sqlite';

const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');
const OWN = 1;
const YEAR = '2026-2027'; // the tests' today, 2026-09-20, falls in it

const line = (id: number, over: Partial<CouncilBudgetForecast> = {}): CouncilBudgetForecast => ({
  id,
  CouncilID: OWN,
  FraternalYear: YEAR,
  CategoryType: 'Operational',
  ReferenceSourceID: null,
  LineItemName: `Line ${id}`,
  PrePopulatedAmount: 0,
  ApprovedBudgetAmount: 500,
  ProposedBudgetAmount: 500,
  BudgetStatus: 'Approved',
  BudgetCategoryID: null,
  Notes: null,
  quantity: 1,
  unit_cost: 0,
  budget_version: 1,
  universal_category: null,
  ...over,
});

const receipt = (over: Partial<ExpenseLineItemInput> = {}): ExpenseLineItemInput => ({
  DateOfExpense: '2026-09-15',
  Amount: 120,
  VendorName: 'Costco',
  ReceiptPhotoURL: null,
  ExpenseDescription: 'Meeting refreshments',
  ...over,
});

describe('schema 45: ExpenseReport.budget_line_id and charity_request_id', () => {
  it('adds both nullable keys with their foreign keys and bumps the phone database version', () => {
    const schema = read('Schema.sql');
    expect(schema).toContain('ALTER TABLE [ExpenseReport] ADD [budget_line_id] INT NULL;');
    expect(schema).toContain('ALTER TABLE [ExpenseReport] ADD [charity_request_id] INT NULL;');
    expect(schema).toMatch(/ADD FOREIGN KEY\(\[budget_line_id\]\)\s+REFERENCES \[CouncilBudgetForecast\]\(\[id\]\)/);
    expect(schema).toMatch(/ADD FOREIGN KEY\(\[charity_request_id\]\)\s+REFERENCES \[CharitableRequest\]\(\[id\]\)/);
    const columns = TABLES.ExpenseReport.columns;
    expect(columns.find((c) => c.name === 'budget_line_id')).toMatchObject({ notNull: false });
    expect(columns.find((c) => c.name === 'charity_request_id')).toMatchObject({ notNull: false });
    expect(read('apps/mobile/services/generated/schema.sqlite.ts')).toContain('[budget_line_id] INTEGER');
    expect(read('apps/mobile/services/drivers/sqlite.ts')).toMatch(/const SCHEMA_VERSION = (4[5-9]|[5-9]\d);/);
    expect(read('data_dictionary.md')).toContain('budget_line_id');
  });
});

describe('budget line binding rules (pure)', () => {
  // St. Mary's shape: several FRATERNAL_ACTIVITIES lines, only one an Operational meetings line.
  const camping = line(1, { CategoryType: 'Event', LineItemName: 'Council Camping Trip', universal_category: 'FRATERNAL_ACTIVITIES' });
  const monthly = line(2, { LineItemName: 'Monthly Council Meetings', universal_category: 'FRATERNAL_ACTIVITIES' });
  const awards = line(3, { LineItemName: 'Council Knight Awards', universal_category: 'MEMBERSHIP_RECOGNITION' });
  const pancakes = line(4, { CategoryType: 'Event', ReferenceSourceID: 40, LineItemName: 'Pancake Breakfast', universal_category: 'COMMUNITY_EVENTS' });
  const lines = [camping, monthly, awards, pancakes];

  it("pre-selects a meeting's expenses by the fraternal activities category, not the 'Council Meetings' name", () => {
    expect(MEETING_EXPENSE_UNIVERSAL_CATEGORY).toBe('FRATERNAL_ACTIVITIES');
    expect(findMeetingBudgetLine(lines)?.id).toBe(2);
    expect(defaultExpenseBudgetLineId(lines, { EventID: null, EventName: null, MeetingID: 6 })).toBe(2);
    // Another fraternal Operational line is chosen only when none mentions a meeting.
    const social = line(5, { LineItemName: 'Fraternal Socials', universal_category: 'FRATERNAL_ACTIVITIES' });
    expect(findMeetingBudgetLine([social, camping])?.id).toBe(5);
    // An unmapped council still finds its 'Council Meetings' line.
    expect(findMeetingBudgetLine([line(6, { LineItemName: 'Council Meetings' })])?.id).toBe(6);
    expect(findMeetingBudgetLine([camping, awards])).toBeUndefined();
  });

  it("defaults a charity-linked sheet to its request's line, ahead of its event or meeting", () => {
    expect(defaultExpenseBudgetLineId(lines, { EventID: 40, EventName: 'Pancake Breakfast', MeetingID: null, CharityBudgetLineID: 3 })).toBe(3);
    expect(defaultExpenseBudgetLineId(lines, { EventID: null, EventName: null, MeetingID: null, CharityBudgetLineID: 3 })).toBe(3);
    // A request line that is not assignable falls back to the sheet's other links.
    expect(defaultExpenseBudgetLineId(lines, { EventID: 40, EventName: null, MeetingID: null, CharityBudgetLineID: 99 })).toBe(4);
  });

  it('charges approved spend only to the saved line: links and names are never matched', () => {
    const { byLine, unbudgetedCents } = attributeBudgetSpend(lines, {
      expenses: [
        { BudgetLineID: 3, Amount: 40 }, // a pancake-breakfast receipt the signers charged to awards
        { BudgetLineID: null, Amount: 10 },
      ],
      charityChecks: [],
    });
    expect(byLine.get(3)).toBe(4000);
    expect(byLine.get(4)).toBe(0);
    expect(unbudgetedCents).toBe(1000);
  });

  it('reads a saved line through to its latest amended version', () => {
    const v1 = line(10, { LineItemName: 'Bank Fees' });
    const v2 = line(11, { LineItemName: ' bank  fees ', budget_version: 2 });
    expect(currentBudgetLineIdOf([v1, v2, awards], 10)).toBe(11);
    expect(currentBudgetLineIdOf([v1, v2], 11)).toBe(11);
    expect(currentBudgetLineIdOf([v1], 99)).toBeNull();
    expect(currentBudgetLineIdOf([v1], null)).toBeNull();
  });

  it('accepts only an Approved line of the council at its latest version', () => {
    const v1 = line(10, { LineItemName: 'Bank Fees' });
    const v2 = line(11, { LineItemName: 'Bank Fees', budget_version: 2 });
    const draft = line(12, { BudgetStatus: 'Proposed' });
    const foreign = line(13, { CouncilID: 2 });
    const all = [v1, v2, draft, foreign];
    expect(assertExpenseBudgetLine(all, OWN, 11)).toBe(11);
    expect(() => assertExpenseBudgetLine(all, OWN, 10)).toThrow(/latest version/);
    expect(() => assertExpenseBudgetLine(all, OWN, 12)).toThrow(/not an approved line/);
    expect(() => assertExpenseBudgetLine(all, OWN, 13)).toThrow(/not a line of council 1/);
    expect(() => assertExpenseBudgetLine(all, OWN, 1.5)).toThrow(/record id/);
  });

  it('saves the pick, else keeps the saved line, else the default for the link', () => {
    const base = { allLines: lines, assignable: lines, councilId: OWN, link: { EventID: null, EventName: null, MeetingID: 6 } };
    expect(planExpenseBudgetLineSave({ ...base, picked: 3, saved: 2 })).toBe(3);
    expect(planExpenseBudgetLineSave({ ...base, picked: null, saved: 3 })).toBe(3);
    expect(planExpenseBudgetLineSave({ ...base, picked: undefined, saved: null })).toBe(2);
    expect(planExpenseBudgetLineSave({ ...base, picked: null, saved: null, link: { EventID: null, EventName: null, MeetingID: null } })).toBeNull();
  });

  it('cleans the charity link like the other links', () => {
    expect(cleanExpenseReportInput({ Status: 'Draft' }).charity_request_id).toBeNull();
    expect(cleanExpenseReportInput({ Status: 'Draft', charity_request_id: 7 }).charity_request_id).toBe(7);
    expect(() => cleanExpenseReportInput({ Status: 'Draft', charity_request_id: 0 })).toThrow(/record id/);
  });
});

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

/** Reads one column of one row straight from the backing store. */
function rawGet(d: DriverUnderTest, db: DataService, table: string, id: number, column: string): unknown {
  if (d.name === 'memory') return (db as MemoryDataService).debugStore.rows(table).find((r) => r.id === id)![column];
  return (openDatabases.at(-1)!.prepare(`SELECT [${column}] AS v FROM [${table}] WHERE [id] = ?`).get(id) as { v: unknown }).v;
}

/** Sets one column of one row straight in the backing store. */
function rawSet(d: DriverUnderTest, db: DataService, table: string, id: number, column: string, value: string | number | null): void {
  if (d.name === 'memory') {
    Object.assign((db as MemoryDataService).debugStore.rows(table).find((r) => r.id === id)!, { [column]: value });
  } else {
    openDatabases.at(-1)!.prepare(`UPDATE [${table}] SET [${column}] = ? WHERE [id] = ?`).run(value, id);
  }
}

/** An approved line of the tests' year, inserted straight into the store. */
const addLine = (
  d: DriverUnderTest,
  db: DataService,
  name: string,
  over: Record<string, string | number | null> = {},
): number =>
  raw(d, db, 'CouncilBudgetForecast', {
    CouncilID: OWN,
    FraternalYear: YEAR,
    CategoryType: 'Operational',
    ReferenceSourceID: null,
    LineItemName: name,
    PrePopulatedAmount: 0,
    ProposedBudgetAmount: 1500,
    ApprovedBudgetAmount: 1500,
    BudgetStatus: 'Approved',
    quantity: 1,
    unit_cost: 0,
    budget_version: 1,
    universal_category: null,
    ...over,
  });

async function meetingSheet(db: DataService, submitter: number = MEMBER.member) {
  const meetingType = (await db.lookups.list('MeetingType'))[0].id;
  const meeting = await db.meetings.create({
    OwnerID: null,
    CouncilID: OWN,
    'Meeting Name': 'September business meeting',
    Date: '2026-09-15',
    'Time Start': '19:00:00',
    'Time End': '20:30:00',
    Location: 'Council Hall',
    MeetingType: meetingType,
  });
  return (await db.expenses.submitReport(submitter, { Status: 'Submitted', LinkedMeetingID: meeting.id }, [receipt()])).report;
}

describe.each(drivers)('expense budget binding ($name driver)', (d) => {
  // Sprint 6Q: only the Treasurer codes a sheet's budget line (and ledger account); the written order and the
  // counter-signature no longer touch it.
  const EVENT_COSTS = 12; // GLAccount 12, 'Event Operational Costs', an Expense account of council 1
  const code = async (db: DataService, reportId: number, budgetLineId: number, generalLedgerAccountId = EVENT_COSTS) =>
    db.expenses.treasurerLedgerAudit(await ledgerCoder(db), reportId, { budgetLineId, generalLedgerAccountId });

  it('saves the Treasurer’s pick on the sheet, keeps it through the counter-signature, and charges only that line', async () => {
    const db = await d.make();
    const meetings = addLine(d, db, 'Monthly Council Meetings', { universal_category: 'FRATERNAL_ACTIVITIES' });
    const awards = addLine(d, db, 'Council Knight Awards', { universal_category: 'MEMBERSHIP_RECOGNITION' });
    const sheet = await meetingSheet(db);
    expect(sheet.budget_line_id ?? null).toBeNull();

    const ordered = await db.expenses.financialSecretaryAuditOrder(MEMBER.admin, sheet.id);
    expect(ordered.report.budget_line_id ?? null).toBeNull();
    const coded = await code(db, sheet.id, awards);
    expect(coded.report).toMatchObject({ budget_line_id: awards, general_ledger_account_id: EVENT_COSTS, TreasurerMemberID: await ledgerCoder(db) });
    expect(coded.treasurerName).toBe('Ledger Coder');
    const approved = await db.expenses.grandKnightAuthorizeOrder(MEMBER.superAdmin, sheet.id);
    expect(approved.report).toMatchObject({ Status: 'Approved', budget_line_id: awards, general_ledger_account_id: EVENT_COSTS });

    // The meeting link would have pointed at the meetings line; the Treasurer's pick wins.
    const progress = await db.budget.getBudgetProgress(MEMBER.admin, OWN, YEAR);
    expect(progress.lines.find((l) => l.line.id === awards)?.actual).toBe(120);
    expect(progress.lines.find((l) => l.line.id === meetings)?.actual).toBe(0);
  });

  it('makes both picks mandatory and refuses a line or account that cannot take the spend, writing nothing', async () => {
    const db = await d.make();
    const awards = addLine(d, db, 'Council Knight Awards');
    const proposed = addLine(d, db, 'Draft Idea', { BudgetStatus: 'Proposed', ApprovedBudgetAmount: 0 });
    const foreign = addLine(d, db, 'Other Council Line', { CouncilID: 2 });
    const sheet = await meetingSheet(db);
    // Coding waits for the written order, and the counter-signature waits for the coding.
    await expectRule(code(db, sheet.id, awards), 'EXPENSE_STATUS_CONFLICT');
    await db.expenses.financialSecretaryAuditOrder(MEMBER.admin, sheet.id);
    await expectRule(db.expenses.grandKnightAuthorizeOrder(MEMBER.superAdmin, sheet.id), 'EXPENSE_STATUS_CONFLICT');

    const coder = await ledgerCoder(db);
    await expectRule(db.expenses.treasurerLedgerAudit(coder, sheet.id, { generalLedgerAccountId: EVENT_COSTS } as never), 'INVALID_INPUT');
    await expectRule(db.expenses.treasurerLedgerAudit(coder, sheet.id, { budgetLineId: awards } as never), 'INVALID_INPUT');
    for (const line of [proposed, foreign, 9999]) await expectRule(code(db, sheet.id, line), 'INVALID_INPUT');
    // Revenue (7), an asset (1, Operating Checking), physical property on an ordinary sheet (6) and an unknown account.
    for (const account of [7, 1, 6, 9999]) await expectRule(code(db, sheet.id, awards, account), 'INVALID_INPUT');
    expect(rawGet(d, db, 'ExpenseReport', sheet.id, 'TreasurerMemberID') ?? null).toBeNull();
    expect(rawGet(d, db, 'ExpenseReport', sheet.id, 'budget_line_id') ?? null).toBeNull();

    // A long-term asset sheet may also be charged to the physical property account.
    rawSet(d, db, 'ExpenseReport', sheet.id, 'is_long_term_asset', 1);
    expect((await code(db, sheet.id, awards, 6)).report.general_ledger_account_id).toBe(6);
    await expectRule(code(db, sheet.id, awards), 'EXPENSE_STATUS_CONFLICT');
  });

  it("keeps the desk to the council's Treasurer or a Super Admin, never on their own sheet or the order's issuer", async () => {
    const db = await d.make();
    const awards = addLine(d, db, 'Council Knight Awards');
    const sheet = await meetingSheet(db);
    await db.expenses.financialSecretaryAuditOrder(MEMBER.admin, sheet.id);
    const coding = { budgetLineId: awards, generalLedgerAccountId: EVENT_COSTS };
    await expectRule(db.expenses.treasurerLedgerAudit(MEMBER.member, sheet.id, coding), 'TREASURER_REQUIRED');
    await expectRule(db.expenses.treasurerLedgerAudit(MEMBER.admin, sheet.id, coding), 'TREASURER_REQUIRED');
    await expectRule(db.expenses.listTreasurerQueue(MEMBER.member, OWN), 'TREASURER_REQUIRED');
    expect((await db.expenses.listTreasurerQueue(MEMBER.admin, OWN)).map((q) => q.report.id)).toEqual([sheet.id]);
    // The member who submitted it, now Treasurer, still may not code their own sheet.
    raw(d, db, 'MemberRoles', { RoleID: 6, MemberID: MEMBER.member });
    expect((await db.expenses.listTreasurerQueue(MEMBER.member, OWN)).map((q) => q.report.id)).toEqual([sheet.id]);
    await expectRule(db.expenses.treasurerLedgerAudit(MEMBER.member, sheet.id, coding), 'SELF_APPROVAL_BLOCKED');
    await expectRule(db.expenses.listTreasurerQueue(MEMBER.member, 2), 'COUNCIL_ACCESS_DENIED');
    // A Treasurer of the council codes a colleague's sheet.
    const other = await meetingSheet(db, MEMBER.superAdmin);
    await db.expenses.financialSecretaryAuditOrder(MEMBER.admin, other.id);
    expect((await db.expenses.treasurerLedgerAudit(MEMBER.member, other.id, coding)).report.TreasurerMemberID).toBe(MEMBER.member);
  });

  it('clears the coding when the sheet is returned, so it is chosen afresh', async () => {
    const db = await d.make();
    const awards = addLine(d, db, 'Council Knight Awards');
    const sheet = await meetingSheet(db);
    await db.expenses.financialSecretaryAuditOrder(MEMBER.admin, sheet.id);
    await code(db, sheet.id, awards);
    const returned = await db.expenses.rejectReport(MEMBER.admin, sheet.id, 'Attach the itemized receipt.');
    expect(returned.report).toMatchObject({ Status: 'Draft', TreasurerMemberID: null, TreasurerReviewedAt: null, general_ledger_account_id: null });
    expect(returned.report.budget_line_id ?? null).toBeNull();
  });

  it('keeps charging an amended line after its mid-year amendment', async () => {
    const db = await d.make();
    const awards = addLine(d, db, 'Council Knight Awards', { ApprovedBudgetAmount: 700, ProposedBudgetAmount: 700 });
    const sheet = await meetingSheet(db);
    await db.expenses.financialSecretaryAuditOrder(MEMBER.admin, sheet.id);
    await code(db, sheet.id, awards);
    await db.expenses.grandKnightAuthorizeOrder(MEMBER.superAdmin, sheet.id);
    const amended = await db.budget.amendApprovedLine(MEMBER.admin, awards, { approvedAmount: 900 });
    const progress = await db.budget.getBudgetProgress(MEMBER.admin, OWN, YEAR);
    const row = progress.lines.find((l) => l.line.LineItemName === 'Council Knight Awards')!;
    expect(row.line.id).not.toBe(awards);
    expect(row.line.id).toBe(amended.id);
    expect(row.actual).toBe(120);
  });

  it("links a sheet to a charitable request of its council and exposes the request's line for the desk's default", async () => {
    const db = await d.make();
    const gift = addLine(d, db, 'Family Clinic', { universal_category: 'CHARITABLE_DONATIONS' });
    const { request } = await db.charities.submitCharitableRequest(MEMBER.member, { OrganizationName: 'Family Clinic', AmountRequested: 300, RelationshipTypeID: 1, Is501c3: true });
    rawSet(d, db, 'CharitableRequest', request.id, 'TargetBudgetLineID', gift);
    const { report } = await db.expenses.submitReport(MEMBER.member, { Status: 'Submitted', charity_request_id: request.id }, [receipt({ ExpenseDescription: 'Clinic supplies' })]);
    expect(report.charity_request_id).toBe(request.id);
    const [queued] = (await db.expenses.listCouncilQueue(MEMBER.admin, OWN)).filter((x) => x.report.id === report.id);
    expect(queued.charityBudgetLineId).toBe(gift);
    // The written order saves no line; the Treasurer's desk starts on the request's line and saves it when coded.
    expect((await db.expenses.financialSecretaryAuditOrder(MEMBER.admin, report.id)).report.budget_line_id ?? null).toBeNull();
    const [onDesk] = await db.expenses.listTreasurerQueue(MEMBER.superAdmin, OWN);
    expect(onDesk.charityBudgetLineId).toBe(gift);
    expect((await code(db, report.id, gift)).report.budget_line_id).toBe(gift);

    await expectRule(db.expenses.submitReport(MEMBER.member, { Status: 'Draft', charity_request_id: 9999 }, []), 'INVALID_INPUT');
    const foreign = raw(d, db, 'CharitableRequest', { CouncilID: 2, ShepherdMemberID: MEMBER.superAdmin, OrganizationName: 'Elsewhere', AmountRequested: 50, RequestStatus: 'Submitted', SubmittedAt: '2026-09-01 00:00:00' });
    await expectRule(db.expenses.submitReport(MEMBER.member, { Status: 'Draft', charity_request_id: foreign }, []), 'INVALID_INPUT');
  });
});

describe("St. Mary's presentation budget", () => {
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

  it.each(make)("pre-selects 'Monthly Council Meetings' for a meeting's expenses (%s)", async (_name, create) => {
    const db = await create();
    const forecast = await db.budget.listAnnualForecast(MEMBER.admin, OWN, YEAR);
    const monthly = forecast.lines.find((l) => l.LineItemName === 'Monthly Council Meetings')!;
    expect(monthly.universal_category).toBe('FRATERNAL_ACTIVITIES');
    expect(findMeetingBudgetLine(forecast.lines)?.id).toBe(monthly.id);
    expect(defaultExpenseBudgetLineId(forecast.lines, { EventID: null, EventName: null, MeetingID: 1 })).toBe(monthly.id);
  });
});
