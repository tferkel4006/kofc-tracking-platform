import { describe, expect, it } from 'vitest';
import {
  assertFundsEditable,
  assertMayChangeDonation,
  BusinessRuleError,
  buildActivityTimeLog,
  mergeDonationChanges,
  monthBounds,
  nextEventFunds,
  rollupEventFunds,
  SecurityPrivilegeError,
  summarizeActivities,
  summarizeDonations,
  summarizeMonth,
  type Activities,
  type ActivityTime,
  type DataService,
  type Donation,
  type Event,
} from '@kofc/shared';
import type { MemoryDataService } from '../apps/web/services/drivers/memory';
import { drivers, expectRule, MEMBER, NOW, shiftByName, type DriverUnderTest } from './helpers';
import { openDatabases } from './shims/expo-sqlite';

// Sprint 5K data plumbing: the event funds rollup on donation writes, RecordedBy and the donation correction
// rights, donation history, profile options, activity history and the monthly executive summary.
// Dev seed, relative to 2026-09-20 (see helpers.ts). Council 1 = 15295 (own), 2 = 1024 (affiliated).
// Own-council events, all owned by the seeded Admin (member 2): Fall Grounds Cleanup (09-10, shift Leaf Raking,
// member 3 signed up), Winter Coat Sort (08-31), Parish Food Drive (09-22). Neighborhood Blood Drive is the
// affiliated council's only. Council 1 has every donation method enabled and one activity, Highway Cleanup.
// Nothing seeds donations, EventTime or ActivityTime.
const OWN = 1;
const OTHER = 2;

async function eventByName(db: DataService, name: string): Promise<Event> {
  const events = [...(await db.events.listByCouncil(OWN)), ...(await db.events.listByCouncil(OTHER))];
  const event = events.find((e) => e.EventName === name);
  if (!event) throw new Error(`dev seed has no event named ${name}`);
  return event;
}

async function lookups(db: DataService) {
  const methods = await db.donations.listMethods(OWN);
  const method = (name: string) => methods.find((m) => m.method.DonationMethod === name)!.method.id;
  const types = await db.donations.listTypes(OWN);
  return {
    cash: method('Cash'),
    card: method('Credit Card'),
    venmo: method('Venmo'),
    items: method('Physical Items'),
    type: types.find((t) => t.DonationType === 'Parish Event')!.id,
  };
}

/** A donation of council 1, recorded by the seeded Member (3) unless another recorder is given. */
async function give(
  db: DataService,
  methodId: number,
  amount: number,
  eventId: number | null,
  extra: { recorder?: number; description?: string } = {},
): Promise<Donation> {
  const ids = await lookups(db);
  return db.donations.record(extra.recorder ?? MEMBER.member, {
    CouncilID: OWN,
    DonationMethodID: methodId,
    DonationTypeID: ids.type,
    DonationAmount: amount,
    EventID: eventId,
    DonationDesciption: extra.description ?? null,
  });
}

async function funds(db: DataService, eventId: number) {
  const e = await db.events.get(eventId);
  return { cash: e?.['FundsRaised-Cash'] ?? null, electronic: e?.['FundsRaised-Electronic'] ?? null };
}

async function otherCouncilAdmin(db: DataService): Promise<number> {
  const types = await db.lookups.list('MemberType');
  const statuses = await db.lookups.list('MemberStatus');
  const admin = await db.members.create(MEMBER.superAdmin, {
    CouncilID: OTHER,
    MemberNumber: 7700001,
    MemberFirstName: 'Other',
    MemberLastName: 'Admin',
    Phone: '503-555-0142',
    StreetAddress1: '1 Peace Way',
    City: 'Salem',
    State: 'OR',
    ZipCode: '97301',
    Email: 'other.admin@example.org',
    DateOfBirth: '1970-05-05',
    StatusID: statuses.find((s) => s.Status === 'Active')!.id,
    DegreeID: 3,
    MemberTypeID: types.find((t) => t.Type === 'Admin')!.id,
  });
  return admin.id;
}

/** Gives a member a Role straight in the backing store; the data service has no role-assignment method yet. */
function grantRole(d: DriverUnderTest, db: DataService, memberId: number, role: string): void {
  if (d.name === 'memory') {
    const store = (db as MemoryDataService).debugStore;
    store.insert('MemberRoles', { RoleID: store.rows('Role').find((r) => r.Role === role)!.id, MemberID: memberId });
  } else {
    openDatabases.at(-1)!.prepare('INSERT INTO [MemberRoles] ([RoleID], [MemberID]) SELECT [id], ? FROM [Role] WHERE [Role] = ?').run(memberId, role);
  }
}

