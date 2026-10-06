// Sprint 6D: Face ID / fingerprint sign-in keyed at setup-code time, and the Google Drive archival vault.
import { createVerify, generateKeyPairSync } from 'node:crypto';
import * as SecureStore from 'expo-secure-store';
import { beforeEach, describe, expect, it } from 'vitest';
import { assertDriveVaultUpload, BusinessRuleError, driveFileViewUrl, driveVaultFolderPath, isDriveFileId, type DataService } from '@kofc/shared';
import { BiometricLogin, type BiometricScanner } from '../apps/mobile/services/biometric-login';
import { OnboardingController } from '../apps/mobile/services/onboarding';
import { sessionStore } from '../apps/mobile/services/session';
import { driveCredentialsFromEnv, GoogleDriveVault, serviceAccountAssertion } from '../apps/web/services/google-drive';
import { DEV_ENROLLMENT_CODE } from '../apps/web/services/seed-dev';
import { _reset } from './shims/expo-secure-store';
import { drivers, MEMBER } from './helpers';

beforeEach(() => _reset());

const scanner = (opts: { available?: boolean; pass?: boolean } = {}) => {
  const calls = { scans: 0 };
  const s: BiometricScanner = {
    available: async () => opts.available ?? true,
    scan: async () => {
      calls.scans++;
      return opts.pass ?? true;
    },
  };
  return { s, calls };
};

const keystore = {
  getItemAsync: (k: string) => SecureStore.getItemAsync(k),
  setItemAsync: (k: string, v: string) => SecureStore.setItemAsync(k, v),
  deleteItemAsync: (k: string) => SecureStore.deleteItemAsync(k),
};
const biometricWith = (s: BiometricScanner) => new BiometricLogin(keystore, s, async () => 'ab'.repeat(32));
const storedKey = async () => {
  const raw = await SecureStore.getItemAsync('kofc.biometricKey');
  return raw ? JSON.parse(raw) : null;
};

async function registerNewMember(db: DataService, biometric: BiometricLogin) {
  const c = new OnboardingController({ db, sessions: sessionStore, councilNumber: 15295, biometric });
  await c.start();
  await c.submitEmail('testnewmember@kofc.org');
  expect(await c.submitPassword('a-fine-password', 'a-fine-password', DEV_ENROLLMENT_CODE)).toMatchObject({ screen: 'signedIn' });
  return c;
}

describe.each(drivers)('$name driver: biometric sign-in', (d) => {
  it('mints a device key when the setup code is spent and signs back in with only a scan', async () => {
    const db = await d.make();
    const { s, calls } = scanner();
    const c = await registerNewMember(db, biometricWith(s));
    expect(await storedKey()).toMatchObject({ key: 'ab'.repeat(32), email: 'testnewmember@kofc.org', user: { memberId: MEMBER.newMember } });

    // Signing out forgets the session but keeps the key, so the button is still offered.
    expect(await c.signOut()).toEqual({ screen: 'enterEmail' });
    expect(await SecureStore.getItemAsync('kofc.session')).toBeNull();
    expect(await c.biometricEmail()).toBe('testnewmember@kofc.org');
    const started = Date.now();
    expect(await c.submitBiometric()).toMatchObject({ screen: 'signedIn', user: { memberId: MEMBER.newMember } });
    expect(Date.now() - started).toBeLessThan(200);
    expect(calls.scans).toBe(1);
    expect(await SecureStore.getItemAsync('kofc.session')).not.toBeNull();
  });

  it('a failed scan signs nobody in and keeps the key', async () => {
    const db = await d.make();
    const c = await registerNewMember(db, biometricWith(scanner({ pass: false }).s));
    await c.signOut();
    expect(await c.submitBiometric()).toMatchObject({ screen: 'enterEmail', error: expect.stringContaining('did not pass') });
    expect(await storedKey()).not.toBeNull();
  });

  it('hides the button without biometrics, and refuses (and deletes) a key whose credential is gone', async () => {
    const db = await d.make();
    const c = await registerNewMember(db, biometricWith(scanner({ available: false }).s));
    await c.signOut();
    expect(await c.biometricEmail()).toBeNull();

    const raw = await storedKey();
    raw.user.credentialId = 99_999;
    await SecureStore.setItemAsync('kofc.biometricKey', JSON.stringify(raw));
    const c2 = new OnboardingController({ db, sessions: sessionStore, councilNumber: 15295, biometric: biometricWith(scanner().s) });
    await c2.start();
    expect(await c2.submitBiometric()).toMatchObject({ screen: 'enterEmail', error: expect.stringContaining('no longer valid') });
    expect(await storedKey()).toBeNull();
  });

  it('offers nothing on a phone that never spent a setup code', async () => {
    const db = await d.make();
    const c = new OnboardingController({ db, sessions: sessionStore, councilNumber: 15295, biometric: biometricWith(scanner().s) });
    await c.start();
    expect(await c.biometricEmail()).toBeNull();
    expect(await c.submitBiometric()).toMatchObject({ screen: 'enterEmail', error: expect.stringContaining('not set up') });
  });
});

