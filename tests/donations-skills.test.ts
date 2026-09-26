import { describe, expect, it, vi } from 'vitest';
import { DonationSessionController, type DataService, type DonationSessionState } from '@kofc/shared';
import type { MemoryDataService } from '../apps/web/services/drivers/memory';
import { drivers, expectRule, MEMBER, type DriverUnderTest } from './helpers';
import { openDatabases } from './shims/expo-sqlite';

// Dev seed, relative to 2026-09-20 (see helpers.ts). Council 1 = 15295 (own), 2 = 1024 (affiliated).
// Own-council events: Fall Grounds Cleanup (09-10, past), Spring Retreat Setup (05-23, past),
// Parish Food Drive (starts 09-22). Neighborhood Blood Drive belongs to the affiliated council only.
// Every donation method is enabled for council 1; its donation types are Parking, Parish Event, Meals, Unsolicited.
const OWN = 1;
const AFFILIATED = 2;
const TODAY = '2026-09-20';

type Row = Record<string, unknown>;

/** Every row of `table` straight from the backing store: the web driver's in-memory arrays or the SQLite file. */
function raw(d: DriverUnderTest, db: DataService, table: string): Row[] {
  if (d.name === 'memory') return [...(db as MemoryDataService).debugStore.rows(table)] as Row[];
  return openDatabases.at(-1)!.prepare(`SELECT * FROM [${table}] ORDER BY [id]`).all() as Row[];
}

function idByName(d: DriverUnderTest, db: DataService, table: string, column: string, name: string): number {
  const row = raw(d, db, table).find((r) => r[column] === name);
  if (!row) throw new Error(`dev seed has no ${table} named ${name}`);
  return row.id as number;
}

async function eventId(db: DataService, name: string): Promise<number> {
  const shift = (await db.events.listShiftsBetween('2000-01-01', '2100-12-31')).map((s) => s.EventID);
  for (const id of new Set(shift)) {
    const event = await db.events.get(id);
    if (event?.EventName === name) return id;
  }
  throw new Error(`dev seed has no event named ${name}`);
}

async function lookups(db: DataService) {
  const methods = await db.donations.listMethods(OWN);
  const method = (name: string) => methods.find((m) => m.method.DonationMethod === name)!.method.id;
  const types = await db.donations.listTypes(OWN);
  const type = (name: string) => types.find((t) => t.DonationType === name)!.id;
  return {
    cash: method('Cash'),
    card: method('Credit Card'),
    venmo: method('Venmo'),
    items: method('Physical Items'),
    parking: type('Parking'),
    meals: type('Meals'),
    unsolicited: type('Unsolicited'),
  };
}

