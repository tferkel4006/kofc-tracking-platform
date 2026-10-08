// Sprint 5U: officer elections. The ballot switches (elections.toggleRoleBallotStatus), nominations and the Grand
// Knight eligibility warning (submitNomination), abdications and mid-year elections (recordOfficerAbdication), the
// Grand Knight's appointments (assignAppointedRole), and concluding the fraternal year with the conditional trustee
// ladder (concludeFraternalYear), on both drivers; plus the pure helpers the demo simulator previews with.
import { describe, expect, it } from 'vitest';
import {
  chairMoves,
  planConclusionFromSeats,
  SecurityPrivilegeError,
  type DataService,
  type OfficerSeat,
} from '@kofc/shared';
import { MemoryDataService } from '../apps/web/services/drivers/memory';
import { SqliteDataService } from '../apps/mobile/services/drivers/sqlite';
import { drivers, expectRule, MEMBER, type DriverUnderTest } from './helpers';
import { openDatabases } from './shims/expo-sqlite';

// Dev seed: council 1 (Super Admin 1 is its Grand Knight, Admin 2 its Financial Secretary, Members 3 and 4); council 2
// has no members. Seeded Role ids, matched here only to call the service.
const OWN = 1;
const OTHER = 2;
const ROLE = { grandKnight: 1, deputy: 2, chancellor: 3, financialSecretary: 5, trustee1: 12, trustee2: 13, trustee3: 14, chaplain: 19 } as const;
const MAY = new Date(2027, 4, 10, 12, 0, 0);

/** A driver whose clock reads `at`, for the May nomination window. */
async function makeAt(d: DriverUnderTest, at: Date): Promise<DataService> {
  const now = () => new Date(at);
  if (d.name === 'memory') {
    const db = new MemoryDataService({ now });
    await db.init();
    return db;
  }
  openDatabases.length = 0;
  const db = new SqliteDataService({ now });
  await db.init();
  return db;
}

const holderOf = (seats: OfficerSeat[], roleName: string) => seats.find((s) => s.roleName === roleName)?.holder?.memberId ?? null;

