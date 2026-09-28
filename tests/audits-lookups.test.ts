import { describe, expect, it } from 'vitest';
import {
  assertMayManageCouncilLookups,
  awaitingHoursStatus,
  canBrowseLessonsRegistry,
  canManageCouncilLookups,
  hoursReminderStage,
  planCouncilLookupSave,
  runHoursReminderSweep,
  SecurityPrivilegeError,
  toIsoDate,
  type DataService,
  type MemberWriteActor,
} from '@kofc/shared';
import { MemoryDataService } from '../apps/web/services/drivers/memory';
import { drivers, expectRule, MEMBER, NOW, type DriverUnderTest } from './helpers';
import { openDatabases } from './shims/expo-sqlite';

// Sprint 5L plumbing: council-specific lookups, the no-show and awaiting-hours audits, the 5-day/weekly
// unlogged-hours reminders and the cross-council lessons learned registry.
// Dev seed: council 1 is 15295 (Super Admin 1, Admin 2 who is also Financial Secretary, Member 3), council 2 is
// another council. "Today" is 2026-09-20.
const OWN = 1;
const OTHER = 2;

/** The date `n` days from the test's today (negative for the past). */
const day = (n: number) => toIsoDate(new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() + n));

async function expectPrivilege(promise: Promise<unknown>, code: 'ADMIN_REQUIRED' | 'SUPER_ADMIN_REQUIRED' | 'COUNCIL_ACCESS_DENIED') {
  expect(await expectRule(promise, code)).toBeInstanceOf(SecurityPrivilegeError);
}

/** Gives a member a Role straight in the backing store; the data service has no role-assignment method. */
function grantRole(d: DriverUnderTest, db: DataService, memberId: number, role: string): void {
  if (d.name === 'memory') {
    const store = (db as MemoryDataService).debugStore;
    store.insert('MemberRoles', { RoleID: store.rows('Role').find((r) => r.Role === role)!.id, MemberID: memberId });
  } else {
    openDatabases.at(-1)!.prepare('INSERT INTO [MemberRoles] ([RoleID], [MemberID]) SELECT [id], ? FROM [Role] WHERE [Role] = ?').run(memberId, role);
  }
}

/** Flags a signup NoShow without a reason, straight in the store: no service method records no-shows yet. */
function markNoShowWithoutReason(d: DriverUnderTest, db: DataService, signupId: number): void {
  if (d.name === 'memory') {
    const row = (db as MemoryDataService).debugStore.rows('EventSignup').find((s) => s.id === signupId) as Record<string, unknown>;
    row.NoShow = 1;
    row.NoShowReasonID = null;
  } else {
    openDatabases.at(-1)!.prepare('UPDATE [EventSignup] SET [NoShow] = 1, [NoShowReasonID] = NULL WHERE [id] = ?').run(signupId);
  }
}

/** An Active Admin of council 2, added by the seeded Super Admin. */
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

/**
 * A finished event linked to `councilIds` with one shift per entry of `daysAgo`, each with member 3 signed up.
 * Resolves to the shifts' ids in the same order.
 */
async function pastShifts(db: DataService, daysAgo: number[], councilIds = [OWN]): Promise<number[]> {
  const category = (await db.lookups.list('Category')).find((c) => c.Category === 'Service')!;
  const event = await db.events.create(
    {
      EventName: 'Summer Service Days',
      EventDescription: 'Past shifts for the audits',
      OwnerID: MEMBER.admin,
      StartDate: day(-Math.max(...daysAgo)),
      EndDate: day(-Math.min(...daysAgo)),
      Location: 'Parish Hall',
      CategoryID: category.id,
    },
    councilIds,
  );
  const ids = [];
  for (const n of daysAgo) {
    const shift = await db.events.createShift({
      ShiftName: `Shift ${n} days ago`,
      ShiftDescription: 'Setup',
      ShiftDate: day(-n),
      StartTime: '09:00:00',
      EndTime: '12:00:00',
      EventID: event.id,
      MinNumberVolunteers: 3,
    });
    await db.events.signupForShift(MEMBER.member, shift.id);
    ids.push(shift.id);
  }
  return ids;
}

