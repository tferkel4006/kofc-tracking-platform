// Sprint 6F (Phase 5): St. Mary's real 2026-2027 budget seeded for Council 15295 (Seed.sql below @presentation-data)
// and the universal category keys of CouncilBudgetForecast.universal_category (schema 44, UNIVERSAL_BUDGET_CATEGORIES).
import { describe, expect, it } from 'vitest';
import {
  isUniversalBudgetCategory,
  planBudgetPrePopulation,
  UNIVERSAL_BUDGET_CATEGORIES,
  type DataService,
} from '@kofc/shared';
import { MemoryDataService } from '../apps/web/services/drivers/memory';
import { SqliteDataService } from '../apps/mobile/services/drivers/sqlite';
import { MEMBER, NOW } from './helpers';
import { openDatabases } from './shims/expo-sqlite';

const OWN = 1;
const YEAR = '2026-2027';
const cents = (n: number) => Math.round(n * 100);

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

describe("St. Mary's heritage budget seed (presentation data)", () => {
  it.each(make)('balances its 40 approved lines to 41,700.00 under the six heritage funds (%s)', async (_name, create) => {
    const db = await create();
    const forecast = await db.budget.listAnnualForecast(MEMBER.admin, OWN, YEAR);
    expect(forecast.status).toBe('Approved');
    expect(forecast.lines).toHaveLength(40);
    expect(forecast.lines.reduce((t, l) => t + cents(l.ApprovedBudgetAmount), 0)).toBe(4170000);
    expect(forecast.lines.every((l) => cents(l.ProposedBudgetAmount) === cents(l.ApprovedBudgetAmount) && l.BudgetStatus === 'Approved')).toBe(true);

    const byFund = new Map<string, number>();
    for (const l of forecast.lines) {
      const fund = forecast.categories.find((c) => c.id === l.BudgetCategoryID)!.CategoryName;
      byFund.set(fund, (byFund.get(fund) ?? 0) + cents(l.ApprovedBudgetAmount));
    }
    expect(Object.fromEntries(byFund)).toEqual({
      'Father George Wolf Memorial Fund': 460000,
      'Sister Rita Rose Vistica Parish Community Fund': 340000,
      'Cathedral School & Student Support': 420000,
      'Other Donations & Projects': 1430000,
      'Council Maintenance & State/Supreme Programs': 890000,
      'Blessed Michael McGivney Fraternal Activities Fund': 630000,
    });
  });

  it.each(make)("maps every line to a universal category and splits 'Other Donations & Projects' into donations and capital projects (%s)", async (_name, create) => {
    const db = await create();
    const { lines, categories } = await db.budget.listAnnualForecast(MEMBER.admin, OWN, YEAR);
    expect(lines.every((l) => isUniversalBudgetCategory(l.universal_category))).toBe(true);
    const otherFund = categories.find((c) => c.CategoryName === 'Other Donations & Projects')!.id;
    const other = lines.filter((l) => l.BudgetCategoryID === otherFund);
    const total = (key: string) => other.filter((l) => l.universal_category === key).reduce((t, l) => t + cents(l.ApprovedBudgetAmount), 0);
    expect(total('CHARITABLE_DONATIONS')).toBe(530000);
    expect(total('CAPITAL_PROJECTS')).toBe(650000);
    expect(total('MISCELLANEOUS')).toBe(250000);
    // The spreadsheet's asterisk lives in Notes, so the Sprint 6E catch-all finds its line by name.
    const misc = lines.find((l) => l.LineItemName === 'Miscellaneous Others')!;
    expect(misc).toMatchObject({ CategoryType: 'Operational', ReferenceSourceID: null, ApprovedBudgetAmount: 2500 });
    expect(lines.some((l) => l.LineItemName.includes('*'))).toBe(false);
  });
});

describe('universal budget categories', () => {
  it('keeps Charitable Donations and Capital Projects as independent keys', () => {
    expect(UNIVERSAL_BUDGET_CATEGORIES.CHARITABLE_DONATIONS).toBe('Charitable Donations');
    expect(UNIVERSAL_BUDGET_CATEGORIES.CAPITAL_PROJECTS).toBe('Capital Projects');
    expect(isUniversalBudgetCategory('DONATIONS_AND_PROJECTS')).toBe(false);
    expect(isUniversalBudgetCategory('toString')).toBe(false);
  });

  it("carries the universal category of last year's line to the line that continues it", () => {
    const seeds = planBudgetPrePopulation({
      annualEvents: [{ id: 40, EventName: 'Christmas Party' }],
      eventExpenses: [],
      annualCharityChecks: [],
      meetingCount: 0,
      meetingExpenses: [],
      priorLines: [
        { CategoryType: 'Event', ReferenceSourceID: null, LineItemName: 'Christmas Party', BudgetCategoryID: 6, ApprovedBudgetAmount: 3000, universal_category: 'FRATERNAL_ACTIVITIES' },
        { CategoryType: 'Operational', ReferenceSourceID: null, LineItemName: 'Major Project(s)', BudgetCategoryID: 4, ApprovedBudgetAmount: 4500, universal_category: 'CAPITAL_PROJECTS' },
        { CategoryType: 'Operational', ReferenceSourceID: null, LineItemName: 'Unmapped', BudgetCategoryID: null, ApprovedBudgetAmount: 10, universal_category: null },
      ],
    });
    expect(seeds.find((s) => s.LineItemName === 'Christmas Party')?.universal_category).toBe('FRATERNAL_ACTIVITIES');
    expect(seeds.find((s) => s.LineItemName === 'Major Project(s)')?.universal_category).toBe('CAPITAL_PROJECTS');
    expect(seeds.find((s) => s.LineItemName === 'Unmapped')).not.toHaveProperty('universal_category');
  });
});
