// Sprint 6A (Phase 5): Membership Dues & Budget Performance Tracker - Council.base_dues_rate (schema 41), the dues
// revenue forecast (buildDuesForecast) and budgeted vs. actual spend for concluded events and meetings
// (buildConcludedBudgetPerformance, budget.getConcludedPerformance) with isolated Historical Benchmark lines.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildConcludedBudgetPerformance,
  buildDuesForecast,
  DEFAULT_BASE_DUES_RATE,
  duesRateOf,
  SecurityPrivilegeError,
  type ConcludedPerformanceRows,
  type CouncilBudgetForecast,
  type DataService,
  type MemberStatus,
} from '@kofc/shared';
import { MemoryDataService } from '../apps/web/services/drivers/memory';
import { TABLES } from '../apps/web/services/generated/schema.generated';
import { drivers, MEMBER, type DriverUnderTest } from './helpers';
import { openDatabases } from './shims/expo-sqlite';

const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');
const OWN = 1;
const OTHER = 2;

const STATUSES: MemberStatus[] = [
  { id: 1, Status: 'Active' },
  { id: 2, Status: 'Inactive' },
  { id: 3, Status: 'Former' },
  { id: 4, Status: 'Deceased' },
];

const line = (over: Partial<CouncilBudgetForecast>): CouncilBudgetForecast => ({
  id: 1,
  CouncilID: OWN,
  FraternalYear: '2026-2027',
  CategoryType: 'Operational',
  ReferenceSourceID: null,
  LineItemName: 'Council Meetings',
  PrePopulatedAmount: 0,
  ApprovedBudgetAmount: 0,
  ProposedBudgetAmount: 0,
  BudgetStatus: 'Draft',
  BudgetCategoryID: null,
  Notes: null,
  ...over,
});

describe('schema 41: Council.base_dues_rate', () => {
  it('appends the column with a 40.00 default and bumps the phone database version', () => {
    expect(read('Schema.sql')).toMatch(/ALTER TABLE \[Council\] ADD \[base_dues_rate\] DECIMAL\(10,2\) NOT NULL DEFAULT 40\.00;/);
    expect(TABLES.Council.columns.find((c) => c.name === 'base_dues_rate')).toMatchObject({ notNull: true, default: { kind: 'literal', value: 40 } });
    expect(read('apps/mobile/services/generated/schema.sqlite.ts')).toContain('[base_dues_rate] REAL NOT NULL DEFAULT 40');
    expect(read('apps/mobile/services/drivers/sqlite.ts')).toMatch(/const SCHEMA_VERSION = (4[1-9]|[5-9]\d);/);
    expect(read('data_dictionary.md')).toContain('base_dues_rate (DECIMAL(10,2), NOT NULL, DEFAULT 40.00)');
  });

  for (const d of drivers) {
    it(`gives every seeded council the default rate (${d.name})`, async () => {
      const db = await d.make();
      for (const council of await db.councils.list()) expect(council.base_dues_rate).toBe(DEFAULT_BASE_DUES_RATE);
    });
  }
});

describe('buildDuesForecast', () => {
  const members = [1, 1, 1, 2, 3, 4, 2].map((StatusID) => ({ StatusID }));

  it('bills Active and Inactive members at the council rate and leaves Former and Deceased off the roll', () => {
    expect(buildDuesForecast({ council: { base_dues_rate: 40 }, members, statuses: STATUSES })).toEqual({
      rate: 40,
      activeCount: 3,
      inactiveCount: 2,
      billableCount: 5,
      activeIncome: 120,
      inactiveIncome: 80,
      projectedIncome: 200,
    });
  });

  it('keeps whole cents and falls back to the default rate', () => {
    expect(buildDuesForecast({ council: { base_dues_rate: 37.5 }, members, statuses: STATUSES }).projectedIncome).toBe(187.5);
    expect(buildDuesForecast({ council: { base_dues_rate: 0.1 }, members: Array.from({ length: 3 }, () => ({ StatusID: 1 })), statuses: STATUSES }).projectedIncome).toBe(0.3);
    expect(duesRateOf(null)).toBe(40);
    expect(duesRateOf({ base_dues_rate: null })).toBe(40);
    expect(duesRateOf({ base_dues_rate: -5 })).toBe(40);
    expect(buildDuesForecast({ council: undefined, members: [], statuses: STATUSES })).toMatchObject({ rate: 40, billableCount: 0, projectedIncome: 0 });
  });
});

