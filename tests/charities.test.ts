// Sprint 5V: charitable giving plumbing - the global charity registry (search, local suggestions, adding entries and
// duplicate detection), council links, member gift proposals, finance-officer disbursements that register or link the
// charity and pay it in one transaction, one checkbook shared with expense checks, and charitable giving in
// reports.monthlySummary.
import { describe, expect, it } from 'vitest';
import {
  assertMayAddGlobalCharity,
  buildCharityProposalDetails,
  buildCouncilCharityLedger,
  charityNeedsHydration,
  assertMayConnectCouncilCharity,
  assertMayDisburseCharity,
  assertMayProposeCharityGift,
  charityBlankFills,
  cleanCharityCheck,
  cleanCharityProposal,
  cleanCharitySearchFilters,
  cleanGlobalCharity,
  findRegisteredCharity,
  normalizeEin,
  normalizeStateCode,
  searchCharityRegistry,
  SecurityPrivilegeError,
  suggestLocalCharities,
  summarizeMonth,
  type DataService,
  type GlobalCharityRegistry,
  type MemberWriteActor,
  type NewGlobalCharity,
} from '@kofc/shared';
import { MemoryDataService } from '../apps/web/services/drivers/memory';
import { drivers, expectRule, MEMBER, type DriverUnderTest, treasurerCode } from './helpers';
import { openDatabases } from './shims/expo-sqlite';

// Dev seed: council 1 is 15295 in OR (Super Admin 1, Admin 2 who is also Financial Secretary, Member 3); council 2 exists.
const OWN = 1;
const OTHER = 2;
const CHECK = { CheckNumber: '2001', PayoutDate: '2026-09-18', Notes: 'September gift' };

const charity = (over: Partial<NewGlobalCharity> = {}): NewGlobalCharity => ({
  Name: 'St. Vincent de Paul Salem',
  Description: 'Food pantry and emergency rent help',
  EIN: '93-0386970',
  State: 'OR',
  Phone: null,
  ContactName: null,
  ContactEmail: null,
  Address: null,
  ZipCode: null,
  IsCatholic: true,
  CharityType: 'Food Security',
  ...over,
});

const registryRow = (id: number, over: Partial<GlobalCharityRegistry> = {}): GlobalCharityRegistry => ({
  id,
  Name: `Charity ${id}`,
  Description: 'Fixture',
  EIN: null,
  State: 'OR',
  IsCatholic: 0,
  CharityType: 'Community',
  ...over,
});

const actor = (over: Partial<MemberWriteActor> = {}): MemberWriteActor => ({
  memberId: 10,
  councilId: OWN,
  memberType: 'Member',
  active: true,
  roles: [],
  ...over,
});

