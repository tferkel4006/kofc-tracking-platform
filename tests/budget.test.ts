// Sprint 5Y: annual budget forecasting - Event.IsAnnual and GlobalCharityRegistry.IsAnnual, fraternal year labels,
// council-isolated CouncilBudgetForecast lines, custom Operational lines carried forward each year, and
// budget.prePopulateNextYear seeding next year's lines from last year's actual spend in one transaction.
// Sprint 5Y-3: council budget categories (CouncilBudgetCategory, a council lookup table), member transparency (every
// member reads the budget), the Designated Budget Director (Member.IsBudgetDirector) and the data layer's July 1 lock
// (BUDGET_YEAR_FINALIZED, lifted only by an Active Super Admin's override).
import { describe, expect, it } from 'vitest';
import {
  assertBudgetYearWritable,
  assertFraternalYear,
  assertMayManageBudgetForecast,
  assertMayViewBudgetForecast,
  BUDGET_MEETINGS_LINE_NAME,
  budgetWindowOf,
  cleanBudgetCategory,
  cleanBudgetLineUpdate,
  cleanCustomBudgetLine,
  cleanEventFields,
  cleanGlobalCharity,
  fraternalYearBounds,
  groupBudgetByCategory,
  mergeBudgetSeeds,
  planBudgetPrePopulation,
  planEventCopy,
  previousFraternalYear,
  SecurityPrivilegeError,
  upcomingFraternalYear,
  type BudgetActuals,
  type CouncilBudgetCategory,
  type CouncilBudgetForecast,
  type DataService,
  type Event,
  type MemberWriteActor,
} from '@kofc/shared';
import { MemoryDataService } from '../apps/web/services/drivers/memory';
import { drivers, expectRule, MEMBER, NOW, type DriverUnderTest } from './helpers';
import { openDatabases } from './shims/expo-sqlite';

// Dev seed: council 1 is 15295 (Super Admin 1, Admin 2 who is also Financial Secretary, Member 3); council 2 exists.
// Seed.sql gives council 1 (only) its six budget categories.
const OWN = 1;
const OTHER = 2;
// The tests run on 2026-09-20 (NOW): 2027-2028 has not opened yet, so the data layer accepts writes to it, and
// 2026-2027 was Finalized on July 1, 2026.
const TARGET = '2027-2028';
const SOURCE = '2026-2027';
const SEEDED_CATEGORIES = [
  'Father George Wolf Memorial Fund',
  'Sister Rita Rose Vistica Parish Community Fund',
  'Cathedral School & Student Support',
  'Other Donations & Projects',
  'Council Maintenance & State/Supreme Programs',
  'Blessed Michael McGivney Fraternal Activities Fund',
];

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
  BudgetCategoryID: null,
  ...over,
});

const noActuals = (over: Partial<BudgetActuals> = {}): BudgetActuals => ({
  annualEvents: [],
  eventExpenses: [],
  annualCharityChecks: [],
  meetingCount: 0,
  meetingExpenses: [],
  priorLines: [],
  ...over,
});

