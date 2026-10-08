// How portal screens send an Admin's upload to the Google Drive archival vault (Sprint 6D): to the portal's own server
// route (app/api/drive-vault), which holds the Drive credentials. Only Admins' uploads go to the vault.
import { BusinessRuleError, type DriveVaultKind, type SessionUser } from '@kofc/shared';

export const DRIVE_VAULT_ROUTE = '/api/drive-vault';
/** Oral History Testimonials (Sprint 6K): open to every Active member, unlike DRIVE_VAULT_ROUTE. */
export const DRIVE_VAULT_ORAL_HISTORY_ROUTE = '/api/drive-vault/oral-history';
/** The Marketing Factory's past-photo scan (Sprint 6C). */
export const DRIVE_VAULT_MEDIA_ROUTE = '/api/drive-vault/media';

/**
 * The Drive file id for `file`, or null when the vault is not in use (not an Admin, or the server has the vault
 * switched off), so the caller keeps its pre-vault blob link. A file the server refuses throws INVALID_INPUT.
 * Sprint 6C: media may name its event (`folder`), filing it under Media / <event name> for the Marketing Factory.
 */
export async function archiveToDriveVault(user: SessionUser, kind: DriveVaultKind, file: File, folder?: string): Promise<string | null> {
  if (user.memberType !== 'Admin' && user.memberType !== 'Super Admin') return null;
  const form = new FormData();
  form.set('kind', kind);
  form.set('file', file);
  if (folder) form.set('folder', folder);
  const res = await fetch(DRIVE_VAULT_ROUTE, { method: 'POST', body: form }).catch(() => null);
  const body = (await res?.json().catch(() => null)) as { archived?: boolean; fileId?: string; message?: string } | null;
  if (res?.status === 400) throw new BusinessRuleError('INVALID_INPUT', body?.message ?? `${file.name} was refused.`);
  if (res?.status === 502) throw new Error(body?.message ?? 'Google Drive did not accept the file.');
  return res?.ok && body?.archived && body.fileId ? body.fileId : null;
}

/**
 * The image ids filed in the vault under Media / <past event name> (Sprint 6C), or null when the vault is switched off
 * or did not answer, so the caller falls back to the photos saved on the event records.
 */
export async function listVaultEventPhotos(eventName: string): Promise<string[] | null> {
  const res = await fetch(`${DRIVE_VAULT_MEDIA_ROUTE}?${new URLSearchParams({ folder: eventName })}`).catch(() => null);
  const body = (await res?.json().catch(() => null)) as { available?: boolean; fileIds?: string[] } | null;
  return res?.ok && body?.available && Array.isArray(body.fileIds) ? body.fileIds : null;
}

/**
 * The Drive file id of an Oral History Testimonial (Sprint 6K), or null when the vault is switched off or did not answer,
 * so the caller keeps a blob link. A recording the server refuses throws INVALID_INPUT.
 */
export async function archiveOralHistory(file: File): Promise<string | null> {
  const form = new FormData();
  form.set('file', file);
  const res = await fetch(DRIVE_VAULT_ORAL_HISTORY_ROUTE, { method: 'POST', body: form }).catch(() => null);
  const body = (await res?.json().catch(() => null)) as { archived?: boolean; fileId?: string; message?: string } | null;
  if (res?.status === 400) throw new BusinessRuleError('INVALID_INPUT', body?.message ?? 'The recording was refused.');
  if (res?.status === 502) throw new Error(body?.message ?? 'Google Drive did not accept the recording.');
  return res?.ok && body?.archived && body.fileId ? body.fileId : null;
}

/** The blob link a screen stores when the vault is not in use: the file name rides after the #. */
export const localFileLink = (file: File): string => `${URL.createObjectURL(file)}#${encodeURIComponent(file.name)}`;
