// Server-only Google Drive client for the archival vault (Sprint 6D). Signs in as a Google service account (a signed
// JWT exchanged for an access token), finds or creates Fraternal Enterprise Suite / Minutes | Vouchers | Media in the
// council's shared drive, and uploads a file there with Drive API v3, returning the new file id.
//
// The credentials are read on the server from GOOGLE_DRIVE_CLIENT_EMAIL, GOOGLE_DRIVE_PRIVATE_KEY (the service
// account's PEM key; literal \n sequences are accepted) and GOOGLE_DRIVE_SHARED_DRIVE_ID (the shared drive the service
// account is a Content manager of). Never import this file from a client component.
import { createSign } from 'node:crypto';
import { driveVaultFolderPath, type DriveVaultKind } from '@kofc/shared';

export interface DriveCredentials {
  clientEmail: string;
  privateKey: string;
  sharedDriveId: string;
}

type Fetch = typeof fetch;

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const FILES_URL = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';
const FOLDER_MIME = 'application/vnd.google-apps.folder';

/** The vault's credentials from the environment, or null when any is missing. */
export function driveCredentialsFromEnv(env: NodeJS.ProcessEnv = process.env): DriveCredentials | null {
  const clientEmail = env.GOOGLE_DRIVE_CLIENT_EMAIL?.trim();
  const privateKey = env.GOOGLE_DRIVE_PRIVATE_KEY?.replace(/\\n/g, '\n').trim();
  const sharedDriveId = env.GOOGLE_DRIVE_SHARED_DRIVE_ID?.trim();
  return clientEmail && privateKey && sharedDriveId ? { clientEmail, privateKey, sharedDriveId } : null;
}

const base64url = (data: string | Buffer) => Buffer.from(data).toString('base64url');

/** The RS256-signed JWT a service account exchanges for an access token. */
export function serviceAccountAssertion(creds: DriveCredentials, nowSeconds = Math.floor(Date.now() / 1000)): string {
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(
    JSON.stringify({ iss: creds.clientEmail, scope: 'https://www.googleapis.com/auth/drive', aud: TOKEN_URL, iat: nowSeconds, exp: nowSeconds + 3600 }),
  );
  const signature = createSign('RSA-SHA256').update(`${header}.${claims}`).sign(creds.privateKey);
  return `${header}.${claims}.${base64url(signature)}`;
}

/** A Drive query string literal: backslashes and single quotes escaped. */
const literal = (text: string) => `'${text.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

export class GoogleDriveVault {
  private token: { value: string; expiresAt: number } | null = null;
  private readonly folderIds = new Map<string, string>();

  constructor(
    private readonly creds: DriveCredentials,
    private readonly http: Fetch = fetch,
  ) {}

  /** Uploads `data` into the folder for `kind` and returns the new Drive file id. */
  async upload(kind: DriveVaultKind, file: { name: string; mimeType: string; data: Uint8Array }): Promise<string> {
    const folderId = await this.ensureFolderPath(driveVaultFolderPath(kind));
    const boundary = `kofc-vault-${Date.now().toString(36)}`;
    const metadata = JSON.stringify({ name: file.name, parents: [folderId] });
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${file.mimeType}\r\n\r\n`),
      Buffer.from(file.data),
      Buffer.from(`\r\n--${boundary}--`),
    ]);
    const created = await this.call<{ id: string }>(`${UPLOAD_URL}?uploadType=multipart&supportsAllDrives=true&fields=id`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    });
    return created.id;
  }

  /** The id of the last folder in `path` under the shared drive's root, creating any that are missing. */
  async ensureFolderPath(path: readonly string[]): Promise<string> {
    let parent = this.creds.sharedDriveId;
    for (let i = 0; i < path.length; i++) {
      const key = path.slice(0, i + 1).join('/');
      const known = this.folderIds.get(key);
      parent = known ?? (await this.findOrCreateFolder(path[i], parent));
      this.folderIds.set(key, parent);
    }
    return parent;
  }

  private async findOrCreateFolder(name: string, parentId: string): Promise<string> {
    const q = `name = ${literal(name)} and mimeType = '${FOLDER_MIME}' and ${literal(parentId)} in parents and trashed = false`;
    const params = new URLSearchParams({
      q,
      corpora: 'drive',
      driveId: this.creds.sharedDriveId,
      includeItemsFromAllDrives: 'true',
      supportsAllDrives: 'true',
      fields: 'files(id)',
      pageSize: '1',
    });
    const found = await this.call<{ files?: { id: string }[] }>(`${FILES_URL}?${params}`, { method: 'GET' });
    if (found.files?.[0]?.id) return found.files[0].id;
    const created = await this.call<{ id: string }>(`${FILES_URL}?supportsAllDrives=true&fields=id`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [parentId] }),
    });
    return created.id;
  }

  private async accessToken(): Promise<string> {
    if (this.token && Date.now() < this.token.expiresAt) return this.token.value;
    const res = await this.http(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: serviceAccountAssertion(this.creds) }),
    });
    const body = (await res.json().catch(() => null)) as { access_token?: string; expires_in?: number } | null;
    if (!res.ok || !body?.access_token) throw new Error(`Google sign-in for the Drive vault failed (HTTP ${res.status}).`);
    // Renew a minute early so a token never expires mid-upload.
    this.token = { value: body.access_token, expiresAt: Date.now() + ((body.expires_in ?? 3600) - 60) * 1000 };
    return this.token.value;
  }

  private async call<T>(url: string, init: RequestInit): Promise<T> {
    const headers = { ...(init.headers as Record<string, string> | undefined), Authorization: `Bearer ${await this.accessToken()}` };
    const res = await this.http(url, { ...init, headers });
    const body = (await res.json().catch(() => null)) as (T & { error?: { message?: string } }) | null;
    if (!res.ok || !body) throw new Error(`Google Drive answered HTTP ${res.status}${body?.error?.message ? `: ${body.error.message}` : ''}.`);
    return body;
  }
}
