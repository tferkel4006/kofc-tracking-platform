// Sprint 6P (schema 55): roster snapshot guards (CouncilLeadershipSnapshot and the transfer guard in members.update),
// the asset form behind the approval redirect (expenses.getAssetRecord, getAssetRecordForExpense, updateAssetRecord),
// pre-event Planning Hours (EventPlanningTime), All-Hands shifts without a numeric target, and the tagged media vault
// with Smart Albums and the gallery slideshow (CouncilMediaVault, MediaSmartAlbums).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  assertMayDeleteSmartAlbum,
  assertMayLogPlanningTime,
  assertMayManageCouncilAssets,
  BusinessRuleError,
  buildMediaLibrary,
  buildPlanningLog,
  canDeleteSmartAlbum,
  canLogPlanningTime,
  canManageCouncilAssets,
  cleanAlbumCriteria,
  cleanAssetRecordChanges,
  cleanNewShift,
  cleanPlanningTimeInput,
  cleanVaultUpload,
  EMPTY_ALBUM_CRITERIA,
  filterMediaLibrary,
  isEmptyAlbumCriteria,
  opensAssetForm,
  parseAlbumCriteria,
  planLeadershipSnapshots,
  planTransferGuard,
  serializeAlbumCriteria,
  type CouncilLeadershipHistory,
  type CouncilMediaVault,
  type Event,
  type ExpenseLineItemInput,
  type MemberWriteActor,
  type Role,
} from '@kofc/shared';
import { TABLES } from '../apps/web/services/generated/schema.generated';
import { drivers, expectRule, MEMBER, shiftByName } from './helpers';

const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');
const OWN = 1;
const ROLE = { grandKnight: 1, trustee1: 12 } as const;

const actor = (over: Partial<MemberWriteActor> = {}): MemberWriteActor => ({
  memberId: 30,
  councilId: OWN,
  memberType: 'Member',
  active: true,
  roles: [],
  officer: false,
  ...over,
});

const roles: Role[] = [
  { id: 1, Role: 'Grand Knight', Officer: 1 } as Role,
  { id: 12, Role: 'Trustee 1', Officer: 1 } as Role,
  { id: 20, Role: 'Lecturer', Officer: 1 } as Role,
];

const term = (over: Partial<CouncilLeadershipHistory>): CouncilLeadershipHistory => ({
  id: 1,
  CouncilID: OWN,
  MemberID: 30,
  RoleID: 1,
  FraternalYear: '2025-2026',
  StartDate: '2025-07-01',
  EndDate: null,
  ExitReason: null,
  ...over,
});

const receipt = (over: Partial<ExpenseLineItemInput> = {}): ExpenseLineItemInput => ({
  DateOfExpense: '2026-09-12',
  Amount: 249.99,
  VendorName: 'Costco',
  ReceiptPhotoURL: null,
  ExpenseDescription: 'Portable PA system',
  ...over,
});

describe('schema 55', () => {
  it('adds the snapshot, planning, vault and album tables, the asset details and bumps the phone database', () => {
    const schema = read('Schema.sql');
    expect(schema).toContain('PRIMARY KEY([user_id], [council_id], [fraternal_year])');
    expect(TABLES.CouncilLeadershipSnapshot.primaryKey).toEqual(['user_id', 'council_id', 'fraternal_year']);
    expect(TABLES.CouncilMediaVault.columns.map((c) => c.name)).toEqual(
      expect.arrayContaining(['file_url', 'council_id', 'event_id', 'meeting_id', 'location_tag', 'calendar_year']),
    );
    expect(TABLES.MediaSmartAlbums.columns.map((c) => c.name)).toEqual(expect.arrayContaining(['council_id', 'album_name', 'album_criteria_json']));
    expect(TABLES.EventPlanningTime.columns.map((c) => c.name)).toEqual(['id', 'event_id', 'member_id', 'planning_date', 'hours', 'notes', 'logged_at']);
    expect(TABLES.CouncilAssetsInventory.columns.map((c) => c.name)).toEqual(expect.arrayContaining(['serial_number', 'storage_location']));
    expect(read('apps/mobile/services/drivers/sqlite.ts')).toMatch(/const SCHEMA_VERSION = 55;/);
    for (const table of ['CouncilLeadershipSnapshot', 'EventPlanningTime', 'CouncilMediaVault', 'MediaSmartAlbums']) {
      expect(read('data_dictionary.md')).toContain(`[${table}]`);
    }
  });
});