async function expectPrivilege(promise: Promise<unknown>, code: 'ADMIN_REQUIRED' | 'COUNCIL_ACCESS_DENIED') {
  expect(await expectRule(promise, code)).toBeInstanceOf(SecurityPrivilegeError);
}

// ---- pure rules --------------------------------------------------------------

describe('donation totals and the event funds rollup', () => {
  it('sorts each method into cash, electronic or item value, summing in whole cents', () => {
    const totals = summarizeDonations([
      { DonationAmount: 0.1, kind: 'cash' },
      { DonationAmount: 0.2, kind: 'cash' },
      { DonationAmount: 10, kind: 'card' },
      { DonationAmount: 5.55, kind: 'qr' },
      { DonationAmount: 1, kind: 'other' },
      { DonationAmount: 250, kind: 'item' },
    ]);
    expect(totals).toEqual({ count: 6, cash: 0.3, electronic: 16.55, itemValue: 250, raised: 16.85 });
  });

  it('rolls up only when a cash or electronic donation exists; items alone leave the columns hand-entered', () => {
    expect(rollupEventFunds([])).toBeNull();
    expect(rollupEventFunds([{ DonationAmount: 80, kind: 'item' }])).toBeNull();
    expect(rollupEventFunds([{ DonationAmount: 80, kind: 'item' }, { DonationAmount: 12.5, kind: 'qr' }])).toEqual({
      'FundsRaised-Cash': 0,
      'FundsRaised-Electronic': 12.5,
    });
  });

  it('writes new sums, clears both columns when the last donation goes, and otherwise leaves them alone', () => {
    const some = { 'FundsRaised-Cash': 5, 'FundsRaised-Electronic': 0 };
    expect(nextEventFunds(null, some)).toEqual(some);
    expect(nextEventFunds(some, { ...some, 'FundsRaised-Cash': 9 })).toEqual({ ...some, 'FundsRaised-Cash': 9 });
    expect(nextEventFunds(some, null)).toEqual({ 'FundsRaised-Cash': null, 'FundsRaised-Electronic': null });
    expect(nextEventFunds(null, null)).toBeNull();
  });

  it('refuses a hand edit of a rolled-up column but accepts the same value or any other field', () => {
    const event = { id: 7, EventName: 'Fish Fry' };
    const rollup = { 'FundsRaised-Cash': 40, 'FundsRaised-Electronic': 12.5 };
    expect(() => assertFundsEditable(event, { 'FundsRaised-Cash': 40, 'FundsRaised-Electronic': 12.5, Spend: 3 }, rollup)).not.toThrow();
    for (const changes of [{ 'FundsRaised-Cash': 41 }, { 'FundsRaised-Electronic': null }]) {
      const err = (() => {
        try {
          assertFundsEditable(event, changes, rollup);
        } catch (e) {
          return e;
        }
      })();
      expect(err).toBeInstanceOf(BusinessRuleError);
      expect((err as BusinessRuleError).code).toBe('FUNDS_MANAGED_BY_DONATIONS');
    }
    expect(() => assertFundsEditable(event, { 'FundsRaised-Cash': 999 }, null)).not.toThrow();
  });

  it('merges corrections over the stored donation and refuses the council, the recorder and unknown fields', () => {
    const stored: Donation = { id: 3, CouncilID: 1, DonationDate: '2026-09-01', DonationMethodID: 1, DonationTypeID: 2, DonationAmount: 10, RecordedBy: 3 };
    expect(mergeDonationChanges(stored, { DonationAmount: 12.5, Donor: '  Ann  ' }, NOW)).toMatchObject({
      CouncilID: 1,
      DonationDate: '2026-09-01',
      DonationAmount: 12.5,
      Donor: 'Ann',
      EventID: null,
    });
    for (const bad of [{ CouncilID: 2 }, { RecordedBy: 1 }, { Colour: 'red' }]) {
      expect(() => mergeDonationChanges(stored, bad as never, NOW)).toThrow(BusinessRuleError);
    }
    expect(() => mergeDonationChanges(stored, { DonationAmount: 0 }, NOW)).toThrow(BusinessRuleError);
  });

  it('lets the recorder, the event owner, the council’s Admins and any Super Admin change a donation', () => {
    const donation = { id: 9, CouncilID: 1, RecordedBy: 3 };
    const actor = (memberId: number, memberType: string, councilId = 1, active = true) => ({ memberId, councilId, memberType, active });
    const code = (fn: () => void) => {
      try {
        fn();
        return 'ok';
      } catch (e) {
        return (e as BusinessRuleError).code;
      }
    };
    expect(code(() => assertMayChangeDonation(actor(3, 'Member'), donation, null, 'fix it'))).toBe('ok');
    expect(code(() => assertMayChangeDonation(actor(4, 'Member'), donation, 4, 'fix it'))).toBe('ok');
    expect(code(() => assertMayChangeDonation(actor(2, 'Admin'), donation, null, 'fix it'))).toBe('ok');
    expect(code(() => assertMayChangeDonation(actor(1, 'Super Admin', 2), donation, null, 'fix it'))).toBe('ok');
    expect(code(() => assertMayChangeDonation(actor(4, 'Member'), donation, 2, 'fix it'))).toBe('ADMIN_REQUIRED');
    expect(code(() => assertMayChangeDonation(actor(3, 'Member', 1, false), donation, null, 'fix it'))).toBe('ADMIN_REQUIRED');
    expect(code(() => assertMayChangeDonation(actor(8, 'Admin', 2), donation, null, 'fix it'))).toBe('COUNCIL_ACCESS_DENIED');

    const officer = (roles: string[], councilId = 1, active = true) => ({ ...actor(5, 'Member', councilId, active), roles });
    expect(code(() => assertMayChangeDonation(officer(['Treasurer']), donation, null, 'fix it'))).toBe('ok');
    expect(code(() => assertMayChangeDonation(officer(['Financial Secretary']), donation, null, 'fix it'))).toBe('ok');
    expect(code(() => assertMayChangeDonation(officer(['Treasurer'], 2), donation, null, 'fix it'))).toBe('ADMIN_REQUIRED');
    expect(code(() => assertMayChangeDonation(officer(['Treasurer'], 1, false), donation, null, 'fix it'))).toBe('ADMIN_REQUIRED');
    expect(code(() => assertMayChangeDonation(officer(['Grand Knight']), donation, null, 'fix it'))).toBe('ADMIN_REQUIRED');
  });
});