// ---- pure rules --------------------------------------------------------------

describe('council lookup privileges', () => {
  const actor = (over: Partial<MemberWriteActor>): MemberWriteActor => ({ memberId: 9, councilId: OWN, memberType: 'Member', active: true, ...over });
  const code = (a: MemberWriteActor, councilId: number, table: string) => {
    try {
      assertMayManageCouncilLookups(a, councilId, table, 'manage lookups');
      return 'ok';
    } catch (err) {
      return (err as SecurityPrivilegeError).code;
    }
  };

  it('lets a Super Admin manage any council and an Admin only their own', () => {
    for (const table of ['Activities', 'DonationType', 'CouncilDonationMethod']) {
      expect(code(actor({ memberType: 'Super Admin' }), OTHER, table)).toBe('ok');
      expect(code(actor({ memberType: 'Admin' }), OWN, table)).toBe('ok');
      expect(code(actor({ memberType: 'Admin' }), OTHER, table)).toBe('COUNCIL_ACCESS_DENIED');
      expect(code(actor({ memberType: 'Admin', active: false }), OWN, table)).toBe('ADMIN_REQUIRED');
      expect(code(actor({ memberType: 'Super Admin', active: false }), OWN, table)).toBe('ADMIN_REQUIRED');
      expect(code(actor({}), OWN, table)).toBe('ADMIN_REQUIRED');
    }
  });

  it('lets the Financial Secretary and Treasurer manage only their own council donation lookups', () => {
    for (const role of ['Financial Secretary', 'Treasurer']) {
      const officer = actor({ roles: [role] });
      expect(code(officer, OWN, 'DonationType')).toBe('ok');
      expect(code(officer, OWN, 'CouncilDonationMethod')).toBe('ok');
      expect(code(officer, OWN, 'Activities')).toBe('ADMIN_REQUIRED');
      expect(code(officer, OTHER, 'DonationType')).toBe('COUNCIL_ACCESS_DENIED');
      expect(code(actor({ roles: [role], active: false }), OWN, 'DonationType')).toBe('ADMIN_REQUIRED');
    }
    expect(code(actor({ roles: ['Grand Knight'] }), OWN, 'DonationType')).toBe('ADMIN_REQUIRED');
  });

  it('mirrors the rule in the portal permissions', () => {
    const user = (over: object) => ({ memberId: 9, councilId: OWN, memberType: 'Member' as const, isOfficer: false, ...over });
    expect(canManageCouncilLookups(user({ memberType: 'Admin' }), OWN, 'Activities')).toBe(true);
    expect(canManageCouncilLookups(user({ memberType: 'Admin' }), OTHER, 'Activities')).toBe(false);
    expect(canManageCouncilLookups(user({ memberType: 'Super Admin' }), OTHER, 'Activities')).toBe(true);
    expect(canManageCouncilLookups(user({ roles: ['Treasurer'] }), OWN, 'DonationType')).toBe(true);
    expect(canManageCouncilLookups(user({ roles: ['Treasurer'] }), OWN, 'Activities')).toBe(false);
    expect(canManageCouncilLookups(user({ roles: ['Treasurer'] }), OTHER, 'DonationType')).toBe(false);
    expect(canBrowseLessonsRegistry(user({ memberType: 'Admin' }))).toBe(true);
    expect(canBrowseLessonsRegistry(user({}))).toBe(false);
  });
});

