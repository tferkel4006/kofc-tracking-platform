// Sprint 6B Security: mandatory welcome setup codes (and the Admin's fresh code), and the self-service password reset -
// a 6-digit emailed code with an expiry, a guess limit, a request cooldown and no email enumeration - in both drivers and
// through the phone's onboarding controller.
import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildPasswordResetEmail,
  cleanResetCode,
  formatResetCode,
  isResetRequestCoolingDown,
  isResetTokenLive,
  RESET_CODE_LIFETIME_MINUTES,
  RESET_CODE_MAX_ATTEMPTS,
  resetCodeExpiry,
  type DataService,
  type SendGridMailRequest,
} from '@kofc/shared';
import { MemoryDataService } from '../apps/web/services/drivers/memory';
import { SqliteDataService } from '../apps/mobile/services/drivers/sqlite';
import { OnboardingController } from '../apps/mobile/services/onboarding';
import { sessionStore } from '../apps/mobile/services/session';
import { expectRule, MEMBER, NOW } from './helpers';
import { openDatabases } from './shims/expo-sqlite';
import { _reset } from './shims/expo-secure-store';

beforeEach(() => _reset());

const REGISTERED = 'testmember@kofc.org';
const DEV_PASSWORD = 'dev-pass-secure-9912';

/** A service whose clock the test moves and whose emails land in `sent`. */
async function make(name: 'memory' | 'sqlite') {
  let now = new Date(NOW);
  const sent: SendGridMailRequest[] = [];
  const options = { now: () => new Date(now), sendEmail: async (r: SendGridMailRequest) => void sent.push(r) };
  let db: DataService;
  if (name === 'memory') db = new MemoryDataService(options);
  else {
    openDatabases.length = 0;
    db = new SqliteDataService(options);
  }
  await db.init();
  return {
    db,
    sent,
    advance: (ms: number) => {
      now = new Date(now.getTime() + ms);
    },
  };
}

const resetCodeIn = (r: SendGridMailRequest): string => /reset code is:\s+(\d{6})/.exec(r.body.content[0]!.value)![1]!;
const setupCodeIn = (r: SendGridMailRequest): string => /one-time setup code: (\S+)/.exec(r.body.content[0]!.value)![1]!;
const wrong = (code: string) => String((Number(code) + 1) % 1_000_000).padStart(6, '0');

describe('password reset rules (pure)', () => {
  it('makes 6-digit codes, reads typed ones, and keeps a code alive only while unspent, unexpired and not guessed out', () => {
    expect(formatResetCode(new Uint8Array([0, 0, 0, 42]))).toBe('000042');
    expect(formatResetCode(new Uint8Array([255, 255, 255, 255]))).toBe('967295');
    expect(cleanResetCode(' 123 456 ')).toBe('123456');
    expect(cleanResetCode('12345')).toBeNull();
    expect(cleanResetCode('12a456')).toBeNull();
    expect(cleanResetCode(123456)).toBeNull();
    expect(resetCodeExpiry(new Date(Date.UTC(2026, 9, 6, 12)))).toBe('2026-10-06 12:15:00');
    const token = { ExpiresAt: '2026-10-06 12:15:00', ConsumedAt: null, FailedAttempts: 0 };
    const at = (m: number) => new Date(Date.UTC(2026, 9, 6, 12, m));
    expect(isResetTokenLive(token, at(14))).toBe(true);
    expect(isResetTokenLive(token, at(15))).toBe(false);
    expect(isResetTokenLive({ ...token, FailedAttempts: RESET_CODE_MAX_ATTEMPTS }, at(1))).toBe(false);
    expect(isResetTokenLive({ ...token, ConsumedAt: '2026-10-06 12:01:00' }, at(2))).toBe(false);
    expect(isResetRequestCoolingDown('2026-10-06 12:00:00', new Date(Date.UTC(2026, 9, 6, 12, 0, 59)))).toBe(true);
    expect(isResetRequestCoolingDown('2026-10-06 12:00:00', new Date(Date.UTC(2026, 9, 6, 12, 1, 0)))).toBe(false);
    expect(isResetRequestCoolingDown(null, NOW)).toBe(false);
    const email = buildPasswordResetEmail({ member: { id: 3, Email: REGISTERED, MemberFirstName: 'Test' }, code: '042917', expiresAt: '2026-10-06 12:15:00' });
    expect(email).toMatchObject({ kind: 'passwordReset', email: { to: REGISTERED } });
    expect(email.email.text).toContain('042917');
    expect(RESET_CODE_LIFETIME_MINUTES).toBe(15);
  });
});

