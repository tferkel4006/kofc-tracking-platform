// Sprint 6L Extension 5: the In Memoriam roll - schema 54's CouncilInMemoriam - built from the roster's deceased
// brothers, their CouncilLeadershipHistory seats and the council's annals and totals in those years, shown as a
// black-and-gold card deck on /history; and the one-testimonial ceiling on Oral History recordings.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  assertTestimonialCeiling,
  buildInMemoriamRoll,
  cleanInMemoriamInput,
  composeInMemoriamSummary,
  MEMORIAL_COLORS,
  BRAND,
  contrastRatio,
  ORAL_HISTORY_TESTIMONIALS_PER_MEMBER,
  RECORD_REFERENCES,
  BusinessRuleError,
  type CouncilLeadershipHistory,
  type DataService,
  type YearClosingRows,
} from '@kofc/shared';
import { MemoryDataService } from '../apps/web/services/drivers/memory';
import { TABLES } from '../apps/web/services/generated/schema.generated';
import { drivers, expectRule, MEMBER, NOW, type DriverUnderTest } from './helpers';
import { openDatabases } from './shims/expo-sqlite';

const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');
const OWN = 1;
const DRIVE_ID = '1AbCdEfGhIjKlMnOpQrStUvWxYz012345';

const STATUSES = [
  { id: 1, Status: 'Active' },
  { id: 4, Status: 'Deceased' },
];
const ROLES = [
  { id: 1, Role: 'Grand Knight', Officer: 1 },
  { id: 12, Role: 'Trustee 1', Officer: 1 },
];
const seatRow = (over: Partial<CouncilLeadershipHistory>): CouncilLeadershipHistory => ({
  id: 1,
  CouncilID: OWN,
  MemberID: 7,
  RoleID: 1,
  FraternalYear: '2023-2024',
  StartDate: '2023-07-01',
  EndDate: '2024-06-30',
  ExitReason: 'TermConcluded',
  AppointedByID: null,
  ...over,
});
const closing = (over: Partial<YearClosingRows> = {}): YearClosingRows => ({
  roles: ROLES,
  members: [],
  leadership: [],
  events: [],
  eventTime: [],
  activityTime: [],
  charitableGifts: [],
  meetings: [],
  ...over,
});
const member = (id: number, statusId: number, last = `Last${id}`) => ({
  id,
  CouncilID: OWN,
  StatusID: statusId,
  MemberFirstName: `First${id}`,
  MemberLastName: last,
  DateJoinedCouncil: '1990-05-01',
});

