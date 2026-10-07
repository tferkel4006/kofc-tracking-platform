// =========================================================================
// BULLETINS BOARD (Sprint 6Z)
// /resources/bulletins gathers the council's files already filed in Google Drive into one card wall, newest first:
//   - meeting flyers (Meeting.GoogleDriveFlyerURL) and minutes (Meeting.GoogleDriveMinutesURL, or Meeting.MinutesURL
//     when it holds a Drive vault file id);
//   - event photo albums (Event.PhotoGalleryURL when it holds a Drive file id or a Drive link);
//   - event flyers filed by the Marketing Factory (Event.GoogleDriveFlyerFileID, Sprint 6C).
// Only Drive references become cards: a bare file id opens in the Drive viewer and a drive.google.com or
// docs.google.com link opens as stored. Anything else (a local blob, a gallery path) is left out.
// =========================================================================
import { driveFileViewUrl, isDriveFileId } from './drive-vault';
import type { Event, Meeting } from './types';

export type BulletinKind = 'Flyer' | 'Minutes' | 'Photo album';

export interface BulletinCard {
  key: string;
  kind: BulletinKind;
  /** The meeting or event name. */
  title: string;
  /** YYYY-MM-DD: the meeting date or the event's start date. */
  date: string;
  href: string;
}

const DRIVE_LINK = /^https:\/\/(drive|docs)\.google\.com\//i;

/** The Drive page a stored reference opens, or null when it is not a Drive reference. */
export function driveHref(value: string | null | undefined): string | null {
  const v = (value ?? '').trim();
  if (isDriveFileId(v)) return driveFileViewUrl(v);
  return DRIVE_LINK.test(v) ? v : null;
}

export function bulletinCards(
  meetings: readonly Pick<Meeting, 'id' | 'Meeting Name' | 'Date' | 'GoogleDriveFlyerURL' | 'GoogleDriveMinutesURL' | 'MinutesURL'>[],
  events: readonly Pick<Event, 'id' | 'EventName' | 'StartDate' | 'PhotoGalleryURL' | 'GoogleDriveFlyerFileID'>[],
): BulletinCard[] {
  const cards: BulletinCard[] = [];
  const add = (key: string, kind: BulletinKind, title: string, date: string, ref: string | null | undefined) => {
    const href = driveHref(ref);
    if (href) cards.push({ key, kind, title, date: date.slice(0, 10), href });
  };
  for (const m of meetings) {
    add(`meeting-${m.id}-flyer`, 'Flyer', m['Meeting Name'], m.Date, m.GoogleDriveFlyerURL);
    const minutes = driveHref(m.GoogleDriveMinutesURL) ? m.GoogleDriveMinutesURL : m.MinutesURL;
    add(`meeting-${m.id}-minutes`, 'Minutes', m['Meeting Name'], m.Date, minutes);
  }
  for (const e of events) {
    add(`event-${e.id}-flyer`, 'Flyer', e.EventName, e.StartDate, e.GoogleDriveFlyerFileID);
    add(`event-${e.id}-album`, 'Photo album', e.EventName, e.StartDate, e.PhotoGalleryURL);
  }
  return cards.sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title) || a.kind.localeCompare(b.kind));
}
