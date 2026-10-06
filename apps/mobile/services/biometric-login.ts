// Face ID / fingerprint sign-in (Sprint 6D). When a member spends their welcome-email setup code, the phone mints a
// random 32-byte device key and keeps it, with the member it belongs to, in the platform keystore (iOS Keychain /
// Android Keystore) through expo-secure-store, readable only while this device is unlocked and never backed up or
// migrated to another phone. The sign-in screen then offers "Sign In with FaceID / Biometrics": a passed device
// biometric check (no passcode fallback) releases the key, the member is re-read from the database (roles, council,
// and that the credential still exists) and signed in without the password.
//
// Signing out forgets the session but keeps the key, so the button is still there next time. A key whose member or
// credential has gone is deleted on the next attempt.
//
// The SQLite driver has no server, so the key is checked only against what the keystore holds; when the remote driver
// arrives, the key is what the API will validate (as with the session token in session.ts).
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import type { DataService, SessionUser } from '@kofc/shared';
import { randomTokenHex, refreshSessionUser, type KeyValueStore } from './session';

export interface BiometricKey {
  key: string;
  enrolledAt: string;
  email: string;
  user: SessionUser;
}

/** The slice of expo-local-authentication this module uses, so tests can substitute it. */
export interface BiometricScanner {
  /** True when the phone has biometric hardware with a face or finger enrolled. */
  available(): Promise<boolean>;
  /** Runs the device's biometric check; true when it passed. */
  scan(prompt: string): Promise<boolean>;
}

export type BiometricSignInResult =
  | { ok: true; user: SessionUser }
  | { ok: false; reason: 'noKey' | 'unavailable' | 'refused' | 'revoked' };

const BIOMETRIC_KEY = 'kofc.biometricKey';

export class BiometricLogin {
  constructor(
    private readonly kv: KeyValueStore,
    private readonly scanner: BiometricScanner,
    private readonly randomKey: () => Promise<string>,
  ) {}

  /** Stores a fresh device key for `user` (called once the setup code has been accepted). */
  async enroll(user: SessionUser, email: string): Promise<BiometricKey> {
    const record: BiometricKey = { key: await this.randomKey(), enrolledAt: new Date().toISOString(), email, user };
    await this.kv.setItemAsync(BIOMETRIC_KEY, JSON.stringify(record));
    return record;
  }

  /** The email the stored key belongs to, when the phone holds one and can scan; null hides the button. */
  async enrolledEmail(): Promise<string | null> {
    const record = await this.read();
    if (!record) return null;
    return (await this.scanner.available().catch(() => false)) ? record.email : null;
  }

  /** The biometric check, then the member behind the key. Nothing is signed in unless the scan passes. */
  async signIn(db: DataService): Promise<BiometricSignInResult> {
    const record = await this.read();
    if (!record) return { ok: false, reason: 'noKey' };
    if (!(await this.scanner.available().catch(() => false))) return { ok: false, reason: 'unavailable' };
    if (!(await this.scanner.scan('Sign in to Knights of Columbus').catch(() => false))) return { ok: false, reason: 'refused' };
    const user = await refreshSessionUser(db, record.user);
    if (!user) {
      await this.forget();
      return { ok: false, reason: 'revoked' };
    }
    return { ok: true, user };
  }

  /** Deletes the device key (the button disappears until the next enrollment). */
  forget(): Promise<void> {
    return this.kv.deleteItemAsync(BIOMETRIC_KEY);
  }

  private async read(): Promise<BiometricKey | null> {
    const raw = await this.kv.getItemAsync(BIOMETRIC_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as Partial<BiometricKey>;
      if (typeof parsed.key === 'string' && parsed.key.length >= 64 && typeof parsed.email === 'string' && typeof parsed.user?.memberId === 'number') {
        return parsed as BiometricKey;
      }
    } catch {
      // fall through: unreadable data is treated as no key
    }
    await this.forget();
    return null;
  }
}

/** The device's Face ID / Touch ID / fingerprint check, without a passcode fallback (as the pocket gate). */
export const deviceScanner: BiometricScanner = {
  available: async () => (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync()),
  scan: async (promptMessage) =>
    (await LocalAuthentication.authenticateAsync({ promptMessage, cancelLabel: 'Use password', disableDeviceFallback: true, fallbackLabel: '' })).success,
};

/** The app-wide biometric key, backed by the device keystore. */
export const biometricLogin = new BiometricLogin(
  {
    getItemAsync: (key) => SecureStore.getItemAsync(key),
    setItemAsync: (key, value) =>
      SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }),
    deleteItemAsync: (key) => SecureStore.deleteItemAsync(key),
  },
  deviceScanner,
  randomTokenHex,
);
