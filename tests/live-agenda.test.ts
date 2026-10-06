// Sprint 6B: the St. Mary's live agenda (sections, blueprint, seat-holder speakers, live line corrections, generated
// motion and event lines) and the Recorder's hand-vote tally console (decision, status badge, ledger link).
import { describe, expect, it } from 'vitest';
import {
  AGENDA_SECTION_KEYS,
  AGENDA_UPCOMING_EVENTS_LIMIT,
  assertHandTallyAllowed,
  BusinessRuleError,
  canEditLiveAgenda,
  cleanHandTally,
  currentSeatHolder,
  defaultEventLine,
  handTallyResult,
  parseAgendaMarkdown,
  summarizeLedgerTransactions,
  type DataService,
  type JournalEntry,
  type MeetingAgendaView,
  type NewCharitableRequest,
} from '@kofc/shared';
import { MemoryDataService } from '../apps/web/services/drivers/memory';
import { SqliteDataService } from '../apps/mobile/services/drivers/sqlite';
import { drivers, expectRule, MEMBER, NOW, type DriverUnderTest } from './helpers';
import { openDatabases } from './shims/expo-sqlite';

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
  OrganizationName: 'St. Mary Youth Ministry',
  AmountRequested: 800,
  RelationshipTypeID: 1,
  Is501c3: true,
  ...over,
});

