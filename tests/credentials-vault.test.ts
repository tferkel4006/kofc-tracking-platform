// Sprint 6Y (Schema 40): the Centralized Encrypted Credentials Vault - the CouncilCredentialsVault table, the server's
// AES-256-GCM sealing, the masked status that is all a browser sees, the per-council Drive key and /api/councils/credentials.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanCredentialValue, credentialStatus, REDACTED_SECRET, SEALED_SECRET_PATTERN } from '@kofc/shared';
import { TABLES } from '../apps/web/services/generated/schema.generated';
import {
  CouncilCredentialsVault,
  councilDriveCredentials,
  credentialsVault,
  driveVaultClient,
  sealCredential,
  unsealCredential,
} from '../apps/web/services/server/credentials-vault';
import { credentialsVaultSecret } from '../apps/web/services/server/secrets';
import { signInOnServer } from '../apps/web/services/server/session';
import { GET as credentialsGet, POST as credentialsPost } from '../apps/web/app/api/councils/credentials/route';
import { GET as sessionGet } from '../apps/web/app/api/auth/session/route';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const SECRET = 's'.repeat(40);
const PASSWORD = 'app-pass word 9912!';
const PEM = '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASC\n-----END PRIVATE KEY-----';

beforeAll(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterAll(() => vi.restoreAllMocks());

describe('schema 40', () => {
  it('creates CouncilCredentialsVault, drops Council.EmailPasswordEncrypted and bumps the phone database', () => {
    const schema = read('Schema.sql');
    expect(schema).toMatch(/CREATE TABLE \[CouncilCredentialsVault\]/);
    expect(TABLES.CouncilCredentialsVault.columns.map((c) => c.name)).toEqual(['id', 'council_id', 'credential_key', 'credential_value_encrypted', 'updated_at']);
    expect(TABLES.CouncilCredentialsVault.foreignKeys).toContainEqual(expect.objectContaining({ column: 'council_id', refTable: 'Council' }));
    expect(TABLES.CouncilCredentialsVault.uniqueKeys).toContainEqual(['council_id', 'credential_key']);
    expect(TABLES.Council.columns.map((c) => c.name)).not.toContain('EmailPasswordEncrypted');
    expect(read('apps/mobile/services/drivers/sqlite.ts')).toMatch(/const SCHEMA_VERSION = (4\d|[5-9]\d);/);
    expect(read('data_dictionary.md')).toContain('credential_value_encrypted (TEXT, NOT NULL)');
  });

  it('is read and written by no data driver - only by the web server', () => {
    for (const driver of ['apps/web/services/drivers/memory.ts', 'apps/mobile/services/drivers/sqlite.ts', 'packages/shared/src/contract.ts']) {
      expect(read(driver)).not.toMatch(/\[CouncilCredentialsVault\]|'CouncilCredentialsVault'|credential_value_encrypted|\[EmailPasswordEncrypted\]|\bEmailPasswordEncrypted[?:]/);
    }
  });
});

describe('sealing', () => {
  it('round-trips, and opens only for the same council, key and secret', () => {
    const sealed = sealCredential(PASSWORD, 1, 'SMTP_OUTBOUND_PASSWORD', SECRET);
    expect(sealed).toMatch(SEALED_SECRET_PATTERN);
    expect(sealed).not.toContain(Buffer.from(PASSWORD).toString('base64url'));
    expect(unsealCredential(sealed, 1, 'SMTP_OUTBOUND_PASSWORD', SECRET)).toBe(PASSWORD);
    expect(unsealCredential(sealed, 2, 'SMTP_OUTBOUND_PASSWORD', SECRET)).toBeNull();
    expect(unsealCredential(sealed, 1, 'GOOGLE_DRIVE_PRIVATE_KEY', SECRET)).toBeNull();
    expect(unsealCredential(sealed, 1, 'SMTP_OUTBOUND_PASSWORD', 't'.repeat(40))).toBeNull();
    expect(unsealCredential(`${sealed.slice(0, -2)}AA`, 1, 'SMTP_OUTBOUND_PASSWORD', SECRET)).toBeNull();
    expect(unsealCredential(PASSWORD, 1, 'SMTP_OUTBOUND_PASSWORD', SECRET)).toBeNull();
    expect(sealCredential(PASSWORD, 1, 'SMTP_OUTBOUND_PASSWORD', SECRET)).not.toBe(sealed);
  });

  it('seals a full-size Drive key within the stored pattern', () => {
    const big = 'k'.repeat(8000);
    expect(unsealCredential(sealCredential(big, 1, 'GOOGLE_DRIVE_PRIVATE_KEY', SECRET), 1, 'GOOGLE_DRIVE_PRIVATE_KEY', SECRET)).toBe(big);
  });

  it('checks each key by its own rules', () => {
    expect(() => cleanCredentialValue('SMTP_OUTBOUND_PASSWORD', '')).toThrow(/SMTP password/);
    expect(() => cleanCredentialValue('SMTP_OUTBOUND_PASSWORD', 'a\r\nb')).toThrow(/one line/);
    expect(() => cleanCredentialValue('SMTP_OUTBOUND_PASSWORD', 'x'.repeat(1001))).toThrow(/1-1000/);
    expect(() => cleanCredentialValue('GOOGLE_DRIVE_PRIVATE_KEY', 42)).toThrow(/private key/);
    expect(cleanCredentialValue('GOOGLE_DRIVE_PRIVATE_KEY', PEM.replace(/\n/g, '\\n'))).toBe(PEM);
  });

  it('reads CREDENTIALS_VAULT_SECRET, else the older EMAIL_GATEWAY_SECRET', () => {
    expect(credentialsVaultSecret({ CREDENTIALS_VAULT_SECRET: SECRET, EMAIL_GATEWAY_SECRET: 'e'.repeat(40) })).toBe(SECRET);
    expect(credentialsVaultSecret({ EMAIL_GATEWAY_SECRET: 'e'.repeat(40) })).toBe('e'.repeat(40));
    expect(credentialsVaultSecret({})).toHaveLength(64);
  });
});

describe('the vault table', () => {
  it('stores only sealed values, one row per council and key, and shows only a fixed mask', () => {
    const vault = new CouncilCredentialsVault(() => SECRET);
    const status = vault.put(1, 'SMTP_OUTBOUND_PASSWORD', PASSWORD, new Date('2026-10-07T12:00:00Z'));
    expect(status).toEqual({ credential_key: 'SMTP_OUTBOUND_PASSWORD', label: 'SMTP password', saved: true, masked: REDACTED_SECRET, updated_at: '2026-10-07 12:00:00' });
    vault.put(1, 'SMTP_OUTBOUND_PASSWORD', 'second', new Date('2026-10-07T13:00:00Z'));
    vault.put(2, 'GOOGLE_DRIVE_PRIVATE_KEY', PEM);

    const stored = JSON.stringify(vault);
    expect(stored).not.toContain(PASSWORD);
    expect(stored).not.toContain('second');
    expect(stored).not.toContain('BEGIN PRIVATE KEY');
    const rows = (vault as unknown as { rows: { council_id: number; credential_value_encrypted: string }[] }).rows;
    expect(rows).toHaveLength(2);
    for (const row of rows) expect(row.credential_value_encrypted).toMatch(SEALED_SECRET_PATTERN);

    expect(vault.reveal(1, 'SMTP_OUTBOUND_PASSWORD')).toBe('second');
    expect(vault.reveal(2, 'GOOGLE_DRIVE_PRIVATE_KEY')).toBe(PEM);
    expect(vault.reveal(2, 'SMTP_OUTBOUND_PASSWORD')).toBeNull();
    expect(vault.status(1).map((s) => s.updated_at)).toEqual(['2026-10-07 13:00:00']);
    expect(JSON.stringify(vault.status(2))).not.toMatch(/BEGIN|v1\./);

    expect(vault.remove(1, 'SMTP_OUTBOUND_PASSWORD')).toBe(true);
    expect(vault.remove(1, 'SMTP_OUTBOUND_PASSWORD')).toBe(false);
    expect(vault.status(1)).toEqual([]);
  });

  it('refuses a bad value without writing, and answers null when the secret changes', () => {
    let secret = SECRET;
    const vault = new CouncilCredentialsVault(() => secret);
    expect(() => vault.put(1, 'SMTP_OUTBOUND_PASSWORD', 'a\nb')).toThrow(/one line/);
    expect(vault.has(1, 'SMTP_OUTBOUND_PASSWORD')).toBe(false);
    vault.put(1, 'SMTP_OUTBOUND_PASSWORD', PASSWORD);
    secret = 't'.repeat(40);
    expect(vault.has(1, 'SMTP_OUTBOUND_PASSWORD')).toBe(true);
    expect(vault.reveal(1, 'SMTP_OUTBOUND_PASSWORD')).toBeNull();
  });

  it('masks a row by dropping its sealed value, not by trimming it', () => {
    const status = credentialStatus({ credential_key: 'GOOGLE_DRIVE_PRIVATE_KEY', updated_at: 'x' });
    expect(Object.keys(status).sort()).toEqual(['credential_key', 'label', 'masked', 'saved', 'updated_at']);
  });
});

describe('the Drive key', () => {
  const env = { GOOGLE_DRIVE_CLIENT_EMAIL: 'vault@x.iam.gserviceaccount.com', GOOGLE_DRIVE_PRIVATE_KEY: 'server-key', GOOGLE_DRIVE_SHARED_DRIVE_ID: 'd', DRIVE_VAULT_LIVE: '1' };

  it("uses the council's vaulted key over the server's, and stays off without DRIVE_VAULT_LIVE", () => {
    credentialsVault().put(7001, 'GOOGLE_DRIVE_PRIVATE_KEY', PEM);
    expect(councilDriveCredentials(7001, env)?.privateKey).toBe(PEM);
    expect(councilDriveCredentials(7002, env)?.privateKey).toBe('server-key');
    expect(councilDriveCredentials(7001, { ...env, DRIVE_VAULT_LIVE: undefined })).toBeNull();
    expect(councilDriveCredentials(7002, { ...env, GOOGLE_DRIVE_PRIVATE_KEY: undefined })).toBeNull();
    expect(councilDriveCredentials(7001, { ...env, GOOGLE_DRIVE_PRIVATE_KEY: undefined })?.privateKey).toBe(PEM);
    credentialsVault().remove(7001, 'GOOGLE_DRIVE_PRIVATE_KEY');
  });

  it('keeps one Drive client per service account and key', () => {
    const a = { clientEmail: 'a', privateKey: 'k1', sharedDriveId: 'd' };
    expect(driveVaultClient(a)).toBe(driveVaultClient({ ...a }));
    expect(driveVaultClient(a)).not.toBe(driveVaultClient({ ...a, privateKey: 'k2' }));
  });
});

// ---- the route -------------------------------------------------------------------------------------------------------

async function cookieFor(username: string): Promise<string> {
  const outcome = await signInOnServer(username, 'dev-pass-secure-9912');
  if (!outcome.ok) throw new Error(`${username} could not sign in: ${outcome.message}`);
  return outcome.cookie.split(';')[0];
}

const post = (body: unknown, cookie?: string) =>
  credentialsPost(
    new Request('http://localhost/api/councils/credentials', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) }),
  );

