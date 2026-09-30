// Sprint 5Z-1: normalized charitable intake - council relationship types and mission areas, the Knight Shepherd's
// intake form (charities.submitCharitableRequest), the shared vetting queue and its triage (claim, note, advance) with
// independent vetting, and Seed.sql's presentation data loading cleanly into both drivers. Sprint 5Z-2: mission areas on
// the form, target budget lines, declines and the Faith-in-Action mission footprint.
import { describe, expect, it } from 'vitest';
import {
  assertIndependentVetter,
  assertMayVetCharitableRequests,
  buildMissionAreaFootprint,
  cleanCharitableRequest,
  planCharitableTriage,
  SecurityPrivilegeError,
  toTimestamp,
  type DataService,
  type MemberWriteActor,
  type NewCharitableRequest,
} from '@kofc/shared';
import { MemoryDataService } from '../apps/web/services/drivers/memory';
import { SqliteDataService } from '../apps/mobile/services/drivers/sqlite';
import { drivers, expectRule, MEMBER, NOW, type DriverUnderTest } from './helpers';
import { openDatabases } from './shims/expo-sqlite';

// Dev seed: council 1 is 15295 (Super Admin 1 who is Grand Knight, Admin 2 who is Financial Secretary, Member 3).
const OWN = 1;

const form = (over: Partial<NewCharitableRequest> = {}): NewCharitableRequest => ({
  OrganizationName: 'St. Jude Youth Ministry',
  AmountRequested: 800,
  ContactEmail: 'youth@example.org',
  RelationshipTypeID: 1,
  Is501c3: true,
  EIN: '931234567',
  FundsNeededBy: '2026-10-31',
  SpecificUse: 'Bus rental for the youth rally',
  ...over,
});

const actor = (over: Partial<MemberWriteActor> = {}): MemberWriteActor => ({
  memberId: 9,
  councilId: OWN,
  memberType: 'Member',
  active: true,
  roles: [],
  ...over,
});

/** Gives a member a Role straight in the backing store; the data service has no role-assignment method. */
function grantRole(d: DriverUnderTest, db: DataService, memberId: number, role: string): void {
  if (d.name === 'memory') {
    const store = (db as MemoryDataService).debugStore;
    store.insert('MemberRoles', { RoleID: store.rows('Role').find((r) => r.Role === role)!.id, MemberID: memberId });
  } else {
    openDatabases.at(-1)!.prepare('INSERT INTO [MemberRoles] ([RoleID], [MemberID]) SELECT [id], ? FROM [Role] WHERE [Role] = ?').run(memberId, role);
  }
}

