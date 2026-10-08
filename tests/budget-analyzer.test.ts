// Sprint 6G Extension 2 budget analyzer: budget.getBudgetAnalysis groups a year's approved lines by universal_category
// with allocation percentages, compares them with last year's approved lines, and tracks a target spending ceiling.
import { describe, expect, it } from 'vitest';
import { buildBudgetAnalysis, buildBudgetCeilingTrack, budgetYearOverYear, type CouncilBudgetForecast, type DataService } from '@kofc/shared';
import { MemoryDataService } from '../apps/web/services/drivers/memory';
import { SqliteDataService } from '../apps/mobile/services/drivers/sqlite';
import { drivers, expectRule, MEMBER, type DriverUnderTest } from './helpers';
import { openDatabases } from './shims/expo-sqlite';

const OWN = 1;
const OTHER = 2;
const YEAR = '2027-2028';
const PRIOR = '2026-2027';

const line = (id: number, over: Partial<CouncilBudgetForecast>): CouncilBudgetForecast => ({
  id,
  CouncilID: OWN,
  FraternalYear: YEAR,
  CategoryType: 'Operational',
  ReferenceSourceID: null,
  LineItemName: `Line ${id}`,
  PrePopulatedAmount: 0,
  ProposedBudgetAmount: over.ApprovedBudgetAmount ?? 0,
  ApprovedBudgetAmount: 0,
  BudgetStatus: 'Approved',
  Notes: null,
  BudgetCategoryID: null,
  ...over,
});
const prior = (id: number, over: Partial<CouncilBudgetForecast>) => line(id, { FraternalYear: PRIOR, ...over });

