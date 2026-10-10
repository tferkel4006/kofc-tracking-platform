// Sprint 7A Extension (schema 60): the multi-council membership trail (MemberCouncilAffiliationLog), the Shared Member
// Center (reports.memberCenter) on the web and the phone, the lock that keeps ordinary members off the finance ledgers,
// and the user guide sections that document them.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildAffiliationHistory,
  buildCouncilEngagement,
  buildMemberCenter,
  councilDevotionTotals,
  planAffiliationLog,
  portalAreas,
  type DataService,
  type MemberStatus,
  type NewMember,
} from '@kofc/shared';
import { TABLES } from '../apps/web/services/generated/schema.generated';
import { drivers, expectRule, MEMBER } from './helpers';

const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');
const OWN = 1;
const NOW = '2026-09-20 19:00:00';
const STATUSES: MemberStatus[] = [
  { id: 1, Status: 'Active' },
  { id: 2, Status: 'Inactive' },
  { id: 3, Status: 'Former' },
  { id: 4, Status: 'Deceased' },
];

const newMember = (over: Partial<NewMember> = {}): NewMember => ({
  CouncilID: OWN,
  MemberNumber: 7200001,
  MemberFirstName: 'Tom',
  MemberLastName: 'Trail',
  Phone: '503-555-0171',
  StreetAddress1: '9 Mission Road',
  City: 'Salem',
  State: 'OR',
  ZipCode: '97301',
  Email: 'tom.trail@example.org',
  DateOfBirth: '1980-05-05',
  StatusID: 1,
  DegreeID: 1,
  MemberTypeID: 3,
  DateJoinedCouncil: '2026-09-01',
  ...over,
});

describe('schema 60', () => {
  it('adds MemberCouncilAffiliationLog and bumps the phone database', () => {
    expect(TABLES.MemberCouncilAffiliationLog.columns.map((c) => c.name)).toEqual(['id', 'user_id', 'council_id', 'membership_status', 'date_joined', 'date_exited']);
    expect(TABLES.MemberCouncilAffiliationLog.columns.find((c) => c.name === 'date_exited')).toMatchObject({ notNull: false });
    expect(TABLES.MemberCouncilAffiliationLog.columns.find((c) => c.name === 'date_joined')).toMatchObject({ notNull: true });
    expect(read('Schema.sql')).toMatch(/ALTER TABLE \[MemberCouncilAffiliationLog\]\s+ADD FOREIGN KEY\(\[council_id\]\)\s+REFERENCES \[Council\]\(\[id\]\)/);
    expect(read('apps/mobile/services/drivers/sqlite.ts')).toMatch(/const SCHEMA_VERSION = (6\d|[7-9]\d);/);
  });
});

