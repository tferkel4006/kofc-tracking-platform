// Sprint 6E (Phase 5): Automated Expense-to-Asset Conversion and the Miscellaneous Budget Catch-All - schema 43's
// ExpenseReport.is_long_term_asset and CouncilAssetsInventory, the workflow engine's conversion hook
// (planExpenseAssetConversion) on approval and reimbursement, expenses.listAssetsInventory, and the 'Miscellaneous
// Others' fallback for unclaimed spend (attributeBudgetSpend) and for approved charitable requests with no budget line
// (planCharitableBudgetFallback).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ASSET_NAME_MAX_LENGTH,
  attributeBudgetSpend,
  BUDGET_MISCELLANEOUS_LINE_NAME,
  cleanExpenseReportInput,
  findMiscellaneousBudgetLine,
  isLongTermAssetExpense,
  planCharitableBudgetFallback,
  planExpenseAssetConversion,
  type CouncilBudgetForecast,
  type DataService,
  type ExpenseLineItemInput,
} from '@kofc/shared';
import { MemoryDataService } from '../apps/web/services/drivers/memory';
import { TABLES } from '../apps/web/services/generated/schema.generated';
import { drivers, expectRule, MEMBER, type DriverUnderTest } from './helpers';
import { openDatabases } from './shims/expo-sqlite';

const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');
const OWN = 1;
const YEAR = '2026-2027'; // the tests' today, 2026-09-20, falls in it

const receipt = (over: Partial<ExpenseLineItemInput> = {}): ExpenseLineItemInput => ({
  DateOfExpense: '2026-09-12',
  Amount: 42.5,
  VendorName: 'Costco',
  ReceiptPhotoURL: null,
  ExpenseDescription: 'Folding banquet tables',
  ...over,
});

