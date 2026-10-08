// Sprint 6K (Phase 6): Council History Legacy Matrix and the Oral History recorder - schema 48's CouncilHistoryAnnals
// (one row per council and fraternal year: the officer core's collective accomplishments and team metrics) and
// CouncilSpiritualDiary (one entry per member per day, carrying the recorded testimonial's asset link). The Team Legacy
// dashboard (/history) shows each year's seated officers beside that prose and never an individual scorecard.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  assertDriveVaultUpload,
  buildCouncilLegacyMatrix,
  cleanCouncilAnnals,
  cleanDiaryEntry,
  cleanHistoryAssetUrl,
  driveVaultFolderPath,
  mayKeepCouncilAnnals,
  oralHistoryFileName,
  pickOralHistoryMimeType,
  portalAreas,
  portalSidebar,
  RECORD_REFERENCES,
  type DataService,
  type MemberWriteActor,
} from '@kofc/shared';
import { MemoryDataService } from '../apps/web/services/drivers/memory';
import { TABLES } from '../apps/web/services/generated/schema.generated';
import { drivers, expectRule, MEMBER, NOW, type DriverUnderTest } from './helpers';
import { openDatabases } from './shims/expo-sqlite';

const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');
const OWN = 1;
const DRIVE_ID = '1AbCdEfGhIjKlMnOpQrStUvWxYz012345';

const writer = (over: Partial<MemberWriteActor> = {}): MemberWriteActor => ({
  memberId: 20,
  councilId: OWN,
  memberType: 'Member',
  active: true,
  roles: [],
  officer: false,
  ...over,
});

/** Seats a member for a past year straight in the backing store; elections only write the current term. */
function seat(d: DriverUnderTest, db: DataService, memberId: number, role: string, year: string, exit: string | null = null): void {
  if (d.name === 'memory') {
    const store = (db as MemoryDataService).debugStore;
    store.insert('CouncilLeadershipHistory', {
      CouncilID: OWN,
      MemberID: memberId,
      RoleID: store.rows('Role').find((r) => r.Role === role)!.id,
      FraternalYear: year,
      StartDate: `${year.slice(0, 4)}-07-01`,
      EndDate: `${year.slice(5)}-06-30`,
      ExitReason: exit,
    });
  } else {
    openDatabases
      .at(-1)!
      .prepare(
        `INSERT INTO [CouncilLeadershipHistory] ([CouncilID], [MemberID], [RoleID], [FraternalYear], [StartDate], [EndDate], [ExitReason])
         SELECT ?, ?, [id], ?, ?, ?, ? FROM [Role] WHERE [Role] = ?`,
      )
      .run(OWN, memberId, year, `${year.slice(0, 4)}-07-01`, `${year.slice(5)}-06-30`, exit, role);
  }
}

describe('schema 48: council history annals and the spiritual diary', () => {
  it('adds both tables with their keys and one-per-day index, and bumps the phone database version', () => {
    const schema = read('Schema.sql');
    expect(schema).toContain('CREATE TABLE [CouncilHistoryAnnals] (');
    expect(schema).toContain('CREATE TABLE [CouncilSpiritualDiary] (');
    for (const column of ['establishment_date', 'original_chaplain', 'charter_photo_url', 'fraternal_year', 'collective_accomplishments', 'team_metrics_summary']) {
      expect(TABLES.CouncilHistoryAnnals.columns.map((c: { name: string }) => c.name)).toContain(column);
    }
    for (const column of ['user_id', 'entry_date', 'diary_text', 'audio_asset_url']) {
      expect(TABLES.CouncilSpiritualDiary.columns.map((c: { name: string }) => c.name)).toContain(column);
    }
    expect(schema).toMatch(/CREATE UNIQUE INDEX \[CouncilSpiritualDiary_Day_Idx\] ON \[CouncilSpiritualDiary\] \(\[user_id\], \[entry_date\]\);/);
    expect(schema).toMatch(/CREATE UNIQUE INDEX \[CouncilHistoryAnnals_Year_Idx\] ON \[CouncilHistoryAnnals\] \(\[council_id\], \[fraternal_year\]\);/);
    expect(TABLES.CouncilSpiritualDiary.foreignKeys).toEqual(
      expect.arrayContaining([
        { column: 'council_id', refTable: 'Council', refColumn: 'id' },
        { column: 'user_id', refTable: 'Member', refColumn: 'id' },
      ]),
    );
    expect(read('apps/mobile/services/drivers/sqlite.ts')).toMatch(/const SCHEMA_VERSION = (4[8-9]|[5-9]\d);/);
    expect(read('data_dictionary.md')).toContain('[CouncilHistoryAnnals]');
    expect(read('data_dictionary.md')).toContain('[CouncilSpiritualDiary]');
  });

  it('blocks deleting a council that has history', () => {
    const tables = RECORD_REFERENCES.Council.map((r) => r.table);
    expect(tables).toContain('CouncilHistoryAnnals');
    expect(tables).toContain('CouncilSpiritualDiary');
  });
});

