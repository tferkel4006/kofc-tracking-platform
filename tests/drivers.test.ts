import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { drivers, expectRule, MEMBER, shiftByName } from './helpers';

const sha256 = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');

describe.each(drivers)('$name driver: auth', (d) => {
  it('stores seeded passwords as SHA-256 digests and signs in with the plaintext', async () => {
    const db = await d.make();
    await db.init();
    const stored = Object.fromEntries(d.credentials(db).map((c) => [c.Username, c.Password]));
    expect(stored['testmember@kofc.org']).toBe(sha256('koc15295'));
    expect(stored['testnewmember@kofc.org']).toBe(''); // placeholder for the pre-provisioned member

    expect((await db.auth.signIn('testmember@kofc.org', 'koc15295'))?.memberId).toBe(MEMBER.member);
    expect((await db.auth.signIn('TESTMEMBER@kofc.org', 'koc15295'))?.memberId).toBe(MEMBER.member);
    expect(await db.auth.signIn('testmember@kofc.org', 'wrong-password')).toBeNull();
    expect(await db.auth.signIn('testmember@kofc.org', sha256('koc15295'))).toBeNull(); // the digest is not a password
  });

  it('never signs in a member who has not registered', async () => {
    const db = await d.make();
    expect(await db.auth.signIn('testnewmember@kofc.org', '')).toBeNull();
    expect(await db.auth.signIn('testnewmember@kofc.org', 'anything-at-all')).toBeNull();
  });

  it('signUp links the pre-provisioned member to their credentials and signs them in', async () => {
    const db = await d.make();
    const session = await db.auth.signUp('TestNewMember@kofc.org', 'a-fine-password');
    expect(session).toMatchObject({ memberId: MEMBER.newMember, username: 'testnewmember@kofc.org', memberType: 'Member' });

    const stored = d.credentials(db).find((c) => c.Username === 'testnewmember@kofc.org');
    expect(stored?.Password).toBe(sha256('a-fine-password'));
    expect((await db.auth.signIn('testnewmember@kofc.org', 'a-fine-password'))?.memberId).toBe(MEMBER.newMember);
  });

  it('signUp rejects unknown emails, short passwords and repeat registrations without writing', async () => {
    const db = await d.make();
    const before = d.credentials(db).map((c) => c.Password);

    const missing = await expectRule(db.auth.signUp('nobody@example.com', 'long-enough-pw'), 'MEMBER_NOT_FOUND');
    expect(missing.message).toContain('nobody@example.com');
    await expectRule(db.auth.signUp('testnewmember@kofc.org', 'short'), 'PASSWORD_TOO_SHORT');
    await expectRule(db.auth.signUp('testmember@kofc.org', 'long-enough-pw'), 'ALREADY_REGISTERED');
    expect(d.credentials(db).map((c) => c.Password)).toEqual(before);

    await db.auth.signUp('testnewmember@kofc.org', 'first-password');
    await expectRule(db.auth.signUp('testnewmember@kofc.org', 'second-password'), 'ALREADY_REGISTERED');
    expect((await db.auth.signIn('testnewmember@kofc.org', 'first-password'))?.memberId).toBe(MEMBER.newMember);
    expect(await db.auth.signIn('testnewmember@kofc.org', 'second-password')).toBeNull();
  });
});

describe.each(drivers)('$name driver: shift signup and the capacity lock', (d) => {
  it('registers a volunteer and increments NumberVolunteersSignedUp', async () => {
    const db = await d.make();
    const shift = await shiftByName(db, 'Sorting Shift'); // min 3, none signed up
    const signup = await db.events.signupForShift(MEMBER.member, shift.id);
    expect(signup).toMatchObject({ ShiftID: shift.id, MemberID: MEMBER.member, NoShow: 0 });
    expect((await db.events.getShift(shift.id))?.NumberVolunteersSignedUp).toBe(1);
    expect(await db.events.listSignups(shift.id)).toHaveLength(1);
  });

  it('rejects a duplicate signup and leaves the count alone', async () => {
    const db = await d.make();
    const shift = await shiftByName(db, 'Sorting Shift');
    await db.events.signupForShift(MEMBER.member, shift.id);
    const signupsBefore = d.count(db, 'EventSignup');

    const err = await expectRule(db.events.signupForShift(MEMBER.member, shift.id), 'ALREADY_SIGNED_UP');
    expect(err.message).toContain('Sorting Shift');
    expect((await db.events.getShift(shift.id))?.NumberVolunteersSignedUp).toBe(1);
    expect(d.count(db, 'EventSignup')).toBe(signupsBefore);
  });

  it('locks the shift the moment Signed reaches Min', async () => {
    const db = await d.make();
    const shift = await shiftByName(db, 'Packing Shift'); // min 2, 1 signed up
    const signupsBefore = d.count(db, 'EventSignup');

    await db.events.signupForShift(MEMBER.member, shift.id); // takes the last seat: 2 of 2
    expect((await db.events.getShift(shift.id))?.NumberVolunteersSignedUp).toBe(2);

    const err = await expectRule(db.events.signupForShift(MEMBER.admin, shift.id), 'SHIFT_LOCKED');
    expect(err.message).toMatch(/"Packing Shift".*2 of 2/);
    expect((await db.events.getShift(shift.id))?.NumberVolunteersSignedUp).toBe(2);
    expect(d.count(db, 'EventSignup')).toBe(signupsBefore + 1); // only the first signup was written
  });

  it('refuses a shift that is already locked', async () => {
    const db = await d.make();
    const shift = await shiftByName(db, 'Delivery Shift'); // min 1, 1 signed up
    await expectRule(db.events.signupForShift(MEMBER.member, shift.id), 'SHIFT_LOCKED');
    expect((await db.events.getShift(shift.id))?.NumberVolunteersSignedUp).toBe(1);
  });

  it('rejects unknown shifts and members', async () => {
    const db = await d.make();
    const shift = await shiftByName(db, 'Sorting Shift');
    await expectRule(db.events.signupForShift(MEMBER.member, 9999), 'SHIFT_NOT_FOUND');
    await expectRule(db.events.signupForShift(9999, shift.id), 'MEMBER_NOT_FOUND');
    expect((await db.events.getShift(shift.id))?.NumberVolunteersSignedUp).toBe(0);
  });
});