const line = (over: Partial<CouncilBudgetForecast>): CouncilBudgetForecast => ({
  id: 1,
  CouncilID: OWN,
  FraternalYear: YEAR,
  CategoryType: 'Operational',
  ReferenceSourceID: null,
  LineItemName: BUDGET_MISCELLANEOUS_LINE_NAME,
  PrePopulatedAmount: 0,
  ApprovedBudgetAmount: 750,
  ProposedBudgetAmount: 750,
  BudgetStatus: 'Approved',
  BudgetCategoryID: null,
  Notes: null,
  quantity: 1,
  unit_cost: 0,
  budget_version: 1,
  ...over,
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

/** Sets one column of one row straight in the backing store. */
function rawSet(d: DriverUnderTest, db: DataService, table: string, id: number, column: string, value: string | number | null): void {
  if (d.name === 'memory') {
    Object.assign((db as MemoryDataService).debugStore.rows(table).find((r) => r.id === id)!, { [column]: value });
  } else {
    openDatabases.at(-1)!.prepare(`UPDATE [${table}] SET [${column}] = ? WHERE [id] = ?`).run(value, id);
  }
}

/** The council's approved 'Miscellaneous Others' line for the tests' year, inserted straight into the store. */
const addMiscellaneousLine = (d: DriverUnderTest, db: DataService): number =>
  raw(d, db, 'CouncilBudgetForecast', {
    CouncilID: OWN,
    FraternalYear: YEAR,
    CategoryType: 'Operational',
    ReferenceSourceID: null,
    LineItemName: BUDGET_MISCELLANEOUS_LINE_NAME,
    PrePopulatedAmount: 0,
    ProposedBudgetAmount: 750,
    ApprovedBudgetAmount: 750,
    BudgetStatus: 'Approved',
    quantity: 1,
    unit_cost: 0,
    budget_version: 1,
  });

/** Member 3's sheet, signed by the seeded Financial Secretary (Admin 2) and Grand Knight (Super Admin 1). */
async function approvedSheet(db: DataService, isAsset: boolean, items = [receipt()]) {
  const { report } = await db.expenses.submitReport(MEMBER.member, { Status: 'Submitted', is_long_term_asset: isAsset }, items);
  await db.expenses.financialSecretaryAuditOrder(MEMBER.admin, report.id);
  return db.expenses.grandKnightAuthorizeOrder(MEMBER.superAdmin, report.id);
}

describe('schema 43: ExpenseReport.is_long_term_asset and CouncilAssetsInventory', () => {
  it('adds the flag and the inventory table, and bumps the phone database version', () => {
    const schema = read('Schema.sql');
    expect(schema).toContain('ALTER TABLE [ExpenseReport] ADD [is_long_term_asset] BIT NOT NULL DEFAULT 0;');
    expect(schema).toContain('CREATE TABLE [CouncilAssetsInventory] (');
    expect(TABLES.CouncilAssetsInventory.columns.map((c) => c.name)).toEqual([
      'id',
      'council_id',
      'asset_name',
      'purchase_date',
      'cost_basis',
      'original_expense_id',
      'current_status',
      'notes',
    ]);
    expect(TABLES.CouncilAssetsInventory.columns.find((c) => c.name === 'current_status')).toMatchObject({ default: { kind: 'literal', value: 'ACTIVE' } });
    expect(TABLES.ExpenseReport.columns.find((c) => c.name === 'is_long_term_asset')).toMatchObject({ notNull: true, default: { kind: 'literal', value: 0 } });
    expect(read('apps/mobile/services/generated/schema.sqlite.ts')).toContain('CREATE TABLE [CouncilAssetsInventory]');
    expect(read('apps/mobile/services/drivers/sqlite.ts')).toMatch(/const SCHEMA_VERSION = (4[3-9]|[5-9]\d);/);
    expect(read('data_dictionary.md')).toContain('[CouncilAssetsInventory]');
  });
});

describe('expense-to-asset conversion hook (pure)', () => {
  const report = { id: 12, CouncilID: OWN, is_long_term_asset: 1 };
  const items = [
    { DateOfExpense: '2026-09-14', Amount: 199.99, VendorName: 'Costco', ExpenseDescription: 'Commercial griddle' },
    { DateOfExpense: '2026-09-10', Amount: 0.01, VendorName: 'Home Depot', ExpenseDescription: '  Griddle   cart ' },
  ];

  it('turns an approved asset sheet into one ACTIVE row, extracted from its receipts', () => {
    expect(planExpenseAssetConversion({ from: 'Submitted', to: 'Approved', report, lineItems: items, alreadyConverted: false })).toEqual({
      council_id: OWN,
      asset_name: 'Griddle cart; Commercial griddle',
      purchase_date: '2026-09-10 00:00:00',
      cost_basis: 200,
      original_expense_id: 12,
      current_status: 'ACTIVE',
      notes: 'Converted from expense report 12 when it became Approved. Vendor: Home Depot, Costco.',
    });
    // A sheet approved before schema 43 is converted when it is paid.
    expect(planExpenseAssetConversion({ from: 'Approved', to: 'Reimbursed', report, lineItems: items, alreadyConverted: false })).toMatchObject({
      cost_basis: 200,
    });
  });

  it('writes nothing for a plain sheet, a converted one, an illegal or non-approving move, or no receipts', () => {
    const base = { from: 'Submitted', to: 'Approved' as const, report, lineItems: items, alreadyConverted: false };
    expect(planExpenseAssetConversion({ ...base, report: { ...report, is_long_term_asset: 0 } })).toBeNull();
    expect(planExpenseAssetConversion({ ...base, alreadyConverted: true })).toBeNull();
    expect(planExpenseAssetConversion({ ...base, from: 'Draft' })).toBeNull();
    expect(planExpenseAssetConversion({ ...base, to: 'Draft' })).toBeNull();
    expect(planExpenseAssetConversion({ ...base, lineItems: [] })).toBeNull();
  });

  it('caps a long asset name at the column length', () => {
    const long = [{ ...items[0], ExpenseDescription: 'x'.repeat(400) }];
    const asset = planExpenseAssetConversion({ from: 'Submitted', to: 'Approved', report, lineItems: long, alreadyConverted: false })!;
    expect(asset.asset_name).toHaveLength(ASSET_NAME_MAX_LENGTH);
    expect(asset.asset_name.endsWith('…')).toBe(true);
  });

  it('reads the checkbox as a BIT and refuses anything else', () => {
    expect(cleanExpenseReportInput({ Status: 'Draft' }).is_long_term_asset).toBe(0);
    expect(cleanExpenseReportInput({ Status: 'Draft', is_long_term_asset: true }).is_long_term_asset).toBe(1);
    expect(cleanExpenseReportInput({ Status: 'Draft', is_long_term_asset: 0 }).is_long_term_asset).toBe(0);
    expect(() => cleanExpenseReportInput({ Status: 'Draft', is_long_term_asset: 'yes' as never })).toThrow(/true or false/);
    expect(isLongTermAssetExpense({ is_long_term_asset: 1 })).toBe(true);
    expect(isLongTermAssetExpense({})).toBe(false);
  });
});

describe('Miscellaneous Others catch-all (pure)', () => {
  const misc = line({ id: 9 });
  const pancake = line({ id: 2, CategoryType: 'Event', LineItemName: 'Pancake Breakfast', ApprovedBudgetAmount: 500 });
  const pantry = line({ id: 3, CategoryType: 'Donation', ReferenceSourceID: 1, LineItemName: 'St. Jude Pantry', ApprovedBudgetAmount: 1000 });
  const spend = {
    expenses: [
      { EventID: 4, EventName: 'pancake  breakfast', MeetingID: null, Amount: 100 },
      { EventID: 8, EventName: 'One-off car wash', MeetingID: null, Amount: 20.25 },
      { EventID: null, EventName: null, MeetingID: null, Amount: 10 },
      { EventID: null, EventName: null, MeetingID: 5, Amount: 4.5 }, // no 'Council Meetings' line this year
    ],
    charityChecks: [
      { CharityID: 1, Amount: 300 },
      { CharityID: 7, Amount: 50 },
      { CharityID: 7, Amount: 25, BudgetLineID: 2 },
    ],
  };

  it('routes every unclaimed piece of spend to the line, and still honours the lines that claim theirs', () => {
    const { byLine, unbudgetedCents, miscellaneousCents } = attributeBudgetSpend([pancake, pantry, misc], spend);
    expect(byLine.get(2)).toBe(12500); // the event's expense plus the gift assigned to this line
    expect(byLine.get(3)).toBe(30000);
    expect(byLine.get(9)).toBe(8475); // 20.25 + 10 + 4.50 + 50.00
    expect(miscellaneousCents).toBe(8475);
    expect(unbudgetedCents).toBe(0);
  });

  it('leaves unclaimed spend unbudgeted in a year without the line', () => {
    const { unbudgetedCents, miscellaneousCents } = attributeBudgetSpend([pancake, pantry], spend);
    expect(unbudgetedCents).toBe(8475);
    expect(miscellaneousCents).toBe(0);
  });

  it('finds the line ignoring case and spacing, latest version first, and tags only unassigned approved requests', () => {
    const v2 = line({ id: 10, LineItemName: ' miscellaneous   OTHERS ', budget_version: 2 });
    expect(findMiscellaneousBudgetLine([pancake, misc, v2])?.id).toBe(10);
    expect(findMiscellaneousBudgetLine([pancake, line({ id: 11, CategoryType: 'Event' })])).toBeUndefined();
    expect(planCharitableBudgetFallback({ VoteStatus: 'Approved', TargetBudgetLineID: null }, [pancake, misc])).toEqual({ TargetBudgetLineID: 9 });
    expect(planCharitableBudgetFallback({ VoteStatus: 'Approved', TargetBudgetLineID: 3 }, [misc])).toBeNull();
    expect(planCharitableBudgetFallback({ VoteStatus: 'Rejected', TargetBudgetLineID: null }, [misc])).toBeNull();
    expect(planCharitableBudgetFallback({ VoteStatus: 'Approved' }, [pancake])).toBeNull();
  });
});

describe.each(drivers)('expense assets and the catch-all ($name driver)', (d) => {
  it('converts a long-term asset sheet the moment the Grand Knight approves it, once', async () => {
    const db = await d.make();
    const draft = await db.expenses.submitReport(MEMBER.member, { Status: 'Draft', is_long_term_asset: true }, [receipt()]);
    expect(draft.report.is_long_term_asset).toBe(1);
    const resubmitted = await db.expenses.submitReport(MEMBER.member, { id: draft.report.id, Status: 'Submitted', is_long_term_asset: true }, [
      receipt({ Amount: 310, DateOfExpense: '2026-09-15' }),
      receipt({ Amount: 89.99, DateOfExpense: '2026-09-11', VendorName: 'Target', ExpenseDescription: 'Table carts' }),
    ]);
    await db.expenses.financialSecretaryAuditOrder(MEMBER.admin, resubmitted.report.id);
    expect(d.count(db, 'CouncilAssetsInventory')).toBe(0); // the order alone does not approve
    await db.expenses.grandKnightAuthorizeOrder(MEMBER.superAdmin, resubmitted.report.id);

    const inventory = await db.expenses.listAssetsInventory(MEMBER.admin, OWN);
    expect(inventory).toHaveLength(1);
    expect(inventory[0]).toMatchObject({
      council_id: OWN,
      asset_name: 'Table carts; Folding banquet tables',
      purchase_date: '2026-09-11 00:00:00',
      cost_basis: 399.99,
      original_expense_id: resubmitted.report.id,
      current_status: 'ACTIVE',
    });

    // Paying the sheet does not convert it again.
    await db.expenses.recordDisbursement(MEMBER.admin, OWN, [resubmitted.report.id], { CheckNumber: '6001', PayoutDate: '2026-09-20' });
    expect(d.count(db, 'CouncilAssetsInventory')).toBe(1);
  });

  it('leaves a plain sheet out of the inventory and keeps the inventory to council leadership', async () => {
    const db = await d.make();
    await approvedSheet(db, false);
    expect(d.count(db, 'CouncilAssetsInventory')).toBe(0);
    expect(await db.expenses.listAssetsInventory(MEMBER.superAdmin, OWN)).toEqual([]);
    await expectRule(db.expenses.listAssetsInventory(MEMBER.member, OWN), 'ADMIN_REQUIRED');
    await expectRule(db.expenses.listAssetsInventory(MEMBER.admin, 2), 'COUNCIL_ACCESS_DENIED');
  });

  it('converts a sheet approved before schema 43 when it is reimbursed', async () => {
    const db = await d.make();
    const approved = await approvedSheet(db, false);
    rawSet(d, db, 'ExpenseReport', approved.report.id, 'is_long_term_asset', 1);
    expect(d.count(db, 'CouncilAssetsInventory')).toBe(0);
    await db.expenses.recordDisbursement(MEMBER.admin, OWN, [approved.report.id], { CheckNumber: '6002', PayoutDate: '2026-09-20' });
    const [asset] = await db.expenses.listAssetsInventory(MEMBER.admin, OWN);
    expect(asset).toMatchObject({ original_expense_id: approved.report.id, cost_basis: 42.5 });
    expect(asset.notes).toContain('became Reimbursed');
  });

  it('debits approved spend with no line of its own against Miscellaneous Others', async () => {
    const db = await d.make();
    await approvedSheet(db, false, [receipt({ Amount: 64.25 })]);
    const before = await db.budget.getBudgetProgress(MEMBER.admin, OWN, YEAR);
    expect(before).toMatchObject({ unbudgetedActual: 64.25, miscellaneousActual: 0 });

    const miscId = addMiscellaneousLine(d, db);
    const after = await db.budget.getBudgetProgress(MEMBER.admin, OWN, YEAR);
    expect(after).toMatchObject({ unbudgetedActual: 0, miscellaneousActual: 64.25, budgetedActual: 64.25, actualTotal: 64.25 });
    expect(after.lines.find((l) => l.line.id === miscId)).toMatchObject({ actual: 64.25, variance: 685.75 });
  });

  it('tags an approved charitable request with no budget line with Miscellaneous Others', async () => {
    const db = await d.make();
    const miscId = addMiscellaneousLine(d, db);
    await db.meetings.populateAnnualCadence(MEMBER.superAdmin, OWN, 1, YEAR);
    const motions: number[] = [];
    const requests: number[] = [];
    for (const name of ['Ministry A', 'Ministry B']) {
      const { request } = await db.charities.submitCharitableRequest(MEMBER.member, { OrganizationName: name, AmountRequested: 800, RelationshipTypeID: 1, Is501c3: true });
      await db.charities.triageRequestStatus(MEMBER.admin, request.id, { action: 'claim' });
      await db.charities.triageRequestStatus(MEMBER.admin, request.id, { action: 'advance' });
      const routed = await db.charities.routeRequestToNextEligibleAgenda(MEMBER.admin, request.id);
      motions.push(routed.motion.id);
      requests.push(request.id);
    }
    const passed = await db.meetings.finalizeProposedMotionVote(MEMBER.admin, motions[0], 'Passed');
    expect(passed.charitableRequest).toMatchObject({ id: requests[0], VoteStatus: 'Approved', TargetBudgetLineID: miscId });
    const failed = await db.meetings.finalizeProposedMotionVote(MEMBER.admin, motions[1], 'Failed');
    expect(failed.charitableRequest?.TargetBudgetLineID ?? null).toBeNull();
  });
});
