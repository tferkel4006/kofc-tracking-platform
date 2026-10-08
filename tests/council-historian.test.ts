// Sprint 6L (Phase 6): the Council Historian role, the year-end closing metrics elections.concludeFraternalYear bakes into
// the concluded year's CouncilHistoryAnnals team_metrics_summary, and the spiritual diary content guard.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  APPOINTED_ROLE_NAMES,
  buildYearClosingMetrics,
  cleanDiaryEntry,
  composeYearClosingSummary,
  COUNCIL_HISTORIAN_ROLE,
  findDiaryContentViolation,
  mayKeepCouncilAnnals,
  officeKind,
  YEAR_CLOSING_FOOTER,
  type DataService,
  type MemberWriteActor,
  type YearClosingRows,
} from '@kofc/shared';
import { MemoryDataService } from '../apps/web/services/drivers/memory';
import { SEED_DATA } from '../apps/web/services/generated/schema.generated';
import { drivers, expectRule, MEMBER, NOW, type DriverUnderTest } from './helpers';
import { openDatabases } from './shims/expo-sqlite';

const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');
const OWN = 1;

const writer = (over: Partial<MemberWriteActor> = {}): MemberWriteActor => ({
  memberId: 20,
  councilId: OWN,
  memberType: 'Member',
  active: true,
  roles: [],
  officer: false,
  ...over,
});

/** Logs activity hours straight in the backing store (council activity 1). */
function logActivity(d: DriverUnderTest, db: DataService, memberId: number, date: string, hours: number): void {
  if (d.name === 'memory') {
    (db as MemoryDataService).debugStore.insert('ActivityTime', { MemberID: memberId, ActivityID: 1, ActivityDate: date, Hours: hours });
  } else {
    openDatabases
      .at(-1)!
      .prepare('INSERT INTO [ActivityTime] ([MemberID], [ActivityID], [ActivityDate], [Hours]) VALUES (?, 1, ?, ?)')
      .run(memberId, date, hours);
  }
}

describe('the Council Historian role', () => {
  it('is seeded as an appointed, non-officer role and bumps the phone database to 49', () => {
    const roles = SEED_DATA.find((t) => t.table === 'Role')!.rows as { Role: string; Officer: number }[];
    expect(roles.find((r) => r.Role === COUNCIL_HISTORIAN_ROLE)).toEqual({ Role: 'Council Historian', Officer: 0 });
    expect(roles.findIndex((r) => r.Role === COUNCIL_HISTORIAN_ROLE)).toBe(roles.length - 1);
    expect(APPOINTED_ROLE_NAMES).toContain('Council Historian');
    expect(officeKind(COUNCIL_HISTORIAN_ROLE)).toBe('appointed');
    expect(read('apps/mobile/services/drivers/sqlite.ts')).toMatch(/const SCHEMA_VERSION = (49|[5-9]\d);/);
  });

  it('keeps the annals without an officer seat or Admin type, but only while Active and in their own council', () => {
    expect(mayKeepCouncilAnnals(writer({ roles: [COUNCIL_HISTORIAN_ROLE] }), OWN)).toBe(true);
    expect(mayKeepCouncilAnnals(writer({ roles: [COUNCIL_HISTORIAN_ROLE], active: false }), OWN)).toBe(false);
    expect(mayKeepCouncilAnnals(writer({ roles: [COUNCIL_HISTORIAN_ROLE], councilId: 2 }), OWN)).toBe(false);
    expect(mayKeepCouncilAnnals(writer({ roles: ['Lecturer'] }), OWN)).toBe(false);
  });
});

describe('the diary content guard (pure)', () => {
  it.each([
    ['What the fuck happened at the fish fry', 'profanity'],
    ['That was BULLSHIT', 'profanity'],
    ['sh1t day at the hall', 'profanity'],
    ['what an @sshole', 'profanity'],
    ['f*ck this', 'profanity'],
    ['Everyone should vote Republican', 'political'],
    ['MAGA forever', 'political'],
    ['the radical left is ruining us', 'political'],
    ['Biden spoke today', 'political'],
    ['white power', 'hate'],
    ['those spics', 'hate'],
  ])('refuses %j as %s', (text, category) => {
    expect(findDiaryContentViolation(text)).toBe(category);
  });

  it.each([
    'Father preached on heaven and hell, and on the damnation of pride.',
    'Palm Sunday: Christ rode into Jerusalem on an ass.',
    'Damn the torpedoes, we finished the pancake breakfast!',
    'Dick Harris led the rosary; the trumpet sounded at Mass.',
    'We assessed the class passions at the parish council election.',
    'Shiitake soup and a cocktail sauce for the shrimp at the social.',
    'Pro-life rally, then we voted on the new liberal giving plan.',
    'Praise God! 100% of the hours were logged.',
  ])('lets %j through', (text) => {
    expect(findDiaryContentViolation(text)).toBeNull();
  });

  it('refuses before storage with an accessible message that never repeats the word', () => {
    let err: unknown;
    try {
      cleanDiaryEntry({ diary_text: 'This shit again' }, NOW);
    } catch (e) {
      err = e;
    }
    expect(err).toMatchObject({ code: 'DIARY_CONTENT_BLOCKED', details: { category: 'profanity' } });
    expect((err as Error).message).toMatch(/foul or vulgar language.*reword the entry/);
    expect((err as Error).message).not.toMatch(/shit/i);
  });
});

