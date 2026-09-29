// Sprint 5Y-6: multi-day meetings and events, council agenda templates (the Council Lookups tab and the schedule
// form's pre-fill), the RSVP status behind the phone's Count Me In toggle, and the matching screen permissions.
import { describe, expect, it } from 'vitest';
import {
  buildCalendarEntries,
  canManageAgendaTemplates,
  canOpenCouncilLookups,
  cleanMeetingSpan,
  formatMeetingWhen,
  globalMeetingTypeFor,
  mayManageAgendaTemplates,
  meetingEnd,
  meetingLastDate,
  MULTI_DAY_MEETING_TIME,
  withoutEndedMeetings,
  type DataService,
  type Meeting,
  type MeetingInviteMode,
  type NewMeeting,
} from '@kofc/shared';
import type { MemoryDataService } from '../apps/web/services/drivers/memory';
import { openDatabases } from './shims/expo-sqlite';
import { drivers, expectRule, MEMBER, type DriverUnderTest } from './helpers';

const OWN = 1; // Council 15295

/** Gives a member a Role straight in the backing store; the data service has no role-assignment method. */
function grantRole(d: DriverUnderTest, db: DataService, memberId: number, role: string): void {
  if (d.name === 'memory') {
    const store = (db as MemoryDataService).debugStore;
    store.insert('MemberRoles', { RoleID: store.rows('Role').find((r) => r.Role === role)!.id, MemberID: memberId });
  } else {
    openDatabases.at(-1)!.prepare('INSERT INTO [MemberRoles] ([RoleID], [MemberID]) SELECT [id], ? FROM [Role] WHERE [Role] = ?').run(memberId, role);
  }
}

const meetingRow = (over: Partial<Meeting>): Meeting => ({
  id: 1,
  CouncilID: OWN,
  'Meeting Name': 'State Convention',
  Date: '2026-10-08',
  'Time Start': '19:00:00',
  'Time End': '20:30:00',
  Location: 'Convention Center',
  MeetingType: 1,
  ...over,
});

async function newMeeting(db: DataService, over: Partial<NewMeeting> = {}, invite: MeetingInviteMode = 'none') {
  const type = (await db.lookups.list('MeetingType'))[0];
  return db.meetings.create(
    {
      OwnerID: null,
      CouncilID: OWN,
      'Meeting Name': 'State Convention',
      Date: '2026-10-08',
      'Time Start': '19:00:00',
      'Time End': '20:30:00',
      Location: 'Convention Center',
      MeetingType: type.id,
      ...over,
    },
    invite,
  );
}

describe('multi-day meetings (pure)', () => {
  it('stores a multi-day meeting without clock times and a one-day meeting without an end date', () => {
    expect(cleanMeetingSpan(meetingRow({}))).toEqual({ IsMultiDay: 0, EndDate: null, 'Time Start': '19:00:00', 'Time End': '20:30:00' });
    expect(cleanMeetingSpan(meetingRow({ IsMultiDay: 1, EndDate: '2026-10-10' }))).toEqual({
      IsMultiDay: 1,
      EndDate: '2026-10-10',
      'Time Start': MULTI_DAY_MEETING_TIME,
      'Time End': MULTI_DAY_MEETING_TIME,
    });
    expect(() => cleanMeetingSpan(meetingRow({ IsMultiDay: 1 }))).toThrow(/needs an end date/);
    expect(() => cleanMeetingSpan(meetingRow({ IsMultiDay: 1, EndDate: '2026-10-08' }))).toThrow(/must end/);
    expect(() => cleanMeetingSpan(meetingRow({ IsMultiDay: 0, EndDate: '2026-10-10' }))).toThrow(/Only a multi-day meeting/);
    expect(() => cleanMeetingSpan(meetingRow({ IsMultiDay: 2 }))).toThrow(/IsMultiDay/);
  });

  it('shows a multi-day meeting as its days, with no times, and ends it at midnight after the last day', () => {
    const assembly = meetingRow({ IsMultiDay: 1, EndDate: '2026-10-10', 'Time Start': '00:00:00', 'Time End': '00:00:00' });
    expect(formatMeetingWhen(assembly)).toBe('Thu, Oct 8 – Sat, Oct 10');
    expect(formatMeetingWhen(meetingRow({}))).toBe('Thu, Oct 8 · 7:00 PM – 8:30 PM');
    expect(meetingLastDate(assembly)).toBe('2026-10-10');
    expect(meetingEnd(assembly)).toEqual(new Date(2026, 9, 11));
    // On the second day it is still under way; a one-day meeting that evening has ended by the next day.
    expect(withoutEndedMeetings([assembly], new Date(2026, 9, 9, 12))).toHaveLength(1);
    expect(withoutEndedMeetings([meetingRow({})], new Date(2026, 9, 9, 12))).toHaveLength(0);
  });

  it('spans a multi-day meeting across the calendar, all day', () => {
    const assembly = meetingRow({ IsMultiDay: 1, EndDate: '2026-10-10' });
    const [entry] = buildCalendarEntries({ startDate: '2026-10-09', endDate: '2026-10-31' }, [], [assembly]);
    expect(entry).toMatchObject({ kind: 'meeting', startDate: '2026-10-08', endDate: '2026-10-10', startTime: null, endTime: null });
    expect(buildCalendarEntries({ startDate: '2026-10-09', endDate: '2026-10-31' }, [], [meetingRow({})])).toEqual([]);
  });

  it('files a council meeting type under the global category of the same name, or the first one', () => {
    const globals = [
      { id: 1, Type: 'Monthly' as const },
      { id: 2, Type: 'Officer' as const },
    ];
    expect(globalMeetingTypeFor('officer', globals)).toBe(2);
    expect(globalMeetingTypeFor('District Deputy Visit', globals)).toBe(1);
    expect(globalMeetingTypeFor('Monthly', [])).toBeUndefined();
  });
});

