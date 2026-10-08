// Sprint 6D (Phase 5): Mid-Year Budget Version-Tracking and Quantity / Unit Cost Estimations - CouncilBudgetForecast
// .quantity, .unit_cost and .budget_version (schema 42), the sequential allocation of a line over its occurrences
// (allocateBudgetLineOccurrences), the BUDGET_LINE_WORKFLOW that keeps approved versions immutable, and the
// budget.setLineQuantityAndUnitCost / amendApprovedLine / listLineVersions driver methods.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  allocateBudgetLineOccurrences,
  assertBudgetLineAmendable,
  BUDGET_LINE_WORKFLOW,
  BUDGET_QUANTITY_MAX,
  BusinessRuleError,
  buildConcludedBudgetPerformance,
  cleanLineQuantityAndUnitCost,
  currentBudgetLines,
  isBudgetVersionWritable,
  nextBudgetLineStatus,
  nextBudgetVersionStatus,
  planBudgetAmendment,
  planBudgetApproval,
  unitCostAfterLumpSum,
  type CouncilBudgetForecast,
  type DataService,
  type MemberWriteActor,
} from '@kofc/shared';
import { MemoryDataService } from '../apps/web/services/drivers/memory';
import { TABLES } from '../apps/web/services/generated/schema.generated';
import { drivers, expectRule, MEMBER, type DriverUnderTest } from './helpers';
import { openDatabases } from './shims/expo-sqlite';

const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');
const OWN = 1;
const YEAR = '2026-2027'; // the tests' today, 2026-09-20, falls in it

const line = (over: Partial<CouncilBudgetForecast>): CouncilBudgetForecast => ({
  id: 1,
  CouncilID: OWN,
  FraternalYear: YEAR,
  CategoryType: 'Event',
  ReferenceSourceID: null,
  LineItemName: 'Pancake Breakfast',
  PrePopulatedAmount: 0,
  ApprovedBudgetAmount: 1500,
  ProposedBudgetAmount: 1500,
  BudgetStatus: 'Approved',
  BudgetCategoryID: null,
  Notes: null,
  quantity: 3,
  unit_cost: 500,
  budget_version: 1,
  ...over,
});

const ruleCode = (fn: () => unknown): string => {
  try {
    fn();
    return 'ok';
  } catch (e) {
    return e instanceof BusinessRuleError ? e.code : String(e);
  }
};

describe('schema 42: CouncilBudgetForecast.quantity, unit_cost and budget_version', () => {
  it('appends the three columns, versions the line index and bumps the phone database version', () => {
    const schema = read('Schema.sql');
    expect(schema).toContain('ALTER TABLE [CouncilBudgetForecast] ADD [quantity] INT NOT NULL DEFAULT 1;');
    expect(schema).toContain('ALTER TABLE [CouncilBudgetForecast] ADD [unit_cost] DECIMAL(18,2) NOT NULL DEFAULT 0.00;');
    expect(schema).toContain('ALTER TABLE [CouncilBudgetForecast] ADD [budget_version] INT NOT NULL DEFAULT 1;');
    expect(schema).toContain('DROP INDEX [CouncilBudgetForecast_Line_Idx] ON [CouncilBudgetForecast];');
    const columns = TABLES.CouncilBudgetForecast.columns;
    expect(columns.find((c) => c.name === 'quantity')).toMatchObject({ kind: 'int', notNull: true, default: { kind: 'literal', value: 1 } });
    expect(columns.find((c) => c.name === 'unit_cost')).toMatchObject({ kind: 'real', notNull: true, default: { kind: 'literal', value: 0 } });
    expect(columns.find((c) => c.name === 'budget_version')).toMatchObject({ kind: 'int', notNull: true, default: { kind: 'literal', value: 1 } });
    expect(TABLES.CouncilBudgetForecast.uniqueKeys).toEqual([['CouncilID', 'FraternalYear', 'CategoryType', 'ReferenceSourceID', 'LineItemName', 'budget_version']]);
    const sqlite = read('apps/mobile/services/generated/schema.sqlite.ts');
    expect(sqlite).toContain('[quantity] INTEGER NOT NULL DEFAULT 1');
    expect(sqlite).toContain('([CouncilID], [FraternalYear], [CategoryType], [ReferenceSourceID], [LineItemName], [budget_version])');
    expect(read('apps/mobile/services/drivers/sqlite.ts')).toMatch(/const SCHEMA_VERSION = (4[2-9]|[5-9]\d);/);
    const dictionary = read('data_dictionary.md');
    for (const col of ['quantity (INT', 'unit_cost (DECIMAL(18,2)', 'budget_version (INT']) expect(dictionary).toContain(col);
  });
});