describe('activity and monthly summaries', () => {
  const activity = (id: number, name: string): Activities => ({ id, ActivityName: name, ActivityDescription: name, CategoryID: 1, CouncilID: 1 });
  const time = (id: number, activityId: number, memberId: number, date: string, hours: number): ActivityTime => ({
    id,
    MemberID: memberId,
    ActivityID: activityId,
    ActivityDate: date,
    Hours: hours,
    ActivityNotes: `entry ${id}`,
  });

  it('archives an activity once any time is logged and totals its hours', () => {
    const times = [time(1, 10, 3, '2026-09-01', 1.25), time(2, 10, 4, '2026-09-14', 2.5), time(3, 11, 3, '2026-09-02', 0.1)];
    expect(summarizeActivities([activity(10, 'Cleanup'), activity(12, 'Blood drive')], times)).toEqual([
      { activity: activity(10, 'Cleanup'), entryCount: 2, totalHours: 3.75, lastLoggedOn: '2026-09-14', archived: true },
      { activity: activity(12, 'Blood drive'), entryCount: 0, totalHours: 0, lastLoggedOn: null, archived: false },
    ]);
  });

  it('lists an activity’s entries newest first with member names and their total', () => {
    const names = new Map([
      [3, { MemberFirstName: 'Tom', MemberLastName: 'Member' }],
      [4, { MemberFirstName: 'Newly', MemberLastName: 'Enrolled' }],
    ]);
    const log = buildActivityTimeLog(activity(10, 'Cleanup'), [time(1, 10, 3, '2026-09-01', 1), time(2, 10, 4, '2026-09-14', 2), time(3, 10, 3, '2026-09-14', 0.5)], names);
    expect(log.entries.map((e) => [e.row.id, e.firstName, e.lastName])).toEqual([
      [3, 'Tom', 'Member'],
      [2, 'Newly', 'Enrolled'],
      [1, 'Tom', 'Member'],
    ]);
    expect(log.totalHours).toBe(3.5);
  });

  it('bounds a month, including a leap February, and refuses a bad month or year', () => {
    expect(monthBounds(2026, 9)).toEqual({ fromDate: '2026-09-01', toDate: '2026-09-30' });
    expect(monthBounds(2028, 2)).toEqual({ fromDate: '2028-02-01', toDate: '2028-02-29' });
    for (const [y, m] of [[2026, 0], [2026, 13], [1881, 5], [10000, 1], [2026, 1.5]]) {
      expect(() => monthBounds(y, m)).toThrow(BusinessRuleError);
    }
  });

  it('adds hours, counts distinct members, nets the ledger and collects highlights oldest first', () => {
    const event = (id: number, start: string, extra: Partial<Event>): Event => ({
      id,
      EventName: `Event ${id}`,
      EventDescription: '',
      OwnerID: 2,
      StartDate: start,
      EndDate: start,
      Location: 'Hall',
      CategoryID: 1,
      ...extra,
    });
    const summary = summarizeMonth(1, 2026, 9, {
      events: [
        event(2, '2026-09-20', { Spend: 100.1, 'FundsRaised-Cash': 20.2, Highlights: '  Record crowd  ', ActualNumberAttendees: 40 }),
        event(1, '2026-09-03', { 'FundsRaised-Electronic': 30, Highlights: 'Sold out' }),
        event(3, '2026-09-25', { Highlights: '   ', Spend: null as unknown as number }),
      ],
      eventTime: [
        { MemberID: 3, Hours: 2.25 },
        { MemberID: 4, Hours: 1 },
      ],
      activityTime: [
        { MemberID: 3, Hours: 0.5 },
        { MemberID: 1, Hours: 0.25 },
      ],
    });
    expect(summary).toMatchObject({
      fromDate: '2026-09-01',
      toDate: '2026-09-30',
      laborHours: { events: 3.25, activities: 0.75, total: 4 },
      uniqueMembers: 3,
      finances: { spend: 100.1, cash: 20.2, electronic: 30, raised: 50.2, net: -49.9 },
      outreach: { attendees: 40, events: 3 },
    });
    expect(summary.highlights).toEqual([
      { eventId: 1, eventName: 'Event 1', startDate: '2026-09-03', text: 'Sold out' },
      { eventId: 2, eventName: 'Event 2', startDate: '2026-09-20', text: 'Record crowd' },
    ]);
  });
});