describe('roster snapshot rules', () => {
  it('locks one snapshot per member, council and year, joining every seat of the year, and never rewrites one', () => {
    const history = [
      term({ id: 1, RoleID: 20 }),
      term({ id: 2, RoleID: 1, StartDate: '2026-01-10' }),
      term({ id: 3, MemberID: 31, RoleID: 12 }),
      term({ id: 4, FraternalYear: '2026-2027', StartDate: '2026-07-01' }),
      term({ id: 5, CouncilID: 2, MemberID: 32 }),
    ];
    const plan = planLeadershipSnapshots({ councilId: OWN, history, roles, existing: [], reason: 'YearConcluded', lockedAt: '2026-09-20 19:00:00', fraternalYears: ['2025-2026'] });
    expect(plan.map((s) => [s.user_id, s.fraternal_year, s.roles_held])).toEqual([
      [30, '2025-2026', 'Grand Knight, Lecturer'],
      [31, '2025-2026', 'Trustee 1'],
    ]);
    expect(plan.every((s) => s.council_id === OWN && s.lock_reason === 'YearConcluded')).toBe(true);
    const again = planLeadershipSnapshots({ councilId: OWN, history, roles, existing: plan, reason: 'YearConcluded', lockedAt: 'x', fraternalYears: ['2025-2026'] });
    expect(again).toEqual([]);
  });

  it('plans a transfer: every past year locked, open terms closed and office seats vacated', () => {
    const plan = planTransferGuard({
      memberId: 30,
      oldCouncilId: OWN,
      history: [term({ id: 1, EndDate: '2026-06-30', ExitReason: 'TermConcluded' }), term({ id: 2, RoleID: 12, FraternalYear: '2026-2027', StartDate: '2026-07-01' })],
      roles,
      heldRoleIds: [12, 99],
      existing: [],
      now: new Date(2026, 8, 20, 12),
      lockedAt: '2026-09-20 19:00:00',
    });
    expect(plan.snapshots.map((s) => [s.fraternal_year, s.roles_held, s.lock_reason])).toEqual([
      ['2025-2026', 'Grand Knight', 'Transfer'],
      ['2026-2027', 'Trustee 1', 'Transfer'],
    ]);
    expect(plan.closeTermIds).toEqual([2]);
    expect(plan.endDate).toBe('2026-09-20');
    expect(plan.removeRoleIds).toEqual([12]); // role 99 is not an office seat
  });
});

describe.each(drivers)('roster snapshot guards ($name driver)', (d) => {
  it('locks the record of a member who transfers out, closes the term and vacates the seat', async () => {
    const db = await d.make();
    await db.elections.assignAppointedRole(MEMBER.superAdmin, OWN, ROLE.trustee1, MEMBER.member);
    await db.members.update(MEMBER.superAdmin, MEMBER.member, { CouncilID: 2 });

    const [snapshot] = (await db.history.listLeadershipSnapshots(MEMBER.admin, OWN)).filter((s) => s.user_id === MEMBER.member);
    expect(snapshot).toMatchObject({ council_id: OWN, fraternal_year: '2026-2027', roles_held: 'Trustee 1', lock_reason: 'Transfer' });
    expect((await db.members.listRoles(MEMBER.member)).map((r) => r.Role)).not.toContain('Trustee 1');
    const vacancy = (await db.elections.listVacancies(OWN)).find((v) => v.roleName === 'Trustee 1');
    expect(vacancy?.previous).toMatchObject({ memberId: MEMBER.member, exitReason: 'Transferred' });

    // A second transfer back and out again leaves the locked record as it was.
    const before = d.count(db, 'CouncilLeadershipSnapshot');
    await db.members.update(MEMBER.superAdmin, MEMBER.member, { CouncilID: OWN });
    await db.members.update(MEMBER.superAdmin, MEMBER.member, { CouncilID: 2 });
    expect(d.count(db, 'CouncilLeadershipSnapshot')).toBe(before);
  });

  it('locks every seat holder of the concluded year when the year is concluded', async () => {
    const db = await d.make();
    // The Grand Knight seat is on the ballot, so the chairs rotate and the outgoing terms close.
    await db.elections.toggleRoleBallotStatus(MEMBER.admin, OWN, ROLE.grandKnight, true);
    await db.elections.concludeFraternalYear(MEMBER.admin, OWN, MEMBER.admin);
    const snapshots = await db.history.listLeadershipSnapshots(MEMBER.member, OWN);
    expect(snapshots.length).toBeGreaterThan(0);
    expect(snapshots.find((s) => s.user_id === MEMBER.superAdmin)).toMatchObject({ fraternal_year: '2026-2027', lock_reason: 'YearConcluded' });
    expect(snapshots.find((s) => s.user_id === MEMBER.superAdmin)!.roles_held).toContain('Grand Knight');
    await expectRule(db.history.listLeadershipSnapshots(MEMBER.admin, 2), 'COUNCIL_ACCESS_DENIED');
  });
});

