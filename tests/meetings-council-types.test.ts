// Sprint 5Y-5 step 1: council meeting types, agenda templates, meeting RSVPs, multi-day flags and the shift
// default length behind automatic hour reporting.
import { describe, expect, it } from 'vitest';
import {
  assertMeetingResponseStatus,
  MEETING_RESPONSE_STATUSES,
  RECORD_REFERENCES,
  shiftDefaultLengthHours,
  type DataService,
} from '@kofc/shared';
import type { MemoryDataService } from '../apps/web/services/drivers/memory';
import { openDatabases } from './shims/expo-sqlite';
import { drivers, expectRule, MEMBER, shiftByName, type DriverUnderTest } from './helpers';

const OWN = 1; // Council 15295

/** Inserts a row straight into the backing store; no service method writes these tables yet. */
function raw(d: DriverUnderTest, db: DataService, table: string, row: Record<string, string | number | null>): number {
  if (d.name === 'memory') return (db as MemoryDataService).debugStore.insert(table, row).id as number;
  const cols = Object.keys(row);
  const res = openDatabases
    .at(-1)!
    .prepare(`INSERT INTO [${table}] (${cols.map((c) => `[${c}]`).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`)
    .run(...Object.values(row));
  return Number(res.lastInsertRowid);
}

async function makeMeeting(db: DataService, invitees: number[]) {
  const type = (await db.lookups.list('MeetingType'))[0];
  return db.meetings.create(
    {
      OwnerID: null,
      CouncilID: OWN,
      'Meeting Name': 'October business meeting',
      Date: '2026-10-08',
      'Time Start': '19:00:00',
      'Time End': '20:30:00',
      Location: 'Council Hall',
      MeetingType: type.id,
    },
    { memberIds: invitees },
  );
}

describe('meeting RSVP and shift length helpers (pure)', () => {
  it('accepts only the three response statuses', () => {
    expect(MEETING_RESPONSE_STATUSES).toEqual(['NoResponse', 'Accepted', 'Declined']);
    for (const status of MEETING_RESPONSE_STATUSES) expect(assertMeetingResponseStatus(status)).toBe(status);
    expect(() => assertMeetingResponseStatus('Maybe')).toThrow(/NoResponse, Accepted, Declined/);
    expect(() => assertMeetingResponseStatus('accepted')).toThrow();
  });

  it('measures a shift in quarter hours, running an overnight shift past midnight', () => {
    expect(shiftDefaultLengthHours({ StartTime: '09:00:00', EndTime: '11:30:00' })).toBe(2.5);
    expect(shiftDefaultLengthHours({ StartTime: '22:00:00', EndTime: '02:00:00' })).toBe(4);
    expect(shiftDefaultLengthHours({ StartTime: '09:00:00', EndTime: '11:10:00' })).toBe(2.25); // 2h10m, nearest quarter
    expect(shiftDefaultLengthHours({ StartTime: '09:00:00', EndTime: '11:05:00' })).toBe(2); // 2h05m
    expect(shiftDefaultLengthHours({ StartTime: '13:00', EndTime: '13:00' })).toBe(0);
  });

  it('blocks deleting a council that still has meeting types or agenda templates', () => {
    const tables = RECORD_REFERENCES.Council.map((r) => r.table);
    expect(tables).toContain('CouncilMeetingType');
    expect(tables).toContain('CouncilAgendaTemplate');
  });
});