describe('charitable intake rules (pure)', () => {
  it('cleans the intake form and refuses bad fields', () => {
    const clean = cleanCharitableRequest(form({ OrganizationName: '  St. Jude Youth Ministry ', Website: '  ', RequestTier: null }));
    expect(clean).toMatchObject({
      OrganizationName: 'St. Jude Youth Ministry',
      EIN: '93-1234567',
      Is501c3: 1,
      IsRecurring: 0,
      FundsNeededBy: '2026-10-31 00:00:00',
      Website: null,
      RequestTier: 1,
    });
    expect(() => cleanCharitableRequest(form({ AmountRequested: 0 }))).toThrow(/more than 0/);
    expect(() => cleanCharitableRequest(form({ OrganizationName: ' ' }))).toThrow(/required/);
    expect(() => cleanCharitableRequest(form({ EIN: '12-34' }))).toThrow(/nine digits/);
    expect(() => cleanCharitableRequest(form({ ContactEmail: 'not-an-email' }))).toThrow(/email/);
    expect(() => cleanCharitableRequest(form({ RequestTier: 4 }))).toThrow(/tier/);
    expect(() => cleanCharitableRequest({ ...form(), VoteStatus: 'Approved' } as NewCharitableRequest)).toThrow(/no field "VoteStatus"/);
    expect(() => cleanCharitableRequest(form({ FundsNeededBy: '2026-02-30' }))).toThrow(/calendar date/);
  });

  it('gives vetting authority to officers, Trustees and Admins of the council, and to Super Admins', () => {
    expect(() => assertMayVetCharitableRequests(actor({ officer: true, roles: ['Trustee 1'] }), OWN, 'vet')).not.toThrow();
    expect(() => assertMayVetCharitableRequests(actor({ memberType: 'Admin' }), OWN, 'vet')).not.toThrow();
    expect(() => assertMayVetCharitableRequests(actor({ memberType: 'Super Admin', councilId: 2 }), OWN, 'vet')).not.toThrow();
    expect(() => assertMayVetCharitableRequests(actor(), OWN, 'vet')).toThrow(SecurityPrivilegeError);
    expect(() => assertMayVetCharitableRequests(actor({ officer: true, active: false }), OWN, 'vet')).toThrow(/officer/);
    expect(() => assertMayVetCharitableRequests(actor({ officer: true, councilId: 2 }), OWN, 'vet')).toThrow(/own officers/);
    expect(() => assertIndependentVetter(actor({ memberId: 4 }), { id: 1, ShepherdMemberID: 4 })).toThrow(/Shepherd/);
    expect(() => assertIndependentVetter(actor({ memberId: 5 }), { id: 1, ShepherdMemberID: 4 })).not.toThrow();
  });

  it('moves a request Submitted -> Claimed by Trustee -> Advanced, and only in that order', () => {
    const submitted = { id: 1, RequestStatus: 'Submitted' as const, VetterMemberID: null };
    expect(planCharitableTriage(submitted, 12, false, { action: 'claim', VettingNotes: ' Called them ' }, NOW)).toEqual({
      RequestStatus: 'Claimed by Trustee',
      VetterMemberID: 12,
      VettingNotes: 'Called them',
    });
    expect(() => planCharitableTriage(submitted, 12, false, { action: 'advance' }, NOW)).toThrow(/claim it first/);
    const claimed = { id: 1, RequestStatus: 'Claimed by Trustee' as const, VetterMemberID: 12 };
    expect(planCharitableTriage(claimed, 12, false, { action: 'note', VettingNotes: '', RequestTier: 2 }, NOW)).toEqual({ VettingNotes: null, RequestTier: 2 });
    expect(planCharitableTriage(claimed, 12, false, { action: 'advance' }, NOW)).toEqual({ RequestStatus: 'Advanced', VettedDate: toTimestamp(NOW) });
    expect(() => planCharitableTriage(claimed, 13, false, { action: 'note', VettingNotes: 'x' }, NOW)).toThrow(/claimed by member 12/);
    expect(planCharitableTriage(claimed, 2, true, { action: 'note', VettingNotes: 'x' }, NOW)).toEqual({ VettingNotes: 'x' });
    expect(() => planCharitableTriage(claimed, 12, false, { action: 'claim' }, NOW)).toThrow(/cannot be claimed/);
    const advanced = { id: 1, RequestStatus: 'Advanced' as const, VetterMemberID: 12 };
    expect(() => planCharitableTriage(advanced, 12, false, { action: 'note', VettingNotes: 'x' }, NOW)).toThrow(/advanced to the vote/);
    expect(() => planCharitableTriage(submitted, 12, false, { action: 'approve' as never }, NOW)).toThrow(/Action must be one of/);
  });
});