describe('asset record rules', () => {
  it('lets the Grand Knight and the expense leadership complete an asset, and nobody else', () => {
    expect(() => assertMayManageCouncilAssets(actor({ roles: ['Grand Knight'] }), OWN, 'edit')).not.toThrow();
    expect(() => assertMayManageCouncilAssets(actor({ memberType: 'Admin' }), OWN, 'edit')).not.toThrow();
    expect(() => assertMayManageCouncilAssets(actor({ roles: ['Grand Knight'] }), 2, 'edit')).toThrow(BusinessRuleError);
    expect(() => assertMayManageCouncilAssets(actor({ roles: ['Lecturer'], officer: true }), OWN, 'edit')).toThrow(/Only an active Admin/);
    const user = { memberId: 30, councilId: OWN, memberType: 'Member', isOfficer: true, roles: ['Grand Knight'] };
    expect(canManageCouncilAssets(user, OWN)).toBe(true);
    expect(canManageCouncilAssets({ ...user, roles: [] }, OWN)).toBe(false);
  });

  it('cleans the form and opens it only for an approved asset sheet', () => {
    expect(cleanAssetRecordChanges({ asset_name: ' PA system ', serial_number: '  ', storage_location: 'Hall closet', current_status: 'ACTIVE' })).toEqual({
      asset_name: 'PA system',
      serial_number: null,
      storage_location: 'Hall closet',
      current_status: 'ACTIVE',
    });
    expect(() => cleanAssetRecordChanges({ current_status: 'SOLD' as never })).toThrow(/ACTIVE, DISPOSED, LOST/);
    expect(() => cleanAssetRecordChanges({ cost_basis: 1 } as never)).toThrow(/no editable field "cost_basis"/);
    expect(opensAssetForm({ Status: 'Approved', is_long_term_asset: 1 })).toBe(true);
    expect(opensAssetForm({ Status: 'Approved', is_long_term_asset: 0 })).toBe(false);
    expect(opensAssetForm({ Status: 'Submitted', is_long_term_asset: 1 })).toBe(false);
  });

  it('redirects from the authorization desk to the pre-filled asset form', () => {
    const desk = read('apps/web/app/expenses/authorize/page.tsx');
    expect(desk).toContain('getAssetRecordForExpense');
    expect(desk).toMatch(/router\.push\(`\$\{assetFormPath\(asset\.id\)\}&from=approval`\)/);
    const form = read('apps/web/app/expenses/assets/page.tsx');
    expect(form).toContain('updateAssetRecord');
    expect(form).toContain('Cost basis');
  });
});

describe.each(drivers)('asset form ($name driver)', (d) => {
  it('finds the row an approval created and saves the extra details, keeping the cost basis', async () => {
    const db = await d.make();
    const { report } = await db.expenses.submitReport(MEMBER.member, { Status: 'Submitted', is_long_term_asset: true }, [receipt()]);
    await db.expenses.financialSecretaryAuditOrder(MEMBER.admin, report.id);
    const signed = await db.expenses.grandKnightAuthorizeOrder(MEMBER.superAdmin, report.id);
    expect(opensAssetForm(signed.report)).toBe(true);

    const asset = (await db.expenses.getAssetRecordForExpense(MEMBER.superAdmin, report.id))!;
    expect(asset).toMatchObject({ asset_name: 'Portable PA system', cost_basis: 249.99, serial_number: null });
    const saved = await db.expenses.updateAssetRecord(MEMBER.superAdmin, asset.id, { serial_number: 'PA-0042', storage_location: 'Parish hall closet', notes: 'Bought for the fish fry.' });
    expect(saved).toMatchObject({ serial_number: 'PA-0042', storage_location: 'Parish hall closet', cost_basis: 249.99, original_expense_id: report.id });
    expect(await db.expenses.getAssetRecord(MEMBER.admin, asset.id)).toMatchObject({ serial_number: 'PA-0042' });

    await expectRule(db.expenses.updateAssetRecord(MEMBER.member, asset.id, { notes: 'x' }), 'ADMIN_REQUIRED');
    await expectRule(db.expenses.getAssetRecord(MEMBER.admin, 999), 'RECORD_NOT_FOUND');
    await expectRule(db.expenses.updateAssetRecord(MEMBER.admin, asset.id, { asset_name: ' ' }), 'INVALID_INPUT');
    expect(await db.expenses.getAssetRecordForExpense(MEMBER.admin, (await db.expenses.submitReport(MEMBER.member, { Status: 'Draft' }, [receipt()])).report.id)).toBeNull();
  });
});