describe('history rules (pure)', () => {
  it('lets officers, Admins and Super Admins keep the annals, never a plain member or another council', () => {
    expect(mayKeepCouncilAnnals(writer({ officer: true, roles: ['Recorder'] }), OWN)).toBe(true);
    expect(mayKeepCouncilAnnals(writer({ memberType: 'Admin' }), OWN)).toBe(true);
    expect(mayKeepCouncilAnnals(writer({ memberType: 'Super Admin', councilId: 9 }), OWN)).toBe(true);
    expect(mayKeepCouncilAnnals(writer(), OWN)).toBe(false);
    expect(mayKeepCouncilAnnals(writer({ officer: true, active: false }), OWN)).toBe(false);
    expect(mayKeepCouncilAnnals(writer({ memberType: 'Admin', councilId: 2 }), OWN)).toBe(false);
  });

  it('cleans annals: omitted keeps, blank clears, bad dates and links refused', () => {
    expect(cleanCouncilAnnals({ collective_accomplishments: '  Built the parish food pantry.  ', team_metrics_summary: '' })).toEqual({
      establishment_date: undefined,
      original_chaplain: undefined,
      charter_photo_url: undefined,
      collective_accomplishments: 'Built the parish food pantry.',
      team_metrics_summary: null,
    });
    expect(() => cleanCouncilAnnals({ establishment_date: '1952-02-30' })).toThrow(/real calendar date/);
    expect(() => cleanCouncilAnnals({ charter_photo_url: 'javascript:alert(1)' })).toThrow(/Drive file id or an https link/);
    expect(() => cleanCouncilAnnals({ charter_photo_url: 'blob:http://x/abc' })).toThrow();
    expect(cleanCouncilAnnals({ charter_photo_url: DRIVE_ID }).charter_photo_url).toBe(DRIVE_ID);
  });

  it("files a diary entry under today's date, and the audio link may be a Drive id, https or blob link", () => {
    expect(cleanDiaryEntry({ diary_text: ' Rosary at the vigil. ' }, NOW)).toEqual({
      entry_date: '2026-09-20',
      fraternal_year: '2026-2027',
      diary_text: 'Rosary at the vigil.',
      audio_asset_url: null,
    });
    expect(cleanDiaryEntry({ diary_text: 'x', fraternal_year: '1999-2000', audio_asset_url: 'blob:http://localhost/abc#t.webm' }, NOW).fraternal_year).toBe('1999-2000');
    expect(cleanHistoryAssetUrl('https://example.org/a.webm', 'Audio', true)).toBe('https://example.org/a.webm');
    expect(() => cleanDiaryEntry({ diary_text: '   ' }, NOW)).toThrow(/required/);
    expect(() => cleanDiaryEntry({ diary_text: 'x', fraternal_year: '2026-2028' }, NOW)).toThrow(/consecutive/);
    expect(() => cleanDiaryEntry({ diary_text: 'x', audio_asset_url: 'data:audio/webm;base64,AAAA' }, NOW)).toThrow();
  });

  it('asks the browser for compressed Opus first and names the file by year, member and day', () => {
    expect(pickOralHistoryMimeType(() => true)).toBe('audio/webm;codecs=opus');
    expect(pickOralHistoryMimeType((t) => t.startsWith('audio/mp4'))).toBe('audio/mp4;codecs=mp4a.40.2');
    expect(pickOralHistoryMimeType(() => false)).toBeNull();
    expect(oralHistoryFileName(7, '2026-2027', 'audio/webm;codecs=opus', NOW)).toBe('oral-history-2026-2027-member-7-2026-09-20.webm');
    expect(oralHistoryFileName(7, '2026-2027', 'audio/mp4', NOW)).toMatch(/\.m4a$/);
  });

  it('files testimonials in the vault under Oral Histories and takes only audio', () => {
    expect(driveVaultFolderPath('oral_history')).toEqual(['Fraternal Enterprise Suite', 'Oral Histories']);
    expect(assertDriveVaultUpload({ kind: 'oral_history', name: 'a.webm', mimeType: 'audio/webm;codecs=opus', size: 10 })).toBe('oral_history');
    expect(() => assertDriveVaultUpload({ kind: 'oral_history', name: 'a.pdf', mimeType: 'application/pdf', size: 10 })).toThrow();
    const route = read('apps/web/app/api/drive-vault/oral-history/route.ts');
    expect(route).toContain("requirePortalSession(req, (actor) => actor.active");
  });

  it('builds a team matrix: years newest first, officer seats only, no per-member scores', () => {
    const matrix = buildCouncilLegacyMatrix({
      councilId: OWN,
      annals: [
        { id: 1, council_id: OWN, fraternal_year: '1999-2000', establishment_date: '1952-03-01', original_chaplain: 'Fr. Example', updated_at: '' },
        { id: 2, council_id: OWN, fraternal_year: '2024-2025', collective_accomplishments: 'Paid off the hall.', updated_at: '' },
        { id: 3, council_id: 2, fraternal_year: '2010-2011', original_chaplain: 'Other council', updated_at: '' },
      ],
      leadership: [
        { id: 1, CouncilID: OWN, MemberID: 5, RoleID: 2, FraternalYear: '2024-2025', StartDate: '2024-07-01' },
        { id: 2, CouncilID: OWN, MemberID: 6, RoleID: 1, FraternalYear: '2024-2025', StartDate: '2024-07-01', ExitReason: 'Abdicated' },
        { id: 3, CouncilID: OWN, MemberID: 7, RoleID: 3, FraternalYear: '2024-2025', StartDate: '2024-07-01' },
      ],
      diary: [{ id: 1, council_id: OWN, user_id: 5, entry_date: '2026-09-20', fraternal_year: '2024-2025', diary_text: 'Memories', created_at: '' }],
      roles: [
        { id: 1, Role: 'Grand Knight', Officer: 1 },
        { id: 2, Role: 'Chancellor', Officer: 1 },
        { id: 3, Role: 'Member', Officer: 0 },
      ],
      members: [
        { id: 5, MemberFirstName: 'Al', MemberLastName: 'Able' },
        { id: 6, MemberFirstName: 'Bo', MemberLastName: 'Baker' },
      ],
      actorId: 5,
      canKeepAnnals: false,
      today: NOW,
    });
    expect(matrix.years.map((y) => y.fraternalYear)).toEqual(['2026-2027', '2024-2025', '1999-2000']);
    const y = matrix.years[1];
    expect(y.officers).toEqual([
      { roleName: 'Grand Knight', memberId: 6, firstName: 'Bo', lastName: 'Baker', steppedDown: true },
      { roleName: 'Chancellor', memberId: 5, firstName: 'Al', lastName: 'Able', steppedDown: false },
    ]);
    expect(y.annals?.collective_accomplishments).toBe('Paid off the hall.');
    expect(y.diary.map((d) => d.authorLastName)).toEqual(['Able']);
    expect(matrix.founding).toEqual({ establishmentDate: '1952-03-01', originalChaplain: 'Fr. Example', charterPhotoUrl: null });
    expect(matrix.myEntryToday?.id).toBe(1);
    expect(JSON.stringify(matrix)).not.toMatch(/Hours|hours|score/);
  });
});