describe.each(['memory', 'sqlite'] as const)('self-service password reset (%s driver)', (name) => {
  it('emails a code only to registered members, answering everyone alike, and throttles repeat requests', async () => {
    const { db, sent, advance } = await make(name);
    await db.auth.requestPasswordReset('stranger@example.com');
    await db.auth.requestPasswordReset('testnewmember@kofc.org'); // a member who never registered
    await db.auth.requestPasswordReset('');
    expect(sent).toHaveLength(0);

    await db.auth.requestPasswordReset(' TestMember@kofc.org ');
    expect(sent).toHaveLength(1);
    expect(sent[0]!.body.personalizations[0]!.to[0]!.email).toBe(REGISTERED);
    const first = resetCodeIn(sent[0]!);
    await db.auth.requestPasswordReset(REGISTERED); // within the cooldown: nothing sent
    expect(sent).toHaveLength(1);

    advance(61_000);
    await db.auth.requestPasswordReset(REGISTERED);
    expect(sent).toHaveLength(2);
    const second = resetCodeIn(sent[1]!);
    // Only the newest code works.
    if (first !== second) await expectRule(db.auth.verifyPasswordResetCode(REGISTERED, first), 'RESET_CODE_INVALID');
    await db.auth.verifyPasswordResetCode(REGISTERED, second);
  });

  it('sets a new password with the right code once, and never with a wrong, spent or expired one', async () => {
    const { db, sent, advance } = await make(name);
    await db.auth.requestPasswordReset(REGISTERED);
    const code = resetCodeIn(sent[0]!);

    await expectRule(db.auth.verifyPasswordResetCode(REGISTERED, wrong(code)), 'RESET_CODE_INVALID');
    await expectRule(db.auth.verifyPasswordResetCode('stranger@example.com', code), 'RESET_CODE_INVALID');
    await expectRule(db.auth.verifyPasswordResetCode(REGISTERED, 'abc'), 'RESET_CODE_INVALID');
    await db.auth.verifyPasswordResetCode(REGISTERED, code); // still good: checking does not spend it
    await expectRule(db.auth.resetPassword(REGISTERED, code, 'short'), 'PASSWORD_TOO_SHORT');

    const session = await db.auth.resetPassword(REGISTERED, code, 'a-brand-new-password');
    expect(session.memberId).toBe(MEMBER.member);
    expect(await db.auth.signIn(REGISTERED, DEV_PASSWORD)).toBeNull();
    expect((await db.auth.signIn(REGISTERED, 'a-brand-new-password'))?.memberId).toBe(MEMBER.member);
    await expectRule(db.auth.resetPassword(REGISTERED, code, 'yet-another-password'), 'RESET_CODE_INVALID');

    advance(61_000);
    await db.auth.requestPasswordReset(REGISTERED);
    const late = resetCodeIn(sent[1]!);
    advance(RESET_CODE_LIFETIME_MINUTES * 60_000);
    await expectRule(db.auth.resetPassword(REGISTERED, late, 'yet-another-password'), 'RESET_CODE_INVALID');
    expect((await db.auth.signIn(REGISTERED, 'a-brand-new-password'))?.memberId).toBe(MEMBER.member);
  });

  it(`kills a code after ${RESET_CODE_MAX_ATTEMPTS} wrong guesses, even for the right code after them`, async () => {
    const { db, sent } = await make(name);
    await db.auth.requestPasswordReset(REGISTERED);
    const code = resetCodeIn(sent[0]!);
    for (let i = 0; i < RESET_CODE_MAX_ATTEMPTS; i++) await expectRule(db.auth.verifyPasswordResetCode(REGISTERED, wrong(code)), 'RESET_CODE_INVALID');
    await expectRule(db.auth.resetPassword(REGISTERED, code, 'a-brand-new-password'), 'RESET_CODE_INVALID');
    expect((await db.auth.signIn(REGISTERED, DEV_PASSWORD))?.memberId).toBe(MEMBER.member);
  });

  it('lets an Admin send a fresh setup code to a member who has not registered, and only to them', async () => {
    const { db, sent } = await make(name);
    await expectRule(db.members.resendWelcome(MEMBER.member, MEMBER.newMember), 'ADMIN_REQUIRED');
    await expectRule(db.members.resendWelcome(MEMBER.admin, MEMBER.member), 'ALREADY_REGISTERED');
    await expectRule(db.members.resendWelcome(MEMBER.admin, 9999), 'MEMBER_NOT_FOUND');
    expect(sent).toHaveLength(0);
    await db.members.resendWelcome(MEMBER.admin, MEMBER.newMember);
    expect(sent).toHaveLength(1);
    const session = await db.auth.signUp('testnewmember@kofc.org', 'a-fine-password', setupCodeIn(sent[0]!));
    expect(session.memberId).toBe(MEMBER.newMember);
  });

  it("runs the phone's Forgot Password flow: email, code, new password, signed in", async () => {
    const { db, sent } = await make(name);
    const c = new OnboardingController({ db, sessions: sessionStore, councilNumber: 15295 });
    await c.start();
    expect(c.startPasswordReset()).toEqual({ screen: 'forgotPassword', email: '' });
    expect(await c.submitResetEmail('not-an-email')).toMatchObject({ screen: 'forgotPassword', error: expect.stringContaining('email') });
    expect(await c.submitResetEmail(REGISTERED)).toEqual({ screen: 'resetCode', email: REGISTERED });
    const code = resetCodeIn(sent[0]!);
    expect(await c.submitResetCode(wrong(code))).toMatchObject({ screen: 'resetCode', error: expect.stringContaining('not valid') });
    expect(await c.submitResetCode(code)).toEqual({ screen: 'newPassword', email: REGISTERED, code });
    expect(await c.submitNewPassword('a-brand-new-password', 'a-different-one')).toMatchObject({ screen: 'newPassword', error: 'The two passwords do not match.' });
    expect(await c.submitNewPassword('a-brand-new-password', 'a-brand-new-password')).toMatchObject({ screen: 'signedIn', user: { memberId: MEMBER.member } });

    // A stranger's email moves on the same way, and nothing is sent.
    const other = new OnboardingController({ db, sessions: sessionStore, councilNumber: 15295 });
    await other.signOut();
    other.startPasswordReset();
    expect(await other.submitResetEmail('stranger@example.com')).toEqual({ screen: 'resetCode', email: 'stranger@example.com' });
    expect(sent).toHaveLength(1);
  });
});