describe('allocateBudgetLineOccurrences', () => {
  const occurrences = [
    { id: 30, StartDate: '2026-11-08' },
    { id: 10, StartDate: '2026-09-13' },
    { id: 20, StartDate: '2026-10-11' },
    { id: 40, StartDate: '2026-12-13' },
  ];

  it('gives each occurrence one unit_cost block in date order, and nothing past the quantity', () => {
    const blocks = allocateBudgetLineOccurrences(line({}), occurrences);
    expect([...blocks.entries()]).toEqual([
      [10, { sequence: 1, quantity: 3, budget: 500 }],
      [20, { sequence: 2, quantity: 3, budget: 500 }],
      [30, { sequence: 3, quantity: 3, budget: 500 }],
      [40, { sequence: 4, quantity: 3, budget: null }],
    ]);
  });

  it('splits a lump sum evenly in whole cents, the earliest blocks taking the odd cents', () => {
    const blocks = allocateBudgetLineOccurrences(line({ unit_cost: 0, ApprovedBudgetAmount: 1000 }), occurrences);
    expect([10, 20, 30].map((id) => blocks.get(id)!.budget)).toEqual([333.34, 333.33, 333.33]);
    // The pre-6D default (quantity 1, no unit cost) budgets the whole line to the first occurrence only.
    const single = allocateBudgetLineOccurrences(line({ quantity: undefined, unit_cost: undefined, ApprovedBudgetAmount: 800 }), occurrences);
    expect([10, 20].map((id) => single.get(id)!.budget)).toEqual([800, null]);
  });

  it('never hands out more than the approved figure', () => {
    const blocks = allocateBudgetLineOccurrences(line({ ApprovedBudgetAmount: 1200 }), occurrences);
    expect([10, 20, 30].map((id) => blocks.get(id)!.budget)).toEqual([500, 500, 200]);
  });

  it('breaks a same-day tie by event id', () => {
    const blocks = allocateBudgetLineOccurrences(line({ quantity: 1 }), [
      { id: 9, StartDate: '2026-09-13' },
      { id: 4, StartDate: '2026-09-13' },
    ]);
    expect(blocks.get(4)).toEqual({ sequence: 1, quantity: 1, budget: 500 });
    expect(blocks.get(9)!.budget).toBeNull();
  });
});

