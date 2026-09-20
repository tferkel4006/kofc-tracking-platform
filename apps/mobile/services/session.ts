// Persistent on-device session (Blueprint: "On-Device Session Persistence").
// The signed-in user and an opaque session token live in the platform keystore
// (iOS Keychain / Android Keystore) through expo-secure-store, so the member
// stays signed in across launches without retyping the password.
//
// The SQLite driver has no server to validate the token against, so restore()
// re-checks the stored identity against the local database instead. When the
// remote driver arrives, the token is what the API will validate.
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import type { DataService, SessionUser } from '@kofc/shared';

/** The slice of expo-secure-store this module uses, so tests can substitute it. */
export interface KeyValueStore {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

export interface StoredSession {
  token: string;
  issuedAt: string;
  user: SessionUser;
}

export interface RestoreOptions {
  /**
   * Optional Face ID / fingerprint gate (Specifications: "option of using faceid").
   * Return false to refuse; the stored session is kept so the prompt can be retried.
   */
  authenticate?: () => Promise<boolean>;
}

const SESSION_KEY = 'kofc.session';

const toHex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

export class SessionStore {
  constructor(
    private readonly kv: KeyValueStore,
    private readonly randomToken: () => Promise<string>,
  ) {}

  /** Issues a fresh token for `user` and persists both. */
  async save(user: SessionUser): Promise<StoredSession> {
    const session: StoredSession = { token: await this.randomToken(), issuedAt: new Date().toISOString(), user };
    await this.kv.setItemAsync(SESSION_KEY, JSON.stringify(session));
    return session;
  }

  /**
   * Returns the remembered user, or null when there is none, it is corrupt, or the member
   * or credential it names no longer exists (a stale session is cleared). Roles and
   * council are re-read from the database so promotions and moves apply immediately.
   */
  async restore(db: DataService, options: RestoreOptions = {}): Promise<SessionUser | null> {
    const stored = await this.read();
    if (!stored) return null;
    if (options.authenticate && !(await options.authenticate())) return null;

    const member = await db.members.get(stored.user.memberId);
    if (!member || member.CredentialID !== stored.user.credentialId) {
      await this.clear();
      return null;
    }
    const roles = await db.members.listRoles(member.id);
    return {
      ...stored.user,
      councilId: member.CouncilID,
      firstName: member.MemberFirstName,
      lastName: member.MemberLastName,
      roles: roles.map((r) => r.Role),
      isOfficer: roles.some((r) => r.Officer === 1),
    };
  }

  /** Sign out: forget the session. */
  clear(): Promise<void> {
    return this.kv.deleteItemAsync(SESSION_KEY);
  }

  private async read(): Promise<StoredSession | null> {
    const raw = await this.kv.getItemAsync(SESSION_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as Partial<StoredSession>;
      const u = parsed.user;
      if (typeof parsed.token === 'string' && u && typeof u.memberId === 'number' && typeof u.credentialId === 'number') {
        return parsed as StoredSession;
      }
    } catch {
      // fall through: unreadable data is treated as no session
    }
    await this.clear();
    return null;
  }
}

/** 32 random bytes from the platform's secure generator, as 64 hex characters. */
const randomTokenHex = async () => toHex(await Crypto.getRandomBytesAsync(32));

/** The app-wide store, backed by the device keystore. */
export const sessionStore = new SessionStore(
  {
    getItemAsync: (key) => SecureStore.getItemAsync(key),
    setItemAsync: (key, value) =>
      SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }),
    deleteItemAsync: (key) => SecureStore.deleteItemAsync(key),
  },
  randomTokenHex,
);
