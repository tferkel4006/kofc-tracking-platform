// Sprint 5Z-9: live meeting management (the console, the center bar, live check-ins) and secret smartphone ballots
// (launch, anonymous cast, tally-checked decision, the charitable funding queue), plus the ledger drill-down's event
// names.
import { describe, expect, it } from 'vitest';
import {
  assertResultMatchesTally,
  ballotHashInput,
  BusinessRuleError,
  charitableVoteOutcome,
  cleanLiveAgendaItem,
  liveAgendaItem,
  tallyBallots,
  type DataService,
  type NewCharitableRequest,
} from '@kofc/shared';
import { MemoryDataService } from '../apps/web/services/drivers/memory';
import { SqliteDataService } from '../apps/mobile/services/drivers/sqlite';
import { sha256Hex } from '../apps/web/services/password';
import { drivers, expectRule, MEMBER, NOW, type DriverUnderTest } from './helpers';
import { openDatabases } from './shims/expo-sqlite';

// Dev seed: council 1 is 15295 (Super Admin 1 who is Grand Knight, Admin 2 who is Financial Secretary, Member 3).
// Its cadence config 1 (Monthly, First Tuesday) lays down 2026-10-06 as the first meeting at least ten days after NOW.
const OWN = 1;
const CADENCE = 1;

const code = (fn: () => unknown): string | undefined => {
  try {
    fn();
  } catch (e) {
    return (e as BusinessRuleError).code;
  }
  return undefined;
};

const form = (over: Partial<NewCharitableRequest> = {}): NewCharitableRequest => ({
  OrganizationName: 'St. Jude Youth Ministry',
  AmountRequested: 800,
  RelationshipTypeID: 1,
  Is501c3: true,
  ...over,
});

/** The October 6 Monthly meeting with `count` charitable motions routed onto it: [meetingId, motionIds, requestIds]. */
async function meetingWithMotions(db: DataService, count = 1): Promise<{ meetingId: number; motionIds: number[]; requestIds: number[] }> {
  await db.meetings.populateAnnualCadence(MEMBER.superAdmin, OWN, CADENCE, '2026-2027');
  const motionIds: number[] = [];
  const requestIds: number[] = [];
  let meetingId = 0;
  for (let i = 0; i < count; i++) {
    const { request } = await db.charities.submitCharitableRequest(MEMBER.member, form({ OrganizationName: `Ministry ${i + 1}`, AmountRequested: 800 + i * 100 }));
    await db.charities.triageRequestStatus(MEMBER.admin, request.id, { action: 'claim' });
    await db.charities.triageRequestStatus(MEMBER.admin, request.id, { action: 'advance' });
    const routed = await db.charities.routeRequestToNextEligibleAgenda(MEMBER.admin, request.id);
    meetingId = routed.meeting.id;
    motionIds.push(routed.motion.id);
    requestIds.push(request.id);
  }
  return { meetingId, motionIds, requestIds };
}

/** BallotVote rows straight from the backing store. */
function ballots(d: DriverUnderTest, db: DataService): { AnonymousBallotHash: string; VoteSelection: string; CouncilID: number }[] {
  if (d.name === 'memory') return (db as MemoryDataService).debugStore.rows('BallotVote') as never;
  return openDatabases.at(-1)!.prepare('SELECT * FROM [BallotVote]').all() as never;
}