// ---- drivers -----------------------------------------------------------------

describe.each(drivers)('$name driver: donation audit stamp and funds rollup', (d: DriverUnderTest) => {
  it('stamps RecordedBy with the recording member, and refuses an unknown one without writing', async () => {
    const db = await d.make();
    const ids = await lookups(db);
    const saved = await give(db, ids.cash, 20, null, { recorder: MEMBER.admin });
    expect(saved.RecordedBy).toBe(MEMBER.admin);
    const before = d.count(db, 'Donation');
    await expectRule(db.donations.record(999, { CouncilID: OWN, DonationMethodID: ids.cash, DonationTypeID: ids.type, DonationAmount: 5 }), 'MEMBER_NOT_FOUND');
    expect(d.count(db, 'Donation')).toBe(before);
  });

  it('overwrites the event’s cash and electronic funds with their sums, leaving physical items out', async () => {
    const db = await d.make();
    const ids = await lookups(db);
    const cleanup = await eventByName(db, 'Fall Grounds Cleanup');
    await db.events.update(cleanup.id, { 'FundsRaised-Cash': 500, 'FundsRaised-Electronic': 500 });

    await give(db, ids.cash, 20, cleanup.id);
    expect(await funds(db, cleanup.id)).toEqual({ cash: 20, electronic: 0 });
    await give(db, ids.venmo, 15.5, cleanup.id);
    await give(db, ids.card, 4.5, cleanup.id);
    await give(db, ids.items, 100, cleanup.id, { description: 'Two leaf blowers' });
    expect(await funds(db, cleanup.id)).toEqual({ cash: 20, electronic: 20 });

    // Standalone donations touch no event.
    const coat = await eventByName(db, 'Winter Coat Sort');
    await give(db, ids.cash, 7, null);
    expect(await funds(db, coat.id)).toEqual({ cash: null, electronic: null });
  });

  it('keeps hand-entered funds while an event has only physical-item donations', async () => {
    const db = await d.make();
    const ids = await lookups(db);
    const cleanup = await eventByName(db, 'Fall Grounds Cleanup');
    await db.events.update(cleanup.id, { 'FundsRaised-Cash': 75, 'FundsRaised-Electronic': 10 });
    await give(db, ids.items, 60, cleanup.id, { description: 'Rakes' });
    expect(await funds(db, cleanup.id)).toEqual({ cash: 75, electronic: 10 });
    await db.events.update(cleanup.id, { 'FundsRaised-Cash': 80 });
    expect(await funds(db, cleanup.id)).toEqual({ cash: 80, electronic: 10 });
  });

  it('refuses a hand edit of rolled-up funds without writing, but saves the same values and other ledger fields', async () => {
    const db = await d.make();
    const ids = await lookups(db);
    const cleanup = await eventByName(db, 'Fall Grounds Cleanup');
    await give(db, ids.cash, 25, cleanup.id);

    await expectRule(db.events.update(cleanup.id, { 'FundsRaised-Cash': 30, Spend: 12 }), 'FUNDS_MANAGED_BY_DONATIONS');
    await expectRule(db.events.update(cleanup.id, { 'FundsRaised-Electronic': null }), 'FUNDS_MANAGED_BY_DONATIONS');
    expect((await db.events.get(cleanup.id))?.Spend ?? null).toBeNull();

    const saved = await db.events.update(cleanup.id, { 'FundsRaised-Cash': 25, 'FundsRaised-Electronic': 0, Spend: 12, ActualNumberAttendees: 9 });
    expect(saved).toMatchObject({ 'FundsRaised-Cash': 25, 'FundsRaised-Electronic': 0, Spend: 12, ActualNumberAttendees: 9 });
  });

  it('re-totals both events when a donation moves, and clears the funds once the last donation is gone', async () => {
    const db = await d.make();
    const ids = await lookups(db);
    const cleanup = await eventByName(db, 'Fall Grounds Cleanup');
    const coat = await eventByName(db, 'Winter Coat Sort');
    const a = await give(db, ids.cash, 10, cleanup.id);
    const b = await give(db, ids.card, 6, cleanup.id);

    const moved = await db.donations.update(MEMBER.member, b.id, { EventID: coat.id, DonationAmount: 8 });
    expect(moved).toMatchObject({ EventID: coat.id, DonationAmount: 8, RecordedBy: MEMBER.member, CouncilID: OWN });
    expect(await funds(db, cleanup.id)).toEqual({ cash: 10, electronic: 0 });
    expect(await funds(db, coat.id)).toEqual({ cash: 0, electronic: 8 });

    await db.donations.update(MEMBER.member, a.id, { EventID: null });
    expect(await funds(db, cleanup.id)).toEqual({ cash: null, electronic: null });
    await db.events.update(cleanup.id, { 'FundsRaised-Cash': 3 }); // hand-editable again

    await db.donations.remove(MEMBER.member, b.id);
    expect(await funds(db, coat.id)).toEqual({ cash: null, electronic: null });
    expect((await db.donations.list(OWN)).map((x) => x.id)).toEqual([a.id]);
  });

  it('writes nothing, funds included, when a correction is refused', async () => {
    const db = await d.make();
    const ids = await lookups(db);
    const cleanup = await eventByName(db, 'Fall Grounds Cleanup');
    const blood = await eventByName(db, 'Neighborhood Blood Drive');
    const food = await eventByName(db, 'Parish Food Drive');
    const gift = await give(db, ids.cash, 10, cleanup.id);

    await expectRule(db.donations.update(MEMBER.member, gift.id, { DonationAmount: 0 }), 'INVALID_INPUT');
    await expectRule(db.donations.update(MEMBER.member, gift.id, { EventID: blood.id }), 'INVALID_INPUT'); // not our council's event
    await expectRule(db.donations.update(MEMBER.member, gift.id, { EventID: food.id }), 'INVALID_INPUT'); // not started yet
    await expectRule(db.donations.update(MEMBER.member, gift.id, { CouncilID: OTHER } as never), 'INVALID_INPUT');
    await expectRule(db.donations.update(MEMBER.member, 999, { DonationAmount: 5 }), 'RECORD_NOT_FOUND');
    await expectRule(db.donations.remove(MEMBER.member, 999), 'RECORD_NOT_FOUND');

    expect(await db.donations.list(OWN)).toEqual([gift]);
    expect(await funds(db, cleanup.id)).toEqual({ cash: 10, electronic: 0 });
  });
});