describe('buildConcludedBudgetPerformance with quantity lines (Sprint 6D)', () => {
  const events = [
    { id: 1, EventName: 'Pancake Breakfast', StartDate: '2026-07-12', EndDate: '2026-07-12', IsAnnual: 1 },
    { id: 2, EventName: 'pancake  breakfast', StartDate: '2026-08-09', EndDate: '2026-08-09', IsAnnual: 1 },
    { id: 3, EventName: 'Pancake Breakfast', StartDate: '2026-09-13', EndDate: '2026-09-13', IsAnnual: 1 },
    { id: 4, EventName: 'Pancake Breakfast', StartDate: '2026-10-11', EndDate: '2026-10-11', IsAnnual: 1 }, // scheduled, not concluded
  ];
  const expenses = [
    { EventID: 1, MeetingID: null, Amount: 450 },
    { EventID: 2, MeetingID: null, Amount: 520 },
    { EventID: 3, MeetingID: null, Amount: 300 },
  ];
  const run = (lines: CouncilBudgetForecast[]) =>
    buildConcludedBudgetPerformance({ councilId: OWN, fraternalYear: YEAR, today: '2026-09-20', rows: { events, expenses, meetings: [], lines } });

  it('budgets each concluded occurrence one unit_cost block, in sequence', () => {
    const result = run([line({ id: 7 })]);
    expect(result.events.map((e) => [e.eventId, e.budget, e.allocation, e.alert])).toEqual([
      [3, 500, { sequence: 3, quantity: 3 }, 'On Track'],
      [2, 500, { sequence: 2, quantity: 3 }, 'Over Budget'],
      [1, 500, { sequence: 1, quantity: 3 }, 'Warning'],
    ]);
    expect(result.totals).toMatchObject({ budget: 1500, actual: 1270 });
  });

  it('counts the scheduled occurrence still to come when sequencing, so a fourth event past the quantity is unbudgeted', () => {
    const twoPaid = run([line({ id: 7, quantity: 2, ApprovedBudgetAmount: 1000, ProposedBudgetAmount: 1000 })]);
    expect(twoPaid.events.map((e) => [e.eventId, e.budget])).toEqual([
      [3, null],
      [2, 500],
      [1, 500],
    ]);
    expect(twoPaid.events[0]).toMatchObject({ budgetLineId: 7, allocation: { sequence: 3, quantity: 2 }, alert: 'Unbudgeted' });
    expect(twoPaid.totals.budget).toBe(1000);
  });

  it('reads only the latest budget_version of an amended line', () => {
    const v1 = line({ id: 7 });
    const v2 = line({ id: 8, unit_cost: 600, ApprovedBudgetAmount: 1800, ProposedBudgetAmount: 1800, budget_version: 2 });
    const result = run([v2, v1]);
    expect(result.events.map((e) => [e.budget, e.budgetLineId])).toEqual([
      [600, 8],
      [600, 8],
      [600, 8],
    ]);
    expect(result.totals.budget).toBe(1800);
  });
});

describe('BUDGET_LINE_WORKFLOW (Sprint 6D)', () => {
  it('drafts and approves in place, but treats an approved version as an immutable snapshot', () => {
    expect(BUDGET_LINE_WORKFLOW.states).toEqual(['Draft', 'Proposed', 'Approved']);
    expect(nextBudgetLineStatus(line({ BudgetStatus: 'Draft' }), 'propose')).toBe('Proposed');
    expect(nextBudgetLineStatus(line({ BudgetStatus: 'Proposed' }), 'approve')).toBe('Approved');
    expect(ruleCode(() => nextBudgetLineStatus(line({}), 'propose'))).toBe('ILLEGAL_STATE_TRANSITION');
    expect(ruleCode(() => nextBudgetLineStatus(line({}), 'approve'))).toBe('ILLEGAL_STATE_TRANSITION');
    expect(() => nextBudgetLineStatus(line({}), 'amend')).toThrow(/never rewrites a row/);
    expect(isBudgetVersionWritable(line({}))).toBe(false);
    expect(isBudgetVersionWritable(line({ BudgetStatus: 'Proposed' }))).toBe(true);
    expect(ruleCode(() => planBudgetApproval([line({})]))).toBe('ILLEGAL_STATE_TRANSITION');
  });

  it('amends only an approved version, into another approved version', () => {
    expect(nextBudgetVersionStatus(line({}))).toBe('Approved');
    expect(ruleCode(() => nextBudgetVersionStatus(line({ BudgetStatus: 'Proposed' })))).toBe('ILLEGAL_STATE_TRANSITION');
  });
});

