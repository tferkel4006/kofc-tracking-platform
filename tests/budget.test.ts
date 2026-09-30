// Sprint 5Y: annual budget forecasting - Event.IsAnnual and GlobalCharityRegistry.IsAnnual, fraternal year labels,
// council-isolated CouncilBudgetForecast lines, custom Operational lines carried forward each year, and
// budget.prePopulateNextYear seeding next year's lines from last year's actual spend in one transaction.
// Sprint 5Y-3: council budget categories (CouncilBudgetCategory, a council lookup table), member transparency (every
// member reads the budget), the Designated Budget Director (Member.IsBudgetDirector) and the data layer's July 1 lock
// (BUDGET_YEAR_FINALIZED, lifted only by an Active Super Admin's override).
// Sprint 5Y-4: the Draft -> Proposed -> Approved lifecycle (budget.approveAndFinalizeEntireBudget freezes a year for good,
// BUDGET_YEAR_APPROVED), budget-versus-actual gauges (budget.getBudgetProgress) and year-over-year KPIs
// (budget.getHistoricalKPIs).
import { describe, expect, it } from 'vitest';
import {
  assertBudgetYearApprovable,
  assertBudgetYearNotApproved,
  assertBudgetYearWritable,
  assertFraternalYear,
  assertMayApproveBudget,
  assertMayManageBudgetForecast,
  assertMayReviewBudgetPerformance,
  assertMayViewBudgetForecast,
  attributeBudgetSpend,
  BUDGET_MEETINGS_LINE_NAME,
  BUDGET_WARNING_THRESHOLD_PERCENT,
  budgetAlertOf,
  budgetPercentUsed,
  budgetProgressThrough,
  budgetStatusOf,
  budgetWindowOf,
  buildBudgetYearPerformance,
  completedFraternalYears,
  currentFraternalYear,
  planBudgetApproval,
  summarizeBudgetHistory,
  type BudgetYearSpend,
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
import { SqliteDataService } from '../apps/mobile/services/drivers/sqlite';
import { drivers, expectRule, MEMBER, NOW, type DriverUnderTest } from './helpers';
import { openDatabases } from './shims/expo-sqlite';

// Dev seed: council 1 is 15295 (Super Admin 1, Admin 2 who is also Financial Secretary, Member 3); council 2 exists.
// Seed.sql gives council 1 (only) its six budget categories.
const OWN = 1;
const OTHER = 2;
// The driver tests run on May 15, 2027 (DRAFTING): 2027-2028 is open for drafting (May 1 - June 30, 2027), 2026-2027
// was Finalized on July 1, 2026, and 2028-2029 does not open until May 1, 2028. NOW (2026-09-20) is before 2027-2028 opens.
const TARGET = '2027-2028';
const SOURCE = '2026-2027';
const LATER = '2028-2029';
const DRAFTING = new Date(2027, 4, 15, 12, 0, 0);

/** A seeded data service whose clock reads `at` (default: inside the 2027-2028 drafting window). */
async function make(d: DriverUnderTest, at: Date = DRAFTING): Promise<DataService> {
  const now = () => new Date(at);
  if (d.name === 'sqlite') openDatabases.length = 0; // so `openDatabases.at(-1)` is this service's database
  const db = d.name === 'memory' ? new MemoryDataService({ now }) : new SqliteDataService({ now });
  await db.init();
  return db;
}
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
  ProposedBudgetAmount: 0,
  ApprovedBudgetAmount: 0,
  BudgetStatus: 'Draft',
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

const seedShape = ({ CategoryType, ReferenceSourceID, LineItemName, PrePopulatedAmount, ProposedBudgetAmount, ApprovedBudgetAmount, BudgetStatus, BudgetCategoryID }: CouncilBudgetForecast) => ({
  CategoryType,
  ReferenceSourceID: ReferenceSourceID ?? null,
  LineItemName,
  PrePopulatedAmount,
  ProposedBudgetAmount,
  ApprovedBudgetAmount,
  BudgetStatus,
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
      ProposedBudgetAmount: 0,
      Notes: null,
      BudgetCategoryID: null,
    });
    expect(cleanCustomBudgetLine({ FraternalYear: TARGET, LineItemName: 'x', BudgetCategoryID: 4 }).BudgetCategoryID).toBe(4);
    expect(() => cleanCustomBudgetLine({ FraternalYear: TARGET, LineItemName: 'x', BudgetCategoryID: 'Wolf' as never })).toThrow(/record id/);
    expect(() => cleanCustomBudgetLine({ FraternalYear: TARGET, LineItemName: 'x', CategoryType: 'Event' } as never)).toThrow(/no field "CategoryType"/);
    expect(() => cleanCustomBudgetLine({ FraternalYear: TARGET, LineItemName: ' ' })).toThrow(/Line item name is required/);
    expect(() => cleanCustomBudgetLine({ FraternalYear: TARGET, LineItemName: 'x', ProposedBudgetAmount: 1.005 })).toThrow(/two decimal/);
    // Sprint 5Y-4: only the council's approval sets the approved figure.
    expect(() => cleanCustomBudgetLine({ FraternalYear: TARGET, LineItemName: 'x', ApprovedBudgetAmount: 5 } as never)).toThrow(/no field "ApprovedBudgetAmount"/);
    expect(cleanBudgetLineUpdate(250, undefined)).toEqual({ ProposedBudgetAmount: 250, BudgetStatus: 'Proposed' });
    expect(cleanBudgetLineUpdate(250, null)).toEqual({ ProposedBudgetAmount: 250, BudgetStatus: 'Proposed', Notes: null });
    expect(cleanBudgetLineUpdate(0, ' Board vote ')).toEqual({ ProposedBudgetAmount: 0, BudgetStatus: 'Proposed', Notes: 'Board vote' });
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

  it("carries last year's custom lines forward once each at last year's approved cap (Sprint 5Y-6.5), and every line's category to the line that continues it", () => {
    const seeds = planBudgetPrePopulation(
      noActuals({
        annualEvents: [{ id: 40, EventName: 'Fish Fry', Spend: 300 }],
        annualCharityChecks: [{ CharityID: 3, Name: 'Pregnancy Center', Amount: 250 }],
        priorLines: [
          { CategoryType: 'Event', ReferenceSourceID: 12, LineItemName: 'fish  FRY', BudgetCategoryID: 6 },
          { CategoryType: 'Donation', ReferenceSourceID: 3, LineItemName: 'Old charity name', BudgetCategoryID: 2 },
          { CategoryType: 'Operational', ReferenceSourceID: null, LineItemName: 'Bulletin Ads', BudgetCategoryID: 5, ApprovedBudgetAmount: 480 },
          { CategoryType: 'Operational', ReferenceSourceID: null, LineItemName: 'Bank Fees', BudgetCategoryID: null, ApprovedBudgetAmount: 120.5 },
          { CategoryType: 'Operational', ReferenceSourceID: null, LineItemName: 'bank  FEES', BudgetCategoryID: 5, ApprovedBudgetAmount: 999 },
          { CategoryType: 'Operational', ReferenceSourceID: null, LineItemName: 'Council Meetings', BudgetCategoryID: 5 },
        ],
      }),
    );
    expect(seeds).toEqual([
      { CategoryType: 'Event', ReferenceSourceID: 40, LineItemName: 'Fish Fry', PrePopulatedAmount: 300, BudgetCategoryID: 6 },
      { CategoryType: 'Donation', ReferenceSourceID: 3, LineItemName: 'Pregnancy Center', PrePopulatedAmount: 250, BudgetCategoryID: 2 },
      { CategoryType: 'Operational', ReferenceSourceID: null, LineItemName: 'Bank Fees', PrePopulatedAmount: 120.5, BudgetCategoryID: null },
      { CategoryType: 'Operational', ReferenceSourceID: null, LineItemName: 'Bulletin Ads', PrePopulatedAmount: 480, BudgetCategoryID: 5 },
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

  it('opens a budget for drafting from May 1 00:00 to June 30 midnight, locks it as Finalized on July 1, and names the year to prepare next', () => {
    expect(budgetWindowOf('2027-2028', new Date(2027, 3, 30, 23, 59, 59))).toBe('Not Yet Open');
    expect(budgetWindowOf('2027-2028', new Date(2027, 4, 1, 0, 0, 0))).toBe('Draft');
    expect(budgetWindowOf('2027-2028', new Date(2027, 5, 1))).toBe('Draft');
    expect(budgetWindowOf('2027-2028', new Date(2027, 5, 30, 23, 59, 59))).toBe('Draft');
    expect(budgetWindowOf('2027-2028', new Date(2027, 6, 1, 0, 0, 0))).toBe('Finalized');
    expect(budgetWindowOf('2027-2028', new Date(2027, 5, 30, 23, 59))).toBe('Draft');
    expect(budgetWindowOf('2027-2028', new Date(2027, 6, 1))).toBe('Finalized');
    expect(budgetWindowOf('2026-2027', new Date(2026, 8, 20))).toBe('Finalized');
    expect(upcomingFraternalYear(new Date(2027, 5, 15))).toBe('2027-2028');
    expect(upcomingFraternalYear(new Date(2027, 0, 5))).toBe('2027-2028');
    expect(upcomingFraternalYear(new Date(2026, 8, 20))).toBe('2027-2028');
    expect(upcomingFraternalYear(new Date(2026, 6, 1))).toBe('2027-2028');
  });

  it('accepts writes only inside the May 1 - June 30 window, except with an Active Super Admin override (Sprint 5Y-3.5)', () => {
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
    const code = (today: Date, a: MemberWriteActor = actor(), options?: { superAdminOverride?: boolean }) => {
      try {
        assertBudgetYearWritable(TARGET, today, a, options);
        return 'open';
      } catch (e) {
        return (e as { code: string }).code;
      }
    };
    expect(code(NOW)).toBe('BUDGET_WINDOW_NOT_OPEN');
    expect(code(new Date(2027, 3, 30, 23, 59, 59))).toBe('BUDGET_WINDOW_NOT_OPEN');
    expect(code(new Date(2027, 3, 30), actor({ memberType: 'Admin' }), { superAdminOverride: true })).toBe('BUDGET_WINDOW_NOT_OPEN');
    expect(code(new Date(2027, 3, 30), superAdmin, { superAdminOverride: true })).toBe('open');
    expect(code(new Date(2027, 4, 1, 0, 0, 0))).toBe('open');
    expect(code(new Date(2027, 5, 30, 23, 59, 59))).toBe('open');
    expect(code(new Date(2027, 6, 1, 0, 0, 0))).toBe('BUDGET_YEAR_FINALIZED');
    expect(() => assertBudgetYearWritable(TARGET, new Date(2027, 3, 1), actor())).toThrow(/opens for drafting on May 1, 2027/);
    expect(() => assertBudgetYearWritable(TARGET, new Date(2027, 6, 1), actor())).toThrow(/locked as Finalized on July 1, 2027/);
  });

  it("groups lines under the council's own categories in order, then an Uncategorized group", () => {
    const categories: CouncilBudgetCategory[] = [
      { id: 7, CouncilID: OWN, CategoryName: 'Building Fund' },
      { id: 3, CouncilID: OWN, CategoryName: 'Charity' },
    ];
    const groups = groupBudgetByCategory(
      [
        line(1, { LineItemName: 'Roof', PrePopulatedAmount: 10.1, ProposedBudgetAmount: 13, ApprovedBudgetAmount: 12, BudgetCategoryID: 7 }),
        line(2, { LineItemName: 'Bank Fees', PrePopulatedAmount: 0.2, ProposedBudgetAmount: 90, ApprovedBudgetAmount: 100 }),
        line(3, { LineItemName: 'Boiler', PrePopulatedAmount: 0.2, ProposedBudgetAmount: 0.2, ApprovedBudgetAmount: 0.1, BudgetCategoryID: 7 }),
        line(4, { LineItemName: 'Stray', BudgetCategoryID: 99 }),
      ],
      categories,
    );
    expect(groups.map((g) => [g.label, g.lines.map((l) => l.id), g.prePopulatedTotal, g.proposedTotal, g.approvedTotal])).toEqual([
      ['Building Fund', [3, 1], 10.3, 13.2, 12.1],
      ['Charity', [], 0, 0, 0],
      ['Uncategorized', [2, 4], 0.2, 90, 100],
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

  it('walks a year through Draft, Proposed and Approved, and freezes it once approved with no override (Sprint 5Y-4)', () => {
    expect(budgetStatusOf([])).toBe('Draft');
    expect(budgetStatusOf([line(1), line(2)])).toBe('Draft');
    expect(budgetStatusOf([line(1), line(2, { BudgetStatus: 'Proposed' })])).toBe('Proposed');
    expect(budgetStatusOf([line(1, { BudgetStatus: 'Approved' })])).toBe('Approved');
    expect(planBudgetApproval([line(1, { ProposedBudgetAmount: 12.34 }), line(2)])).toEqual([
      { id: 1, ApprovedBudgetAmount: 12.34, BudgetStatus: 'Approved' },
      { id: 2, ApprovedBudgetAmount: 0, BudgetStatus: 'Approved' },
    ]);

    const code = (fn: () => void) => {
      try {
        fn();
        return 'ok';
      } catch (e) {
        return (e as { code: string }).code;
      }
    };
    const superAdmin = actor({ memberType: 'Super Admin' });
    const approved = [line(1, { BudgetStatus: 'Approved' })];
    expect(code(() => assertBudgetYearNotApproved(TARGET, [line(1, { BudgetStatus: 'Proposed' })]))).toBe('ok');
    expect(code(() => assertBudgetYearNotApproved(TARGET, approved))).toBe('BUDGET_YEAR_APPROVED');
    expect(() => assertBudgetYearNotApproved(TARGET, approved)).toThrow(/approved and finalized/);

    const proposed = [line(1, { BudgetStatus: 'Proposed' })];
    const june = new Date(2027, 5, 15);
    const july = new Date(2027, 6, 20);
    const april = new Date(2027, 3, 20);
    expect(code(() => assertBudgetYearApprovable(TARGET, proposed, june, actor()))).toBe('ok');
    // The July meeting's vote comes after the July 1 lock.
    expect(code(() => assertBudgetYearApprovable(TARGET, proposed, july, actor()))).toBe('ok');
    expect(code(() => assertBudgetYearApprovable(TARGET, approved, july, superAdmin, { superAdminOverride: true }))).toBe('BUDGET_YEAR_APPROVED');
    expect(code(() => assertBudgetYearApprovable(TARGET, [], june, actor()))).toBe('INVALID_INPUT');
    expect(code(() => assertBudgetYearApprovable(TARGET, proposed, april, actor()))).toBe('BUDGET_WINDOW_NOT_OPEN');
    expect(code(() => assertBudgetYearApprovable(TARGET, proposed, april, actor({ memberType: 'Admin' }), { superAdminOverride: true }))).toBe('BUDGET_WINDOW_NOT_OPEN');
    expect(code(() => assertBudgetYearApprovable(TARGET, proposed, april, superAdmin, { superAdminOverride: true }))).toBe('ok');
  });

  it('lets leadership approve and read budget performance, but not the Budget Director or plain members (Sprint 5Y-4)', () => {
    const allowed = (check: (a: MemberWriteActor, councilId: number) => void) => (a: MemberWriteActor, councilId = OWN) => {
      try {
        check(a, councilId);
        return true;
      } catch (e) {
        expect(e).toBeInstanceOf(SecurityPrivilegeError);
        return false;
      }
    };
    const approve = allowed((a, c) => assertMayApproveBudget(a, c, 'approve the budget'));
    const review = allowed((a, c) => assertMayReviewBudgetPerformance(a, c, 'review the budget'));
    // Sprint 5Z-2.5: the Grand Knight and Deputy Grand Knight read budget performance with the executive summaries, but
    // approving the budget stays with Admins and finance officers.
    for (const role of ['Grand Knight', 'Deputy Grand Knight']) {
      expect(approve(actor({ roles: [role] }))).toBe(false);
      expect(review(actor({ roles: [role] }))).toBe(true);
      expect(review(actor({ roles: [role] }), OTHER)).toBe(false);
      expect(review(actor({ roles: [role], active: false }))).toBe(false);
    }
    // Every seated officer (Role.Officer = 1) reads it too, still without approving.
    expect(review(actor({ roles: ['Recorder'], officer: true }))).toBe(true);
    expect(review(actor({ roles: ['Trustee 1'], officer: true }), OTHER)).toBe(false);
    expect(approve(actor({ roles: ['Recorder'], officer: true }))).toBe(false);
    for (const check of [approve, review]) {
      expect(check(actor())).toBe(false);
      expect(check(actor({ budgetDirector: true }))).toBe(false);
      expect(check(actor({ roles: ['Treasurer'] }))).toBe(true);
      expect(check(actor({ roles: ['Financial Secretary'] }))).toBe(true);
      expect(check(actor({ roles: ['Treasurer'] }), OTHER)).toBe(false);
      expect(check(actor({ memberType: 'Admin' }))).toBe(true);
      expect(check(actor({ memberType: 'Admin', active: false }))).toBe(false);
      expect(check(actor({ memberType: 'Super Admin', councilId: OTHER }))).toBe(true);
    }
  });

  it('flags spend from 85% of an approved cap, over it past 100%, and spend with no cap as unbudgeted', () => {
    expect(BUDGET_WARNING_THRESHOLD_PERCENT).toBe(85);
    expect(budgetPercentUsed(0, 50)).toBeNull();
    expect(budgetPercentUsed(300, 100)).toBe(33.3);
    expect(budgetAlertOf(0, 0)).toBe('None');
    expect(budgetAlertOf(0, 0.01)).toBe('Unbudgeted');
    expect(budgetAlertOf(100, 0)).toBe('On Track');
    expect(budgetAlertOf(100, 84.99)).toBe('On Track'); // shown as 85%, but not yet at the threshold
    expect(budgetPercentUsed(100, 84.99)).toBe(85);
    expect(budgetAlertOf(100, 85)).toBe('Warning');
    expect(budgetAlertOf(100, 100)).toBe('Warning');
    expect(budgetAlertOf(100, 100.01)).toBe('Over Budget');
    expect(currentFraternalYear(new Date(2027, 5, 30))).toBe('2026-2027');
    expect(currentFraternalYear(new Date(2027, 6, 1))).toBe('2027-2028');
    expect(currentFraternalYear(new Date(2026, 8, 28))).toBe('2026-2027');
    expect(budgetProgressThrough('2026-2027', new Date(2027, 2, 5))).toBe('2027-03-05');
    expect(budgetProgressThrough('2026-2027', new Date(2027, 8, 1))).toBe('2027-06-30');
    expect(completedFraternalYears(['2025-2026', '2027-2028', '2026-2027', '2025-2026'], new Date(2027, 6, 1))).toEqual(['2026-2027', '2025-2026']);
    expect(completedFraternalYears(['2026-2027'], new Date(2027, 5, 30))).toEqual([]);
  });

  it('charges each piece of spend to its budget line, and the rest as unbudgeted, then totals lines, categories and the year', () => {
    const lines = [
      line(1, { CategoryType: 'Event', ReferenceSourceID: 900, LineItemName: 'Fish Fry', ApprovedBudgetAmount: 400, BudgetCategoryID: 7, BudgetStatus: 'Approved' }),
      line(2, { CategoryType: 'Donation', ReferenceSourceID: 3, LineItemName: 'Food Bank', ApprovedBudgetAmount: 200, BudgetCategoryID: 7, BudgetStatus: 'Approved' }),
      line(3, { LineItemName: BUDGET_MEETINGS_LINE_NAME, ApprovedBudgetAmount: 100, BudgetStatus: 'Approved' }),
      line(4, { LineItemName: 'Bank Fees', ApprovedBudgetAmount: 60, BudgetStatus: 'Approved' }),
    ];
    const spend: BudgetYearSpend = {
      // This year's Fish Fry is a new Event row: matched by name, ignoring case and spacing.
      events: [
        { id: 41, EventName: 'fish  FRY', Spend: 300 },
        { id: 42, EventName: 'Picnic', Spend: 55.5 },
      ],
      expenses: [
        { EventID: 41, EventName: 'fish  FRY', MeetingID: null, Amount: 120.25 },
        { EventID: null, EventName: null, MeetingID: 8, Amount: 85 },
        { EventID: null, EventName: null, MeetingID: null, Amount: 10 },
      ],
      charityChecks: [
        { CharityID: 3, Amount: 150 },
        { CharityID: 99, Amount: 25 },
      ],
    };
    const { byLine, unbudgetedCents } = attributeBudgetSpend(lines, spend);
    expect([...byLine]).toEqual([
      [1, 42025],
      [2, 15000],
      [3, 8500],
      [4, 0],
    ]);
    expect(unbudgetedCents).toBe(9050);

    const categories: CouncilBudgetCategory[] = [{ id: 7, CouncilID: OWN, CategoryName: 'Programs' }];
    const year = buildBudgetYearPerformance({ councilId: OWN, fraternalYear: SOURCE, lines, categories, spend, throughDate: '2027-03-01' });
    expect(year).toMatchObject({
      status: 'Approved',
      fromDate: '2026-07-01',
      throughDate: '2027-03-01',
      complete: false,
      approvedTotal: 760,
      budgetedActual: 655.25,
      unbudgetedActual: 90.5,
      actualTotal: 745.75,
      variance: 14.25,
      utilizationPercent: 98.1,
      alert: 'Warning',
      linesWithinBudget: 3,
      linesOverBudget: 1,
    });
    expect(year.lines.map((l) => [l.line.id, l.actual, l.variance, l.percentUsed, l.alert])).toEqual([
      [1, 420.25, -20.25, 105.1, 'Over Budget'],
      [2, 150, 50, 75, 'On Track'],
      [4, 0, 60, 0, 'On Track'], // listAnnualForecast order: Bank Fees before Council Meetings
      [3, 85, 15, 85, 'Warning'],
    ]);
    expect(year.categories.map((c) => [c.label, c.lineCount, c.approved, c.actual, c.percentUsed, c.alert])).toEqual([
      ['Programs', 2, 600, 570.25, 95, 'Warning'],
      ['Uncategorized', 2, 160, 85, 53.1, 'On Track'],
    ]);
    expect(buildBudgetYearPerformance({ councilId: OWN, fraternalYear: SOURCE, lines, categories, spend, throughDate: '2027-06-30' }).complete).toBe(true);
  });

  it('scores the trailing fiscal efficiency over approved completed years only, newest first', () => {
    const perf = (fraternalYear: string, approvedTotal: number, actualTotal: number, status: 'Approved' | 'Proposed') => ({
      ...buildBudgetYearPerformance({ councilId: OWN, fraternalYear, lines: [], categories: [], spend: { events: [], expenses: [], charityChecks: [] }, throughDate: '2000-01-01' }),
      status,
      approvedTotal,
      actualTotal,
      alert: budgetAlertOf(approvedTotal, actualTotal),
    });
    const kpis = summarizeBudgetHistory(
      OWN,
      [perf('2024-2025', 1000, 1100, 'Approved'), perf('2026-2027', 2000, 1500, 'Approved'), perf('2025-2026', 0, 900, 'Proposed')],
      new Date(2027, 7, 1),
    );
    expect(kpis.asOf).toBe('2027-08-01');
    expect(kpis.years.map((y) => y.fraternalYear)).toEqual(['2026-2027', '2025-2026', '2024-2025']);
    expect(kpis.trailing).toEqual({
      years: 3,
      approvedYears: 2,
      approvedTotal: 3000,
      actualTotal: 2600,
      variance: 400,
      utilizationPercent: 86.7,
      alert: 'Warning',
      yearsWithinBudget: 1,
      yearsOverBudget: 1,
    });
    expect(summarizeBudgetHistory(OWN, [], new Date(2027, 7, 1)).trailing).toMatchObject({ years: 0, approvedTotal: 0, utilizationPercent: null, alert: 'None' });
  });
});

for (const d of drivers) {
  describe(`'${d.name}' driver: budget forecasting`, () => {
    /**
     * Last fraternal year (2026-2027) for council 1, with noise that must not count: another council's annual event
     * and charity check, a non-annual event and charity, an annual event from the following year, and a Draft sheet.
     */
    async function withHistory(at: Date = DRAFTING) {
      const db = await make(d, at);
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
      return { db, fishFry, tootsie, annual, oneOff };
    }

    /** A budget line inserted straight into the store (for years the service would no longer let anyone draft). */
    const budgetLine = (
      db: DataService,
      year: string,
      over: Partial<Record<'CategoryType' | 'LineItemName' | 'BudgetStatus', string>> & { ReferenceSourceID?: number | null; ProposedBudgetAmount?: number; BudgetCategoryID?: number | null; CouncilID?: number },
    ) =>
      raw(d, db, 'CouncilBudgetForecast', {
        CouncilID: OWN,
        FraternalYear: year,
        CategoryType: 'Operational',
        ReferenceSourceID: null,
        LineItemName: 'Line',
        PrePopulatedAmount: 0,
        ProposedBudgetAmount: 0,
        ApprovedBudgetAmount: 0,
        BudgetStatus: 'Proposed',
        BudgetCategoryID: null,
        ...over,
      });

    /** Council 1's 2026-2027 budget over withHistory's spend, proposed and not yet approved. */
    async function historyBudget(at: Date) {
      const history = await withHistory(at);
      const { db, annual } = history;
      const fund = await categoryId(db, 'Blessed Michael McGivney Fraternal Activities Fund');
      const donations = await categoryId(db, 'Other Donations & Projects');
      budgetLine(db, SOURCE, { CategoryType: 'Event', LineItemName: 'Fish Fry', ProposedBudgetAmount: 400, BudgetCategoryID: fund });
      budgetLine(db, SOURCE, { CategoryType: 'Event', LineItemName: 'Tootsie Roll Drive', ProposedBudgetAmount: 90, BudgetCategoryID: fund });
      budgetLine(db, SOURCE, { CategoryType: 'Donation', ReferenceSourceID: annual.id, LineItemName: 'Salem Pregnancy Center', ProposedBudgetAmount: 1000, BudgetCategoryID: donations });
      budgetLine(db, SOURCE, { LineItemName: BUDGET_MEETINGS_LINE_NAME, ProposedBudgetAmount: 50 });
      budgetLine(db, SOURCE, { LineItemName: 'Bank Fees', ProposedBudgetAmount: 60 });
      return { ...history, fund, donations };
    }

    it("seeds next year from last year's annual events, annual charity checks and meeting expenses of the council only", async () => {
      const { db, fishFry, tootsie, annual } = await withHistory();
      const result = await db.budget.prePopulateNextYear(MEMBER.admin, OWN, TARGET);
      expect(result).toMatchObject({ fraternalYear: TARGET, sourceFraternalYear: SOURCE, created: 4, refreshed: 0 });
      expect(result.lines.every((l) => l.CouncilID === OWN && l.FraternalYear === TARGET)).toBe(true);
      expect(result.lines.map(seedShape)).toEqual([
        { CategoryType: 'Event', ReferenceSourceID: fishFry.id, LineItemName: 'Fish Fry', PrePopulatedAmount: 470.25, ProposedBudgetAmount: 0, ApprovedBudgetAmount: 0, BudgetStatus: 'Draft', BudgetCategoryID: null },
        { CategoryType: 'Event', ReferenceSourceID: tootsie.id, LineItemName: 'Tootsie Roll Drive', PrePopulatedAmount: 80, ProposedBudgetAmount: 0, ApprovedBudgetAmount: 0, BudgetStatus: 'Draft', BudgetCategoryID: null },
        { CategoryType: 'Donation', ReferenceSourceID: annual.id, LineItemName: 'Salem Pregnancy Center', PrePopulatedAmount: 500.5, ProposedBudgetAmount: 0, ApprovedBudgetAmount: 0, BudgetStatus: 'Draft', BudgetCategoryID: null },
        { CategoryType: 'Operational', ReferenceSourceID: null, LineItemName: BUDGET_MEETINGS_LINE_NAME, PrePopulatedAmount: 35.5, ProposedBudgetAmount: 0, ApprovedBudgetAmount: 0, BudgetStatus: 'Draft', BudgetCategoryID: null },
      ]);
      const other = await db.budget.listAnnualForecast(MEMBER.superAdmin, OTHER, TARGET);
      expect(other).toMatchObject({ councilId: OTHER, fraternalYear: TARGET, window: 'Draft', categories: [], lines: [] });
      expect((await db.budget.listAnnualForecast(MEMBER.admin, OWN, SOURCE)).lines).toEqual([]);
    });

    it('re-runs safely: refreshes pre-populated figures and renamed sources, keeps proposed figures, notes and categories', async () => {
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
        ProposedBudgetAmount: 500,
        ApprovedBudgetAmount: 0,
        BudgetStatus: 'Proposed',
        Notes: 'Add a second fryer',
        BudgetCategoryID: fund,
      });
      expect(d.count(db, 'CouncilBudgetForecast')).toBe(4);
    });

    it('lists council 15295\'s six seeded categories, and files lines only under the council\'s own categories', async () => {
      const db = await make(d);
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

    it('lets leadership propose figures and notes, and add unique custom Operational lines as Proposed', async () => {
      const db = await make(d);
      const custom = await db.budget.addCustomBudgetLine(MEMBER.admin, OWN, {
        FraternalYear: TARGET,
        LineItemName: 'Liability insurance',
        ProposedBudgetAmount: 1200,
        Notes: 'Renews in October',
      });
      expect(custom).toMatchObject({
        CouncilID: OWN,
        FraternalYear: TARGET,
        CategoryType: 'Operational',
        ReferenceSourceID: null,
        LineItemName: 'Liability insurance',
        PrePopulatedAmount: 0,
        ProposedBudgetAmount: 1200,
        ApprovedBudgetAmount: 0,
        BudgetStatus: 'Proposed',
        Notes: 'Renews in October',
        BudgetCategoryID: null,
      });
      const dup = await expectRule(db.budget.addCustomBudgetLine(MEMBER.admin, OWN, { FraternalYear: TARGET, LineItemName: ' LIABILITY  insurance' }), 'BUDGET_LINE_EXISTS');
      expect(dup.details.lineId).toBe(custom.id);
      // Another year, or another council, is a different budget.
      await db.budget.addCustomBudgetLine(MEMBER.superAdmin, OWN, { FraternalYear: LATER, LineItemName: 'Liability insurance' }, { superAdminOverride: true });
      await db.budget.addCustomBudgetLine(MEMBER.superAdmin, OTHER, { FraternalYear: TARGET, LineItemName: 'Liability insurance' });

      expect(await db.budget.updateLineItemBudget(MEMBER.admin, custom.id, 1350.75)).toMatchObject({
        ProposedBudgetAmount: 1350.75,
        ApprovedBudgetAmount: 0,
        BudgetStatus: 'Proposed',
        Notes: 'Renews in October',
      });
      await expectRule(
        db.budget.addCustomBudgetLine(MEMBER.admin, OWN, { FraternalYear: TARGET, LineItemName: 'Ads', ApprovedBudgetAmount: 5 } as never),
        'INVALID_INPUT',
      );
      expect(await db.budget.updateLineItemBudget(MEMBER.admin, custom.id, 1350.75, null)).toMatchObject({ Notes: null });
      await expectRule(db.budget.updateLineItemBudget(MEMBER.admin, custom.id, -5), 'INVALID_INPUT');
      await expectRule(db.budget.updateLineItemBudget(MEMBER.admin, 999_999, 5), 'RECORD_NOT_FOUND');
      await expectRule(db.budget.listAnnualForecast(MEMBER.admin, OWN, '2026'), 'INVALID_INPUT');
      await expectRule(db.budget.prePopulateNextYear(MEMBER.superAdmin, 999, TARGET), 'INVALID_INPUT');
    });

    it('refuses every write to a Finalized year with BUDGET_YEAR_FINALIZED unless a Super Admin overrides it (Sprint 5Y-3)', async () => {
      const db = await make(d);
      // Only the Super Admin's override can still add to 2026-2027, finalized on July 1, 2026.
      await expectRule(db.budget.addCustomBudgetLine(MEMBER.admin, OWN, { FraternalYear: SOURCE, LineItemName: 'Bank Fees' }), 'BUDGET_YEAR_FINALIZED');
      await expectRule(db.budget.addCustomBudgetLine(MEMBER.admin, OWN, { FraternalYear: SOURCE, LineItemName: 'Bank Fees' }, { superAdminOverride: true }), 'BUDGET_YEAR_FINALIZED');
      await expectRule(db.budget.addCustomBudgetLine(MEMBER.superAdmin, OWN, { FraternalYear: SOURCE, LineItemName: 'Bank Fees' }), 'BUDGET_YEAR_FINALIZED');
      const locked = await db.budget.addCustomBudgetLine(MEMBER.superAdmin, OWN, { FraternalYear: SOURCE, LineItemName: 'Bank Fees', ProposedBudgetAmount: 60 }, { superAdminOverride: true });

      await expectRule(db.budget.updateLineItemBudget(MEMBER.admin, locked.id, 75), 'BUDGET_YEAR_FINALIZED');
      await expectRule(db.budget.updateLineItemBudget(MEMBER.admin, locked.id, 75, null, { superAdminOverride: true }), 'BUDGET_YEAR_FINALIZED');
      await expectRule(db.budget.updateLineItemBudget(MEMBER.superAdmin, locked.id, 75), 'BUDGET_YEAR_FINALIZED');
      await expectRule(db.budget.prePopulateNextYear(MEMBER.admin, OWN, SOURCE), 'BUDGET_YEAR_FINALIZED');
      const listed = await db.budget.listAnnualForecast(MEMBER.admin, OWN, SOURCE);
      expect(listed.window).toBe('Finalized');
      expect(listed.lines.map((l) => l.ProposedBudgetAmount)).toEqual([60]);

      expect(await db.budget.updateLineItemBudget(MEMBER.superAdmin, locked.id, 75, undefined, { superAdminOverride: true })).toMatchObject({ ProposedBudgetAmount: 75 });
      expect((await db.budget.prePopulateNextYear(MEMBER.superAdmin, OWN, SOURCE, { superAdminOverride: true })).fraternalYear).toBe(SOURCE);
    });

    it('refuses writes before a year\'s May 1 opening with BUDGET_WINDOW_NOT_OPEN unless a Super Admin overrides it (Sprint 5Y-3.5)', async () => {
      const db = await make(d);
      await expectRule(db.budget.addCustomBudgetLine(MEMBER.admin, OWN, { FraternalYear: LATER, LineItemName: 'Bank Fees' }), 'BUDGET_WINDOW_NOT_OPEN');
      await expectRule(db.budget.addCustomBudgetLine(MEMBER.admin, OWN, { FraternalYear: LATER, LineItemName: 'Bank Fees' }, { superAdminOverride: true }), 'BUDGET_WINDOW_NOT_OPEN');
      await expectRule(db.budget.prePopulateNextYear(MEMBER.admin, OWN, LATER), 'BUDGET_WINDOW_NOT_OPEN');
      const early = await db.budget.addCustomBudgetLine(MEMBER.superAdmin, OWN, { FraternalYear: LATER, LineItemName: 'Bank Fees' }, { superAdminOverride: true });
      await expectRule(db.budget.updateLineItemBudget(MEMBER.admin, early.id, 10), 'BUDGET_WINDOW_NOT_OPEN');
      expect((await db.budget.listAnnualForecast(MEMBER.member, OWN, LATER)).window).toBe('Not Yet Open');

      // On the real test clock (2026-09-20) even 2027-2028 has not opened yet.
      const september = await make(d, NOW);
      await expectRule(september.budget.addCustomBudgetLine(MEMBER.admin, OWN, { FraternalYear: TARGET, LineItemName: 'Bank Fees' }), 'BUDGET_WINDOW_NOT_OPEN');
      // June 30 at 23:59:59 is still open; July 1 at 00:00 is Finalized.
      const lastMinute = await make(d, new Date(2027, 5, 30, 23, 59, 59));
      await lastMinute.budget.addCustomBudgetLine(MEMBER.admin, OWN, { FraternalYear: TARGET, LineItemName: 'Bank Fees' });
      const julyFirst = await make(d, new Date(2027, 6, 1, 0, 0, 0));
      await expectRule(julyFirst.budget.addCustomBudgetLine(MEMBER.admin, OWN, { FraternalYear: TARGET, LineItemName: 'Bank Fees' }), 'BUDGET_YEAR_FINALIZED');
    });

    it("clones last year's custom lines, and their categories, into the new year at a 0.00 baseline, for that council only", async () => {
      const db = await make(d);
      const maintenance = await categoryId(db, 'Council Maintenance & State/Supreme Programs');
      const override = { superAdminOverride: true };
      await db.budget.addCustomBudgetLine(MEMBER.superAdmin, OWN, { FraternalYear: SOURCE, LineItemName: 'Bank Fees', ProposedBudgetAmount: 60, Notes: 'Monthly service charge', BudgetCategoryID: maintenance }, override);
      await db.budget.addCustomBudgetLine(MEMBER.superAdmin, OWN, { FraternalYear: SOURCE, LineItemName: 'Bulletin Ads', ProposedBudgetAmount: 400 }, override);
      await db.budget.addCustomBudgetLine(MEMBER.superAdmin, OTHER, { FraternalYear: SOURCE, LineItemName: 'Neighbour Dues', ProposedBudgetAmount: 90 }, override);
      const result = await db.budget.prePopulateNextYear(MEMBER.admin, OWN, TARGET);
      const custom = result.lines.filter((l) => l.LineItemName !== BUDGET_MEETINGS_LINE_NAME);
      expect(custom.map(seedShape)).toEqual([
        { CategoryType: 'Operational', ReferenceSourceID: null, LineItemName: 'Bank Fees', PrePopulatedAmount: 0, ProposedBudgetAmount: 0, ApprovedBudgetAmount: 0, BudgetStatus: 'Draft', BudgetCategoryID: maintenance },
        { CategoryType: 'Operational', ReferenceSourceID: null, LineItemName: 'Bulletin Ads', PrePopulatedAmount: 0, ProposedBudgetAmount: 0, ApprovedBudgetAmount: 0, BudgetStatus: 'Draft', BudgetCategoryID: null },
      ]);
      expect(custom.map((l) => l.Notes ?? null)).toEqual([null, null]);
      // Running again adds nothing, and a line the officers already proposed keeps its figure.
      await db.budget.updateLineItemBudget(MEMBER.admin, custom[0].id, 75);
      const again = await db.budget.prePopulateNextYear(MEMBER.admin, OWN, TARGET);
      expect(again.created).toBe(0);
      expect(again.lines.find((l) => l.id === custom[0].id)).toMatchObject({ PrePopulatedAmount: 0, ProposedBudgetAmount: 75, BudgetStatus: 'Proposed' });
    });

    it('opens the budget read-only to every member of the council and keeps other councils out (Sprint 5Y-3 transparency)', async () => {
      const db = await make(d);
      const line = await db.budget.addCustomBudgetLine(MEMBER.admin, OWN, { FraternalYear: TARGET, LineItemName: 'Office supplies', ProposedBudgetAmount: 40 });
      const seen = await db.budget.listAnnualForecast(MEMBER.member, OWN, TARGET);
      expect(seen.lines.map((l) => [l.LineItemName, l.ProposedBudgetAmount])).toEqual([['Office supplies', 40]]);
      expect(seen.status).toBe('Proposed');
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
      expect(await db.budget.updateLineItemBudget(treasurer, line.id, 75)).toMatchObject({ ProposedBudgetAmount: 75 });
      await expectPrivilege(db.budget.listAnnualForecast(treasurer, OTHER, TARGET), 'COUNCIL_ACCESS_DENIED');
    });

    it('approves and finalizes the whole year in one step, then freezes it for everyone (Sprint 5Y-4)', async () => {
      const db = await make(d);
      const custom = await db.budget.addCustomBudgetLine(MEMBER.admin, OWN, { FraternalYear: TARGET, LineItemName: 'Liability insurance', ProposedBudgetAmount: 1200 });
      expect((await db.budget.listAnnualForecast(MEMBER.member, OWN, TARGET)).status).toBe('Proposed');

      // The Budget Director and plain members prepare or read; they cannot record the vote.
      await db.members.update(MEMBER.admin, MEMBER.member, { IsBudgetDirector: 1 });
      await expectPrivilege(db.budget.approveAndFinalizeEntireBudget(MEMBER.member, OWN, TARGET), 'ADMIN_REQUIRED');
      const foreignAdmin = await addMember(db, OTHER, 'Admin', 'foreign.admin.vote@example.com');
      await expectPrivilege(db.budget.approveAndFinalizeEntireBudget(foreignAdmin, OWN, TARGET), 'COUNCIL_ACCESS_DENIED');
      await expectRule(db.budget.approveAndFinalizeEntireBudget(MEMBER.admin, OWN, '2027'), 'INVALID_INPUT');
      await expectRule(db.budget.approveAndFinalizeEntireBudget(MEMBER.admin, OWN, LATER), 'INVALID_INPUT'); // no lines to approve

      const approved = await db.budget.approveAndFinalizeEntireBudget(MEMBER.admin, OWN, TARGET);
      expect(approved).toMatchObject({ councilId: OWN, fraternalYear: TARGET, status: 'Approved', window: 'Draft' });
      expect(approved.lines.map((l) => [l.LineItemName, l.ProposedBudgetAmount, l.ApprovedBudgetAmount, l.BudgetStatus])).toEqual([['Liability insurance', 1200, 1200, 'Approved']]);
      expect((await db.budget.listAnnualForecast(MEMBER.member, OWN, TARGET)).status).toBe('Approved');

      // Frozen: every write rejects BUDGET_YEAR_APPROVED, even inside the drafting window and even a Super Admin's override.
      const override = { superAdminOverride: true };
      await expectRule(db.budget.updateLineItemBudget(MEMBER.admin, custom.id, 5), 'BUDGET_YEAR_APPROVED');
      await expectRule(db.budget.updateLineItemBudget(MEMBER.superAdmin, custom.id, 5, null, override), 'BUDGET_YEAR_APPROVED');
      await expectRule(db.budget.addCustomBudgetLine(MEMBER.superAdmin, OWN, { FraternalYear: TARGET, LineItemName: 'Snacks' }, override), 'BUDGET_YEAR_APPROVED');
      await expectRule(db.budget.prePopulateNextYear(MEMBER.superAdmin, OWN, TARGET, override), 'BUDGET_YEAR_APPROVED');
      await expectRule(db.budget.approveAndFinalizeEntireBudget(MEMBER.superAdmin, OWN, TARGET, override), 'BUDGET_YEAR_APPROVED');
      expect((await db.budget.listAnnualForecast(MEMBER.admin, OWN, TARGET)).lines.map((l) => l.ApprovedBudgetAmount)).toEqual([1200]);
      // Another council's same year is its own budget.
      await db.budget.addCustomBudgetLine(MEMBER.superAdmin, OTHER, { FraternalYear: TARGET, LineItemName: 'Snacks' });
    });

    it('records the vote after the July 1 lock, but not before a year opens unless a Super Admin overrides it (Sprint 5Y-4)', async () => {
      const july = await make(d, new Date(2027, 6, 12, 19, 0, 0));
      const line = budgetLine(july, TARGET, { LineItemName: 'Bank Fees', ProposedBudgetAmount: 60 });
      await expectRule(july.budget.updateLineItemBudget(MEMBER.admin, line, 70), 'BUDGET_YEAR_FINALIZED');
      const treasurer = await addMember(july, OWN, 'Member', 'treasurer.vote@example.com');
      grantRole(d, july, treasurer, 'Treasurer');
      expect((await july.budget.approveAndFinalizeEntireBudget(treasurer, OWN, TARGET)).lines).toMatchObject([{ ApprovedBudgetAmount: 60, BudgetStatus: 'Approved' }]);

      const db = await make(d);
      budgetLine(db, LATER, { LineItemName: 'Bank Fees', ProposedBudgetAmount: 60 });
      await expectRule(db.budget.approveAndFinalizeEntireBudget(MEMBER.admin, OWN, LATER), 'BUDGET_WINDOW_NOT_OPEN');
      await expectRule(db.budget.approveAndFinalizeEntireBudget(MEMBER.admin, OWN, LATER, { superAdminOverride: true }), 'BUDGET_WINDOW_NOT_OPEN');
      expect((await db.budget.approveAndFinalizeEntireBudget(MEMBER.superAdmin, OWN, LATER, { superAdminOverride: true })).status).toBe('Approved');
    });

    it("tracks the year's spend so far against each category's approved cap, counting what the monthly summaries count (Sprint 5Y-4)", async () => {
      const { db, fund, donations } = await historyBudget(DRAFTING);
      await db.budget.approveAndFinalizeEntireBudget(MEMBER.admin, OWN, SOURCE);
      // May 15, 2027: the June 30 charity check has not been paid yet.
      const progress = await db.budget.getBudgetProgress(MEMBER.admin, OWN, SOURCE);
      expect(progress).toMatchObject({
        councilId: OWN,
        fraternalYear: SOURCE,
        status: 'Approved',
        fromDate: '2026-07-01',
        throughDate: '2027-05-15',
        complete: false,
        approvedTotal: 1600,
        budgetedActual: 835.75,
        unbudgetedActual: 1998,
        actualTotal: 2833.75,
        alert: 'Over Budget',
      });
      expect(progress.lines.map((l) => [l.line.LineItemName, l.actual, l.alert])).toEqual([
        ['Fish Fry', 470.25, 'Over Budget'],
        ['Tootsie Roll Drive', 80, 'Warning'],
        ['Salem Pregnancy Center', 250, 'On Track'],
        ['Bank Fees', 0, 'On Track'],
        [BUDGET_MEETINGS_LINE_NAME, 35.5, 'On Track'],
      ]);
      const byCategory = new Map(progress.categories.map((c) => [c.categoryId, c]));
      expect(byCategory.get(fund)).toMatchObject({ approved: 490, actual: 550.25, percentUsed: 112.3, alert: 'Over Budget' });
      expect(byCategory.get(donations)).toMatchObject({ approved: 1000, actual: 250, percentUsed: 25, alert: 'On Track' });
      expect(byCategory.get(null)).toMatchObject({ label: 'Uncategorized', approved: 110, actual: 35.5 });
      expect(progress.categories).toHaveLength(SEEDED_CATEGORIES.length + 1);

      // The year's actual spend is the sum of its monthly executive summaries.
      let monthly = 0;
      for (let m = 0; m < 12; m += 1) {
        const month = new Date(2026, 6 + m, 1);
        monthly += Math.round((await db.reports.monthlySummary(OWN, month.getFullYear(), month.getMonth() + 1)).finances.spend * 100);
      }
      expect(monthly / 100).toBe(3084.25); // the full year, including the June 30 check

      // Before July 1 of a year nothing has been spent; and only leadership reads the gauges.
      expect((await db.budget.getBudgetProgress(MEMBER.admin, OWN, TARGET)).actualTotal).toBe(0);
      await expectPrivilege(db.budget.getBudgetProgress(MEMBER.member, OWN, SOURCE), 'ADMIN_REQUIRED');
      await db.members.update(MEMBER.admin, MEMBER.member, { IsBudgetDirector: 1 });
      await expectPrivilege(db.budget.getBudgetProgress(MEMBER.member, OWN, SOURCE), 'ADMIN_REQUIRED');
      await expectPrivilege(db.budget.getBudgetProgress(MEMBER.admin, OTHER, SOURCE), 'COUNCIL_ACCESS_DENIED');
      expect((await db.budget.getBudgetProgress(MEMBER.superAdmin, OTHER, SOURCE)).actualTotal).toBe(999 + 999);
    });

    it('reviews every completed year against its full-year spend, with a trailing fiscal efficiency scorecard (Sprint 5Y-4)', async () => {
      const { db } = await historyBudget(new Date(2027, 6, 15));
      await db.budget.approveAndFinalizeEntireBudget(MEMBER.admin, OWN, SOURCE);
      budgetLine(db, '2025-2026', { LineItemName: 'Bank Fees', ProposedBudgetAmount: 40 }); // proposed, never approved
      budgetLine(db, TARGET, { LineItemName: 'Bank Fees', ProposedBudgetAmount: 40 }); // under way: not history yet
      budgetLine(db, '2024-2025', { LineItemName: 'Hall Rent', ProposedBudgetAmount: 10, CouncilID: OTHER }); // another council

      const kpis = await db.budget.getHistoricalKPIs(MEMBER.admin, OWN);
      expect(kpis.asOf).toBe('2027-07-15');
      expect(kpis.years.map((y) => [y.fraternalYear, y.status, y.complete])).toEqual([
        [SOURCE, 'Approved', true],
        ['2025-2026', 'Proposed', true],
      ]);
      const [source] = kpis.years;
      expect(source).toMatchObject({
        throughDate: '2027-06-30',
        approvedTotal: 1600,
        budgetedActual: 1086.25,
        unbudgetedActual: 1998,
        actualTotal: 3084.25,
        variance: -1484.25,
        utilizationPercent: 192.8,
        linesWithinBudget: 4,
        linesOverBudget: 1,
      });
      expect(source.lines.find((l) => l.line.LineItemName === 'Salem Pregnancy Center')).toMatchObject({ actual: 500.5, alert: 'On Track' });
      expect(kpis.trailing).toMatchObject({ years: 2, approvedYears: 1, approvedTotal: 1600, actualTotal: 3084.25, utilizationPercent: 192.8, alert: 'Over Budget', yearsOverBudget: 1 });

      const treasurer = await addMember(db, OWN, 'Member', 'treasurer.history@example.com');
      grantRole(d, db, treasurer, 'Treasurer');
      expect((await db.budget.getHistoricalKPIs(treasurer, OWN)).years).toHaveLength(2);
      await expectPrivilege(db.budget.getHistoricalKPIs(MEMBER.member, OWN), 'ADMIN_REQUIRED');
      await expectPrivilege(db.budget.getHistoricalKPIs(treasurer, OTHER), 'COUNCIL_ACCESS_DENIED');
      expect((await db.budget.getHistoricalKPIs(MEMBER.superAdmin, OTHER)).years.map((y) => y.fraternalYear)).toEqual(['2024-2025']);
      await expectRule(db.budget.getHistoricalKPIs(MEMBER.superAdmin, 999), 'INVALID_INPUT');
    });

    it('lets an Admin designate a Budget Director, who may then prepare the budget; members cannot designate themselves', async () => {
      const db = await make(d);
      const line = await db.budget.addCustomBudgetLine(MEMBER.admin, OWN, { FraternalYear: TARGET, LineItemName: 'Office supplies' });
      await expectPrivilege(db.members.update(MEMBER.member, MEMBER.member, { IsBudgetDirector: 1 }), 'ADMIN_REQUIRED');
      expect((await db.members.get(MEMBER.member))?.IsBudgetDirector).toBe(0);
      await expectPrivilege(db.budget.updateLineItemBudget(MEMBER.member, line.id, 10), 'ADMIN_REQUIRED');

      expect(await db.members.update(MEMBER.admin, MEMBER.member, { IsBudgetDirector: 1 })).toMatchObject({ IsBudgetDirector: 1 });
      expect((await db.auth.signIn('testmember@kofc.org', 'koc15295'))?.isBudgetDirector).toBe(true);
      expect((await db.auth.signIn('testadmin@kofc.org', 'koc15295'))?.isBudgetDirector).toBe(false);
      expect(await db.budget.updateLineItemBudget(MEMBER.member, line.id, 10)).toMatchObject({ ProposedBudgetAmount: 10 });
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