describe('agenda template permissions (pure)', () => {
  const user = (over: Partial<Parameters<typeof canManageAgendaTemplates>[0]>) => ({
    memberId: 9,
    councilId: OWN,
    memberType: 'Member' as const,
    isOfficer: false,
    roles: [] as string[],
    ...over,
  });

  it('opens the Meeting Agenda Templates tab to the council Admins, its Grand Knight and Super Admins', () => {
    expect(canManageAgendaTemplates(user({ memberType: 'Admin' }), OWN)).toBe(true);
    expect(canManageAgendaTemplates(user({ memberType: 'Admin' }), 2)).toBe(false);
    expect(canManageAgendaTemplates(user({ memberType: 'Super Admin' }), 2)).toBe(true);
    expect(canManageAgendaTemplates(user({ roles: ['Grand Knight'], isOfficer: true }), OWN)).toBe(true);
    expect(canManageAgendaTemplates(user({ roles: ['Grand Knight'], isOfficer: true }), 2)).toBe(false);
    expect(canManageAgendaTemplates(user({ roles: ['Treasurer'], isOfficer: true }), OWN)).toBe(false);
    expect(canManageAgendaTemplates(user({}), OWN)).toBe(false);
  });

  it('lets a Grand Knight open Council Lookups, and mirrors the driver rule', () => {
    expect(canOpenCouncilLookups(user({ roles: ['Grand Knight'], isOfficer: true }))).toBe(true);
    expect(canOpenCouncilLookups(user({}))).toBe(false);
    const actor = { memberId: 9, councilId: OWN, memberType: 'Member', active: true, roles: ['Grand Knight'] };
    expect(mayManageAgendaTemplates(actor, OWN)).toBe(true);
    expect(mayManageAgendaTemplates({ ...actor, active: false }, OWN)).toBe(false);
    expect(mayManageAgendaTemplates({ ...actor, roles: [] }, OWN)).toBe(false);
  });
});