describe.each(drivers)('$name driver: recording donations', (d) => {
  it('stores a standalone cash donation as exactly one new row dated today', async () => {
    const db = await d.make();
    const ids = await lookups(db);
    const before = d.count(db, 'Donation');

    const saved = await db.donations.record({ CouncilID: OWN, DonationMethodID: ids.cash, DonationTypeID: ids.unsolicited, DonationAmount: 20 });

    expect(d.count(db, 'Donation')).toBe(before + 1);
    const row = raw(d, db, 'Donation').find((r) => r.id === saved.id)!;
    expect(row).toMatchObject({
      CouncilID: OWN,
      DonationDate: TODAY,
      DonationMethodID: ids.cash,
      DonationTypeID: ids.unsolicited,
      DonationAmount: 20,
      EventID: null,
      Donor: null,
      DonationDesciption: null,
    });
    expect((await db.donations.list(OWN)).map((x) => x.id)).toContain(saved.id);
  });

  it('keeps a physical item’s estimated value, description, donor and photo exactly as entered', async () => {
    const db = await d.make();
    const ids = await lookups(db);
    const item = {
      CouncilID: OWN,
      DonationMethodID: ids.items,
      DonationTypeID: ids.meals,
      DonationAmount: 125.5,
      DonationDate: '2026-09-18',
      Donor: 'Maria O’Connell',
      DonationDesciption: '12 canned hams, 3 cases of green beans',
      DonationPhotoURL: 'https://blob.example/donations/hams.jpg',
    };

    const saved = await db.donations.record(item);

    expect(saved).toMatchObject(item);
    expect(raw(d, db, 'Donation').find((r) => r.id === saved.id)).toMatchObject({ ...item, EventID: null });
    expect((await db.donations.list(OWN)).find((x) => x.id === saved.id)).toMatchObject(item);
  });

  it('refuses a physical item without a description, and writes nothing', async () => {
    const db = await d.make();
    const ids = await lookups(db);
    const before = d.count(db, 'Donation');
    const base = { CouncilID: OWN, DonationMethodID: ids.items, DonationTypeID: ids.meals, DonationAmount: 40 };
    await expectRule(db.donations.record(base), 'INVALID_INPUT');
    await expectRule(db.donations.record({ ...base, DonationDesciption: '   ' }), 'INVALID_INPUT');
    expect(d.count(db, 'Donation')).toBe(before);
  });

  it('rejects a zero amount, a future date and another council’s donation type without writing', async () => {
    const db = await d.make();
    const ids = await lookups(db);
    const before = d.count(db, 'Donation');
    const base = { CouncilID: OWN, DonationMethodID: ids.cash, DonationTypeID: ids.parking, DonationAmount: 10 };
    await expectRule(db.donations.record({ ...base, DonationAmount: 0 }), 'INVALID_INPUT');
    await expectRule(db.donations.record({ ...base, DonationDate: '2026-09-21' }), 'INVALID_INPUT');
    await expectRule(db.donations.record({ ...base, CouncilID: AFFILIATED }), 'DONATION_METHOD_NOT_ENABLED');
    expect(d.count(db, 'Donation')).toBe(before);
  });

  it('links a donation to a council event and lists it under that event only', async () => {
    const db = await d.make();
    const ids = await lookups(db);
    const cleanup = await eventId(db, 'Fall Grounds Cleanup');
    const linked = await db.donations.record({
      CouncilID: OWN,
      EventID: cleanup,
      DonationMethodID: ids.card,
      DonationTypeID: ids.parking,
      DonationAmount: 15,
    });
    const standalone = await db.donations.record({ CouncilID: OWN, DonationMethodID: ids.cash, DonationTypeID: ids.parking, DonationAmount: 5 });

    expect(raw(d, db, 'Donation').find((r) => r.id === linked.id)?.EventID).toBe(cleanup);
    expect((await db.donations.list(OWN, { eventId: cleanup })).map((x) => x.id)).toEqual([linked.id]);
    expect((await db.donations.list(OWN)).map((x) => x.id)).toEqual(expect.arrayContaining([linked.id, standalone.id]));
  });

  it('refuses an event from another council or one that has not started yet, and writes nothing', async () => {
    const db = await d.make();
    const ids = await lookups(db);
    const before = d.count(db, 'Donation');
    const base = { CouncilID: OWN, DonationMethodID: ids.cash, DonationTypeID: ids.parking, DonationAmount: 10 };
    await expectRule(db.donations.record({ ...base, EventID: await eventId(db, 'Neighborhood Blood Drive') }), 'INVALID_INPUT');
    const early = await expectRule(db.donations.record({ ...base, EventID: await eventId(db, 'Parish Food Drive') }), 'INVALID_INPUT');
    expect(early.message).toContain('before');
    expect(d.count(db, 'Donation')).toBe(before);
  });
});

