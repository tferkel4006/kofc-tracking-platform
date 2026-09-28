// Sprint 5P: marking no-shows (events.setNoShow) and the system feedback inbox (feedback.submit/listInbox).
import { describe, expect, it } from 'vitest';
import { FEEDBACK_MAX_LENGTH, mayMarkNoShow, toTimestamp, type DataService, type MemberWriteActor, type NoShowTarget } from '@kofc/shared';
import { drivers, expectRule, MEMBER, NOW, shiftByName } from './helpers';

const OWN = 1;
const OTHER = 2;

async function signupOf(db: DataService, shiftName: string, memberId: number) {
  const shift = await shiftByName(db, shiftName);
  const signup = (await db.events.listSignups(shift.id)).find((s) => s.MemberID === memberId);
  if (!signup) throw new Error(`member ${memberId} is not signed up for ${shiftName}`);
  return signup;
}

const reasonIds = async (db: DataService) => (await db.lookups.list('NoShowReason')).map((r) => r.id);

describe('no-show permissions (pure rule)', () => {
  const actor = (over: Partial<MemberWriteActor> = {}): MemberWriteActor => ({ memberId: 10, councilId: OWN, memberType: 'Member', active: true, ...over });
  const target = (over: Partial<NoShowTarget> = {}): NoShowTarget => ({ signupId: 1, memberId: 10, eventId: 1, eventCouncilIds: [OWN], ...over });

  it('lets a member report only their own absence and never clear one', () => {
    expect(mayMarkNoShow(actor(), target(), true)).toBe(true);
    expect(mayMarkNoShow(actor(), target(), false)).toBe(false);
    expect(mayMarkNoShow(actor(), target({ memberId: 11 }), true)).toBe(false);
    expect(mayMarkNoShow(actor({ active: false }), target(), true)).toBe(false);
  });

  it('lets an Admin mark and clear anyone on their council’s events, and their own absence anywhere', () => {
    const admin = actor({ memberId: 20, memberType: 'Admin' });
    expect(mayMarkNoShow(admin, target(), true)).toBe(true);
    expect(mayMarkNoShow(admin, target(), false)).toBe(true);
    expect(mayMarkNoShow(admin, target({ eventCouncilIds: [OTHER] }), true)).toBe(false);
    expect(mayMarkNoShow(admin, target({ memberId: 20, eventCouncilIds: [OTHER] }), true)).toBe(true);
    expect(mayMarkNoShow({ ...admin, active: false }, target(), true)).toBe(false);
  });

  it('lets an active Super Admin mark and clear anywhere', () => {
    const superAdmin = actor({ memberId: 30, memberType: 'Super Admin', councilId: 99 });
    expect(mayMarkNoShow(superAdmin, target({ eventCouncilIds: [OTHER] }), true)).toBe(true);
    expect(mayMarkNoShow(superAdmin, target({ eventCouncilIds: [OTHER] }), false)).toBe(true);
  });
});

