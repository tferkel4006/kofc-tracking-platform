// Sprint 6B Patch: last-minute agenda lines, the agenda line on the floor (the phones' focus frame), the New Member
// badge, and the Supreme roster sync with its welcome email (SendGrid request, one-time setup code).
import { describe, expect, it } from 'vitest';
import {
  APP_DISTRIBUTION,
  buildSendGridMailRequest,
  buildWelcomeEmail,
  BusinessRuleError,
  cleanAgendaLineKey,
  cleanSupremeRosterRow,
  ENROLLMENT_CODE_LIFETIME_DAYS,
  enrollmentCodeExpiry,
  formatEnrollmentCode,
  isEnrollmentTokenUsable,
  isNewMember,
  locateActiveAgendaLine,
  NEW_MEMBER_BADGE_DAYS,
  nextAgendaSortOrder,
  normalizeEnrollmentCode,
  parseSupremeRosterCsv,
  SENDGRID_KEY_PLACEHOLDER,
  withNewMemberBadge,
  type DataService,
  type NewMember,
  type NewCharitableRequest,
  type SendGridMailRequest,
  type SupremeRosterRow,
} from '@kofc/shared';
import { MemoryDataService } from '../apps/web/services/drivers/memory';
import { SqliteDataService } from '../apps/mobile/services/drivers/sqlite';
import { drivers, expectRule, MEMBER, NOW } from './helpers';
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

/** A service of each driver whose welcome emails land in `sent` instead of the log. */
async function makeWithMail(name: 'memory' | 'sqlite'): Promise<{ db: DataService; sent: SendGridMailRequest[] }> {
  const sent: SendGridMailRequest[] = [];
  const options = { now: () => new Date(NOW), sendEmail: async (r: SendGridMailRequest) => void sent.push(r) };
  if (name === 'memory') {
    const db = new MemoryDataService(options);
    await db.init();
    return { db, sent };
  }
  openDatabases.length = 0;
  const db = new SqliteDataService(options);
  await db.init();
  return { db, sent };
}

const setupCodeIn = (r: SendGridMailRequest): string => /one-time setup code: (\S+)/.exec(r.body.content[0]!.value)![1]!;

const newMember = (over: Partial<NewMember> = {}): NewMember => ({
  CouncilID: OWN,
  MemberNumber: 7000001,
  MemberFirstName: 'Luke',
  MemberLastName: 'Newman',
  Phone: '503-555-0100',
  StreetAddress1: '1 Cathedral Way',
  City: 'Portland',
  State: 'OR',
  ZipCode: '97201',
  Email: 'luke.newman@example.org',
  DateOfBirth: '1990-04-02',
  StatusID: 1,
  DegreeID: 1,
  MemberTypeID: 3,
  DateJoinedCouncil: '2026-09-01',
  ...over,
});

const rosterRow = (over: Partial<SupremeRosterRow> = {}): SupremeRosterRow => ({
  MemberNumber: 8100001,
  MemberFirstName: 'Mark',
  MemberLastName: 'Pius',
  Email: 'mark.pius@example.org',
  Phone: '503-555-0111',
  StreetAddress1: '2 Cathedral Way',
  City: 'Portland',
  State: 'OR',
  ZipCode: '97201',
  DateOfBirth: '1985-06-01',
  DegreeID: 1,
  DateJoinedCouncil: '2026-09-15',
  ...over,
});