async function expectPrivilege(promise: Promise<unknown>, code: 'ADMIN_REQUIRED' | 'COUNCIL_ACCESS_DENIED' | 'FINANCE_OFFICER_REQUIRED') {
  expect(await expectRule(promise, code)).toBeInstanceOf(SecurityPrivilegeError);
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

/** A member of `councilId` of the given type, added by the seeded Super Admin. */
async function addMember(db: DataService, councilId: number, type: 'Admin' | 'Member', email: string, status = 'Active'): Promise<number> {
  const types = await db.lookups.list('MemberType');
  const statuses = await db.lookups.list('MemberStatus');
  const member = await db.members.create(MEMBER.superAdmin, {
    CouncilID: councilId,
    MemberNumber: 7800000 + email.length,
    MemberFirstName: 'Charity',
    MemberLastName: 'Tester',
    Phone: '503-555-0160',
    StreetAddress1: '1 Charity Way',
    City: 'Salem',
    State: 'OR',
    ZipCode: '97301',
    Email: email,
    DateOfBirth: '1970-05-05',
    StatusID: statuses.find((s) => s.Status === status)!.id,
    DegreeID: 3,
    MemberTypeID: types.find((t) => t.Type === type)!.id,
  });
  return member.id;
}

async function makeMeeting(db: DataService, councilId: number) {
  const type = (await db.lookups.list('MeetingType'))[0];
  return db.meetings.create({
    OwnerID: null,
    CouncilID: councilId,
    'Meeting Name': 'September business meeting',
    Date: '2026-09-10',
    'Time Start': '19:00:00',
    'Time End': '20:30:00',
    Location: 'Council Hall',
    MeetingType: type.id,
  });
}

describe('charity helpers (pure)', () => {
  it('normalizes EINs and state codes', () => {
    expect(normalizeEin('930386970')).toBe('93-0386970');
    expect(normalizeEin(' 93 0386970 ')).toBe('93-0386970');
    expect(() => normalizeEin('93-03869')).toThrow(/nine digits/);
    expect(normalizeStateCode(' or ')).toBe('OR');
    expect(() => normalizeStateCode('Oregon')).toThrow(/two-letter/);
  });

  it('cleans a registry entry: trims, folds State and EIN, stores blanks as NULL and IsCatholic as a bit', () => {
    const clean = cleanGlobalCharity(charity({ Name: '  Mercy House ', EIN: '930386970', State: 'wa', Phone: '  ', IsCatholic: undefined }));
    expect(clean).toMatchObject({ Name: 'Mercy House', EIN: '93-0386970', State: 'WA', Phone: null, IsCatholic: 0 });
    expect(cleanGlobalCharity(charity({ EIN: '' })).EIN).toBeNull();
    expect(() => cleanGlobalCharity(charity({ Description: ' ' }))).toThrow(/Description is required/);
    expect(() => cleanGlobalCharity(charity({ CharityType: 'x'.repeat(101) }))).toThrow(/at most 100/);
    // Sprint 5V-2: only the six core types, stored in their canonical spelling.
    expect(cleanGlobalCharity(charity({ CharityType: ' protecting LIFE ' })).CharityType).toBe('Protecting Life');
    expect(() => cleanGlobalCharity(charity({ CharityType: 'Housing' }))).toThrow(/Food Security, Women and Children, Faith, Protecting Life, Homelessness, Parish/);
    expect(() => cleanGlobalCharity(charity({ ContactEmail: 'not-an-email' }))).toThrow(/email address/);
    expect(() => cleanGlobalCharity({ ...charity(), id: 5 } as unknown as NewGlobalCharity)).toThrow(/no field "id"/);
  });

  it('treats the same EIN, or the same name and state when an EIN is missing, as a duplicate', () => {
    const registry = [
      registryRow(1, { Name: 'Mercy House', EIN: '11-1111111' }),
      registryRow(2, { Name: 'Hope Shelter', EIN: null }),
      registryRow(3, { Name: 'Hope Shelter', State: 'WA' }),
    ];
    expect(findRegisteredCharity(registry, { Name: 'Anything', State: 'CA', EIN: '11-1111111' })?.id).toBe(1);
    expect(findRegisteredCharity(registry, { Name: ' hope  SHELTER ', State: 'OR', EIN: null })?.id).toBe(2);
    expect(findRegisteredCharity(registry, { Name: 'Hope Shelter', State: 'OR', EIN: '22-2222222' })?.id).toBe(2);
    // Two EINs that differ are two charities, even under one name.
    expect(findRegisteredCharity(registry, { Name: 'Mercy House', State: 'OR', EIN: '33-3333333' })).toBeUndefined();
    expect(findRegisteredCharity(registry, { Name: 'Hope Shelter', State: 'ID', EIN: null })).toBeUndefined();
  });

  it('fills only blank optional columns of an existing entry', () => {
    const existing = registryRow(1, { EIN: null, Phone: '503-555-0101', ContactName: null });
    const incoming = cleanGlobalCharity(charity({ Phone: '503-555-9999', ContactName: 'Sr. Ann', Name: 'Other name' }));
    expect(charityBlankFills(existing, incoming)).toEqual({ EIN: '93-0386970', ContactName: 'Sr. Ann' });
  });

  it('searches by name part, type, state, EIN and Catholic flag, sorted by name, with a limit', () => {
    const rows = [
      registryRow(1, { Name: 'zeta Food Bank', CharityType: 'Food Security', IsCatholic: 1 }),
      registryRow(2, { Name: 'Alpha Food Pantry', CharityType: 'food security', EIN: '12-3456789' }),
      registryRow(3, { Name: 'Beta Youth League', CharityType: 'Youth', State: 'WA' }),
    ];
    const search = (f = {}) => searchCharityRegistry(rows, cleanCharitySearchFilters(f)).map((r) => r.id);
    expect(search()).toEqual([2, 3, 1]);
    expect(search({ name: 'FOOD' })).toEqual([2, 1]);
    expect(search({ charityType: 'Food Security' })).toEqual([2, 1]);
    expect(search({ state: 'wa' })).toEqual([3]);
    expect(search({ ein: '123456789' })).toEqual([2]);
    expect(search({ isCatholic: true })).toEqual([1]);
    expect(search({ isCatholic: false, limit: 1 })).toEqual([2]);
    expect(() => cleanCharitySearchFilters({ limit: 0 })).toThrow(/Limit/);
    expect(() => cleanCharitySearchFilters({ limit: 501 })).toThrow(/Limit/);
    expect(() => cleanCharitySearchFilters({ state: 'Oregon' })).toThrow(/two-letter/);
  });

  it('suggests unlinked charities in the state, Catholic ones first', () => {
    const rows = [
      registryRow(1, { Name: 'Alpha' }),
      registryRow(2, { Name: 'Zeta', IsCatholic: 1 }),
      registryRow(3, { Name: 'Beta', State: 'WA', IsCatholic: 1 }),
      registryRow(4, { Name: 'Gamma' }),
    ];
    expect(suggestLocalCharities(rows, 'OR', [4]).map((r) => r.id)).toEqual([2, 1]);
  });

  it('cleans proposals and checks', () => {
    expect(cleanCharityProposal({ ProposedCharityName: ' Mercy House ', ProposedAmount: 250 })).toEqual({
      ProposedCharityName: 'Mercy House',
      ProposedAmount: 250,
      ExistingCharityID: null,
    });
    expect(() => cleanCharityProposal({ ProposedAmount: 250 })).toThrow(/name or a charity/);
    expect(() => cleanCharityProposal({ ProposedCharityName: 'X', ProposedAmount: 0 })).toThrow(/more than 0/);
    expect(() => cleanCharityProposal({ ProposedCharityName: 'X', ProposedAmount: 10.005 })).toThrow(/two decimal places/);
    expect(cleanCharityCheck(CHECK)).toEqual({ ...CHECK, Amount: null, MeetingMinutesID: null, CharityID: null });
    expect(() => cleanCharityCheck({ ...CHECK, Amount: -5 })).toThrow(/Check amount/);
    expect(() => cleanCharityCheck({ ...CHECK, CheckNumber: ' ' })).toThrow(/Check number is required/);
  });

  it('flags a charity without a mailing address for hydration, and builds the proposal and ledger views', () => {
    expect(charityNeedsHydration(null)).toBe(true);
    expect(charityNeedsHydration(registryRow(1, { Address: '1 Main St', ZipCode: null }))).toBe(true);
    expect(charityNeedsHydration(registryRow(1, { Address: '1 Main St', ZipCode: '97301' }))).toBe(false);

    const proposal = (id: number, Status: 'Pending' | 'Approved' | 'Rejected', ExistingCharityID: number | null = null) => ({
      id,
      CouncilID: OWN,
      SubmitterMemberID: 3,
      ProposedCharityName: `Gift ${id}`,
      ProposedAmount: 10,
      ExistingCharityID,
      Status,
    });
    const charities = [registryRow(7, { Address: '1 Main St', ZipCode: '97301' })];
    const paid = { id: 1, CouncilID: OWN, CharityID: 7, Amount: 10, CheckNumber: '1', DisbursedByID: 2, PayoutDate: '2026-09-01', ProposalID: 2 };
    const details = buildCharityProposalDetails(
      [proposal(1, 'Rejected'), proposal(2, 'Approved', 7), proposal(3, 'Pending', 7), proposal(4, 'Pending')],
      [{ id: 3, MemberFirstName: 'Pat', MemberLastName: 'Knight' }],
      charities,
      [paid],
      'queue',
    );
    expect(details.map((d) => [d.proposal.id, d.needsHydration])).toEqual([[3, false], [4, true], [2, false], [1, false]]);
    expect(details[2]).toMatchObject({ submitterLastName: 'Knight', charity: { id: 7 }, disbursement: { id: 1 } });

    const ledger = buildCouncilCharityLedger(
      [{ CouncilID: OWN, CharityID: 7, ConnectedAt: '2026-09-01 10:00:00' }],
      charities,
      [paid, { ...paid, id: 2, Amount: 5.55, PayoutDate: '2026-09-15', ProposalID: null }, { ...paid, id: 3, CouncilID: OTHER }],
    );
    expect(ledger).toHaveLength(1);
    expect(ledger[0].disbursements.map((d) => d.id)).toEqual([2, 1]);
    expect(ledger[0].totalGiven).toBe(15.55);
  });

  it('adds charitable giving to the month’s spend and nets it against funds raised', () => {
    const summary = summarizeMonth(OWN, 2026, 9, {
      events: [{ id: 1, StartDate: '2026-09-03', 'FundsRaised-Cash': 50 } as never],
      eventTime: [],
      activityTime: [],
      expenseItems: [{ Amount: 20 }],
      charitableGifts: [{ Amount: 249.99 }, { Amount: 0.01 }],
    });
    expect(summary.finances).toEqual({
      spend: 270,
      expenses: 20,
      charitableGiving: 250,
      cash: 50,
      electronic: 0,
      raised: 50,
      net: -220,
    });
  });
});

describe('charity access rules (pure)', () => {
  it('lets only Admins and Super Admins add to the global registry', () => {
    expect(() => assertMayAddGlobalCharity(actor({ memberType: 'Admin' }))).not.toThrow();
    expect(() => assertMayAddGlobalCharity(actor({ memberType: 'Super Admin', councilId: OTHER }))).not.toThrow();
    expect(() => assertMayAddGlobalCharity(actor({ roles: ['Treasurer'] }))).toThrow(SecurityPrivilegeError);
    expect(() => assertMayAddGlobalCharity(actor({ memberType: 'Admin', active: false }))).toThrow(SecurityPrivilegeError);
  });

  it('lets council leadership connect charities, in their own council only', () => {
    expect(() => assertMayConnectCouncilCharity(actor({ memberType: 'Admin' }), OWN, 'connect')).not.toThrow();
    expect(() => assertMayConnectCouncilCharity(actor({ roles: ['Treasurer'] }), OWN, 'connect')).not.toThrow();
    expect(() => assertMayConnectCouncilCharity(actor({ memberType: 'Super Admin' }), OTHER, 'connect')).not.toThrow();
    expect(() => assertMayConnectCouncilCharity(actor(), OWN, 'connect')).toThrow(/Admin, Financial Secretary, Treasurer/);
    expect(() => assertMayConnectCouncilCharity(actor({ memberType: 'Admin' }), OTHER, 'connect')).toThrow(/own leadership/);
  });

  it('lets active members propose gifts for their own council', () => {
    expect(() => assertMayProposeCharityGift(actor(), OWN, 'propose')).not.toThrow();
    expect(() => assertMayProposeCharityGift(actor({ memberType: 'Super Admin' }), OTHER, 'propose')).not.toThrow();
    expect(() => assertMayProposeCharityGift(actor(), OTHER, 'propose')).toThrow(SecurityPrivilegeError);
    expect(() => assertMayProposeCharityGift(actor({ active: false }), OWN, 'propose')).toThrow(SecurityPrivilegeError);
  });

  it('lets only finance officers of the council, or a Super Admin, pay charity checks', () => {
    expect(() => assertMayDisburseCharity(actor({ roles: ['Financial Secretary'] }), OWN, 'pay')).not.toThrow();
    expect(() => assertMayDisburseCharity(actor({ memberType: 'Super Admin' }), OTHER, 'pay')).not.toThrow();
    expect(() => assertMayDisburseCharity(actor({ memberType: 'Admin' }), OWN, 'pay')).toThrow(/Financial Secretary, Treasurer or Super Admin/);
    expect(() => assertMayDisburseCharity(actor({ roles: ['Treasurer'] }), OTHER, 'pay')).toThrow(/own finance officers/);
  });
});

describe.each(drivers)('$name driver: charitable giving', (d) => {
  it('adds a charity to the registry for an Admin and refuses duplicates and non-Admins', async () => {
    const db = await d.make();
    const added = await db.charities.addGlobalCharity(MEMBER.admin, charity({ EIN: '930386970' }));
    expect(added).toMatchObject({ Name: 'St. Vincent de Paul Salem', EIN: '93-0386970', State: 'OR', IsCatholic: 1 });

    const dup = await expectRule(db.charities.addGlobalCharity(MEMBER.superAdmin, charity({ Name: 'Other', State: 'WA' })), 'CHARITY_ALREADY_REGISTERED');
    expect(dup.details).toEqual({ charityId: added.id });
    await expectRule(db.charities.addGlobalCharity(MEMBER.superAdmin, charity({ EIN: null, Name: 'st. vincent DE PAUL salem' })), 'CHARITY_ALREADY_REGISTERED');
    await expectPrivilege(db.charities.addGlobalCharity(MEMBER.member, charity({ EIN: null, Name: 'Hope Shelter' })), 'ADMIN_REQUIRED');

    // Charities without an EIN may share the registry (the unique index skips NULLs).
    await db.charities.addGlobalCharity(MEMBER.admin, charity({ EIN: null, Name: 'Hope Shelter' }));
    await db.charities.addGlobalCharity(MEMBER.admin, charity({ EIN: null, Name: 'Hope Shelter', State: 'WA' }));
    expect(d.count(db, 'GlobalCharityRegistry')).toBe(3);
    await expectRule(db.charities.addGlobalCharity(MEMBER.admin, charity({ State: 'Oregon' })), 'INVALID_INPUT');
    await expectRule(db.charities.addGlobalCharity(999_999, charity()), 'MEMBER_NOT_FOUND');
  });

  it('searches the registry for any member and suggests unlinked local charities', async () => {
    const db = await d.make();
    const svdp = await db.charities.addGlobalCharity(MEMBER.admin, charity());
    const shelter = await db.charities.addGlobalCharity(MEMBER.admin, charity({ EIN: null, Name: 'Hope Shelter', IsCatholic: false, CharityType: 'Homelessness' }));
    await db.charities.addGlobalCharity(MEMBER.admin, charity({ EIN: null, Name: 'Evergreen Youth', State: 'WA', CharityType: 'Faith' }));

    expect((await db.charities.searchGlobalRegistry(MEMBER.member)).map((c) => c.Name)).toEqual(['Evergreen Youth', 'Hope Shelter', 'St. Vincent de Paul Salem']);
    expect((await db.charities.searchGlobalRegistry(MEMBER.member, { state: 'or', name: 'hope' })).map((c) => c.id)).toEqual([shelter.id]);
    expect((await db.charities.searchGlobalRegistry(MEMBER.member, { ein: '930386970' })).map((c) => c.id)).toEqual([svdp.id]);
    expect((await db.charities.searchGlobalRegistry(MEMBER.member, { charityType: 'faith' })).map((c) => c.State)).toEqual(['WA']);
    await expectRule(db.charities.searchGlobalRegistry(MEMBER.member, { ein: '123' }), 'INVALID_INPUT');

    expect((await db.charities.listSuggestedLocal(MEMBER.member, OWN, 'or')).map((c) => c.id)).toEqual([svdp.id, shelter.id]);
    await db.charities.connectCouncilToCharity(MEMBER.admin, OWN, svdp.id);
    expect((await db.charities.listSuggestedLocal(MEMBER.member, OWN, 'OR')).map((c) => c.id)).toEqual([shelter.id]);
    expect((await db.charities.listSuggestedLocal(MEMBER.superAdmin, OTHER, 'OR')).map((c) => c.id)).toEqual([svdp.id, shelter.id]);
    await expectPrivilege(db.charities.listSuggestedLocal(MEMBER.member, OTHER, 'OR'), 'COUNCIL_ACCESS_DENIED');
    await expectRule(db.charities.listSuggestedLocal(MEMBER.member, OWN, 'Oregon'), 'INVALID_INPUT');
  });

  it('connects a council to a charity idempotently, for council leadership only', async () => {
    const db = await d.make();
    const svdp = await db.charities.addGlobalCharity(MEMBER.admin, charity());
    const link = await db.charities.connectCouncilToCharity(MEMBER.admin, OWN, svdp.id);
    expect(link).toMatchObject({ CouncilID: OWN, CharityID: svdp.id });
    expect(link.ConnectedAt).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    expect(await db.charities.connectCouncilToCharity(MEMBER.superAdmin, OWN, svdp.id)).toEqual(link);
    expect(d.count(db, 'CouncilCharityLink')).toBe(1);

    await expectPrivilege(db.charities.connectCouncilToCharity(MEMBER.member, OWN, svdp.id), 'ADMIN_REQUIRED');
    await expectPrivilege(db.charities.connectCouncilToCharity(MEMBER.admin, OTHER, svdp.id), 'COUNCIL_ACCESS_DENIED');
    await expectRule(db.charities.connectCouncilToCharity(MEMBER.admin, OWN, 999_999), 'RECORD_NOT_FOUND');
    await expectRule(db.charities.connectCouncilToCharity(MEMBER.superAdmin, 999_999, svdp.id), 'INVALID_INPUT');
  });

  it('records Pending proposals from active members of the council', async () => {
    const db = await d.make();
    const svdp = await db.charities.addGlobalCharity(MEMBER.admin, charity());
    const free = await db.charities.proposeDonation(MEMBER.member, OWN, { ProposedCharityName: ' Mercy House ', ProposedAmount: 150 });
    expect(free).toMatchObject({
      CouncilID: OWN,
      SubmitterMemberID: MEMBER.member,
      ProposedCharityName: 'Mercy House',
      ProposedAmount: 150,
      ExistingCharityID: null,
      Status: 'Pending',
      MeetingMinutesID: null,
    });
    const picked = await db.charities.proposeDonation(MEMBER.member, OWN, { ProposedAmount: 500, ExistingCharityID: svdp.id });
    expect(picked).toMatchObject({ ProposedCharityName: svdp.Name, ExistingCharityID: svdp.id });

    const inactive = await addMember(db, OWN, 'Member', 'inactive.charity@example.com', 'Inactive');
    await expectPrivilege(db.charities.proposeDonation(inactive, OWN, { ProposedCharityName: 'X', ProposedAmount: 5 }), 'COUNCIL_ACCESS_DENIED');
    await expectPrivilege(db.charities.proposeDonation(MEMBER.member, OTHER, { ProposedCharityName: 'X', ProposedAmount: 5 }), 'COUNCIL_ACCESS_DENIED');
    await expectRule(db.charities.proposeDonation(MEMBER.member, OWN, { ProposedAmount: 5, ExistingCharityID: 999_999 }), 'RECORD_NOT_FOUND');
    await expectRule(db.charities.proposeDonation(MEMBER.member, OWN, { ProposedCharityName: 'X', ProposedAmount: 0 }), 'INVALID_INPUT');
    expect(d.count(db, 'CharityDonationProposal')).toBe(2);
  });

  it('registers the charity, links it, pays the check and approves the proposal in one step', async () => {
    const db = await d.make();
    const meeting = await makeMeeting(db, OWN);
    const proposal = await db.charities.proposeDonation(MEMBER.member, OWN, { ProposedCharityName: 'Mercy House', ProposedAmount: 150 });

    // Admin 2 is the seeded Financial Secretary.
    const result = await db.charities.hydrateAndDisburse(
      MEMBER.admin,
      OWN,
      proposal.id,
      { ...CHECK, MeetingMinutesID: meeting.id },
      charity({ Name: 'Mercy House', EIN: '45-6789012', IsCatholic: false, CharityType: 'Homelessness' }),
    );
    expect(result.charityRegistered).toBe(true);
    expect(result.charity).toMatchObject({ Name: 'Mercy House', EIN: '45-6789012', IsCatholic: 0 });
    expect(result.link).toMatchObject({ CouncilID: OWN, CharityID: result.charity.id });
    expect(result.proposal).toMatchObject({ id: proposal.id, Status: 'Approved', ExistingCharityID: result.charity.id, MeetingMinutesID: meeting.id });
    expect(result.disbursement).toMatchObject({
      CouncilID: OWN,
      CharityID: result.charity.id,
      Amount: 150,
      CheckNumber: '2001',
      DisbursedByID: MEMBER.admin,
      PayoutDate: '2026-09-18',
      Notes: 'September gift',
    });

    // Paid once: a second payout is refused and writes nothing.
    await expectRule(db.charities.hydrateAndDisburse(MEMBER.admin, OWN, proposal.id, { ...CHECK, CheckNumber: '2002' }), 'PROPOSAL_STATUS_CONFLICT');
    expect(d.count(db, 'CharitableDisbursementLedger')).toBe(1);
  });

  it('reuses a registered charity, filling only its blanks, and pays a voted amount', async () => {
    const db = await d.make();
    const shelter = await db.charities.addGlobalCharity(MEMBER.admin, charity({ EIN: null, Name: 'Hope Shelter', Phone: '503-555-0101' }));
    const proposal = await db.charities.proposeDonation(MEMBER.member, OWN, { ProposedCharityName: 'hope shelter', ProposedAmount: 100 });

    const result = await db.charities.hydrateAndDisburse(
      MEMBER.superAdmin,
      OWN,
      proposal.id,
      { ...CHECK, Amount: 125.5 },
      charity({ EIN: '98-7654321', Name: 'Hope Shelter', Phone: '000', ContactName: 'Sr. Ann' }),
    );
    expect(result.charityRegistered).toBe(false);
    expect(result.charity).toMatchObject({ id: shelter.id, EIN: '98-7654321', Phone: '503-555-0101', ContactName: 'Sr. Ann' });
    expect(result.disbursement.Amount).toBe(125.5);
    expect(d.count(db, 'GlobalCharityRegistry')).toBe(1);
  });

  it('pays the charity a proposal already names, and needs details for one that names none', async () => {
    const db = await d.make();
    const svdp = await db.charities.addGlobalCharity(MEMBER.admin, charity());
    await db.charities.connectCouncilToCharity(MEMBER.admin, OWN, svdp.id);
    const named = await db.charities.proposeDonation(MEMBER.member, OWN, { ProposedAmount: 75, ExistingCharityID: svdp.id });
    const result = await db.charities.hydrateAndDisburse(MEMBER.admin, OWN, named.id, CHECK);
    expect(result).toMatchObject({ charityRegistered: false, charity: { id: svdp.id }, disbursement: { Amount: 75 } });
    expect(d.count(db, 'CouncilCharityLink')).toBe(1);

    const unnamed = await db.charities.proposeDonation(MEMBER.member, OWN, { ProposedCharityName: 'Unregistered', ProposedAmount: 10 });
    await expectRule(db.charities.hydrateAndDisburse(MEMBER.admin, OWN, unnamed.id, { ...CHECK, CheckNumber: '2002' }), 'INVALID_INPUT');
  });

  it('keeps disbursements to finance officers of the council and writes nothing when refused', async () => {
    const db = await d.make();
    const proposal = await db.charities.proposeDonation(MEMBER.member, OWN, { ProposedCharityName: 'Mercy House', ProposedAmount: 150 });
    const plainAdmin = await addMember(db, OWN, 'Admin', 'plain.admin.charity@example.com');
    const foreignTreasurer = await addMember(db, OTHER, 'Member', 'treasurer.other.charity@example.com');
    grantRole(d, db, foreignTreasurer, 'Treasurer');
    const treasurer = await addMember(db, OWN, 'Member', 'treasurer.own.charity@example.com');
    grantRole(d, db, treasurer, 'Treasurer');

    const pay = (actorId: number, check = CHECK) => db.charities.hydrateAndDisburse(actorId, OWN, proposal.id, check, charity());
    await expectPrivilege(pay(MEMBER.member), 'FINANCE_OFFICER_REQUIRED');
    await expectPrivilege(pay(plainAdmin), 'FINANCE_OFFICER_REQUIRED');
    await expectPrivilege(pay(foreignTreasurer), 'COUNCIL_ACCESS_DENIED');
    await expectRule(db.charities.hydrateAndDisburse(treasurer, OTHER, proposal.id, CHECK), 'COUNCIL_ACCESS_DENIED');
    await expectRule(db.charities.hydrateAndDisburse(MEMBER.superAdmin, OTHER, proposal.id, CHECK), 'RECORD_NOT_FOUND');
    await expectRule(db.charities.hydrateAndDisburse(treasurer, OWN, 999_999, CHECK), 'RECORD_NOT_FOUND');
    await expectRule(pay(treasurer, { ...CHECK, PayoutDate: '2026-02-30' }), 'INVALID_DATE');

    const foreignMeeting = await makeMeeting(db, OTHER);
    await expectRule(pay(treasurer, { ...CHECK, MeetingMinutesID: foreignMeeting.id }), 'INVALID_INPUT');
    for (const table of ['GlobalCharityRegistry', 'CouncilCharityLink', 'CharitableDisbursementLedger']) expect(d.count(db, table)).toBe(0);

    expect((await pay(treasurer)).disbursement.DisbursedByID).toBe(treasurer);
  });

  it('stamps the check with its proposal and pays a registry charity chosen on the check', async () => {
    const db = await d.make();
    const svdp = await db.charities.addGlobalCharity(MEMBER.admin, charity({ Address: '445 Lancaster Dr NE', ZipCode: '97301' }));
    const proposal = await db.charities.proposeDonation(MEMBER.member, OWN, { ProposedCharityName: 'The pantry on Lancaster', ProposedAmount: 90 });
    await expectRule(db.charities.hydrateAndDisburse(MEMBER.admin, OWN, proposal.id, { ...CHECK, CharityID: svdp.id }, charity()), 'INVALID_INPUT');
    await expectRule(db.charities.hydrateAndDisburse(MEMBER.admin, OWN, proposal.id, { ...CHECK, CharityID: 999_999 }), 'RECORD_NOT_FOUND');
    const result = await db.charities.hydrateAndDisburse(MEMBER.admin, OWN, proposal.id, { ...CHECK, CharityID: svdp.id });
    expect(result.disbursement).toMatchObject({ ProposalID: proposal.id, CharityID: svdp.id });
    expect(result.proposal.ExistingCharityID).toBe(svdp.id);
  });

  it('lists a member’s own proposals and the council’s queue with their charities and checks', async () => {
    const db = await d.make();
    const svdp = await db.charities.addGlobalCharity(MEMBER.admin, charity({ Address: '445 Lancaster Dr NE', ZipCode: '97301' }));
    const first = await db.charities.proposeDonation(MEMBER.member, OWN, { ProposedAmount: 75, ExistingCharityID: svdp.id });
    const second = await db.charities.proposeDonation(MEMBER.member, OWN, { ProposedCharityName: 'Mercy House', ProposedAmount: 150 });
    const third = await db.charities.proposeDonation(MEMBER.admin, OWN, { ProposedCharityName: 'Hope Shelter', ProposedAmount: 40 });
    await db.charities.hydrateAndDisburse(MEMBER.admin, OWN, first.id, CHECK);

    const mine = await db.charities.listMyProposals(MEMBER.member);
    expect(mine.map((m) => m.proposal.id)).toEqual([second.id, first.id]);
    expect(mine[1]).toMatchObject({ proposal: { Status: 'Approved' }, charity: { id: svdp.id }, disbursement: { CheckNumber: '2001' }, needsHydration: false });
    expect(mine[0]).toMatchObject({ charity: null, disbursement: null, needsHydration: true });

    const queue = await db.charities.listCouncilProposals(MEMBER.admin, OWN);
    expect(queue.map((q) => q.proposal.id)).toEqual([second.id, third.id, first.id]);
    expect(queue[1]).toMatchObject({ submitterFirstName: expect.any(String), proposal: { SubmitterMemberID: MEMBER.admin } });
    await expectPrivilege(db.charities.listCouncilProposals(MEMBER.member, OWN), 'ADMIN_REQUIRED');
    await expectPrivilege(db.charities.listCouncilProposals(MEMBER.admin, OTHER), 'COUNCIL_ACCESS_DENIED');
    expect(await db.charities.listCouncilProposals(MEMBER.superAdmin, OTHER)).toEqual([]);
    await expectRule(db.charities.listMyProposals(999_999), 'MEMBER_NOT_FOUND');
  });

  it('lists the council’s linked charities with every check it paid them', async () => {
    const db = await d.make();
    const svdp = await db.charities.addGlobalCharity(MEMBER.admin, charity());
    const shelter = await db.charities.addGlobalCharity(MEMBER.admin, charity({ EIN: null, Name: 'Hope Shelter', CharityType: 'Homelessness' }));
    await db.charities.connectCouncilToCharity(MEMBER.admin, OWN, shelter.id);
    for (const [n, amount] of [['2001', 100], ['2002', 25.5]] as const) {
      const p = await db.charities.proposeDonation(MEMBER.member, OWN, { ProposedAmount: amount, ExistingCharityID: svdp.id });
      await db.charities.hydrateAndDisburse(MEMBER.admin, OWN, p.id, { ...CHECK, CheckNumber: n });
    }
    const ledger = await db.charities.listCouncilLedger(MEMBER.admin, OWN);
    expect(ledger.map((e) => [e.charity.Name, e.disbursements.length, e.totalGiven])).toEqual([
      ['Hope Shelter', 0, 0],
      ['St. Vincent de Paul Salem', 2, 125.5],
    ]);
    expect(ledger[1].disbursements.map((d) => d.CheckNumber)).toEqual(['2002', '2001']);
    await expectPrivilege(db.charities.listCouncilLedger(MEMBER.member, OWN), 'ADMIN_REQUIRED');
    expect(await db.charities.listCouncilLedger(MEMBER.superAdmin, OTHER)).toEqual([]);
  });

  it('lets council leadership reject a Pending proposal with a reason', async () => {
    const db = await d.make();
    const proposal = await db.charities.proposeDonation(MEMBER.member, OWN, { ProposedCharityName: 'Mercy House', ProposedAmount: 150 });
    await expectPrivilege(db.charities.rejectProposal(MEMBER.member, proposal.id, 'No'), 'ADMIN_REQUIRED');
    const foreignAdmin = await addMember(db, OTHER, 'Admin', 'foreign.admin.charity@example.com');
    await expectPrivilege(db.charities.rejectProposal(foreignAdmin, proposal.id, 'No'), 'COUNCIL_ACCESS_DENIED');
    await expectRule(db.charities.rejectProposal(MEMBER.admin, proposal.id, '  '), 'INVALID_INPUT');
    await expectRule(db.charities.rejectProposal(MEMBER.admin, 999_999, 'No'), 'RECORD_NOT_FOUND');

    const rejected = await db.charities.rejectProposal(MEMBER.admin, proposal.id, '  Over this year’s giving budget  ');
    expect(rejected.proposal).toMatchObject({ Status: 'Rejected', RejectionReason: 'Over this year’s giving budget' });
    await expectRule(db.charities.rejectProposal(MEMBER.admin, proposal.id, 'Again'), 'PROPOSAL_STATUS_CONFLICT');
    await expectRule(db.charities.hydrateAndDisburse(MEMBER.admin, OWN, proposal.id, CHECK, charity()), 'PROPOSAL_STATUS_CONFLICT');
  });

  it('shares one checkbook between expense checks and charity checks', async () => {
    const db = await d.make();
    const { report } = await db.expenses.submitReport(
      MEMBER.member,
      { Status: 'Submitted' },
      [{ DateOfExpense: '2026-09-12', Amount: 40, VendorName: 'Costco', ReceiptPhotoURL: null, ExpenseDescription: 'Supplies' }],
    );
    await db.expenses.financialSecretaryAuditOrder(MEMBER.admin, report.id);
    await treasurerCode(db, report.id);
    await db.expenses.grandKnightAuthorizeOrder(MEMBER.superAdmin, report.id);
    await db.expenses.recordDisbursement(MEMBER.admin, OWN, [report.id], { CheckNumber: '3001', PayoutDate: '2026-09-15' });

    const first = await db.charities.proposeDonation(MEMBER.member, OWN, { ProposedCharityName: 'Mercy House', ProposedAmount: 150 });
    await expectRule(db.charities.hydrateAndDisburse(MEMBER.admin, OWN, first.id, { ...CHECK, CheckNumber: ' 3001 ' }, charity()), 'INVALID_INPUT');
    await db.charities.hydrateAndDisburse(MEMBER.admin, OWN, first.id, CHECK, charity());

    const { report: second } = await db.expenses.submitReport(
      MEMBER.member,
      { Status: 'Submitted' },
      [{ DateOfExpense: '2026-09-13', Amount: 12, VendorName: 'Safeway', ReceiptPhotoURL: null, ExpenseDescription: 'Ice' }],
    );
    await db.expenses.financialSecretaryAuditOrder(MEMBER.admin, second.id);
    await treasurerCode(db, second.id);
    await db.expenses.grandKnightAuthorizeOrder(MEMBER.superAdmin, second.id);
    await expectRule(db.expenses.recordDisbursement(MEMBER.admin, OWN, [second.id], { CheckNumber: '2001', PayoutDate: '2026-09-20' }), 'INVALID_INPUT');
  });

  it('counts charity checks in the month of their payout date as spend', async () => {
    const db = await d.make();
    const before = await db.reports.monthlySummary(OWN, 2026, 9);
    expect(before.finances.charitableGiving).toBe(0);

    const september = await db.charities.proposeDonation(MEMBER.member, OWN, { ProposedCharityName: 'Mercy House', ProposedAmount: 249.99 });
    await db.charities.hydrateAndDisburse(MEMBER.admin, OWN, september.id, CHECK, charity());
    const august = await db.charities.proposeDonation(MEMBER.member, OWN, { ProposedAmount: 60, ExistingCharityID: (await db.charities.searchGlobalRegistry(MEMBER.member))[0].id });
    await db.charities.hydrateAndDisburse(MEMBER.admin, OWN, august.id, { ...CHECK, CheckNumber: '2002', PayoutDate: '2026-08-31' });

    const after = await db.reports.monthlySummary(OWN, 2026, 9);
    expect(after.finances).toEqual({
      ...before.finances,
      charitableGiving: 249.99,
      spend: Math.round((before.finances.spend + 249.99) * 100) / 100,
      net: Math.round((before.finances.net - 249.99) * 100) / 100,
    });
    expect((await db.reports.monthlySummary(OWN, 2026, 8)).finances.charitableGiving).toBe(60);
    expect((await db.reports.monthlySummary(OTHER, 2026, 9)).finances.charitableGiving).toBe(0);
  });

  it('keeps a council with charity records from being deleted', async () => {
    const db = await d.make();
    const council = await db.councils.create(MEMBER.superAdmin, { CouncilNumber: 99001, CouncilName: 'Charity Test Council', State: 'OR', Phone: null, Email: null });
    const svdp = await db.charities.addGlobalCharity(MEMBER.admin, charity());
    await db.charities.connectCouncilToCharity(MEMBER.superAdmin, council.id, svdp.id);
    const err = await expectRule(db.councils.remove(MEMBER.superAdmin, council.id), 'RECORD_IN_USE');
    expect(err.message).toMatch(/connected charity/);
  });
});
