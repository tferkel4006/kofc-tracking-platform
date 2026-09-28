// =========================================================================
// EVENT PHOTOS, MEETING GOOGLE DRIVE LINKS AND THE COUNCIL CALENDAR (Sprint 5Q)
// Pure helpers behind events.uploadPhotos, meetings.linkGoogleDrive and
// events.listCalendarRange. Drivers load rows, call these, then only store.
// Who may write is decided in rules.ts (assertMayAttachEventMedia,
// assertMayLinkMeetingDrive).
// =========================================================================
import type { CalendarEntry } from './contract';
import { assertIsoDate, BusinessRuleError } from './rules';
import type { Event, Meeting } from './types';

/** Longest Event.PhotoGalleryURL (VARCHAR(2000)), separators included. */
export const PHOTO_GALLERY_MAX_LENGTH = 2000;
/** Longest Meeting.GoogleDriveMinutesURL / GoogleDriveFlyerURL (VARCHAR(2000)). */
export const GOOGLE_DRIVE_URL_MAX_LENGTH = 2000;
/** Hosts a shared Google Drive file link may point at (Drive files and Docs/Sheets/Slides). */
export const GOOGLE_DRIVE_HOSTS: readonly string[] = ['drive.google.com', 'docs.google.com'];

const PHOTO_SEPARATOR = ',';

/** The photo paths stored in an Event.PhotoGalleryURL, in upload order. Null or blank means none. */
export function parsePhotoGallery(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(PHOTO_SEPARATOR)
    .map((p) => p.trim())
    .filter(Boolean);
}

/**
 * The PhotoGalleryURL after appending `photoPaths` to `existing`: each path trimmed, paths already in the gallery
 * (or repeated in the list) skipped. Rejects INVALID_INPUT for an empty list, a blank or non-text path, a path
 * containing the comma separator, or a result longer than PHOTO_GALLERY_MAX_LENGTH.
 */
export function appendPhotoPaths(existing: string | null | undefined, photoPaths: readonly unknown[]): string {
  if (!Array.isArray(photoPaths) || photoPaths.length === 0) {
    throw new BusinessRuleError('INVALID_INPUT', 'Choose at least one photo to add.', { photoPaths: photoPaths ?? null });
  }
  const gallery = parsePhotoGallery(existing);
  const seen = new Set(gallery);
  for (const raw of photoPaths) {
    const path = typeof raw === 'string' ? raw.trim() : '';
    if (!path) throw new BusinessRuleError('INVALID_INPUT', 'A photo path cannot be blank.', { path: raw ?? null });
    if (path.includes(PHOTO_SEPARATOR)) {
      throw new BusinessRuleError('INVALID_INPUT', `Photo path "${path}" cannot contain a comma; the gallery is stored comma-separated.`, { path });
    }
    if (seen.has(path)) continue;
    seen.add(path);
    gallery.push(path);
  }
  const joined = gallery.join(PHOTO_SEPARATOR);
  if (joined.length > PHOTO_GALLERY_MAX_LENGTH) {
    throw new BusinessRuleError(
      'INVALID_INPUT',
      `The event's photo gallery can hold at most ${PHOTO_GALLERY_MAX_LENGTH} characters of paths; these photos would make it ${joined.length}.`,
      { length: joined.length, maxLength: PHOTO_GALLERY_MAX_LENGTH },
    );
  }
  return joined;
}

/**
 * A Google Drive link to store, or null to clear it. Must be an https URL on one of GOOGLE_DRIVE_HOSTS, at most
 * GOOGLE_DRIVE_URL_MAX_LENGTH characters; surrounding spaces are trimmed. INVALID_INPUT otherwise.
 */
export function cleanGoogleDriveUrl(value: unknown, label: string): string | null {
  if (value === null) return null;
  const text = typeof value === 'string' ? value.trim() : '';
  const fail = (why: string) => new BusinessRuleError('INVALID_INPUT', `${label} ${why}; received ${JSON.stringify(value)}.`, { value, label });
  if (!text) throw fail('must be a Google Drive link (or cleared)');
  if (text.length > GOOGLE_DRIVE_URL_MAX_LENGTH) throw fail(`can be at most ${GOOGLE_DRIVE_URL_MAX_LENGTH} characters`);
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw fail('must be a full https:// link');
  }
  if (url.protocol !== 'https:') throw fail('must be an https:// link');
  if (!GOOGLE_DRIVE_HOSTS.includes(url.hostname.toLowerCase())) throw fail(`must be a link on ${GOOGLE_DRIVE_HOSTS.join(' or ')}`);
  return text;
}