const seedShape = ({ CategoryType, ReferenceSourceID, LineItemName, PrePopulatedAmount, ApprovedBudgetAmount, BudgetCategoryID }: CouncilBudgetForecast) => ({
  CategoryType,
  ReferenceSourceID: ReferenceSourceID ?? null,
  LineItemName,
  PrePopulatedAmount,
  ApprovedBudgetAmount,
  BudgetCategoryID: BudgetCategoryID ?? null,
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

const categoryId = async (db: DataService, name: string) =>
  (await db.budget.listAnnualForecast(MEMBER.admin, OWN, TARGET)).categories.find((c) => c.CategoryName === name)!.id;

describe('budget helpers (pure)', () => {
  it('validates fraternal year labels and derives the previous year and its July-June bounds', () => {
    expect(assertFraternalYear(' 2027-2028 ')).toBe('2027-2028');
    for (const bad of ['2027-2029', '2027/2028', '27-28', 2027, '1700-1701']) {
      expect(() => assertFraternalYear(bad)).toThrow(/consecutive years/);
    }
    expect(previousFraternalYear('2027-2028')).toBe('2026-2027');
    expect(fraternalYearBounds('2026-2027')).toEqual({ fromDate: '2026-07-01', toDate: '2027-06-30' });
  });

  it('cleans custom lines, line updates and budget categories', () => {
    expect(cleanCustomBudgetLine({ FraternalYear: TARGET, LineItemName: '  Office   supplies ', Notes: ' ' })).toEqual({
      FraternalYear: TARGET,
      LineItemName: 'Office supplies',
      ApprovedBudgetAmount: 0,
      Notes: null,
      BudgetCategoryID: null,
    });
    expect(cleanCustomBudgetLine({ FraternalYear: TARGET, LineItemName: 'x', BudgetCategoryID: 4 }).BudgetCategoryID).toBe(4);
    expect(() => cleanCustomBudgetLine({ FraternalYear: TARGET, LineItemName: 'x', BudgetCategoryID: 'Wolf' as never })).toThrow(/record id/);
    expect(() => cleanCustomBudgetLine({ FraternalYear: TARGET, LineItemName: 'x', CategoryType: 'Event' } as never)).toThrow(/no field "CategoryType"/);
    expect(() => cleanCustomBudgetLine({ FraternalYear: TARGET, LineItemName: ' ' })).toThrow(/Line item name is required/);
    expect(() => cleanCustomBudgetLine({ FraternalYear: TARGET, LineItemName: 'x', ApprovedBudgetAmount: 1.005 })).toThrow(/two decimal/);
    expect(cleanBudgetLineUpdate(250, undefined)).toEqual({ ApprovedBudgetAmount: 250 });
    expect(cleanBudgetLineUpdate(250, null)).toEqual({ ApprovedBudgetAmount: 250, Notes: null });
    expect(cleanBudgetLineUpdate(0, ' Board vote ')).toEqual({ ApprovedBudgetAmount: 0, Notes: 'Board vote' });
    expect(() => cleanBudgetLineUpdate(-1, undefined)).toThrow(/0 or more/);
    expect(() => cleanBudgetLineUpdate(1, 'x'.repeat(2001))).toThrow(/at most 2000/);
    expect(cleanBudgetCategory({ CategoryName: '  Building   Fund ' })).toEqual({ CategoryName: 'Building Fund' });
    expect(() => cleanBudgetCategory({ CategoryName: ' ' })).toThrow(/Budget category is required/);
    expect(() => cleanBudgetCategory({ CategoryName: 'x', Color: 'red' } as never)).toThrow(/no field "Color"/);
  });

  it('plans one line per annual event and annual charity plus the meetings line, summed to the cent and ordered', () => {
    const seeds = planBudgetPrePopulation(
      noActuals({
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
      }),
    );
    expect(seeds).toEqual([
      { CategoryType: 'Event', ReferenceSourceID: 4, LineItemName: 'Fish Fry', PrePopulatedAmount: 50, BudgetCategoryID: null },
      { CategoryType: 'Event', ReferenceSourceID: 7, LineItemName: 'Tootsie Roll Drive', PrePopulatedAmount: 100.3, BudgetCategoryID: null },
      { CategoryType: 'Donation', ReferenceSourceID: 9, LineItemName: 'Food Bank', PrePopulatedAmount: 100, BudgetCategoryID: null },
      { CategoryType: 'Donation', ReferenceSourceID: 3, LineItemName: 'Pregnancy Center', PrePopulatedAmount: 500, BudgetCategoryID: null },
      { CategoryType: 'Operational', ReferenceSourceID: null, LineItemName: BUDGET_MEETINGS_LINE_NAME, PrePopulatedAmount: 12.34, BudgetCategoryID: null },
    ]);
    expect(planBudgetPrePopulation(noActuals())).toEqual([]);
  });

  it("carries last year's custom lines forward once each at 0.00, and every line's category to the line that continues it", () => {
    const seeds = planBudgetPrePopulation(
      noActuals({
        annualEvents: [{ id: 40, EventName: 'Fish Fry', Spend: 300 }],
        annualCharityChecks: [{ CharityID: 3, Name: 'Pregnancy Center', Amount: 250 }],
        priorLines: [
          { CategoryType: 'Event', ReferenceSourceID: 12, LineItemName: 'fish  FRY', BudgetCategoryID: 6 },
          { CategoryType: 'Donation', ReferenceSourceID: 3, LineItemName: 'Old charity name', BudgetCategoryID: 2 },
          { CategoryType: 'Operational', ReferenceSourceID: null, LineItemName: 'Bulletin Ads', BudgetCategoryID: 5 },
          { CategoryType: 'Operational', ReferenceSourceID: null, LineItemName: 'Bank Fees', BudgetCategoryID: null },
          { CategoryType: 'Operational', ReferenceSourceID: null, LineItemName: 'bank  FEES', BudgetCategoryID: 5 },
          { CategoryType: 'Operational', ReferenceSourceID: null, LineItemName: 'Council Meetings', BudgetCategoryID: 5 },
        ],
      }),
    );
    expect(seeds).toEqual([
      { CategoryType: 'Event', ReferenceSourceID: 40, LineItemName: 'Fish Fry', PrePopulatedAmount: 300, BudgetCategoryID: 6 },
      { CategoryType: 'Donation', ReferenceSourceID: 3, LineItemName: 'Pregnancy Center', PrePopulatedAmount: 250, BudgetCategoryID: 2 },
      { CategoryType: 'Operational', ReferenceSourceID: null, LineItemName: 'Bank Fees', PrePopulatedAmount: 0, BudgetCategoryID: null },
      { CategoryType: 'Operational', ReferenceSourceID: null, LineItemName: 'Bulletin Ads', PrePopulatedAmount: 0, BudgetCategoryID: 5 },
    ]);
  });

  it('merges seeds onto existing lines by source, or by name for unsourced lines, never touching approved figures or categories', () => {
    const existing = [
      line(1, { CategoryType: 'Event', ReferenceSourceID: 4, LineItemName: 'Old Fish Fry', ApprovedBudgetAmount: 900, BudgetCategoryID: 6 }),
      line(2, { LineItemName: 'council  MEETINGS', ApprovedBudgetAmount: 40 }),
    ];
    const plan = mergeBudgetSeeds(existing, [
      { CategoryType: 'Event', ReferenceSourceID: 4, LineItemName: 'Fish Fry', PrePopulatedAmount: 50, BudgetCategoryID: 1 },
      { CategoryType: 'Donation', ReferenceSourceID: 4, LineItemName: 'Food Bank', PrePopulatedAmount: 100, BudgetCategoryID: null },
      { CategoryType: 'Operational', ReferenceSourceID: null, LineItemName: 'Council Meetings', PrePopulatedAmount: 12, BudgetCategoryID: null },
    ]);
    expect(plan.updates).toEqual([
      { id: 1, LineItemName: 'Fish Fry', PrePopulatedAmount: 50 },
      { id: 2, LineItemName: 'council  MEETINGS', PrePopulatedAmount: 12 },
    ]);
    expect(plan.inserts).toEqual([{ CategoryType: 'Donation', ReferenceSourceID: 4, LineItemName: 'Food Bank', PrePopulatedAmount: 100, BudgetCategoryID: null }]);
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

  it('locks a Finalized year against every write but an Active Super Admin override (Sprint 5Y-3)', () => {
    const finalized = (a: MemberWriteActor, options?: { superAdminOverride?: boolean }) => {
      try {
        assertBudgetYearWritable(SOURCE, NOW, a, options);
        return 'open';
      } catch (e) {
        return (e as { code: string }).code;
      }
    };
    const superAdmin = actor({ memberType: 'Super Admin' });
    expect(finalized(actor({ memberType: 'Admin' }))).toBe('BUDGET_YEAR_FINALIZED');
    expect(finalized(actor({ memberType: 'Admin' }), { superAdminOverride: true })).toBe('BUDGET_YEAR_FINALIZED');
    expect(finalized(superAdmin)).toBe('BUDGET_YEAR_FINALIZED');
    expect(finalized(actor({ memberType: 'Super Admin', active: false }), { superAdminOverride: true })).toBe('BUDGET_YEAR_FINALIZED');
    expect(finalized(superAdmin, { superAdminOverride: true })).toBe('open');
    expect(() => assertBudgetYearWritable(TARGET, NOW, actor())).not.toThrow();
    expect(() => assertBudgetYearWritable(TARGET, new Date(2027, 5, 15), actor())).not.toThrow();
    expect(() => assertBudgetYearWritable(TARGET, new Date(2027, 6, 1), actor())).toThrow(/locked as Finalized on July 1, 2027/);
  });

  it("groups lines under the council's own categories in order, then an Uncategorized group", () => {
    const categories: CouncilBudgetCategory[] = [
      { id: 7, CouncilID: OWN, CategoryName: 'Building Fund' },
      { id: 3, CouncilID: OWN, CategoryName: 'Charity' },
    ];
    const groups = groupBudgetByCategory(
      [
        line(1, { LineItemName: 'Roof', PrePopulatedAmount: 10.1, ApprovedBudgetAmount: 12, BudgetCategoryID: 7 }),
        line(2, { LineItemName: 'Bank Fees', PrePopulatedAmount: 0.2, ApprovedBudgetAmount: 100 }),
        line(3, { LineItemName: 'Boiler', PrePopulatedAmount: 0.2, ApprovedBudgetAmount: 0.1, BudgetCategoryID: 7 }),
        line(4, { LineItemName: 'Stray', BudgetCategoryID: 99 }),
      ],
      categories,
    );
    expect(groups.map((g) => [g.label, g.lines.map((l) => l.id), g.prePopulatedTotal, g.approvedTotal])).toEqual([
      ['Building Fund', [3, 1], 10.3, 12.1],
      ['Charity', [], 0, 0],
      ['Uncategorized', [2, 4], 0.2, 100],
    ]);
    expect(groupBudgetByCategory([line(1, { BudgetCategoryID: 7 })], categories).map((g) => g.label)).toEqual(['Building Fund', 'Charity']);
  });

  it('lets every active council member read the budget, and leadership or the Designated Budget Director change it', () => {
    const outcome = (check: (a: MemberWriteActor, councilId: number) => void) => (a: MemberWriteActor, councilId = OWN) => {
      try {
        check(a, councilId);
        return true;
      } catch (e) {
        expect(e).toBeInstanceOf(SecurityPrivilegeError);
        return false;
      }
    };
    const edit = outcome((a, c) => assertMayManageBudgetForecast(a, c, 'change the budget'));
    const view = outcome((a, c) => assertMayViewBudgetForecast(a, c, 'read the budget'));
    expect(edit(actor())).toBe(false);
    expect(edit(actor({ roles: ['Grand Knight'] }))).toBe(false);
    expect(edit(actor({ roles: ['Treasurer'] }))).toBe(true);
    expect(edit(actor({ roles: ['Financial Secretary'] }))).toBe(true);
    expect(edit(actor({ roles: ['Treasurer'], active: false }))).toBe(false);
    expect(edit(actor({ memberType: 'Admin' }))).toBe(true);
    expect(edit(actor({ memberType: 'Admin' }), OTHER)).toBe(false);
    expect(edit(actor({ memberType: 'Super Admin', councilId: OTHER }))).toBe(true);
    expect(edit(actor({ budgetDirector: true }))).toBe(true);
    expect(edit(actor({ budgetDirector: true }), OTHER)).toBe(false);
    expect(edit(actor({ budgetDirector: true, active: false }))).toBe(false);

    expect(view(actor())).toBe(true);
    expect(view(actor(), OTHER)).toBe(false);
    expect(view(actor({ active: false }))).toBe(false);
    expect(view(actor({ memberType: 'Admin' }), OTHER)).toBe(false);
    expect(view(actor({ memberType: 'Super Admin', councilId: OTHER }))).toBe(true);
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
     * Last fraternal year (2026-2027) for council 1, with noise that must not count: another council's annual event
     * and charity check, a non-annual event and charity, an annual event from the following year, and a Draft sheet.
     */
    async function withHistory() {
      const db = await d.make();
      const category = (await db.lookups.list('Category'))[0].id;
      const event = (name: string, date: string, over: Partial<Event> = {}, councils = [OWN]) =>
        db.events.create(
          { EventName: name, EventDescription: 'Fixture', OwnerID: MEMBER.superAdmin, StartDate: date, EndDate: date, Location: 'Hall', CategoryID: category, ...over },
          councils,
        );
      const fishFry = await event('Fish Fry', '2027-03-06', { IsAnnual: 1, Spend: 300 });
      const tootsie = await event('Tootsie Roll Drive', '2026-10-04', { IsAnnual: 1 });
      await event('Council Picnic', '2026-08-02', { Spend: 999 }); // not annual
      await event('Next Fish Fry', '2027-09-01', { IsAnnual: 1, Spend: 999 }); // the following fraternal year
      await event('Neighbour Fish Fry', '2027-03-06', { IsAnnual: 1, Spend: 999 }, [OTHER]);
      expect(fishFry.IsAnnual).toBe(1);

      const report = (eventId: number | null, meetingId: number | null, amount: number, status = 'Approved', councilId = OWN) => {
        const id = raw(d, db, 'ExpenseReport', {
          CouncilID: councilId,
          SubmitterMemberID: MEMBER.member,
          Status: status,
          LinkedEventID: eventId,
          LinkedMeetingID: meetingId,
        });
        raw(d, db, 'ExpenseLineItem', { ExpenseReportID: id, DateOfExpense: '2027-03-01', Amount: amount, VendorName: 'Costco', ExpenseDescription: 'Supplies' });
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
        Date: '2027-03-12',
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
      check(OWN, annual.id, 250, '2026-12-15', '3001');
      check(OWN, annual.id, 250.5, '2027-06-30', '3002');
      check(OWN, annual.id, 999, '2027-07-01', '3003'); // the following fraternal year
      check(OWN, oneOff.id, 999, '2027-01-10', '3004');
      check(OTHER, annual.id, 999, '2027-01-10', '9001');
      return { db, fishFry, tootsie, annual };
    }

    it("seeds next year from last year's annual events, annual charity checks and meeting expenses of the council only", async () => {
      const { db, fishFry, tootsie, annual } = await withHistory();
      const result = await db.budget.prePopulateNextYear(MEMBER.admin, OWN, TARGET);
      expect(result).toMatchObject({ fraternalYear: TARGET, sourceFraternalYear: SOURCE, created: 4, refreshed: 0 });
      expect(result.lines.every((l) => l.CouncilID === OWN && l.FraternalYear === TARGET)).toBe(true);
      expect(result.lines.map(seedShape)).toEqual([
        { CategoryType: 'Event', ReferenceSourceID: fishFry.id, LineItemName: 'Fish Fry', PrePopulatedAmount: 470.25, ApprovedBudgetAmount: 0, BudgetCategoryID: null },
        { CategoryType: 'Event', ReferenceSourceID: tootsie.id, LineItemName: 'Tootsie Roll Drive', PrePopulatedAmount: 80, ApprovedBudgetAmount: 0, BudgetCategoryID: null },
        { CategoryType: 'Donation', ReferenceSourceID: annual.id, LineItemName: 'Salem Pregnancy Center', PrePopulatedAmount: 500.5, ApprovedBudgetAmount: 0, BudgetCategoryID: null },
        { CategoryType: 'Operational', ReferenceSourceID: null, LineItemName: BUDGET_MEETINGS_LINE_NAME, PrePopulatedAmount: 35.5, ApprovedBudgetAmount: 0, BudgetCategoryID: null },
      ]);
      const other = await db.budget.listAnnualForecast(MEMBER.superAdmin, OTHER, TARGET);
      expect(other).toMatchObject({ councilId: OTHER, fraternalYear: TARGET, window: 'Not Yet Open', categories: [], lines: [] });
      expect((await db.budget.listAnnualForecast(MEMBER.admin, OWN, SOURCE)).lines).toEqual([]);
    });

    it('re-runs safely: refreshes pre-populated figures and renamed sources, keeps approved figures, notes and categories', async () => {
      const { db, fishFry } = await withHistory();
      const first = await db.budget.prePopulateNextYear(MEMBER.admin, OWN, TARGET);
      const fishLine = first.lines.find((l) => l.ReferenceSourceID === fishFry.id)!;
      const fund = await categoryId(db, 'Blessed Michael McGivney Fraternal Activities Fund');
      await db.budget.updateLineItemBudget(MEMBER.admin, fishLine.id, 500, 'Add a second fryer', { budgetCategoryId: fund });
      await db.events.update(fishFry.id, { EventName: 'Lenten Fish Fry', Spend: 400 });

      const again = await db.budget.prePopulateNextYear(MEMBER.admin, OWN, TARGET);
      expect(again).toMatchObject({ created: 0, refreshed: 4 });
      expect(again.lines).toHaveLength(4);
      expect(again.lines.find((l) => l.id === fishLine.id)).toMatchObject({
        LineItemName: 'Lenten Fish Fry',
        PrePopulatedAmount: 570.25,
        ApprovedBudgetAmount: 500,
        Notes: 'Add a second fryer',
        BudgetCategoryID: fund,
      });
      expect(d.count(db, 'CouncilBudgetForecast')).toBe(4);
    });

    it('lists council 15295\'s six seeded categories, and files lines only under the council\'s own categories', async () => {
      const db = await d.make();
      const forecast = await db.budget.listAnnualForecast(MEMBER.member, OWN, TARGET);
      expect(forecast.categories.map((c) => c.CategoryName)).toEqual(SEEDED_CATEGORIES);
      expect(forecast.categories.every((c) => c.CouncilID === OWN)).toBe(true);
      const maintenance = await categoryId(db, 'Council Maintenance & State/Supreme Programs');

      const [foreign] = await db.lookups.saveCouncilSpecific(MEMBER.superAdmin, OTHER, 'CouncilBudgetCategory', [{ CategoryName: 'Hall Fund' }]);
      await expectRule(
        db.lookups.saveCouncilSpecific(MEMBER.admin, OWN, 'CouncilBudgetCategory', [{ CategoryName: 'other donations  & PROJECTS' }]),
        'INVALID_INPUT',
      );

      const custom = await db.budget.addCustomBudgetLine(MEMBER.admin, OWN, { FraternalYear: TARGET, LineItemName: 'Bank Fees', BudgetCategoryID: maintenance });
      expect(custom.BudgetCategoryID).toBe(maintenance);
      await expectRule(db.budget.addCustomBudgetLine(MEMBER.admin, OWN, { FraternalYear: TARGET, LineItemName: 'Ads', BudgetCategoryID: foreign.id }), 'INVALID_INPUT');
      await expectRule(db.budget.updateLineItemBudget(MEMBER.admin, custom.id, 10, undefined, { budgetCategoryId: foreign.id }), 'INVALID_INPUT');
      expect(await db.budget.updateLineItemBudget(MEMBER.admin, custom.id, 10, undefined, { budgetCategoryId: null })).toMatchObject({ BudgetCategoryID: null });
      await db.budget.updateLineItemBudget(MEMBER.admin, custom.id, 10, undefined, { budgetCategoryId: maintenance });
      // A category in use cannot be deleted (no cascades); an unused one can.
      await expectRule(db.lookups.removeCouncilSpecific(MEMBER.admin, OWN, 'CouncilBudgetCategory', maintenance), 'RECORD_IN_USE');
      await db.lookups.removeCouncilSpecific(MEMBER.superAdmin, OTHER, 'CouncilBudgetCategory', foreign.id);
      // Finance officers keep the categories, like the donation lookups; plain members do not.
      await expectPrivilege(db.lookups.saveCouncilSpecific(MEMBER.member, OWN, 'CouncilBudgetCategory', [{ CategoryName: 'Snacks' }]), 'ADMIN_REQUIRED');
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
        BudgetCategoryID: null,
      });
      const dup = await expectRule(db.budget.addCustomBudgetLine(MEMBER.admin, OWN, { FraternalYear: TARGET, LineItemName: ' LIABILITY  insurance' }), 'BUDGET_LINE_EXISTS');
      expect(dup.details.lineId).toBe(custom.id);
      // Another year, or another council, is a different budget.
      await db.budget.addCustomBudgetLine(MEMBER.admin, OWN, { FraternalYear: '2028-2029', LineItemName: 'Liability insurance' });
      await db.budget.addCustomBudgetLine(MEMBER.superAdmin, OTHER, { FraternalYear: TARGET, LineItemName: 'Liability insurance' });

      expect(await db.budget.updateLineItemBudget(MEMBER.admin, custom.id, 1350.75)).toMatchObject({ ApprovedBudgetAmount: 1350.75, Notes: 'Renews in October' });
      expect(await db.budget.updateLineItemBudget(MEMBER.admin, custom.id, 1350.75, null)).toMatchObject({ Notes: null });
      await expectRule(db.budget.updateLineItemBudget(MEMBER.admin, custom.id, -5), 'INVALID_INPUT');
      await expectRule(db.budget.updateLineItemBudget(MEMBER.admin, 999_999, 5), 'RECORD_NOT_FOUND');
      await expectRule(db.budget.listAnnualForecast(MEMBER.admin, OWN, '2026'), 'INVALID_INPUT');
      await expectRule(db.budget.prePopulateNextYear(MEMBER.superAdmin, 999, TARGET), 'INVALID_INPUT');
    });

    it('refuses every write to a Finalized year with BUDGET_YEAR_FINALIZED unless a Super Admin overrides it (Sprint 5Y-3)', async () => {
      const db = await d.make();
      // Only the Super Admin's override can still add to 2026-2027, finalized on July 1, 2026.
      await expectRule(db.budget.addCustomBudgetLine(MEMBER.admin, OWN, { FraternalYear: SOURCE, LineItemName: 'Bank Fees' }), 'BUDGET_YEAR_FINALIZED');
      await expectRule(db.budget.addCustomBudgetLine(MEMBER.admin, OWN, { FraternalYear: SOURCE, LineItemName: 'Bank Fees' }, { superAdminOverride: true }), 'BUDGET_YEAR_FINALIZED');
      await expectRule(db.budget.addCustomBudgetLine(MEMBER.superAdmin, OWN, { FraternalYear: SOURCE, LineItemName: 'Bank Fees' }), 'BUDGET_YEAR_FINALIZED');
      const locked = await db.budget.addCustomBudgetLine(MEMBER.superAdmin, OWN, { FraternalYear: SOURCE, LineItemName: 'Bank Fees', ApprovedBudgetAmount: 60 }, { superAdminOverride: true });

      await expectRule(db.budget.updateLineItemBudget(MEMBER.admin, locked.id, 75), 'BUDGET_YEAR_FINALIZED');
      await expectRule(db.budget.updateLineItemBudget(MEMBER.admin, locked.id, 75, null, { superAdminOverride: true }), 'BUDGET_YEAR_FINALIZED');
      await expectRule(db.budget.updateLineItemBudget(MEMBER.superAdmin, locked.id, 75), 'BUDGET_YEAR_FINALIZED');
      await expectRule(db.budget.prePopulateNextYear(MEMBER.admin, OWN, SOURCE), 'BUDGET_YEAR_FINALIZED');
      const listed = await db.budget.listAnnualForecast(MEMBER.admin, OWN, SOURCE);
      expect(listed.window).toBe('Finalized');
      expect(listed.lines.map((l) => l.ApprovedBudgetAmount)).toEqual([60]);

      expect(await db.budget.updateLineItemBudget(MEMBER.superAdmin, locked.id, 75, undefined, { superAdminOverride: true })).toMatchObject({ ApprovedBudgetAmount: 75 });
      expect((await db.budget.prePopulateNextYear(MEMBER.superAdmin, OWN, SOURCE, { superAdminOverride: true })).fraternalYear).toBe(SOURCE);
    });

    it("clones last year's custom lines, and their categories, into the new year at a 0.00 baseline, for that council only", async () => {
      const db = await d.make();
      const maintenance = await categoryId(db, 'Council Maintenance & State/Supreme Programs');
      const override = { superAdminOverride: true };
      await db.budget.addCustomBudgetLine(MEMBER.superAdmin, OWN, { FraternalYear: SOURCE, LineItemName: 'Bank Fees', ApprovedBudgetAmount: 60, Notes: 'Monthly service charge', BudgetCategoryID: maintenance }, override);
      await db.budget.addCustomBudgetLine(MEMBER.superAdmin, OWN, { FraternalYear: SOURCE, LineItemName: 'Bulletin Ads', ApprovedBudgetAmount: 400 }, override);
      await db.budget.addCustomBudgetLine(MEMBER.superAdmin, OTHER, { FraternalYear: SOURCE, LineItemName: 'Neighbour Dues', ApprovedBudgetAmount: 90 }, override);
      const result = await db.budget.prePopulateNextYear(MEMBER.admin, OWN, TARGET);
      const custom = result.lines.filter((l) => l.LineItemName !== BUDGET_MEETINGS_LINE_NAME);
      expect(custom.map(seedShape)).toEqual([
        { CategoryType: 'Operational', ReferenceSourceID: null, LineItemName: 'Bank Fees', PrePopulatedAmount: 0, ApprovedBudgetAmount: 0, BudgetCategoryID: maintenance },
        { CategoryType: 'Operational', ReferenceSourceID: null, LineItemName: 'Bulletin Ads', PrePopulatedAmount: 0, ApprovedBudgetAmount: 0, BudgetCategoryID: null },
      ]);
      expect(custom.map((l) => l.Notes ?? null)).toEqual([null, null]);
      // Running again adds nothing, and a line the officers already approved keeps its figure.
      await db.budget.updateLineItemBudget(MEMBER.admin, custom[0].id, 75);
      const again = await db.budget.prePopulateNextYear(MEMBER.admin, OWN, TARGET);
      expect(again.created).toBe(0);
      expect(again.lines.find((l) => l.id === custom[0].id)).toMatchObject({ PrePopulatedAmount: 0, ApprovedBudgetAmount: 75 });
    });

    it('opens the budget read-only to every member of the council and keeps other councils out (Sprint 5Y-3 transparency)', async () => {
      const db = await d.make();
      const line = await db.budget.addCustomBudgetLine(MEMBER.admin, OWN, { FraternalYear: TARGET, LineItemName: 'Office supplies', ApprovedBudgetAmount: 40 });
      const seen = await db.budget.listAnnualForecast(MEMBER.member, OWN, TARGET);
      expect(seen.lines.map((l) => [l.LineItemName, l.ApprovedBudgetAmount])).toEqual([['Office supplies', 40]]);
      await expectPrivilege(db.budget.updateLineItemBudget(MEMBER.member, line.id, 10), 'ADMIN_REQUIRED');
      await expectPrivilege(db.budget.addCustomBudgetLine(MEMBER.member, OWN, { FraternalYear: TARGET, LineItemName: 'Snacks' }), 'ADMIN_REQUIRED');
      await expectPrivilege(db.budget.prePopulateNextYear(MEMBER.member, OWN, TARGET), 'ADMIN_REQUIRED');

      const foreignAdmin = await addMember(db, OTHER, 'Admin', 'foreign.admin.budget@example.com');
      await expectPrivilege(db.budget.listAnnualForecast(foreignAdmin, OWN, TARGET), 'COUNCIL_ACCESS_DENIED');
      await expectPrivilege(db.budget.updateLineItemBudget(foreignAdmin, line.id, 10), 'COUNCIL_ACCESS_DENIED');
      await expectPrivilege(db.budget.prePopulateNextYear(foreignAdmin, OWN, TARGET), 'COUNCIL_ACCESS_DENIED');
      expect(d.count(db, 'CouncilBudgetForecast')).toBe(1);

      const treasurer = await addMember(db, OWN, 'Member', 'treasurer.budget@example.com');
      grantRole(d, db, treasurer, 'Treasurer');
      expect(await db.budget.updateLineItemBudget(treasurer, line.id, 75)).toMatchObject({ ApprovedBudgetAmount: 75 });
      await expectPrivilege(db.budget.listAnnualForecast(treasurer, OTHER, TARGET), 'COUNCIL_ACCESS_DENIED');
    });

    it('lets an Admin designate a Budget Director, who may then prepare the budget; members cannot designate themselves', async () => {
      const db = await d.make();
      const line = await db.budget.addCustomBudgetLine(MEMBER.admin, OWN, { FraternalYear: TARGET, LineItemName: 'Office supplies' });
      await expectPrivilege(db.members.update(MEMBER.member, MEMBER.member, { IsBudgetDirector: 1 }), 'ADMIN_REQUIRED');
      expect((await db.members.get(MEMBER.member))?.IsBudgetDirector).toBe(0);
      await expectPrivilege(db.budget.updateLineItemBudget(MEMBER.member, line.id, 10), 'ADMIN_REQUIRED');

      expect(await db.members.update(MEMBER.admin, MEMBER.member, { IsBudgetDirector: 1 })).toMatchObject({ IsBudgetDirector: 1 });
      expect((await db.auth.signIn('testmember@kofc.org', 'koc15295'))?.isBudgetDirector).toBe(true);
      expect((await db.auth.signIn('testadmin@kofc.org', 'koc15295'))?.isBudgetDirector).toBe(false);
      expect(await db.budget.updateLineItemBudget(MEMBER.member, line.id, 10)).toMatchObject({ ApprovedBudgetAmount: 10 });
      await db.budget.addCustomBudgetLine(MEMBER.member, OWN, { FraternalYear: TARGET, LineItemName: 'Snacks' });
      await db.budget.prePopulateNextYear(MEMBER.member, OWN, TARGET);
      // The delegation is for the director's own council, and it never lifts the July 1 lock.
      await expectPrivilege(db.budget.addCustomBudgetLine(MEMBER.member, OTHER, { FraternalYear: TARGET, LineItemName: 'Snacks' }), 'ADMIN_REQUIRED');
      await expectRule(db.budget.addCustomBudgetLine(MEMBER.member, OWN, { FraternalYear: SOURCE, LineItemName: 'Snacks' }, { superAdminOverride: true }), 'BUDGET_YEAR_FINALIZED');

      await db.members.update(MEMBER.admin, MEMBER.member, { IsBudgetDirector: 0 });
      await expectPrivilege(db.budget.updateLineItemBudget(MEMBER.member, line.id, 20), 'ADMIN_REQUIRED');
    });
  });
}