describe.each(drivers)('$name driver: council meeting types and agenda templates', (d) => {
  it('lists the seeded standard types for Council 15295 only, by name', async () => {
    const db = await d.make();
    const types = await db.meetings.listCouncilMeetingTypes(OWN);
    expect(types.map((t) => t.TypeName)).toEqual(['Committee', 'Monthly', 'Officer']);
    expect(types.every((t) => t.CouncilID === OWN)).toBe(true);

    const other = await db.councils.create(MEMBER.superAdmin, { CouncilNumber: 99003, CouncilName: 'New Council', State: 'OR' });
    expect(await db.meetings.listCouncilMeetingTypes(other.id)).toEqual([]);
    await expectRule(db.meetings.listCouncilMeetingTypes(9999), 'INVALID_INPUT');
  });

  it('keeps type names unique within a council but free across councils', async () => {
    const db = await d.make();
    const other = await db.councils.create(MEMBER.superAdmin, { CouncilNumber: 99004, CouncilName: 'Other Council', State: 'OR' });
    raw(d, db, 'CouncilMeetingType', { CouncilID: other.id, TypeName: 'Monthly' });
    expect(() => raw(d, db, 'CouncilMeetingType', { CouncilID: OWN, TypeName: 'Monthly' })).toThrow();
    expect((await db.meetings.listCouncilMeetingTypes(other.id)).map((t) => t.TypeName)).toEqual(['Monthly']);
  });

  it('returns a council agenda template for its own type, and null otherwise', async () => {
    const db = await d.make();
    const monthly = (await db.meetings.listCouncilMeetingTypes(OWN)).find((t) => t.TypeName === 'Monthly')!;
    const officer = (await db.meetings.listCouncilMeetingTypes(OWN)).find((t) => t.TypeName === 'Officer')!;
    const text = '1. Opening prayer\n2. Roll call of officers\n3. Minutes\n4. Reports\n5. Closing prayer';
    raw(d, db, 'CouncilAgendaTemplate', { CouncilID: OWN, MeetingTypeID: monthly.id, TemplateText: text });

    expect(await db.meetings.getAgendaTemplate(OWN, monthly.id)).toMatchObject({ CouncilID: OWN, MeetingTypeID: monthly.id, TemplateText: text });
    expect(await db.meetings.getAgendaTemplate(OWN, officer.id)).toBeNull();
    expect(await db.meetings.getAgendaTemplate(2, monthly.id)).toBeNull();
    // One template per council and type.
    expect(() => raw(d, db, 'CouncilAgendaTemplate', { CouncilID: OWN, MeetingTypeID: monthly.id, TemplateText: 'Again' })).toThrow();
  });

  it('defaults the multi-day flags to 0 and leaves new meetings unfiled', async () => {
    const db = await d.make();
    const meeting = await makeMeeting(db, []);
    expect(meeting).toMatchObject({ IsMultiDay: 0, MeetingTypeID: null });
    const event = (await db.events.listByCouncil(OWN))[0];
    expect(event.IsMultiDay).toBe(0);
  });
});

describe.each(drivers)('$name driver: meetings.rsvpToInvite', (d) => {
  it('starts every invitation at NoResponse and records the member’s answer in one call', async () => {
    const db = await d.make();
    const meeting = await makeMeeting(db, [MEMBER.member, MEMBER.admin]);
    expect((await db.meetings.listInvites(meeting.id)).map((i) => i.ResponseStatus)).toEqual(['NoResponse', 'NoResponse']);

    const accepted = await db.meetings.rsvpToInvite(MEMBER.member, meeting.id, 'Accepted');
    expect(accepted).toMatchObject({ MeetingID: meeting.id, MemberID: MEMBER.member, ResponseStatus: 'Accepted', Attended: 0 });
    // Only the actor's own row changes.
    const byMember = new Map((await db.meetings.listInvites(meeting.id)).map((i) => [i.MemberID, i.ResponseStatus]));
    expect(byMember.get(MEMBER.admin)).toBe('NoResponse');

    expect((await db.meetings.rsvpToInvite(MEMBER.member, meeting.id, 'Declined')).ResponseStatus).toBe('Declined');
    expect((await db.meetings.rsvpToInvite(MEMBER.member, meeting.id, 'Declined')).ResponseStatus).toBe('Declined');
    expect((await db.meetings.rsvpToInvite(MEMBER.member, meeting.id, 'NoResponse')).ResponseStatus).toBe('NoResponse');
  });

  it('rejects a bad status, an unknown member or meeting, and a member who was not invited, writing nothing', async () => {
    const db = await d.make();
    const meeting = await makeMeeting(db, [MEMBER.member]);
    await expectRule(db.meetings.rsvpToInvite(MEMBER.member, meeting.id, 'Maybe' as never), 'INVALID_INPUT');
    await expectRule(db.meetings.rsvpToInvite(9999, meeting.id, 'Accepted'), 'MEMBER_NOT_FOUND');
    await expectRule(db.meetings.rsvpToInvite(MEMBER.member, 9999, 'Accepted'), 'MEETING_NOT_FOUND');
    await expectRule(db.meetings.rsvpToInvite(MEMBER.admin, meeting.id, 'Accepted'), 'NOT_INVITED');
    expect((await db.meetings.listInvites(meeting.id)).map((i) => i.ResponseStatus)).toEqual(['NoResponse']);
  });
});

describe.each(drivers)('$name driver: shifts.getShiftDefaultLength', (d) => {
  it('returns the shift length in quarter hours', async () => {
    const db = await d.make();
    const shift = await shiftByName(db, 'Check-in Desk');
    expect(await db.shifts.getShiftDefaultLength(shift.id)).toBe(shiftDefaultLengthHours(shift));
    expect(await db.shifts.getShiftDefaultLength(shift.id)).toBe(4); // 08:00-12:00
  });

  it('rejects an unknown shift', async () => {
    const db = await d.make();
    await expectRule(db.shifts.getShiftDefaultLength(9999), 'SHIFT_NOT_FOUND');
  });
});