describe.each(drivers)('$name driver: donation stream session', (d) => {
  it('pins every consecutive donation to the started event and pre-fills the session defaults', async () => {
    const db = await d.make();
    const ids = await lookups(db);
    const cleanup = await eventId(db, 'Fall Grounds Cleanup');
    const session = new DonationSessionController(db, OWN);

    const started = await session.start(cleanup, { amount: 10, donationTypeId: ids.parking, description: 'Parking lot' });
    expect(started).toMatchObject({ active: true, eventId: cleanup, eventName: 'Fall Grounds Cleanup', recordedCount: 0, recordedTotal: 0 });

    const saved = [
      await session.record({ DonationMethodID: ids.cash }),
      await session.record({ DonationMethodID: ids.venmo }),
      await session.record({ DonationMethodID: ids.card }),
    ];

    for (const s of saved) {
      expect(s).toMatchObject({ CouncilID: OWN, EventID: cleanup, DonationAmount: 10, DonationTypeID: ids.parking, DonationDesciption: 'Parking lot' });
      expect(raw(d, db, 'Donation').find((r) => r.id === s.id)?.EventID).toBe(cleanup);
    }
    expect(session.state).toMatchObject({ active: true, recordedCount: 3, recordedTotal: 30 });
    expect((await db.donations.list(OWN, { eventId: cleanup })).map((x) => x.id).sort()).toEqual(saved.map((s) => s.id).sort());
  });

  it('lets one donation override the defaults without changing the next one', async () => {
    const db = await d.make();
    const ids = await lookups(db);
    const session = new DonationSessionController(db, OWN);
    await session.start(await eventId(db, 'Fall Grounds Cleanup'), { amount: 10, donationTypeId: ids.parking });

    const big = await session.record({ DonationMethodID: ids.card, DonationAmount: 50.25, DonationTypeID: ids.meals, Donor: 'Parish Council' });
    const next = await session.record({ DonationMethodID: ids.cash });

    expect(big).toMatchObject({ DonationAmount: 50.25, DonationTypeID: ids.meals, Donor: 'Parish Council' });
    expect(next).toMatchObject({ DonationAmount: 10, DonationTypeID: ids.parking, Donor: null });
    expect(session.state).toMatchObject({ recordedCount: 2, recordedTotal: 60.25 });
  });

  it('records standalone donations again once the session is stopped', async () => {
    const db = await d.make();
    const ids = await lookups(db);
    const cleanup = await eventId(db, 'Fall Grounds Cleanup');
    const session = new DonationSessionController(db, OWN);
    await session.start(cleanup, { amount: 10, donationTypeId: ids.parking });
    await session.record({ DonationMethodID: ids.cash });

    expect(session.stop()).toEqual({ active: false });
    const after = await session.record({ DonationMethodID: ids.cash, DonationAmount: 7, DonationTypeID: ids.unsolicited });

    expect(after.EventID).toBeNull();
    expect(raw(d, db, 'Donation').find((r) => r.id === after.id)?.EventID).toBeNull();
    expect(session.compose({ DonationMethodID: ids.cash }).EventID).toBeNull();
    expect(session.state).toEqual({ active: false });
    expect(await db.donations.list(OWN, { eventId: cleanup })).toHaveLength(1);
  });

  it('updates defaults mid-session, ignores updates when idle and notifies subscribers of each change', async () => {
    const db = await d.make();
    const ids = await lookups(db);
    const session = new DonationSessionController(db, OWN);
    const seen: DonationSessionState[] = [];
    const unsubscribe = session.subscribe((s) => seen.push(s));

    expect(session.updateDefaults({ amount: 99 })).toEqual({ active: false });
    await session.start(await eventId(db, 'Fall Grounds Cleanup'), { amount: 10, donationTypeId: ids.parking });
    session.updateDefaults({ amount: 25 });
    const saved = await session.record({ DonationMethodID: ids.cash });
    session.stop();
    unsubscribe();
    session.stop();

    expect(saved).toMatchObject({ DonationAmount: 25, DonationTypeID: ids.parking });
    expect(seen.map((s) => (s.active ? `on:${s.defaults.amount}:${s.recordedCount}` : 'off'))).toEqual([
      'on:10:0',
      'on:25:0',
      'on:25:1',
      'off',
    ]);
  });

  it('resets the counters and re-pins when a new session starts for another event', async () => {
    const db = await d.make();
    const ids = await lookups(db);
    const cleanup = await eventId(db, 'Fall Grounds Cleanup');
    const retreat = await eventId(db, 'Spring Retreat Setup');
    const session = new DonationSessionController(db, OWN);
    await session.start(cleanup, { amount: 10, donationTypeId: ids.parking });
    await session.record({ DonationMethodID: ids.cash });

    await session.start(retreat, { amount: 5, donationTypeId: ids.meals });
    const saved = await session.record({ DonationMethodID: ids.cash });

    expect(saved).toMatchObject({ EventID: retreat, DonationAmount: 5 });
    expect(session.state).toMatchObject({ eventId: retreat, recordedCount: 1, recordedTotal: 5 });
  });

  it('saves but does not count a donation still in flight when the session is stopped', async () => {
    const db = await d.make();
    const ids = await lookups(db);
    const cleanup = await eventId(db, 'Fall Grounds Cleanup');
    const session = new DonationSessionController(db, OWN);
    await session.start(cleanup, { amount: 10, donationTypeId: ids.parking });

    const pending = session.record({ DonationMethodID: ids.cash });
    session.stop();
    const saved = await pending;

    expect(saved.EventID).toBe(cleanup);
    expect(session.state).toEqual({ active: false });
  });

  it('refuses to start on an unknown event or one not linked to the council, and stays idle', async () => {
    const db = await d.make();
    const session = new DonationSessionController(db, OWN);
    await expectRule(session.start(999_999), 'EVENT_NOT_FOUND');
    await expectRule(session.start(await eventId(db, 'Neighborhood Blood Drive')), 'INVALID_INPUT');
    expect(session.state).toEqual({ active: false });
  });
});