describe('live assembly rules (pure)', () => {
  it('checks the agenda item and counts its time down from when it began', () => {
    expect(cleanLiveAgendaItem('  Treasurer report ', 10)).toEqual({ name: 'Treasurer report', minutes: 10 });
    for (const [name, minutes] of [['', 5], ['Report', 0], ['Report', 241], ['Report', 2.5]] as const) {
      expect(code(() => cleanLiveAgendaItem(name, minutes))).toBe('INVALID_INPUT');
    }
    const meeting = { ActiveAgendaItemName: 'Report', ActiveAgendaItemTimeRemaining: 5, ActiveAgendaItemStartedAt: '2026-09-20 19:00:00' };
    expect(liveAgendaItem(meeting, new Date(Date.UTC(2026, 8, 20, 19, 1, 30)))?.secondsRemaining).toBe(210);
    expect(liveAgendaItem(meeting, new Date(Date.UTC(2026, 8, 20, 20, 0, 0)))?.secondsRemaining).toBe(0);
    expect(liveAgendaItem({ ActiveAgendaItemName: null, ActiveAgendaItemTimeRemaining: null, ActiveAgendaItemStartedAt: null }, NOW)).toBeNull();
  });

  it('holds the decision to the ballot: Passed needs more Approve than Deny', () => {
    const tally = tallyBallots(7, [{ VoteSelection: 'Approve' }, { VoteSelection: 'Deny' }, { VoteSelection: 'Abstain' }], 5);
    expect(tally).toEqual({ motionId: 7, approve: 1, deny: 1, abstain: 1, total: 3, eligible: 5 });
    expect(code(() => assertResultMatchesTally('Passed', tally, true))).toBe('VOTE_TALLY_CONFLICT');
    expect(code(() => assertResultMatchesTally('Failed', tally, true))).toBeUndefined();
    expect(code(() => assertResultMatchesTally('Tabled', tally, true))).toBeUndefined();
    // A voice vote (no smartphone ballot) is the chair's to record.
    expect(code(() => assertResultMatchesTally('Passed', tally, false))).toBeUndefined();
  });

  it('funds a passed request in full, rejects a failed one, and leaves a tabled one pending', () => {
    expect(charitableVoteOutcome('Passed', { AmountRequested: 800 })).toEqual({ VoteStatus: 'Approved', AmountApproved: 800 });
    expect(charitableVoteOutcome('Failed', { AmountRequested: 800 })).toEqual({ VoteStatus: 'Rejected', AmountApproved: 0 });
    expect(charitableVoteOutcome('Tabled', { AmountRequested: 800 })).toBeNull();
  });

  it('keys the ballot hash with a secret, so the tables alone cannot name a voter', () => {
    expect(ballotHashInput('s1', 4, 3)).not.toBe(ballotHashInput('s2', 4, 3));
    expect(ballotHashInput('s1', 4, 3)).not.toBe(ballotHashInput('s1', 4, 2));
  });
});

