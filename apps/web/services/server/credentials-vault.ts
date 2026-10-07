// The Centralized Encrypted Credentials Vault (Sprint 6Y, Schema 40). SERVER ONLY, like secrets.ts.
//
// This module is the only reader and writer of CouncilCredentialsVault. put() takes a plain value and ALWAYS seals it
// before it touches a row - there is no way to store a value that has not been through the cipher - with AES-256-GCM
// under SHA-256(CREDENTIALS_VAULT_SECRET). The additional data is the row's council id AND credential key, so a sealed
// value copied onto another council or another key does not open. The sealed form is `v1.<iv>.<tag>.<ciphertext>`, each
// part base64url (SEALED_SECRET_PATTERN in @kofc/shared).
//
// reveal() hands the plain value to a server route at the moment of use (the SMTP send, the Drive sign-in). Everything
// that can reach a browser goes through status(), which answers CredentialStatus: the key, updated_at and the fixed
// REDACTED_SECRET mask, never the value or its sealed form. Nothing here logs a value.
//
// LIMIT OF THE MOCK: like the server's member copy (session.ts), the rows live in this process until the remote driver
// puts the table on the shared database; a restart empties the vault and the Admins enter the credentials again.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import {
  cleanCredentialValue,
  credentialStatus,
  CREDENTIAL_KEYS,
  SEALED_SECRET_PATTERN,
  type CouncilCredentialsVaultRow,
  type CredentialKey,
  type CredentialStatus,
} from '@kofc/shared';
import { GoogleDriveVault, type DriveCredentials } from '../google-drive';
import { credentialsVaultSecret, driveVaultOffReason, liveDriveCredentials } from './secrets';

if (typeof window !== 'undefined') {
  throw new Error('services/server/credentials-vault.ts was loaded in a browser. Server secrets must never reach the client bundle.');
}

const keyFrom = (secret: string): Buffer => createHash('sha256').update(`kofc-credentials-vault:${secret}`).digest();
const aad = (councilId: number, key: CredentialKey): Buffer => Buffer.from(`kofc-council-${councilId}:${key}`, 'utf8');

/** Seals a plain value for one council's key. The value must already be checked (cleanCredentialValue). */
export function sealCredential(value: string, councilId: number, key: CredentialKey, secret: string = credentialsVaultSecret()): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyFrom(secret), iv);
  cipher.setAAD(aad(councilId, key));
  const body = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), body.toString('base64url')].join('.');
}

/**
 * The plain value inside a sealed one, or null when it does not open: another key (CREDENTIALS_VAULT_SECRET changed, or
 * was never set and the server restarted), another council or credential key, or a damaged value.
 */
export function unsealCredential(sealed: string, councilId: number, key: CredentialKey, secret: string = credentialsVaultSecret()): string | null {
  if (!SEALED_SECRET_PATTERN.test(sealed)) return null;
  const [, iv, tag, body] = sealed.split('.');
  try {
    const decipher = createDecipheriv('aes-256-gcm', keyFrom(secret), Buffer.from(iv, 'base64url'));
    decipher.setAAD(aad(councilId, key));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(body, 'base64url')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

const timestamp = (at: Date) => at.toISOString().slice(0, 19).replace('T', ' ');

/** The CouncilCredentialsVault table: one row per council and credential key (its unique index). */
export class CouncilCredentialsVault {
  private rows: CouncilCredentialsVaultRow[] = [];
  private nextId = 1;

  constructor(private readonly secret: () => string = credentialsVaultSecret) {}

  /** Seals `value` and saves it as the council's `key`, replacing any earlier one. Rejects INVALID_INPUT for a bad value. */
  put(councilId: number, key: CredentialKey, value: unknown, now = new Date()): CredentialStatus {
    const sealed = sealCredential(cleanCredentialValue(key, value), councilId, key, this.secret());
    const existing = this.find(councilId, key);
    const row = existing ?? { id: this.nextId++, council_id: councilId, credential_key: key, credential_value_encrypted: '', updated_at: '' };
    row.credential_value_encrypted = sealed;
    row.updated_at = timestamp(now);
    if (!existing) this.rows.push(row);
    return credentialStatus(row);
  }

  /** The plain value, for a server route to use at once; null when there is none or it does not open. */
  reveal(councilId: number, key: CredentialKey): string | null {
    const row = this.find(councilId, key);
    return row ? unsealCredential(row.credential_value_encrypted, councilId, key, this.secret()) : null;
  }

  /** Whether the council has a row for `key`, whether or not it still opens. */
  has(councilId: number, key: CredentialKey): boolean {
    return this.find(councilId, key) !== undefined;
  }

  /** The masked view of one row, or null. */
  statusOf(councilId: number, key: CredentialKey): CredentialStatus | null {
    const row = this.find(councilId, key);
    return row ? credentialStatus(row) : null;
  }

  /** The masked view of every credential the council has saved, in CREDENTIAL_KEYS order. */
  status(councilId: number): CredentialStatus[] {
    return CREDENTIAL_KEYS.flatMap((key) => this.statusOf(councilId, key) ?? []);
  }

  /** Deletes the council's `key`; true when there was one. */
  remove(councilId: number, key: CredentialKey): boolean {
    const before = this.rows.length;
    this.rows = this.rows.filter((r) => !(r.council_id === councilId && r.credential_key === key));
    return this.rows.length < before;
  }

  private find(councilId: number, key: CredentialKey): CouncilCredentialsVaultRow | undefined {
    return this.rows.find((r) => r.council_id === councilId && r.credential_key === key);
  }
}

let vault: CouncilCredentialsVault | null = null;

/** The server's vault, one per process (the same lifetime as the server's data copy in session.ts). */
export const credentialsVault = (): CouncilCredentialsVault => (vault ??= new CouncilCredentialsVault());

// ---- the Drive vault's key (Sprint 6Y) -------------------------------------------------------------------------------

/**
 * The live Drive service account for `councilId`: the council's own GOOGLE_DRIVE_PRIVATE_KEY from the vault when it has
 * one, otherwise the server's (secrets.ts). Null unless the rest is configured and DRIVE_VAULT_LIVE=1.
 */
export const councilDriveCredentials = (councilId: number, env: Record<string, string | undefined> = process.env): DriveCredentials | null =>
  liveDriveCredentials(env, credentialsVault().reveal(councilId, 'GOOGLE_DRIVE_PRIVATE_KEY'));

/** Why the council's Drive vault is not in use, for the 503 answer. */
export const councilDriveOffReason = (councilId: number, env: Record<string, string | undefined> = process.env): string =>
  driveVaultOffReason(env, credentialsVault().reveal(councilId, 'GOOGLE_DRIVE_PRIVATE_KEY'));

const driveClients = new Map<string, GoogleDriveVault>();

/** One Drive client per service account and key, so each keeps its own access token and folder ids. */
export function driveVaultClient(creds: DriveCredentials): GoogleDriveVault {
  const id = createHash('sha256').update(`${creds.clientEmail}\n${creds.sharedDriveId}\n${creds.privateKey}`).digest('hex');
  let client = driveClients.get(id);
  if (!client) driveClients.set(id, (client = new GoogleDriveVault(creds)));
  return client;
}