describe('new member badge and onboarding rules (pure)', () => {
  it('shows the badge for 180 days from the join day (day 1) and drops it on day 181', () => {
    expect(NEW_MEMBER_BADGE_DAYS).toBe(180);
    const m = { DateJoinedCouncil: '2026-01-01' };
    expect(isNewMember(m, '2026-01-01')).toBe(true); // day 1
    expect(isNewMember(m, '2026-06-29')).toBe(true); // day 180
    expect(isNewMember(m, '2026-06-30')).toBe(false); // day 181
    expect(isNewMember(m, '2025-12-31')).toBe(false); // not joined yet
    expect(isNewMember({ DateJoinedCouncil: null }, '2026-01-01')).toBe(false);
    expect(isNewMember(undefined, '2026-01-01')).toBe(false);
    expect(isNewMember(m, new Date(2026, 5, 29, 23, 59))).toBe(true);
    expect(withNewMemberBadge('Newman, Luke', m, '2026-02-01')).toBe('Newman, Luke [🆕 New Member]');
    expect(withNewMemberBadge('Newman, Luke', m, '2026-08-01')).toBe('Newman, Luke');
  });

  it('formats setup codes for typing, reads them back forgivingly, and expires them', () => {
    const c = formatEnrollmentCode(new Uint8Array(Array.from({ length: 20 }, (_, i) => i * 13)));
    expect(c).toMatch(/^[0-9A-HJKMNP-TV-Z]{5}(-[0-9A-HJKMNP-TV-Z]{5}){3}$/);
    expect(normalizeEnrollmentCode(` ${c.toLowerCase().replace(/-/g, ' ')} `)).toBe(c.replace(/-/g, ''));
    expect(normalizeEnrollmentCode('O0-IL')).toBe('0011');
    expect(enrollmentCodeExpiry(new Date(Date.UTC(2026, 9, 6, 12)))).toBe('2026-10-20 12:00:00');
    expect(ENROLLMENT_CODE_LIFETIME_DAYS).toBe(14);
    const token = { ExpiresAt: '2026-10-20 12:00:00', ConsumedAt: null };
    expect(isEnrollmentTokenUsable(token, new Date(Date.UTC(2026, 9, 20, 11, 59)))).toBe(true);
    expect(isEnrollmentTokenUsable(token, new Date(Date.UTC(2026, 9, 20, 12, 0)))).toBe(false);
    expect(isEnrollmentTokenUsable({ ...token, ConsumedAt: '2026-10-07 09:00:00' }, new Date(Date.UTC(2026, 9, 8)))).toBe(false);
  });

  it('writes the welcome email with the Expo Go steps and the setup code, as a SendGrid request without the key', () => {
    const packet = buildWelcomeEmail({
      member: { id: 9, Email: 'luke.newman@example.org', MemberFirstName: 'Luke' },
      council: { CouncilNumber: 15295, CouncilName: 'St. Jude' },
      admin: null,
      enrollment: { code: 'ABCDE-FGHJK-MNPQR-STVWX', expiresAt: '2026-10-20 12:00:00' },
    });
    expect(packet.email.text).toContain(APP_DISTRIBUTION.expoGoIos);
    expect(packet.email.text).toContain(APP_DISTRIBUTION.expoGoAndroid);
    expect(packet.email.text).toContain('one-time setup code: ABCDE-FGHJK-MNPQR-STVWX');
    const request = buildSendGridMailRequest(packet.email);
    expect(request).toMatchObject({
      method: 'POST',
      url: 'https://api.sendgrid.com/v3/mail/send',
      headers: { Authorization: `Bearer ${SENDGRID_KEY_PLACEHOLDER}` },
      body: { personalizations: [{ to: [{ email: 'luke.newman@example.org' }] }], subject: packet.email.subject },
    });
    expect(request.body.attachments).toBeUndefined();
  });

  it("reads Supreme's roster export and checks each row as a new member", () => {
    const rows = parseSupremeRosterCsv(
      'Member Number,First Name,Last Name,E-mail,Phone,Street,City,State,Zip,Birth Date,Degree,Date Joined\r\n' +
        '8100001,Mark,Pius,mark.pius@example.org,503-555-0111,"2 Cathedral Way, Apt 3",Portland,OR,97201,1985-06-01,2,2026-09-15\r\n\r\n',
    );
    expect(rows).toEqual([
      expect.objectContaining({ MemberNumber: 8100001, StreetAddress1: '2 Cathedral Way, Apt 3', DegreeID: 2, DateJoinedCouncil: '2026-09-15' }),
    ]);
    expect(code(() => parseSupremeRosterCsv('First Name,Last Name\nA,B'))).toBe('INVALID_INPUT');
    expect(code(() => parseSupremeRosterCsv(''))).toBe('INVALID_INPUT');
    const ids = { activeStatusId: 1, memberTypeId: 3 };
    expect(cleanSupremeRosterRow(rosterRow({ DegreeID: null }), OWN, ids, NOW)).toMatchObject({ DegreeID: 1, StatusID: 1, MemberTypeID: 3, DateJoinedCouncil: '2026-09-15' });
    expect(code(() => cleanSupremeRosterRow(rosterRow({ DegreeID: 5 }), OWN, ids, NOW))).toBe('INVALID_INPUT');
    expect(code(() => cleanSupremeRosterRow(rosterRow({ DateJoinedCouncil: '' }), OWN, ids, NOW))).toBe('INVALID_DATE');
    expect(code(() => cleanSupremeRosterRow(rosterRow({ DateJoinedCouncil: '2026-12-01' }), OWN, ids, NOW))).toBe('INVALID_INPUT');
  });

  it('puts a last-minute line after everything in its section and names the line on the floor', () => {
    const items = [
      { SectionKey: 'new_business' as const, SortOrder: 2 },
      { SectionKey: 'opening' as const, SortOrder: 7 },
    ];
    expect(nextAgendaSortOrder('opening', items, [4])).toBe(8);
    expect(nextAgendaSortOrder('new_business', items, [4])).toBe(10_005);
    expect(nextAgendaSortOrder('good_of_order', items, [])).toBe(1);
    expect(cleanAgendaLineKey('motion:12')).toBe('motion:12');
    expect(cleanAgendaLineKey(null)).toBeNull();
    for (const bad of ['line:1', 'item:0', 'item:x', 7]) expect(code(() => cleanAgendaLineKey(bad))).toBe('INVALID_INPUT');
    const view = { sections: [{ lines: [{ key: 'item:1' }] }, { lines: [{ key: 'item:2' }, { key: 'motion:3' }] }] } as never;
    expect(locateActiveAgendaLine(view, 'motion:3')).toEqual({ sectionIndex: 1, lineKey: 'motion:3' });
    expect(locateActiveAgendaLine(view, 'item:9')).toBeNull();
    expect(locateActiveAgendaLine(view, null)).toBeNull();
  });
});

