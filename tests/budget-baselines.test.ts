// Sprint 5Y-6.5 dual-baseline budgeting: custom Operational lines roll forward at last year's approved cap, and
// budget.getPriorYearBaselines puts last year's approved cap beside last year's actual spend for every line.
import { describe, expect, it } from 'vitest';
import { buildPriorYearBaselines, type CouncilBudgetForecast, type DataService } from '@kofc/shared';
import { MemoryDataService } from '../apps/web/services/drivers/memory';
import { SqliteDataService } from '../apps/mobile/services/drivers/sqlite';
import { drivers, expectRule, MEMBER, type DriverUnderTest } from './helpers';
import { openDatabases } from './shims/expo-sqlite';

const OWN = 1;
const OTHER = 2;
const TARGET = '2027-2028';
const SOURCE = '2026-2027';
// Inside the 2027-2028 drafting window (May 1 - June 30, 2027).
const DRAFTING = new Date(2027, 4, 15, 12, 0, 0);

async function make(d: DriverUnderTest): Promise<DataService> {
  const now = () => new Date(DRAFTING);
  if (d.name === 'sqlite') openDatabases.length = 0;
  const db = d.name === 'memory' ? new MemoryDataService({ now }) : new SqliteDataService({ now });
  await db.init();
  return db;
}

/** Inserts a row straight into the backing store (last year's budget is history no workflow can write today). */
function raw(d: DriverUnderTest, db: DataService, table: string, row: Record<string, string | number | null>): number {
  if (d.name === 'memory') return (db as MemoryDataService).debugStore.insert(table, row).id as number;
  const cols = Object.keys(row);
  const res = openDatabases
    .at(-1)!
    .prepare(`INSERT INTO [${table}] (${cols.map((c) => `[${c}]`).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`)
    .run(...Object.values(row));
  return Number(res.lastInsertRowid);
}

/** One of last year's lines, approved at `approved` unless `status` says otherwise. */
function priorLine(d: DriverUnderTest, db: DataService, over: Partial<CouncilBudgetForecast> & Pick<CouncilBudgetForecast, 'LineItemName'>): number {
  const status = over.BudgetStatus ?? 'Approved';
  return raw(d, db, 'CouncilBudgetForecast', {
    CouncilID: OWN,
    FraternalYear: SOURCE,
    CategoryType: over.CategoryType ?? 'Operational',
    ReferenceSourceID: over.ReferenceSourceID ?? null,
    LineItemName: over.LineItemName,
    PrePopulatedAmount: 0,
    ProposedBudgetAmount: over.ApprovedBudgetAmount ?? 0,
    ApprovedBudgetAmount: status === 'Approved' ? (over.ApprovedBudgetAmount ?? 0) : 0,
    BudgetStatus: status,
    BudgetCategoryID: null,
  });
}

/**
 * An annual event of last year with an Approved expense sheet of `spend`, so the rollup gives it an Event line (the
 * manual Event.Spend column is gone, schema 47). The sheet is charged to
 * `budgetLineId`, as its signers saved it (Sprint 6G Extension).
 */
async function annualEvent(d: DriverUnderTest, db: DataService, name: string, spend: number, budgetLineId: number | null = null) {
  const event = await db.events.create(
    { EventName: name, EventDescription: 'Yearly', OwnerID: MEMBER.admin, StartDate: '2026-10-10', EndDate: '2026-10-10', Location: 'Hall', CategoryID: 1, IsAnnual: 1 },
    [OWN],
  );
  const report = raw(d, db, 'ExpenseReport', { CouncilID: OWN, SubmitterMemberID: MEMBER.member, Status: 'Approved', LinkedEventID: event.id, LinkedMeetingID: null, budget_line_id: budgetLineId });
  raw(d, db, 'ExpenseLineItem', { ExpenseReportID: report, DateOfExpense: '2026-10-10', Amount: spend, VendorName: 'Costco', ExpenseDescription: 'Supplies' });
  return event;
}