describe.each(drivers)('$name driver: who may correct or delete a donation', (d: DriverUnderTest) => {
  it('lets the recorder and the council’s Admin and Super Admin correct it, and refuses other members', async () => {
    const db = await d.make();
    const ids = await lookups(db);
    const gift = await give(db, ids.cash, 10, null);

    expect((await db.donations.update(MEMBER.member, gift.id, { Donor: 'Recorder fix' })).Donor).toBe('Recorder fix');
    expect((await db.donations.update(MEMBER.admin, gift.id, { Donor: 'Admin fix' })).Donor).toBe('Admin fix');
    expect((await db.donations.update(MEMBER.superAdmin, gift.id, { Donor: 'Super fix' })).Donor).toBe('Super fix');

    await expectPrivilege(db.donations.update(MEMBER.newMember, gift.id, { Donor: 'Not mine' }), 'ADMIN_REQUIRED');
    await expectPrivilege(db.donations.remove(MEMBER.newMember, gift.id), 'ADMIN_REQUIRED');
    await expectPrivilege(db.donations.update(await otherCouncilAdmin(db), gift.id, { Donor: 'Wrong council' }), 'COUNCIL_ACCESS_DENIED');
    await expectRule(db.donations.update(999, gift.id, { Donor: 'Nobody' }), 'MEMBER_NOT_FOUND');
    expect((await db.donations.list(OWN))[0]).toMatchObject({ Donor: 'Super fix', RecordedBy: MEMBER.member });
  });

  it('lets the council’s Treasurer or Financial Secretary correct and delete any of its donations', async () => {
    for (const role of ['Treasurer', 'Financial Secretary']) {
      const db = await d.make();
      const ids = await lookups(db);
      const gift = await give(db, ids.cash, 10, null);
      await expectPrivilege(db.donations.update(MEMBER.newMember, gift.id, { Donor: 'Not yet' }), 'ADMIN_REQUIRED');

      grantRole(d, db, MEMBER.newMember, role);
      expect((await db.donations.update(MEMBER.newMember, gift.id, { Donor: `${role} fix` })).Donor).toBe(`${role} fix`);
      await db.donations.remove(MEMBER.newMember, gift.id);
      expect(await db.donations.list(OWN)).toEqual([]);
    }
  });

  it('lets the event’s owner correct and delete its donations, but not move one to an event they do not own', async () => {
    const db = await d.make();
    const ids = await lookups(db);
    const cleanup = await eventByName(db, 'Fall Grounds Cleanup');
    const coat = await eventByName(db, 'Winter Coat Sort');
    await db.events.update(cleanup.id, { OwnerID: MEMBER.newMember });
    const first = await give(db, ids.cash, 10, cleanup.id);
    const second = await give(db, ids.cash, 5, cleanup.id);

    expect((await db.donations.update(MEMBER.newMember, first.id, { DonationAmount: 12 })).DonationAmount).toBe(12);
    await expectPrivilege(db.donations.update(MEMBER.newMember, first.id, { EventID: coat.id }), 'ADMIN_REQUIRED');
    await db.donations.remove(MEMBER.newMember, second.id);
    expect(await funds(db, cleanup.id)).toEqual({ cash: 12, electronic: 0 });

    // The recorder may move their own donation, since the right follows RecordedBy.
    await db.donations.update(MEMBER.member, first.id, { EventID: coat.id });
    expect(await funds(db, coat.id)).toEqual({ cash: 12, electronic: 0 });
  });
});