describe('Planning Hours rules', () => {
  const event = { id: 7, EventName: 'Fish Fry', StartDate: '2026-10-02', OwnerID: 40 } as Event;

  it('takes dates before the event and not in the future, in 15-minute steps', () => {
    expect(cleanPlanningTimeInput({ planningDate: '2026-09-15', hours: 1.75, notes: ' Met the caterer ' }, event, '2026-09-20')).toEqual({
      planning_date: '2026-09-15',
      hours: 1.75,
      notes: 'Met the caterer',
    });
    expect(() => cleanPlanningTimeInput({ planningDate: '2026-10-02', hours: 1 }, event, '2026-10-05')).toThrow(/before that day/);
    expect(() => cleanPlanningTimeInput({ planningDate: '2026-09-25', hours: 1 }, event, '2026-09-20')).toThrow(/future/);
    expect(() => cleanPlanningTimeInput({ planningDate: '2026-09-15', hours: 1.1 }, event, '2026-09-20')).toThrow(BusinessRuleError);
    expect(() => cleanPlanningTimeInput({ planningDate: 'soon', hours: 1 }, event, '2026-09-20')).toThrow(/YYYY-MM-DD/);
  });

  it('is logged by the owner, officers and Admins of a linked council, and Super Admins', () => {
    expect(() => assertMayLogPlanningTime(actor({ memberId: 40 }), event, [OWN], 'log')).not.toThrow();
    expect(() => assertMayLogPlanningTime(actor({ officer: true, roles: ['Lecturer'] }), event, [OWN], 'log')).not.toThrow();
    expect(() => assertMayLogPlanningTime(actor({ memberType: 'Super Admin' }), event, [2], 'log')).not.toThrow();
    expect(() => assertMayLogPlanningTime(actor(), event, [OWN], 'log')).toThrow(/Planning Hours are logged by/);
    expect(() => assertMayLogPlanningTime(actor({ memberType: 'Admin' }), event, [2], 'log')).toThrow(/belongs to council 2/);
    const user = { memberId: 30, councilId: OWN, memberType: 'Member', isOfficer: true, roles: [] };
    expect(canLogPlanningTime(user, event, [OWN])).toBe(true);
    expect(canLogPlanningTime({ ...user, isOfficer: false }, event, [OWN])).toBe(false);
  });

  it('builds the log newest first with names and a total', () => {
    const log = buildPlanningLog(
      7,
      [
        { id: 1, event_id: 7, member_id: 40, planning_date: '2026-09-01', hours: 2, notes: null, logged_at: '' },
        { id: 2, event_id: 7, member_id: 41, planning_date: '2026-09-10', hours: 0.75, notes: 'Flyers', logged_at: '' },
        { id: 3, event_id: 8, member_id: 41, planning_date: '2026-09-11', hours: 5, notes: null, logged_at: '' },
      ],
      [{ id: 40, MemberFirstName: 'Tom', MemberLastName: 'Byrne' }],
    );
    expect(log.entries.map((e) => [e.id, e.memberName])).toEqual([
      [2, 'Member 41'],
      [1, 'Tom Byrne'],
    ]);
    expect(log.totalHours).toBe(2.75);
  });
});

