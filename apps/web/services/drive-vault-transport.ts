// How portal screens send an Admin's upload to the Google Drive archival vault (Sprint 6D): to the portal's own server
// route (app/api/drive-vault), which holds the Drive credentials. Only Admins' uploads go to the vault.
import { BusinessRuleError, type DriveVaultKind, type SessionUser } from '@kofc/shared';

export const DRIVE_VAULT_ROUTE = '/api/drive-vault';

/**
 * The Drive file id for `file`, or null when the vault is not in use (not an Admin, or the server has the vault
 * switched off), so the caller keeps its pre-vault blob link. A file the server refuses throws INVALID_INPUT.
 */
export async function archiveToDriveVault(user: SessionUser, kind: DriveVaultKind, file: File): Promise<string | null> {
  if (user.memberType !== 'Admin' && user.memberType !== 'Super Admin') return null;
  const form = new FormData();
  form.set('kind', kind);
  form.set('file', file);
  const res = await fetch(DRIVE_VAULT_ROUTE, { method: 'POST', body: form }).catch(() => null);
  const body = (await res?.json().catch(() => null)) as { archived?: boolean; fileId?: string; message?: string } | null;
  if (res?.status === 400) throw new BusinessRuleError('INVALID_INPUT', body?.message ?? `${file.name} was refused.`);
  if (res?.status === 502) throw new Error(body?.message ?? 'Google Drive did not accept the file.');
  return res?.ok && body?.archived && body.fileId ? body.fileId : null;
}

/** The blob link a screen stores when the vault is not in use: the file name rides after the #. */
export const localFileLink = (file: File): string => `${URL.createObjectURL(file)}#${encodeURIComponent(file.name)}`;