describe('budget analyzer (pure)', () => {
  const lines = [
    line(10, { LineItemName: 'Pastor Gift', universal_category: 'CHARITABLE_DONATIONS', ApprovedBudgetAmount: 1500 }),
    line(11, { LineItemName: 'Parking Lot', universal_category: 'CAPITAL_PROJECTS', ApprovedBudgetAmount: 6000 }),
    line(12, { LineItemName: 'Bank Fees', universal_category: 'ADMINISTRATIVE_OPERATIONS', ApprovedBudgetAmount: 100 }),
    line(13, { LineItemName: 'Website', ApprovedBudgetAmount: 2400 }),
  ];
  const priorLines = [
    prior(1, { LineItemName: 'pastor  GIFT', universal_category: 'CHARITABLE_DONATIONS', ApprovedBudgetAmount: 1400 }),
    prior(2, { LineItemName: 'Parking Lot', universal_category: 'CAPITAL_PROJECTS', ApprovedBudgetAmount: 6500 }),
    prior(3, { LineItemName: 'Bank Fees', universal_category: 'ADMINISTRATIVE_OPERATIONS', ApprovedBudgetAmount: 100 }),
    prior(4, { LineItemName: 'Roses', universal_category: 'COMMUNITY_EVENTS', ApprovedBudgetAmount: 300 }),
  ];

  it('groups approved lines by universal category with allocation percentages against the year total', () => {
    const a = buildBudgetAnalysis({ councilId: OWN, fraternalYear: YEAR, lines, priorLines });
    expect(a).toMatchObject({ priorFraternalYear: PRIOR, status: 'Approved', priorStatus: 'Approved', approvedTotal: 10000, priorApprovedTotal: 8300 });
    expect(a.totalDelta).toBe(1700);
    expect(a.totalVariancePercent).toBe(20.5);
    expect(a.categories.map((c) => [c.key, c.approved, c.allocationPercent])).toEqual([
      ['CHARITABLE_DONATIONS', 1500, 15],
      ['CAPITAL_PROJECTS', 6000, 60],
      ['COMMUNITY_EVENTS', 0, 0],
      ['ADMINISTRATIVE_OPERATIONS', 100, 1],
      ['UNASSIGNED', 2400, 24],
    ]);
    expect(a.categories.find((c) => c.key === 'UNASSIGNED')?.label).toBe('Unassigned');
    expect(a.ceiling).toBeNull();
  });

  it('computes year-over-year dollar and percentage variances by category and by line', () => {
    const a = buildBudgetAnalysis({ councilId: OWN, fraternalYear: YEAR, lines, priorLines });
    const cat = new Map(a.categories.map((c) => [c.key, c]));
    expect(cat.get('CHARITABLE_DONATIONS')).toMatchObject({ priorApproved: 1400, delta: 100, variancePercent: 7.1, change: 'Increased' });
    expect(cat.get('CAPITAL_PROJECTS')).toMatchObject({ priorApproved: 6500, delta: -500, variancePercent: -7.7, change: 'Decreased' });
    expect(cat.get('ADMINISTRATIVE_OPERATIONS')).toMatchObject({ delta: 0, variancePercent: 0, change: 'Unchanged' });
    expect(cat.get('COMMUNITY_EVENTS')).toMatchObject({ lineCount: 0, priorApproved: 300, delta: -300, change: 'Discontinued' });
    expect(cat.get('UNASSIGNED')).toMatchObject({ priorApproved: 0, variancePercent: null, change: 'New' });

    const byName = new Map(a.lines.map((l) => [l.LineItemName, l]));
    expect(byName.get('Pastor Gift')).toMatchObject({ lineId: 10, priorLineId: 1, priorApproved: 1400, delta: 100, change: 'Increased' });
    expect(byName.get('Website')).toMatchObject({ priorLineId: null, change: 'New' });
    expect(byName.get('Roses')).toMatchObject({ lineId: null, priorLineId: 4, approved: 0, priorApproved: 300, delta: -300, variancePercent: -100, change: 'Discontinued' });
    expect(a.lines.at(-1)?.LineItemName).toBe('Roses');
  });

  it('counts last year’s caps only when last year was approved, and this year’s only once approved', () => {
    const unapprovedPrior = priorLines.map((l) => ({ ...l, BudgetStatus: 'Proposed' as const }));
    const a = buildBudgetAnalysis({ councilId: OWN, fraternalYear: YEAR, lines, priorLines: unapprovedPrior });
    expect(a).toMatchObject({ priorStatus: 'Proposed', priorApprovedTotal: 0, totalVariancePercent: null });
    expect(a.lines.find((l) => l.LineItemName === 'Bank Fees')).toMatchObject({ priorApproved: 0, change: 'New' });

    const draft = buildBudgetAnalysis({ councilId: OWN, fraternalYear: YEAR, lines: [line(20, { BudgetStatus: 'Draft', ProposedBudgetAmount: 50 })], priorLines: [] });
    expect(draft).toMatchObject({ status: 'Draft', priorStatus: null, approvedTotal: 0 });
    expect(draft.categories[0]).toMatchObject({ allocationPercent: null, change: 'Unchanged' });
  });

  it('tracks the approved total against a target spending ceiling', () => {
    expect(buildBudgetCeilingTrack(10000, 12500)).toEqual({ ceiling: 12500, allocated: 10000, buffer: 2500, percentOfCeiling: 80, status: 'Within Ceiling' });
    expect(buildBudgetCeilingTrack(10000, 10000)).toMatchObject({ buffer: 0, percentOfCeiling: 100, status: 'At Ceiling' });
    expect(buildBudgetCeilingTrack(10000.5, 9000)).toMatchObject({ buffer: -1000.5, percentOfCeiling: 111.1, status: 'Over Ceiling' });
    expect(buildBudgetCeilingTrack(0, 0)).toMatchObject({ percentOfCeiling: null, status: 'At Ceiling' });
    expect(() => buildBudgetCeilingTrack(100, -1)).toThrow();
    expect(() => buildBudgetCeilingTrack(100, 10.001)).toThrow();
    expect(() => buildBudgetCeilingTrack(100, Number.NaN)).toThrow();

    const a = buildBudgetAnalysis({ councilId: OWN, fraternalYear: YEAR, lines, priorLines, targetSpendingCeiling: 11000 });
    expect(a.ceiling).toMatchObject({ allocated: 10000, buffer: 1000, status: 'Within Ceiling' });
  });

  it('labels each year-over-year move', () => {
    expect(budgetYearOverYear(120, 100)).toEqual({ delta: 20, variancePercent: 20, change: 'Increased' });
    expect(budgetYearOverYear(0, 0, { current: true, prior: false })).toMatchObject({ change: 'Unchanged', variancePercent: null });
    expect(budgetYearOverYear(0, 50, { current: false, prior: true })).toMatchObject({ delta: -50, variancePercent: -100, change: 'Discontinued' });
  });
});

async function make(d: DriverUnderTest): Promise<DataService> {
  const now = () => new Date(2027, 8, 1, 12, 0, 0);
  if (d.name === 'sqlite') openDatabases.length = 0;
  const db = d.name === 'memory' ? new MemoryDataService({ now }) : new SqliteDataService({ now });
  await db.init();
  return db;
}