describe('Drive archival vault helpers', () => {
  it('maps each kind to Fraternal Enterprise Suite / Minutes | Vouchers | Media', () => {
    expect(driveVaultFolderPath('minutes')).toEqual(['Fraternal Enterprise Suite', 'Minutes']);
    expect(driveVaultFolderPath('voucher')).toEqual(['Fraternal Enterprise Suite', 'Vouchers']);
    expect(driveVaultFolderPath('media')).toEqual(['Fraternal Enterprise Suite', 'Media']);
  });

  it('accepts the right types per folder and refuses the rest', () => {
    expect(assertDriveVaultUpload({ kind: 'voucher', name: 'r.pdf', mimeType: 'application/pdf', size: 10 })).toBe('voucher');
    expect(assertDriveVaultUpload({ kind: 'minutes', name: 'm.pdf', mimeType: 'application/pdf', size: 10 })).toBe('minutes');
    expect(assertDriveVaultUpload({ kind: 'media', name: 'p.jpg', mimeType: 'image/jpeg', size: 10 })).toBe('media');
    const refused = [
      { kind: 'other', name: 'x.pdf', mimeType: 'application/pdf', size: 10 },
      { kind: 'voucher', name: 'x.exe', mimeType: 'application/x-msdownload', size: 10 },
      { kind: 'minutes', name: 'x.jpg', mimeType: 'image/jpeg', size: 10 },
      { kind: 'media', name: 'x.jpg', mimeType: 'image/jpeg', size: 0 },
      { kind: 'media', name: 'x.jpg', mimeType: 'image/jpeg', size: 26 * 1024 * 1024 },
    ];
    for (const f of refused) expect(() => assertDriveVaultUpload(f)).toThrow(BusinessRuleError);
  });

  it('tells a bare Drive file id from blob links and relative paths', () => {
    expect(isDriveFileId('1AbCdEfGhIjKlMnOpQrStUvWxYz_-0123')).toBe(true);
    expect(isDriveFileId('blob:http://localhost:3000/abc#receipt.pdf')).toBe(false);
    expect(isDriveFileId('events/12/picnic.jpg')).toBe(false);
    expect(isDriveFileId('')).toBe(false);
    expect(driveFileViewUrl('abc')).toBe('https://drive.google.com/file/d/abc/view');
  });
});

describe('GoogleDriveVault (Drive API v3 over a fake fetch)', () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const creds = {
    clientEmail: 'vault@kofc.iam.gserviceaccount.com',
    privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    sharedDriveId: 'DRIVE0',
  };

  it('reads its credentials from the environment, or nothing when any is missing', () => {
    const env = { GOOGLE_DRIVE_CLIENT_EMAIL: 'a', GOOGLE_DRIVE_PRIVATE_KEY: 'k\\nk', GOOGLE_DRIVE_SHARED_DRIVE_ID: 'd' } as unknown as NodeJS.ProcessEnv;
    expect(driveCredentialsFromEnv(env)).toEqual({ clientEmail: 'a', privateKey: 'k\nk', sharedDriveId: 'd' });
    expect(driveCredentialsFromEnv({ GOOGLE_DRIVE_CLIENT_EMAIL: 'a' } as unknown as NodeJS.ProcessEnv)).toBeNull();
  });

  it('signs a verifiable RS256 service-account assertion', () => {
    const [h, c, sig] = serviceAccountAssertion(creds, 1_000).split('.');
    expect(createVerify('RSA-SHA256').update(`${h}.${c}`).verify(publicKey, Buffer.from(sig, 'base64url'))).toBe(true);
    expect(JSON.parse(Buffer.from(c, 'base64url').toString())).toMatchObject({ iss: creds.clientEmail, iat: 1_000, exp: 4_600 });
  });

  it('creates the nested folders once, uploads into the leaf and returns only the file id', async () => {
    const log: { method: string; url: string; body?: string }[] = [];
    let nextId = 0;
    const fake = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      const body = typeof init?.body === 'string' ? init.body : Buffer.isBuffer(init?.body) ? init.body.toString('latin1') : undefined;
      log.push({ method, url, body });
      const json = (v: unknown) => new Response(JSON.stringify(v), { status: 200 });
      if (url.startsWith('https://oauth2.googleapis.com/token')) return json({ access_token: 'tok', expires_in: 3600 });
      expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer tok');
      if (method === 'GET') return json({ files: [] });
      if (url.includes('/upload/')) return json({ id: 'FILE-ID-1' });
      return json({ id: `FOLDER-${++nextId}` });
    }) as typeof fetch;

    const vault = new GoogleDriveVault(creds, fake);
    expect(await vault.upload('voucher', { name: 'receipt.pdf', mimeType: 'application/pdf', data: new Uint8Array([37, 80, 68, 70]) })).toBe('FILE-ID-1');
    const folders = log.filter((l) => l.method === 'POST' && l.url.startsWith('https://www.googleapis.com/drive/v3/files'));
    expect(folders.map((l) => JSON.parse(l.body!))).toEqual([
      { name: 'Fraternal Enterprise Suite', mimeType: 'application/vnd.google-apps.folder', parents: ['DRIVE0'] },
      { name: 'Vouchers', mimeType: 'application/vnd.google-apps.folder', parents: ['FOLDER-1'] },
    ]);
    const upload = log.find((l) => l.url.includes('/upload/'))!;
    expect(upload.url).toContain('uploadType=multipart');
    expect(upload.body).toContain('"parents":["FOLDER-2"]');
    expect(upload.body).toContain('%PDF');

    // A second upload reuses the token and the cached folders: only the upload call goes out.
    const before = log.length;
    await vault.upload('voucher', { name: 'r2.pdf', mimeType: 'application/pdf', data: new Uint8Array([1]) });
    expect(log.slice(before).map((l) => l.url.includes('/upload/'))).toEqual([true]);
  });
});
