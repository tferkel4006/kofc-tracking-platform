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
import { auditWindow } from './audits';
import { driveFileViewUrl, isDriveFileId } from './drive-vault';
import type { AuditPeriod, CouncilAudit, Event, Meeting } from './types';

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

// -------------------------------------------------------------------------
// THE UNIFIED ARTIFACT DRAWER (Sprint 6R)
// Council Artifacts lists the Drive files above together with the compliance reports the system compiles itself. Today
// that is the Form 1295 Semiannual Trustee Audit report (/api/finance/form-1295): one per audit period the Trustees have
// signed and locked. A report is not a stored file; the page compiles its PDF again from the locked desk on request.
// -------------------------------------------------------------------------

/** Where an artifact lives: a Google Drive file, or a report the portal compiles. */
export type ArtifactSource = 'drive' | 'system';

/** The kinds of system-compiled compliance reports. */
export type ComplianceReportKind = 'Form 1295 audit';

export type ArtifactKind = BulletinKind | ComplianceReportKind;

/** One drawer entry: a Drive card, or a compliance report the page compiles from `audit` on request. */
export type ArtifactEntry =
  | (BulletinCard & { source: 'drive' })
  | {
      source: 'system';
      key: string;
      kind: ComplianceReportKind;
      title: string;
      /** YYYY-MM-DD: the day the audit was locked. */
      date: string;
      audit: { fiscalYear: string; period: AuditPeriod };
    };

/** A Form 1295 report card per locked audit: the period and fraternal year, dated by the lock. Drafts are left out. */
export function complianceReportEntries(audits: readonly Pick<CouncilAudit, 'id' | 'audit_period' | 'fiscal_year' | 'execution_status' | 'locked_at' | 'created_at'>[]): ArtifactEntry[] {
  return audits
    .filter((a) => a.execution_status === 'LOCKED')
    .map((a) => ({
      source: 'system' as const,
      key: `audit-${a.id}`,
      kind: 'Form 1295 audit' as const,
      title: `Semiannual Trustee Audit · ${auditWindow(a.fiscal_year, a.audit_period).label}`,
      date: (a.locked_at ?? a.created_at).slice(0, 10),
      audit: { fiscalYear: a.fiscal_year, period: a.audit_period },
    }));
}

/** The drawer: Drive cards and compliance reports together, newest first, then by title and kind. */
export function unifiedArtifacts(drive: readonly BulletinCard[], reports: readonly ArtifactEntry[]): ArtifactEntry[] {
  return [...drive.map((c) => ({ ...c, source: 'drive' as const })), ...reports].sort(
    (a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title) || a.kind.localeCompare(b.kind),
  );
}
