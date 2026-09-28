// Sprint 5Q: event photos (events.uploadPhotos), meeting Google Drive links (meetings.linkGoogleDrive) and the
// council calendar (events.listCalendarRange).
import { describe, expect, it } from 'vitest';
import {
  appendPhotoPaths,
  canAttachEventMedia,
  canLinkMeetingDrive,
  cleanGoogleDriveUrl,
  mayAttachEventMedia,
  mayLinkMeetingDrive,
  PHOTO_GALLERY_MAX_LENGTH,
  SecurityPrivilegeError,
  type DataService,
  type MemberWriteActor,
} from '@kofc/shared';
import { MemoryDataService } from '../apps/web/services/drivers/memory';
import { drivers, expectRule, MEMBER, type DriverUnderTest } from './helpers';
import { openDatabases } from './shims/expo-sqlite';

// Dev seed: council 1 is 15295 (Super Admin 1, Admin 2 who is also Financial Secretary, Member 3); council 2 exists.
const OWN = 1;
const OTHER = 2;
const DRIVE_MINUTES = 'https://drive.google.com/file/d/1AbCminutes/view';
const DRIVE_FLYER = 'https://docs.google.com/document/d/1AbCflyer/edit';

async function expectPrivilege(promise: Promise<unknown>, code: 'ADMIN_REQUIRED' | 'COUNCIL_ACCESS_DENIED') {
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

/** An Active Admin of council 2, added by the seeded Super Admin. */
async function otherCouncilAdmin(db: DataService): Promise<number> {
  const types = await db.lookups.list('MemberType');
  const statuses = await db.lookups.list('MemberStatus');
  const admin = await db.members.create(MEMBER.superAdmin, {
    CouncilID: OTHER,
    MemberNumber: 7700002,
    MemberFirstName: 'Other',
    MemberLastName: 'Admin',
    Phone: '503-555-0143',
    StreetAddress1: '1 Peace Way',
    City: 'Salem',
    State: 'OR',
    ZipCode: '97301',
    Email: 'other.media.admin@example.org',
    DateOfBirth: '1970-05-05',
    StatusID: statuses.find((s) => s.Status === 'Active')!.id,
    DegreeID: 3,
    MemberTypeID: types.find((t) => t.Type === 'Admin')!.id,
  });
  return admin.id;
}

async function makeEvent(db: DataService, name: string, start: string, end: string, councilIds = [OWN], ownerId: number = MEMBER.superAdmin) {
  const category = (await db.lookups.list('Category'))[0];
  return db.events.create(
    { EventName: name, EventDescription: 'Sprint 5Q fixture', OwnerID: ownerId, StartDate: start, EndDate: end, Location: 'Parish Hall', CategoryID: category.id },
    councilIds,
  );
}

async function makeMeeting(db: DataService, name: string, date: string, councilId = OWN, start = '19:00:00') {
  const type = (await db.lookups.list('MeetingType'))[0];
  return db.meetings.create({
    CouncilID: councilId,
    'Meeting Name': name,
    Date: date,
    'Time Start': start,
    'Time End': '20:30:00',
    Location: 'Council Hall',
    MeetingType: type.id,
  });
}

describe('media helpers (pure)', () => {
  it('appends trimmed photo paths and skips ones already in the gallery', () => {
    expect(appendPhotoPaths(null, [' photos/a.jpg ', 'photos/b.jpg'])).toBe('photos/a.jpg,photos/b.jpg');
    expect(appendPhotoPaths('photos/a.jpg', ['photos/b.jpg', 'photos/a.jpg', 'photos/b.jpg'])).toBe('photos/a.jpg,photos/b.jpg');
  });

  it('rejects an empty list, blank paths, commas and an over-long gallery', () => {
    expect(() => appendPhotoPaths(null, [])).toThrow(/at least one photo/);
    expect(() => appendPhotoPaths(null, ['  '])).toThrow(/blank/);
    expect(() => appendPhotoPaths(null, ['a,b.jpg'])).toThrow(/comma/);
    expect(() => appendPhotoPaths(null, ['x'.repeat(PHOTO_GALLERY_MAX_LENGTH + 1)])).toThrow(/at most/);
  });

  it('accepts only https Google Drive links, and null to clear', () => {
    expect(cleanGoogleDriveUrl(` ${DRIVE_MINUTES} `, 'Minutes')).toBe(DRIVE_MINUTES);
    expect(cleanGoogleDriveUrl(DRIVE_FLYER, 'Flyer')).toBe(DRIVE_FLYER);
    expect(cleanGoogleDriveUrl(null, 'Flyer')).toBeNull();
    for (const bad of ['', 'drive.google.com/file/d/1', 'http://drive.google.com/file/d/1', 'https://example.com/file', 42]) {
      expect(() => cleanGoogleDriveUrl(bad, 'Flyer')).toThrow(/Flyer/);
    }
  });

  const actor = (over: Partial<MemberWriteActor> = {}): MemberWriteActor => ({ memberId: 10, councilId: OWN, memberType: 'Member', active: true, ...over });
  const event = { id: 1, OwnerID: 99 };

  it('lets the owner, a linked council’s Admin or finance officer, and a Super Admin attach event photos', () => {
    expect(mayAttachEventMedia(actor(), event, [OWN])).toBe(false);
    expect(mayAttachEventMedia(actor({ memberId: 99, councilId: OTHER }), event, [OWN])).toBe(true);
    expect(mayAttachEventMedia(actor({ memberId: 99, active: false }), event, [OWN])).toBe(false);
    expect(mayAttachEventMedia(actor({ memberType: 'Admin' }), event, [OTHER, OWN])).toBe(true);
    expect(mayAttachEventMedia(actor({ memberType: 'Admin' }), event, [OTHER])).toBe(false);
    for (const role of ['Treasurer', 'Financial Secretary']) {
      expect(mayAttachEventMedia(actor({ roles: [role] }), event, [OWN])).toBe(true);
      expect(mayAttachEventMedia(actor({ roles: [role] }), event, [OTHER])).toBe(false);
      expect(mayAttachEventMedia(actor({ roles: [role], active: false }), event, [OWN])).toBe(false);
    }
    expect(mayAttachEventMedia(actor({ roles: ['Grand Knight'] }), event, [OWN])).toBe(false);
    expect(mayAttachEventMedia(actor({ memberType: 'Super Admin', councilId: 77 }), event, [OTHER])).toBe(true);
  });

  it('lets the meeting council’s Admin or finance officer, and a Super Admin, link Google Drive files', () => {
    const meeting = { id: 5, CouncilID: OWN };
    expect(mayLinkMeetingDrive(actor(), meeting)).toBe(false);
    expect(mayLinkMeetingDrive(actor({ memberType: 'Admin' }), meeting)).toBe(true);
    expect(mayLinkMeetingDrive(actor({ memberType: 'Admin', councilId: OTHER }), meeting)).toBe(false);
    expect(mayLinkMeetingDrive(actor({ roles: ['Treasurer'] }), meeting)).toBe(true);
    expect(mayLinkMeetingDrive(actor({ memberType: 'Super Admin', councilId: OTHER }), meeting)).toBe(true);
  });

  it('mirrors the rules in the UI permission gates', () => {
    const user = (over = {}) => ({ memberId: 10, councilId: OWN, memberType: 'Member' as const, isOfficer: false, ...over });
    expect(canAttachEventMedia(user(), { OwnerID: 10 }, [OTHER])).toBe(true);
    expect(canAttachEventMedia(user(), { OwnerID: 99 }, [OWN])).toBe(false);
    expect(canAttachEventMedia(user({ roles: ['Treasurer'] }), { OwnerID: 99 }, [OWN])).toBe(true);
    expect(canAttachEventMedia(user({ memberType: 'Admin' }), { OwnerID: 99 }, [OTHER])).toBe(false);
    expect(canLinkMeetingDrive(user({ roles: ['Financial Secretary'] }), OWN)).toBe(true);
    expect(canLinkMeetingDrive(user(), OWN)).toBe(false);
    expect(canLinkMeetingDrive(user({ memberType: 'Super Admin', councilId: OTHER }), OWN)).toBe(true);
  });
});

describe.each(drivers)('$name driver: media and calendar', (d) => {
  describe('events.uploadPhotos', () => {
    it('lets the owner append photos, skipping duplicates, and returns the event', async () => {
      const db = await d.make();
      const event = await makeEvent(db, 'Photo Day', '2027-06-10', '2027-06-10', [OWN], MEMBER.member);
      const first = await db.events.uploadPhotos(MEMBER.member, event.id, ['photos/1.jpg', 'photos/2.jpg']);
      expect(first.PhotoGalleryURL).toBe('photos/1.jpg,photos/2.jpg');
      const second = await db.events.uploadPhotos(MEMBER.member, event.id, ['photos/2.jpg', 'photos/3.jpg']);
      expect(second.PhotoGalleryURL).toBe('photos/1.jpg,photos/2.jpg,photos/3.jpg');
      expect((await db.events.get(event.id))!.PhotoGalleryURL).toBe('photos/1.jpg,photos/2.jpg,photos/3.jpg');
    });

    it('lets the council Admin, a Treasurer and a Super Admin upload, but not a plain member or another council’s Admin', async () => {
      const db = await d.make();
      const event = await makeEvent(db, 'Photo Day', '2027-06-10', '2027-06-10');
      await expectPrivilege(db.events.uploadPhotos(MEMBER.member, event.id, ['m.jpg']), 'ADMIN_REQUIRED');
      await expectPrivilege(db.events.uploadPhotos(await otherCouncilAdmin(db), event.id, ['o.jpg']), 'COUNCIL_ACCESS_DENIED');
      expect((await db.events.get(event.id))!.PhotoGalleryURL ?? null).toBeNull();

      await db.events.uploadPhotos(MEMBER.admin, event.id, ['admin.jpg']);
      grantRole(d, db, MEMBER.member, 'Treasurer');
      await db.events.uploadPhotos(MEMBER.member, event.id, ['treasurer.jpg']);
      const done = await db.events.uploadPhotos(MEMBER.superAdmin, event.id, ['super.jpg']);
      expect(done.PhotoGalleryURL).toBe('admin.jpg,treasurer.jpg,super.jpg');
    });

    it('rejects bad input and unknown records without writing', async () => {
      const db = await d.make();
      const event = await makeEvent(db, 'Photo Day', '2027-06-10', '2027-06-10');
      await db.events.uploadPhotos(MEMBER.admin, event.id, ['keep.jpg']);
      await expectRule(db.events.uploadPhotos(MEMBER.admin, event.id, []), 'INVALID_INPUT');
      await expectRule(db.events.uploadPhotos(MEMBER.admin, event.id, ['new.jpg', 'a,b.jpg']), 'INVALID_INPUT');
      await expectRule(db.events.uploadPhotos(MEMBER.admin, event.id, ['x'.repeat(PHOTO_GALLERY_MAX_LENGTH)]), 'INVALID_INPUT');
      await expectRule(db.events.uploadPhotos(MEMBER.admin, 999_999, ['a.jpg']), 'EVENT_NOT_FOUND');
      await expectRule(db.events.uploadPhotos(999_999, event.id, ['a.jpg']), 'MEMBER_NOT_FOUND');
      expect((await db.events.get(event.id))!.PhotoGalleryURL).toBe('keep.jpg');
    });

    it('keeps the gallery out of events.update and events.copy', async () => {
      const db = await d.make();
      const event = await makeEvent(db, 'Photo Day', '2027-06-10', '2027-06-10');
      await db.events.uploadPhotos(MEMBER.admin, event.id, ['keep.jpg']);
      await expectRule(db.events.update(event.id, { PhotoGalleryURL: 'sneaky.jpg' } as never), 'INVALID_INPUT');
      const twin = await db.events.copy(event.id, { startDate: '2027-07-10' });
      expect(twin.PhotoGalleryURL ?? null).toBeNull();
    });
  });

  describe('meetings.linkGoogleDrive', () => {
    it('saves, replaces and clears both links for the council Admin', async () => {
      const db = await d.make();
      const meeting = await makeMeeting(db, 'Drive Meeting', '2027-06-15');
      expect(meeting.GoogleDriveMinutesURL ?? null).toBeNull();
      const linked = await db.meetings.linkGoogleDrive(MEMBER.admin, meeting.id, DRIVE_MINUTES, DRIVE_FLYER);
      expect([linked.GoogleDriveMinutesURL, linked.GoogleDriveFlyerURL]).toEqual([DRIVE_MINUTES, DRIVE_FLYER]);
      const cleared = await db.meetings.linkGoogleDrive(MEMBER.admin, meeting.id, DRIVE_MINUTES, null);
      expect([cleared.GoogleDriveMinutesURL, cleared.GoogleDriveFlyerURL]).toEqual([DRIVE_MINUTES, null]);
      expect((await db.meetings.get(meeting.id))!.GoogleDriveFlyerURL).toBeNull();
    });

    it('lets a Financial Secretary or Treasurer and a Super Admin link, but not a plain member or another council’s Admin', async () => {
      const db = await d.make();
      const meeting = await makeMeeting(db, 'Drive Meeting', '2027-06-15');
      await expectPrivilege(db.meetings.linkGoogleDrive(MEMBER.member, meeting.id, DRIVE_MINUTES, null), 'ADMIN_REQUIRED');
      await expectPrivilege(db.meetings.linkGoogleDrive(await otherCouncilAdmin(db), meeting.id, DRIVE_MINUTES, null), 'COUNCIL_ACCESS_DENIED');
      expect((await db.meetings.get(meeting.id))!.GoogleDriveMinutesURL ?? null).toBeNull();

      grantRole(d, db, MEMBER.member, 'Financial Secretary');
      expect((await db.meetings.linkGoogleDrive(MEMBER.member, meeting.id, DRIVE_MINUTES, null)).GoogleDriveMinutesURL).toBe(DRIVE_MINUTES);
      expect((await db.meetings.linkGoogleDrive(MEMBER.superAdmin, meeting.id, null, DRIVE_FLYER)).GoogleDriveFlyerURL).toBe(DRIVE_FLYER);
    });

    it('rejects non-Drive links and unknown records without writing', async () => {
      const db = await d.make();
      const meeting = await makeMeeting(db, 'Drive Meeting', '2027-06-15');
      await db.meetings.linkGoogleDrive(MEMBER.admin, meeting.id, DRIVE_MINUTES, DRIVE_FLYER);
      await expectRule(db.meetings.linkGoogleDrive(MEMBER.admin, meeting.id, 'https://example.com/minutes.pdf', null), 'INVALID_INPUT');
      await expectRule(db.meetings.linkGoogleDrive(MEMBER.admin, meeting.id, DRIVE_MINUTES, 'http://drive.google.com/x'), 'INVALID_INPUT');
      await expectRule(db.meetings.linkGoogleDrive(MEMBER.admin, 999_999, DRIVE_MINUTES, null), 'MEETING_NOT_FOUND');
      await expectRule(db.meetings.linkGoogleDrive(999_999, meeting.id, DRIVE_MINUTES, null), 'MEMBER_NOT_FOUND');
      const stored = (await db.meetings.get(meeting.id))!;
      expect([stored.GoogleDriveMinutesURL, stored.GoogleDriveFlyerURL]).toEqual([DRIVE_MINUTES, DRIVE_FLYER]);
    });
  });

  describe('events.listCalendarRange', () => {
    it('returns overlapping events and in-range meetings of the council, all-day events first each day', async () => {
      const db = await d.make();
      const spanning = await makeEvent(db, 'May-June Novena', '2027-05-28', '2027-06-02');
      const inside = await makeEvent(db, 'Parish Picnic', '2027-06-12', '2027-06-12');
      await makeEvent(db, 'July Fair', '2027-07-01', '2027-07-03');
      await makeEvent(db, 'Other Council Dance', '2027-06-12', '2027-06-12', [OTHER]);
      const joint = await makeEvent(db, 'Joint Rosary', '2027-06-20', '2027-06-20', [OTHER, OWN]);
      const evening = await makeMeeting(db, 'Business Meeting', '2027-06-12', OWN, '19:00:00');
      const morning = await makeMeeting(db, 'Officer Breakfast', '2027-06-12', OWN, '07:30:00');
      await makeMeeting(db, 'July Meeting', '2027-07-01');
      await makeMeeting(db, 'Other Council Meeting', '2027-06-12', OTHER);

      const entries = await db.events.listCalendarRange(OWN, '2027-06-01', '2027-06-30');
      expect(entries.map((e) => [e.kind, e.id, e.startDate, e.startTime])).toEqual([
        ['event', spanning.id, '2027-05-28', null],
        ['event', inside.id, '2027-06-12', null],
        ['meeting', morning.id, '2027-06-12', '07:30:00'],
        ['meeting', evening.id, '2027-06-12', '19:00:00'],
        ['event', joint.id, '2027-06-20', null],
      ]);
      const meeting = entries.find((e) => e.kind === 'meeting' && e.id === evening.id);
      expect(meeting && meeting.kind === 'meeting' && meeting.meeting['Meeting Name']).toBe('Business Meeting');
      expect(await db.events.listCalendarRange(OWN, '2027-06-02', '2027-06-02')).toHaveLength(1);
    });

    it('rejects bad dates, a reversed range and an unknown council', async () => {
      const db = await d.make();
      await expectRule(db.events.listCalendarRange(OWN, '2027-06-31', '2027-07-01'), 'INVALID_DATE');
      await expectRule(db.events.listCalendarRange(OWN, '2027-06-30', '2027-06-01'), 'INVALID_INPUT');
      await expectRule(db.events.listCalendarRange(999_999, '2027-06-01', '2027-06-30'), 'INVALID_INPUT');
    });
  });
});