describe.each(drivers)('$name driver: charitable intake and the vetting desk', (d) => {
  it('lists the seeded relationship types and mission areas for Council 15295 only, by name', async () => {
    const db = await d.make();
    expect((await db.charities.listCouncilRelationshipTypes(OWN)).map((t) => t.RelationshipName)).toEqual([
      'Catholic School',
      'Community Partner',
      'Local Nonprofit',
      'Member or Family in Need',
      'Parish Ministry',
      'State or Supreme Program',
    ]);
    expect((await db.charities.listCouncilMissionAreas(OWN)).map((a) => a.MissionAreaName)).toEqual(['Community', 'Faith', 'Family', 'Life']);

    const other = await db.councils.create(MEMBER.superAdmin, { CouncilNumber: 99004, CouncilName: 'New Council', State: 'OR' });
    expect(await db.charities.listCouncilRelationshipTypes(other.id)).toEqual([]);
    expect(await db.charities.listCouncilMissionAreas(other.id)).toEqual([]);
    await expectRule(db.charities.listCouncilRelationshipTypes(9999), 'INVALID_INPUT');
    await expectRule(db.charities.listCouncilMissionAreas(9999), 'INVALID_INPUT');
  });

  it("files a Shepherd's intake form into their own council's queue and writes nothing when refused", async () => {
    const db = await d.make();
    const detail = await db.charities.submitCharitableRequest(MEMBER.member, form());
    expect(detail.request).toMatchObject({
      CouncilID: OWN,
      OrganizationName: 'St. Jude Youth Ministry',
      AmountRequested: 800,
      RequestStatus: 'Submitted',
      SubmittedAt: toTimestamp(NOW),
      ShepherdMemberID: MEMBER.member,
      EIN: '93-1234567',
      Is501c3: 1,
      FundsNeededBy: '2026-10-31 00:00:00',
      RequestTier: 1,
      VetterMemberID: null,
      VoteStatus: 'Pending',
      AmountApproved: 0,
      PaymentOrderId: null,
    });
    expect(detail).toMatchObject({ shepherdFirstName: 'Brother', shepherdLastName: 'Knight', vetterFirstName: null, relationshipName: 'Parish Ministry' });

    const before = d.count(db, 'CharitableRequest');
    await expectRule(db.charities.submitCharitableRequest(MEMBER.member, form({ AmountRequested: 10.001 })), 'INVALID_INPUT');
    await expectRule(db.charities.submitCharitableRequest(MEMBER.member, form({ RelationshipTypeID: 999 })), 'INVALID_INPUT');
    await expectRule(db.charities.submitCharitableRequest(MEMBER.member, form({ FundsNeededBy: '10/31/2026' })), 'INVALID_DATE');
    await expectRule(db.charities.submitCharitableRequest(9999, form()), 'MEMBER_NOT_FOUND');
    expect(d.count(db, 'CharitableRequest')).toBe(before);
  });

  it('opens the shared queue to officers, Trustees and Admins, in pipeline order, and refuses plain members', async () => {
    const db = await d.make();
    const first = await db.charities.submitCharitableRequest(MEMBER.member, form({ OrganizationName: 'First' }));
    await db.charities.submitCharitableRequest(MEMBER.member, form({ OrganizationName: 'Second' }));
    await db.charities.triageRequestStatus(MEMBER.admin, first.request.id, { action: 'claim' });

    const queue = await db.charities.listCharitableRequestsQueue(MEMBER.admin, OWN);
    expect(queue.map((q) => [q.request.OrganizationName, q.request.RequestStatus])).toEqual([
      ['Second', 'Submitted'],
      ['First', 'Claimed by Trustee'],
    ]);
    expect(queue[1]).toMatchObject({ vetterFirstName: 'Council', vetterLastName: 'Admin' });
    expect(await db.charities.listCharitableRequestsQueue(MEMBER.superAdmin, OWN)).toHaveLength(2);

    await expectRule(db.charities.listCharitableRequestsQueue(MEMBER.member, OWN), 'VETTING_AUTHORITY_REQUIRED');
    grantRole(d, db, MEMBER.member, 'Trustee 2');
    expect(await db.charities.listCharitableRequestsQueue(MEMBER.member, OWN)).toHaveLength(2);
    await expectRule(db.charities.listCharitableRequestsQueue(MEMBER.admin, 2), 'COUNCIL_ACCESS_DENIED');
    await expectRule(db.charities.listCharitableRequestsQueue(MEMBER.superAdmin, 9999), 'INVALID_INPUT');
  });

  it('claims, annotates and advances a request, keeping vetting independent and the claim with its vetter', async () => {
    const db = await d.make();
    const { request } = await db.charities.submitCharitableRequest(MEMBER.superAdmin, form());
    grantRole(d, db, MEMBER.member, 'Trustee 1');

    // The Shepherd may never vet their own request, Super Admin or not.
    await expectRule(db.charities.triageRequestStatus(MEMBER.superAdmin, request.id, { action: 'claim' }), 'SELF_VETTING_BLOCKED');
    await expectRule(db.charities.triageRequestStatus(MEMBER.member, request.id, { action: 'advance' }), 'REQUEST_STATUS_CONFLICT');

    const claimed = await db.charities.triageRequestStatus(MEMBER.member, request.id, { action: 'claim', VettingNotes: 'Calling the pastor' });
    expect(claimed.request).toMatchObject({ RequestStatus: 'Claimed by Trustee', VetterMemberID: MEMBER.member, VettingNotes: 'Calling the pastor' });
    expect(claimed).toMatchObject({ vetterFirstName: 'Brother', vetterLastName: 'Knight' });

    // Another officer without admin rights cannot take over the claim; an Admin can annotate it.
    const outsider = await db.members.create(MEMBER.superAdmin, {
      CouncilID: OWN,
      MemberNumber: 7712345,
      MemberFirstName: 'Other',
      MemberLastName: 'Officer',
      Phone: '503-555-0150',
      StreetAddress1: '1 Charity Way',
      City: 'Salem',
      State: 'OR',
      ZipCode: '97301',
      Email: 'other.officer@example.org',
      DateOfBirth: '1970-05-05',
      StatusID: 1,
      DegreeID: 3,
      MemberTypeID: 3,
    });
    grantRole(d, db, outsider.id, 'Warden');
    await expectRule(db.charities.triageRequestStatus(outsider.id, request.id, { action: 'note', VettingNotes: 'mine now' }), 'REQUEST_STATUS_CONFLICT');
    await expectRule(db.charities.triageRequestStatus(outsider.id, request.id, { action: 'claim' }), 'REQUEST_STATUS_CONFLICT');
    const noted = await db.charities.triageRequestStatus(MEMBER.admin, request.id, { action: 'note', RequestTier: 2 });
    expect(noted.request).toMatchObject({ RequestTier: 2, VettingNotes: 'Calling the pastor', VetterMemberID: MEMBER.member });

    const advanced = await db.charities.triageRequestStatus(MEMBER.member, request.id, { action: 'advance', VettingNotes: 'Recommend the full amount' });
    expect(advanced.request).toMatchObject({
      RequestStatus: 'Advanced',
      VettedDate: toTimestamp(NOW),
      VettingNotes: 'Recommend the full amount',
      VoteStatus: 'Pending',
    });
    await expectRule(db.charities.triageRequestStatus(MEMBER.member, request.id, { action: 'note', VettingNotes: 'late' }), 'REQUEST_STATUS_CONFLICT');
  });

  it('refuses plain members, unknown requests and bad vetting input without writing', async () => {
    const db = await d.make();
    const { request } = await db.charities.submitCharitableRequest(MEMBER.admin, form());
    await expectRule(db.charities.triageRequestStatus(MEMBER.member, request.id, { action: 'claim' }), 'VETTING_AUTHORITY_REQUIRED');
    await expectRule(db.charities.triageRequestStatus(MEMBER.superAdmin, 9999, { action: 'claim' }), 'RECORD_NOT_FOUND');
    await expectRule(db.charities.triageRequestStatus(MEMBER.superAdmin, request.id, { action: 'approve' as never }), 'INVALID_INPUT');
    await expectRule(db.charities.triageRequestStatus(MEMBER.superAdmin, request.id, { action: 'claim', RequestTier: 0 }), 'INVALID_INPUT');
    const [row] = await db.charities.listCharitableRequestsQueue(MEMBER.superAdmin, OWN);
    expect(row.request).toMatchObject({ RequestStatus: 'Submitted', VetterMemberID: null, RequestTier: 1 });
  });
});