describe.each(drivers)('Planning Hours and All-Hands shifts ($name driver)', (d) => {
  it('logs, lists and deletes Planning Hours for an upcoming event', async () => {
    const db = await d.make();
    const event = (await db.events.listByCouncil(OWN)).find((e) => e.StartDate > '2026-09-21')!;
    const entry = await db.events.logPlanningTime(MEMBER.admin, event.id, { planningDate: '2026-09-18', hours: 1.5, notes: 'Ordered supplies' });
    expect(entry).toMatchObject({ event_id: event.id, member_id: MEMBER.admin, hours: 1.5, notes: 'Ordered supplies' });
    await db.events.logPlanningTime(MEMBER.superAdmin, event.id, { planningDate: '2026-09-19', hours: 0.25 });
    const log = await db.events.listPlanningTime(event.id);
    expect(log.totalHours).toBe(1.75);
    expect(log.entries[0]).toMatchObject({ planning_date: '2026-09-19' });

    await expectRule(db.events.logPlanningTime(MEMBER.member, event.id, { planningDate: '2026-09-18', hours: 1 }), 'ADMIN_REQUIRED');
    await expectRule(db.events.logPlanningTime(MEMBER.admin, event.id, { planningDate: '2026-09-18', hours: 0.3 }), 'INVALID_HOURS_INCREMENT');
    await expectRule(db.events.logPlanningTime(MEMBER.admin, event.id, { planningDate: event.StartDate, hours: 1 }), 'INVALID_INPUT');
    await expectRule(db.events.deletePlanningTime(MEMBER.member, entry.id), 'ADMIN_REQUIRED');
    await db.events.deletePlanningTime(MEMBER.admin, entry.id);
    expect((await db.events.listPlanningTime(event.id)).entries).toHaveLength(1);
    await expectRule(db.events.deletePlanningTime(MEMBER.admin, entry.id), 'RECORD_NOT_FOUND');
  });

  it('stores no numeric target on an All-Hands shift and needs one when the toggle is turned off', async () => {
    const db = await d.make();
    const coats = await shiftByName(db, 'Coat Sorting');
    const open = await db.events.createShift({
      ShiftName: 'Everyone in',
      ShiftDescription: '',
      ShiftDate: coats.ShiftDate,
      StartTime: '18:00',
      EndTime: '20:00',
      EventID: coats.EventID,
      IsAllHands: 1,
    } as never);
    expect(open).toMatchObject({ IsAllHands: 1, MinNumberVolunteers: 0 });
    await expectRule(db.events.updateShift(open.id, { IsAllHands: 0 }), 'INVALID_INPUT');
    expect(await db.events.updateShift(open.id, { IsAllHands: 0, MinNumberVolunteers: 6 })).toMatchObject({ IsAllHands: 0, MinNumberVolunteers: 6 });
  });
});

describe('All-Hands validation', () => {
  it('needs no target for a new All-Hands shift', () => {
    const base = { ShiftName: 'All in', ShiftDescription: '', ShiftDate: '2026-10-02', StartTime: '09:00', EndTime: '12:00', EventID: 1 };
    expect(cleanNewShift({ ...base, IsAllHands: 1 } as never)).toMatchObject({ IsAllHands: 1, MinNumberVolunteers: 0 });
    expect(() => cleanNewShift(base as never)).toThrow(/MinNumberVolunteers/);
    const page = read('apps/web/app/events/page.tsx');
    expect(page).toContain('open-ended');
    expect(page).toContain('PlanningHoursPanel');
  });
});