// The hook itself only hands controller.subscribe / controller.state to React's useSyncExternalStore,
// which needs a rendering component; what matters here is that the pinned event survives screen changes.
describe('mobile useDonationSession: one controller per council', () => {
  it('returns the same controller for a council across screens and a separate one per council', async () => {
    const { donationSessionFor } = await import('../apps/mobile/lib/use-donation-session');

    const own = donationSessionFor(OWN);
    expect(own).toBeInstanceOf(DonationSessionController);
    expect(donationSessionFor(OWN)).toBe(own);
    expect(donationSessionFor(AFFILIATED)).not.toBe(own);
    expect(own.state).toEqual({ active: false });
  });
});

describe.each(drivers)('$name driver: member skills, training and working status', (d) => {
  it('stores each skill, class and the working status for that member only, with names resolved', async () => {
    const db = await d.make();
    const bartending = idByName(d, db, 'Skill', 'SkillName', 'Bartending');
    const finances = idByName(d, db, 'Skill', 'SkillName', 'Finances');
    const expert = idByName(d, db, 'SkillLevel', 'SkillLevel', 'Expert');
    const novice = idByName(d, db, 'SkillLevel', 'SkillLevel', 'Novice');
    const background = idByName(d, db, 'KOCTrainingClasses', 'ClassName', 'Background Check');
    const retired = idByName(d, db, 'WorkingStatus', 'WorkingStatus', 'Retired');

    const ext = await db.memberProfiles.updateExtensions(
      MEMBER.member,
      [
        { skillId: bartending, skillLevelId: expert },
        { skillId: finances, skillLevelId: novice },
      ],
      [{ trainingClassId: background, year: 2024 }],
      retired,
    );

    expect(ext.workingStatus).toEqual({ id: retired, WorkingStatus: 'Retired' });
    expect(ext.skills.map((s) => [s.skill.SkillName, s.level.SkillLevel])).toEqual([
      ['Bartending', 'Expert'],
      ['Finances', 'Novice'],
    ]);
    expect(ext.training).toEqual([expect.objectContaining({ year: 2024, trainingClass: { id: background, ClassName: 'Background Check' } })]);

    expect(raw(d, db, 'MemberSkill').filter((r) => r.MemberID === MEMBER.member).map((r) => [r.SkillID, r.SkillLevelID])).toEqual([
      [bartending, expert],
      [finances, novice],
    ]);
    expect(raw(d, db, 'MemberTraining').filter((r) => r.MemberID === MEMBER.member)).toEqual([
      expect.objectContaining({ TrainingClassID: background, YearTaken: '2024-01-01' }),
    ]);
    expect(raw(d, db, 'Member').find((r) => r.id === MEMBER.member)?.WorkingStatusID).toBe(retired);
    expect(raw(d, db, 'MemberSkill').some((r) => r.MemberID !== MEMBER.member)).toBe(false);
    expect(await db.memberProfiles.getExtensions(MEMBER.member)).toEqual(ext);
  });

  it('replaces the lists on each update, and clears them with empty lists and a null status', async () => {
    const db = await d.make();
    const cooking = idByName(d, db, 'Skill', 'SkillName', 'Cooking');
    const plumbing = idByName(d, db, 'Skill', 'SkillName', 'Plumbing');
    const senior = idByName(d, db, 'SkillLevel', 'SkillLevel', 'Senior');
    const abuse = idByName(d, db, 'KOCTrainingClasses', 'ClassName', 'Preventing Abuse and Protecting Those We Serve');
    const student = idByName(d, db, 'WorkingStatus', 'WorkingStatus', 'Student');

    await db.memberProfiles.updateExtensions(MEMBER.admin, [{ skillId: cooking, skillLevelId: senior }], [{ trainingClassId: abuse, year: 2020 }], student);
    const replaced = await db.memberProfiles.updateExtensions(
      MEMBER.admin,
      [{ skillId: plumbing, skillLevelId: senior }],
      [
        { trainingClassId: abuse, year: 2020 },
        { trainingClassId: abuse, year: 2025 },
      ],
      student,
    );
    expect(replaced.skills.map((s) => s.skill.SkillName)).toEqual(['Plumbing']);
    expect(replaced.training.map((t) => t.year)).toEqual([2025, 2020]);
    expect(raw(d, db, 'MemberSkill').filter((r) => r.MemberID === MEMBER.admin)).toHaveLength(1);

    const cleared = await db.memberProfiles.updateExtensions(MEMBER.admin, [], [], null);
    expect(cleared).toEqual({ workingStatus: null, skills: [], training: [] });
    expect(raw(d, db, 'MemberSkill').filter((r) => r.MemberID === MEMBER.admin)).toHaveLength(0);
    expect(raw(d, db, 'MemberTraining').filter((r) => r.MemberID === MEMBER.admin)).toHaveLength(0);
    expect(raw(d, db, 'Member').find((r) => r.id === MEMBER.admin)?.WorkingStatusID ?? null).toBeNull();
  });

  it('rejects bad input all or nothing, keeping the member’s existing profile', async () => {
    const db = await d.make();
    const bartending = idByName(d, db, 'Skill', 'SkillName', 'Bartending');
    const expert = idByName(d, db, 'SkillLevel', 'SkillLevel', 'Expert');
    const background = idByName(d, db, 'KOCTrainingClasses', 'ClassName', 'Background Check');
    const original = await db.memberProfiles.updateExtensions(MEMBER.member, [{ skillId: bartending, skillLevelId: expert }], [], null);

    await expectRule(
      db.memberProfiles.updateExtensions(
        MEMBER.member,
        [
          { skillId: bartending, skillLevelId: expert },
          { skillId: bartending, skillLevelId: expert },
        ],
        [],
        null,
      ),
      'INVALID_INPUT',
    );
    await expectRule(db.memberProfiles.updateExtensions(MEMBER.member, [{ skillId: 9999, skillLevelId: expert }], [], null), 'INVALID_INPUT');
    await expectRule(db.memberProfiles.updateExtensions(MEMBER.member, [], [{ trainingClassId: background, year: 1881 }], null), 'INVALID_INPUT');
    await expectRule(db.memberProfiles.updateExtensions(MEMBER.member, [], [{ trainingClassId: background, year: 2027 }], null), 'INVALID_INPUT');
    await expectRule(db.memberProfiles.updateExtensions(MEMBER.member, [], [], 9999), 'INVALID_INPUT');
    await expectRule(db.memberProfiles.updateExtensions(9999, [], [], null), 'MEMBER_NOT_FOUND');

    expect(await db.memberProfiles.getExtensions(MEMBER.member)).toEqual(original);
  });
});