/** The October 6 Monthly meeting with `count` charitable motions routed onto it. */
async function meetingWithMotions(db: DataService, count = 1): Promise<{ meetingId: number; motionIds: number[] }> {
  await db.meetings.populateAnnualCadence(MEMBER.superAdmin, OWN, CADENCE, '2026-2027');
  const motionIds: number[] = [];
  let meetingId = 0;
  for (let i = 0; i < count; i++) {
    const { request } = await db.charities.submitCharitableRequest(MEMBER.member, form({ OrganizationName: `Ministry ${i + 1}` }));
    await db.charities.triageRequestStatus(MEMBER.admin, request.id, { action: 'claim' });
    await db.charities.triageRequestStatus(MEMBER.admin, request.id, { action: 'advance' });
    const routed = await db.charities.routeRequestToNextEligibleAgenda(MEMBER.admin, request.id);
    meetingId = routed.meeting.id;
    motionIds.push(routed.motion.id);
  }
  return { meetingId, motionIds };
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

const section = (view: MeetingAgendaView, key: string) => view.sections.find((s) => s.key === key)!;

describe('live agenda rules (pure)', () => {
  it('counts hands as whole numbers and decides more Approved than Denied', () => {
    expect(cleanHandTally(18, 3)).toEqual({ approved: 18, denied: 3 });
    expect(cleanHandTally(0, 4)).toEqual({ approved: 0, denied: 4 });
    for (const [a, b] of [[0, 0], [-1, 3], [2.5, 1], [10000, 0], ['5', 1]] as const) expect(code(() => cleanHandTally(a, b))).toBe('INVALID_INPUT');
    expect(handTallyResult(18, 3)).toBe('Passed');
    expect(handTallyResult(5, 5)).toBe('Failed');
    expect(handTallyResult(2, 9)).toBe('Failed');
  });

  it('takes a hand tally only on a pending motion that never went to a smartphone ballot', () => {
    expect(code(() => assertHandTallyAllowed({ id: 1, VoteResult: 'Pending', BallotOpenedAt: null }))).toBeUndefined();
    expect(code(() => assertHandTallyAllowed({ id: 1, VoteResult: 'Passed', BallotOpenedAt: null }))).toBe('MOTION_STATUS_CONFLICT');
    expect(code(() => assertHandTallyAllowed({ id: 1, VoteResult: 'Pending', BallotOpenedAt: '2026-10-06 19:40:00' }))).toBe('BALLOT_STATE_CONFLICT');
  });

  it('shows the newest Active holder of a shared seat in the meeting council', () => {
    const members = new Map([
      [1, { id: 1, CouncilID: 1, MemberFirstName: 'Old', MemberLastName: 'Holder', active: true }],
      [2, { id: 2, CouncilID: 1, MemberFirstName: 'New', MemberLastName: 'Holder', active: true }],
      [3, { id: 3, CouncilID: 1, MemberFirstName: 'Gone', MemberLastName: 'Holder', active: false }],
      [4, { id: 4, CouncilID: 2, MemberFirstName: 'Other', MemberLastName: 'Council', active: true }],
    ]);
    const seats = [
      { id: 1, RoleID: 4, MemberID: 1 },
      { id: 5, RoleID: 4, MemberID: 2 },
      { id: 6, RoleID: 4, MemberID: 3 },
      { id: 7, RoleID: 4, MemberID: 4 },
    ];
    expect(currentSeatHolder(4, 1, seats, members)?.id).toBe(2);
    expect(currentSeatHolder(6, 1, seats, members)).toBeNull();
  });

  it('renders light markdown without HTML and announces events by name, dates and place', () => {
    expect(parseAgendaMarkdown('**Prayer Requests** for *all*\n- Dolores Redden\n\n* Mark Boshears\n<b>x</b>')).toEqual([
      { kind: 'paragraph', spans: [{ text: 'Prayer Requests', bold: true, italic: false }, { text: ' for ', bold: false, italic: false }, { text: 'all', bold: false, italic: true }] },
      { kind: 'bullet', spans: [{ text: 'Dolores Redden', bold: false, italic: false }] },
      { kind: 'bullet', spans: [{ text: 'Mark Boshears', bold: false, italic: false }] },
      { kind: 'paragraph', spans: [{ text: '<b>x</b>', bold: false, italic: false }] },
    ]);
    expect(defaultEventLine({ EventName: 'Coat Drive', StartDate: '2026-10-20', EndDate: '2026-10-21', Location: 'Hall' })).toBe('**Coat Drive** - 2026-10-20 to 2026-10-21 · Hall');
    expect(defaultEventLine({ EventName: 'Rosary', StartDate: '2026-10-20', EndDate: '2026-10-20', Location: '' })).toBe('**Rosary** - 2026-10-20');
  });

  it('sums each ledger posting once, newest first', () => {
    const line = (id: number, txn: string, date: string, debit: number, credit: number): JournalEntry =>
      ({ id, CouncilID: 1, GLAccountID: 1, DateLogged: date, Description: `Posting ${txn}`, DebitAmount: debit, CreditAmount: credit, IsBankReconciled: 0, TransactionID: txn }) as JournalEntry;
    const out = summarizeLedgerTransactions([line(1, 'a', '2026-09-01 00:00:00', 100, 0), line(2, 'a', '2026-09-01 00:00:00', 0, 100), line(3, 'b', '2026-09-05 00:00:00', 42.5, 0), line(4, 'b', '2026-09-05 00:00:00', 0, 42.5)]);
    expect(out.map((t) => [t.transactionId, t.amount, t.lineCount])).toEqual([['b', 42.5, 2], ['a', 100, 2]]);
  });

  it('lets the Grand Knight, the Recorder and Admins of the council edit the agenda', () => {
    const base = { memberId: 9, councilId: 1, memberType: 'Member' as const, isOfficer: true };
    expect(canEditLiveAgenda({ ...base, roles: ['Recorder'] }, { CouncilID: 1 })).toBe(true);
    expect(canEditLiveAgenda({ ...base, roles: ['Grand Knight'] }, { CouncilID: 1 })).toBe(true);
    expect(canEditLiveAgenda({ ...base, roles: ['Treasurer'] }, { CouncilID: 1 })).toBe(false);
    expect(canEditLiveAgenda({ ...base, roles: ['Recorder'] }, { CouncilID: 2 })).toBe(false);
    expect(canEditLiveAgenda({ ...base, memberType: 'Admin', roles: [] }, { CouncilID: 1 })).toBe(true);
  });
});

describe.each(drivers)('live agenda ($name driver)', (d) => {
  it('lays the St. Mary\'s blueprint out once, for the agenda\'s editors only', async () => {
    const db = await d.make();
    const { meetingId, motionIds } = await meetingWithMotions(db, 2);
    const bare = await db.meetings.getMeetingAgenda(MEMBER.member, meetingId);
    expect(bare.hasStructuredAgenda).toBe(false);
    expect(bare.sections.map((s) => s.key)).toEqual(AGENDA_SECTION_KEYS);
    // The motions show under New Business even before the agenda is laid out.
    expect(section(bare, 'new_business').lines.map((l) => l.key)).toEqual(motionIds.map((id) => `motion:${id}`));

    await expectRule(db.meetings.applyAgendaBlueprint(MEMBER.member, meetingId), 'AGENDA_EDITOR_REQUIRED');
    // The Financial Secretary is an Admin in the dev seed, so may lay it out too; the Super Admin is Grand Knight.
    const view = await db.meetings.applyAgendaBlueprint(MEMBER.superAdmin, meetingId);
    expect(view.hasStructuredAgenda).toBe(true);
    const callToOrder = section(view, 'opening').lines[0]!;
    expect(callToOrder.speaker).toMatchObject({ roleName: 'Grand Knight', memberId: MEMBER.superAdmin });
    // A vacant Chaplain's seat prints its label.
    expect(section(view, 'officer_reports').lines[0]!.speaker).toEqual({ name: 'Chaplain', roleName: 'Chaplain', memberId: null });
    expect(view.officers.find((o) => o.roleName === 'Financial Secretary')?.memberId).toBe(MEMBER.admin);
    await expectRule(db.meetings.applyAgendaBlueprint(MEMBER.admin, meetingId), 'AGENDA_CONFLICT');

    const upcoming = section(view, 'upcoming_events').lines;
    expect(upcoming.length).toBeLessThanOrEqual(AGENDA_UPCOMING_EVENTS_LIMIT);
    for (const l of upcoming) expect(l.event!.EndDate.slice(0, 10) >= view.meeting.Date.slice(0, 10)).toBe(true);
  });

  it('takes live corrections from the Recorder, keeping each line in place', async () => {
    const db = await d.make();
    const { meetingId, motionIds } = await meetingWithMotions(db, 1);
    const laid = await db.meetings.applyAgendaBlueprint(MEMBER.superAdmin, meetingId);
    const minutes = section(laid, 'opening').lines[3]!;
    expect(minutes.ref.kind).toBe('item');

    await expectRule(db.meetings.editAgendaLine(MEMBER.member, meetingId, minutes.ref, 'x'), 'AGENDA_EDITOR_REQUIRED');
    grantRole(d, db, MEMBER.member, 'Recorder');
    await expectRule(db.meetings.editAgendaLine(MEMBER.member, meetingId, minutes.ref, '   '), 'INVALID_INPUT');
    await expectRule(db.meetings.editAgendaLine(MEMBER.member, meetingId, { kind: 'item', itemId: 9999 }, 'x'), 'RECORD_NOT_FOUND');
    await expectRule(db.meetings.editAgendaLine(MEMBER.member, meetingId, { kind: 'event', eventId: 9999 }, 'x'), 'RECORD_NOT_FOUND');

    let view = await db.meetings.editAgendaLine(MEMBER.member, meetingId, minutes.ref, '**Minutes** of the *September* meeting - approved as read');
    const edited = section(view, 'opening').lines[3]!;
    expect(edited).toMatchObject({ key: minutes.key, markdown: '**Minutes** of the *September* meeting - approved as read', lastEditedAt: expect.any(String) });
    expect(edited.lastEditedByName).not.toBeNull();
    // The member who now holds the Recorder's seat speaks to the line.
    expect(edited.speaker).toMatchObject({ roleName: 'Recorder', memberId: MEMBER.member });

    // A generated motion line keeps its key and place once corrected.
    view = await db.meetings.editAgendaLine(MEMBER.member, meetingId, { kind: 'motion', motionId: motionIds[0]! }, '**Motion:** fund the youth ministry retreat');
    const motionLine = section(view, 'new_business').lines.find((l) => l.key === `motion:${motionIds[0]}`)!;
    expect(motionLine).toMatchObject({ markdown: '**Motion:** fund the youth ministry retreat', motion: { id: motionIds[0] } });
    view = await db.meetings.editAgendaLine(MEMBER.member, meetingId, { kind: 'motion', motionId: motionIds[0]! }, '**Motion:** again');
    expect(section(view, 'new_business').lines.filter((l) => l.key === `motion:${motionIds[0]}`)).toHaveLength(1);
    // Everyone following the meeting sees the corrections.
    expect(section(await db.meetings.getMeetingAgenda(MEMBER.admin, meetingId), 'opening').lines[3]!.markdown).toContain('approved as read');
  });

  it("records the Recorder's hand tally, decides the motion and links the capital it released", async () => {
    const db = await d.make();
    const { meetingId, motionIds } = await meetingWithMotions(db, 3);
    const [funded, split, balloted] = motionIds as [number, number, number];
    const posted = await db.finance.logDoubleEntryTransaction(MEMBER.admin, [
      { GLAccountID: 11, DebitAmount: 800, Description: 'Youth ministry gift', DateLogged: '2026-10-06' },
      { GLAccountID: 1, CreditAmount: 800, Description: 'Youth ministry gift', DateLogged: '2026-10-06' },
    ]);
    const txn = posted[0]!.TransactionID;
    expect((await db.finance.listLedgerTransactions(MEMBER.admin, OWN))[0]).toMatchObject({ transactionId: txn, amount: 800, lineCount: 2 });

    await expectRule(db.meetings.recordHandBallotTally(MEMBER.member, funded, 18, 3), 'AGENDA_EDITOR_REQUIRED');
    await expectRule(db.meetings.recordHandBallotTally(MEMBER.superAdmin, funded, 0, 0), 'INVALID_INPUT');
    await expectRule(db.meetings.recordHandBallotTally(MEMBER.superAdmin, 9999, 1, 0), 'RECORD_NOT_FOUND');
    await expectRule(db.meetings.recordHandBallotTally(MEMBER.superAdmin, funded, 18, 3, { transactionId: 'no-such-posting' }), 'RECORD_NOT_FOUND');
    // Capital is never tied to a motion that failed, and the refusal writes nothing.
    await expectRule(db.meetings.recordHandBallotTally(MEMBER.superAdmin, split, 4, 4, { transactionId: txn }), 'INVALID_INPUT');
    expect(d.count(db, 'MotionHandTally')).toBe(0);

    grantRole(d, db, MEMBER.member, 'Recorder');
    const recording = await db.meetings.recordHandBallotTally(MEMBER.member, funded, 18, 3, { transactionId: txn });
    expect(recording.tally).toMatchObject({ ApprovedCount: 18, DeniedCount: 3, RecordedByMemberID: MEMBER.member, LinkedTransactionID: txn });
    expect(recording.motion.VoteResult).toBe('Passed');
    expect(recording.charitableRequest).toMatchObject({ VoteStatus: 'Approved', AmountApproved: 800 });
    await expectRule(db.meetings.recordHandBallotTally(MEMBER.member, funded, 20, 1), 'MOTION_STATUS_CONFLICT');

    const tie = await db.meetings.recordHandBallotTally(MEMBER.member, split, 4, 4);
    expect(tie.motion.VoteResult).toBe('Failed');
    expect(tie.charitableRequest?.VoteStatus).toBe('Rejected');

    // A motion put to the smartphone ballot is decided by that ballot.
    await db.meetings.startLiveAssemblyConsole(MEMBER.admin, meetingId);
    await db.meetings.launchSecretSmartphoneBallot(MEMBER.admin, balloted);
    await expectRule(db.meetings.recordHandBallotTally(MEMBER.member, balloted, 9, 1), 'BALLOT_STATE_CONFLICT');

    // The status badges read the tally, on the live state and on the agenda.
    const state = await db.meetings.getLiveAssemblyState(MEMBER.admin, meetingId);
    expect(state.motions.find((m) => m.motion.id === funded)?.handTally).toMatchObject({ ApprovedCount: 18, DeniedCount: 3 });
    expect(state.motions.find((m) => m.motion.id === balloted)?.handTally).toBeNull();
    const line = section(await db.meetings.getMeetingAgenda(MEMBER.admin, meetingId), 'new_business').lines.find((l) => l.key === `motion:${funded}`)!;
    expect(line).toMatchObject({ motion: { VoteResult: 'Passed' }, handTally: { LinkedTransactionID: txn } });

    // The finance officers (or the editors) relink or unlink the posting later; nobody else may.
    await expectRule(db.meetings.linkHandTallyTransaction(MEMBER.admin, split, txn), 'INVALID_INPUT');
    await expectRule(db.meetings.linkHandTallyTransaction(MEMBER.admin, balloted, txn), 'RECORD_NOT_FOUND');
    expect((await db.meetings.linkHandTallyTransaction(MEMBER.admin, funded, null)).LinkedTransactionID).toBeNull();
    expect((await db.meetings.linkHandTallyTransaction(MEMBER.member, funded, txn)).LinkedTransactionID).toBe(txn);
  });
});

describe.each(drivers)("St. Mary's presentation agenda ($name driver)", (d) => {
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

  it('reads every speaker from the seats and members, and Brian Wolf records the budget vote by hand', async () => {
    const db = await makePresentation();
    const tom = (await db.auth.signIn('tom.gk@kofc15295.org', 'dev-pass-secure-9912'))!;
    const view = await db.meetings.getMeetingAgenda(tom.memberId, 1);
    expect(view.meeting).toMatchObject({ Date: '2026-10-06', Location: "St. Mary's Cathedral" });
    // The quorum base the seed locks matches the council's Active roster.
    expect(view.meeting.LiveQuorumRosterCount).toBe((await db.members.listByCouncil(OWN, { activeOnly: true })).length);

    const speakers = (key: string) => section(view, key).lines.map((l) => l.speaker?.name ?? null);
    expect(speakers('opening')).toEqual(['Tom McDougal', 'George Gurney', 'David Norman', 'Brian Wolf']);
    expect(speakers('officer_reports')).toEqual(['Monsignor', 'Tom McDougal', 'Council Admin', 'Bill Kehrli', 'State Deputy John Snyder']);
    expect(speakers('director_reports')).toEqual(['Hector Nunez', 'Alan Sanchez', 'Tim Ferkel', 'Matt Fife']);
    const prayer = section(view, 'good_of_order').lines[0]!;
    expect(parseAgendaMarkdown(prayer.markdown).filter((b) => b.kind === 'bullet').map((b) => b.spans[0]!.text)).toEqual([
      'Dolores Redden',
      'Mark Boshears',
      'Paul Wolf',
      'Paul Della',
    ]);

    const budget = section(view, 'old_business').lines[0]!;
    expect(budget.motion).toMatchObject({ MotionText: 'Vote on 2026-2027 Budget Proposed Changes', VoteResult: 'Pending' });
    const brian = (await db.auth.signIn('brian.recorder@kofc15295.org', 'dev-pass-secure-9912'))!;
    const recording = await db.meetings.recordHandBallotTally(brian.memberId, budget.motion!.id, 18, 3);
    expect(recording.motion.VoteResult).toBe('Passed');
    const after = section(await db.meetings.getMeetingAgenda(tom.memberId, 1), 'old_business').lines[0]!;
    expect(after.handTally).toMatchObject({ ApprovedCount: 18, DeniedCount: 3, RecordedByMemberID: brian.memberId });
  });
});