/** The October 6 Monthly meeting with one charitable motion routed onto it. */
async function meetingWithMotion(db: DataService): Promise<{ meetingId: number; motionId: number }> {
  await db.meetings.populateAnnualCadence(MEMBER.superAdmin, OWN, CADENCE, '2026-2027');
  const form: NewCharitableRequest = { OrganizationName: 'Cathedral Youth', AmountRequested: 500, RelationshipTypeID: 1, Is501c3: true };
  const { request } = await db.charities.submitCharitableRequest(MEMBER.member, form);
  await db.charities.triageRequestStatus(MEMBER.admin, request.id, { action: 'claim' });
  await db.charities.triageRequestStatus(MEMBER.admin, request.id, { action: 'advance' });
  const routed = await db.charities.routeRequestToNextEligibleAgenda(MEMBER.admin, request.id);
  return { meetingId: routed.meeting.id, motionId: routed.motion.id };
}

describe.each(drivers)('last-minute lines and the line on the floor ($name driver)', (d) => {
  it('adds a blank line at the end of a section for the editors, which every reader then sees', async () => {
    const db = await d.make();
    const { meetingId, motionId } = await meetingWithMotion(db);
    await db.meetings.applyAgendaBlueprint(MEMBER.superAdmin, meetingId);
    await expectRule(db.meetings.addAgendaLine(MEMBER.member, meetingId, 'new_business'), 'AGENDA_EDITOR_REQUIRED');
    await expectRule(db.meetings.addAgendaLine(MEMBER.superAdmin, meetingId, 'any_other_business' as never), 'INVALID_INPUT');
    await expectRule(db.meetings.addAgendaLine(MEMBER.superAdmin, 9999, 'opening'), 'MEETING_NOT_FOUND');

    const { agenda, line } = await db.meetings.addAgendaLine(MEMBER.superAdmin, meetingId, 'new_business');
    expect(line).toMatchObject({ section: 'new_business', markdown: '', ref: { kind: 'item' } });
    // It comes after the motion New Business already lists.
    expect(agenda.sections.find((s) => s.key === 'new_business')!.lines.map((l) => l.key)).toEqual([`motion:${motionId}`, line.key]);
    const opening = (await db.meetings.addAgendaLine(MEMBER.superAdmin, meetingId, 'opening')).line;
    const openingKeys = (await db.meetings.getMeetingAgenda(MEMBER.member, meetingId)).sections[0]!.lines.map((l) => l.key);
    expect(openingKeys.at(-1)).toBe(opening.key);

    await db.meetings.editAgendaLine(MEMBER.superAdmin, meetingId, line.ref, '**Motion from the floor:** a Rosary rally in November');
    const read = await db.meetings.getMeetingAgenda(MEMBER.member, meetingId);
    expect(read.sections.find((s) => s.key === 'new_business')!.lines.at(-1)!.markdown).toContain('Rosary rally');
  });

  it('records which agenda line is on the floor, for the phones to frame, and clears it with the console', async () => {
    const db = await d.make();
    const { meetingId } = await meetingWithMotion(db);
    const agenda = await db.meetings.applyAgendaBlueprint(MEMBER.superAdmin, meetingId);
    const treasurer = agenda.sections[1]!.lines[3]!;
    await db.meetings.startLiveAssemblyConsole(MEMBER.admin, meetingId);
    await expectRule(db.meetings.advanceActiveAgendaItem(MEMBER.admin, meetingId, 'Report', 5, { lineKey: 'line:3' }), 'INVALID_INPUT');

    await db.meetings.advanceActiveAgendaItem(MEMBER.admin, meetingId, "Treasurer's Report", 5, { lineKey: treasurer.key });
    const phone = await db.meetings.getLiveAssemblyState(MEMBER.member, meetingId);
    expect(phone.activeItem).toMatchObject({ name: "Treasurer's Report", lineKey: treasurer.key });
    expect(locateActiveAgendaLine(await db.meetings.getMeetingAgenda(MEMBER.member, meetingId), phone.activeItem!.lineKey)).toEqual({
      sectionIndex: 1,
      lineKey: treasurer.key,
    });
    // A typed-in topic names no line.
    expect((await db.meetings.advanceActiveAgendaItem(MEMBER.admin, meetingId, 'Open floor', 5)).activeItem?.lineKey).toBeNull();
    await db.meetings.advanceActiveAgendaItem(MEMBER.admin, meetingId, "Treasurer's Report", 5, { lineKey: treasurer.key });
    const closed = await db.meetings.closeLiveAssemblyConsole(MEMBER.admin, meetingId);
    expect(closed.activeItem).toBeNull();
    expect(closed.meeting.ActiveAgendaLineKey ?? null).toBeNull();
  });
});

