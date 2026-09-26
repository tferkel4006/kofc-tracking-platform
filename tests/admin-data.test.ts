import { describe, expect, it } from 'vitest';
import { drivers, expectRule, MEMBER, shiftByName } from './helpers';

// Dev seed, relative to 2026-09-20 (see helpers.ts). Council ids: 1 = 15295 (own), 2 = 1024 (affiliated),
// 3 = 3311 (unaffiliated). Parish Food Drive runs 09-22..09-26 for the own council only.
const OWN = 1;
const AFFILIATED = 2;
const UNAFFILIATED = 3;

describe.each(drivers)('$name driver: lookup maintenance', (d) => {
  it('creates a row, then refuses a duplicate key ignoring case and writes nothing', async () => {
    const db = await d.make();
    const row = await db.lookups.create('Role', { Role: 'Sergeant-at-Arms', Officer: 1 });
    expect(row).toMatchObject({ Role: 'Sergeant-at-Arms', Officer: 1 });
    expect((await db.lookups.list('Role')).map((r) => r.Role)).toContain('Sergeant-at-Arms');

    const before = d.count(db, 'Role');
    const err = await expectRule(db.lookups.create('Role', { Role: 'sergeant-at-arms', Officer: 0 }), 'INVALID_INPUT');
    expect(err.message).toContain('already exists');
    expect(d.count(db, 'Role')).toBe(before);
  });

  it('upper-cases the one-letter no-show code and rejects longer codes, unknown fields and blanks', async () => {
    const db = await d.make();
    expect(await db.lookups.create('NoShowReason', { NoShowReasonCode: 'f', NoShowReasonDescription: 'Sick' })).toMatchObject({
      NoShowReasonCode: 'F',
    });
    await expectRule(db.lookups.create('NoShowReason', { NoShowReasonCode: 'AB', NoShowReasonDescription: 'x' }), 'INVALID_INPUT');
    await expectRule(db.lookups.create('Degree', { Degree: 'Fifth', Colour: 'red' }), 'INVALID_INPUT');
    await expectRule(db.lookups.create('Degree', { Degree: '   ' }), 'INVALID_INPUT');
    await expectRule(db.lookups.create('Degree', { Degree: 'x'.repeat(11) }), 'INVALID_INPUT');
  });

  it('renames a row but not a built-in value the application looks up by name', async () => {
    const db = await d.make();
    const statuses = await db.lookups.list('MemberStatus');
    const inactive = statuses.find((s) => s.Status === 'Inactive')!;
    expect(await db.lookups.update('MemberStatus', inactive.id, { Status: 'Dormant' })).toMatchObject({ Status: 'Dormant' });

    const active = statuses.find((s) => s.Status === 'Active')!;
    const err = await expectRule(db.lookups.update('MemberStatus', active.id, { Status: 'Enrolled' }), 'LOOKUP_PROTECTED');
    expect(err.message).toContain('"Active"');
    expect((await db.lookups.list('MemberStatus')).find((s) => s.id === active.id)?.Status).toBe('Active');
    await expectRule(db.lookups.update('MemberStatus', 9999, { Status: 'Ghost' }), 'INVALID_INPUT');
  });

  it('refuses to rename a row to another row’s key', async () => {
    const db = await d.make();
    const cats = await db.lookups.list('Category');
    await expectRule(
      db.lookups.update('Category', cats[0].id, { Category: 'service', CategoryDescription: 'dup' }),
      'INVALID_INPUT',
    );
  });

  it('deletes an unused row, and refuses one still referenced or protected, naming where it is used', async () => {
    const db = await d.make();
    const fresh = await db.lookups.create('Category', { Category: 'Youth', CategoryDescription: 'Youth events' });
    await db.lookups.remove('Category', fresh.id);
    expect((await db.lookups.list('Category')).some((c) => c.id === fresh.id)).toBe(false);

    const service = (await db.lookups.list('Category')).find((c) => c.Category === 'Service')!;
    const inUse = await expectRule(db.lookups.remove('Category', service.id), 'LOOKUP_IN_USE');
    expect(inUse.message).toMatch(/Event\.CategoryID/);
    expect((await db.lookups.list('Category')).some((c) => c.id === service.id)).toBe(true);

    const active = (await db.lookups.list('MemberStatus')).find((s) => s.Status === 'Active')!;
    await expectRule(db.lookups.remove('MemberStatus', active.id), 'LOOKUP_PROTECTED');
    await expectRule(db.lookups.remove('Degree', 9999), 'INVALID_INPUT');
  });
});