describe('portal navigation', () => {
  it('opens Council History to every member under the Performance pillar', () => {
    const member = { memberId: 3, councilId: OWN, memberType: 'Member' as const, isOfficer: false };
    expect(portalAreas(member)).toContain('history');
    const performance = portalSidebar(member).find((g) => g.id === 'performance')!;
    expect(performance.entries.map((e) => e.item)).toContain('history');
    expect(read('apps/web/app/history/page.tsx')).toContain('RequireArea area="history"');
    expect(read('apps/web/components/OralHistoryRecorder.tsx')).toContain('🎙️ Record Oral History Testimonial');
    expect(read('apps/web/components/OralHistoryRecorder.tsx')).toContain('new MediaRecorder(');
  });
});

describe.each(drivers)('council history ($name driver)', (d) => {
  it('keeps one annals row per year, writable by keepers only', async () => {
    const db = await d.make();
    await expectRule(db.history.saveYearAnnals(MEMBER.member, OWN, '2024-2025', { collective_accomplishments: 'x' }), 'HISTORY_KEEPER_REQUIRED');
    const first = await db.history.saveYearAnnals(MEMBER.admin, OWN, '2024-2025', {
      collective_accomplishments: 'Raised the new hall roof together.',
      team_metrics_summary: '42 new members; 3,100 council service hours.',
      establishment_date: '1952-03-01',
    });
    expect(first.updated_by_member_id).toBe(MEMBER.admin);
    const second = await db.history.saveYearAnnals(MEMBER.superAdmin, OWN, '2024-2025', { team_metrics_summary: '' });
    expect(second.id).toBe(first.id);
    expect(second.collective_accomplishments).toBe('Raised the new hall roof together.');
    expect(second.team_metrics_summary).toBeNull();
    expect(second.establishment_date).toBe('1952-03-01');
    expect(d.count(db, 'CouncilHistoryAnnals')).toBe(1);
    await expectRule(db.history.saveYearAnnals(MEMBER.admin, OWN, '2024-25', {}), 'INVALID_INPUT');
  });

  it('shows the seated officer core beside the year prose, and every member may read it', async () => {
    const db = await d.make();
    seat(d, db, MEMBER.superAdmin, 'Grand Knight', '2024-2025');
    seat(d, db, MEMBER.admin, 'Financial Secretary', '2024-2025', 'Abdicated');
    await db.history.saveYearAnnals(MEMBER.admin, OWN, '2024-2025', { collective_accomplishments: 'Paid off the hall.' });
    const matrix = await db.history.getLegacyMatrix(MEMBER.member, OWN);
    expect(matrix.canKeepAnnals).toBe(false);
    expect(matrix.currentFraternalYear).toBe('2026-2027');
    const year = matrix.years.find((y) => y.fraternalYear === '2024-2025')!;
    expect(year.officers.map((o) => [o.roleName, o.memberId, o.steppedDown])).toEqual([
      ['Grand Knight', MEMBER.superAdmin, false],
      ['Financial Secretary', MEMBER.admin, true],
    ]);
    expect(year.annals?.collective_accomplishments).toBe('Paid off the hall.');
    expect((await db.history.getLegacyMatrix(MEMBER.admin, OWN)).canKeepAnnals).toBe(true);
  });

  it('allows one diary entry per member per day and links the testimonial to it', async () => {
    const db = await d.make();
    const entry = await db.history.addDiaryEntry(MEMBER.member, OWN, {
      fraternal_year: '2024-2025',
      diary_text: 'My memories of the 2024 roof drive.',
      audio_asset_url: DRIVE_ID,
    });
    expect(entry).toMatchObject({ user_id: MEMBER.member, entry_date: '2026-09-20', fraternal_year: '2024-2025', audio_asset_url: DRIVE_ID });
    await expectRule(db.history.addDiaryEntry(MEMBER.member, OWN, { diary_text: 'Second today' }), 'DIARY_ENTRY_EXISTS');
    expect(d.count(db, 'CouncilSpiritualDiary')).toBe(1);
    await db.history.addDiaryEntry(MEMBER.admin, OWN, { diary_text: 'Different member, same day.' });
    const matrix = await db.history.getLegacyMatrix(MEMBER.member, OWN);
    expect(matrix.myEntryToday?.id).toBe(entry.id);
    expect(matrix.years.find((y) => y.fraternalYear === '2024-2025')!.diary.map((x) => x.entry.audio_asset_url)).toEqual([DRIVE_ID]);
    await expectRule(db.history.addDiaryEntry(MEMBER.member, 2, { diary_text: 'Not my council' }), 'COUNCIL_ACCESS_DENIED');
  });
});
