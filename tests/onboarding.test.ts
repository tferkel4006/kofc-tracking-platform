import * as SecureStore from 'expo-secure-store';
import { beforeEach, describe, expect, it } from 'vitest';
import type { DataService } from '@kofc/shared';
import { OnboardingController, findCouncilAdminContact } from '../apps/mobile/services/onboarding';
import { SessionStore, sessionStore } from '../apps/mobile/services/session';
import { _reset } from './shims/expo-secure-store';
import { drivers, MEMBER } from './helpers';

beforeEach(() => _reset());

const controllerFor = (db: DataService, extra: { authenticate?: () => Promise<boolean> } = {}) =>
  new OnboardingController({ db, sessions: sessionStore, councilNumber: 15295, ...extra });

const storedSession = async () => {
  const raw = await SecureStore.getItemAsync('kofc.session');
  return raw ? (JSON.parse(raw) as { token: string; user: { memberId: number } }) : null;
};

describe.each(drivers)('$name driver: mobile onboarding', (d) => {
  it('starts at the email prompt when nothing is remembered', async () => {
    const c = controllerFor(await d.make());
    expect(c.state).toEqual({ screen: 'loading' });
    expect(await c.start()).toEqual({ screen: 'enterEmail' });
  });

  it('rejects a malformed email without looking anything up', async () => {
    const c = controllerFor(await d.make());
    await c.start();
    const state = await c.submitEmail('not-an-email');
    expect(state).toMatchObject({ screen: 'enterEmail', error: expect.stringContaining('email') });
  });

  it('halts on contactAdmin with the council admin details when the email is not a member', async () => {
    const c = controllerFor(await d.make());
    await c.start();
    const state = await c.submitEmail('stranger@example.com');

    expect(state).toMatchObject({ screen: 'contactAdmin', email: 'stranger@example.com' });
    if (state.screen !== 'contactAdmin') throw new Error('unreachable');
    expect(state.message).toContain('stranger@example.com');
    expect(state.contact).toEqual({
      councilNumber: 15295,
      councilName: 'St. Jude Council',
      councilPhone: '503-555-0199',
      admin: { name: 'Council Admin', email: 'testadmin@kofc.org', phone: '555-333-4444' },
    });

    // frozen: further input changes nothing, and no session was created
    expect(await c.submitEmail('testmember@kofc.org')).toBe(state);
    expect(await c.submitPassword('some-password', 'some-password')).toBe(state);
    expect(await storedSession()).toBeNull();

    expect(c.restart()).toEqual({ screen: 'enterEmail' });
  });

  it('registers a preloaded member: hashes the password, signs them in and remembers the session', async () => {
    const db = await d.make();
    const c = controllerFor(db);
    await c.start();

    expect(await c.submitEmail('  TestNewMember@kofc.org ')).toEqual({
      screen: 'createPassword',
      email: 'testnewmember@kofc.org',
      firstName: 'Newly',
    });
    expect(await c.submitPassword('a-fine-password', 'a-different-one')).toMatchObject({
      screen: 'createPassword',
      error: 'The two passwords do not match.',
    });
    expect(await c.submitPassword('short', 'short')).toMatchObject({
      screen: 'createPassword',
      error: expect.stringContaining('at least 8 characters'),
    });

    const done = await c.submitPassword('a-fine-password', 'a-fine-password');
    expect(done).toMatchObject({ screen: 'signedIn', user: { memberId: MEMBER.newMember } });
    expect((await db.auth.signIn('testnewmember@kofc.org', 'a-fine-password'))?.memberId).toBe(MEMBER.newMember);

    const stored = await storedSession();
    expect(stored?.token).toMatch(/^[0-9a-f]{64}$/);
    expect(stored?.user.memberId).toBe(MEMBER.newMember);
  });

  it('keeps the member signed in on the next launch', async () => {
    const db = await d.make();
    const first = controllerFor(db);
    await first.start();
    await first.submitEmail('testnewmember@kofc.org');
    await first.submitPassword('a-fine-password', 'a-fine-password');

    const relaunch = controllerFor(db);
    expect(await relaunch.start()).toMatchObject({ screen: 'signedIn', user: { memberId: MEMBER.newMember } });
  });

  it('routes an already-registered member to sign-in instead of registration', async () => {
    const db = await d.make();
    const c = controllerFor(db);
    await c.start();
    expect(await c.submitEmail('testmember@kofc.org')).toMatchObject({ screen: 'createPassword' });

    expect(await c.submitPassword('brand-new-password', 'brand-new-password')).toEqual({
      screen: 'signIn',
      email: 'testmember@kofc.org',
    });
    expect(await c.submitPassword('wrong-password')).toMatchObject({ screen: 'signIn', error: expect.stringContaining('Incorrect') });
    expect(await c.submitPassword('koc15295')).toMatchObject({ screen: 'signedIn', user: { memberId: MEMBER.member } });
    // the failed registration must not have changed the real password
    expect((await db.auth.signIn('testmember@kofc.org', 'koc15295'))?.memberId).toBe(MEMBER.member);
  });

  it('discards a remembered session whose member no longer exists', async () => {
    const db = await d.make();
    const user = (await db.auth.signIn('testmember@kofc.org', 'koc15295'))!;
    await sessionStore.save({ ...user, memberId: 9999 });

    expect(await controllerFor(db).start()).toEqual({ screen: 'enterEmail' });
    expect(await storedSession()).toBeNull();
  });

  it('honours a biometric gate without discarding the session when it refuses', async () => {
    const db = await d.make();
    await sessionStore.save((await db.auth.signIn('testmember@kofc.org', 'koc15295'))!);

    expect(await controllerFor(db, { authenticate: async () => false }).start()).toEqual({ screen: 'enterEmail' });
    expect(await storedSession()).not.toBeNull();
    expect(await controllerFor(db, { authenticate: async () => true }).start()).toMatchObject({ screen: 'signedIn' });
  });

  it('signOut forgets the session', async () => {
    const db = await d.make();
    await sessionStore.save((await db.auth.signIn('testmember@kofc.org', 'koc15295'))!);
    const c = controllerFor(db);
    expect(await c.start()).toMatchObject({ screen: 'signedIn' });

    expect(await c.signOut()).toEqual({ screen: 'enterEmail' });
    expect(await storedSession()).toBeNull();
  });

  it('finds the council admin, and returns null for an unknown council', async () => {
    const db = await d.make();
    expect((await findCouncilAdminContact(db, 15295))?.admin?.email).toBe('testadmin@kofc.org');
    expect(await findCouncilAdminContact(db, 1)).toBeNull(); // no such council
  });
});

describe('SessionStore', () => {
  it('treats corrupt stored data as no session and clears it', async () => {
    const kv = new Map<string, string>([['kofc.session', '{not json']]);
    const store = new SessionStore(
      {
        getItemAsync: async (k) => kv.get(k) ?? null,
        setItemAsync: async (k, v) => void kv.set(k, v),
        deleteItemAsync: async (k) => void kv.delete(k),
      },
      async () => 'token',
    );
    const db = (await drivers[0].make()) as DataService;
    expect(await store.restore(db)).toBeNull();
    expect(kv.size).toBe(0);
  });
});