describe.each(drivers)('$name driver: multi-day meetings and council meeting types', (d) => {
  it('creates a multi-day assembly filed under a council meeting type', async () => {
    const db = await d.make();
    const monthly = (await db.meetings.listCouncilMeetingTypes(OWN)).find((t) => t.TypeName === 'Monthly')!;
    const meeting = await newMeeting(db, { IsMultiDay: 1, EndDate: '2026-10-10', MeetingTypeID: monthly.id });
    expect(meeting).toMatchObject({ IsMultiDay: 1, EndDate: '2026-10-10', MeetingTypeID: monthly.id, 'Time Start': '00:00:00', 'Time End': '00:00:00' });
    // It counts no meeting hours.
    await db.meetings.invite(meeting.id, [MEMBER.member]);
    await db.meetings.setAttended(meeting.id, MEMBER.member, true);
    expect((await db.meetings.memberHours(MEMBER.member)).meetings.find((m) => m.meetingId === meeting.id)?.hours).toBe(0);
  });

  it('refuses a bad span or another council’s meeting type, writing nothing', async () => {
    const db = await d.make();
    const meetings = d.count(db, 'Meeting');
    await expectRule(newMeeting(db, { IsMultiDay: 1 }), 'INVALID_INPUT');
    await expectRule(newMeeting(db, { IsMultiDay: 1, EndDate: '2026-10-07' }), 'INVALID_INPUT');
    await expectRule(newMeeting(db, { EndDate: '2026-10-10' }), 'INVALID_INPUT');
    const other = await db.councils.create(MEMBER.superAdmin, { CouncilNumber: 99005, CouncilName: 'Other Council', State: 'OR' });
    const monthly = (await db.meetings.listCouncilMeetingTypes(OWN))[0];
    await expectRule(newMeeting(db, { CouncilID: other.id, MeetingTypeID: monthly.id }), 'INVALID_INPUT');
    await expectRule(newMeeting(db, { MeetingTypeID: 9999 }), 'INVALID_INPUT');
    expect(d.count(db, 'Meeting')).toBe(meetings);
  });

  it('keeps a multi-day meeting upcoming and on the calendar until its last day has passed', async () => {
    const db = await d.make();
    const meeting = await newMeeting(db, { 'Meeting Name': 'Fall Retreat', Date: '2026-09-18', IsMultiDay: 1, EndDate: '2026-09-21' });
    // NOW is 2026-09-20: the retreat started two days ago.
    expect((await db.meetings.listUpcoming(OWN, { fromDate: '2026-09-20' })).map((m) => m.id)).toContain(meeting.id);
    expect((await db.meetings.listSchedules(OWN, MEMBER.member)).allSchedules.map((m) => m.id)).toContain(meeting.id);
    const calendar = await db.events.listCalendarRange(OWN, '2026-09-20', '2026-09-30', { hideEnded: true });
    expect(calendar.find((e) => e.kind === 'meeting' && e.id === meeting.id)).toMatchObject({ startDate: '2026-09-18', endDate: '2026-09-21', startTime: null });
    expect((await db.meetings.listUpcoming(OWN, { fromDate: '2026-09-22' })).map((m) => m.id)).not.toContain(meeting.id);
  });

  it('reports the member’s RSVP for each invitation in listSchedules', async () => {
    const db = await d.make();
    const a = await newMeeting(db, { 'Meeting Name': 'A', Date: '2026-10-01' }, { memberIds: [MEMBER.member] });
    const b = await newMeeting(db, { 'Meeting Name': 'B', Date: '2026-10-02' }, { memberIds: [MEMBER.member] });
    const c = await newMeeting(db, { 'Meeting Name': 'C', Date: '2026-10-03' }, { memberIds: [MEMBER.admin] });
    await db.meetings.rsvpToInvite(MEMBER.member, a.id, 'Accepted');
    const schedules = await db.meetings.listSchedules(OWN, MEMBER.member);
    expect(schedules.myResponses[a.id]).toBe('Accepted');
    expect(schedules.myResponses[b.id]).toBe('NoResponse');
    expect(schedules.myResponses[c.id]).toBeUndefined();
    expect(Object.keys(schedules.myResponses).map(Number).sort((x, y) => x - y)).toEqual(schedules.myInvites.map((m) => m.id).sort((x, y) => x - y));
  });
});

