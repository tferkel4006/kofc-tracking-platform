// Sprint 5Q step 2: the Visual Master Calendar's date grid and brand tones, the photo gallery's grouping, the
// meeting owner's management gate and the portal's photo path resolution.
import { describe, expect, it } from 'vitest';
import {
  calendarDays,
  calendarTone,
  canManageMeeting,
  entriesOn,
  galleryPhotos,
  groupGalleryPhotos,
  isShiftUrgent,
  shiftNeedsVolunteers,
  startOfWeek,
  stepCalendar,
  type CalendarEntry,
  type Event,
  type Meeting,
  type Shift,
} from '@kofc/shared';
import { photoName, photoSrc } from '../apps/web/lib/media';

const event = (over: Partial<Event> = {}): Event => ({
  id: 1,
  EventName: 'Parish Picnic',
  EventDescription: '',
  OwnerID: 1,
  StartDate: '2026-09-21',
  EndDate: '2026-09-21',
  Location: 'Hall',
  CategoryID: 1,
  ...over,
});
const eventEntry = (e: Event): CalendarEntry => ({
  kind: 'event',
  id: e.id,
  title: e.EventName,
  startDate: e.StartDate,
  endDate: e.EndDate,
  startTime: null,
  endTime: null,
  location: e.Location,
  event: e,
});
const meetingEntry: CalendarEntry = {
  kind: 'meeting',
  id: 1,
  title: 'Business Meeting',
  startDate: '2026-09-21',
  endDate: '2026-09-21',
  startTime: '19:00:00',
  endTime: '20:30:00',
  location: 'Hall',
  meeting: {} as Meeting,
};
const shift = (over: Partial<Shift> = {}): Shift => ({
  id: 1,
  EventID: 1,
  ShiftName: 'Setup',
  ShiftDate: '2026-09-21',
  StartTime: '09:00:00',
  EndTime: '12:00:00',
  MinNumberVolunteers: 4,
  NumberVolunteersSignedUp: 4,
  ...over,
});
/** Sunday 2026-09-20, noon. */
const NOW = new Date(2026, 8, 20, 12, 0, 0);

describe('calendar grid', () => {
  it('lays a month out in whole Sunday-first weeks', () => {
    const days = calendarDays('month', '2026-09-15');
    expect(days[0]).toBe('2026-08-30');
    expect(days.at(-1)).toBe('2026-10-03');
    expect(days).toHaveLength(35);
    expect(calendarDays('month', '2026-08-01')).toHaveLength(42); // Aug 2026 starts on a Saturday
    expect(calendarDays('month', '2026-02-10')).toHaveLength(28); // Feb 2026 runs exactly Sunday the 1st to Saturday the 28th
  });

  it('shows Sunday to Saturday for a week and the anchor alone for a day', () => {
    expect(startOfWeek('2026-09-24')).toBe('2026-09-20');
    expect(calendarDays('week', '2026-09-24')).toEqual(['2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26']);
    expect(calendarDays('day', '2026-09-24')).toEqual(['2026-09-24']);
  });

  it('steps a month to the first of the next or previous month, a week by 7 days and a day by 1', () => {
    expect(stepCalendar('month', '2026-01-31', 1)).toBe('2026-02-01');
    expect(stepCalendar('month', '2026-01-15', -1)).toBe('2025-12-01');
    expect(stepCalendar('week', '2026-09-20', 1)).toBe('2026-09-27');
    expect(stepCalendar('day', '2026-12-31', 1)).toBe('2027-01-01');
  });

  it('puts a multi-day event on each day it covers', () => {
    const long = eventEntry(event({ StartDate: '2026-09-19', EndDate: '2026-09-21' }));
    expect(entriesOn([long], '2026-09-18')).toEqual([]);
    expect(entriesOn([long], '2026-09-20')).toEqual([long]);
    expect(entriesOn([long], '2026-09-21')).toEqual([long]);
  });
});