describe.each(drivers)('live assembly ($name driver)', (d) => {
  it('starts the console for the chair only, locking the Active roster count', async () => {
    const db = await d.make();
    const { meetingId } = await meetingWithMotions(db);
    await expectRule(db.meetings.startLiveAssemblyConsole(MEMBER.member, meetingId), 'ADMIN_REQUIRED');
    await expectRule(db.meetings.startLiveAssemblyConsole(9999, meetingId), 'MEMBER_NOT_FOUND');
    await expectRule(db.meetings.startLiveAssemblyConsole(MEMBER.admin, 9999), 'MEETING_NOT_FOUND');
    const roster = (await db.members.listByCouncil(OWN, { activeOnly: true })).length;
    const state = await db.meetings.startLiveAssemblyConsole(MEMBER.admin, meetingId);
    expect(state).toMatchObject({ isLive: true, rosterCount: roster, checkedInCount: 0, activeItem: null, viewerCheckedIn: false });
    expect(state.meeting.IsLiveInProgress).toBe(1);
    // Starting again changes nothing.
    expect((await db.meetings.startLiveAssemblyConsole(MEMBER.superAdmin, meetingId)).rosterCount).toBe(roster);
  });

  it('pushes agenda items to the center bar only while live', async () => {
    const db = await d.make();
    const { meetingId } = await meetingWithMotions(db);
    await expectRule(db.meetings.advanceActiveAgendaItem(MEMBER.admin, meetingId, 'Opening prayer', 5), 'LIVE_ASSEMBLY_CONFLICT');
    await db.meetings.startLiveAssemblyConsole(MEMBER.admin, meetingId);
    await expectRule(db.meetings.advanceActiveAgendaItem(MEMBER.admin, meetingId, 'Opening prayer', 0), 'INVALID_INPUT');
    await expectRule(db.meetings.advanceActiveAgendaItem(MEMBER.member, meetingId, 'Opening prayer', 5), 'ADMIN_REQUIRED');
    await db.meetings.advanceActiveAgendaItem(MEMBER.admin, meetingId, 'Opening prayer', 5);
    const state = await db.meetings.advanceActiveAgendaItem(MEMBER.admin, meetingId, "Treasurer's report", 10);
    expect(state.activeItem).toMatchObject({ name: "Treasurer's report", allottedMinutes: 10, secondsRemaining: 600 });
    // Every member's phone reads the same bar.
    expect((await db.meetings.getLiveAssemblyState(MEMBER.member, meetingId)).activeItem?.name).toBe("Treasurer's report");
  });

  it('checks members in whatever they answered, once, and marks the invitation attended', async () => {
    const db = await d.make();
    const { meetingId } = await meetingWithMotions(db);
    await expectRule(db.meetings.logLiveAttendanceOverride(MEMBER.member, meetingId, MEMBER.member), 'LIVE_ASSEMBLY_CONFLICT');
    await db.meetings.startLiveAssemblyConsole(MEMBER.admin, meetingId);
    const invite = (await db.meetings.listInvites(meetingId)).find((i) => i.MemberID === MEMBER.member);
    expect(invite).toBeDefined();
    // The member had declined; checking in overrides it.
    if (d.name === 'memory') {
      (db as MemoryDataService).debugStore.rows('MeetingInvites').find((i) => i.id === invite!.id)!.ResponseStatus = 'Declined';
    } else {
      openDatabases.at(-1)!.prepare("UPDATE [MeetingInvites] SET [ResponseStatus] = 'Declined' WHERE [id] = ?").run(invite!.id);
    }
    const first = await db.meetings.logLiveAttendanceOverride(MEMBER.member, meetingId, MEMBER.member);
    expect(first).toMatchObject({ CouncilID: OWN, MeetingID: meetingId, MemberID: MEMBER.member });
    expect((await db.meetings.logLiveAttendanceOverride(MEMBER.member, meetingId, MEMBER.member)).id).toBe(first.id);
    expect((await db.meetings.listInvites(meetingId)).find((i) => i.MemberID === MEMBER.member)).toMatchObject({ Attended: 1, ResponseStatus: 'Accepted' });

    // A plain member cannot check someone else in; the chair can.
    await expectRule(db.meetings.logLiveAttendanceOverride(MEMBER.member, meetingId, MEMBER.admin), 'ADMIN_REQUIRED');
    await db.meetings.logLiveAttendanceOverride(MEMBER.superAdmin, meetingId, MEMBER.admin);
    const state = await db.meetings.getLiveAssemblyState(MEMBER.member, meetingId);
    expect([state.checkedInCount, state.viewerCheckedIn]).toEqual([2, true]);
    expect(d.count(db, 'LiveAttendance')).toBe(2);
  });

  it('runs a secret ballot: checked-in members vote once, anonymously, and the tally updates live', async () => {
    const db = await d.make();
    const { meetingId, motionIds } = await meetingWithMotions(db, 2);
    const [motion, other] = motionIds;
    await expectRule(db.meetings.launchSecretSmartphoneBallot(MEMBER.admin, motion), 'LIVE_ASSEMBLY_CONFLICT');
    await db.meetings.startLiveAssemblyConsole(MEMBER.admin, meetingId);
    await expectRule(db.meetings.castAnonymousMobileVote(MEMBER.member, OWN, motion, 'Approve'), 'BALLOT_STATE_CONFLICT');
    const launched = await db.meetings.launchSecretSmartphoneBallot(MEMBER.admin, motion);
    expect(launched.motions.map((m) => m.ballotOpen)).toEqual([true, false]);
    await expectRule(db.meetings.launchSecretSmartphoneBallot(MEMBER.admin, other), 'BALLOT_STATE_CONFLICT');
    await expectRule(db.meetings.launchSecretSmartphoneBallot(MEMBER.admin, motion), 'BALLOT_STATE_CONFLICT');

    await expectRule(db.meetings.castAnonymousMobileVote(MEMBER.member, OWN, motion, 'Approve'), 'NOT_CHECKED_IN');
    for (const id of [MEMBER.superAdmin, MEMBER.admin, MEMBER.member]) await db.meetings.logLiveAttendanceOverride(id, meetingId, id);
    await expectRule(db.meetings.castAnonymousMobileVote(MEMBER.member, OWN, motion, 'Maybe' as never), 'INVALID_INPUT');
    await expectRule(db.meetings.castAnonymousMobileVote(MEMBER.member, 2, motion, 'Approve'), 'RECORD_NOT_FOUND');

    expect(await db.meetings.castAnonymousMobileVote(MEMBER.member, OWN, motion, 'Approve')).toEqual({ motionId: motion, approve: 1, deny: 0, abstain: 0, total: 1, eligible: 3 });
    await expectRule(db.meetings.castAnonymousMobileVote(MEMBER.member, OWN, motion, 'Deny'), 'BALLOT_ALREADY_CAST');
    await db.meetings.castAnonymousMobileVote(MEMBER.admin, OWN, motion, 'Deny');
    const tally = await db.meetings.castAnonymousMobileVote(MEMBER.superAdmin, OWN, motion, 'Approve');
    expect(tally).toMatchObject({ approve: 2, deny: 1, abstain: 0, total: 3 });

    // The rows name nobody: no member id, and not a plain hash of the motion and member.
    const rows = ballots(d, db);
    expect(rows).toHaveLength(3);
    const naive = await Promise.all([MEMBER.superAdmin, MEMBER.admin, MEMBER.member].map((id) => sha256Hex(`${motion}:${id}`)));
    for (const r of rows) {
      expect(r.AnonymousBallotHash).toMatch(/^[0-9a-f]{64}$/);
      expect(naive).not.toContain(r.AnonymousBallotHash);
      expect(Object.keys(r)).not.toContain('MemberID');
    }
    const viewer = await db.meetings.getLiveAssemblyState(MEMBER.member, meetingId);
    expect(viewer.motions.map((m) => m.viewerHasVoted)).toEqual([true, false]);
    expect(viewer.motions[0].tally).toMatchObject({ approve: 2, deny: 1 });
  });

  it('decides the motion against the ballot and sends a passed gift to the funding queue', async () => {
    const db = await d.make();
    const { meetingId, motionIds, requestIds } = await meetingWithMotions(db, 3);
    const [passing, failing, tabling] = motionIds;
    await db.meetings.startLiveAssemblyConsole(MEMBER.admin, meetingId);
    for (const id of [MEMBER.superAdmin, MEMBER.admin, MEMBER.member]) await db.meetings.logLiveAttendanceOverride(id, meetingId, id);
    await db.meetings.launchSecretSmartphoneBallot(MEMBER.admin, passing);
    await db.meetings.castAnonymousMobileVote(MEMBER.member, OWN, passing, 'Approve');
    await db.meetings.castAnonymousMobileVote(MEMBER.admin, OWN, passing, 'Abstain');

    await expectRule(db.meetings.closeLiveAssemblyConsole(MEMBER.admin, meetingId), 'BALLOT_STATE_CONFLICT');
    await expectRule(db.meetings.finalizeProposedMotionVote(MEMBER.admin, passing, 'Failed'), 'VOTE_TALLY_CONFLICT');
    await expectRule(db.meetings.finalizeProposedMotionVote(MEMBER.member, passing, 'Passed'), 'ADMIN_REQUIRED');
    await expectRule(db.meetings.finalizeProposedMotionVote(MEMBER.admin, passing, 'Approved' as never), 'INVALID_INPUT');
    const passed = await db.meetings.finalizeProposedMotionVote(MEMBER.admin, passing, 'Passed');
    expect(passed.motion.VoteResult).toBe('Passed');
    expect(passed.tally).toMatchObject({ approve: 1, deny: 0, abstain: 1 });
    expect(passed.charitableRequest).toMatchObject({ id: requestIds[0], VoteStatus: 'Approved', AmountApproved: 800 });
    await expectRule(db.meetings.finalizeProposedMotionVote(MEMBER.admin, passing, 'Tabled'), 'MOTION_STATUS_CONFLICT');
    await expectRule(db.meetings.castAnonymousMobileVote(MEMBER.superAdmin, OWN, passing, 'Approve'), 'BALLOT_STATE_CONFLICT');

    // A voice vote needs no ballot; the chair records it.
    expect((await db.meetings.finalizeProposedMotionVote(MEMBER.admin, failing, 'Failed')).charitableRequest).toMatchObject({ VoteStatus: 'Rejected', AmountApproved: 0 });
    expect((await db.meetings.finalizeProposedMotionVote(MEMBER.admin, tabling, 'Tabled')).charitableRequest).toMatchObject({ VoteStatus: 'Pending' });

    const queue = await db.charities.listApprovedFundingQueue(MEMBER.admin, OWN);
    expect(queue.map((r) => [r.id, r.AmountApproved])).toEqual([[requestIds[0], 800]]);
    await expectRule(db.charities.listApprovedFundingQueue(MEMBER.member, OWN), 'ADMIN_REQUIRED');

    const closed = await db.meetings.closeLiveAssemblyConsole(MEMBER.admin, meetingId);
    expect(closed).toMatchObject({ isLive: false, activeItem: null, checkedInCount: 3 });
    expect(closed.rosterCount).toBeGreaterThan(0);
    await expectRule(db.meetings.logLiveAttendanceOverride(MEMBER.member, meetingId, MEMBER.member), 'LIVE_ASSEMBLY_CONFLICT');
  });

  it('lets only the council follow its meeting', async () => {
    const db = await d.make();
    const { meetingId } = await meetingWithMotions(db);
    const other = await db.councils.create(MEMBER.superAdmin, { CouncilNumber: 99009, CouncilName: 'Elsewhere', State: 'OR' });
    const types = await db.lookups.list('MemberType');
    const statuses = await db.lookups.list('MemberStatus');
    const outsider = await db.members.create(MEMBER.superAdmin, {
      CouncilID: other.id,
      MemberNumber: 7712345,
      MemberFirstName: 'Visiting',
      MemberLastName: 'Knight',
      Phone: '503-555-0111',
      StreetAddress1: '9 Elm St',
      City: 'Salem',
      State: 'OR',
      ZipCode: '97301',
      Email: 'visiting.knight@example.org',
      DateOfBirth: '1971-01-01',
      StatusID: statuses.find((s) => s.Status === 'Active')!.id,
      DegreeID: 3,
      MemberTypeID: types.find((t) => t.Type === 'Member')!.id,
    });
    await expectRule(db.meetings.getLiveAssemblyState(outsider.id, meetingId), 'COUNCIL_ACCESS_DENIED');
    await db.meetings.startLiveAssemblyConsole(MEMBER.admin, meetingId);
    await expectRule(db.meetings.logLiveAttendanceOverride(outsider.id, meetingId, outsider.id), 'NOT_ACTIVE_COUNCIL_MEMBER');
    expect((await db.meetings.getLiveAssemblyState(MEMBER.superAdmin, meetingId)).isLive).toBe(true);
  });

  it('keeps ballots secret between services with different keys', async () => {
    const db = await d.make();
    const { meetingId, motionIds } = await meetingWithMotions(db);
    await db.meetings.startLiveAssemblyConsole(MEMBER.admin, meetingId);
    await db.meetings.logLiveAttendanceOverride(MEMBER.member, meetingId, MEMBER.member);
    await db.meetings.launchSecretSmartphoneBallot(MEMBER.admin, motionIds[0]);
    await db.meetings.castAnonymousMobileVote(MEMBER.member, OWN, motionIds[0], 'Approve');
    const [row] = ballots(d, db);
    // Someone holding the tables but not the key cannot rebuild the voter's hash.
    expect(row.AnonymousBallotHash).not.toBe(await sha256Hex(ballotHashInput('guessed-key', motionIds[0], MEMBER.member)));
  });
});

describe('ledger drill-down event names', () => {
  it.each([
    ['memory', async () => {
      const db = new MemoryDataService({ now: () => new Date(NOW), presentationData: true });
      await db.init();
      return db as DataService;
    }],
    ['sqlite', async () => {
      openDatabases.length = 0;
      const db = new SqliteDataService({ now: () => new Date(NOW), presentationData: true });
      await db.init();
      return db as DataService;
    }],
  ] as const)('shows the full event name beside its id (%s)', async (_name, create) => {
    const db = await create();
    const ledger = await db.finance.getAccountLedger(MEMBER.admin, 1);
    const linked = ledger.rows.filter((r) => r.entry.LinkedEventID != null);
    expect(linked.length).toBeGreaterThan(0);
    for (const r of linked) expect(r.eventName).toBe((await db.events.get(r.entry.LinkedEventID!))!.EventName);
    expect(ledger.rows.filter((r) => r.entry.LinkedEventID == null).every((r) => r.eventName === null)).toBe(true);
  });
});