/** Inserts an approved budget line straight into the backing store (approval history no workflow writes in one step). */
function raw(d: DriverUnderTest, db: DataService, row: Record<string, string | number | null>): number {
  const full = { CouncilID: OWN, CategoryType: 'Operational', ReferenceSourceID: null, PrePopulatedAmount: 0, BudgetStatus: 'Approved', BudgetCategoryID: null, ...row };
  full.ProposedBudgetAmount = full.ApprovedBudgetAmount as number;
  if (d.name === 'memory') return (db as MemoryDataService).debugStore.insert('CouncilBudgetForecast', full).id as number;
  const cols = Object.keys(full);
  const res = openDatabases
    .at(-1)!
    .prepare(`INSERT INTO [CouncilBudgetForecast] (${cols.map((c) => `[${c}]`).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`)
    .run(...Object.values(full));
  return Number(res.lastInsertRowid);
}

describe.each(drivers)('$name driver: budget.getBudgetAnalysis', (d) => {
  it('analyzes the council year against last year with an optional ceiling', async () => {
    const db = await make(d);
    raw(d, db, { FraternalYear: PRIOR, LineItemName: 'Pastor Gift', ApprovedBudgetAmount: 1400, universal_category: 'CHARITABLE_DONATIONS' });
    raw(d, db, { FraternalYear: PRIOR, LineItemName: 'Roses', ApprovedBudgetAmount: 300, universal_category: 'COMMUNITY_EVENTS' });
    raw(d, db, { FraternalYear: YEAR, LineItemName: 'Pastor Gift', ApprovedBudgetAmount: 1500, universal_category: 'CHARITABLE_DONATIONS' });
    raw(d, db, { FraternalYear: YEAR, LineItemName: 'Parking Lot', ApprovedBudgetAmount: 500, universal_category: 'CAPITAL_PROJECTS' });
    raw(d, db, { CouncilID: OTHER, FraternalYear: YEAR, LineItemName: 'Not ours', ApprovedBudgetAmount: 9999, universal_category: 'MISCELLANEOUS' });

    const a = await db.budget.getBudgetAnalysis(MEMBER.member, OWN, YEAR, { targetSpendingCeiling: 2500 });
    expect(a).toMatchObject({ councilId: OWN, fraternalYear: YEAR, approvedTotal: 2000, priorApprovedTotal: 1700, totalDelta: 300, totalVariancePercent: 17.6 });
    expect(a.categories.map((c) => [c.key, c.allocationPercent, c.change])).toEqual([
      ['CHARITABLE_DONATIONS', 75, 'Increased'],
      ['CAPITAL_PROJECTS', 25, 'New'],
      ['COMMUNITY_EVENTS', 0, 'Discontinued'],
    ]);
    expect(a.lines.map((l) => [l.LineItemName, l.change])).toEqual([
      ['Parking Lot', 'New'],
      ['Pastor Gift', 'Increased'],
      ['Roses', 'Discontinued'],
    ]);
    expect(a.ceiling).toEqual({ ceiling: 2500, allocated: 2000, buffer: 500, percentOfCeiling: 80, status: 'Within Ceiling' });
    expect((await db.budget.getBudgetAnalysis(MEMBER.member, OWN, YEAR)).ceiling).toBeNull();
  });

  it('is read by every member of the council and nobody outside it', async () => {
    const db = await make(d);
    expect((await db.budget.getBudgetAnalysis(MEMBER.member, OWN, YEAR)).categories).toEqual([]);
    expect((await db.budget.getBudgetAnalysis(MEMBER.superAdmin, OTHER, YEAR)).councilId).toBe(OTHER);
    await expectRule(db.budget.getBudgetAnalysis(MEMBER.admin, OTHER, YEAR), 'COUNCIL_ACCESS_DENIED');
    await expectRule(db.budget.getBudgetAnalysis(9999, OWN, YEAR), 'MEMBER_NOT_FOUND');
    await expectRule(db.budget.getBudgetAnalysis(MEMBER.member, OWN, '2027'), 'INVALID_INPUT');
    await expectRule(db.budget.getBudgetAnalysis(MEMBER.member, OWN, YEAR, { targetSpendingCeiling: -5 }), 'INVALID_INPUT');
  });
});