describe('affiliation log plan (pure)', () => {
  const base = { memberId: 5, statuses: STATUSES, now: NOW };

  it('opens a row for a new member, dated by the join date when known', () => {
    expect(planAffiliationLog({ ...base, before: null, after: { CouncilID: 1, StatusID: 1, DateJoinedCouncil: '2026-09-01' }, rows: [] })).toEqual({
      inserts: [{ user_id: 5, council_id: 1, membership_status: 'Active', date_joined: '2026-09-01 00:00:00', date_exited: null }],
      updates: [],
    });
    expect(planAffiliationLog({ ...base, before: null, after: { CouncilID: 1, StatusID: 1, DateJoinedCouncil: null }, rows: [] }).inserts[0]!.date_joined).toBe(NOW);
  });

  it('freezes the council left as Former and opens an Active row on a transfer', () => {
    const plan = planAffiliationLog({
      ...base,
      before: { CouncilID: 1, StatusID: 1, DateJoinedCouncil: '2020-01-01' },
      after: { CouncilID: 2, StatusID: 1, DateJoinedCouncil: '2020-01-01' },
      rows: [{ id: 7, council_id: 1, date_exited: null }],
    });
    expect(plan).toEqual({
      updates: [{ id: 7, membership_status: 'Former', date_exited: NOW }],
      inserts: [{ user_id: 5, council_id: 2, membership_status: 'Active', date_joined: NOW, date_exited: null }],
    });
  });

  it('writes the old membership from the join date for a member from before the log began', () => {
    const plan = planAffiliationLog({ ...base, before: { CouncilID: 1, StatusID: 2, DateJoinedCouncil: '2015-06-01' }, after: { CouncilID: 2, StatusID: 1 }, rows: [] });
    expect(plan.inserts).toEqual([
      { user_id: 5, council_id: 1, membership_status: 'Former', date_joined: '2015-06-01 00:00:00', date_exited: NOW },
      { user_id: 5, council_id: 2, membership_status: 'Active', date_joined: NOW, date_exited: null },
    ]);
  });

  it('restates the open row on a status change and closes it for Deceased or Former', () => {
    const rows = [{ id: 7, council_id: 1, date_exited: null }];
    const before = { CouncilID: 1, StatusID: 1, DateJoinedCouncil: '2020-01-01' };
    expect(planAffiliationLog({ ...base, before, after: { CouncilID: 1, StatusID: 2 }, rows }).updates).toEqual([{ id: 7, membership_status: 'Inactive', date_exited: null }]);
    expect(planAffiliationLog({ ...base, before, after: { CouncilID: 1, StatusID: 4 }, rows }).updates).toEqual([{ id: 7, membership_status: 'Deceased', date_exited: NOW }]);
    expect(planAffiliationLog({ ...base, before, after: { CouncilID: 1, StatusID: 1 }, rows })).toEqual({ inserts: [], updates: [] });
    // Rejoining after leaving opens a new row.
    const rejoin = planAffiliationLog({ ...base, before: { ...before, StatusID: 3 }, after: { CouncilID: 1, StatusID: 1 }, rows: [{ id: 7, council_id: 1, date_exited: NOW }] });
    expect(rejoin.inserts).toEqual([{ user_id: 5, council_id: 1, membership_status: 'Active', date_joined: NOW, date_exited: null }]);
  });

  it('adds the current membership to the history card when the log has no row for it', () => {
    const councils = [
      { id: 1, CouncilNumber: 15295, CouncilName: 'St. Jude Council' },
      { id: 2, CouncilNumber: 99001, CouncilName: 'New Council' },
    ];
    const history = buildAffiliationHistory({ member: { CouncilID: 1, StatusID: 1, DateJoinedCouncil: '2019-02-03' }, rows: [], councils, statuses: STATUSES });
    expect(history).toEqual([{ id: null, councilId: 1, councilNumber: 15295, councilName: 'St. Jude Council', status: 'Active', dateJoined: '2019-02-03 00:00:00', dateExited: null }]);
    const rows = [
      { id: 2, user_id: 5, council_id: 2, membership_status: 'Active', date_joined: NOW, date_exited: null },
      { id: 1, user_id: 5, council_id: 1, membership_status: 'Former', date_joined: '2019-02-03 00:00:00', date_exited: NOW },
    ];
    expect(buildAffiliationHistory({ member: { CouncilID: 2, StatusID: 1 }, rows, councils, statuses: STATUSES }).map((h) => [h.councilName, h.status])).toEqual([
      ['St. Jude Council', 'Former'],
      ['New Council', 'Active'],
    ]);
  });
});

describe('Shared Member Center (pure)', () => {
  it('sums devotions without naming anyone and carries no financial figure', () => {
    const rows = [
      { user_id: 1, rosaries_said: 3, adorations_count: 1, confessions_count: 0 },
      { user_id: 2, rosaries_said: 0, adorations_count: 0, confessions_count: 0 },
      { user_id: 9, rosaries_said: 50, adorations_count: 50, confessions_count: 50 },
    ];
    const devotions = councilDevotionTotals(rows, new Set([1, 2]));
    expect(devotions).toEqual({ rosaries: 3, adorations: 1, confessions: 0, contributors: 1 });
    const engagement = buildCouncilEngagement({
      councilId: 1,
      year: 2026,
      month: 9,
      fromDate: '2026-09-01',
      toDate: '2026-09-30',
      logs: [{ MemberID: 1, Hours: 2.5, date: '2026-09-02', eventId: 4 }],
      members: [{ id: 1, CouncilID: 1, StatusID: 1, MemberFirstName: 'A', MemberLastName: 'B' }],
      activeStatusId: 1,
    });
    const center = buildMemberCenter({
      engagement,
      viewer: { id: 1, MemberFirstName: 'A', MemberLastName: 'B' },
      viewerLogs: [{ MemberID: 1, Hours: 2.5, date: '2026-09-02', eventId: 4 }],
      thresholds: { hours: 3, events: 3 },
      devotions,
    });
    expect(center).toMatchObject({ volunteerCount: 1, totalHours: 2.5, me: { eventsAttended: 1, hours: 2.5, rank: { level: 'Venerable' } } });
    expect(JSON.stringify(center)).not.toMatch(/cash|budget|ledger|amount|balance/i);
    expect(buildMemberCenter({ engagement, viewer: { id: 1, MemberFirstName: 'A', MemberLastName: 'B' }, viewerLogs: [], thresholds: { hours: 3, events: 3 }, devotions: null }).me.rank).toBeNull();
  });
});