describe.each(drivers)('$name driver: councils and activities', (d) => {
  it('lists councils by ascending CouncilNumber', async () => {
    const db = await d.make();
    expect((await db.councils.list()).map((c) => c.CouncilNumber)).toEqual([1024, 3311, 15295]);
  });

  it('lists affiliated councils in either direction and never the council itself', async () => {
    const db = await d.make();
    expect((await db.councils.listAffiliated(OWN)).map((c) => c.CouncilNumber)).toEqual([1024]);
    expect((await db.councils.listAffiliated(AFFILIATED)).map((c) => c.CouncilNumber)).toEqual([15295]);
    expect(await db.councils.listAffiliated(UNAFFILIATED)).toEqual([]);
  });

  it('lists a council’s own activities only', async () => {
    const db = await d.make();
    expect((await db.activities.listByCouncil(OWN)).map((a) => a.ActivityName)).toEqual(['Highway Cleanup']);
    expect(await db.activities.listByCouncil(AFFILIATED)).toEqual([]);
  });
});

describe.each(drivers)('$name driver: member shifts, feed and no-shows', (d) => {
  it('lists the member’s upcoming shifts soonest first, with their event', async () => {
    const db = await d.make();
    const mine = await db.events.listMemberShifts(MEMBER.member, { fromDate: '2026-09-20' });
    expect(mine.map((m) => m.shift.ShiftName)).toEqual(['Griddle Crew', 'Coat Sorting']);
    expect(mine[0]).toMatchObject({ event: { EventName: 'Joint Pancake Breakfast' }, hoursLogged: null });
    expect(mine[0].signup).toMatchObject({ MemberID: MEMBER.member, NoShow: 0 });
  });

  it('reports hours already logged against a past shift', async () => {
    const db = await d.make();
    const leaf = await shiftByName(db, 'Leaf Raking');
    await db.eventTime.logHours(MEMBER.member, leaf.id, 2.25);
    const past = await db.events.listMemberShifts(MEMBER.member, { fromDate: '2026-09-01', toDate: '2026-09-19' });
    expect(past).toHaveLength(1);
    expect(past[0]).toMatchObject({ hoursLogged: 2.25, shift: { ShiftName: 'Leaf Raking' } });
  });

  it('counts only no-shows inside the rolling window', async () => {
    const db = await d.make();
    expect(await db.events.countNoShows(MEMBER.member, '2025-09-20')).toBe(2); // 2026-08-31 and 2026-03-04
    expect(await db.events.countNoShows(MEMBER.member, '2000-01-01')).toBe(3); // adds the one from 2025-08-16
    expect(await db.events.countNoShows(MEMBER.member, '2026-09-01')).toBe(0);
    expect(await db.events.countNoShows(MEMBER.admin, '2000-01-01')).toBe(0);
  });

  it('feeds own-council shifts within six months, excluding other councils and later dates', async () => {
    const db = await d.make();
    const feed = await db.events.listShiftFeed({
      memberId: MEMBER.member,
      councilIds: [OWN],
      fromDate: '2026-09-20',
      toDate: '2027-03-20',
    });
    expect(feed.map((f) => f.shift.ShiftName)).toEqual(['Sorting Shift', 'Packing Shift', 'Delivery Shift', 'Griddle Crew', 'Serving Line']);
    const griddle = feed.find((f) => f.shift.ShiftName === 'Griddle Crew')!;
    expect(griddle).toMatchObject({ isSignedUp: true, councilIds: [OWN, AFFILIATED] });
    expect(feed.find((f) => f.shift.ShiftName === 'Sorting Shift')?.isSignedUp).toBe(false);
  });

  it('adds affiliated shifts, lists a shared event once and keeps full shifts in the feed', async () => {
    const db = await d.make();
    const feed = await db.events.listShiftFeed({
      memberId: MEMBER.member,
      councilIds: [OWN, AFFILIATED],
      fromDate: '2026-09-20',
      toDate: '2027-03-20',
    });
    expect(feed.map((f) => f.shift.ShiftName)).toEqual([
      'Sorting Shift', 'Packing Shift', 'Delivery Shift', 'Check-in Desk', 'Canteen', 'Griddle Crew', 'Serving Line', 'Coat Sorting',
    ]);
    const full = feed.filter((f) => f.shift.NumberVolunteersSignedUp >= f.shift.MinNumberVolunteers).map((f) => f.shift.ShiftName);
    expect(full).toEqual(['Delivery Shift', 'Coat Sorting']);
    expect(feed.some((f) => f.shift.ShiftName === 'Fry Cook')).toBe(false); // unaffiliated council
  });

  it('returns nothing for an empty council list', async () => {
    const db = await d.make();
    expect(await db.events.listShiftFeed({ memberId: 3, councilIds: [], fromDate: '2026-01-01', toDate: '2027-12-31' })).toEqual([]);
  });
});