describe('buildPriorYearBaselines (pure)', () => {
  const current = (id: number, over: Partial<CouncilBudgetForecast>): CouncilBudgetForecast => ({
    id,
    CouncilID: OWN,
    FraternalYear: TARGET,
    CategoryType: 'Operational',
    ReferenceSourceID: null,
    LineItemName: `Line ${id}`,
    PrePopulatedAmount: 0,
    ProposedBudgetAmount: 0,
    ApprovedBudgetAmount: 0,
    BudgetStatus: 'Draft',
    Notes: null,
    BudgetCategoryID: null,
    ...over,
  });
  const prior = (id: number, over: Partial<CouncilBudgetForecast>) => current(id, { FraternalYear: SOURCE, BudgetStatus: 'Approved', ...over });
  const noSpend = { expenses: [], charityChecks: [] };

  it('matches each line to the one it continues and reports caps only for an approved year', () => {
    const lines = [
      current(10, { CategoryType: 'Event', ReferenceSourceID: 40, LineItemName: 'Fish Fry' }),
      current(11, { CategoryType: 'Donation', ReferenceSourceID: 3, LineItemName: 'Pregnancy Center' }),
      current(12, { LineItemName: 'Bank Fees' }),
      current(13, { LineItemName: 'Brand new line' }),
    ];
    const priorLines = [
      prior(1, { CategoryType: 'Event', ReferenceSourceID: 12, LineItemName: 'fish  FRY', ApprovedBudgetAmount: 500 }),
      prior(2, { CategoryType: 'Donation', ReferenceSourceID: 3, LineItemName: 'Old name', ApprovedBudgetAmount: 250 }),
      prior(3, { LineItemName: 'bank fees', ApprovedBudgetAmount: 120 }),
    ];
    // Last year's sheet was charged to last year's Fish Fry line (Sprint 6G Extension: the saved budget_line_id).
    const spend = { expenses: [{ BudgetLineID: 1, Amount: 410.25 }], charityChecks: [{ CharityID: 3, Amount: 300 }] };
    const result = buildPriorYearBaselines({ councilId: OWN, fraternalYear: TARGET, lines, priorLines, priorSpend: spend });
    expect(result).toMatchObject({ priorFraternalYear: SOURCE, priorStatus: 'Approved' });
    const byId = new Map(result.lines.map((l) => [l.lineId, l]));
    expect(byId.get(10)).toEqual({ lineId: 10, priorLineId: 1, priorApproved: 500, priorActual: 410.25 });
    expect(byId.get(11)).toEqual({ lineId: 11, priorLineId: 2, priorApproved: 250, priorActual: 300 });
    expect(byId.get(12)).toEqual({ lineId: 12, priorLineId: 3, priorApproved: 120, priorActual: 0 });
    expect(byId.get(13)).toEqual({ lineId: 13, priorLineId: null, priorApproved: null, priorActual: 0 });

    const unapproved = priorLines.map((l) => ({ ...l, BudgetStatus: 'Proposed' as const, ApprovedBudgetAmount: 0 }));
    const draft = buildPriorYearBaselines({ councilId: OWN, fraternalYear: TARGET, lines, priorLines: unapproved, priorSpend: noSpend });
    expect(draft.priorStatus).toBe('Proposed');
    expect(draft.lines.every((l) => l.priorApproved === null)).toBe(true);
    expect(buildPriorYearBaselines({ councilId: OWN, fraternalYear: TARGET, lines, priorLines: [], priorSpend: noSpend }).priorStatus).toBeNull();
  });
});