describe.each(drivers)('officer elections ($name driver)', (d) => {
  it('backfills an open term for every seated officer and lists the vacant appointed and trustee seats', async () => {
    const db = await d.make();
    const seats = await db.elections.listOfficerSeats(OWN);
    expect(seats.map((s) => s.roleName).slice(0, 3)).toEqual(['Grand Knight', 'Deputy Grand Knight', 'Chancellor']);
    expect(seats.find((s) => s.roleName === 'Grand Knight')).toMatchObject({ kind: 'elected', holder: { memberId: MEMBER.superAdmin, since: '2026-09-20' } });
    expect(seats.find((s) => s.roleName === 'Financial Secretary')).toMatchObject({ kind: 'appointed', holder: { memberId: MEMBER.admin }, ballot: null });
    expect(seats.find((s) => s.roleName === 'Deputy Grand Knight')?.ballot).toMatchObject({ IsUpForElection: 0, IsMidYearElection: 0 });
    expect(d.count(db, 'CouncilLeadershipHistory')).toBe(2);
    expect((await db.elections.listVacancies(OWN)).map((v) => v.roleName)).toEqual([
      'Trustee 1',
      'Trustee 2',
      'Trustee 3',
      'Chaplain',
      'Lecturer',
      'Membership Director',
      'Community Director',
      'Program Director',
      'Family Director',
      'Council Historian',
    ]);
    await expectRule(db.elections.listOfficerSeats(999), 'INVALID_INPUT');
  });

  it('lets council Admins and Super Admins open elected seats, and only elected seats', async () => {
    const db = await d.make();
    expect(await db.elections.toggleRoleBallotStatus(MEMBER.admin, OWN, ROLE.grandKnight, true)).toMatchObject({ CouncilID: OWN, RoleID: ROLE.grandKnight, IsUpForElection: 1 });
    expect((await db.elections.listBallotConfig(OWN)).map((b) => [b.roleName, b.nominationsOpen])).toEqual([['Grand Knight', false]]);
    expect(await db.elections.toggleRoleBallotStatus(MEMBER.superAdmin, OWN, ROLE.grandKnight, false)).toMatchObject({ IsUpForElection: 0 });
    expect(await db.elections.listBallotConfig(OWN)).toEqual([]);

    expect(await expectRule(db.elections.toggleRoleBallotStatus(MEMBER.member, OWN, ROLE.deputy, true), 'ADMIN_REQUIRED')).toBeInstanceOf(SecurityPrivilegeError);
    await expectRule(db.elections.toggleRoleBallotStatus(MEMBER.admin, OTHER, ROLE.deputy, true), 'COUNCIL_ACCESS_DENIED');
    await expectRule(db.elections.toggleRoleBallotStatus(MEMBER.admin, OWN, ROLE.financialSecretary, true), 'ROLE_NOT_ELECTED');
    await expectRule(db.elections.toggleRoleBallotStatus(MEMBER.admin, OWN, ROLE.trustee1, true), 'ROLE_NOT_ELECTED');
    await expectRule(db.elections.toggleRoleBallotStatus(MEMBER.admin, OWN, ROLE.deputy, 'yes' as unknown as boolean), 'INVALID_INPUT');
    await expectRule(db.elections.toggleRoleBallotStatus(999, OWN, ROLE.deputy, true), 'MEMBER_NOT_FOUND');
    expect(d.count(db, 'CouncilElectionBallot')).toBe(1);
  });

  it('refuses nominations outside May and for seats off the ballot', async () => {
    const db = await d.make();
    await expectRule(db.elections.submitNomination(MEMBER.member, OWN, ROLE.deputy, MEMBER.admin), 'ROLE_NOT_ON_BALLOT');
    await db.elections.toggleRoleBallotStatus(MEMBER.admin, OWN, ROLE.deputy, true);
    await expectRule(db.elections.submitNomination(MEMBER.member, OWN, ROLE.deputy, MEMBER.admin), 'NOMINATIONS_WINDOW_CLOSED');
    expect(d.count(db, 'OfficerNominations')).toBe(0);
  });

  it('records May nominations for the coming term and flags a Grand Knight nominee who never served as Deputy or Grand Knight', async () => {
    const db = await makeAt(d, MAY);
    await db.elections.toggleRoleBallotStatus(MEMBER.admin, OWN, ROLE.grandKnight, true);

    const first = await db.elections.submitNomination(MEMBER.member, OWN, ROLE.grandKnight, MEMBER.admin);
    expect(first).toMatchObject({ eligible: false, tally: 1, nomination: { FraternalYear: '2027-2028', IsEligible: 0, NominatedByMemberID: MEMBER.member } });
    // The sitting Grand Knight's current term counts toward eligibility.
    const second = await db.elections.submitNomination(MEMBER.admin, OWN, ROLE.grandKnight, MEMBER.superAdmin);
    expect(second).toMatchObject({ eligible: true, tally: 2, nomination: { IsEligible: 1 } });

    const [seat] = await db.elections.listBallotConfig(OWN);
    expect(seat).toMatchObject({ roleName: 'Grand Knight', nominationsOpen: true, fraternalYear: '2027-2028' });
    expect(seat.nominees.map((n) => [n.lastName, n.nomination.IsEligible, n.nominatedByName])).toEqual([
      ['Admin', 0, 'Brother Knight'],
      ['Admin', 1, 'Council Admin'],
    ]);

    await expectRule(db.elections.submitNomination(MEMBER.superAdmin, OWN, ROLE.grandKnight, MEMBER.admin), 'ALREADY_NOMINATED');
    await expectRule(db.elections.submitNomination(MEMBER.member, OWN, ROLE.grandKnight, 999), 'NOT_ACTIVE_COUNCIL_MEMBER');
    await expectRule(db.elections.submitNomination(MEMBER.member, OWN, ROLE.chaplain, MEMBER.admin), 'ROLE_NOT_ELECTED');
    await expectRule(db.elections.submitNomination(MEMBER.member, OTHER, ROLE.grandKnight, MEMBER.admin), 'COUNCIL_ACCESS_DENIED');
    expect(d.count(db, 'OfficerNominations')).toBe(2);
  });

  it('lets only the sitting Grand Knight or a Super Admin fill empty appointed and trustee seats', async () => {
    const db = await d.make();
    expect(await expectRule(db.elections.assignAppointedRole(MEMBER.admin, OWN, ROLE.chaplain, MEMBER.member), 'GRAND_KNIGHT_REQUIRED')).toBeInstanceOf(
      SecurityPrivilegeError,
    );
    await expectRule(db.elections.assignAppointedRole(MEMBER.member, OWN, ROLE.chaplain, MEMBER.member), 'GRAND_KNIGHT_REQUIRED');

    const term = await db.elections.assignAppointedRole(MEMBER.superAdmin, OWN, ROLE.chaplain, MEMBER.member);
    expect(term).toMatchObject({ MemberID: MEMBER.member, RoleID: ROLE.chaplain, AppointedByID: MEMBER.superAdmin, FraternalYear: '2026-2027', StartDate: '2026-09-20', EndDate: null });
    expect((await db.members.listRoles(MEMBER.member)).map((r) => r.Role)).toContain('Chaplain');
    expect((await db.elections.listVacancies(OWN)).map((v) => v.roleName)).not.toContain('Chaplain');

    await expectRule(db.elections.assignAppointedRole(MEMBER.superAdmin, OWN, ROLE.financialSecretary, MEMBER.member), 'ROLE_OCCUPIED');
    await expectRule(db.elections.assignAppointedRole(MEMBER.superAdmin, OWN, ROLE.grandKnight, MEMBER.member), 'ROLE_NOT_APPOINTED');
    await expectRule(db.elections.assignAppointedRole(MEMBER.superAdmin, OWN, ROLE.trustee1, 999), 'NOT_ACTIVE_COUNCIL_MEMBER');
    await db.elections.assignAppointedRole(MEMBER.superAdmin, OWN, ROLE.trustee1, MEMBER.newMember);
    await expectRule(db.elections.assignAppointedRole(MEMBER.superAdmin, OWN, ROLE.trustee2, MEMBER.newMember), 'INVALID_INPUT');
  });

  it('leaves an abdicated appointed seat for the Grand Knight and sends an abdicated elected seat to a two-week mid-year election', async () => {
    const db = await d.make();
    await db.elections.assignAppointedRole(MEMBER.superAdmin, OWN, ROLE.chaplain, MEMBER.member);
    await expectRule(db.elections.recordOfficerAbdication(MEMBER.member, OWN, MEMBER.admin, ROLE.financialSecretary), 'ADMIN_REQUIRED');
    await expectRule(db.elections.recordOfficerAbdication(MEMBER.admin, OWN, MEMBER.member, ROLE.deputy), 'ROLE_NOT_HELD');

    const resigned = await db.elections.recordOfficerAbdication(MEMBER.member, OWN, MEMBER.member, ROLE.chaplain);
    expect(resigned).toMatchObject({ outcome: 'AwaitingAppointment', ballot: null, history: { EndDate: '2026-09-20', ExitReason: 'Abdicated' } });
    expect((await db.elections.listVacancies(OWN)).find((v) => v.roleName === 'Chaplain')?.previous).toMatchObject({
      memberId: MEMBER.member,
      exitReason: 'Abdicated',
    });

    const gk = await db.elections.recordOfficerAbdication(MEMBER.admin, OWN, MEMBER.superAdmin, ROLE.grandKnight);
    expect(gk).toMatchObject({ outcome: 'MidYearElection', ballot: { IsUpForElection: 1, IsMidYearElection: 1 } });
    expect(gk.ballot?.NominationsCloseAt?.slice(0, 10)).toBe('2026-10-04');
    // The mid-year window takes nominations in September, for the year under way.
    expect(await db.elections.submitNomination(MEMBER.member, OWN, ROLE.grandKnight, MEMBER.superAdmin)).toMatchObject({
      eligible: true,
      nomination: { FraternalYear: '2026-2027' },
    });
    // Closing the seat ends the mid-year election.
    expect(await db.elections.toggleRoleBallotStatus(MEMBER.admin, OWN, ROLE.grandKnight, false)).toMatchObject({ IsMidYearElection: 0, NominationsCloseAt: null });
  });

  it('climbs the trustee ladder when the Grand Knight seat was on the ballot', async () => {
    const db = await d.make();
    await db.elections.assignAppointedRole(MEMBER.superAdmin, OWN, ROLE.trustee1, MEMBER.member);
    await db.elections.assignAppointedRole(MEMBER.superAdmin, OWN, ROLE.trustee3, MEMBER.newMember);
    await db.elections.toggleRoleBallotStatus(MEMBER.admin, OWN, ROLE.grandKnight, true);
    await expectRule(db.elections.concludeFraternalYear(MEMBER.member, OWN, MEMBER.admin), 'ADMIN_REQUIRED');
    await expectRule(db.elections.concludeFraternalYear(MEMBER.admin, OWN, 999), 'NOT_ACTIVE_COUNCIL_MEMBER');

    const result = await db.elections.concludeFraternalYear(MEMBER.admin, OWN, MEMBER.admin);
    expect(result).toMatchObject({ rotated: true, fraternalYear: '2026-2027', ballotsReset: 1 });
    expect(result.changes.map((c) => [c.roleName, c.previousMemberId, c.memberId])).toEqual([
      ['Grand Knight', MEMBER.superAdmin, MEMBER.admin],
      ['Trustee 1', MEMBER.member, MEMBER.superAdmin],
      ['Trustee 2', null, MEMBER.member],
      ['Trustee 3', MEMBER.newMember, null],
    ]);

    const seats = await db.elections.listOfficerSeats(OWN);
    expect(['Grand Knight', 'Trustee 1', 'Trustee 2', 'Trustee 3'].map((r) => holderOf(seats, r))).toEqual([MEMBER.admin, MEMBER.superAdmin, MEMBER.member, null]);
    expect((await db.members.listRoles(MEMBER.newMember)).map((r) => r.Role)).not.toContain('Trustee 3');
    expect((await db.elections.listVacancies(OWN)).find((v) => v.roleName === 'Trustee 3')?.previous).toMatchObject({
      memberId: MEMBER.newMember,
      exitReason: 'TermConcluded',
    });
    expect(d.count(db, 'CouncilElectionBallot')).toBe(0);
  });

  it('keeps every chair when the Grand Knight seat was not on the ballot (the second year of a two-year term)', async () => {
    const db = await d.make();
    await db.elections.assignAppointedRole(MEMBER.superAdmin, OWN, ROLE.trustee1, MEMBER.member);
    await expectRule(db.elections.concludeFraternalYear(MEMBER.superAdmin, OWN, MEMBER.admin), 'GRAND_KNIGHT_TERM_CONTINUES');
    const history = d.count(db, 'CouncilLeadershipHistory');

    expect(await db.elections.concludeFraternalYear(MEMBER.superAdmin, OWN, MEMBER.superAdmin)).toMatchObject({ rotated: false, changes: [] });
    const seats = await db.elections.listOfficerSeats(OWN);
    expect([holderOf(seats, 'Grand Knight'), holderOf(seats, 'Trustee 1')]).toEqual([MEMBER.superAdmin, MEMBER.member]);
    expect(d.count(db, 'CouncilLeadershipHistory')).toBe(history);
  });
});