describe('year-end closing metrics (pure)', () => {
  const rows: YearClosingRows = {
    roles: [
      { id: 1, Role: 'Grand Knight', Officer: 1 },
      { id: 4, Role: 'Recorder', Officer: 1 },
      { id: 21, Role: 'Council Historian', Officer: 0 },
    ],
    members: [
      { id: 5, MemberFirstName: 'Al', MemberLastName: 'Able', DateJoinedCouncil: '2025-09-01' },
      { id: 6, MemberFirstName: 'Bo', MemberLastName: 'Baker', DateJoinedCouncil: '2010-01-01' },
      { id: 7, MemberFirstName: 'Cy', MemberLastName: 'Cole', DateJoinedCouncil: null },
    ],
    leadership: [
      { id: 1, CouncilID: OWN, MemberID: 5, RoleID: 1, FraternalYear: '2026-2027', StartDate: '2026-09-20' },
      { id: 2, CouncilID: OWN, MemberID: 6, RoleID: 4, FraternalYear: '2025-2026', StartDate: '2025-07-01', EndDate: '2026-01-15', ExitReason: 'Abdicated' },
      { id: 3, CouncilID: OWN, MemberID: 7, RoleID: 21, FraternalYear: '2025-2026', StartDate: '2025-07-01' },
      { id: 4, CouncilID: OWN, MemberID: 7, RoleID: 4, FraternalYear: '2024-2025', StartDate: '2024-07-01', EndDate: '2025-06-30', ExitReason: 'TermConcluded' },
    ],
    events: [
      { StartDate: '2025-10-04', 'FundsRaised-Cash': 120.1, 'FundsRaised-Electronic': 80.2, ActualNumberAttendees: 40 },
      { StartDate: '2026-06-30', 'FundsRaised-Cash': null, 'FundsRaised-Electronic': 50, ActualNumberAttendees: null },
      { StartDate: '2026-07-01', 'FundsRaised-Cash': 999, ActualNumberAttendees: 999 },
    ],
    eventTime: [
      { MemberID: 5, Hours: 2.25, ShiftDate: '2025-10-04' },
      { MemberID: 6, Hours: 1, ShiftDate: '2025-06-30' },
    ],
    activityTime: [
      { MemberID: 5, Hours: 1.5, ActivityDate: '2026-03-01' },
      { MemberID: 7, Hours: 0.75, ActivityDate: '2025-07-01' },
    ],
    charitableGifts: [
      { Amount: 500, PayoutDate: '2025-12-24' },
      { Amount: 10, PayoutDate: '2026-07-02' },
    ],
    meetings: [{ Date: '2025-08-06' }, { Date: '2026-06-03' }, { Date: '2026-07-01' }],
  };

  it('sums the tenure July 1 - June 30 and rosters the officer terms it saw', () => {
    const m = buildYearClosingMetrics(OWN, '2025-2026', rows, NOW);
    expect(m).toMatchObject({
      fraternalYear: '2025-2026',
      fromDate: '2025-07-01',
      toDate: '2026-06-30',
      compiledOn: '2026-09-20',
      volunteerHours: { events: 2.25, activities: 2.25, total: 4.5 },
      volunteers: 2,
      fundsRaised: { cash: 120.1, electronic: 130.2, total: 250.3 },
      charitableGiving: 500,
      eventsHeld: 2,
      attendees: 40,
      meetingsHeld: 2,
      newMembers: 1,
    });
    // The open Grand Knight term (filed under the later year) and the abdicated Recorder; never the Historian (Officer = 0)
    // or an older year's closed term.
    expect(m.officers.map((o) => [o.roleName, o.memberId, o.steppedDown])).toEqual([
      ['Grand Knight', 5, false],
      ['Recorder', 6, true],
    ]);
  });

  it("writes a block ahead of the keepers' notes and replaces it on a repeat conclusion", () => {
    const m = buildYearClosingMetrics(OWN, '2025-2026', rows, NOW);
    const first = composeYearClosingSummary('Our best year for the food pantry.', m);
    expect(first).toMatch(/^Year-end closing metrics for 2025-2026 \(2025-07-01 to 2026-06-30\)/);
    expect(first).toContain('- Grand Knight: Al Able');
    expect(first).toContain('- Recorder: Bo Baker (stepped down)');
    expect(first).toContain('Volunteer hours: 4.5 (2.25 at events, 2.25 in council activities) from 2 members.');
    expect(first).toContain('Funds raised at events: $250.30 ($120.10 cash, $130.20 electronic).');
    expect(first).toContain('Charitable giving paid out: $500.00.');
    expect(first).toContain('Events held: 2, with 40 attendees. Meetings held: 2. New members: 1.');
    expect(first.endsWith(`${YEAR_CLOSING_FOOTER}\n\nOur best year for the food pantry.`)).toBe(true);
    const again = composeYearClosingSummary(first, { ...m, compiledOn: '2026-09-21' });
    expect(again.match(/Year-end closing metrics for/g)).toHaveLength(1);
    expect(again).toContain('concluded on 2026-09-21');
    expect(again.endsWith('Our best year for the food pantry.')).toBe(true);
    expect(composeYearClosingSummary(null, m).endsWith(YEAR_CLOSING_FOOTER)).toBe(true);
  });
});