describe.each(drivers)('$name driver: event planner', (d) => {
  const draft = { EventName: 'Bake Sale', EventDescription: 'Cakes', OwnerID: MEMBER.admin, StartDate: '2026-11-01', EndDate: '2026-11-02', Location: 'Hall', CategoryID: 1 };

  it('creates an event linked to its councils', async () => {
    const db = await d.make();
    const event = await db.events.create({ ...draft, Budget: 150 }, [OWN, AFFILIATED]);
    expect(event).toMatchObject({ EventName: 'Bake Sale', Budget: 150 });
    expect(await db.events.listCouncilIds(event.id)).toEqual([OWN, AFFILIATED]);
    expect((await db.events.listByCouncil(AFFILIATED)).map((e) => e.EventName)).toContain('Bake Sale');
  });

  it('rejects a bad event with an informative error and writes nothing', async () => {
    const db = await d.make();
    const events = d.count(db, 'Event');
    const links = d.count(db, 'EventCouncils');
    const backwards = await expectRule(db.events.create({ ...draft, EndDate: '2026-10-30' }, [OWN]), 'INVALID_INPUT');
    expect(backwards.message).toMatch(/ends \(2026-10-30\) before it starts \(2026-11-01\)/);
    await expectRule(db.events.create({ ...draft, EventName: '  ' }, [OWN]), 'INVALID_INPUT');
    await expectRule(db.events.create({ ...draft, StartDate: '2026-02-30' }, [OWN]), 'INVALID_DATE');
    await expectRule(db.events.create(draft, []), 'INVALID_INPUT');
    await expectRule(db.events.create(draft, [999]), 'INVALID_INPUT');
    await expectRule(db.events.create({ ...draft, OwnerID: 999 }, [OWN]), 'MEMBER_NOT_FOUND');
    await expectRule(db.events.create({ ...draft, CategoryID: 999 }, [OWN]), 'INVALID_INPUT');
    await expectRule(db.events.create({ ...draft, Budget: -5 }, [OWN]), 'INVALID_INPUT');
    expect(d.count(db, 'Event')).toBe(events);
    expect(d.count(db, 'EventCouncils')).toBe(links);
  });

  it('records the post-event ledger and clears a field with null', async () => {
    const db = await d.make();
    const food = (await db.events.listByCouncil(OWN)).find((e) => e.EventName === 'Parish Food Drive')!;
    const updated = await db.events.update(food.id, {
      Spend: 123.45,
      'FundsRaised-Cash': 200,
      'FundsRaised-Electronic': 50.5,
      ActualNumberAttendees: 42,
      Highlights: 'Record turnout',
    });
    expect(updated).toMatchObject({
      Spend: 123.45,
      'FundsRaised-Cash': 200,
      'FundsRaised-Electronic': 50.5,
      ActualNumberAttendees: 42,
      Highlights: 'Record turnout',
      EventName: 'Parish Food Drive',
    });
    expect((await db.events.update(food.id, { Highlights: null })).Highlights ?? null).toBeNull();
    expect((await db.events.get(food.id))?.Spend).toBe(123.45);
  });

  it('rejects malformed ledger values without changing the event', async () => {
    const db = await d.make();
    const food = (await db.events.listByCouncil(OWN)).find((e) => e.EventName === 'Parish Food Drive')!;
    await expectRule(db.events.update(food.id, { Spend: -1 }), 'INVALID_INPUT');
    await expectRule(db.events.update(food.id, { Spend: 1.005 }), 'INVALID_INPUT');
    await expectRule(db.events.update(food.id, { ActualNumberAttendees: 2.5 }), 'INVALID_INPUT');
    await expectRule(db.events.update(food.id, { EventName: null }), 'INVALID_INPUT');
    await expectRule(db.events.update(9999, { Spend: 1 }), 'EVENT_NOT_FOUND');
    expect(await db.events.get(food.id)).toMatchObject({ Spend: null });
  });

  it('will not move an event’s dates so that a shift falls outside them', async () => {
    const db = await d.make();
    const food = (await db.events.listByCouncil(OWN)).find((e) => e.EventName === 'Parish Food Drive')!;
    const err = await expectRule(db.events.update(food.id, { EndDate: '2026-09-23' }), 'INVALID_INPUT');
    expect(err.message).toContain('outside');
    expect((await db.events.get(food.id))?.EndDate).toBe('2026-09-26');
  });

  it('copies an event as a twin: shifts move together, signups and the ledger stay behind', async () => {
    const db = await d.make();
    const food = (await db.events.listByCouncil(OWN)).find((e) => e.EventName === 'Parish Food Drive')!;
    await db.events.update(food.id, { Spend: 99, ActualNumberAttendees: 10, Highlights: 'x' });
    const signupsBefore = d.count(db, 'EventSignup');

    const twin = await db.events.copy(food.id, { startDate: '2026-10-07', eventName: 'Parish Food Drive (Fall)' });
    expect(twin).toMatchObject({ EventName: 'Parish Food Drive (Fall)', StartDate: '2026-10-07', EndDate: '2026-10-11', OwnerID: food.OwnerID });
    expect(twin.Spend ?? null).toBeNull();
    expect(twin.ActualNumberAttendees ?? null).toBeNull();
    expect(twin.Highlights ?? null).toBeNull();

    const shifts = await db.events.listShifts(twin.id);
    expect(shifts.map((s) => [s.ShiftName, s.ShiftDate, s.NumberVolunteersSignedUp])).toEqual([
      ['Sorting Shift', '2026-10-07', 0],
      ['Packing Shift', '2026-10-09', 0],
      ['Delivery Shift', '2026-10-11', 0],
    ]);
    expect(shifts.map((s) => s.MinNumberVolunteers)).toEqual([3, 2, 1]);
    expect(await db.events.listCouncilIds(twin.id)).toEqual(await db.events.listCouncilIds(food.id));
    expect(d.count(db, 'EventSignup')).toBe(signupsBefore);
    expect((await db.events.get(food.id))?.Spend).toBe(99); // original untouched
  });

  it('refuses to copy an unknown event or to a bad date', async () => {
    const db = await d.make();
    const food = (await db.events.listByCouncil(OWN)).find((e) => e.EventName === 'Parish Food Drive')!;
    const events = d.count(db, 'Event');
    await expectRule(db.events.copy(9999, { startDate: '2026-10-07' }), 'EVENT_NOT_FOUND');
    await expectRule(db.events.copy(food.id, { startDate: 'next week' }), 'INVALID_DATE');
    await expectRule(db.events.copy(food.id, { startDate: '2026-10-07', eventName: ' ' }), 'INVALID_INPUT');
    expect(d.count(db, 'Event')).toBe(events);
  });

  it('replaces an event’s council links and refuses an empty or unknown list', async () => {
    const db = await d.make();
    const food = (await db.events.listByCouncil(OWN)).find((e) => e.EventName === 'Parish Food Drive')!;
    await db.events.setCouncils(food.id, [AFFILIATED, OWN]);
    expect(await db.events.listCouncilIds(food.id)).toEqual([OWN, AFFILIATED]);
    await expectRule(db.events.setCouncils(food.id, []), 'INVALID_INPUT');
    await expectRule(db.events.setCouncils(food.id, [999]), 'INVALID_INPUT');
    await expectRule(db.events.setCouncils(9999, [OWN]), 'EVENT_NOT_FOUND');
    expect(await db.events.listCouncilIds(food.id)).toEqual([OWN, AFFILIATED]);
  });

  it('adds a shift inside the event with 0 signups and rejects one outside it', async () => {
    const db = await d.make();
    const food = (await db.events.listByCouncil(OWN)).find((e) => e.EventName === 'Parish Food Drive')!;
    const shift = await db.events.createShift({
      ShiftName: 'Cleanup', ShiftDescription: 'Tidy the hall', ShiftDate: '2026-09-26', StartTime: '13:00', EndTime: '15:30:00',
      EventID: food.id, MinNumberVolunteers: 4,
    });
    expect(shift).toMatchObject({ ShiftName: 'Cleanup', StartTime: '13:00:00', EndTime: '15:30:00', NumberVolunteersSignedUp: 0, MinNumberVolunteers: 4 });

    const shifts = d.count(db, 'Shift');
    const base = { ShiftName: 'Late', ShiftDescription: '', StartTime: '13:00:00', EndTime: '14:00:00', EventID: food.id };
    const outside = await expectRule(db.events.createShift({ ...base, ShiftDate: '2026-09-27', MinNumberVolunteers: 2 }), 'INVALID_INPUT');
    expect(outside.message).toMatch(/2026-09-22 to 2026-09-26/);
    await expectRule(db.events.createShift({ ...base, ShiftDate: '2026-09-25', MinNumberVolunteers: 0 }), 'INVALID_INPUT');
    await expectRule(db.events.createShift({ ...base, ShiftDate: '2026-09-25', MinNumberVolunteers: 2, StartTime: '25:00' }), 'INVALID_INPUT');
    await expectRule(db.events.createShift({ ...base, ShiftDate: '2026-09-25', MinNumberVolunteers: 2, EventID: 9999 }), 'EVENT_NOT_FOUND');
    expect(d.count(db, 'Shift')).toBe(shifts);
  });

  it('lets the volunteer target rise, which reopens a full shift, but never fall below the signups', async () => {
    const db = await d.make();
    const coats = await shiftByName(db, 'Coat Sorting'); // 2 of 2: locked
    const err = await expectRule(db.events.updateShift(coats.id, { MinNumberVolunteers: 1 }), 'INVALID_INPUT');
    expect(err.message).toMatch(/already has 2 volunteers/);
    expect((await db.events.getShift(coats.id))?.MinNumberVolunteers).toBe(2);

    expect(await db.events.updateShift(coats.id, { MinNumberVolunteers: 3, ShiftName: 'Coat Sorting Crew' })).toMatchObject({
      MinNumberVolunteers: 3,
      ShiftName: 'Coat Sorting Crew',
      NumberVolunteersSignedUp: 2,
    });
    await db.events.signupForShift(MEMBER.superAdmin, coats.id); // the extra seat is now available
    await expectRule(db.events.updateShift(9999, { MinNumberVolunteers: 3 }), 'SHIFT_NOT_FOUND');
  });

  it('deletes an empty shift but not one with volunteers', async () => {
    const db = await d.make();
    const sorting = await shiftByName(db, 'Sorting Shift');
    const packing = await shiftByName(db, 'Packing Shift');
    await db.events.deleteShift(sorting.id);
    expect(await db.events.getShift(sorting.id)).toBeNull();

    const err = await expectRule(db.events.deleteShift(packing.id), 'SHIFT_HAS_SIGNUPS');
    expect(err.message).toContain('Packing Shift');
    expect(await db.events.getShift(packing.id)).not.toBeNull();
  });
});

