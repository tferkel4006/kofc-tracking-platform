// Sprint 7A (schema 59): the roster import template, the member lifecycle hooks (distribution lists follow new,
// excised and transferred members), the inactivity sweep, the phone's devotional tracker with its canonization shield,
// and the dashboard's monthly engagement card with the Top 5 Volunteers Leaderboard.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  addDevotionalEntry,
  buildCouncilEngagement,
  canonizationRank,
  CANONIZATION_LEVELS,
  cleanDevotionalEntry,
  cleanNewMember,
  cleanRankThresholds,
  cleanSupremeRosterRow,
  councilRankThresholds,
  emptyDevotionals,
  INACTIVITY_SWEEP_DAYS,
  lastServiceDates,
  MEMBER_COLUMNS,
  MEMBER_SELF_SERVICE_COLUMNS,
  memberServiceMetrics,
  OFFICE_ROLE_NAMES,
  parseSupremeRosterCsv,
  planInactivitySweep,
  planMemberLifecycle,
  type DataService,
  type MemberStatus,
  type MemberType,
  type NewMember,
  type ServiceLogRow,
} from '@kofc/shared';
import { TABLES } from '../apps/web/services/generated/schema.generated';
import { drivers, expectRule, MEMBER, NOW } from './helpers';

const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');
const OWN = 1;
const STATUSES: MemberStatus[] = [
  { id: 1, Status: 'Active' },
  { id: 2, Status: 'Inactive' },
  { id: 3, Status: 'Former' },
  { id: 4, Status: 'Deceased' },
];
const TYPES: MemberType[] = [
  { id: 1, Type: 'Super Admin' },
  { id: 2, Type: 'Admin' },
  { id: 3, Type: 'Member' },
];

const newMember = (over: Partial<NewMember> = {}): NewMember => ({
  CouncilID: OWN,
  MemberNumber: 7100001,
  MemberFirstName: 'Paul',
  MemberLastName: 'Lifecycle',
  Phone: '503-555-0170',
  StreetAddress1: '7 Mission Road',
  City: 'Salem',
  State: 'OR',
  ZipCode: '97301',
  Email: 'paul.lifecycle@example.org',
  DateOfBirth: '1980-05-05',
  StatusID: 1,
  DegreeID: 1,
  MemberTypeID: 3,
  DateJoinedCouncil: '2026-09-01',
  ...over,
});

const log = (MemberID: number, Hours: number, date: string, eventId: number | null = null): ServiceLogRow => ({ MemberID, Hours, date, eventId });

describe('schema 59', () => {
  it('adds MemberDevotionals, Member.flag_charter_member and the council rank thresholds, and bumps the phone database', () => {
    expect(TABLES.MemberDevotionals.columns.map((c) => c.name)).toEqual(['user_id', 'rosaries_said', 'adorations_count', 'confessions_count']);
    expect(read('Schema.sql')).toMatch(/ALTER TABLE \[MemberDevotionals\]\s+ADD FOREIGN KEY\(\[user_id\]\)\s+REFERENCES \[Member\]\(\[id\]\)/);
    expect(TABLES.Member.columns.find((c) => c.name === 'flag_charter_member')).toMatchObject({ kind: 'bit', notNull: true });
    expect(TABLES.Council.columns.find((c) => c.name === 'rank_threshold_hours')).toMatchObject({ notNull: true });
    expect(TABLES.Council.columns.find((c) => c.name === 'rank_threshold_events')).toMatchObject({ notNull: true });
    expect(read('apps/mobile/services/drivers/sqlite.ts')).toMatch(/const SCHEMA_VERSION = (59|[6-9]\d);/);
  });

  it('stores flag_charter_member with the member, as an Admin-only field', () => {
    expect(MEMBER_COLUMNS).toContain('flag_charter_member');
    expect(MEMBER_SELF_SERVICE_COLUMNS).not.toContain('flag_charter_member' as never);
    expect(cleanNewMember(newMember(), NOW).flag_charter_member).toBe(0);
    expect(cleanNewMember(newMember({ flag_charter_member: true as never }), NOW).flag_charter_member).toBe(1);
    expect(() => cleanNewMember(newMember({ flag_charter_member: 'yes' as never }), NOW)).toThrow(/flag_charter_member/);
  });
});