describe('council lookup save planning', () => {
  const rows = [
    { id: 1, CouncilID: OWN, DonationType: 'Parking' },
    { id: 2, CouncilID: OWN, DonationType: 'Meals' },
  ];
  const rule = (records: unknown) => {
    try {
      planCouncilLookupSave('DonationType', OWN, rows, records);
      return 'ok';
    } catch (err) {
      return (err as { code: string }).code;
    }
  };

  it('splits records into trimmed inserts and updates', () => {
    expect(planCouncilLookupSave('DonationType', OWN, rows, [{ DonationType: '  Raffle ' }, { id: 2, DonationType: 'Dinners', CouncilID: OWN }])).toEqual({
      inserts: [{ DonationType: 'Raffle' }],
      updates: [{ id: 2, values: { DonationType: 'Dinners' } }],
    });
  });

  it('judges uniqueness after the whole batch, so two rows may swap names', () => {
    expect(rule([{ id: 1, DonationType: 'Meals' }, { id: 2, DonationType: 'Parking' }])).toBe('ok');
    expect(rule([{ DonationType: 'parking' }])).toBe('INVALID_INPUT');
    expect(rule([{ DonationType: 'Raffle' }, { DonationType: 'RAFFLE' }])).toBe('INVALID_INPUT');
    expect(rule([{ id: 1, DonationType: 'Meals' }])).toBe('INVALID_INPUT');
  });

  it('refuses bad records', () => {
    expect(rule('not an array')).toBe('INVALID_INPUT');
    expect(rule([null])).toBe('INVALID_INPUT');
    expect(rule([{ DonationType: '' }])).toBe('INVALID_INPUT');
    expect(rule([{ DonationType: 'x'.repeat(101) }])).toBe('INVALID_INPUT');
    expect(rule([{ DonationType: 'Raffle', Colour: 'red' }])).toBe('INVALID_INPUT');
    expect(rule([{ DonationType: 'Raffle', CouncilID: OTHER }])).toBe('INVALID_INPUT');
    expect(rule([{ id: 1, DonationType: 'A' }, { id: 1, DonationType: 'B' }])).toBe('INVALID_INPUT');
    expect(rule([{ id: 99, DonationType: 'Raffle' }])).toBe('RECORD_NOT_FOUND');
    expect(rule([{ id: 1.5, DonationType: 'Raffle' }])).toBe('INVALID_INPUT');
  });

  it('keys enabled donation methods by method id', () => {
    const methods = [{ id: 7, CouncilID: OWN, DonationMethodID: 1, DonationMethodURL: null }];
    expect(() => planCouncilLookupSave('CouncilDonationMethod', OWN, methods, [{ DonationMethodID: 1 }])).toThrow(/used twice/);
    expect(planCouncilLookupSave('CouncilDonationMethod', OWN, methods, [{ DonationMethodID: 3, DonationMethodURL: ' ' }]).inserts).toEqual([
      { DonationMethodID: 3, DonationMethodURL: null },
    ]);
  });
});

describe('unlogged-hours reminder cadence', () => {
  it('reminds on day 5, then every 7 days, and never once closed', () => {
    const stage = (days: number, closed = false) => hoursReminderStage({ daysSinceShift: days, closed });
    expect([0, 1, 4].map((n) => stage(n))).toEqual([null, null, null]);
    expect(stage(5)).toBe(0);
    expect([6, 7, 8, 9, 10, 11].map((n) => stage(n))).toEqual([null, null, null, null, null, null]);
    expect(stage(12)).toBe(1);
    expect(stage(19)).toBe(2);
    expect(stage(89)).toBe(12);
    expect(stage(89, true)).toBeNull();
    expect(stage(5, true)).toBeNull();
  });

  it('closes a shift exactly where eventTime.logHours starts refusing it', () => {
    expect(awaitingHoursStatus('2026-06-20', NOW)).toEqual({ daysSinceShift: 92, closed: false, loggableThrough: '2026-09-20' });
    expect(awaitingHoursStatus('2026-06-19', NOW)).toMatchObject({ closed: true, loggableThrough: '2026-09-19' });
    expect(awaitingHoursStatus('2026-09-15', NOW)).toMatchObject({ daysSinceShift: 5, closed: false, loggableThrough: '2026-12-15' });
  });
});

// ---- drivers -------------------------------------------------------------------