describe('media vault rules', () => {
  const vault = (over: Partial<CouncilMediaVault>): CouncilMediaVault => ({
    id: 1,
    council_id: OWN,
    file_url: 'a.jpg',
    event_id: null,
    meeting_id: null,
    location_tag: null,
    calendar_year: 2026,
    uploaded_by_member_id: 1,
    uploaded_at: '2026-09-20 10:00:00',
    ...over,
  });
  const events = [
    { id: 1, EventName: 'Fish Fry', StartDate: '2025-03-07', Location: "St. Mary's Hall", PhotoGalleryURL: 'fry1.jpg,fry2.jpg' },
    { id: 2, EventName: 'Coats for Kids', StartDate: '2026-11-14', Location: 'Parish lot', PhotoGalleryURL: 'coat.jpg' },
  ];
  const meetings = [{ id: 5, 'Meeting Name': 'October Business Meeting', Date: '2026-10-06', Location: "St. Mary's Hall", OwnerID: null }];
  const library = buildMediaLibrary({
    councilId: OWN,
    vault: [
      vault({ id: 1, file_url: 'fry1.jpg', event_id: 1, location_tag: "St. Mary's Hall", calendar_year: 2025 }),
      vault({ id: 2, file_url: 'minutes.jpg', meeting_id: 5, location_tag: "St. Mary's Hall" }),
      vault({ id: 3, council_id: 2, file_url: 'other.jpg' }),
    ],
    events,
    meetings,
  });

  it('merges vault rows with the older event photos without repeating one', () => {
    expect(library.items.map((i) => [i.fileUrl, i.vaultId])).toEqual([
      ['coat.jpg', null],
      ['minutes.jpg', 2],
      ['fry1.jpg', 1],
      ['fry2.jpg', null],
    ]);
    expect(library.years).toEqual([2026, 2025]);
    expect(library.locations).toEqual(['Parish lot', "St. Mary's Hall"]);
    expect(library.meetings).toEqual([{ id: 5, name: 'October Business Meeting', date: '2026-10-06', ownerId: null }]);
  });

  it('filters by several events and meetings, location text and years', () => {
    const pick = (c: Partial<typeof EMPTY_ALBUM_CRITERIA>) => filterMediaLibrary(library.items, { ...EMPTY_ALBUM_CRITERIA, ...c }).map((i) => i.fileUrl);
    expect(pick({})).toHaveLength(4);
    expect(pick({ eventIds: [1], meetingIds: [5] })).toEqual(['minutes.jpg', 'fry1.jpg', 'fry2.jpg']);
    expect(pick({ location: "st. mary's" })).toEqual(['minutes.jpg', 'fry1.jpg', 'fry2.jpg']);
    expect(pick({ years: [2026] })).toEqual(['coat.jpg', 'minutes.jpg']);
    expect(pick({ eventIds: [1], years: [2026] })).toEqual([]);
  });

  it('validates and round-trips Smart Album criteria', () => {
    const clean = cleanAlbumCriteria({ eventIds: [3, 1, 3], meetingIds: [], location: ' Hall ', years: [2026] });
    expect(clean).toEqual({ eventIds: [1, 3], meetingIds: [], location: 'Hall', years: [2026] });
    expect(parseAlbumCriteria(serializeAlbumCriteria(clean))).toEqual(clean);
    expect(parseAlbumCriteria('not json')).toEqual(EMPTY_ALBUM_CRITERIA);
    expect(isEmptyAlbumCriteria(EMPTY_ALBUM_CRITERIA)).toBe(true);
    expect(() => cleanAlbumCriteria({ years: [1066] })).toThrow(/1900-2999/);
    expect(() => cleanAlbumCriteria({ eventIds: [0] })).toThrow(BusinessRuleError);
    expect(() => cleanAlbumCriteria({ colour: 'red' })).toThrow(/no part "colour"/);
  });

  it('needs exactly one event or meeting for an upload', () => {
    expect(cleanVaultUpload({ eventId: 1, fileUrls: [' a.jpg ', 'a.jpg', 'b.jpg'], locationTag: ' ' })).toEqual({ eventId: 1, meetingId: null, fileUrls: ['a.jpg', 'b.jpg'], locationTag: null });
    expect(() => cleanVaultUpload({ fileUrls: ['a.jpg'] })).toThrow(/one event or one meeting/);
    expect(() => cleanVaultUpload({ eventId: 1, meetingId: 2, fileUrls: ['a.jpg'] })).toThrow(/one event or one meeting/);
    expect(() => cleanVaultUpload({ eventId: 1, fileUrls: ['a,b.jpg'] })).toThrow(/comma/);
  });

  it('lets the album author, its Admins and Super Admins delete an album', () => {
    const album = { id: 9, council_id: OWN, created_by_member_id: 30 };
    expect(() => assertMayDeleteSmartAlbum(actor(), album)).not.toThrow();
    expect(() => assertMayDeleteSmartAlbum(actor({ memberId: 31 }), album)).toThrow(/only the member who saved it/);
    expect(() => assertMayDeleteSmartAlbum(actor({ memberId: 31, memberType: 'Admin', councilId: 2 }), album)).toThrow(BusinessRuleError);
    expect(canDeleteSmartAlbum({ memberId: 31, councilId: OWN, memberType: 'Admin', isOfficer: false }, album)).toBe(true);
  });

  it('plays a looping fullscreen slideshow with a fade on the gallery page', () => {
    const page = read('apps/web/app/gallery/page.tsx');
    expect(page).toContain('requestFullscreen');
    expect(page).toContain('SLIDESHOW_INTERVAL_MS');
    expect(page).toContain('motion-safe:animate-slide-fade');
    expect(page).toContain('saveSmartAlbum');
    expect(read('apps/web/app/globals.css')).toContain('@keyframes slide-fade');
  });
});