describe('buildConcludedBudgetPerformance', () => {
  const rows: ConcludedPerformanceRows = {
    events: [
      { id: 1, EventName: 'Fish Fry', StartDate: '2025-03-06', EndDate: '2025-03-06', IsAnnual: 1, Budget: 400, Spend: 380 },
      { id: 2, EventName: 'fish  fry', StartDate: '2026-09-12', EndDate: '2026-09-12', IsAnnual: 1, Budget: 500, Spend: 300 },
      { id: 3, EventName: 'Rosary Rally', StartDate: '2026-08-15', EndDate: '2026-08-15', IsAnnual: 0, Budget: 100, Spend: 120 },
      { id: 4, EventName: 'Coat Drive', StartDate: '2026-09-01', EndDate: '2026-09-25', IsAnnual: 0, Budget: 50, Spend: 0 }, // still running
      { id: 5, EventName: 'Summer Social', StartDate: '2026-06-20', EndDate: '2026-06-20', IsAnnual: 0, Budget: 80, Spend: 80 }, // last year
      { id: 6, EventName: 'Tootsie Roll Drive', StartDate: '2026-09-05', EndDate: '2026-09-06', IsAnnual: true, Budget: null, Spend: 25 },
    ],
    expenses: [
      { EventID: 2, MeetingID: null, Amount: 150.25 },
      { EventID: 1, MeetingID: null, Amount: 20 },
      { EventID: null, MeetingID: 10, Amount: 40 },
      { EventID: null, MeetingID: 11, Amount: 99 }, // a future meeting
      { EventID: null, MeetingID: null, Amount: 500 }, // unlinked
    ],
    meetings: [
      { id: 10, Date: '2026-09-01', EndDate: null },
      { id: 11, Date: '2026-10-05', EndDate: null },
      { id: 12, Date: '2026-09-19', EndDate: '2026-09-20' }, // ends today: not concluded
    ],
    lines: [line({ BudgetStatus: 'Approved', ApprovedBudgetAmount: 200, ProposedBudgetAmount: 200 })],
  };
  const result = buildConcludedBudgetPerformance({ councilId: OWN, fraternalYear: '2026-2027', today: '2026-09-20', rows });

  it('lists the events of the year that ended before today, newest first, budget against spend plus linked expenses', () => {
    expect(result).toMatchObject({ councilId: OWN, fraternalYear: '2026-2027', fromDate: '2026-07-01', throughDate: '2026-09-19' });
    expect(result.events.map((e) => [e.eventId, e.budget, e.actual, e.variance, e.percentUsed, e.alert])).toEqual([
      [2, 500, 450.25, 49.75, 90.1, 'Warning'],
      [6, null, 25, null, null, 'Unbudgeted'],
      [3, 100, 120, -20, 120, 'Over Budget'],
    ]);
  });

  it("gives annual events their previous occurrence as a Historical Benchmark that no total counts", () => {
    const fishFry = result.events.find((e) => e.eventId === 2)!;
    expect(fishFry.benchmark).toEqual({ eventId: 1, eventName: 'Fish Fry', startDate: '2025-03-06', budget: 400, actual: 400, percentUsed: 100 });
    expect(result.events.find((e) => e.eventId === 6)!.benchmark).toBeNull();
    expect(result.events.find((e) => e.eventId === 3)!.benchmark).toBeNull(); // not annual
    expect(result.totals).toEqual({ budget: 800, actual: 635.25, variance: 164.75, percentUsed: 79.4, alert: 'On Track' });
  });

  it('measures held meetings against the approved Council Meetings line only', () => {
    expect(result.meetings).toEqual({ lineName: 'Council Meetings', meetingCount: 1, budget: 200, actual: 40, variance: 160, percentUsed: 20, alert: 'On Track' });
    const unapproved = buildConcludedBudgetPerformance({
      councilId: OWN,
      fraternalYear: '2026-2027',
      today: '2026-09-20',
      rows: { ...rows, lines: [line({ BudgetStatus: 'Proposed', ProposedBudgetAmount: 200 })] },
    });
    expect(unapproved.meetings).toMatchObject({ budget: null, actual: 40, variance: null, alert: 'Unbudgeted' });
  });

  it('caps the period at June 30 and is empty on July 1', () => {
    const ended = buildConcludedBudgetPerformance({ councilId: OWN, fraternalYear: '2025-2026', today: '2026-09-20', rows });
    expect(ended.throughDate).toBe('2026-06-30');
    expect(ended.events.map((e) => e.eventId)).toEqual([5]);
    const first = buildConcludedBudgetPerformance({ councilId: OWN, fraternalYear: '2026-2027', today: '2026-07-01', rows });
    expect(first.events).toEqual([]);
    expect(first.meetings.meetingCount).toBe(0);
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

async function expectPrivilege(promise: Promise<unknown>, code: string): Promise<void> {
  const err = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(SecurityPrivilegeError);
  expect((err as SecurityPrivilegeError).code).toBe(code);
}

describe.each(drivers)('budget.getConcludedPerformance ($name)', (d) => {
  it('reads the council’s concluded events and meetings for leadership, with benchmarks outside the totals', async () => {
    const db = await d.make(); // today is 2026-09-20: fraternal year 2026-2027
    const before = await db.budget.getConcludedPerformance(MEMBER.admin, OWN);
    expect(before).toMatchObject({ councilId: OWN, fraternalYear: '2026-2027', fromDate: '2026-07-01', throughDate: '2026-09-19' });

    const category = (await db.lookups.list('Category'))[0].id;
    const event = (name: string, date: string, over: Record<string, unknown>, councils = [OWN]) =>
      db.events.create(
        { EventName: name, EventDescription: 'Fixture', OwnerID: MEMBER.superAdmin, StartDate: date, EndDate: date, Location: 'Hall', CategoryID: category, ...over },
        councils,
      );
    const prior = await event('Dues Fish Fry', '2025-03-06', { IsAnnual: 1, Budget: 400, Spend: 380 });
    const fishFry = await event('Dues Fish Fry', '2026-09-12', { IsAnnual: 1, Budget: 500, Spend: 300 });
    await event('Dues Future Gala', '2026-10-01', { Budget: 900, Spend: 0 });
    await event('Dues Neighbour Fry', '2026-09-12', { IsAnnual: 1, Budget: 999, Spend: 999 }, [OTHER]);
    const report = (eventId: number | null, meetingId: number | null, amount: number, status = 'Approved') => {
      const id = raw(d, db, 'ExpenseReport', { CouncilID: OWN, SubmitterMemberID: MEMBER.member, Status: status, LinkedEventID: eventId, LinkedMeetingID: meetingId });
      raw(d, db, 'ExpenseLineItem', { ExpenseReportID: id, DateOfExpense: '2026-09-10', Amount: amount, VendorName: 'Costco', ExpenseDescription: 'Supplies' });
    };
    report(fishFry.id, null, 150.25);
    report(fishFry.id, null, 70, 'Draft'); // not spend yet
    const meeting = await db.meetings.create({
      OwnerID: null,
      CouncilID: OWN,
      'Meeting Name': 'Dues business meeting',
      Date: '2026-09-02',
      'Time Start': '19:00:00',
      'Time End': '20:30:00',
      Location: 'Council Hall',
      MeetingType: (await db.lookups.list('MeetingType'))[0].id,
    });
    report(null, meeting.id, 40);

    const after = await db.budget.getConcludedPerformance(MEMBER.admin, OWN);
    const row = after.events.find((e) => e.eventId === fishFry.id)!;
    expect(row).toMatchObject({ budget: 500, actual: 450.25, percentUsed: 90.1, alert: 'Warning', isAnnual: true });
    expect(row.benchmark).toMatchObject({ eventId: prior.id, budget: 400, actual: 380, percentUsed: 95 });
    expect(after.events.map((e) => e.eventName)).not.toContain('Dues Future Gala');
    expect(after.events.map((e) => e.eventName)).not.toContain('Dues Neighbour Fry');
    expect(after.events.map((e) => e.eventId)).not.toContain(prior.id);
    expect(after.meetings.meetingCount).toBe(before.meetings.meetingCount + 1);
    expect(after.meetings.actual).toBeCloseTo(before.meetings.actual + 40, 2);
    expect(after.totals.budget).toBeCloseTo(before.totals.budget + 500, 2);
    expect(after.totals.actual).toBeCloseTo(before.totals.actual + 450.25 + 40, 2); // the benchmark's 380 is not counted

    // Council leadership only, as the budget gauges.
    await expectPrivilege(db.budget.getConcludedPerformance(MEMBER.member, OWN), 'ADMIN_REQUIRED');
    await expectPrivilege(db.budget.getConcludedPerformance(MEMBER.admin, OTHER), 'COUNCIL_ACCESS_DENIED');
    expect((await db.budget.getConcludedPerformance(MEMBER.superAdmin, OTHER)).events.map((e) => e.eventName)).toContain('Dues Neighbour Fry');
  });
});

describe('Financial Management Center wiring', () => {
  it('shows both high-contrast cards on the finance dashboard', () => {
    const page = read('apps/web/app/finance/dashboard/page.tsx');
    expect(page).toContain('buildDuesForecast');
    expect(page).toContain('db.budget.getConcludedPerformance');
    const parts = read('apps/web/components/DuesParts.tsx');
    expect(parts).toContain('Membership Dues Revenue Forecast');
    expect(parts).toContain('Budgeted vs. Current Actual Spend');
    expect(parts).toContain('Historical Benchmark');
    expect(parts).toContain('border-hc-gold bg-black');
  });
});