describe.each(drivers)('$name driver: council skill roster', (d) => {
  async function rosterFixture(db: DataService) {
    const skill = (name: string) => idByName(d, db, 'Skill', 'SkillName', name);
    const level = (name: string) => idByName(d, db, 'SkillLevel', 'SkillLevel', name);
    const s = { bartending: skill('Bartending'), finances: skill('Finances'), masonry: skill('Masonry') };
    // Super Admin and Brother Knight tend bar; Council Admin and Brother Knight handle finances.
    await db.memberProfiles.updateExtensions(MEMBER.superAdmin, [{ skillId: s.bartending, skillLevelId: level('Intermediate') }], [], null);
    await db.memberProfiles.updateExtensions(MEMBER.admin, [{ skillId: s.finances, skillLevelId: level('Expert') }], [], null);
    await db.memberProfiles.updateExtensions(
      MEMBER.member,
      [
        { skillId: s.bartending, skillLevelId: level('Novice') },
        { skillId: s.finances, skillLevelId: level('Beginner') },
      ],
      [],
      null,
    );
    // A bartender in another council must never appear in council 1's roster.
    const other = await db.members.create({
      CouncilID: AFFILIATED,
      MemberNumber: 9910001,
      MemberFirstName: 'Visiting',
      MemberLastName: 'Barkeep',
      Phone: '555-000-1111',
      StreetAddress1: '1 Other St',
      City: 'Salem',
      State: 'OR',
      ZipCode: '97301',
      Email: 'visiting.barkeep@example.org',
      DateOfBirth: '1970-07-07',
      StatusID: idByName(d, db, 'MemberStatus', 'Status', 'Active'),
      DegreeID: 3,
      MemberTypeID: 3,
    });
    await db.memberProfiles.updateExtensions(other.id, [{ skillId: s.bartending, skillLevelId: level('Expert') }], [], null);
    return { ...s, otherId: other.id };
  }

  it('isolates the council’s members by trade and returns exactly the right accounts', async () => {
    const db = await d.make();
    vi.spyOn(console, 'log').mockImplementation(() => {}); // members.create logs the welcome email
    const s = await rosterFixture(db);
    const roster = await db.communication.listCouncilSkills(OWN);
    const holders = (skillId: number) => roster.filter((r) => r.skill.id === skillId).map((r) => r.memberId);

    expect(holders(s.bartending).sort()).toEqual([MEMBER.superAdmin, MEMBER.member].sort());
    expect(holders(s.finances).sort()).toEqual([MEMBER.admin, MEMBER.member].sort());
    expect(holders(s.masonry)).toEqual([]);
    expect(roster.some((r) => r.memberId === s.otherId)).toBe(false);
    expect(roster).toHaveLength(4);

    // Ordered by skill name, then member last name.
    expect(roster.map((r) => `${r.skill.SkillName}:${r.lastName}`)).toEqual([
      'Bartending:Admin',
      'Bartending:Knight',
      'Finances:Admin',
      'Finances:Knight',
    ]);
    expect(roster.find((r) => r.memberId === MEMBER.member && r.skill.id === s.finances)).toMatchObject({
      firstName: 'Brother',
      lastName: 'Knight',
      email: 'testmember@kofc.org',
      phone: '555-666-7777',
      level: { SkillLevel: 'Beginner' },
    });
    expect((await db.communication.listCouncilSkills(AFFILIATED)).map((r) => r.memberId)).toEqual([s.otherId]);
    vi.restoreAllMocks();
  });

  it('messages everyone else in the council with a skill, and refuses when nobody else has it', async () => {
    const db = await d.make();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const s = await rosterFixture(db);

    const sent = await db.communication.sendBulkToSkills(OWN, s.bartending, 'Bartenders needed Friday', MEMBER.superAdmin);
    expect(sent.recipientIds).toEqual([MEMBER.member]);

    const finance = await db.communication.sendBulkToSkills(OWN, s.finances, 'Budget review', MEMBER.superAdmin);
    expect(finance.recipientIds.sort()).toEqual([MEMBER.admin, MEMBER.member].sort());

    await expectRule(db.communication.sendBulkToSkills(OWN, s.masonry, 'Anyone lay brick?', MEMBER.admin), 'NO_RECIPIENTS');
    await expectRule(db.communication.sendBulkToSkills(OWN, 9999, 'Hello', MEMBER.admin), 'INVALID_INPUT');
    await expectRule(db.communication.sendBulkToSkills(OWN, s.bartending, '   ', MEMBER.admin), 'INVALID_INPUT');
    vi.restoreAllMocks();
  });
});
