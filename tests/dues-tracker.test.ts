// Sprint 6A (Phase 5): Membership Dues & Budget Performance Tracker - Council.base_dues_rate (schema 41), the dues
// revenue forecast (buildDuesForecast) and budgeted vs. actual spend for concluded events and meetings
// (buildConcludedBudgetPerformance, budget.getConcludedPerformance) with isolated Historical Benchmark lines.
// Sprint 6C: event budgets come only from the approved 'Event' rows of CouncilBudgetForecast, never Event.Budget.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildConcludedBudgetPerformance,
  buildDuesForecast,
  canEditDuesRate,
  cleanDuesRate,
  DEFAULT_BASE_DUES_RATE,
  DUES_RATE_EDITOR_ROLE_NAMES,
  DUES_RATE_MAX,
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

function approvedEventLine(id: number, FraternalYear: string, LineItemName: string, amount: number, ReferenceSourceID: number | null = null): CouncilBudgetForecast {
  return line({ id, FraternalYear, CategoryType: 'Event', ReferenceSourceID, LineItemName, ApprovedBudgetAmount: amount, ProposedBudgetAmount: amount, BudgetStatus: 'Approved' });
}

describe('buildConcludedBudgetPerformance', () => {
  const rows: ConcludedPerformanceRows = {
    events: [
      { id: 1, EventName: 'Fish Fry', StartDate: '2025-03-06', EndDate: '2025-03-06', IsAnnual: 1 },
      { id: 2, EventName: 'fish  fry', StartDate: '2026-09-12', EndDate: '2026-09-12', IsAnnual: 1 },
      { id: 3, EventName: 'Rosary Rally', StartDate: '2026-08-15', EndDate: '2026-08-15', IsAnnual: 0 },
      { id: 4, EventName: 'Coat Drive', StartDate: '2026-09-01', EndDate: '2026-09-25', IsAnnual: 0 }, // still running
      { id: 5, EventName: 'Summer Social', StartDate: '2026-06-20', EndDate: '2026-06-20', IsAnnual: 0 }, // last year
      { id: 6, EventName: 'Tootsie Roll Drive', StartDate: '2026-09-05', EndDate: '2026-09-06', IsAnnual: true },
    ],
    expenses: [
      { EventID: 2, MeetingID: null, Amount: 150.25 },
      { EventID: 2, MeetingID: null, Amount: 300 },
      { EventID: 1, MeetingID: null, Amount: 380 },
      { EventID: 1, MeetingID: null, Amount: 20 },
      { EventID: 3, MeetingID: null, Amount: 120 },
      { EventID: 5, MeetingID: null, Amount: 80 },
      { EventID: 6, MeetingID: null, Amount: 25 },
      { EventID: null, MeetingID: 10, Amount: 40 },
      { EventID: null, MeetingID: 11, Amount: 99 }, // a future meeting
      { EventID: null, MeetingID: null, Amount: 500 }, // unlinked
    ],
    meetings: [
      { id: 10, Date: '2026-09-01', EndDate: null },
      { id: 11, Date: '2026-10-05', EndDate: null },
      { id: 12, Date: '2026-09-19', EndDate: '2026-09-20' }, // ends today: not concluded
    ],
    lines: [
      line({ BudgetStatus: 'Approved', ApprovedBudgetAmount: 200, ProposedBudgetAmount: 200 }),
      approvedEventLine(20, '2026-2027', 'Fish Fry', 500), // matched by name, ignoring case and spacing
      approvedEventLine(21, '2026-2027', 'Rosary Rally (budget line)', 100, 3), // matched by ReferenceSourceID
      approvedEventLine(22, '2026-2027', 'Coat Drive', 50),
      approvedEventLine(23, '2025-2026', 'Summer Social', 80),
      approvedEventLine(24, '2024-2025', 'Fish Fry', 400), // the benchmark's own year
      approvedEventLine(25, '2025-2026', 'Tootsie Roll Drive', 60), // another year's line never applies
    ],
  };
  const result = buildConcludedBudgetPerformance({ councilId: OWN, fraternalYear: '2026-2027', today: '2026-09-20', rows });

  it('lists the events of the year that ended before today, newest first, budget against their rolled-up expenses', () => {
    expect(result).toMatchObject({ councilId: OWN, fraternalYear: '2026-2027', fromDate: '2026-07-01', throughDate: '2026-09-19' });
    expect(result.events.map((e) => [e.eventId, e.budget, e.budgetLineId, e.actual, e.variance, e.percentUsed, e.alert])).toEqual([
      [2, 500, 20, 450.25, 49.75, 90.1, 'Warning'],
      [6, null, null, 25, null, null, 'Unbudgeted'],
      [3, 100, 21, 120, -20, 120, 'Over Budget'],
    ]);
  });

  it('pulls each event budget from its year’s approved Event forecast line, never a manual Event.Budget field (Sprint 6C)', () => {
    const manual = buildConcludedBudgetPerformance({
      councilId: OWN,
      fraternalYear: '2026-2027',
      today: '2026-09-20',
      rows: { ...rows, events: rows.events.map((e) => ({ ...e, Budget: 9999 })) },
    });
    expect(manual.events.map((e) => e.budget)).toEqual([500, null, 100]);
    expect(manual.totals).toEqual(result.totals);

    // A line the council has not yet approved (Draft or Proposed) budgets nothing.
    const proposed = buildConcludedBudgetPerformance({
      councilId: OWN,
      fraternalYear: '2026-2027',
      today: '2026-09-20',
      rows: { ...rows, lines: rows.lines.map((l) => (l.id === 20 ? { ...l, BudgetStatus: 'Proposed' as const, ApprovedBudgetAmount: 0 } : l)) },
    });
    expect(proposed.events.find((e) => e.eventId === 2)).toMatchObject({ budget: null, budgetLineId: null, alert: 'Unbudgeted' });

    // ReferenceSourceID wins over a same-named line; Donation and Operational lines never budget an event.
    const linked = buildConcludedBudgetPerformance({
      councilId: OWN,
      fraternalYear: '2026-2027',
      today: '2026-09-20',
      rows: {
        ...rows,
        lines: [
          ...rows.lines,
          approvedEventLine(30, '2026-2027', 'Fish Fry (second line)', 650, 2),
          line({ id: 31, CategoryType: 'Operational', LineItemName: 'Tootsie Roll Drive', ApprovedBudgetAmount: 70, BudgetStatus: 'Approved' }),
          line({ id: 32, CategoryType: 'Donation', ReferenceSourceID: 6, LineItemName: 'Tootsie Roll Drive', ApprovedBudgetAmount: 70, BudgetStatus: 'Approved' }),
        ],
      },
    });
    expect(linked.events.map((e) => [e.eventId, e.budgetLineId, e.budget])).toEqual([
      [2, 30, 650],
      [6, null, null],
      [3, 21, 100],
    ]);
  });

  it('adds a forecast line shared by two events of the same name to the budget total once', () => {
    const twice = buildConcludedBudgetPerformance({
      councilId: OWN,
      fraternalYear: '2026-2027',
      today: '2026-09-20',
      rows: { ...rows, events: [...rows.events, { id: 7, EventName: 'Fish Fry', StartDate: '2026-08-01', EndDate: '2026-08-01', IsAnnual: 1 }] },
    });
    expect(twice.events.filter((e) => e.budgetLineId === 20).map((e) => e.eventId)).toEqual([2, 7]);
    expect(twice.totals.budget).toBe(result.totals.budget);
  });

  it("gives annual events their previous occurrence as a Historical Benchmark that no total counts", () => {
    const fishFry = result.events.find((e) => e.eventId === 2)!;
    expect(fishFry.benchmark).toEqual({ eventId: 1, eventName: 'Fish Fry', startDate: '2025-03-06', budget: 400, actual: 400, percentUsed: 100 });
    expect(result.events.find((e) => e.eventId === 6)!.benchmark).toBeNull();
    expect(result.events.find((e) => e.eventId === 3)!.benchmark).toBeNull(); // not annual
    expect(result.totals).toEqual({ budget: 800, actual: 635.25, variance: 164.75, percentUsed: 79.4, alert: 'On Track' });
  });

  it('never reads a manual Event.Spend figure (Sprint 6B): the actual is the expense rollup alone', () => {
    const overridden = buildConcludedBudgetPerformance({
      councilId: OWN,
      fraternalYear: '2026-2027',
      today: '2026-09-20',
      rows: { ...rows, events: rows.events.map((e) => ({ ...e, Spend: 9999 })) },
    });
    expect(overridden.events.map((e) => [e.eventId, e.actual])).toEqual(result.events.map((e) => [e.eventId, e.actual]));
    expect(overridden.totals).toEqual(result.totals);
    const noSheets = buildConcludedBudgetPerformance({ councilId: OWN, fraternalYear: '2026-2027', today: '2026-09-20', rows: { ...rows, expenses: [] } });
    expect(noSheets.events.map((e) => e.actual)).toEqual([0, 0, 0]);
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
    // Only Approved and Reimbursed sheets count as actuals, and only the approved CouncilBudgetForecast Event lines as
    // budgets (Sprints 6B, 6C; the manual Event.Budget and Event.Spend columns were dropped in schema 47).
    const prior = await event('Dues Fish Fry', '2025-03-06', { IsAnnual: 1 });
    const fishFry = await event('Dues Fish Fry', '2026-09-12', { IsAnnual: 1 });
    await event('Dues Future Gala', '2026-10-01', {});
    await event('Dues Neighbour Fry', '2026-09-12', { IsAnnual: 1 }, [OTHER]);
    const forecastLine = (councilId: number, year: string, name: string, amount: number, status = 'Approved') =>
      raw(d, db, 'CouncilBudgetForecast', {
        CouncilID: councilId,
        FraternalYear: year,
        CategoryType: 'Event',
        ReferenceSourceID: null,
        LineItemName: name,
        PrePopulatedAmount: 0,
        ProposedBudgetAmount: amount,
        ApprovedBudgetAmount: status === 'Approved' ? amount : 0,
        BudgetStatus: status,
      });
    forecastLine(OWN, '2024-2025', 'Dues Fish Fry', 400);
    const fishFryLine = forecastLine(OWN, '2026-2027', 'dues fish fry', 500);
    forecastLine(OTHER, '2026-2027', 'Dues Fish Fry', 8888); // another council's line never applies
    const report = (eventId: number | null, meetingId: number | null, amount: number, status = 'Approved') => {
      const id = raw(d, db, 'ExpenseReport', { CouncilID: OWN, SubmitterMemberID: MEMBER.member, Status: status, LinkedEventID: eventId, LinkedMeetingID: meetingId });
      raw(d, db, 'ExpenseLineItem', { ExpenseReportID: id, DateOfExpense: '2026-09-10', Amount: amount, VendorName: 'Costco', ExpenseDescription: 'Supplies' });
    };
    report(prior.id, null, 380, 'Reimbursed');
    report(fishFry.id, null, 150.25);
    report(fishFry.id, null, 300, 'Reimbursed');
    report(fishFry.id, null, 70, 'Draft'); // not spend yet
    report(fishFry.id, null, 45, 'Submitted'); // awaiting signatures: not spend yet
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
    expect(row).toMatchObject({ budget: 500, budgetLineId: fishFryLine, actual: 450.25, percentUsed: 90.1, alert: 'Warning', isAnnual: true });
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
  it('shows both summary cards on the finance dashboard', () => {
    const page = read('apps/web/app/finance/dashboard/page.tsx');
    expect(page).toContain('buildDuesForecast');
    expect(page).toContain('db.budget.getConcludedPerformance');
    const parts = read('apps/web/components/DuesParts.tsx');
    expect(parts).toContain('Membership Dues Revenue Forecast');
    expect(parts).toContain('Budgeted vs. Current Actual Spend');
    expect(parts).toContain('Historical Benchmark');
    expect(parts).toContain('border-navy bg-white');
    expect(parts).not.toMatch(/hc-gold|bg-black/);
  });
});

describe('canEditDuesRate and cleanDuesRate (Sprint 6B)', () => {
  it('admits only the Grand Knight and Financial Secretary seats of the council', () => {
    expect(DUES_RATE_EDITOR_ROLE_NAMES).toEqual(['Grand Knight', 'Financial Secretary']);
    expect(canEditDuesRate({ councilId: OWN, roles: ['Grand Knight'] }, OWN)).toBe(true);
    expect(canEditDuesRate({ councilId: OWN, roles: ['Financial Secretary'] }, OWN)).toBe(true);
    expect(canEditDuesRate({ councilId: OWN, roles: ['Financial Secretary'] }, OTHER)).toBe(false);
    for (const role of ['Treasurer', 'Deputy Grand Knight', 'Trustee 1', 'Member']) expect(canEditDuesRate({ councilId: OWN, roles: [role] }, OWN)).toBe(false);
    expect(canEditDuesRate({ councilId: OWN }, OWN)).toBe(false);
  });

  it('accepts dollar amounts in whole cents only', () => {
    expect(cleanDuesRate(42.5)).toBe(42.5);
    expect(cleanDuesRate(0)).toBe(0);
    expect(cleanDuesRate(0.1 + 0.2)).toBe(0.3);
    for (const bad of [-1, 12.345, Number.NaN, Infinity, DUES_RATE_MAX + 1, '40', null]) expect(() => cleanDuesRate(bad)).toThrow(/base dues rate/);
  });
});

function grantRole(d: DriverUnderTest, db: DataService, memberId: number, role: string): void {
  if (d.name === 'memory') {
    const store = (db as MemoryDataService).debugStore;
    store.insert('MemberRoles', { RoleID: store.rows('Role').find((r) => r.Role === role)!.id, MemberID: memberId });
  } else {
    openDatabases.at(-1)!.prepare('INSERT INTO [MemberRoles] ([RoleID], [MemberID]) SELECT [id], ? FROM [Role] WHERE [Role] = ?').run(memberId, role);
  }
}

/** An Active member of `councilId` of the given type, added by the seeded Super Admin. */
async function addMember(db: DataService, councilId: number, type: 'Admin' | 'Member', email: string): Promise<number> {
  const types = await db.lookups.list('MemberType');
  const statuses = await db.lookups.list('MemberStatus');
  const member = await db.members.create(MEMBER.superAdmin, {
    CouncilID: councilId,
    MemberNumber: 7800000 + email.length,
    MemberFirstName: 'Dues',
    MemberLastName: 'Tester',
    Phone: '503-555-0160',
    StreetAddress1: '1 Dues Way',
    City: 'Salem',
    State: 'OR',
    ZipCode: '97301',
    Email: email,
    DateOfBirth: '1970-05-05',
    StatusID: statuses.find((s) => s.Status === 'Active')!.id,
    DegreeID: 3,
    MemberTypeID: types.find((t) => t.Type === type)!.id,
  });
  return member.id;
}

describe.each(drivers)('councils.setDuesRate ($name)', (d) => {
  it('lets the council’s Grand Knight or Financial Secretary save base_dues_rate, and nobody else', async () => {
    const db = await d.make();
    // Seed: the Super Admin (member 1) holds council 1's Grand Knight seat and the Admin (member 2) its Financial Secretary seat.
    expect(await db.councils.setDuesRate(MEMBER.superAdmin, OWN, 42.5)).toMatchObject({ id: OWN, base_dues_rate: 42.5 });
    expect(await db.councils.setDuesRate(MEMBER.admin, OWN, 45)).toMatchObject({ id: OWN, base_dues_rate: 45 });
    expect((await db.councils.get(OWN))?.base_dues_rate).toBe(45);
    expect((await db.councils.get(OTHER))?.base_dues_rate).toBe(DEFAULT_BASE_DUES_RATE);

    const treasurer = await addMember(db, OWN, 'Member', 'dues.treasurer@example.com');
    grantRole(d, db, treasurer, 'Treasurer');
    const deputy = await addMember(db, OWN, 'Member', 'dues.deputy.gk@example.com');
    grantRole(d, db, deputy, 'Deputy Grand Knight');
    const seatlessAdmin = await addMember(db, OWN, 'Admin', 'dues.plain.admin@example.com');
    for (const actor of [MEMBER.member, treasurer, deputy, seatlessAdmin]) await expectPrivilege(db.councils.setDuesRate(actor, OWN, 50), 'DUES_RATE_EDITOR_REQUIRED');
    // A Grand Knight of one council cannot set another's rate, Super Admin or not.
    await expectPrivilege(db.councils.setDuesRate(MEMBER.superAdmin, OTHER, 50), 'COUNCIL_ACCESS_DENIED');
    expect((await db.councils.get(OWN))?.base_dues_rate).toBe(45);
    expect((await db.councils.get(OTHER))?.base_dues_rate).toBe(DEFAULT_BASE_DUES_RATE);

    for (const bad of [-5, 40.005, Number.NaN]) {
      const err = await db.councils.setDuesRate(MEMBER.admin, OWN, bad).then(
        () => null,
        (e: unknown) => e as { code?: string },
      );
      expect(err?.code).toBe('INVALID_INPUT');
    }
    expect((await db.councils.get(OWN))?.base_dues_rate).toBe(45);
  });
});

describe('Base Dues Rate editing (Sprint 6L Extension)', () => {
  it('leaves the rate to the Global Parameters Dashboard: Council Lookups has no dues tab or panel', () => {
    const page = read('apps/web/app/council-lookups/page.tsx');
    expect(page).not.toContain("label: 'Base Dues Rate'");
    expect(page).not.toContain('DuesRatePanel');
    expect(existsSync(join(__dirname, '..', 'apps/web/components/DuesRatePanel.tsx'))).toBe(false);
    expect(read('apps/web/components/GlobalParametersCard.tsx')).toContain('base_dues_rate: baseDuesRate');
  });
});