describe.each(drivers)('$name driver: donation history', (d: DriverUnderTest) => {
  it('lists standalone donations with names resolved and a summary of every event with donations', async () => {
    const db = await d.make();
    const ids = await lookups(db);
    const cleanup = await eventByName(db, 'Fall Grounds Cleanup');
    const coat = await eventByName(db, 'Winter Coat Sort');
    const older = await db.donations.record(MEMBER.admin, {
      CouncilID: OWN,
      DonationMethodID: ids.cash,
      DonationTypeID: ids.type,
      DonationAmount: 4,
      DonationDate: '2026-09-01',
    });
    const newer = await give(db, ids.venmo, 6, null);
    await give(db, ids.cash, 10, cleanup.id);
    await give(db, ids.items, 40, cleanup.id, { description: 'Gloves' });
    await give(db, ids.items, 15, coat.id, { description: 'Coats' });

    const history = await db.donations.listHistory(OWN);
    expect(history.entries.map((e) => [e.donation.id, e.methodName, e.kind, e.typeName, e.recordedByName])).toEqual([
      [newer.id, 'Venmo', 'qr', 'Parish Event', expect.any(String)],
      [older.id, 'Cash', 'cash', 'Parish Event', expect.any(String)],
    ]);
    expect(history.entries[0].recordedByName).not.toBe(history.entries[1].recordedByName);
    expect(history.events.map((e) => [e.event.EventName, e.totals, e.fundsManaged])).toEqual([
      ['Fall Grounds Cleanup', { count: 2, cash: 10, electronic: 0, itemValue: 40, raised: 10 }, true],
      ['Winter Coat Sort', { count: 1, cash: 0, electronic: 0, itemValue: 15, raised: 0 }, false],
    ]);
  });

  it('narrows to one event, even an empty one, and refuses an unknown or unlinked event', async () => {
    const db = await d.make();
    const ids = await lookups(db);
    const cleanup = await eventByName(db, 'Fall Grounds Cleanup');
    const food = await eventByName(db, 'Parish Food Drive');
    const gift = await give(db, ids.card, 9.99, cleanup.id);
    await give(db, ids.cash, 1, null);

    const one = await db.donations.listHistory(OWN, cleanup.id);
    expect(one.entries.map((e) => e.donation.id)).toEqual([gift.id]);
    expect(one.events).toHaveLength(1);
    expect(one.events[0].totals).toEqual({ count: 1, cash: 0, electronic: 9.99, itemValue: 0, raised: 9.99 });

    const empty = await db.donations.listHistory(OWN, food.id);
    expect(empty.entries).toEqual([]);
    expect(empty.events.map((e) => [e.event.id, e.totals.count, e.fundsManaged])).toEqual([[food.id, 0, false]]);

    await expectRule(db.donations.listHistory(OWN, 999), 'EVENT_NOT_FOUND');
    await expectRule(db.donations.listHistory(OWN, (await eventByName(db, 'Neighborhood Blood Drive')).id), 'INVALID_INPUT');
  });
});