describe.each(drivers)('$name driver: meetings.saveAgendaTemplate', (d) => {
  it('creates, replaces and removes a council template for an Admin', async () => {
    const db = await d.make();
    const monthly = (await db.meetings.listCouncilMeetingTypes(OWN)).find((t) => t.TypeName === 'Monthly')!;
    const saved = await db.meetings.saveAgendaTemplate(MEMBER.admin, OWN, monthly.id, '  1. Opening prayer\n2. Minutes  ');
    expect(saved).toMatchObject({ CouncilID: OWN, MeetingTypeID: monthly.id, TemplateText: '1. Opening prayer\n2. Minutes' });
    const replaced = await db.meetings.saveAgendaTemplate(MEMBER.admin, OWN, monthly.id, '1. Opening prayer\n2. Reports');
    expect(replaced?.id).toBe(saved!.id);
    expect((await db.meetings.getAgendaTemplate(OWN, monthly.id))?.TemplateText).toBe('1. Opening prayer\n2. Reports');
    expect(d.count(db, 'CouncilAgendaTemplate')).toBe(1);

    expect(await db.meetings.saveAgendaTemplate(MEMBER.admin, OWN, monthly.id, '   ')).toBeNull();
    expect(await db.meetings.getAgendaTemplate(OWN, monthly.id)).toBeNull();
    expect(await db.meetings.saveAgendaTemplate(MEMBER.admin, OWN, monthly.id, '')).toBeNull(); // nothing to remove
  });

  it('lets the council’s Grand Knight and a Super Admin edit, and nobody else', async () => {
    const db = await d.make();
    const officer = (await db.meetings.listCouncilMeetingTypes(OWN)).find((t) => t.TypeName === 'Officer')!;
    await expectRule(db.meetings.saveAgendaTemplate(MEMBER.member, OWN, officer.id, 'Roll call'), 'ADMIN_REQUIRED');
    grantRole(d, db, MEMBER.member, 'Treasurer');
    await expectRule(db.meetings.saveAgendaTemplate(MEMBER.member, OWN, officer.id, 'Roll call'), 'ADMIN_REQUIRED');
    grantRole(d, db, MEMBER.member, 'Grand Knight');
    expect((await db.meetings.saveAgendaTemplate(MEMBER.member, OWN, officer.id, 'Roll call'))?.TemplateText).toBe('Roll call');
    expect((await db.meetings.saveAgendaTemplate(MEMBER.superAdmin, OWN, officer.id, 'Roll call\nReports'))?.TemplateText).toBe('Roll call\nReports');
    await expectRule(db.meetings.saveAgendaTemplate(9999, OWN, officer.id, 'x'), 'MEMBER_NOT_FOUND');
  });

  it('keeps each council to its own types and templates', async () => {
    const db = await d.make();
    const other = await db.councils.create(MEMBER.superAdmin, { CouncilNumber: 99006, CouncilName: 'Other Council', State: 'OR' });
    const monthly = (await db.meetings.listCouncilMeetingTypes(OWN))[0];
    await expectRule(db.meetings.saveAgendaTemplate(MEMBER.admin, other.id, monthly.id, 'x'), 'COUNCIL_ACCESS_DENIED');
    await expectRule(db.meetings.saveAgendaTemplate(MEMBER.superAdmin, other.id, monthly.id, 'x'), 'INVALID_INPUT');
    await expectRule(db.meetings.saveAgendaTemplate(MEMBER.admin, OWN, 9999, 'x'), 'INVALID_INPUT');
    await expectRule(db.meetings.saveAgendaTemplate(MEMBER.admin, OWN, monthly.id, 'x'.repeat(10_001)), 'INVALID_INPUT');
    expect(d.count(db, 'CouncilAgendaTemplate')).toBe(0);
  });
});

describe.each(drivers)('$name driver: multi-day events', (d) => {
  const draft = { EventName: 'Parish Mission', EventDescription: 'Three evenings', OwnerID: MEMBER.admin, StartDate: '2026-11-01', EndDate: '2026-11-03', Location: 'Church', CategoryID: 1 };

  it('saves IsMultiDay through create, update and copy', async () => {
    const db = await d.make();
    const event = await db.events.create({ ...draft, IsMultiDay: 1 }, [OWN]);
    expect(event.IsMultiDay).toBe(1);
    const copy = await db.events.copy(event.id, { startDate: '2027-11-01' });
    expect(copy.IsMultiDay).toBe(1);
    const oneDay = await db.events.update(event.id, { EndDate: '2026-11-01', IsMultiDay: 0 });
    expect(oneDay).toMatchObject({ EndDate: '2026-11-01', IsMultiDay: 0 });
    expect((await db.events.create({ ...draft, EndDate: '2026-11-01' }, [OWN])).IsMultiDay).toBe(0);
    await expectRule(db.events.update(event.id, { IsMultiDay: 5 as never }), 'INVALID_INPUT');
  });
});