describe.each(drivers)('$name driver: marking no-shows', (d) => {
  it('lets a member report their own absence with a reason, which counts toward their badge', async () => {
    const db = await d.make();
    const [reason] = await reasonIds(db);
    const signup = await signupOf(db, 'Griddle Crew', MEMBER.member);
    const before = await db.events.countNoShows(MEMBER.member, '2000-01-01');

    const marked = await db.events.setNoShow(MEMBER.member, signup.id, true, reason);
    expect(marked).toMatchObject({ id: signup.id, NoShow: 1, NoShowReasonID: reason });
    expect(await db.events.countNoShows(MEMBER.member, '2000-01-01')).toBe(before + 1);

    // A member cannot erase a no-show, not even their own.
    await expectRule(db.events.setNoShow(MEMBER.member, signup.id, false), 'ADMIN_REQUIRED');
    expect((await signupOf(db, 'Griddle Crew', MEMBER.member)).NoShow).toBe(1);
  });

  it('refuses a member marking someone else', async () => {
    const db = await d.make();
    const [reason] = await reasonIds(db);
    const adminSignup = await signupOf(db, 'Check-in Desk', MEMBER.admin);
    await expectRule(db.events.setNoShow(MEMBER.member, adminSignup.id, true, reason), 'ADMIN_REQUIRED');
    expect((await signupOf(db, 'Check-in Desk', MEMBER.admin)).NoShow).toBe(0);
  });

  it('lets an Admin mark and clear no-shows on their council’s events only, and a Super Admin anywhere', async () => {
    const db = await d.make();
    const [reason] = await reasonIds(db);

    const own = await signupOf(db, 'Leaf Raking', MEMBER.member);
    expect(await db.events.setNoShow(MEMBER.admin, own.id, true, reason)).toMatchObject({ NoShow: 1, NoShowReasonID: reason });
    expect(await db.events.setNoShow(MEMBER.admin, own.id, false, reason)).toMatchObject({ NoShow: 0, NoShowReasonID: null });

    // Coat Collection is linked only to the affiliated council.
    const sister = await signupOf(db, 'Coat Sorting', MEMBER.member);
    await expectRule(db.events.setNoShow(MEMBER.admin, sister.id, true, reason), 'COUNCIL_ACCESS_DENIED');
    expect((await signupOf(db, 'Coat Sorting', MEMBER.member)).NoShow).toBe(0);
    expect(await db.events.setNoShow(MEMBER.superAdmin, sister.id, true, reason)).toMatchObject({ NoShow: 1 });

    // An Admin still reports their own absence on a sister council's event.
    const adminOwn = await signupOf(db, 'Check-in Desk', MEMBER.admin);
    expect(await db.events.setNoShow(MEMBER.admin, adminOwn.id, true, reason)).toMatchObject({ NoShow: 1 });
  });

  it('needs a known reason to mark, and a real signup and actor', async () => {
    const db = await d.make();
    const signup = await signupOf(db, 'Griddle Crew', MEMBER.member);
    await expectRule(db.events.setNoShow(MEMBER.member, signup.id, true), 'INVALID_INPUT');
    await expectRule(db.events.setNoShow(MEMBER.member, signup.id, true, 9999), 'INVALID_INPUT');
    await expectRule(db.events.setNoShow(MEMBER.member, 9999, true, (await reasonIds(db))[0]), 'RECORD_NOT_FOUND');
    await expectRule(db.events.setNoShow(9999, signup.id, true, (await reasonIds(db))[0]), 'MEMBER_NOT_FOUND');
    expect((await signupOf(db, 'Griddle Crew', MEMBER.member)).NoShow).toBe(0);
  });

  it('never marks a signup whose member has logged hours on the shift', async () => {
    const db = await d.make();
    const [reason] = await reasonIds(db);
    const shift = await shiftByName(db, 'Leaf Raking');
    await db.eventTime.logHours(MEMBER.member, shift.id, 2.5);
    const signup = await signupOf(db, 'Leaf Raking', MEMBER.member);
    const err = await expectRule(db.events.setNoShow(MEMBER.admin, signup.id, true, reason), 'NO_SHOW_HAS_HOURS');
    expect(err.message).toContain('2.5 hours');
    expect((await signupOf(db, 'Leaf Raking', MEMBER.member)).NoShow).toBe(0);
  });
});

describe.each(drivers)('$name driver: system feedback', (d) => {
  it('stores a member’s report, trimmed and stamped now', async () => {
    const db = await d.make();
    const saved = await db.feedback.submit(MEMBER.member, '  The shift feed hides my council.  ');
    expect(saved).toMatchObject({ MemberID: MEMBER.member, FeedbackText: 'The shift feed hides my council.', SubmittedAt: toTimestamp(NOW) });
    expect(d.count(db, 'SystemFeedback')).toBe(1);
  });

  it('refuses empty or over-long text and unknown members without writing', async () => {
    const db = await d.make();
    await expectRule(db.feedback.submit(MEMBER.member, '   '), 'INVALID_INPUT');
    await expectRule(db.feedback.submit(MEMBER.member, 'x'.repeat(FEEDBACK_MAX_LENGTH + 1)), 'INVALID_INPUT');
    await expectRule(db.feedback.submit(9999, 'Hello'), 'MEMBER_NOT_FOUND');
    expect(d.count(db, 'SystemFeedback')).toBe(0);
    expect((await db.feedback.submit(MEMBER.member, 'x'.repeat(FEEDBACK_MAX_LENGTH))).FeedbackText).toHaveLength(FEEDBACK_MAX_LENGTH);
  });

  it('opens the inbox, newest first with each sender, to Super Admins only', async () => {
    const db = await d.make();
    await db.feedback.submit(MEMBER.member, 'First report');
    await db.feedback.submit(MEMBER.admin, 'Second report');

    const inbox = await db.feedback.listInbox(MEMBER.superAdmin);
    expect(inbox.map((e) => e.feedback.FeedbackText)).toEqual(['Second report', 'First report']);
    const member = await db.members.get(MEMBER.member);
    const council = await db.councils.get(OWN);
    expect(inbox[1]).toMatchObject({
      firstName: member?.MemberFirstName,
      lastName: member?.MemberLastName,
      phone: member?.Phone,
      email: member?.Email,
      councilNumber: council?.CouncilNumber,
    });

    await expectRule(db.feedback.listInbox(MEMBER.admin), 'SUPER_ADMIN_REQUIRED');
    await expectRule(db.feedback.listInbox(MEMBER.member), 'SUPER_ADMIN_REQUIRED');
  });
});