describe.each(drivers)('$name driver: council-specific lookups', (d) => {
  it('lists a council lookup for its Admins and any Super Admin only', async () => {
    const db = await d.make();
    const types = await db.lookups.listCouncilSpecific(MEMBER.admin, OWN, 'DonationType');
    expect(types.map((t) => t.DonationType)).toEqual(['Meals', 'Parish Event', 'Parking', 'Unsolicited']);
    expect(await db.lookups.listCouncilSpecific(MEMBER.superAdmin, OWN, 'DonationType')).toEqual(types);
    expect((await db.lookups.listCouncilSpecific(MEMBER.admin, OWN, 'Activities')).length).toBeGreaterThan(0);
    const methods = await db.lookups.listCouncilSpecific(MEMBER.admin, OWN, 'CouncilDonationMethod');
    expect(methods.map((m) => m.DonationMethodID)).toEqual([...methods.map((m) => m.DonationMethodID)].sort((a, b) => a - b));

    await expectPrivilege(db.lookups.listCouncilSpecific(MEMBER.member, OWN, 'DonationType'), 'ADMIN_REQUIRED');
    await expectPrivilege(db.lookups.listCouncilSpecific(MEMBER.admin, OTHER, 'DonationType'), 'COUNCIL_ACCESS_DENIED');
    expect(await db.lookups.listCouncilSpecific(MEMBER.superAdmin, OTHER, 'DonationType')).toEqual([]);
    await expectRule(db.lookups.listCouncilSpecific(MEMBER.superAdmin, 999, 'DonationType'), 'INVALID_INPUT');
    await expectRule(db.lookups.listCouncilSpecific(9999, OWN, 'DonationType'), 'MEMBER_NOT_FOUND');
  });

  it('opens the donation lookups, not activities, to a Treasurer', async () => {
    const db = await d.make();
    grantRole(d, db, MEMBER.member, 'Treasurer');
    expect(await db.lookups.listCouncilSpecific(MEMBER.member, OWN, 'DonationType')).toHaveLength(4);
    const saved = await db.lookups.saveCouncilSpecific(MEMBER.member, OWN, 'DonationType', [{ DonationType: 'Raffle' }]);
    expect(saved.map((t) => t.DonationType)).toContain('Raffle');
    await expectPrivilege(db.lookups.listCouncilSpecific(MEMBER.member, OWN, 'Activities'), 'ADMIN_REQUIRED');
    await expectPrivilege(db.lookups.saveCouncilSpecific(MEMBER.member, OTHER, 'DonationType', [{ DonationType: 'Raffle' }]), 'COUNCIL_ACCESS_DENIED');
  });

  it('saves inserts and updates together, all or nothing', async () => {
    const db = await d.make();
    const [meals] = await db.lookups.listCouncilSpecific(MEMBER.admin, OWN, 'DonationType');
    const saved = await db.lookups.saveCouncilSpecific(MEMBER.admin, OWN, 'DonationType', [
      { id: meals.id, DonationType: 'Dinners' },
      { DonationType: 'Raffle', CouncilID: OWN },
    ]);
    expect(saved.map((t) => t.DonationType)).toEqual(['Dinners', 'Parish Event', 'Parking', 'Raffle', 'Unsolicited']);
    expect(saved.every((t) => t.CouncilID === OWN)).toBe(true);
    expect(d.count(db, 'DonationType')).toBe(5);

    await expectRule(
      db.lookups.saveCouncilSpecific(MEMBER.admin, OWN, 'DonationType', [{ DonationType: 'Bingo' }, { DonationType: 'parking' }]),
      'INVALID_INPUT',
    );
    expect(d.count(db, 'DonationType')).toBe(5);
    await expectPrivilege(db.lookups.saveCouncilSpecific(MEMBER.member, OWN, 'DonationType', [{ DonationType: 'Bingo' }]), 'ADMIN_REQUIRED');
    await expectPrivilege(db.lookups.saveCouncilSpecific(MEMBER.admin, OTHER, 'DonationType', [{ DonationType: 'Bingo' }]), 'COUNCIL_ACCESS_DENIED');
    expect(d.count(db, 'DonationType')).toBe(5);

    // Another council's row is not this council's to edit, even for a Super Admin.
    const [other] = await db.lookups.saveCouncilSpecific(MEMBER.superAdmin, OTHER, 'DonationType', [{ DonationType: 'Parking' }]);
    await expectRule(db.lookups.saveCouncilSpecific(MEMBER.admin, OWN, 'DonationType', [{ id: other.id, DonationType: 'Stolen' }]), 'RECORD_NOT_FOUND');
  });

  it('checks the foreign keys of activities and enabled methods', async () => {
    const db = await d.make();
    await expectRule(
      db.lookups.saveCouncilSpecific(MEMBER.admin, OWN, 'Activities', [{ ActivityName: 'Rosary Rally', ActivityDescription: 'Prayer', CategoryID: 999 }]),
      'INVALID_INPUT',
    );
    const category = (await db.lookups.list('Category'))[0];
    const activities = await db.lookups.saveCouncilSpecific(MEMBER.admin, OWN, 'Activities', [
      { ActivityName: 'Rosary Rally', ActivityDescription: 'Prayer', CategoryID: category.id },
    ]);
    expect(activities.find((a) => a.ActivityName === 'Rosary Rally')).toMatchObject({ CouncilID: OWN, CategoryID: category.id });

    const enabled = await db.lookups.listCouncilSpecific(MEMBER.admin, OWN, 'CouncilDonationMethod');
    await expectRule(
      db.lookups.saveCouncilSpecific(MEMBER.admin, OWN, 'CouncilDonationMethod', [{ DonationMethodID: enabled[0].DonationMethodID }]),
      'INVALID_INPUT',
    );
    await expectRule(db.lookups.saveCouncilSpecific(MEMBER.superAdmin, OTHER, 'CouncilDonationMethod', [{ DonationMethodID: 999 }]), 'INVALID_INPUT');
    const other = await db.lookups.saveCouncilSpecific(MEMBER.superAdmin, OTHER, 'CouncilDonationMethod', [
      { DonationMethodID: enabled[0].DonationMethodID, DonationMethodURL: 'https://example.org/qr.png' },
    ]);
    expect(other).toEqual([expect.objectContaining({ CouncilID: OTHER, DonationMethodURL: 'https://example.org/qr.png' })]);
  });

  it('deletes only unused rows of the council', async () => {
    const db = await d.make();
    const types = await db.lookups.listCouncilSpecific(MEMBER.admin, OWN, 'DonationType');
    const cash = (await db.donations.listMethods(OWN)).find((m) => m.kind === 'cash')!;
    await db.donations.record(MEMBER.admin, { CouncilID: OWN, DonationMethodID: cash.method.id, DonationTypeID: types[0].id, DonationAmount: 20 });

    await expectRule(db.lookups.removeCouncilSpecific(MEMBER.admin, OWN, 'DonationType', types[0].id), 'RECORD_IN_USE');
    await expectRule(db.lookups.removeCouncilSpecific(MEMBER.admin, OWN, 'DonationType', 999), 'RECORD_NOT_FOUND');
    await expectRule(db.lookups.removeCouncilSpecific(MEMBER.superAdmin, OTHER, 'DonationType', types[1].id), 'RECORD_NOT_FOUND');
    await expectPrivilege(db.lookups.removeCouncilSpecific(MEMBER.member, OWN, 'DonationType', types[1].id), 'ADMIN_REQUIRED');
    expect(d.count(db, 'DonationType')).toBe(4);

    await db.lookups.removeCouncilSpecific(MEMBER.admin, OWN, 'DonationType', types[1].id);
    expect((await db.lookups.listCouncilSpecific(MEMBER.admin, OWN, 'DonationType')).map((t) => t.id)).not.toContain(types[1].id);

    const [method] = await db.lookups.listCouncilSpecific(MEMBER.admin, OWN, 'CouncilDonationMethod');
    await db.lookups.removeCouncilSpecific(MEMBER.admin, OWN, 'CouncilDonationMethod', method.id);
    expect((await db.donations.listMethods(OWN)).map((m) => m.link.id)).not.toContain(method.id);
  });

  it('shows the global lookup manager to Super Admins only, leaving the drop-down feed open', async () => {
    const db = await d.make();
    expect(await db.lookups.listForMaintenance(MEMBER.superAdmin, 'Role')).toEqual(await db.lookups.list('Role'));
    await expectPrivilege(db.lookups.listForMaintenance(MEMBER.admin, 'Role'), 'SUPER_ADMIN_REQUIRED');
    await expectPrivilege(db.lookups.listForMaintenance(MEMBER.member, 'Category'), 'SUPER_ADMIN_REQUIRED');
    expect((await db.lookups.list('Category')).length).toBeGreaterThan(0);
  });
});