describe('the conclusion preview the demo simulator confirms', () => {
  const seat = (roleName: string, memberId: number | null, onBallot = false): OfficerSeat => ({
    roleId: 0,
    roleName,
    kind: roleName.startsWith('Trustee') ? 'trustee' : 'elected',
    holder: memberId === null ? null : { memberId, firstName: '', lastName: '', since: null },
    ballot: roleName === 'Grand Knight' ? { CouncilID: 1, RoleID: 1, IsUpForElection: onBallot ? 1 : 0, IsMidYearElection: 0 } : null,
  });

  it('names who moves to which chair, who joins the board and who leaves it', () => {
    const seats = [seat('Grand Knight', 1, true), seat('Trustee 1', 2), seat('Trustee 2', 3), seat('Trustee 3', 4)];
    const plan = planConclusionFromSeats(seats, 5);
    expect(plan.rotated).toBe(true);
    expect(chairMoves(plan.transitions)).toEqual([
      { memberId: 1, from: 'Grand Knight', to: 'Trustee 1' },
      { memberId: 5, from: null, to: 'Grand Knight' },
      { memberId: 2, from: 'Trustee 1', to: 'Trustee 2' },
      { memberId: 3, from: 'Trustee 2', to: 'Trustee 3' },
      { memberId: 4, from: 'Trustee 3', to: null },
    ]);
  });

  it('shows a renewed Grand Knight in the same chair, and refuses a new one while the term continues', () => {
    expect(chairMoves(planConclusionFromSeats([seat('Grand Knight', 1, true)], 1).transitions)).toEqual([{ memberId: 1, from: 'Grand Knight', to: 'Grand Knight' }]);
    expect(() => planConclusionFromSeats([seat('Grand Knight', 1)], 2)).toThrow(/not on this year's ballot/);
  });
});