describe('In Memoriam rules', () => {
  it('cards only deceased members of the council, by last name, cross-referencing their seats and years', () => {
    const roll = buildInMemoriamRoll({
      councilId: OWN,
      members: [member(7, 4, 'Zabel'), member(8, 1), member(9, 4, 'Adams'), { ...member(10, 4), CouncilID: 2 }],
      statuses: STATUSES,
      roles: ROLES,
      leadership: [
        seatRow({}),
        seatRow({ id: 2, RoleID: 12, FraternalYear: '2024-2025', StartDate: '2024-07-01', EndDate: '2025-06-30' }),
        seatRow({ id: 3, MemberID: 8 }),
      ],
      annals: [
        { council_id: OWN, fraternal_year: '2023-2024', collective_accomplishments: 'Rebuilt the parish hall kitchen.' },
        { council_id: OWN, fraternal_year: '2022-2023', collective_accomplishments: 'Before those years.' },
      ],
      closingRows: closing({
        events: [
          { StartDate: '2023-09-10', 'FundsRaised-Cash': 100, 'FundsRaised-Electronic': 50.25 },
          { StartDate: '2024-10-01', 'FundsRaised-Cash': 200 },
          { StartDate: '2022-10-01', 'FundsRaised-Cash': 999 },
        ],
        eventTime: [{ MemberID: 8, Hours: 4.5, ShiftDate: '2023-09-10' }],
        activityTime: [{ MemberID: 8, Hours: 2, ActivityDate: '2025-01-15' }],
        charitableGifts: [{ Amount: 500, PayoutDate: '2024-03-01' }],
        meetings: [{ Date: '2023-08-01' }, { Date: '2024-08-01' }, { Date: '2021-08-01' }],
      }),
      stored: [{ id: 5, council_id: OWN, member_id: 7, photo_url: DRIVE_ID, biography: 'Usher for forty years.', past_councils: 'Council 4511', updated_at: '2026-09-01 10:00:00' }],
      canKeep: false,
      today: NOW,
    });
    expect(roll.cards.map((c) => c.memberId)).toEqual([9, 7]);
    const zabel = roll.cards[1];
    expect(zabel.officerSeatsHeld).toBe('Grand Knight (2023-2024); Trustee 1 (2024-2025)');
    expect(zabel.leadershipYears).toEqual(['2023-2024', '2024-2025']);
    expect(zabel.totals).toEqual({ volunteerHours: 6.5, fundsRaised: 350.25, charitableGiving: 500, eventsHeld: 2, meetingsHeld: 2, newMembers: 0 });
    expect(zabel).toMatchObject({ entryId: 5, photoUrl: DRIVE_ID, biography: 'Usher for forty years.', pastCouncils: 'Council 4511' });
    expect(zabel.leadershipSummary).toContain('Brother First7 Zabel served the council in 2 seats');
    expect(zabel.leadershipSummary).toContain('logged 6.5 volunteer hours, raised $350.25 at events, paid out $500.00');
    expect(zabel.leadershipSummary).toContain('- 2023-2024: Rebuilt the parish hall kitchen.');
    expect(zabel.leadershipSummary).not.toContain('Before those years');
    expect(roll.cards[0].seats).toEqual([]);
    expect(roll.cards[0].leadershipSummary).toContain('held no officer seat');
  });

  it('quotes at most an excerpt of a long accomplishments text', () => {
    const text = composeInMemoriamSummary({
      name: 'Tom Ferris',
      seats: [{ roleName: 'Grand Knight', fraternalYear: '2023-2024', startDate: '2023-07-01', endDate: null, steppedDown: false }],
      leadershipYears: ['2023-2024'],
      totals: { volunteerHours: 1, fundsRaised: 0, charitableGiving: 0, eventsHeld: 1, meetingsHeld: 1, newMembers: 1 },
      accomplishments: [{ fraternalYear: '2023-2024', text: 'x'.repeat(1000) }],
    });
    expect(text).toContain('1 volunteer hour,');
    expect(text.split('\n').at(-1)!.length).toBeLessThan(420);
  });

  it('cleans the keeper fields: omitted keeps, blank clears, photo must be Drive or https', () => {
    expect(cleanInMemoriamInput({ biography: '  A faithful usher. ', past_councils: '' })).toEqual({ photo_url: undefined, biography: 'A faithful usher.', past_councils: null });
    expect(() => cleanInMemoriamInput({ photo_url: 'http://insecure.example/p.jpg' })).toThrow(BusinessRuleError);
    expect(() => cleanInMemoriamInput({ biography: 'x'.repeat(4001) })).toThrow(BusinessRuleError);
    expect(() => cleanInMemoriamInput({ nickname: 'x' } as never)).toThrow(/no field "nickname"/);
  });

  it('allows one Oral History Testimonial per member', () => {
    expect(ORAL_HISTORY_TESTIMONIALS_PER_MEMBER).toBe(1);
    expect(() => assertTestimonialCeiling([{ user_id: 3, audio_asset_url: null }, { user_id: 4, audio_asset_url: DRIVE_ID }], 3)).not.toThrow();
    expect(() => assertTestimonialCeiling([{ user_id: 3, audio_asset_url: DRIVE_ID }], 3)).toThrow(/already recorded/);
  });
});

describe('schema 54: the In Memoriam table', () => {
  it('declares the roll table with its keys and blocks deleting a council that has one', () => {
    const t = TABLES.CouncilInMemoriam;
    expect(t.columns.map((c) => c.name)).toEqual([
      'id',
      'council_id',
      'member_id',
      'photo_url',
      'biography',
      'past_councils',
      'officer_seats_held',
      'leadership_summary',
      'compiled_at',
      'updated_by_member_id',
      'updated_at',
    ]);
    expect(t.uniqueKeys).toContainEqual(['council_id', 'member_id']);
    expect(RECORD_REFERENCES.Council).toContainEqual({ table: 'CouncilInMemoriam', column: 'council_id', noun: ['In Memoriam entry', 'In Memoriam entries'] });
  });

  it('draws the deck in gold on the memorial black, well above contrast minimums', () => {
    expect(contrastRatio(BRAND.gold, MEMORIAL_COLORS.ink)).toBeGreaterThan(7);
    const deck = read('apps/web/components/InMemoriamParts.tsx');
    expect(deck).toContain('bg-memorial');
    expect(deck).toContain('text-gold');
    expect(read('apps/web/app/history/page.tsx')).toContain('<InMemoriamDeck');
  });
});

