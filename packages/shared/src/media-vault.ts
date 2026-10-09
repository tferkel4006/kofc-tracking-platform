// =========================================================================
// THE TAGGED MEDIA VAULT, SMART ALBUMS AND THE SLIDESHOW (Sprint 6P)
// Pure helpers behind media.getLibrary, uploadToVault, listSmartAlbums, saveSmartAlbum and deleteSmartAlbum, and the
// filters on the Fraternal Photo Gallery (/gallery). Drivers load rows, call these, then only store.
//
// Each CouncilMediaVault row is one photo tagged with its council, an optional event or meeting, a location and a
// calendar year. The library also lists the event photos stored before the vault, in Event.PhotoGalleryURL (also where
// the phone and the Marketing Factory still read and write them), tagged from the event's own Location and StartDate.
// A Smart Album is a saved filter (MediaAlbumCriteria): the photos it shows are worked out again each time it opens, so
// new photos that match are added.
// =========================================================================
import type { MediaAlbumCriteria, MediaLibrary, MediaLibraryItem, MediaVaultUploadInput, SmartAlbum } from './contract';
import { parsePhotoGallery } from './media';
import { assertInteger, assertText, BusinessRuleError, hasAdminRights, hasSuperAdminRights, SecurityPrivilegeError, type MemberWriteActor } from './rules';
import type { CouncilMediaVault, Event, Meeting, MediaSmartAlbums } from './types';

/** Longest CouncilMediaVault.file_url (VARCHAR(2000)). */
export const MEDIA_FILE_URL_MAX_LENGTH = 2000;
/** Longest location_tag, and the longest location filter (VARCHAR(255)). */
export const MEDIA_LOCATION_MAX_LENGTH = 255;
/** Longest MediaSmartAlbums.album_name (VARCHAR(100)). */
export const SMART_ALBUM_NAME_MAX_LENGTH = 100;
/** Most photos one upload may tag. */
export const MEDIA_UPLOAD_MAX_FILES = 50;
/** How long the slideshow shows each photo. */
export const SLIDESHOW_INTERVAL_MS = 5000;
/** How long the slideshow's cross-fade lasts (none when the viewer asks for reduced motion). */
export const SLIDESHOW_FADE_MS = 700;

/** A filter that matches every photo. */
export const EMPTY_ALBUM_CRITERIA: MediaAlbumCriteria = Object.freeze({ eventIds: [], meetingIds: [], location: '', years: [] }) as MediaAlbumCriteria;

const invalid = (message: string, details: Record<string, unknown> = {}) => new BusinessRuleError('INVALID_INPUT', message, details);

function idList(value: unknown, label: string): number[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw invalid(`${label} must be a list of ids.`, { label });
  return [...new Set(value.map((v) => assertInteger(v, label, 1)))].sort((a, b) => a - b);
}

/**
 * Validates a gallery filter: event and meeting ids (whole numbers of at least 1, repeats dropped, sorted), a location
 * text of at most MEDIA_LOCATION_MAX_LENGTH (trimmed) and calendar years 1900-2999. Missing parts match everything.
 */
export function cleanAlbumCriteria(value: unknown): MediaAlbumCriteria {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw invalid('A Smart Album needs a filter.', {});
  const v = value as Record<string, unknown>;
  for (const key of Object.keys(v)) {
    if (!['eventIds', 'meetingIds', 'location', 'years'].includes(key)) throw invalid(`A Smart Album filter has no part "${key}".`, { field: key });
  }
  const years = idList(v.years, 'Calendar year');
  for (const y of years) if (y < 1900 || y > 2999) throw invalid(`Calendar year ${y} is outside 1900-2999.`, { year: y });
  return {
    eventIds: idList(v.eventIds, 'Event id'),
    meetingIds: idList(v.meetingIds, 'Meeting id'),
    location: v.location == null ? '' : assertText(v.location, 'Location', MEDIA_LOCATION_MAX_LENGTH, false),
    years,
  };
}

/** A stored album_criteria_json as a filter; a damaged value reads as the empty filter rather than failing the gallery. */
export function parseAlbumCriteria(json: string | null | undefined): MediaAlbumCriteria {
  try {
    return cleanAlbumCriteria(JSON.parse(json ?? ''));
  } catch {
    return { ...EMPTY_ALBUM_CRITERIA, eventIds: [], meetingIds: [], years: [] };
  }
}

/** The album_criteria_json for a filter, with its parts in a fixed order. */
export const serializeAlbumCriteria = (c: MediaAlbumCriteria): string =>
  JSON.stringify({ eventIds: c.eventIds, meetingIds: c.meetingIds, location: c.location, years: c.years });

/** True when the filter matches every photo. */
export const isEmptyAlbumCriteria = (c: MediaAlbumCriteria): boolean =>
  c.eventIds.length === 0 && c.meetingIds.length === 0 && c.location.trim() === '' && c.years.length === 0;