describe.each(drivers)('$name driver: profile options and activity history', (d: DriverUnderTest) => {
  it('returns every skill, level, training class and working status in picker order', async () => {
    const db = await d.make();
    const options = await db.memberProfiles.listOptions();
    const skillNames = options.skills.map((s) => s.SkillName);
    expect(skillNames).toEqual([...skillNames].sort((a, b) => a.localeCompare(b)));
    expect(skillNames).toEqual(expect.arrayContaining(['Bartending', 'Plumbing', 'Finances']));
    expect(options.skillLevels.map((l) => l.SkillLevel)).toEqual(['Novice', 'Beginner', 'Intermediate', 'Senior', 'Expert']);
    expect(options.trainingClasses.map((c) => c.ClassName)).toEqual(['Background Check', 'Preventing Abuse and Protecting Those We Serve']);
    expect(options.workingStatuses.map((w) => w.WorkingStatus)).toEqual(['Student', 'Full Time', 'Part Time', 'Retired', 'Unemployed']);
  });

  it('moves an activity to history once time is logged and lists its entries with member names', async () => {
    const db = await d.make();
    const [cleanup] = await db.activities.listByCouncil(OWN);
    expect(await db.activities.listSummaries(OWN)).toEqual([
      { activity: cleanup, entryCount: 0, totalHours: 0, lastLoggedOn: null, archived: false },
    ]);
    expect(await db.activityTime.listByActivity(cleanup.id)).toEqual({ activity: cleanup, entries: [], totalHours: 0 });

    const a = await db.activityTime.logHours(MEMBER.member, cleanup.id, 1.5, '2026-09-01', 'north exit');
    const b = await db.activityTime.logHours(MEMBER.admin, cleanup.id, 2.25, '2026-09-12');
    const c = await db.activityTime.logHours(MEMBER.member, cleanup.id, 0.75, '2026-09-12', 'south exit');

    const log = await db.activityTime.listByActivity(cleanup.id);
    expect(log.entries.map((e) => [e.row.id, e.row.ActivityDate, e.row.Hours, e.row.ActivityNotes ?? null])).toEqual([
      [c.id, '2026-09-12', 0.75, 'south exit'],
      [b.id, '2026-09-12', 2.25, null],
      [a.id, '2026-09-01', 1.5, 'north exit'],
    ]);
    expect(log.entries[0].firstName).toBe(log.entries[2].firstName);
    expect(log.entries[0].lastName).not.toBe('');
    expect(log.totalHours).toBe(4.5);
    expect(await db.activities.listSummaries(OWN)).toEqual([
      { activity: cleanup, entryCount: 3, totalHours: 4.5, lastLoggedOn: '2026-09-12', archived: true },
    ]);
    await expectRule(db.activityTime.listByActivity(999), 'ACTIVITY_NOT_FOUND');
  });
});