describe.each(drivers)('$name driver: presentation data', (d) => {
  /** The driver as the apps build it: Seed.sql's baseline plus its presentation rows. */
  async function makePresentation(): Promise<DataService> {
    const now = () => new Date(NOW);
    if (d.name === 'memory') {
      const db = new MemoryDataService({ now, presentationData: true });
      await db.init();
      return db;
    }
    openDatabases.length = 0;
    const db = new SqliteDataService({ now, presentationData: true });
    await db.init();
    return db;
  }

  it('loads the officers, expense sheets, charity checks and intake requests of Council 15295', async () => {
    const db = await makePresentation();
    expect(d.count(db, 'Member')).toBeGreaterThanOrEqual(19); // 3 test profiles, 15 officers and directors, the unregistered member
    expect(d.count(db, 'ExpenseReport')).toBe(10);
    expect(d.count(db, 'CharitableDisbursementLedger')).toBe(8);

    const trustee = await db.auth.signIn('francis.byrne@kofc15295.org', 'koc15295');
    const queue = await db.charities.listCharitableRequestsQueue(trustee.memberId, OWN);
    expect(queue.map((q) => q.request.RequestStatus)).toEqual(['Submitted', 'Submitted', 'Claimed by Trustee', 'Claimed by Trustee', 'Advanced']);
    expect(queue[4]).toMatchObject({ vetterFirstName: 'George', relationshipName: 'State or Supreme Program' });

    const ledger = await db.charities.listCouncilLedger(MEMBER.admin, OWN);
    expect(ledger.reduce((n, e) => n + e.disbursements.length, 0)).toBe(8);
    expect(ledger.find((e) => e.charity.Name === 'St. Jude Parish Food Pantry')?.totalGiven).toBe(1450);

    // Trustee 1 claimed the robotics club request; Trustee 2 may not take it over.
    const robotics = queue.find((q) => q.request.OrganizationName === 'Cathedral School Robotics Club')!;
    const trustee2 = await db.auth.signIn('william.schmidt@kofc15295.org', 'koc15295');
    await expectRule(db.charities.triageRequestStatus(trustee2.memberId, robotics.request.id, { action: 'advance' }), 'REQUEST_STATUS_CONFLICT');
    const advanced = await db.charities.triageRequestStatus(trustee.memberId, robotics.request.id, { action: 'advance' });
    expect(advanced.request.RequestStatus).toBe('Advanced');
  });
});