describe('roster import template', () => {
  const script = read('scripts/roster_import_template.py');
  const headers = [...script.matchAll(/^ {4}\('([^']+)', \d+,/gm)].map((m) => m[1]!);

  it('is compiled with openpyxl into the portal public folder', () => {
    expect(existsSync(join(__dirname, '..', 'apps/web/public/templates/roster_import_template.xlsx'))).toBe(true);
    expect(script).toContain('from openpyxl');
    expect(read('scripts/requirements.txt')).toMatch(/^openpyxl/m);
    expect(read('apps/web/app/supreme-sync/page.tsx')).toContain('/templates/roster_import_template.xlsx');
  });

  it('pulls the Role drop-down from the election lookup definitions', () => {
    expect(script).toContain("'OFFICE_ROLE_NAMES'");
    expect(script).toMatch(/DataValidation\(type='list', formula1=f"=Lists!\$A\$2/);
    expect(OFFICE_ROLE_NAMES).toContain('Grand Knight');
  });

  it('uses headers the roster import reads, so the sheet saved as CSV loads', () => {
    expect(headers).toEqual([
      'Member Number', 'First Name', 'Last Name', 'Email', 'Phone', 'Street', 'Street 2', 'City', 'State', 'Zip',
      'Birth Date', 'Degree', 'Date Joined', 'Charter Member', 'Role',
    ]);
    const csv = `${headers.join(',')}\n1234567,Joseph,Kowalski,joseph.kowalski@example.org,(555) 201-4477,410 Columbus Avenue,Apt 2B,Springfield,IL,62701,1978-03-19,3,2026-09-12,Yes,Member\n`;
    const [row] = parseSupremeRosterCsv(csv);
    expect(row).toMatchObject({ MemberNumber: 1234567, DegreeID: 3, DateJoinedCouncil: '2026-09-12', flag_charter_member: 1 });
    expect(row).not.toHaveProperty('Role');
    const clean = cleanSupremeRosterRow(row!, OWN, { activeStatusId: 1, memberTypeId: 3 }, NOW);
    expect(clean).toMatchObject({ MemberFirstName: 'Joseph', flag_charter_member: 1, DegreeID: 3 });
    expect(parseSupremeRosterCsv(csv.replace(',Yes,', ',,'))[0]!.flag_charter_member).toBe(0);
  });
});

describe('lifecycle hooks (pure)', () => {
  const lists = [
    { id: 1, CouncilID: 1, IsCouncilWide: 1 },
    { id: 2, CouncilID: 1, IsCouncilWide: 0 },
    { id: 3, CouncilID: 2, IsCouncilWide: 1 },
    { id: 4, CouncilID: 2, IsCouncilWide: null },
    { id: 5, CouncilID: 2, IsCouncilWide: 0 },
  ];

  it('puts a new member on their council-wide lists only', () => {
    expect(planMemberLifecycle({ before: null, after: { CouncilID: 1, StatusID: 1 }, statuses: STATUSES, lists, memberListIds: [] })).toEqual({
      statusId: 1,
      transferred: false,
      excised: false,
      leaveListIds: [],
      joinListIds: [1],
    });
  });

  it('takes a Deceased or Former member off every list', () => {
    for (const status of [3, 4]) {
      const plan = planMemberLifecycle({ before: { CouncilID: 1, StatusID: 1 }, after: { CouncilID: 1, StatusID: status }, statuses: STATUSES, lists, memberListIds: [2, 1] });
      expect(plan).toMatchObject({ excised: true, leaveListIds: [1, 2], joinListIds: [] });
    }
    const inactive = planMemberLifecycle({ before: { CouncilID: 1, StatusID: 1 }, after: { CouncilID: 1, StatusID: 2 }, statuses: STATUSES, lists, memberListIds: [1] });
    expect(inactive).toMatchObject({ excised: false, leaveListIds: [], joinListIds: [] });
  });

  it('stores a transferred member Active and moves them to the new council lists', () => {
    const plan = planMemberLifecycle({ before: { CouncilID: 1, StatusID: 2 }, after: { CouncilID: 2, StatusID: 2 }, statuses: STATUSES, lists, memberListIds: [1, 2, 3] });
    expect(plan).toEqual({ statusId: 1, transferred: true, excised: false, leaveListIds: [1, 2], joinListIds: [4] });
  });
});

describe('inactivity sweep (pure)', () => {
  const today = '2026-09-20';
  const members = [
    { id: 1, StatusID: 1, MemberTypeID: 3, DateJoinedCouncil: '2020-01-01' }, // last served 2025-09-19: 367 days
    { id: 2, StatusID: 1, MemberTypeID: 3, DateJoinedCouncil: '2020-01-01' }, // last served 2025-09-20: exactly 365 days
    { id: 3, StatusID: 1, MemberTypeID: 3, DateJoinedCouncil: '2024-01-01' }, // never served, joined long ago
    { id: 4, StatusID: 1, MemberTypeID: 3, DateJoinedCouncil: '2026-01-01' }, // never served, joined this year
    { id: 5, StatusID: 1, MemberTypeID: 3, DateJoinedCouncil: null }, // nothing to measure from
    { id: 6, StatusID: 1, MemberTypeID: 2, DateJoinedCouncil: '2010-01-01' }, // an Admin is never swept
    { id: 7, StatusID: 3, MemberTypeID: 3, DateJoinedCouncil: '2010-01-01' }, // already Former
  ];
  const logs = [log(1, 2, '2025-09-19'), log(1, 1, '2024-01-01'), log(2, 1, '2025-09-20')];

  it('marks only Active plain members more than INACTIVITY_SWEEP_DAYS past their last service or join date', () => {
    expect(INACTIVITY_SWEEP_DAYS).toBe(365);
    expect(lastServiceDates(logs).get(1)).toBe('2025-09-19');
    expect(planInactivitySweep({ members, statuses: STATUSES, memberTypes: TYPES, logs, today })).toEqual([1, 3]);
  });
});

describe('devotional entries and the canonization shield (pure)', () => {
  it('cleans an entry and adds it to the tally', () => {
    expect(cleanDevotionalEntry({ rosaries: 2 })).toEqual({ rosaries: 2, adorations: 0, confessions: 0 });
    expect(() => cleanDevotionalEntry({})).toThrow(/at least one/);
    expect(() => cleanDevotionalEntry({ rosaries: 1.5 })).toThrow(/whole number/);
    expect(() => cleanDevotionalEntry({ rosaries: 101 })).toThrow(/0 to 100/);
    expect(() => cleanDevotionalEntry({ rosaries: -1 })).toThrow(/whole number/);
    expect(() => cleanDevotionalEntry({ novenas: 1 } as never)).toThrow(/no field "novenas"/);
    const tally = addDevotionalEntry(addDevotionalEntry(emptyDevotionals(9), cleanDevotionalEntry({ rosaries: 2, confessions: 1 })), cleanDevotionalEntry({ adorations: 1 }));
    expect(tally).toEqual({ user_id: 9, rosaries_said: 2, adorations_count: 1, confessions_count: 1 });
  });

  it('ranks by the share of BOTH thresholds met: a third, two thirds, the whole bar', () => {
    const t = { hours: 30, events: 3 };
    expect(CANONIZATION_LEVELS).toEqual(['Servant of God', 'Venerable', 'Blessed', 'Saint']);
    expect(canonizationRank({ hours: 0, events: 0 }, t)).toMatchObject({ level: 'Servant of God', next: { level: 'Venerable', hoursNeeded: 10, eventsNeeded: 1 } });
    expect(canonizationRank({ hours: 10, events: 1 }, t).level).toBe('Venerable');
    expect(canonizationRank({ hours: 29.75, events: 3 }, t)).toMatchObject({ level: 'Blessed', next: { level: 'Saint', hoursNeeded: 0.25, eventsNeeded: 0 } });
    expect(canonizationRank({ hours: 500, events: 1 }, t).level).toBe('Venerable');
    expect(canonizationRank({ hours: 30, events: 3 }, t)).toMatchObject({ level: 'Saint', levelIndex: 3, progress: 1, next: null });
    // A third of 100 hours is not rounded down to 33.
    expect(canonizationRank({ hours: 33.25, events: 10 }, { hours: 100, events: 10 }).level).toBe('Servant of God');
    expect(canonizationRank({ hours: 33.5, events: 10 }, { hours: 100, events: 10 }).level).toBe('Venerable');
  });

  it('counts hours and distinct events from the logs', () => {
    expect(memberServiceMetrics(1, [log(1, 2, '2026-01-01', 7), log(1, 1.25, '2026-01-02', 7), log(1, 1, '2026-01-03'), log(2, 9, '2026-01-01', 8)])).toEqual({ hours: 4.25, events: 1 });
  });

  it('reads and checks the council thresholds', () => {
    expect(councilRankThresholds({})).toEqual({ hours: 100, events: 10 });
    expect(councilRankThresholds({ rank_threshold_hours: 40, rank_threshold_events: 4 })).toEqual({ hours: 40, events: 4 });
    expect(cleanRankThresholds({ hours: 50, events: 5 })).toEqual({ hours: 50, events: 5 });
    expect(() => cleanRankThresholds({ hours: 0, events: 5 })).toThrow(/hours threshold/);
    expect(() => cleanRankThresholds({ hours: 50, events: 2.5 })).toThrow(/events threshold/);
  });
});

describe('monthly engagement card (pure)', () => {
  const members = [1, 2, 3, 4, 5, 6, 7].map((id) => ({ id, CouncilID: id === 7 ? 2 : 1, StatusID: id === 6 ? 3 : 1, MemberFirstName: `F${id}`, MemberLastName: `L${id}` }));
  const logs = [
    log(1, 10, '2026-08-01'),
    log(2, 8, '2026-09-02', 1),
    log(3, 8, '2026-09-03'),
    log(4, 5, '2026-07-01'),
    log(5, 4, '2026-07-01'),
    log(6, 50, '2026-09-04'), // Former: in the month's list, never on the leaderboard
    log(7, 60, '2026-09-05'), // another council's member who served here
    log(1, 1, '2026-09-30'),
  ];
  const card = buildCouncilEngagement({ councilId: 1, year: 2026, month: 9, fromDate: '2026-09-01', toDate: '2026-09-30', logs, members, activeStatusId: 1 });

  it("lists the month's volunteers, most hours first", () => {
    expect(card.volunteers.map((v) => [v.memberId, v.hours])).toEqual([
      [7, 60],
      [6, 50],
      [2, 8],
      [3, 8],
      [1, 1],
    ]);
  });

  it("ranks the council's Active members by all hours, five at most, ties sharing a rank", () => {
    expect(card.leaderboard.map((l) => [l.rank, l.memberId, l.hours])).toEqual([
      [1, 1, 11],
      [2, 2, 8],
      [2, 3, 8],
      [4, 4, 5],
      [5, 5, 4],
    ]);
  });
});

describe.each(drivers)('Sprint 7A services ($name driver)', ({ make }) => {
  const listsOf = async (db: DataService, actorId: number, councilId: number) =>
    new Map((await db.distributionLists.listForMember(actorId, councilId)).map((l) => [l.list.ListName, l.memberIds]));

  async function councilWithMember(db: DataService, number: number) {
    const council = await db.councils.create(MEMBER.superAdmin, { CouncilNumber: number, CouncilName: `Council ${number}`, State: 'OR' });
    const member = await db.members.create(MEMBER.superAdmin, newMember({ CouncilID: council.id, MemberNumber: number, Email: `m${number}@example.org` }));
    return { council, member };
  }

  it('puts a new member on the council-wide lists, not on private ones', async () => {
    const db = await make();
    await db.distributionLists.create(MEMBER.admin, { ListName: 'All Knights', CouncilID: OWN, memberIds: [MEMBER.member], IsCouncilWide: true });
    await db.distributionLists.create(MEMBER.admin, { ListName: 'My Crew', CouncilID: OWN, memberIds: [MEMBER.member] });
    const created = await db.members.create(MEMBER.admin, newMember());
    expect((await listsOf(db, MEMBER.admin, OWN)).get('All Knights')).toContain(created.id);
    expect((await listsOf(db, MEMBER.admin, OWN)).get('My Crew')).not.toContain(created.id);
  });

  it('puts members from the Supreme roster on the council-wide lists too', async () => {
    const db = await make();
    await db.distributionLists.create(MEMBER.admin, { ListName: 'All Knights', CouncilID: OWN, memberIds: [], IsCouncilWide: true });
    const csv = 'Member Number,First Name,Last Name,Email,Phone,Street,City,State,Zip,Birth Date,Date Joined,Charter Member\n7100009,Ray,Roster,ray.roster@example.org,503-555-0101,1 Main St,Salem,OR,97301,1975-01-01,2026-09-10,Yes\n';
    const result = await db.supreme.syncSupremeRoster(MEMBER.admin, OWN, parseSupremeRosterCsv(csv));
    const ray = result.created[0]!;
    expect(ray.flag_charter_member).toBe(1);
    expect((await listsOf(db, MEMBER.admin, OWN)).get('All Knights')).toEqual([ray.id]);
  });

  it('takes a member marked Deceased or Former off every list', async () => {
    const db = await make();
    await db.distributionLists.create(MEMBER.admin, { ListName: 'All Knights', CouncilID: OWN, memberIds: [MEMBER.member], IsCouncilWide: true });
    await db.distributionLists.create(MEMBER.admin, { ListName: 'My Crew', CouncilID: OWN, memberIds: [MEMBER.member] });
    await db.members.update(MEMBER.admin, MEMBER.member, { StatusID: 4 });
    const lists = await listsOf(db, MEMBER.admin, OWN);
    expect(lists.get('All Knights')).not.toContain(MEMBER.member);
    expect(lists.get('My Crew')).not.toContain(MEMBER.member);
    expect((await db.members.get(MEMBER.member))!.StatusID).toBe(4);
  });

  it('transfers a member Active into the new council, moving their list entries in one write', async () => {
    const db = await make();
    const { council } = await councilWithMember(db, 99071);
    await db.distributionLists.create(MEMBER.superAdmin, { ListName: 'Council 99071 Brothers', CouncilID: council.id, memberIds: [], IsCouncilWide: true });
    await db.distributionLists.create(MEMBER.admin, { ListName: 'All Knights', CouncilID: OWN, memberIds: [MEMBER.member], IsCouncilWide: true });
    await db.members.update(MEMBER.admin, MEMBER.member, { StatusID: 2 });
    const moved = await db.members.update(MEMBER.superAdmin, MEMBER.member, { CouncilID: council.id, StatusID: 2 });
    expect(moved).toMatchObject({ CouncilID: council.id, StatusID: 1 });
    expect((await listsOf(db, MEMBER.admin, OWN)).get('All Knights')).not.toContain(MEMBER.member);
    expect((await listsOf(db, MEMBER.superAdmin, council.id)).get('Council 99071 Brothers')).toEqual([MEMBER.member]);
  });

  it('sweeps long-quiet plain members Inactive, for the council Admins and Super Admins only', async () => {
    const db = await make();
    const quiet = await db.members.create(MEMBER.admin, newMember({ DateJoinedCouncil: '2024-01-01' }));
    const fresh = await db.members.create(MEMBER.admin, newMember({ MemberNumber: 7100002, Email: 'fresh@example.org', DateJoinedCouncil: '2026-06-01' }));
    await expectRule(db.members.sweepInactive(MEMBER.member, OWN), 'ADMIN_REQUIRED');
    const { council } = await councilWithMember(db, 99072);
    await expectRule(db.members.sweepInactive(MEMBER.admin, council.id), 'COUNCIL_ACCESS_DENIED');
    const swept = await db.members.sweepInactive(MEMBER.admin, OWN);
    expect(swept.map((m) => m.id)).toContain(quiet.id);
    expect(swept.map((m) => m.id)).not.toContain(fresh.id);
    expect(swept.every((m) => m.StatusID === 2 && m.CouncilID === OWN)).toBe(true);
    expect((await db.members.get(quiet.id))!.StatusID).toBe(2);
    expect((await db.members.get(MEMBER.admin))!.StatusID).toBe(1);
    expect(await db.members.sweepInactive(MEMBER.admin, OWN)).toEqual([]);
  });

  it("logs the member's own devotions and ranks their shield on logged service", async () => {
    const db = await make();
    const empty = await db.devotionals.getProgress(MEMBER.member);
    expect(empty.tally).toEqual({ user_id: MEMBER.member, rosaries_said: 0, adorations_count: 0, confessions_count: 0 });
    expect(empty.rank.thresholds).toEqual({ hours: 100, events: 10 });
    await db.devotionals.record(MEMBER.member, { rosaries: 3, confessions: 1 });
    const after = await db.devotionals.record(MEMBER.member, { rosaries: 1, adorations: 2 });
    expect(after.tally).toEqual({ user_id: MEMBER.member, rosaries_said: 4, adorations_count: 2, confessions_count: 1 });
    await expectRule(db.devotionals.record(MEMBER.member, { rosaries: 0 }), 'INVALID_INPUT');
    await expectRule(db.devotionals.getProgress(9999), 'MEMBER_NOT_FOUND');

    await db.activityTime.logHours(MEMBER.member, 1, 2, '2026-09-19');
    await db.councils.setRankThresholds(MEMBER.admin, OWN, { hours: 1, events: 1 });
    const ranked = await db.devotionals.getProgress(MEMBER.member);
    expect(ranked.rank.metrics.hours).toBeGreaterThanOrEqual(2);
    expect(ranked.rank).toEqual(canonizationRank(ranked.rank.metrics, { hours: 1, events: 1 }));
  });

  it('refuses the devotional tracker in a white-label council', async () => {
    const db = await make();
    const { council, member } = await councilWithMember(db, 99073);
    await db.councils.setGlobalParameters(MEMBER.superAdmin, council.id, { tenant_type: 'GENERIC' });
    await expectRule(db.devotionals.getProgress(member.id), 'FRATERNAL_EXTENSION_REQUIRED');
    await expectRule(db.devotionals.record(member.id, { rosaries: 1 }), 'FRATERNAL_EXTENSION_REQUIRED');
  });

  it('lets only the council Admins and Super Admins set the shield thresholds', async () => {
    const db = await make();
    expect(await db.councils.setRankThresholds(MEMBER.admin, OWN, { hours: 40, events: 4 })).toMatchObject({ rank_threshold_hours: 40, rank_threshold_events: 4 });
    await expectRule(db.councils.setRankThresholds(MEMBER.member, OWN, { hours: 40, events: 4 }), 'ADMIN_REQUIRED');
    const { council } = await councilWithMember(db, 99074);
    await expectRule(db.councils.setRankThresholds(MEMBER.admin, council.id, { hours: 40, events: 4 }), 'COUNCIL_ACCESS_DENIED');
    await expectRule(db.councils.setRankThresholds(MEMBER.superAdmin, council.id, { hours: 0, events: 4 }), 'INVALID_INPUT');
    expect((await db.councils.setRankThresholds(MEMBER.superAdmin, council.id, { hours: 7, events: 2 })).rank_threshold_hours).toBe(7);
  });

  it("compiles the month's volunteers and the Top 5 leaderboard for the council's members", async () => {
    const db = await make();
    await db.activityTime.logHours(MEMBER.member, 1, 2, '2026-09-19');
    const card = await db.reports.councilEngagement(MEMBER.member, OWN, 2026, 9);
    expect(card).toMatchObject({ councilId: OWN, year: 2026, month: 9 });
    expect(card.volunteers.find((v) => v.memberId === MEMBER.member)?.hours).toBeGreaterThanOrEqual(2);
    expect(card.leaderboard.length).toBeLessThanOrEqual(5);
    expect(card.leaderboard.map((l) => l.hours)).toEqual([...card.leaderboard.map((l) => l.hours)].sort((a, b) => b - a));
    const { member } = await councilWithMember(db, 99075);
    await expectRule(db.reports.councilEngagement(member.id, OWN, 2026, 9), 'COUNCIL_ACCESS_DENIED');
    await expectRule(db.reports.councilEngagement(MEMBER.member, OWN, 2026, 13), 'INVALID_INPUT');
  });
});

describe('Sprint 7A screens', () => {
  it('puts the engagement row on the Executive Summary dashboard', () => {
    const dashboard = read('apps/web/app/dashboard/page.tsx');
    expect(dashboard).toContain('<EngagementCards');
    const parts = read('apps/web/components/EngagementParts.tsx');
    expect(parts).toContain('Top 5 Volunteers Leaderboard');
    expect(parts).toMatch(/border-4 border-gold bg-navy/);
    expect(parts).toContain('db.councils.setRankThresholds');
  });

  it('puts the devotional tracker and shield on the phone Home, inside the Faith Center flag', () => {
    expect(read('apps/mobile/app/(app)/index.tsx')).toContain('{faithOn ? <DevotionalTracker version={prayerVersion} /> : null}');
    const tracker = read('apps/mobile/components/DevotionalTracker.tsx');
    expect(tracker).toContain('db.devotionals.record');
    expect(tracker).toContain('CanonizationShield');
  });

  it('gives Admins the charter flag and the inactivity sweep on the roster', () => {
    const roster = read('apps/web/app/members/page.tsx');
    expect(roster).toContain('db.members.sweepInactive');
    expect(roster).toContain('Charter member');
  });
});