/** A Smart Album's name: trimmed, required, at most SMART_ALBUM_NAME_MAX_LENGTH. */
export const cleanSmartAlbumName = (name: unknown): string => assertText(name, 'Album name', SMART_ALBUM_NAME_MAX_LENGTH);

/**
 * Whether a photo passes a filter. The event and meeting picks together form one "from" list: with neither, any
 * photo passes; otherwise the photo's event or meeting must be picked. The location matches any part of the tag,
 * ignoring case. With years picked, the photo's calendar year must be one of them.
 */
export function matchesAlbumCriteria(item: MediaLibraryItem, c: MediaAlbumCriteria): boolean {
  if (c.eventIds.length > 0 || c.meetingIds.length > 0) {
    const fromEvent = item.eventId !== null && c.eventIds.includes(item.eventId);
    const fromMeeting = item.meetingId !== null && c.meetingIds.includes(item.meetingId);
    if (!fromEvent && !fromMeeting) return false;
  }
  const location = c.location.trim().toLowerCase();
  if (location && !(item.locationTag ?? '').toLowerCase().includes(location)) return false;
  if (c.years.length > 0 && !c.years.includes(item.calendarYear)) return false;
  return true;
}

/** The photos of the library that pass the filter, in library order. */
export const filterMediaLibrary = (items: readonly MediaLibraryItem[], c: MediaAlbumCriteria): MediaLibraryItem[] =>
  items.filter((item) => matchesAlbumCriteria(item, c));

/**
 * Validates a vault upload: exactly one of an event or a meeting (INVALID_INPUT), 1 to MEDIA_UPLOAD_MAX_FILES file
 * references, each trimmed, not blank, at most MEDIA_FILE_URL_MAX_LENGTH and without a comma (event photos are also
 * appended to the comma-separated PhotoGalleryURL), repeats dropped; and an optional location tag.
 */
export function cleanVaultUpload(input: MediaVaultUploadInput): { eventId: number | null; meetingId: number | null; fileUrls: string[]; locationTag: string | null } {
  const eventId = input?.eventId == null ? null : assertInteger(input.eventId, 'Event id', 1);
  const meetingId = input?.meetingId == null ? null : assertInteger(input.meetingId, 'Meeting id', 1);
  if ((eventId === null) === (meetingId === null)) throw invalid('Tag the photos with one event or one meeting.', { eventId, meetingId });
  if (!Array.isArray(input.fileUrls) || input.fileUrls.length === 0) throw invalid('Choose at least one photo to add.', {});
  if (input.fileUrls.length > MEDIA_UPLOAD_MAX_FILES) {
    throw invalid(`Add at most ${MEDIA_UPLOAD_MAX_FILES} photos at a time; received ${input.fileUrls.length}.`, { count: input.fileUrls.length });
  }
  const fileUrls: string[] = [];
  for (const raw of input.fileUrls) {
    const url = assertText(raw, 'Photo reference', MEDIA_FILE_URL_MAX_LENGTH);
    if (url.includes(',')) throw invalid(`Photo reference "${url}" cannot contain a comma.`, { url });
    if (!fileUrls.includes(url)) fileUrls.push(url);
  }
  const tag = input.locationTag == null ? '' : assertText(input.locationTag, 'Location tag', MEDIA_LOCATION_MAX_LENGTH, false);
  return { eventId, meetingId, fileUrls, locationTag: tag === '' ? null : tag };
}

/** The calendar year of a YYYY-MM-DD date. */
export const calendarYearOf = (isoDate: string): number => Number(isoDate.slice(0, 4));

type LibraryEvent = Pick<Event, 'id' | 'EventName' | 'StartDate' | 'Location' | 'PhotoGalleryURL'>;
type LibraryMeeting = Pick<Meeting, 'id' | 'Meeting Name' | 'Date' | 'Location' | 'OwnerID'>;

/**
 * The council's photo library: every vault row of the council, plus each event photo in PhotoGalleryURL not already in
 * the vault for that event. Newest date first (an event's StartDate, a meeting's Date, else the upload day), then the
 * event or meeting name, then upload order. Also lists the events, meetings, locations and years the filters offer.
 */