describe.each(drivers)('$name driver: dual-baseline budgeting', (d) => {
  it('rolls custom lines forward at last year’s approved cap, and refreshes them on a re-run', async () => {
    const db = await make(d);
    priorLine(d, db, { LineItemName: 'Bank Fees', ApprovedBudgetAmount: 150.25 });
    priorLine(d, db, { LineItemName: 'Liability Insurance', ApprovedBudgetAmount: 1200 });
    await db.budget.prePopulateNextYear(MEMBER.admin, OWN, TARGET);
    const lines = (await db.budget.listAnnualForecast(MEMBER.member, OWN, TARGET)).lines;
    const custom = new Map(lines.filter((l) => l.CategoryType === 'Operational').map((l) => [l.LineItemName, l]));
    expect(custom.get('Bank Fees')).toMatchObject({ PrePopulatedAmount: 150.25, ProposedBudgetAmount: 0, ApprovedBudgetAmount: 0, BudgetStatus: 'Draft' });
    expect(custom.get('Liability Insurance')).toMatchObject({ PrePopulatedAmount: 1200 });

    // Re-running keeps the line and refreshes its baseline to the stored cap.
    const again = await db.budget.prePopulateNextYear(MEMBER.admin, OWN, TARGET);
    expect(again.created).toBe(0);
    expect((await db.budget.listAnnualForecast(MEMBER.member, OWN, TARGET)).lines.filter((l) => l.LineItemName === 'Bank Fees')).toHaveLength(1);
  });

  it('carries a custom line forward at 0 when last year was never approved', async () => {
    const db = await make(d);
    priorLine(d, db, { LineItemName: 'Bank Fees', ApprovedBudgetAmount: 150, BudgetStatus: 'Proposed' });
    await db.budget.prePopulateNextYear(MEMBER.admin, OWN, TARGET);
    const bankFees = (await db.budget.listAnnualForecast(MEMBER.member, OWN, TARGET)).lines.find((l) => l.LineItemName === 'Bank Fees');
    expect(bankFees?.PrePopulatedAmount).toBe(0);
    const baselines = await db.budget.getPriorYearBaselines(MEMBER.member, OWN, TARGET);
    expect(baselines.priorStatus).toBe('Proposed');
    expect(baselines.lines.find((l) => l.lineId === bankFees!.id)?.priorApproved).toBeNull();
  });

  it('puts last year’s approved cap beside last year’s actual spend for every line', async () => {
    const db = await make(d);
    const gala = priorLine(d, db, { CategoryType: 'Event', ReferenceSourceID: null, LineItemName: 'Baseline Gala', ApprovedBudgetAmount: 500 });
    await annualEvent(d, db, 'Baseline Gala', 400, gala);
    priorLine(d, db, { LineItemName: 'Bank Fees', ApprovedBudgetAmount: 150 });
    await db.budget.prePopulateNextYear(MEMBER.admin, OWN, TARGET);
    const fresh = await db.budget.addCustomBudgetLine(MEMBER.admin, OWN, { FraternalYear: TARGET, LineItemName: 'Website Hosting' });

    const forecast = await db.budget.listAnnualForecast(MEMBER.member, OWN, TARGET);
    const baselines = await db.budget.getPriorYearBaselines(MEMBER.member, OWN, TARGET);
    expect(baselines).toMatchObject({ councilId: OWN, fraternalYear: TARGET, priorFraternalYear: SOURCE, priorStatus: 'Approved' });
    expect(baselines.lines.map((l) => l.lineId)).toEqual(forecast.lines.map((l) => l.id));

    const of = (name: string) => baselines.lines.find((l) => l.lineId === forecast.lines.find((x) => x.LineItemName === name)!.id)!;
    expect(of('Baseline Gala')).toMatchObject({ priorApproved: 500, priorActual: 400 });
    expect(of('Bank Fees')).toMatchObject({ priorApproved: 150, priorActual: 0 });
    expect(baselines.lines.find((l) => l.lineId === fresh.id)).toMatchObject({ priorLineId: null, priorApproved: null, priorActual: 0 });
  });

  it('is read by every member of the council and nobody outside it', async () => {
    const db = await make(d);
    expect((await db.budget.getPriorYearBaselines(MEMBER.member, OWN, TARGET)).lines).toEqual([]);
    expect((await db.budget.getPriorYearBaselines(MEMBER.superAdmin, OTHER, TARGET)).councilId).toBe(OTHER);
    await expectRule(db.budget.getPriorYearBaselines(MEMBER.admin, OTHER, TARGET), 'COUNCIL_ACCESS_DENIED');
    await expectRule(db.budget.getPriorYearBaselines(9999, OWN, TARGET), 'MEMBER_NOT_FOUND');
    await expectRule(db.budget.getPriorYearBaselines(MEMBER.member, OWN, '2027'), 'INVALID_INPUT');
  });
});