// ---- Sprint 5Z-2: mission areas on the form, target budget lines, declines and the mission footprint ----------

/** Adds a budget line for `councilId` straight in the backing store; budget writes are window-gated. */
function insertBudgetLine(d: DriverUnderTest, db: DataService, councilId: number, name: string): number {
  const row = { CouncilID: councilId, FraternalYear: '2026-2027', CategoryType: 'Operational', LineItemName: name, BudgetStatus: 'Draft' };
  if (d.name === 'memory') return (db as MemoryDataService).debugStore.insert('CouncilBudgetForecast', row).id as number;
  const result = openDatabases
    .at(-1)!
    .prepare('INSERT INTO [CouncilBudgetForecast] ([CouncilID], [FraternalYear], [CategoryType], [LineItemName], [BudgetStatus]) VALUES (?, ?, ?, ?, ?)')
    .run(row.CouncilID, row.FraternalYear, row.CategoryType, row.LineItemName, row.BudgetStatus);
  return Number(result.lastInsertRowid);
}

describe('mission footprint and declines (pure, Sprint 5Z-2)', () => {
  it('declines a claimed request like an advance, and names the target budget line on any action', () => {
    const claimed = { id: 1, RequestStatus: 'Claimed by Trustee' as const, VetterMemberID: 12 };
    expect(planCharitableTriage(claimed, 12, false, { action: 'decline', VettingNotes: 'Not a fit', TargetBudgetLineID: null }, NOW)).toEqual({
      RequestStatus: 'Declined',
      VettedDate: toTimestamp(NOW),
      VettingNotes: 'Not a fit',
      TargetBudgetLineID: null,
    });
    expect(planCharitableTriage(claimed, 12, false, { action: 'note', TargetBudgetLineID: 7 }, NOW)).toEqual({ TargetBudgetLineID: 7 });
    expect(() => planCharitableTriage(claimed, 12, false, { action: 'note', TargetBudgetLineID: 0 }, NOW)).toThrow(/record id/);
    const declined = { id: 1, RequestStatus: 'Declined' as const, VetterMemberID: 12 };
    expect(() => planCharitableTriage(declined, 12, false, { action: 'advance' }, NOW)).toThrow(/already been declined/);
    expect(() => planCharitableTriage({ ...claimed, RequestStatus: 'Submitted' }, 12, false, { action: 'decline' }, NOW)).toThrow(/claim it first/);
  });

  it('sums donations and service hours by mission area inside the fraternal year, leaving physical items out', () => {
    const areas = [
      { id: 2, CouncilID: OWN, MissionAreaName: 'Life' },
      { id: 1, CouncilID: OWN, MissionAreaName: 'Faith' },
      { id: 9, CouncilID: 2, MissionAreaName: 'Other council' },
    ];
    const events = [
      { id: 10, StartDate: '2026-08-01', MissionAreaID: 1 },
      { id: 11, StartDate: '2026-06-30', MissionAreaID: 2 }, // the previous fraternal year
      { id: 12, StartDate: '2026-09-01', MissionAreaID: null },
    ];
    const footprint = buildMissionAreaFootprint(
      OWN,
      '2026-2027',
      areas,
      events,
      [
        { EventID: 10, DonationDate: '2026-08-01', DonationAmount: 100.1, methodName: 'Cash' },
        { EventID: 10, DonationDate: '2026-08-01', DonationAmount: 0.2, methodName: 'Venmo' },
        { EventID: 10, DonationDate: '2026-08-01', DonationAmount: 500, methodName: 'Physical Items' },
        { EventID: 11, DonationDate: '2026-06-30', DonationAmount: 75, methodName: 'Cash' },
        { EventID: 12, DonationDate: '2026-09-01', DonationAmount: 40, methodName: 'Zelle' },
        { EventID: null, DonationDate: '2026-09-01', DonationAmount: 999, methodName: 'Cash' },
      ],
      [
        { Hours: 2.25, eventId: 10, shiftDate: '2026-08-01' },
        { Hours: 3, eventId: 11, shiftDate: '2026-06-30' },
        { Hours: 1.5, eventId: 12, shiftDate: '2026-09-01' },
      ],
    );
    expect(footprint).toMatchObject({ fromDate: '2026-07-01', toDate: '2027-06-30' });
    expect(footprint.areas).toEqual([
      { missionAreaId: 1, missionAreaName: 'Faith', donations: 100.3, serviceHours: 2.25, events: 1 },
      { missionAreaId: 2, missionAreaName: 'Life', donations: 0, serviceHours: 0, events: 0 },
    ]);
    expect(footprint.unfiled).toEqual({ missionAreaId: null, missionAreaName: 'Unfiled', donations: 40, serviceHours: 1.5, events: 1 });
    expect(footprint.totals).toEqual({ donations: 140.3, serviceHours: 3.75, events: 2 });
  });
});

