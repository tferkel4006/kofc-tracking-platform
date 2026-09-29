// Sprint 5Y: annual budget forecasting plumbing - Event.IsAnnual and GlobalCharityRegistry.IsAnnual, fraternal year
// labels, council-isolated CouncilBudgetForecast lines, custom Operational lines, leadership-only access, and
// budget.prePopulateNextYear seeding next year's lines from last year's actual spend in one transaction.
import { describe, expect, it } from 'vitest';
import {
  assertFraternalYear,
  assertMayManageBudgetForecast,
  BUDGET_MEETINGS_LINE_NAME,
  budgetFundOf,
  budgetWindowOf,
  cleanBudgetLineUpdate,
  groupBudgetByFund,
  upcomingFraternalYear,
  cleanCustomBudgetLine,
  cleanEventFields,
  cleanGlobalCharity,
  fraternalYearBounds,
  mergeBudgetSeeds,
  planBudgetPrePopulation,
  planEventCopy,
  previousFraternalYear,
  SecurityPrivilegeError,
  type CouncilBudgetForecast,
  type DataService,
  type Event,
  type MemberWriteActor,
} from '@kofc/shared';
import { MemoryDataService } from '../apps/web/services/drivers/memory';
import { drivers, expectRule, MEMBER, type DriverUnderTest } from './helpers';
import { openDatabases } from './shims/expo-sqlite';

// Dev seed: council 1 is 15295 (Super Admin 1, Admin 2 who is also Financial Secretary, Member 3); council 2 exists.
const OWN = 1;
const OTHER = 2;
const TARGET = '2026-2027';
const SOURCE = '2025-2026';

const actor = (over: Partial<MemberWriteActor> = {}): MemberWriteActor => ({
  memberId: 10,
  councilId: OWN,
  memberType: 'Member',
  active: true,
  roles: [],
  ...over,
});

const line = (id: number, over: Partial<CouncilBudgetForecast> = {}): CouncilBudgetForecast => ({
  id,
  CouncilID: OWN,
  FraternalYear: TARGET,
  CategoryType: 'Operational',
  ReferenceSourceID: null,
  LineItemName: `Line ${id}`,
  PrePopulatedAmount: 0,
  ApprovedBudgetAmount: 0,
  Notes: null,
  ...over,
});

async function expectPrivilege(promise: Promise<unknown>, code: 'ADMIN_REQUIRED' | 'COUNCIL_ACCESS_DENIED') {
  expect(await expectRule(promise, code)).toBeInstanceOf(SecurityPrivilegeError);
}

/** Inserts a row straight into the backing store (for history the service only builds through long workflows). */
function raw(d: DriverUnderTest, db: DataService, table: string, row: Record<string, string | number | null>): number {
  if (d.name === 'memory') return (db as MemoryDataService).debugStore.insert(table, row).id as number;
  const cols = Object.keys(row);
  const res = openDatabases
    .at(-1)!
    .prepare(`INSERT INTO [${table}] (${cols.map((c) => `[${c}]`).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`)
    .run(...Object.values(row));
  return Number(res.lastInsertRowid);
}

/** Gives a member a Role straight in the backing store; the data service has no role-assignment method. */
function grantRole(d: DriverUnderTest, db: DataService, memberId: number, role: string): void {
  if (d.name === 'memory') {
    const store = (db as MemoryDataService).debugStore;
    store.insert('MemberRoles', { RoleID: store.rows('Role').find((r) => r.Role === role)!.id, MemberID: memberId });
  } else {
    openDatabases.at(-1)!.prepare('INSERT INTO [MemberRoles] ([RoleID], [MemberID]) SELECT [id], ? FROM [Role] WHERE [Role] = ?').run(memberId, role);
  }
}