describe.each(drivers)('$name driver: lessons learned and minutes', (d) => {
  it('adds, lists and removes lessons learned for an event', async () => {
    const db = await d.make();
    const food = (await db.events.listByCouncil(OWN)).find((e) => e.EventName === 'Parish Food Drive')!;
    const category = (await db.lookups.list('LessonsLearnedCategory')).find((c) => c.LessonsLearnedCategory === 'Planning')!;
    const lesson = await db.lessonsLearned.add(food.id, category.id, '  Order boxes earlier  ');
    expect(lesson).toMatchObject({ EventID: food.id, LessonsLearnedDescription: 'Order boxes earlier' });
    expect(await db.lessonsLearned.list(food.id)).toHaveLength(1);

    await expectRule(db.lessonsLearned.add(food.id, category.id, ' '), 'INVALID_INPUT');
    await expectRule(db.lessonsLearned.add(food.id, 999, 'x'), 'INVALID_INPUT');
    await expectRule(db.lessonsLearned.add(9999, category.id, 'x'), 'EVENT_NOT_FOUND');
    expect(d.count(db, 'LessonsLearned')).toBe(1);

    await db.lessonsLearned.remove(lesson.id);
    expect(await db.lessonsLearned.list(food.id)).toEqual([]);
    await expectRule(db.lessonsLearned.remove(lesson.id), 'INVALID_INPUT');
  });

  it('attaches, replaces and removes meeting minutes', async () => {
    const db = await d.make();
    const [meeting] = await db.meetings.listUpcoming(OWN);
    const set = await db.meetings.setMinutes(meeting.id, 'blob:minutes-2026-09.pdf');
    expect(set.MinutesURL).toBe('blob:minutes-2026-09.pdf');
    expect((await db.meetings.get(meeting.id))?.MinutesURL).toBe('blob:minutes-2026-09.pdf');
    expect((await db.meetings.setMinutes(meeting.id, null)).MinutesURL).toBe(''); // NOT NULL column: '' means no minutes
    await expectRule(db.meetings.setMinutes(meeting.id, 'x'.repeat(256)), 'INVALID_INPUT');
    await expectRule(db.meetings.setMinutes(9999, 'a.pdf'), 'MEETING_NOT_FOUND');
  });
});