/** Files a testimonial on an earlier day straight in the backing store; the service only writes today's entry. */
function pastTestimonial(d: DriverUnderTest, db: DataService, memberId: number): void {
  const row = [OWN, memberId, '2026-08-01', '2026-2027', 'My first testimonial.', DRIVE_ID, '2026-08-01 10:00:00'] as const;
  if (d.name === 'memory') {
    const [council_id, user_id, entry_date, fraternal_year, diary_text, audio_asset_url, created_at] = row;
    (db as MemoryDataService).debugStore.insert('CouncilSpiritualDiary', { council_id, user_id, entry_date, fraternal_year, diary_text, audio_asset_url, created_at });
  } else {
    openDatabases
      .at(-1)!
      .prepare(
        `INSERT INTO [CouncilSpiritualDiary] ([council_id], [user_id], [entry_date], [fraternal_year], [diary_text], [audio_asset_url], [created_at])
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(...row);
  }
}

/** Seats a member for a past year straight in the backing store; elections only write the current term. */
function seat(d: DriverUnderTest, db: DataService, memberId: number, role: string, year: string): void {
  if (d.name === 'memory') {
    const store = (db as MemoryDataService).debugStore;
    store.insert('CouncilLeadershipHistory', {
      CouncilID: OWN,
      MemberID: memberId,
      RoleID: store.rows('Role').find((r) => r.Role === role)!.id,
      FraternalYear: year,
      StartDate: `${year.slice(0, 4)}-07-01`,
      EndDate: `${year.slice(5)}-06-30`,
      ExitReason: 'TermConcluded',
    });
  } else {
    openDatabases
      .at(-1)!
      .prepare(
        `INSERT INTO [CouncilLeadershipHistory] ([CouncilID], [MemberID], [RoleID], [FraternalYear], [StartDate], [EndDate], [ExitReason])
         SELECT ?, ?, [id], ?, ?, ?, 'TermConcluded' FROM [Role] WHERE [Role] = ?`,
      )
      .run(OWN, memberId, year, `${year.slice(0, 4)}-07-01`, `${year.slice(5)}-06-30`, role);
  }
}

const markDeceased = async (db: DataService, memberId: number) => {
  const deceased = (await db.lookups.list('MemberStatus')).find((s) => s.Status === 'Deceased')!.id;
  await db.members.update(MEMBER.superAdmin, memberId, { StatusID: deceased });
};

describe.each(drivers)('$name driver: the one-testimonial ceiling', (d) => {
  it('refuses a second recorded testimonial, but still takes written diary entries', async () => {
    const db = await d.make();
    pastTestimonial(d, db, MEMBER.member);
    await expectRule(db.history.addDiaryEntry(MEMBER.member, OWN, { diary_text: 'Another recording', audio_asset_url: DRIVE_ID }), 'ORAL_HISTORY_LIMIT_REACHED');
    expect(d.count(db, 'CouncilSpiritualDiary')).toBe(1);
    await db.history.addDiaryEntry(MEMBER.member, OWN, { diary_text: 'A written entry today.' });
    const matrix = await db.history.getLegacyMatrix(MEMBER.member, OWN);
    expect(matrix.myTestimonial?.entry_date).toBe('2026-08-01');
    expect((await db.history.getLegacyMatrix(MEMBER.admin, OWN)).myTestimonial).toBeNull();
  });
});

describe.each(drivers)('$name driver: the In Memoriam roll', (d) => {
  it('pulls deceased brothers off the roster, and lets keepers write and compile their remembrances', async () => {
    const db = await d.make();
    expect((await db.history.getInMemoriamRoll(MEMBER.member, OWN)).cards).toEqual([]);

    seat(d, db, MEMBER.member, 'Grand Knight', '2023-2024');
    await db.history.saveYearAnnals(MEMBER.admin, OWN, '2023-2024', { collective_accomplishments: 'Paid off the hall.' });
    await expectRule(db.history.saveInMemoriamEntry(MEMBER.admin, OWN, MEMBER.member, { biography: 'Too soon.' }), 'IN_MEMORIAM_NOT_DECEASED');
    await markDeceased(db, MEMBER.member);

    const roll = await db.history.getInMemoriamRoll(MEMBER.newMember, OWN);
    expect(roll.canKeep).toBe(false);
    expect(roll.cards.map((c) => [c.memberId, c.officerSeatsHeld, c.entryId])).toEqual([[MEMBER.member, 'Grand Knight (2023-2024)', null]]);
    expect(roll.cards[0].leadershipSummary).toContain('- 2023-2024: Paid off the hall.');

    await expectRule(db.history.saveInMemoriamEntry(MEMBER.newMember, OWN, MEMBER.member, { biography: 'x' }), 'HISTORY_KEEPER_REQUIRED');
    const card = await db.history.saveInMemoriamEntry(MEMBER.admin, OWN, MEMBER.member, { biography: 'Ushered at the 9:30 Mass.', photo_url: DRIVE_ID });
    expect(card).toMatchObject({ biography: 'Ushered at the 9:30 Mass.', photoUrl: DRIVE_ID, pastCouncils: null });
    expect(card.entryId).not.toBeNull();
    expect(card.compiledAt).not.toBeNull();
    const again = await db.history.saveInMemoriamEntry(MEMBER.admin, OWN, MEMBER.member, { past_councils: 'Council 4511, Salem' });
    expect(again).toMatchObject({ entryId: card.entryId, biography: 'Ushered at the 9:30 Mass.', pastCouncils: 'Council 4511, Salem' });
    expect(d.count(db, 'CouncilInMemoriam')).toBe(1);

    const compiled = await db.history.compileInMemoriam(MEMBER.admin, OWN);
    expect(compiled.cards).toHaveLength(1);
    await expectRule(db.history.compileInMemoriam(MEMBER.newMember, OWN), 'HISTORY_KEEPER_REQUIRED');
    expect(d.count(db, 'CouncilInMemoriam')).toBe(1);
    await expectRule(db.history.getInMemoriamRoll(MEMBER.member, 2), 'COUNCIL_ACCESS_DENIED');
  });
});