describe('executive finance desks stay locked to ordinary members', () => {
  it('keeps the finance ledgers and the executive dashboard off a plain member, and opens the Member Center to all', () => {
    const member = { memberId: 3, councilId: 1, memberType: 'Member', active: true, roles: [] as string[], isOfficer: false } as never;
    const areas = portalAreas(member);
    expect(areas.filter((a) => a.startsWith('finance/') || a === 'dashboard' || a === 'donations' || a === 'expenses/queue')).toEqual([]);
    expect(areas).toContain('member-center');
  });
});

describe.each(drivers)('Sprint 7A Extension services ($name driver)', ({ make }) => {
  const trail = async (db: DataService, actorId: number, memberId: number) =>
    (await db.members.listAffiliations(actorId, memberId)).map((h) => [h.councilId, h.status, h.dateExited === null]);

  async function otherCouncil(db: DataService, number: number) {
    const council = await db.councils.create(MEMBER.superAdmin, { CouncilNumber: number, CouncilName: `Council ${number}`, State: 'OR' });
    const member = await db.members.create(MEMBER.superAdmin, newMember({ CouncilID: council.id, MemberNumber: number, Email: `t${number}@example.org` }));
    return { council, member };
  }

  it('logs a new member and freezes the trail on a transfer', async () => {
    const db = await make();
    const added = await db.members.create(MEMBER.admin, newMember());
    expect(await trail(db, MEMBER.admin, added.id)).toEqual([[OWN, 'Active', true]]);
    const { council } = await otherCouncil(db, 99081);
    await db.members.update(MEMBER.superAdmin, added.id, { CouncilID: council.id });
    expect(await trail(db, added.id, added.id)).toEqual([
      [OWN, 'Former', false],
      [council.id, 'Active', true],
    ]);
  });

  it('writes the trail for a seeded member transferred before any log row existed', async () => {
    const db = await make();
    expect(await trail(db, MEMBER.member, MEMBER.member)).toEqual([[OWN, 'Active', true]]);
    const { council } = await otherCouncil(db, 99082);
    await db.members.update(MEMBER.superAdmin, MEMBER.member, { CouncilID: council.id });
    expect(await trail(db, MEMBER.superAdmin, MEMBER.member)).toEqual([
      [OWN, 'Former', false],
      [council.id, 'Active', true],
    ]);
  });

  it('closes the membership of a member marked Deceased, and restates an inactivity sweep', async () => {
    const db = await make();
    const added = await db.members.create(MEMBER.admin, newMember({ DateJoinedCouncil: '2024-01-01' }));
    await db.members.sweepInactive(MEMBER.admin, OWN);
    expect(await trail(db, MEMBER.admin, added.id)).toEqual([[OWN, 'Inactive', true]]);
    await db.members.update(MEMBER.admin, added.id, { StatusID: 4 });
    expect(await trail(db, MEMBER.admin, added.id)).toEqual([[OWN, 'Deceased', false]]);
  });

  it('shows the trail to the member, their council Admins and Super Admins only', async () => {
    const db = await make();
    const { member } = await otherCouncil(db, 99083);
    await expectRule(db.members.listAffiliations(MEMBER.member, MEMBER.admin), 'ADMIN_REQUIRED');
    await expectRule(db.members.listAffiliations(MEMBER.admin, member.id), 'COUNCIL_ACCESS_DENIED');
    await expectRule(db.members.listAffiliations(MEMBER.admin, 9999), 'MEMBER_NOT_FOUND');
    expect(await db.members.listAffiliations(MEMBER.superAdmin, member.id)).toHaveLength(1);
  });

  it('refuses the finance ledgers to an ordinary member', async () => {
    const db = await make();
    for (const read of [
      () => db.finance.listChartOfAccounts(MEMBER.member, OWN),
      () => db.finance.getLatestBalanceSheet(MEMBER.member, OWN),
      () => db.finance.listLedgerTransactions(MEMBER.member, OWN),
      () => db.finance.getCouncilNetWorth(MEMBER.member, OWN),
      () => db.finance.listTrusteeAudits(MEMBER.member, OWN),
    ]) {
      const err = await read().then(
        () => null,
        (e: unknown) => e,
      );
      expect(err, 'an ordinary member read a finance ledger').toBeInstanceOf(Error);
      expect((err as { code?: string }).code).toMatch(/REQUIRED|DENIED/);
    }
  });

  it("opens the Member Center to every member with the council's sums and the viewer's own impact", async () => {
    const db = await make();
    await db.activityTime.logHours(MEMBER.member, 1, 2, '2026-09-19');
    await db.devotionals.record(MEMBER.member, { rosaries: 4 });
    await db.devotionals.record(MEMBER.admin, { rosaries: 1, confessions: 1 });
    const center = await db.reports.memberCenter(MEMBER.member, OWN, 2026, 9);
    expect(center.devotions).toMatchObject({ rosaries: 5, confessions: 1, contributors: 2 });
    expect(center.volunteers.some((v) => v.memberId === MEMBER.member)).toBe(true);
    expect(center.volunteerCount).toBe(center.volunteers.length);
    expect(center.me).toMatchObject({ memberId: MEMBER.member });
    expect(center.me.hours).toBeGreaterThanOrEqual(2);
    expect(center.me.rank?.level).toBeDefined();
    expect(center).not.toHaveProperty('finances');
    const { member } = await otherCouncil(db, 99084);
    await expectRule(db.reports.memberCenter(member.id, OWN, 2026, 9), 'COUNCIL_ACCESS_DENIED');
  });

  it('leaves the devotions and the shield out for a white-label council', async () => {
    const db = await make();
    const { council, member } = await otherCouncil(db, 99085);
    await db.councils.setGlobalParameters(MEMBER.superAdmin, council.id, { tenant_type: 'GENERIC' });
    const center = await db.reports.memberCenter(member.id, council.id, 2026, 9);
    expect(center.devotions).toBeNull();
    expect(center.me.rank).toBeNull();
  });
});