describe('calendar brand tones', () => {
  it('flags shifts starting within 48 hours, not ones already started or further out', () => {
    expect(isShiftUrgent(shift({ ShiftDate: '2026-09-22', StartTime: '11:00:00' }), NOW)).toBe(true);
    expect(isShiftUrgent(shift({ ShiftDate: '2026-09-22', StartTime: '12:30:00' }), NOW)).toBe(false);
    expect(isShiftUrgent(shift({ ShiftDate: '2026-09-20', StartTime: '09:00:00' }), NOW)).toBe(false);
  });

  it('knows when a shift is short of volunteers', () => {
    expect(shiftNeedsVolunteers(shift({ NumberVolunteersSignedUp: 3 }))).toBe(true);
    expect(shiftNeedsVolunteers(shift())).toBe(false);
  });

  it('paints meetings navy, urgent shifts red, short-handed shifts gold and the rest plain', () => {
    const e = eventEntry(event());
    expect(calendarTone(meetingEntry, [], NOW)).toBe('meeting');
    expect(calendarTone(e, [shift({ ShiftDate: '2026-09-21' })], NOW)).toBe('urgent');
    expect(calendarTone(e, [shift({ ShiftDate: '2026-09-25', NumberVolunteersSignedUp: 1 })], NOW)).toBe('needs');
    expect(calendarTone(e, [shift({ ShiftDate: '2026-09-25' })], NOW)).toBe('normal');
    expect(calendarTone(e, [shift({ ShiftDate: '2026-09-10', NumberVolunteersSignedUp: 0 })], NOW)).toBe('normal');
    expect(calendarTone(e, [], NOW)).toBe('normal');
  });
});

describe('photo gallery grouping', () => {
  const events = [
    event({ id: 1, EventName: 'Picnic', StartDate: '2026-08-02', PhotoGalleryURL: 'a.jpg,b.jpg' }),
    event({ id: 2, EventName: 'Fish Fry', StartDate: '2026-09-12', PhotoGalleryURL: 'c.jpg' }),
    event({ id: 3, EventName: 'Rosary', StartDate: '2026-09-01', PhotoGalleryURL: null }),
    event({ id: 4, EventName: 'Coat Drive', StartDate: '2026-08-20', PhotoGalleryURL: 'd.jpg' }),
  ];

  it('lists photos newest event first, in upload order within an event', () => {
    expect(galleryPhotos(events).map((p) => [p.eventId, p.path])).toEqual([
      [2, 'c.jpg'],
      [4, 'd.jpg'],
      [1, 'a.jpg'],
      [1, 'b.jpg'],
    ]);
  });

  it('groups by event or by the event month', () => {
    const photos = galleryPhotos(events);
    expect(groupGalleryPhotos(photos, 'event').map((g) => [g.label, g.photos.length])).toEqual([
      ['Fish Fry', 1],
      ['Coat Drive', 1],
      ['Picnic', 2],
    ]);
    expect(groupGalleryPhotos(photos, 'month').map((g) => [g.label, g.photos.length])).toEqual([
      ['September 2026', 1],
      ['August 2026', 3],
    ]);
  });
});

describe('meeting owner gate and photo paths', () => {
  const user = (over = {}) => ({ memberId: 10, councilId: 1, memberType: 'Member' as const, isOfficer: false, ...over });

  it('lets the owner, council officers and admins manage a meeting', () => {
    expect(canManageMeeting(user(), { CouncilID: 1, OwnerID: 10 })).toBe(true);
    expect(canManageMeeting(user(), { CouncilID: 1, OwnerID: null })).toBe(false);
    expect(canManageMeeting(user({ isOfficer: true }), { CouncilID: 1 })).toBe(true);
    expect(canManageMeeting(user({ memberType: 'Admin' }), { CouncilID: 2 })).toBe(false);
  });

  it('serves relative photo paths from /media and passes links through', () => {
    expect(photoSrc('events/12/picnic day.jpg')).toBe('/media/events/12/picnic%20day.jpg');
    expect(photoSrc('blob:http://localhost:3000/abc')).toBe('blob:http://localhost:3000/abc');
    expect(photoSrc('https://example.org/p.jpg')).toBe('https://example.org/p.jpg');
    expect(photoSrc('file:///var/mobile/Documents/media/event-1-1.jpg')).toBeNull();
    expect(photoName('file:///var/mobile/Documents/media/event-1-1.jpg')).toBe('event-1-1.jpg');
  });
});