describe.each(['memory', 'sqlite'] as const)('new member onboarding (%s driver)', (name) => {
  it('stores the join date, welcomes the member by SendGrid with a setup code, and spends the code at sign-up', async () => {
    const { db, sent } = await makeWithMail(name);
    await expectRule(db.members.create(MEMBER.admin, newMember({ DateJoinedCouncil: '2026-12-01' })), 'INVALID_INPUT');
    await expectRule(db.members.create(MEMBER.admin, newMember({ DateJoinedCouncil: '1980-01-01' })), 'INVALID_INPUT');
    expect(sent).toHaveLength(0);

    const created = await db.members.create(MEMBER.admin, newMember());
    expect(created.DateJoinedCouncil).toBe('2026-09-01');
    expect(isNewMember(created, NOW)).toBe(true);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.body.personalizations[0]!.to[0]!.email).toBe('luke.newman@example.org');
    const setupCode = setupCodeIn(sent[0]!);

    // A wrong code registers nothing; the right one (typed loosely) registers and is spent.
    await expectRule(db.auth.signUp('luke.newman@example.org', 'a-strong-password', 'AAAAA-AAAAA-AAAAA-AAAAA'), 'ENROLLMENT_CODE_INVALID');
    expect(await db.auth.signIn('luke.newman@example.org', 'a-strong-password')).toBeNull();
    const session = await db.auth.signUp('luke.newman@example.org', 'a-strong-password', setupCode.toLowerCase());
    expect(session.memberId).toBe(created.id);
    // Somebody else's code does not work for this member, and (Sprint 6B Security) neither does no code at all.
    const other = await db.members.create(MEMBER.admin, newMember({ MemberNumber: 7000002, Email: 'paul.newman@example.org' }));
    await expectRule(db.auth.signUp('paul.newman@example.org', 'a-strong-password', setupCode), 'ENROLLMENT_CODE_INVALID');
    await expectRule(db.auth.signUp('paul.newman@example.org', 'a-strong-password', ''), 'ENROLLMENT_CODE_INVALID');
    expect((await db.auth.signUp('paul.newman@example.org', 'a-strong-password', setupCodeIn(sent[1]!))).memberId).toBe(other.id);
  });

  it("syncs Supreme's roster: new members are added and welcomed, known ones get their join date, bad rows are skipped", async () => {
    const { db, sent } = await makeWithMail(name);
    const known = (await db.members.get(MEMBER.member))!;
    await expectRule(db.supreme.syncSupremeRoster(MEMBER.member, OWN, [rosterRow()]), 'ADMIN_REQUIRED');

    const result = await db.supreme.syncSupremeRoster(MEMBER.admin, OWN, [
      rosterRow(),
      rosterRow({ MemberNumber: 8100002, Email: 'john.pius@example.org', MemberFirstName: 'John' }),
      rosterRow({ MemberNumber: 8100001, Email: 'twice@example.org' }), // the same member number again
      rosterRow({ MemberNumber: 8100003, Email: 'not-an-email' }),
      rosterRow({ MemberNumber: 8100004, Email: known.Email }), // an email already in use
      rosterRow({ MemberNumber: known.MemberNumber, Email: 'ignored@example.org', DateJoinedCouncil: '2026-08-20' }),
      { ...rosterRow(), MemberNumber: 0 },
    ]);
    expect(result.created.map((m) => [m.MemberNumber, m.DateJoinedCouncil, m.StatusID, m.MemberTypeID])).toEqual([
      [8100001, '2026-09-15', 1, 3],
      [8100002, '2026-09-15', 1, 3],
    ]);
    expect(result.updated.map((m) => [m.id, m.DateJoinedCouncil, m.Email])).toEqual([[known.id, '2026-08-20', known.Email]]);
    expect(result.skipped.map((s) => s.memberNumber)).toEqual([8100001, 8100003, 8100004, null]);
    // The welcome email goes to each new member, and only to them.
    expect(sent.map((r) => r.body.personalizations[0]!.to[0]!.email)).toEqual(['mark.pius@example.org', 'john.pius@example.org']);
    // New members appear on the roster with their badge; they register with their setup code.
    const roster = await db.members.listByCouncil(OWN);
    expect(roster.filter((m) => isNewMember(m, NOW)).map((m) => m.MemberNumber).sort()).toEqual([8100001, 8100002, known.MemberNumber].sort());
    expect((await db.auth.signUp('mark.pius@example.org', 'a-strong-password', setupCodeIn(sent[0]!))).memberId).toBe(result.created[0]!.id);

    // Syncing the same roster again changes nothing and sends nothing.
    const again = await db.supreme.syncSupremeRoster(MEMBER.admin, OWN, [rosterRow(), rosterRow({ MemberNumber: 8100002, Email: 'john.pius@example.org' })]);
    expect(again).toMatchObject({ created: [], updated: [], skipped: [] });
    expect(sent).toHaveLength(2);
  });
});

describe.each(drivers)('shift rosters carry the join date ($name driver)', (d) => {
  it('returns DateJoinedCouncil with each signup', async () => {
    const db = await d.make();
    let turnout: Awaited<ReturnType<DataService['events']['listTurnout']>> = [];
    for (const shift of await db.events.listShiftsBetween('2000-01-01', '2100-12-31')) {
      turnout = await db.events.listTurnout(shift.EventID);
      if (turnout.length) break;
    }
    expect(turnout.length).toBeGreaterThan(0);
    for (const row of turnout) expect(row).toHaveProperty('DateJoinedCouncil', null);
  });
});