describe.each(drivers)('$name driver: executive audits', (d) => {
  it('lists the trailing no-shows of the council, with or without a reason', async () => {
    const db = await d.make();
    const recent = await db.reports.listNoShowsAudit(OWN);
    expect(recent.map((r) => r.event.EventName)).toEqual(['Winter Coat Sort']);
    expect(recent[0]).toMatchObject({ memberId: MEMBER.member, lastName: expect.any(String), reason: { NoShowReasonCode: 'A' } });

    const all = await db.reports.listNoShowsAudit(OWN, '2025-01-01');
    expect(all.map((r) => r.event.EventName)).toEqual(['Winter Coat Sort', 'Old Book Drive', 'Ancient Bake Sale']);

    const [shiftId] = await pastShifts(db, [10]);
    const signup = (await db.events.listSignups(shiftId))[0];
    markNoShowWithoutReason(d, db, signup.id);
    const withUnexplained = await db.reports.listNoShowsAudit(OWN);
    expect(withUnexplained.map((r) => [r.event.EventName, r.reason?.NoShowReasonCode ?? null])).toEqual([
      ['Summer Service Days', null],
      ['Winter Coat Sort', 'A'],
    ]);

    expect(await db.reports.listNoShowsAudit(OTHER, '2000-01-01')).toEqual([]);
    await expectRule(db.reports.listNoShowsAudit(OWN, '2026-02-30'), 'INVALID_DATE');
    await expectRule(db.reports.listNoShowsAudit(999), 'INVALID_INPUT');
  });

  it('lists past signups still missing hours, flagging those past the 3-month wall as closed', async () => {
    const db = await d.make();
    const seeded = await db.reports.listShiftsAwaitingHours(OWN);
    expect(seeded.every((r) => !r.signup.NoShow && r.shift.ShiftDate < day(0))).toBe(true);

    const [five, twelve, hundred, logged] = await pastShifts(db, [5, 12, 100, 3]);
    await db.eventTime.logHours(MEMBER.member, logged, 2);
    const rows = (await db.reports.listShiftsAwaitingHours(OWN)).filter((r) => r.event.EventName === 'Summer Service Days');
    expect(rows.map((r) => [r.shift.id, r.daysSinceShift, r.closed])).toEqual([
      [five, 5, false],
      [twelve, 12, false],
      [hundred, 100, true],
    ]);
    expect(rows[0]).toMatchObject({ memberId: MEMBER.member, event: { EventName: 'Summer Service Days' }, loggableThrough: '2026-12-15' });
    expect(rows[0].phone).not.toBe('');

    const unaffiliated = (await db.councils.list()).find((c) => c.id !== OWN && c.id !== OTHER)!;
    expect(await db.reports.listShiftsAwaitingHours(unaffiliated.id)).toEqual([]);
    await expectRule(db.reports.listShiftsAwaitingHours(999), 'INVALID_INPUT');
  });

  it('sends the day-5 reminder and the weekly follow-up once, and nothing for closed shifts', async () => {
    const db = await d.make();
    const [five, twelve] = await pastShifts(db, [5, 12, 100, 6], [OWN, OTHER]); // shared by two councils
    const logged: unknown[][] = [];
    const sent = new Set<string>();
    const packets = await runHoursReminderSweep(db, { now: NOW, sent, log: (...args) => logged.push(args) });

    expect(packets.map((p) => [p.stage, p.signupId])).toEqual([
      [0, (await db.events.listSignups(five))[0].id],
      [1, (await db.events.listSignups(twelve))[0].id],
    ]);
    expect(packets[0].sms.text).toContain('Please log your hours for "Shift 5 days ago"');
    expect(packets[0].sms.text).toContain('through 2026-12-15');
    expect(packets[1].sms.text).toContain('friendly follow-up');
    expect(logged).toHaveLength(2);
    expect(logged[0][0]).toBe('[hours-reminder]');

    expect(await runHoursReminderSweep(db, { now: NOW, sent, log: () => {} })).toEqual([]);
    const nextDay = new Date(NOW.getTime() + 86_400_000);
    expect(await runHoursReminderSweep(db, { now: nextDay, log: () => {} })).toEqual([]); // days 6 and 13: nothing due

    await db.eventTime.logHours(MEMBER.member, five, 3);
    expect((await runHoursReminderSweep(db, { now: NOW, log: () => {} })).map((p) => p.stage)).toEqual([1]);
  });
});