describe('quantity, unit cost and amendment helpers (Sprint 6D)', () => {
  const actor = (over: Partial<MemberWriteActor> = {}): MemberWriteActor => ({
    memberId: 2,
    councilId: OWN,
    memberType: 'Admin',
    active: true,
    roles: [],
    ...over,
  });

  it('proposes quantity x unit cost in whole cents', () => {
    expect(cleanLineQuantityAndUnitCost(3, 500)).toEqual({ quantity: 3, unit_cost: 500, ProposedBudgetAmount: 1500 });
    expect(cleanLineQuantityAndUnitCost(3, 0.1)).toEqual({ quantity: 3, unit_cost: 0.1, ProposedBudgetAmount: 0.3 });
    for (const bad of [0, 1.5, -1, BUDGET_QUANTITY_MAX + 1, '3']) expect(ruleCode(() => cleanLineQuantityAndUnitCost(bad, 500))).toBe('INVALID_INPUT');
    expect(ruleCode(() => cleanLineQuantityAndUnitCost(3, 1.234))).toBe('INVALID_INPUT');
  });

  it('keeps the unit cost after a lump-sum update only while the figures still agree', () => {
    expect(unitCostAfterLumpSum(line({}), 1500)).toBe(500);
    expect(unitCostAfterLumpSum(line({}), 1600)).toBe(0);
  });

  it('keeps each line’s highest version and preserves the given order', () => {
    const a1 = line({ id: 1 });
    const a2 = line({ id: 5, budget_version: 2 });
    const a3 = line({ id: 9, budget_version: 3 });
    const other = line({ id: 2, LineItemName: 'Fish Fry' });
    expect(currentBudgetLines([a1, other, a3, a2]).map((l) => l.id)).toEqual([2, 9]);
    expect(currentBudgetLines([line({ id: 3, budget_version: undefined })]).map((l) => l.id)).toEqual([3]);
  });

  it('plans the next version without touching the approved row', () => {
    const v1 = line({ Notes: 'Adopted July 2026' });
    const frozen = JSON.stringify(v1);
    const v2 = planBudgetAmendment(v1, { unitCost: 600 });
    expect(v2).toMatchObject({ quantity: 3, unit_cost: 600, ApprovedBudgetAmount: 1800, ProposedBudgetAmount: 1800, BudgetStatus: 'Approved', budget_version: 2, Notes: 'Adopted July 2026' });
    expect(v2).not.toHaveProperty('id');
    expect(JSON.stringify(v1)).toBe(frozen);
    expect(planBudgetAmendment(v1, { quantity: 4, notes: 'Resolution 2026-11' })).toMatchObject({ ApprovedBudgetAmount: 2000, Notes: 'Resolution 2026-11' });
    expect(planBudgetAmendment(line({ unit_cost: 0, ApprovedBudgetAmount: 900 }), { approvedAmount: 1200 })).toMatchObject({ unit_cost: 0, ApprovedBudgetAmount: 1200 });
    expect(ruleCode(() => planBudgetAmendment(v1, { approvedAmount: 1700 }))).toBe('INVALID_INPUT');
    expect(ruleCode(() => planBudgetAmendment(v1, { unitCost: 500 }))).toBe('INVALID_INPUT'); // changes nothing
    expect(ruleCode(() => planBudgetAmendment(v1, { BudgetStatus: 'Draft' } as never))).toBe('INVALID_INPUT');
  });

  it('amends only the latest version, and only until the fraternal year ends', () => {
    const v1 = line({ id: 1 });
    const v2 = line({ id: 5, budget_version: 2 });
    const today = new Date(2026, 8, 20);
    expect(ruleCode(() => assertBudgetLineAmendable(v2, [v1, v2], today, actor()))).toBe('ok');
    expect(ruleCode(() => assertBudgetLineAmendable(v1, [v1, v2], today, actor()))).toBe('BUDGET_VERSION_SUPERSEDED');
    expect(ruleCode(() => assertBudgetLineAmendable(line({ BudgetStatus: 'Proposed' }), [], today, actor()))).toBe('ILLEGAL_STATE_TRANSITION');
    const july = new Date(2027, 6, 1);
    expect(ruleCode(() => assertBudgetLineAmendable(v2, [v2], new Date(2027, 5, 30), actor()))).toBe('ok');
    expect(ruleCode(() => assertBudgetLineAmendable(v2, [v2], july, actor(), { superAdminOverride: true }))).toBe('BUDGET_YEAR_CLOSED');
    expect(ruleCode(() => assertBudgetLineAmendable(v2, [v2], july, actor({ memberType: 'Super Admin' }), { superAdminOverride: true }))).toBe('ok');
  });
});