async function addMember(db: DataService, councilId: number, type: 'Admin' | 'Member', email: string): Promise<number> {
  const types = await db.lookups.list('MemberType');
  const statuses = await db.lookups.list('MemberStatus');
  const member = await db.members.create(MEMBER.superAdmin, {
    CouncilID: councilId,
    MemberNumber: 7900000 + email.length,
    MemberFirstName: 'Budget',
    MemberLastName: 'Tester',
    Phone: '503-555-0170',
    StreetAddress1: '1 Ledger Way',
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

describe('budget helpers (pure)', () => {
  it('validates fraternal year labels and derives the previous year and its July-June bounds', () => {
    expect(assertFraternalYear(' 2027-2028 ')).toBe('2027-2028');
    for (const bad of ['2027-2029', '2027/2028', '27-28', 2027, '1700-1701']) {
      expect(() => assertFraternalYear(bad)).toThrow(/consecutive years/);
    }
    expect(previousFraternalYear('2027-2028')).toBe('2026-2027');
    expect(fraternalYearBounds('2026-2027')).toEqual({ fromDate: '2026-07-01', toDate: '2027-06-30' });
  });

  it('cleans custom lines and line updates', () => {
    expect(cleanCustomBudgetLine({ FraternalYear: TARGET, LineItemName: '  Office   supplies ', Notes: ' ' })).toEqual({
      FraternalYear: TARGET,
      LineItemName: 'Office supplies',
      ApprovedBudgetAmount: 0,
      Notes: null,
    });
    expect(() => cleanCustomBudgetLine({ FraternalYear: TARGET, LineItemName: 'x', CategoryType: 'Event' } as never)).toThrow(/no field "CategoryType"/);
    expect(() => cleanCustomBudgetLine({ FraternalYear: TARGET, LineItemName: ' ' })).toThrow(/Line item name is required/);
    expect(() => cleanCustomBudgetLine({ FraternalYear: TARGET, LineItemName: 'x', ApprovedBudgetAmount: 1.005 })).toThrow(/two decimal/);
    expect(cleanBudgetLineUpdate(250, undefined)).toEqual({ ApprovedBudgetAmount: 250 });
    expect(cleanBudgetLineUpdate(250, null)).toEqual({ ApprovedBudgetAmount: 250, Notes: null });
    expect(cleanBudgetLineUpdate(0, ' Board vote ')).toEqual({ ApprovedBudgetAmount: 0, Notes: 'Board vote' });
    expect(() => cleanBudgetLineUpdate(-1, undefined)).toThrow(/0 or more/);
    expect(() => cleanBudgetLineUpdate(1, 'x'.repeat(2001))).toThrow(/at most 2000/);
  });

  it('plans one line per annual event and annual charity plus the meetings line, summed to the cent and ordered', () => {
    const seeds = planBudgetPrePopulation({
      annualEvents: [
        { id: 7, EventName: 'Tootsie Roll Drive', Spend: 100.1 },
        { id: 4, EventName: 'Fish Fry', Spend: null },
      ],
      eventExpenses: [
        { EventID: 7, Amount: 0.2 },
        { EventID: 4, Amount: 45.5 },
        { EventID: 4, Amount: 4.5 },
      ],
      annualCharityChecks: [
        { CharityID: 3, Name: 'Pregnancy Center', Amount: 250 },
        { CharityID: 3, Name: 'Pregnancy Center', Amount: 250 },
        { CharityID: 9, Name: 'Food Bank', Amount: 100 },
      ],
      meetingCount: 10,
      meetingExpenses: [{ Amount: 12.34 }],
      priorCustomLines: [],
    });
    expect(seeds).toEqual([
      { CategoryType: 'Event', ReferenceSourceID: 4, LineItemName: 'Fish Fry', PrePopulatedAmount: 50 },
      { CategoryType: 'Event', ReferenceSourceID: 7, LineItemName: 'Tootsie Roll Drive', PrePopulatedAmount: 100.3 },
      { CategoryType: 'Donation', ReferenceSourceID: 9, LineItemName: 'Food Bank', PrePopulatedAmount: 100 },
      { CategoryType: 'Donation', ReferenceSourceID: 3, LineItemName: 'Pregnancy Center', PrePopulatedAmount: 500 },
      { CategoryType: 'Operational', ReferenceSourceID: null, LineItemName: BUDGET_MEETINGS_LINE_NAME, PrePopulatedAmount: 12.34 },
    ]);
    const quiet = planBudgetPrePopulation({ annualEvents: [], eventExpenses: [], annualCharityChecks: [], meetingCount: 0, meetingExpenses: [], priorCustomLines: [] });
    expect(quiet).toEqual([]);
  });

  it('merges seeds onto existing lines by source, or by name for unsourced lines, never touching approved figures', () => {
    const existing = [
      line(1, { CategoryType: 'Event', ReferenceSourceID: 4, LineItemName: 'Old Fish Fry', ApprovedBudgetAmount: 900 }),
      line(2, { LineItemName: 'council  MEETINGS', ApprovedBudgetAmount: 40 }),
    ];
    const plan = mergeBudgetSeeds(existing, [
      { CategoryType: 'Event', ReferenceSourceID: 4, LineItemName: 'Fish Fry', PrePopulatedAmount: 50 },
      { CategoryType: 'Donation', ReferenceSourceID: 4, LineItemName: 'Food Bank', PrePopulatedAmount: 100 },
      { CategoryType: 'Operational', ReferenceSourceID: null, LineItemName: 'Council Meetings', PrePopulatedAmount: 12 },
    ]);
    expect(plan.updates).toEqual([
      { id: 1, LineItemName: 'Fish Fry', PrePopulatedAmount: 50 },
      { id: 2, LineItemName: 'council  MEETINGS', PrePopulatedAmount: 12 },
    ]);
    expect(plan.inserts).toEqual([{ CategoryType: 'Donation', ReferenceSourceID: 4, LineItemName: 'Food Bank', PrePopulatedAmount: 100 }]);
  });

  it('carries last year\'s custom Operational lines forward once each at a 0.00 baseline, never the meetings line (Sprint 5Y-2)', () => {
    const seeds = planBudgetPrePopulation({
      annualEvents: [],
      eventExpenses: [],
      annualCharityChecks: [],
      meetingCount: 0,
      meetingExpenses: [],
      priorCustomLines: [{ LineItemName: 'Bulletin Ads' }, { LineItemName: 'Bank Fees' }, { LineItemName: 'bank  FEES' }, { LineItemName: 'Council Meetings' }],
    });
    expect(seeds).toEqual([
      { CategoryType: 'Operational', ReferenceSourceID: null, LineItemName: 'Bank Fees', PrePopulatedAmount: 0 },
      { CategoryType: 'Operational', ReferenceSourceID: null, LineItemName: 'Bulletin Ads', PrePopulatedAmount: 0 },
    ]);
  });

  it('opens a budget for drafting through June, locks it as Finalized on July 1, and names the year to prepare next', () => {
    expect(budgetWindowOf('2027-2028', new Date(2027, 4, 31, 23, 59))).toBe('Not Yet Open');
    expect(budgetWindowOf('2027-2028', new Date(2027, 5, 1))).toBe('Draft');
    expect(budgetWindowOf('2027-2028', new Date(2027, 5, 30, 23, 59))).toBe('Draft');
    expect(budgetWindowOf('2027-2028', new Date(2027, 6, 1))).toBe('Finalized');
    expect(budgetWindowOf('2026-2027', new Date(2026, 8, 20))).toBe('Finalized');
    expect(upcomingFraternalYear(new Date(2027, 5, 15))).toBe('2027-2028');
    expect(upcomingFraternalYear(new Date(2027, 0, 5))).toBe('2027-2028');
    expect(upcomingFraternalYear(new Date(2026, 8, 20))).toBe('2027-2028');
    expect(upcomingFraternalYear(new Date(2026, 6, 1))).toBe('2027-2028');
  });

  it('files each line under one of the six council funds', () => {
    const fund = (CategoryType: CouncilBudgetForecast['CategoryType'], LineItemName: string, source = {}) => budgetFundOf({ CategoryType, LineItemName }, source);
    expect(fund('Donation', 'Fr. George Wolf Seminarian Burse')).toBe('Father George Wolf Memorial Fund');
    expect(fund('Event', 'Sister Rita Vistica Dinner')).toBe('Sister Rita Rose Vistica Parish Community Fund');
    expect(fund('Donation', 'Cathedral School Tuition Aid')).toBe('Cathedral School & Student Support');
    expect(fund('Donation', 'Student Scholarships')).toBe('Cathedral School & Student Support');
    expect(fund('Donation', 'St. Joseph Parish', { charityType: 'Parish' })).toBe('Sister Rita Rose Vistica Parish Community Fund');
    expect(fund('Donation', 'Food Bank', { charityType: 'Food Security' })).toBe('Other Donations & Projects');
    expect(fund('Operational', 'Bank Fees')).toBe('Council Maintenance & State/Supreme Programs');
    expect(fund('Event', 'Parish Picnic', { eventCategory: 'Parish Community' })).toBe('Sister Rita Rose Vistica Parish Community Fund');
    expect(fund('Event', 'Fish Fry', { eventCategory: 'Fundraising' })).toBe('Blessed Michael McGivney Fraternal Activities Fund');
    expect(fund('Event', 'Schoolhouse Rock Night')).toBe('Blessed Michael McGivney Fraternal Activities Fund');

    const groups = groupBudgetByFund(
      [
        line(1, { LineItemName: 'Bank Fees', PrePopulatedAmount: 10.1, ApprovedBudgetAmount: 12 }),
        line(2, { LineItemName: 'Bulletin Ads', PrePopulatedAmount: 0.2, ApprovedBudgetAmount: 100 }),
        line(3, { CategoryType: 'Event', ReferenceSourceID: 4, LineItemName: 'Fish Fry', PrePopulatedAmount: 300 }),
      ],
      () => ({}),
    );
    expect(groups.map((g) => g.fund)).toHaveLength(6);
    expect(groups[4]).toMatchObject({ fund: 'Council Maintenance & State/Supreme Programs', prePopulatedTotal: 10.3, approvedTotal: 112 });
    expect(groups[4].lines.map((l) => l.id)).toEqual([1, 2]);
    expect(groups[5].lines.map((l) => l.id)).toEqual([3]);
    expect(groups[0]).toMatchObject({ lines: [], prePopulatedTotal: 0, approvedTotal: 0 });
  });

  it('gates the forecast to council leadership: Admins, Financial Secretaries, Treasurers and Super Admins', () => {
    const allowed = (a: MemberWriteActor, councilId = OWN) => {
      try {
        assertMayManageBudgetForecast(a, councilId, 'read the budget');
        return true;
      } catch (e) {
        expect(e).toBeInstanceOf(SecurityPrivilegeError);
        return false;
      }
    };
    expect(allowed(actor())).toBe(false);
    expect(allowed(actor({ roles: ['Grand Knight'] }))).toBe(false);
    expect(allowed(actor({ roles: ['Treasurer'] }))).toBe(true);
    expect(allowed(actor({ roles: ['Financial Secretary'] }))).toBe(true);
    expect(allowed(actor({ roles: ['Treasurer'], active: false }))).toBe(false);
    expect(allowed(actor({ memberType: 'Admin' }))).toBe(true);
    expect(allowed(actor({ memberType: 'Admin' }), OTHER)).toBe(false);
    expect(allowed(actor({ roles: ['Treasurer'] }), OTHER)).toBe(false);
    expect(allowed(actor({ memberType: 'Super Admin', councilId: OTHER }))).toBe(true);
  });

  it('stores IsAnnual as a bit on events and charities, and keeps it on an event twin', () => {
    expect(cleanEventFields({ IsAnnual: true as never })).toEqual({ IsAnnual: 1 });
    expect(cleanEventFields({ IsAnnual: 0 })).toEqual({ IsAnnual: 0 });
    expect(() => cleanEventFields({ IsAnnual: null })).toThrow(/IsAnnual must be/);
    const base = { Name: 'Food Bank', Description: 'Groceries', State: 'OR', CharityType: 'Food Security' };
    expect(cleanGlobalCharity(base).IsAnnual).toBe(0);
    expect(cleanGlobalCharity({ ...base, IsAnnual: true }).IsAnnual).toBe(1);
    expect(() => cleanGlobalCharity({ ...base, IsAnnual: 1 as never })).toThrow(/IsAnnual must be true or false/);
    const event: Event = {
      id: 1,
      EventName: 'Fish Fry',
      EventDescription: 'Lenten dinner',
      OwnerID: 1,
      StartDate: '2026-03-06',
      EndDate: '2026-03-06',
      Location: 'Hall',
      CategoryID: 1,
      IsAnnual: 1,
    };
    expect(planEventCopy(event, [], { startDate: '2027-02-19' }).event.IsAnnual).toBe(1);
    expect(planEventCopy({ ...event, IsAnnual: 0 }, [], { startDate: '2027-02-19' }).event.IsAnnual).toBeUndefined();
  });
});

for (const d of drivers) {
  describe(`'${d.name}' driver: budget forecasting`, () => {
    /**
     * Last fraternal year (2025-2026) for council 1, with noise that must not count: another council's annual event
     * and charity check, a non-annual event and charity, an annual event from the current year, and a Draft sheet.
     */
    async function withHistory() {
      const db = await d.make();
      const category = (await db.lookups.list('Category'))[0].id;
      const event = (name: string, date: string, over: Partial<Event> = {}, councils = [OWN]) =>
        db.events.create(
          { EventName: name, EventDescription: 'Fixture', OwnerID: MEMBER.superAdmin, StartDate: date, EndDate: date, Location: 'Hall', CategoryID: category, ...over },
          councils,
        );
      const fishFry = await event('Fish Fry', '2026-03-06', { IsAnnual: 1, Spend: 300 });
      const tootsie = await event('Tootsie Roll Drive', '2025-10-04', { IsAnnual: 1 });
      await event('Council Picnic', '2025-08-02', { Spend: 999 }); // not annual
      await event('Next Fish Fry', '2026-09-01', { IsAnnual: 1, Spend: 999 }); // this fraternal year, not last
      await event('Neighbour Fish Fry', '2026-03-06', { IsAnnual: 1, Spend: 999 }, [OTHER]);
      expect(fishFry.IsAnnual).toBe(1);

      const report = (eventId: number | null, meetingId: number | null, amount: number, status = 'Approved', councilId = OWN) => {
        const id = raw(d, db, 'ExpenseReport', {
          CouncilID: councilId,
          SubmitterMemberID: MEMBER.member,
          Status: status,
          LinkedEventID: eventId,
          LinkedMeetingID: meetingId,
        });
        raw(d, db, 'ExpenseLineItem', { ExpenseReportID: id, DateOfExpense: '2026-03-01', Amount: amount, VendorName: 'Costco', ExpenseDescription: 'Supplies' });
      };
      report(fishFry.id, null, 120.25);
      report(fishFry.id, null, 50, 'Reimbursed');
      report(fishFry.id, null, 70, 'Draft'); // not spend yet
      report(tootsie.id, null, 80);

      const meetingType = (await db.lookups.list('MeetingType'))[0].id;
      const meeting = await db.meetings.create({
        OwnerID: null,
        CouncilID: OWN,
        'Meeting Name': 'March business meeting',
        Date: '2026-03-12',
        'Time Start': '19:00:00',
        'Time End': '20:30:00',
        Location: 'Council Hall',
        MeetingType: meetingType,
      });
      report(null, meeting.id, 35.5);

      const annual = await db.charities.addGlobalCharity(MEMBER.superAdmin, {
        Name: 'Salem Pregnancy Center',
        Description: 'Support for mothers',
        State: 'OR',
        CharityType: 'Protecting Life',
        IsAnnual: true,
      });
      const oneOff = await db.charities.addGlobalCharity(MEMBER.superAdmin, {
        Name: 'Storm Relief',
        Description: 'One-time appeal',
        State: 'OR',
        CharityType: 'Homelessness',
      });
      expect(annual.IsAnnual).toBe(1);
      expect(oneOff.IsAnnual).toBe(0);
      const check = (councilId: number, charityId: number, amount: number, date: string, no: string) =>
        raw(d, db, 'CharitableDisbursementLedger', {
          CouncilID: councilId,
          CharityID: charityId,
          Amount: amount,
          CheckNumber: no,
          DisbursedByID: MEMBER.superAdmin,
          PayoutDate: date,
        });
      check(OWN, annual.id, 250, '2025-12-15', '3001');
      check(OWN, annual.id, 250.5, '2026-06-30', '3002');
      check(OWN, annual.id, 999, '2026-07-01', '3003'); // this fraternal year
      check(OWN, oneOff.id, 999, '2026-01-10', '3004');
      check(OTHER, annual.id, 999, '2026-01-10', '9001');
      return { db, fishFry, tootsie, annual };
    }

    it('seeds next year from last year\'s annual events, annual charity checks and meeting expenses of the council only', async () => {
      const { db, fishFry, tootsie, annual } = await withHistory();
      const result = await db.budget.prePopulateNextYear(MEMBER.admin, OWN, TARGET);
      expect(result).toMatchObject({ fraternalYear: TARGET, sourceFraternalYear: SOURCE, created: 4, refreshed: 0 });
      expect(result.lines.map(({ CategoryType, ReferenceSourceID, LineItemName, PrePopulatedAmount, ApprovedBudgetAmount, CouncilID, FraternalYear }) => ({
        CategoryType,
        ReferenceSourceID,
        LineItemName,
        PrePopulatedAmount,
        ApprovedBudgetAmount,
        CouncilID,
        FraternalYear,
      }))).toEqual([
        { CategoryType: 'Event', ReferenceSourceID: fishFry.id, LineItemName: 'Fish Fry', PrePopulatedAmount: 470.25, ApprovedBudgetAmount: 0, CouncilID: OWN, FraternalYear: TARGET },
        { CategoryType: 'Event', ReferenceSourceID: tootsie.id, LineItemName: 'Tootsie Roll Drive', PrePopulatedAmount: 80, ApprovedBudgetAmount: 0, CouncilID: OWN, FraternalYear: TARGET },
        { CategoryType: 'Donation', ReferenceSourceID: annual.id, LineItemName: 'Salem Pregnancy Center', PrePopulatedAmount: 500.5, ApprovedBudgetAmount: 0, CouncilID: OWN, FraternalYear: TARGET },
        { CategoryType: 'Operational', ReferenceSourceID: null, LineItemName: BUDGET_MEETINGS_LINE_NAME, PrePopulatedAmount: 35.5, ApprovedBudgetAmount: 0, CouncilID: OWN, FraternalYear: TARGET },
      ]);
      expect(await db.budget.listAnnualForecast(MEMBER.superAdmin, OTHER, TARGET)).toEqual([]);
      expect(await db.budget.listAnnualForecast(MEMBER.admin, OWN, SOURCE)).toEqual([]);
    });

    it('re-runs safely: refreshes pre-populated figures and renamed sources, keeps approved figures and notes', async () => {
      const { db, fishFry } = await withHistory();
      const first = await db.budget.prePopulateNextYear(MEMBER.admin, OWN, TARGET);
      const fishLine = first.lines.find((l) => l.ReferenceSourceID === fishFry.id)!;
      await db.budget.updateLineItemBudget(MEMBER.admin, fishLine.id, 500, 'Add a second fryer');
      await db.events.update(fishFry.id, { EventName: 'Lenten Fish Fry', Spend: 400 });

      const again = await db.budget.prePopulateNextYear(MEMBER.admin, OWN, TARGET);
      expect(again).toMatchObject({ created: 0, refreshed: 4 });
      expect(again.lines).toHaveLength(4);
      expect(again.lines.find((l) => l.id === fishLine.id)).toMatchObject({
        LineItemName: 'Lenten Fish Fry',
        PrePopulatedAmount: 570.25,
        ApprovedBudgetAmount: 500,
        Notes: 'Add a second fryer',
      });
      expect(d.count(db, 'CouncilBudgetForecast')).toBe(4);
    });

    it('lets leadership approve figures and notes, and add unique custom Operational lines', async () => {
      const db = await d.make();
      const custom = await db.budget.addCustomBudgetLine(MEMBER.admin, OWN, {
        FraternalYear: TARGET,
        LineItemName: 'Liability insurance',
        ApprovedBudgetAmount: 1200,
        Notes: 'Renews in October',
      });
      expect(custom).toMatchObject({
        CouncilID: OWN,
        FraternalYear: TARGET,
        CategoryType: 'Operational',
        ReferenceSourceID: null,
        LineItemName: 'Liability insurance',
        PrePopulatedAmount: 0,
        ApprovedBudgetAmount: 1200,
        Notes: 'Renews in October',
      });
      const dup = await expectRule(db.budget.addCustomBudgetLine(MEMBER.admin, OWN, { FraternalYear: TARGET, LineItemName: ' LIABILITY  insurance' }), 'BUDGET_LINE_EXISTS');
      expect(dup.details.lineId).toBe(custom.id);
      // Another year, or another council, is a different budget.
      await db.budget.addCustomBudgetLine(MEMBER.admin, OWN, { FraternalYear: '2027-2028', LineItemName: 'Liability insurance' });
      await db.budget.addCustomBudgetLine(MEMBER.superAdmin, OTHER, { FraternalYear: TARGET, LineItemName: 'Liability insurance' });

      expect(await db.budget.updateLineItemBudget(MEMBER.admin, custom.id, 1350.75)).toMatchObject({ ApprovedBudgetAmount: 1350.75, Notes: 'Renews in October' });
      expect(await db.budget.updateLineItemBudget(MEMBER.admin, custom.id, 1350.75, null)).toMatchObject({ Notes: null });
      await expectRule(db.budget.updateLineItemBudget(MEMBER.admin, custom.id, -5), 'INVALID_INPUT');
      await expectRule(db.budget.updateLineItemBudget(MEMBER.admin, 999_999, 5), 'RECORD_NOT_FOUND');
      await expectRule(db.budget.listAnnualForecast(MEMBER.admin, OWN, '2026'), 'INVALID_INPUT');
      await expectRule(db.budget.prePopulateNextYear(MEMBER.superAdmin, 999, TARGET), 'INVALID_INPUT');
    });

    it('clones last year\'s custom lines into the new year at a 0.00 baseline, for that council only (Sprint 5Y-2)', async () => {
      const db = await d.make();
      await db.budget.addCustomBudgetLine(MEMBER.admin, OWN, { FraternalYear: SOURCE, LineItemName: 'Bank Fees', ApprovedBudgetAmount: 60, Notes: 'Monthly service charge' });
      await db.budget.addCustomBudgetLine(MEMBER.admin, OWN, { FraternalYear: SOURCE, LineItemName: 'Bulletin Ads', ApprovedBudgetAmount: 400 });
      await db.budget.addCustomBudgetLine(MEMBER.superAdmin, OTHER, { FraternalYear: SOURCE, LineItemName: 'Neighbour Dues', ApprovedBudgetAmount: 90 });
      const result = await db.budget.prePopulateNextYear(MEMBER.admin, OWN, TARGET);
      const custom = result.lines.filter((l) => l.LineItemName !== BUDGET_MEETINGS_LINE_NAME);
      expect(custom.map(({ CategoryType, ReferenceSourceID, LineItemName, PrePopulatedAmount, ApprovedBudgetAmount, Notes }) => ({
        CategoryType,
        ReferenceSourceID,
        LineItemName,
        PrePopulatedAmount,
        ApprovedBudgetAmount,
        Notes: Notes ?? null,
      }))).toEqual([
        { CategoryType: 'Operational', ReferenceSourceID: null, LineItemName: 'Bank Fees', PrePopulatedAmount: 0, ApprovedBudgetAmount: 0, Notes: null },
        { CategoryType: 'Operational', ReferenceSourceID: null, LineItemName: 'Bulletin Ads', PrePopulatedAmount: 0, ApprovedBudgetAmount: 0, Notes: null },
      ]);
      // Running again adds nothing, and a line the officers already approved keeps its figure.
      await db.budget.updateLineItemBudget(MEMBER.admin, custom[0].id, 75);
      const again = await db.budget.prePopulateNextYear(MEMBER.admin, OWN, TARGET);
      expect(again.created).toBe(0);
      expect(again.lines.find((l) => l.id === custom[0].id)).toMatchObject({ PrePopulatedAmount: 0, ApprovedBudgetAmount: 75 });
    });

    it('keeps standard members and other councils out, and lets a Treasurer in', async () => {
      const db = await d.make();
      const line = await db.budget.addCustomBudgetLine(MEMBER.admin, OWN, { FraternalYear: TARGET, LineItemName: 'Office supplies' });
      await expectPrivilege(db.budget.listAnnualForecast(MEMBER.member, OWN, TARGET), 'ADMIN_REQUIRED');
      await expectPrivilege(db.budget.updateLineItemBudget(MEMBER.member, line.id, 10), 'ADMIN_REQUIRED');
      await expectPrivilege(db.budget.addCustomBudgetLine(MEMBER.member, OWN, { FraternalYear: TARGET, LineItemName: 'Snacks' }), 'ADMIN_REQUIRED');
      await expectPrivilege(db.budget.prePopulateNextYear(MEMBER.member, OWN, TARGET), 'ADMIN_REQUIRED');

      const foreignAdmin = await addMember(db, OTHER, 'Admin', 'foreign.admin.budget@example.com');
      await expectPrivilege(db.budget.listAnnualForecast(foreignAdmin, OWN, TARGET), 'COUNCIL_ACCESS_DENIED');
      await expectPrivilege(db.budget.updateLineItemBudget(foreignAdmin, line.id, 10), 'COUNCIL_ACCESS_DENIED');
      await expectPrivilege(db.budget.prePopulateNextYear(foreignAdmin, OWN, TARGET), 'COUNCIL_ACCESS_DENIED');
      expect(d.count(db, 'CouncilBudgetForecast')).toBe(1);
      expect((await db.budget.listAnnualForecast(MEMBER.admin, OWN, TARGET))[0].ApprovedBudgetAmount).toBe(0);

      const treasurer = await addMember(db, OWN, 'Member', 'treasurer.budget@example.com');
      grantRole(d, db, treasurer, 'Treasurer');
      expect(await db.budget.updateLineItemBudget(treasurer, line.id, 75)).toMatchObject({ ApprovedBudgetAmount: 75 });
      expect(await db.budget.listAnnualForecast(treasurer, OWN, TARGET)).toHaveLength(1);
      await expectPrivilege(db.budget.listAnnualForecast(treasurer, OTHER, TARGET), 'COUNCIL_ACCESS_DENIED');
    });
  });
}