describe('Sprint 7A Extension screens and guide', () => {
  it('serves the Shared Member Center on the web for every member, with no money on it', () => {
    const page = read('apps/web/app/member-center/page.tsx');
    expect(page).toContain('<RequireArea area="member-center">');
    expect(page).toContain('db.reports.memberCenter');
    expect(page).toContain('<Leaderboard');
    expect(page).toContain('<CanonizationShield');
    expect(page).not.toMatch(/formatMoney|monthlySummary|finances/);
    expect(read('apps/web/components/Sidebar.tsx')).toContain("'member-center': {");
    expect(read('apps/web/app/members/page.tsx')).toContain('<AffiliationHistoryCard');
  });

  it('serves the Shared Member Center on the phone from a Home card', () => {
    const screen = read('apps/mobile/app/(app)/member-center.tsx');
    expect(screen).toContain('db.reports.memberCenter');
    expect(screen).toContain('Top 5 Volunteers Leaderboard');
    expect(read('apps/mobile/app/(app)/_layout.tsx')).toContain('<Tabs.Screen name="member-center"');
    expect(read('apps/mobile/app/(app)/index.tsx')).toContain("router.push('/member-center')");
  });

  it('documents the new tools in the administrator user guide', () => {
    const guide = read('docs/ADMIN_USER_GUIDE.md');
    for (const heading of ['Shared Member Center', 'Personal impact', 'council membership history', 'roster template', 'inactivity sweep']) {
      expect(guide.toLowerCase()).toContain(heading.toLowerCase());
    }
    // No code names leak into the print guide.
    expect(guide).not.toMatch(/\b(memberCenter|listAffiliations|sweepInactive|MemberCouncilAffiliationLog|flag_charter_member)\b/);
  });
});