/** events.listCalendarRange's dates, validated: both real YYYY-MM-DD dates, the end on or after the start. */
export function cleanCalendarRange(startDate: unknown, endDate: unknown): { startDate: string; endDate: string } {
  const start = assertIsoDate(startDate, 'Calendar start date');
  const end = assertIsoDate(endDate, 'Calendar end date');
  if (end < start) {
    throw new BusinessRuleError('INVALID_INPUT', `The calendar range ends (${end}) before it starts (${start}).`, { startDate: start, endDate: end });
  }
  return { startDate: start, endDate: end };
}

/**
 * The calendar grid for a range: `events` overlapping it (StartDate <= end and EndDate >= start) and `meetings`
 * dated inside it. Callers may pass wider sets; out-of-range rows are dropped. Ordered by start date, then
 * all-day events before timed meetings, then start time, title and id.
 */
export function buildCalendarEntries(
  range: { startDate: string; endDate: string },
  events: readonly Event[],
  meetings: readonly Meeting[],
): CalendarEntry[] {
  const out: CalendarEntry[] = [];
  for (const event of events) {
    if (event.StartDate > range.endDate || event.EndDate < range.startDate) continue;
    out.push({
      kind: 'event',
      id: event.id,
      title: event.EventName,
      startDate: event.StartDate,
      endDate: event.EndDate,
      startTime: null,
      endTime: null,
      location: event.Location,
      event,
    });
  }
  for (const meeting of meetings) {
    if (meeting.Date < range.startDate || meeting.Date > range.endDate) continue;
    out.push({
      kind: 'meeting',
      id: meeting.id,
      title: meeting['Meeting Name'],
      startDate: meeting.Date,
      endDate: meeting.Date,
      startTime: meeting['Time Start'],
      endTime: meeting['Time End'],
      location: meeting.Location,
      meeting,
    });
  }
  return out.sort(
    (a, b) =>
      a.startDate.localeCompare(b.startDate) ||
      (a.startTime ?? '').localeCompare(b.startTime ?? '') ||
      a.title.localeCompare(b.title) ||
      a.kind.localeCompare(b.kind) ||
      a.id - b.id,
  );
}

/** One photo of the fraternal gallery, with the event it belongs to. */
export interface GalleryPhoto {
  /** Unique within a gallery: the event id and the photo's position in its PhotoGalleryURL. */
  key: string;
  path: string;
  eventId: number;
  eventName: string;
  /** The event's StartDate (YYYY-MM-DD). */
  eventDate: string;
}

export type GalleryGrouping = 'event' | 'month';

export interface GalleryGroup {
  key: string;
  label: string;
  photos: GalleryPhoto[];
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Every photo of `events`, newest event first (then name and id), each event's photos in upload order. */
export function galleryPhotos(events: readonly Pick<Event, 'id' | 'EventName' | 'StartDate' | 'PhotoGalleryURL'>[]): GalleryPhoto[] {
  return [...events]
    .sort((a, b) => b.StartDate.localeCompare(a.StartDate) || a.EventName.localeCompare(b.EventName) || a.id - b.id)
    .flatMap((e) =>
      parsePhotoGallery(e.PhotoGalleryURL).map((path, i) => ({ key: `${e.id}-${i}`, path, eventId: e.id, eventName: e.EventName, eventDate: e.StartDate })),
    );
}

/**
 * `photos` (in galleryPhotos order) grouped by event or by the event's month, e.g. "September 2026". Groups keep
 * the order of their first photo, so the newest come first.
 */
export function groupGalleryPhotos(photos: readonly GalleryPhoto[], by: GalleryGrouping): GalleryGroup[] {
  const groups = new Map<string, GalleryGroup>();
  for (const photo of photos) {
    const key = by === 'event' ? `event-${photo.eventId}` : `month-${photo.eventDate.slice(0, 7)}`;
    const label = by === 'event' ? photo.eventName : `${MONTHS[Number(photo.eventDate.slice(5, 7)) - 1]} ${photo.eventDate.slice(0, 4)}`;
    const group = groups.get(key) ?? { key, label, photos: [] };
    group.photos.push(photo);
    groups.set(key, group);
  }
  return [...groups.values()];
}