describe.each(drivers)('media vault and Smart Albums ($name driver)', (d) => {
  it('tags uploads to an event and a meeting, lists them in the library and keeps the event gallery in step', async () => {
    const db = await d.make();
    const event = (await db.events.listByCouncil(OWN))[0];
    const written = await db.media.uploadToVault(MEMBER.superAdmin, { eventId: event.id, fileUrls: ['vault-1.jpg', 'vault-2.jpg'], locationTag: 'Front steps' });
    expect(written.length).toBeGreaterThanOrEqual(2);
    expect(written[0]).toMatchObject({ event_id: event.id, location_tag: 'Front steps', calendar_year: Number(event.StartDate.slice(0, 4)), uploaded_by_member_id: MEMBER.superAdmin });
    expect((await db.events.get(event.id))!.PhotoGalleryURL).toContain('vault-2.jpg');
    // Uploading the same photo again writes nothing.
    expect(await db.media.uploadToVault(MEMBER.superAdmin, { eventId: event.id, fileUrls: ['vault-1.jpg'] })).toEqual([]);

    const library = await db.media.getLibrary(MEMBER.member, OWN);
    const mine = library.items.filter((i) => i.fileUrl.startsWith('vault-'));
    expect(mine.map((i) => [i.fileUrl, i.locationTag])).toEqual([
      ['vault-1.jpg', 'Front steps'],
      ['vault-2.jpg', 'Front steps'],
    ]);

    const meeting = library.meetings[0];
    if (meeting) {
      const [row] = await db.media.uploadToVault(MEMBER.admin, { meetingId: meeting.id, fileUrls: ['meeting.jpg'] });
      expect(row).toMatchObject({ meeting_id: meeting.id, council_id: OWN, calendar_year: Number(meeting.date.slice(0, 4)) });
      await expectRule(db.media.uploadToVault(MEMBER.member, { meetingId: meeting.id, fileUrls: ['x.jpg'] }), 'ADMIN_REQUIRED');
    }
    await expectRule(db.media.uploadToVault(MEMBER.member, { eventId: event.id, fileUrls: ['x.jpg'] }), 'ADMIN_REQUIRED');
    await expectRule(db.media.uploadToVault(MEMBER.admin, { eventId: 9999, fileUrls: ['x.jpg'] }), 'EVENT_NOT_FOUND');
    await expectRule(db.media.getLibrary(MEMBER.member, 2), 'COUNCIL_ACCESS_DENIED');
  });

  it('saves, lists and deletes Smart Albums', async () => {
    const db = await d.make();
    const album = await db.media.saveSmartAlbum(MEMBER.member, OWN, '  Fish Fry 2026 ', { eventIds: [2, 1], meetingIds: [], location: '', years: [2026] });
    expect(album).toMatchObject({ album_name: 'Fish Fry 2026', council_id: OWN, created_by_member_id: MEMBER.member, criteria: { eventIds: [1, 2], years: [2026] } });
    await db.media.saveSmartAlbum(MEMBER.admin, OWN, 'All hall photos', { eventIds: [], meetingIds: [], location: 'hall', years: [] });
    expect((await db.media.listSmartAlbums(MEMBER.member, OWN)).map((a) => a.album_name)).toEqual(['All hall photos', 'Fish Fry 2026']);

    await expectRule(db.media.saveSmartAlbum(MEMBER.member, OWN, ' ', EMPTY_ALBUM_CRITERIA), 'INVALID_INPUT');
    await expectRule(db.media.saveSmartAlbum(MEMBER.member, 2, 'Theirs', EMPTY_ALBUM_CRITERIA), 'COUNCIL_ACCESS_DENIED');
    await expectRule(db.media.deleteSmartAlbum(MEMBER.newMember, album.id), 'ADMIN_REQUIRED');
    await db.media.deleteSmartAlbum(MEMBER.admin, album.id);
    expect(await db.media.listSmartAlbums(MEMBER.member, OWN)).toHaveLength(1);
    await expectRule(db.media.deleteSmartAlbum(MEMBER.admin, album.id), 'RECORD_NOT_FOUND');
  });
});
