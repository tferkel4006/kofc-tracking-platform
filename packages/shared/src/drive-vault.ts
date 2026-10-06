// =========================================================================
// GOOGLE DRIVE ARCHIVAL VAULT (Sprint 6D)
// When an Admin uploads meeting minutes, an expense receipt or event media in the portal, the file goes to the
// council's shared Google Drive under
//   Fraternal Enterprise Suite / Minutes | Vouchers | Media
// and only the Drive file id is written to the record's existing link column (Meeting.MinutesURL,
// ExpenseLineItem.ReceiptPhotoURL, Event.PhotoGalleryURL). These pure helpers are shared by the portal's server route
// (apps/web/app/api/drive-vault), its Drive client and the screens that show a stored reference.
// =========================================================================
import { BusinessRuleError } from './rules';

export type DriveVaultKind = 'minutes' | 'voucher' | 'media';

export const DRIVE_VAULT_ROOT = 'Fraternal Enterprise Suite';
export const DRIVE_VAULT_FOLDERS: Readonly<Record<DriveVaultKind, string>> = { minutes: 'Minutes', voucher: 'Vouchers', media: 'Media' };
/** Largest file the vault accepts (25 MB). */
export const DRIVE_VAULT_MAX_BYTES = 25 * 1024 * 1024;

const PDF = 'application/pdf';
const ACCEPTED: Readonly<Record<DriveVaultKind, (mime: string) => boolean>> = {
  minutes: (m) =>
    m === PDF || m === 'text/plain' || m === 'application/msword' || m === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  voucher: (m) => m === PDF || m.startsWith('image/'),
  media: (m) => m.startsWith('image/') || m.startsWith('video/') || m === PDF,
};

/** The folder path a file of `kind` is filed under, root first. */
export const driveVaultFolderPath = (kind: DriveVaultKind): [string, string] => [DRIVE_VAULT_ROOT, DRIVE_VAULT_FOLDERS[kind]];

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

/** The Drive viewer page for a stored file id. */
export const driveFileViewUrl = (fileId: string): string => `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/view`;