describe.each(drivers)('$name driver: eventTime.logHours', (d) => {
  it('records hours for a signed-up shift and replaces them on a second log', async () => {
    const db = await d.make();
    const shift = await shiftByName(db, 'Leaf Raking'); // 10 days ago, member 3 signed up
    const first = await db.eventTime.logHours(MEMBER.member, shift.id, 2.5, 'raked the north lawn');
    expect(first).toMatchObject({ ShiftID: shift.id, MemberID: MEMBER.member, Hours: 2.5, ShiftNotes: 'raked the north lawn' });

    const second = await db.eventTime.logHours(MEMBER.member, shift.id, 3);
    expect(second).toMatchObject({ id: first.id, Hours: 3 });
    expect(d.count(db, 'EventTime')).toBe(1);
  });

  it.each([0.1, 1.3, 0.7, 2.6])('rejects %s hours and writes nothing', async (hours) => {
    const db = await d.make();
    const shift = await shiftByName(db, 'Leaf Raking');
    const err = await expectRule(db.eventTime.logHours(MEMBER.member, shift.id, hours), 'INVALID_HOURS_INCREMENT');
    expect(err.message).toContain(String(hours));
    expect(d.count(db, 'EventTime')).toBe(0);
  });

  it('rejects hours outside (0, 24]', async () => {
    const db = await d.make();
    const shift = await shiftByName(db, 'Leaf Raking');
    await expectRule(db.eventTime.logHours(MEMBER.member, shift.id, 0), 'HOURS_OUT_OF_RANGE');
    await expectRule(db.eventTime.logHours(MEMBER.member, shift.id, 24.25), 'HOURS_OUT_OF_RANGE');
    expect(d.count(db, 'EventTime')).toBe(0);
  });

  it('rejects a shift more than 3 months in the past', async () => {
    const db = await d.make();
    const shift = await shiftByName(db, 'Hall Setup'); // 120 days ago
    const err = await expectRule(db.eventTime.logHours(MEMBER.member, shift.id, 2), 'SHIFT_REPORT_TOO_OLD');
    expect(err.message).toContain('3 months');
    expect(d.count(db, 'EventTime')).toBe(0);
  });

  it('requires the member to have signed up for the shift', async () => {
    const db = await d.make();
    const shift = await shiftByName(db, 'Leaf Raking');
    await expectRule(db.eventTime.logHours(MEMBER.admin, shift.id, 2), 'NOT_SIGNED_UP');
    expect(d.count(db, 'EventTime')).toBe(0);
  });
});

describe.each(drivers)('$name driver: activityTime.logHours', (d) => {
  it('records hours against an activity', async () => {
    const db = await d.make();
    const row = await db.activityTime.logHours(MEMBER.member, 1, 1.25, '2026-09-19', 'bagged litter');
    expect(row).toMatchObject({
      MemberID: MEMBER.member,
      ActivityID: 1,
      ActivityDate: '2026-09-19',
      Hours: 1.25,
      ActivityNotes: 'bagged litter',
    });
    expect(d.count(db, 'ActivityTime')).toBe(1);
  });

  it.each([0.1, 0.9, 1.3])('rejects %s hours and writes nothing', async (hours) => {
    const db = await d.make();
    await expectRule(db.activityTime.logHours(MEMBER.member, 1, hours, '2026-09-19'), 'INVALID_HOURS_INCREMENT');
    expect(d.count(db, 'ActivityTime')).toBe(0);
  });

  it('accepts a date exactly 6 months back and rejects the day before it', async () => {
    const db = await d.make();
    await db.activityTime.logHours(MEMBER.member, 1, 1, '2026-03-20');
    const err = await expectRule(db.activityTime.logHours(MEMBER.member, 1, 1, '2026-03-19'), 'ACTIVITY_DATE_TOO_OLD');
    expect(err.message).toContain('2026-03-20');
    expect(d.count(db, 'ActivityTime')).toBe(1);
  });

  it('rejects impossible dates and unknown activities', async () => {
    const db = await d.make();
    await expectRule(db.activityTime.logHours(MEMBER.member, 1, 1, '2026-02-30'), 'INVALID_DATE');
    await expectRule(db.activityTime.logHours(MEMBER.member, 999, 1, '2026-09-19'), 'ACTIVITY_NOT_FOUND');
    expect(d.count(db, 'ActivityTime')).toBe(0);
  });
});
