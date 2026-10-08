// =========================================================================
// GOOGLE DRIVE ARCHIVAL VAULT (Sprint 6D)
// When an Admin uploads meeting minutes, an expense receipt or event media in the portal, the file goes to the
// council's shared Google Drive under
//   Fraternal Enterprise Suite / Minutes | Vouchers | Media
// and only the Drive file id is written to the record's existing link column (Meeting.MinutesURL,
// ExpenseLineItem.ReceiptPhotoURL, Event.PhotoGalleryURL). These pure helpers are shared by the portal's server route
// (apps/web/app/api/drive-vault), its Drive client and the screens that show a stored reference.
// Sprint 6K: Oral History Testimonials go under Oral Histories, and the audio's file id is written to
// CouncilSpiritualDiary.audio_asset_url.
// =========================================================================
import { BusinessRuleError } from './rules';

export type DriveVaultKind = 'minutes' | 'voucher' | 'media' | 'flyer' | 'oral_history';

export const DRIVE_VAULT_ROOT = 'Fraternal Enterprise Suite';
export const DRIVE_VAULT_FOLDERS: Readonly<Record<DriveVaultKind, string>> = {
  minutes: 'Minutes',
  voucher: 'Vouchers',
  media: 'Media',
  flyer: 'Flyers',
  // Sprint 6K: the Oral History Testimonials recorded on the Team Legacy dashboard (/history).
  oral_history: 'Oral Histories',
};
/** Largest file the vault accepts (25 MB). */
export const DRIVE_VAULT_MAX_BYTES = 25 * 1024 * 1024;

const PDF = 'application/pdf';
const ACCEPTED: Readonly<Record<DriveVaultKind, (mime: string) => boolean>> = {
  minutes: (m) =>
    m === PDF || m === 'text/plain' || m === 'application/msword' || m === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  voucher: (m) => m === PDF || m.startsWith('image/'),
  media: (m) => m.startsWith('image/') || m.startsWith('video/') || m === PDF,
  flyer: (m) => m === 'text/html' || m === PDF,
  oral_history: (m) => m.startsWith('audio/'),
};

/** Longest event folder name under Media (Event.EventName is VARCHAR(100)). */
export const DRIVE_VAULT_SUBFOLDER_MAX_LENGTH = 100;

/**
 * An event's folder name under Media (Sprint 6C): the event name trimmed, with runs of white space collapsed. Null for a
 * blank name. Rejects INVALID_INPUT for a name with a slash or backslash (it would read as a nested path), a control
 * character, or more than DRIVE_VAULT_SUBFOLDER_MAX_LENGTH characters.
 */
export function cleanDriveVaultSubfolder(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw new BusinessRuleError('INVALID_INPUT', 'The vault folder name must be text.', {});
  const name = value.trim().replace(/\s+/g, ' ');
  if (name === '') return null;
  if (/[\\/\u0000-\u001f\u007f]/.test(name) || name.length > DRIVE_VAULT_SUBFOLDER_MAX_LENGTH) {
    throw new BusinessRuleError('INVALID_INPUT', `"${name.slice(0, 40)}" cannot be a vault folder name.`, { folder: name.slice(0, 40) });
  }
  return name;
}

/**
 * The folder path a file of `kind` is filed under, root first. Only media takes `subfolder` (an event's own folder,
 * already cleaned by cleanDriveVaultSubfolder); the other kinds ignore it.
 */
export const driveVaultFolderPath = (kind: DriveVaultKind, subfolder?: string | null): string[] =>
  kind === 'media' && subfolder ? [DRIVE_VAULT_ROOT, DRIVE_VAULT_FOLDERS.media, subfolder] : [DRIVE_VAULT_ROOT, DRIVE_VAULT_FOLDERS[kind]];

export function isDriveVaultKind(value: unknown): value is DriveVaultKind {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(DRIVE_VAULT_FOLDERS, value);
}

/** Refuses INVALID_INPUT for an unknown kind, an empty or oversized file, or a type the kind does not take. */
export function assertDriveVaultUpload(file: { kind: unknown; name: string; mimeType: string; size: number }): DriveVaultKind {
  const fail = (message: string) => new BusinessRuleError('INVALID_INPUT', message, { name: file.name, mimeType: file.mimeType });
  if (!isDriveVaultKind(file.kind)) throw fail(`Unknown vault folder "${String(file.kind)}".`);
  if (!file.name.trim()) throw fail('The file has no name.');
  if (file.size <= 0) throw fail(`${file.name} is empty.`);
  if (file.size > DRIVE_VAULT_MAX_BYTES) throw fail(`${file.name} is larger than ${DRIVE_VAULT_MAX_BYTES / 1024 / 1024} MB.`);
  if (!ACCEPTED[file.kind](file.mimeType.toLowerCase())) throw fail(`${file.name} is not a file type the ${DRIVE_VAULT_FOLDERS[file.kind]} folder takes.`);
  return file.kind;
}

/**
 * True for a bare Google Drive file id (letters, digits, - and _; 25 or more characters). Blob links, web links and
 * relative paths all contain ':' '/' or '.', so they never match.
 */
export const isDriveFileId = (value: string | null | undefined): boolean => !!value && /^[A-Za-z0-9_-]{25,128}$/.test(value);

/** Event.GoogleDriveFlyerFileID (Sprint 6C): a bare Drive file id, or null to clear. Rejects INVALID_INPUT otherwise. */
export function cleanFlyerFileId(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value === 'string' && isDriveFileId(value.trim())) return value.trim();
  throw new BusinessRuleError('INVALID_INPUT', 'The flyer reference must be a Google Drive file id.', {});
}

/** The Drive viewer page for a stored file id. */
export const driveFileViewUrl = (fileId: string): string => `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/view`;