describe.each(drivers)('Sprint 6L ($name driver)', (d) => {
  it('lets an appointed Council Historian write the annals', async () => {
    const db = await d.make();
    const historian = (await db.elections.listOfficerSeats(OWN)).find((s) => s.roleName === COUNCIL_HISTORIAN_ROLE)!;
    expect(historian).toMatchObject({ kind: 'appointed', holder: null });
    await expectRule(db.history.saveYearAnnals(MEMBER.member, OWN, '2024-2025', { collective_accomplishments: 'x' }), 'HISTORY_KEEPER_REQUIRED');
    await db.elections.assignAppointedRole(MEMBER.superAdmin, OWN, historian.roleId, MEMBER.member);
    const row = await db.history.saveYearAnnals(MEMBER.member, OWN, '2024-2025', { collective_accomplishments: 'Paid off the hall.' });
    expect(row).toMatchObject({ collective_accomplishments: 'Paid off the hall.', updated_by_member_id: MEMBER.member });
    expect((await db.history.getLegacyMatrix(MEMBER.member, OWN)).canKeepAnnals).toBe(true);
  });

  it("bakes the concluded year's closing metrics into its annals, keeping the keepers' notes", async () => {
    const db = await d.make();
    await db.history.saveYearAnnals(MEMBER.admin, OWN, '2025-2026', { team_metrics_summary: 'A year of firsts.' });
    logActivity(d, db, MEMBER.member, '2026-03-01', 2.5);
    logActivity(d, db, MEMBER.admin, '2025-07-01', 1.25);
    logActivity(d, db, MEMBER.admin, '2026-08-01', 4);

    const result = await db.elections.concludeFraternalYear(MEMBER.superAdmin, OWN, MEMBER.superAdmin);
    expect(result.closingMetrics).toMatchObject({ fraternalYear: '2025-2026', volunteerHours: { activities: 3.75 }, volunteers: 2 });
    expect(result.closingMetrics.officers.map((o) => o.roleName)).toEqual(expect.arrayContaining(['Grand Knight', 'Financial Secretary']));

    const year = (await db.history.getLegacyMatrix(MEMBER.member, OWN)).years.find((y) => y.fraternalYear === '2025-2026')!;
    expect(year.annals?.team_metrics_summary).toMatch(/^Year-end closing metrics for 2025-2026/);
    expect(year.annals?.team_metrics_summary).toContain('Volunteer hours: 3.75');
    expect(year.annals?.team_metrics_summary?.endsWith('A year of firsts.')).toBe(true);

    await db.elections.concludeFraternalYear(MEMBER.superAdmin, OWN, MEMBER.superAdmin);
    const after = (await db.history.getLegacyMatrix(MEMBER.member, OWN)).years.find((y) => y.fraternalYear === '2025-2026')!;
    expect(after.annals?.team_metrics_summary?.match(/Year-end closing metrics for/g)).toHaveLength(1);
    expect(d.count(db, 'CouncilHistoryAnnals')).toBe(1);
  });

  it('refuses a diary entry with blocked language and stores nothing', async () => {
    const db = await d.make();
    await expectRule(db.history.addDiaryEntry(MEMBER.member, OWN, { diary_text: 'The GOP should win.' }), 'DIARY_CONTENT_BLOCKED');
    expect(d.count(db, 'CouncilSpiritualDiary')).toBe(0);
    expect(await db.history.addDiaryEntry(MEMBER.member, OWN, { diary_text: 'Adoration before the Blessed Sacrament.' })).toMatchObject({ user_id: MEMBER.member });
  });
});