describe.each(drivers)('$name driver: mission areas, target budget lines and declines (Sprint 5Z-2)', (d) => {
  it("files the form under one of the council's mission areas", async () => {
    const db = await d.make();
    const detail = await db.charities.submitCharitableRequest(MEMBER.member, form({ MissionAreaID: 4 }));
    expect(detail.request.MissionAreaID).toBe(4);
    expect(detail.missionAreaName).toBe('Life');
    expect(detail.targetBudgetLine).toBeNull();
    await expectRule(db.charities.submitCharitableRequest(MEMBER.member, form({ MissionAreaID: 999 })), 'INVALID_INPUT');
  });

  it("names a target budget line of the request's council and declines a claimed request", async () => {
    const db = await d.make();
    const { request } = await db.charities.submitCharitableRequest(MEMBER.member, form());
    const line = insertBudgetLine(d, db, OWN, 'Other Donations & Projects');
    const foreign = insertBudgetLine(d, db, 2, 'Another council line');
    await db.charities.triageRequestStatus(MEMBER.admin, request.id, { action: 'claim' });
    await expectRule(db.charities.triageRequestStatus(MEMBER.admin, request.id, { action: 'note', TargetBudgetLineID: foreign }), 'INVALID_INPUT');
    await expectRule(db.charities.triageRequestStatus(MEMBER.admin, request.id, { action: 'note', TargetBudgetLineID: 9999 }), 'INVALID_INPUT');

    const declined = await db.charities.triageRequestStatus(MEMBER.admin, request.id, {
      action: 'decline',
      VettingNotes: 'Outside our giving guidelines',
      TargetBudgetLineID: line,
    });
    expect(declined.request).toMatchObject({ RequestStatus: 'Declined', VettedDate: toTimestamp(NOW), TargetBudgetLineID: line, VoteStatus: 'Pending' });
    expect(declined.targetBudgetLine).toEqual({ name: 'Other Donations & Projects', fraternalYear: '2026-2027' });
    await expectRule(db.charities.triageRequestStatus(MEMBER.admin, request.id, { action: 'note', VettingNotes: 'late' }), 'REQUEST_STATUS_CONFLICT');

    const queue = await db.charities.listCharitableRequestsQueue(MEMBER.admin, OWN);
    expect(queue.at(-1)?.request.RequestStatus).toBe('Declined');
  });

  it('keeps the mission footprint to the executive summaries’ readers', async () => {
    const db = await d.make();
    await expectRule(db.reports.missionAreaFootprint(MEMBER.member, OWN, '2026-2027'), 'ADMIN_REQUIRED');
    await expectRule(db.reports.missionAreaFootprint(MEMBER.admin, OWN, '2026'), 'INVALID_INPUT');
    const footprint = await db.reports.missionAreaFootprint(MEMBER.admin, OWN, '2026-2027');
    expect(footprint.areas.map((a) => [a.missionAreaName, a.donations, a.serviceHours])).toEqual([
      ['Community', 0, 0],
      ['Faith', 0, 0],
      ['Family', 0, 0],
      ['Life', 0, 0],
    ]);
  });
});