describe('/api/councils/credentials', () => {
  it("lets the council's Admin save, list (masked) and clear the Drive key, and refuses everyone else", async () => {
    const admin = await cookieFor('testadmin@kofc.org');
    const { councilId } = await (await sessionGet(new Request('http://localhost/api/auth/session', { headers: { cookie: admin } }))).json();
    const save = { councilId, credentialKey: 'GOOGLE_DRIVE_PRIVATE_KEY', value: PEM };

    expect((await post(save)).status).toBe(401);
    expect((await post(save, await cookieFor('testmember@kofc.org'))).status).toBe(403);
    expect((await post({ ...save, councilId: councilId + 1000 }, admin)).status).toBe(403);
    expect((await post({ ...save, councilId: 999 }, await cookieFor('testsuperadmin@kofc.org'))).status).toBe(404);
    expect((await post({ ...save, credentialKey: 'AWS_SECRET' }, admin)).status).toBe(400);
    expect((await post({ ...save, credentialKey: 'SMTP_OUTBOUND_PASSWORD' }, admin)).status).toBe(400);
    expect((await post({ ...save, value: '' }, admin)).status).toBe(400);

    const res = await post(save, admin);
    expect(res.status).toBe(200);
    const text = await res.clone().text();
    expect(text).not.toContain('PRIVATE KEY');
    expect(text).not.toMatch(/v1\.[A-Za-z0-9_-]{16}\./);
    expect((await res.json()).credentials).toEqual([expect.objectContaining({ credential_key: 'GOOGLE_DRIVE_PRIVATE_KEY', masked: REDACTED_SECRET })]);
    expect(credentialsVault().reveal(councilId, 'GOOGLE_DRIVE_PRIVATE_KEY')).toBe(PEM);

    const listUrl = `http://localhost/api/councils/credentials?councilId=${councilId}`;
    expect((await (await credentialsGet(new Request(listUrl, { headers: { cookie: admin } }))).json()).credentials).toHaveLength(1);
    expect((await credentialsGet(new Request(listUrl))).status).toBe(401);

    expect((await (await post({ councilId, credentialKey: 'GOOGLE_DRIVE_PRIVATE_KEY', clear: true }, admin)).json()).credentials).toEqual([]);
    expect(credentialsVault().has(councilId, 'GOOGLE_DRIVE_PRIVATE_KEY')).toBe(false);
  });
});