describe.each(drivers)('$name driver: lessons learned registry', (d) => {
  async function seedLesson(db: DataService) {
    const food = (await db.events.listByCouncil(OWN)).find((e) => e.EventName === 'Parish Food Drive')!;
    const category = (await db.lookups.list('LessonsLearnedCategory')).find((c) => c.LessonsLearnedCategory === 'Planning')!;
    const lesson = await db.lessonsLearned.add(MEMBER.superAdmin, food.id, category.id, 'Order boxes earlier');
    return { food, category, lesson };
  }

  it('lets only the owner, the council Admins and Super Admins change lessons', async () => {
    const db = await d.make();
    const { food, category, lesson } = await seedLesson(db);
    const outsider = await otherCouncilAdmin(db);
    await expectPrivilege(db.lessonsLearned.add(outsider, food.id, category.id, 'Not ours'), 'COUNCIL_ACCESS_DENIED');
    await expectPrivilege(db.lessonsLearned.add(MEMBER.member, food.id, category.id, 'Not mine'), 'ADMIN_REQUIRED');
    await expectPrivilege(db.lessonsLearned.remove(outsider, lesson.id), 'COUNCIL_ACCESS_DENIED');
    await expectRule(db.lessonsLearned.add(9999, food.id, category.id, 'x'), 'MEMBER_NOT_FOUND');
    expect(d.count(db, 'LessonsLearned')).toBe(1);
    await db.lessonsLearned.remove(MEMBER.admin, lesson.id);
    expect(d.count(db, 'LessonsLearned')).toBe(0);
  });

  it('shows every council to Admins but marks only their own lessons changeable', async () => {
    const db = await d.make();
    const { food, category, lesson } = await seedLesson(db);
    const outsider = await otherCouncilAdmin(db);

    const theirs = await db.lessonsLearned.listGlobalRegistry(outsider);
    expect(theirs).toEqual([
      expect.objectContaining({
        lesson,
        eventId: food.id,
        eventName: 'Parish Food Drive',
        lessonsCategory: 'Planning',
        eventCategory: 'Service',
        councils: [expect.objectContaining({ id: OWN })],
        canModify: false,
      }),
    ]);
    expect((await db.lessonsLearned.listGlobalRegistry(MEMBER.admin))[0].canModify).toBe(true);
    expect((await db.lessonsLearned.listGlobalRegistry(MEMBER.superAdmin))[0].canModify).toBe(true);
    await expectPrivilege(db.lessonsLearned.listGlobalRegistry(MEMBER.member), 'ADMIN_REQUIRED');

    const count = async (filters: object) => (await db.lessonsLearned.listGlobalRegistry(MEMBER.admin, filters)).length;
    expect(await count({ councilId: OWN })).toBe(1);
    expect(await count({ councilId: OTHER })).toBe(0);
    expect(await count({ search: 'BOXES' })).toBe(1);
    expect(await count({ search: 'food drive' })).toBe(1);
    expect(await count({ search: 'raffle' })).toBe(0);
    expect(await count({ search: '   ' })).toBe(1);
    expect(await count({ lessonsCategoryId: category.id })).toBe(1);
    expect(await count({ lessonsCategoryId: category.id + 1 })).toBe(0);
    expect(await count({ fromDate: food.StartDate, toDate: food.StartDate })).toBe(1);
    expect(await count({ fromDate: day(30) })).toBe(0);
    await expectRule(db.lessonsLearned.listGlobalRegistry(MEMBER.admin, { fromDate: 'soon' }), 'INVALID_DATE');
    await expectRule(db.lessonsLearned.listGlobalRegistry(MEMBER.admin, { councilId: 0 }), 'INVALID_INPUT');
  });
});