describe.each(drivers)('$name driver: monthly executive summary', (d: DriverUnderTest) => {
  it('totals the month’s hours, members, ledger, attendance and highlights for the council only', async () => {
    const db = await d.make();
    const ids = await lookups(db);
    const cleanup = await eventByName(db, 'Fall Grounds Cleanup'); // 09-10
    const food = await eventByName(db, 'Parish Food Drive'); // 09-22
    const coat = await eventByName(db, 'Winter Coat Sort'); // 08-31
    const [activity] = await db.activities.listByCouncil(OWN);

    await db.eventTime.logHours(MEMBER.member, (await shiftByName(db, 'Leaf Raking')).id, 2.25);
    await db.activityTime.logHours(MEMBER.member, activity.id, 1.5, '2026-09-15');
    await db.activityTime.logHours(MEMBER.superAdmin, activity.id, 2, '2026-09-05');
    await db.activityTime.logHours(MEMBER.admin, activity.id, 4, '2026-08-15'); // August: not counted

    await db.events.update(cleanup.id, { Spend: 50, ActualNumberAttendees: 12, Highlights: 'Filled 80 bags' });
    await give(db, ids.cash, 30, cleanup.id); // synced into FundsRaised-Cash
    await db.events.update(food.id, { 'FundsRaised-Electronic': 10, ActualNumberAttendees: 3, Highlights: 'Pantry stocked' });
    await db.events.update(coat.id, { Spend: 999, Highlights: 'August event' });

    const september = await db.reports.monthlySummary(OWN, 2026, 9);
    expect(september).toEqual({
      councilId: OWN,
      year: 2026,
      month: 9,
      fromDate: '2026-09-01',
      toDate: '2026-09-30',
      laborHours: { events: 2.25, activities: 3.5, total: 5.75 },
      uniqueMembers: 2,
      finances: { spend: 50, cash: 30, electronic: 10, raised: 40, net: -10 },
      outreach: { attendees: 15, events: 2 },
      highlights: [
        { eventId: cleanup.id, eventName: 'Fall Grounds Cleanup', startDate: '2026-09-10', text: 'Filled 80 bags' },
        { eventId: food.id, eventName: 'Parish Food Drive', startDate: '2026-09-22', text: 'Pantry stocked' },
      ],
    });

    const august = await db.reports.monthlySummary(OWN, 2026, 8);
    expect(august).toMatchObject({ laborHours: { events: 0, activities: 4, total: 4 }, uniqueMembers: 1, finances: { spend: 999, net: -999 } });
    expect(august.highlights.map((h) => h.text)).toEqual(['August event']);

    // The affiliated council's only September event is its own Neighborhood Blood Drive; council 1's time is not its.
    expect(await db.reports.monthlySummary(OTHER, 2026, 9)).toMatchObject({
      laborHours: { total: 0 },
      uniqueMembers: 0,
      finances: { raised: 0 },
      outreach: { attendees: 0, events: 1 },
      highlights: [],
    });
  });

  it('refuses an unknown council or an impossible month', async () => {
    const db = await d.make();
    await expectRule(db.reports.monthlySummary(999, 2026, 9), 'INVALID_INPUT');
    await expectRule(db.reports.monthlySummary(OWN, 2026, 13), 'INVALID_INPUT');
    await expectRule(db.reports.monthlySummary(OWN, 1800, 1), 'INVALID_INPUT');
  });
});