export function buildMediaLibrary(input: {
  councilId: number;
  vault: readonly CouncilMediaVault[];
  events: readonly LibraryEvent[];
  meetings: readonly LibraryMeeting[];
}): MediaLibrary {
  const events = new Map(input.events.map((e) => [e.id, e]));
  const meetings = new Map(input.meetings.map((m) => [m.id, m]));
  const items: (MediaLibraryItem & { order: number })[] = [];
  const inVault = new Set<string>();
  let order = 0;
  for (const row of input.vault) {
    if (row.council_id !== input.councilId) continue;
    const event = row.event_id != null ? events.get(row.event_id) : undefined;
    const meeting = row.meeting_id != null ? meetings.get(row.meeting_id) : undefined;
    if (row.event_id != null) inVault.add(`${row.event_id}|${row.file_url}`);
    items.push({
      key: `vault-${row.id}`,
      vaultId: row.id,
      fileUrl: row.file_url,
      eventId: row.event_id ?? null,
      eventName: event?.EventName ?? null,
      meetingId: row.meeting_id ?? null,
      meetingName: meeting?.['Meeting Name'] ?? null,
      locationTag: row.location_tag ?? null,
      calendarYear: Number(row.calendar_year),
      date: event?.StartDate ?? meeting?.Date ?? row.uploaded_at.slice(0, 10),
      order: order++,
    });
  }
  for (const event of input.events) {
    parsePhotoGallery(event.PhotoGalleryURL).forEach((path, i) => {
      if (inVault.has(`${event.id}|${path}`)) return;
      items.push({
        key: `event-${event.id}-${i}`,
        vaultId: null,
        fileUrl: path,
        eventId: event.id,
        eventName: event.EventName,
        meetingId: null,
        meetingName: null,
        locationTag: event.Location || null,
        calendarYear: calendarYearOf(event.StartDate),
        date: event.StartDate,
        order: order++,
      });
    });
  }
  const label = (i: MediaLibraryItem) => i.eventName ?? i.meetingName ?? '';
  items.sort((a, b) => b.date.localeCompare(a.date) || label(a).localeCompare(label(b)) || a.order - b.order);
  const sorted: MediaLibraryItem[] = items.map(({ order: _order, ...item }) => item);
  return {
    councilId: input.councilId,
    items: sorted,
    events: [...input.events].sort((a, b) => b.StartDate.localeCompare(a.StartDate) || a.id - b.id).map((e) => ({ id: e.id, name: e.EventName, date: e.StartDate })),
    meetings: [...input.meetings].sort((a, b) => b.Date.localeCompare(a.Date) || a.id - b.id).map((m) => ({ id: m.id, name: m['Meeting Name'], date: m.Date, ownerId: m.OwnerID ?? null })),
    locations: [...new Set(sorted.map((i) => i.locationTag).filter((t): t is string => !!t))].sort((a, b) => a.localeCompare(b)),
    years: [...new Set(sorted.map((i) => i.calendarYear))].sort((a, b) => b - a),
  };
}

/** A stored album with its filter read back. */
export const toSmartAlbum = (row: MediaSmartAlbums): SmartAlbum => ({ ...row, criteria: parseAlbumCriteria(row.album_criteria_json) });

/** The council's albums by name, then id. */
export const sortSmartAlbums = (rows: readonly MediaSmartAlbums[]): SmartAlbum[] =>
  [...rows].sort((a, b) => a.album_name.localeCompare(b.album_name) || a.id - b.id).map(toSmartAlbum);

/** RECORD_NOT_FOUND unless the album exists. */
export function requireSmartAlbum<T extends MediaSmartAlbums>(row: T | null | undefined, albumId: number): T {
  if (!row) throw new BusinessRuleError('RECORD_NOT_FOUND', `Smart Album ${albumId} does not exist.`, { albumId });
  return row;
}

function albumDeleteDenial(actor: MemberWriteActor, album: Pick<MediaSmartAlbums, 'id' | 'council_id' | 'created_by_member_id'>): SecurityPrivilegeError | null {
  if (hasSuperAdminRights(actor)) return null;
  if (actor.active && actor.memberId === album.created_by_member_id) return null;
  if (!hasAdminRights(actor)) {
    return new SecurityPrivilegeError('ADMIN_REQUIRED', `Member ${actor.memberId} cannot delete Smart Album ${album.id}: only the member who saved it or an Admin can.`, {
      actorId: actor.memberId,
      albumId: album.id,
    });
  }
  if (actor.councilId === album.council_id) return null;
  return new SecurityPrivilegeError('COUNCIL_ACCESS_DENIED', `Admin ${actor.memberId} of council ${actor.councilId} cannot delete an album of council ${album.council_id}.`, {
    actorId: actor.memberId,
    councilId: album.council_id,
    albumId: album.id,
  });
}

/** media.deleteSmartAlbum: the member who saved it, an Active Admin of its council, or an Active Super Admin. */
export function assertMayDeleteSmartAlbum(actor: MemberWriteActor, album: Pick<MediaSmartAlbums, 'id' | 'council_id' | 'created_by_member_id'>): void {
  const denial = albumDeleteDenial(actor, album);
  if (denial) throw denial;
}

/** assertMayDeleteSmartAlbum as a yes/no. */
export const mayDeleteSmartAlbum = (actor: MemberWriteActor, album: Pick<MediaSmartAlbums, 'id' | 'council_id' | 'created_by_member_id'>): boolean =>
  albumDeleteDenial(actor, album) === null;