function raw(d: DriverUnderTest, db: DataService, table: string, row: Record<string, string | number | null>): number {
  if (d.name === 'memory') return (db as MemoryDataService).debugStore.insert(table, row).id as number;
  const cols = Object.keys(row);
  const res = openDatabases
    .at(-1)!
    .prepare(`INSERT INTO [${table}] (${cols.map((c) => `[${c}]`).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`)
    .run(...Object.values(row));
  return Number(res.lastInsertRowid);
}

describe.each(drivers)('budget versions and unit costs ($name)', (d) => {
  it('drafts quantity x unit cost, approves, then amends mid-year as a new immutable version', async () => {
    const db = await d.make(); // today is 2026-09-20: the 2026-2027 drafting window has closed
    const override = { superAdminOverride: true };
    const draft = await db.budget.addCustomBudgetLine(MEMBER.superAdmin, OWN, { FraternalYear: YEAR, LineItemName: 'Sprint 6D Hall Rental' }, override);
    expect(draft).toMatchObject({ quantity: 1, unit_cost: 0, budget_version: 1 });
    await expectRule(db.budget.setLineQuantityAndUnitCost(MEMBER.admin, draft.id, 4, 250), 'BUDGET_YEAR_FINALIZED');
    await expectRule(db.budget.setLineQuantityAndUnitCost(MEMBER.superAdmin, draft.id, 0, 250, override), 'INVALID_INPUT');
    expect(await db.budget.setLineQuantityAndUnitCost(MEMBER.superAdmin, draft.id, 4, 250, override)).toMatchObject({
      quantity: 4,
      unit_cost: 250,
      ProposedBudgetAmount: 1000,
      BudgetStatus: 'Proposed',
    });
    // A lump sum that no longer equals quantity x unit cost clears the unit cost.
    expect(await db.budget.updateLineItemBudget(MEMBER.superAdmin, draft.id, 1100, undefined, override)).toMatchObject({ quantity: 4, unit_cost: 0, ProposedBudgetAmount: 1100 });
    await db.budget.setLineQuantityAndUnitCost(MEMBER.superAdmin, draft.id, 4, 250, override);
    await expectRule(db.budget.amendApprovedLine(MEMBER.admin, draft.id, { unitCost: 300 }), 'ILLEGAL_STATE_TRANSITION');

    await db.budget.approveAndFinalizeEntireBudget(MEMBER.admin, OWN, YEAR);
    await expectRule(db.budget.setLineQuantityAndUnitCost(MEMBER.superAdmin, draft.id, 5, 250, override), 'BUDGET_YEAR_APPROVED');
    await expectRule(db.budget.amendApprovedLine(MEMBER.member, draft.id, { unitCost: 300 }), 'ADMIN_REQUIRED');

    const rowsBefore = d.count(db, 'CouncilBudgetForecast');
    const v2 = await db.budget.amendApprovedLine(MEMBER.admin, draft.id, { unitCost: 300, notes: 'Amendment resolution, October meeting' });
    expect(v2.id).not.toBe(draft.id);
    expect(v2).toMatchObject({
      LineItemName: 'Sprint 6D Hall Rental',
      quantity: 4,
      unit_cost: 300,
      ApprovedBudgetAmount: 1200,
      BudgetStatus: 'Approved',
      budget_version: 2,
      Notes: 'Amendment resolution, October meeting',
    });
    expect(d.count(db, 'CouncilBudgetForecast')).toBe(rowsBefore + 1);

    // The forecast and every figure read the latest version; version 1 is kept, unchanged, as the audit trail.
    const forecast = await db.budget.listAnnualForecast(MEMBER.member, OWN, YEAR);
    expect(forecast.lines.filter((l) => l.LineItemName === 'Sprint 6D Hall Rental').map((l) => l.id)).toEqual([v2.id]);
    const history = await db.budget.listLineVersions(MEMBER.member, draft.id);
    expect(history.current.id).toBe(v2.id);
    expect(history.versions.map((v) => [v.budget_version, v.ApprovedBudgetAmount, v.unit_cost])).toEqual([
      [1, 1000, 250],
      [2, 1200, 300],
    ]);
    const progress = await db.budget.getBudgetProgress(MEMBER.admin, OWN, YEAR);
    expect(progress.lines.filter((l) => l.line.LineItemName === 'Sprint 6D Hall Rental').map((l) => l.line.ApprovedBudgetAmount)).toEqual([1200]);

    await expectRule(db.budget.amendApprovedLine(MEMBER.admin, draft.id, { unitCost: 350 }), 'BUDGET_VERSION_SUPERSEDED');
    const v3 = await db.budget.amendApprovedLine(MEMBER.admin, v2.id, { quantity: 3 });
    expect(v3).toMatchObject({ budget_version: 3, ApprovedBudgetAmount: 900 });
    await expectRule(db.budget.updateLineItemBudget(MEMBER.superAdmin, v3.id, 5, undefined, override), 'BUDGET_YEAR_APPROVED');
    await expectRule(db.budget.listLineVersions(MEMBER.member, 999_999), 'RECORD_NOT_FOUND');
  });

  it('refuses to amend a year that has ended, short of a Super Admin override', async () => {
    const db = await d.make();
    const lastYear = '2025-2026';
    const id = raw(d, db, 'CouncilBudgetForecast', {
      CouncilID: OWN,
      FraternalYear: lastYear,
      CategoryType: 'Operational',
      ReferenceSourceID: null,
      LineItemName: 'Sprint 6D Closed Line',
      PrePopulatedAmount: 0,
      ProposedBudgetAmount: 100,
      ApprovedBudgetAmount: 100,
      BudgetStatus: 'Approved',
    });
    await expectRule(db.budget.amendApprovedLine(MEMBER.admin, id, { approvedAmount: 150 }), 'BUDGET_YEAR_CLOSED');
    expect(await db.budget.amendApprovedLine(MEMBER.superAdmin, id, { approvedAmount: 150 }, { superAdminOverride: true })).toMatchObject({ budget_version: 2, ApprovedBudgetAmount: 150 });
  });

  it('segments a Pancake Breakfast x3 line over its occurrences in the concluded performance grid', async () => {
    const db = await d.make();
    const category = (await db.lookups.list('Category'))[0].id;
    const event = (date: string) =>
      db.events.create(
        { EventName: 'Sprint 6D Pancake Breakfast', EventDescription: 'Fixture', OwnerID: MEMBER.superAdmin, StartDate: date, EndDate: date, Location: 'Hall', CategoryID: category, IsAnnual: 1 },
        [OWN],
      );
    const first = await event('2026-07-12');
    const second = await event('2026-08-09');
    const third = await event('2026-09-13');
    const fourth = await event('2026-10-11'); // scheduled: takes no block of the concluded grid
    const v1 = raw(d, db, 'CouncilBudgetForecast', {
      CouncilID: OWN,
      FraternalYear: YEAR,
      CategoryType: 'Event',
      ReferenceSourceID: null,
      LineItemName: 'Sprint 6D Pancake Breakfast',
      PrePopulatedAmount: 0,
      ProposedBudgetAmount: 1500,
      ApprovedBudgetAmount: 1500,
      BudgetStatus: 'Approved',
      quantity: 3,
      unit_cost: 500,
    });
    const blocks = async () => {
      const grid = await db.budget.getConcludedPerformance(MEMBER.admin, OWN);
      return [first.id, second.id, third.id, fourth.id].map((id) => {
        const row = grid.events.find((e) => e.eventId === id);
        return row ? [row.budget, row.allocation?.sequence, row.budgetLineId] : null;
      });
    };
    expect(await blocks()).toEqual([[500, 1, v1], [500, 2, v1], [500, 3, v1], null]);
    const v2 = await db.budget.amendApprovedLine(MEMBER.admin, v1, { unitCost: 550 });
    expect(await blocks()).toEqual([[550, 1, v2.id], [550, 2, v2.id], [550, 3, v2.id], null]);
  });
});