describe.each(drivers)('$name driver: Faith-in-Action presentation data (Sprint 5Z-2)', (d) => {
  it('tracks the seeded events of each mission area', async () => {
    const now = () => new Date(NOW);
    let db: DataService;
    if (d.name === 'memory') {
      db = new MemoryDataService({ now, presentationData: true });
    } else {
      openDatabases.length = 0;
      db = new SqliteDataService({ now, presentationData: true });
    }
    await db.init();
    const footprint = await db.reports.missionAreaFootprint(MEMBER.admin, OWN, '2026-2027');
    expect(footprint.areas.map((a) => [a.missionAreaName, a.donations, a.serviceHours, a.events])).toEqual([
      ['Community', 1530.5, 39.25, 2],
      ['Faith', 275, 12.5, 2],
      ['Family', 1690, 39, 2],
      ['Life', 1265.25, 34.25, 2],
    ]);
    const queue = await db.charities.listCharitableRequestsQueue(MEMBER.admin, OWN);
    expect(queue.map((q) => q.missionAreaName)).toEqual(['Faith', 'Community', 'Life', 'Family', 'Community']);
  });
});

describe.each(drivers)('$name driver: Grand Knight and Deputy Grand Knight executive access (Sprint 5Z-2.5)', (d) => {
  it('lets a Grand Knight or Deputy Grand Knight without an Admin type read the footprint and work any claimed request', async () => {
    const db = await d.make();
    grantRole(d, db, MEMBER.member, 'Deputy Grand Knight');
    const footprint = await db.reports.missionAreaFootprint(MEMBER.member, OWN, '2026-2027');
    expect(footprint.areas).toHaveLength(4);
    await expectRule(db.reports.missionAreaFootprint(MEMBER.member, 2, '2026-2027'), 'COUNCIL_ACCESS_DENIED');
    expect(await db.budget.getBudgetProgress(MEMBER.member, OWN, '2026-2027')).toMatchObject({ councilId: OWN });

    // Another officer claims a request; the Deputy Grand Knight may annotate and advance it over that claim.
    const outsider = await db.members.create(MEMBER.superAdmin, {
      CouncilID: OWN,
      MemberNumber: 7712399,
      MemberFirstName: 'Claiming',
      MemberLastName: 'Trustee',
      Phone: '503-555-0150',
      StreetAddress1: '1 Charity Way',
      City: 'Salem',
      State: 'OR',
      ZipCode: '97301',
      Email: 'claiming.trustee@example.org',
      DateOfBirth: '1970-05-05',
      StatusID: 1,
      DegreeID: 3,
      MemberTypeID: 3,
    });
    grantRole(d, db, outsider.id, 'Trustee 3');
    const { request } = await db.charities.submitCharitableRequest(MEMBER.admin, form());
    await db.charities.triageRequestStatus(outsider.id, request.id, { action: 'claim' });
    const noted = await db.charities.triageRequestStatus(MEMBER.member, request.id, { action: 'note', VettingNotes: 'GK/DGK review' });
    expect(noted.request).toMatchObject({ VettingNotes: 'GK/DGK review', VetterMemberID: outsider.id });
    const advanced = await db.charities.triageRequestStatus(MEMBER.member, request.id, { action: 'advance' });
    expect(advanced.request.RequestStatus).toBe('Advanced');

    // The Four-Eyes Principle still binds them on their own requests.
    const own = await db.charities.submitCharitableRequest(MEMBER.member, form({ OrganizationName: 'My own' }));
    await expectRule(db.charities.triageRequestStatus(MEMBER.member, own.request.id, { action: 'claim' }), 'SELF_VETTING_BLOCKED');
  });
});
