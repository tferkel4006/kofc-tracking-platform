// Sprint 5T step 1: smartphone push alert plumbing (notifications.registerDeviceToken, listMemberAlerts and
// dispatchHighPriorityAlert) and the Supreme Council Alchemer sync (supreme.syncAlchemerReport): their role gates,
// the Expo and Alchemer stubs, and the rows they log.
import { describe, expect, it, vi } from 'vitest';
import {
  ALCHEMER_SHORTNAMES,
  buildAlchemerRequest,
  buildExpoPushRequests,
  cleanAlchemerSurveyId,
  cleanExpoPushToken,
  compileSupremeSnapshot,
  EXPO_PUSH_ENDPOINT,
  mayDispatchCouncilAlerts,
  maySyncSupremeReports,
  SecurityPrivilegeError,
  supremeReportingPeriod,
  type DataService,
  type ExpoPushMessage,
  type MemberWriteActor,
} from '@kofc/shared';
import { MemoryDataService } from '../apps/web/services/drivers/memory';
import { SqliteDataService } from '../apps/mobile/services/drivers/sqlite';
import { drivers, expectRule, MEMBER, NOW, shiftByName, type DriverUnderTest } from './helpers';
import { openDatabases } from './shims/expo-sqlite';

// Dev seed: council 1 is 15295 (Super Admin 1, Admin 2 who is also Financial Secretary, Member 3); council 2 exists.
const OWN = 1;
const OTHER = 2;
const TOKEN_A = 'ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]';
const TOKEN_B = 'ExponentPushToken[bbbbbbbbbbbbbbbbbbbbbb]';
const ALERT = { title: 'Weather closure', body: 'The pancake breakfast moves indoors to the parish hall.' };

async function expectPrivilege(promise: Promise<unknown>, code: 'ADMIN_REQUIRED' | 'COUNCIL_ACCESS_DENIED') {
  expect(await expectRule(promise, code)).toBeInstanceOf(SecurityPrivilegeError);
}

/** A column straight from the backing store, bypassing the service. */
function rawMember(d: DriverUnderTest, db: DataService, id: number): Record<string, unknown> {
  if (d.name === 'memory') return (db as MemoryDataService).debugStore.rows('Member').find((m) => m.id === id)!;
  return openDatabases.at(-1)!.prepare('SELECT * FROM [Member] WHERE [id] = ?').get(id) as Record<string, unknown>;
}

function grantRole(d: DriverUnderTest, db: DataService, memberId: number, role: string): void {
  if (d.name === 'memory') {
    const store = (db as MemoryDataService).debugStore;
    store.insert('MemberRoles', { RoleID: store.rows('Role').find((r) => r.Role === role)!.id, MemberID: memberId });
  } else {
    openDatabases.at(-1)!.prepare('INSERT INTO [MemberRoles] ([RoleID], [MemberID]) SELECT [id], ? FROM [Role] WHERE [Role] = ?').run(memberId, role);
  }
}

/** An alert row written straight to the store, for the history window. */
function insertAlert(d: DriverUnderTest, db: DataService, memberId: number, sentAt: string): void {
  const row = { CouncilID: OWN, TargetMemberID: memberId, Title: 'Old', MessageBody: 'Old news', Priority: 'Low', SentAt: sentAt, IsRead: 0 };
  if (d.name === 'memory') (db as MemoryDataService).debugStore.insert('NotificationLog', row);
  else {
    openDatabases
      .at(-1)!
      .prepare(
        'INSERT INTO [NotificationLog] ([CouncilID], [TargetMemberID], [Title], [MessageBody], [Priority], [SentAt], [IsRead]) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .run(row.CouncilID, row.TargetMemberID, row.Title, row.MessageBody, row.Priority, row.SentAt, row.IsRead);
  }
}

/** Gives the member the first skill (self-service), returning its id. */
async function giveSkill(db: DataService, memberId: number): Promise<number> {
  const options = await db.memberProfiles.listOptions();
  const skillId = options.skills[0].id;
  await db.memberProfiles.updateExtensions(memberId, memberId, [{ skillId, skillLevelId: options.skillLevels[0].id }], [], null);
  return skillId;
}

/** A driver whose Alchemer post and log are test doubles. */
async function makeWith(d: DriverUnderTest, options: ConstructorParameters<typeof MemoryDataService>[0]): Promise<DataService> {
  const now = () => new Date(NOW);
  if (d.name === 'memory') {
    const db = new MemoryDataService({ now, ...options });
    await db.init();
    return db;
  }
  openDatabases.length = 0;
  const db = new SqliteDataService({ now, ...options });
  await db.init();
  return db;
}

describe('push and Alchemer helpers', () => {
  it('accepts Expo push tokens, clears on null or blank, and rejects anything else', () => {
    expect(cleanExpoPushToken(` ${TOKEN_A} `)).toBe(TOKEN_A);
    expect(cleanExpoPushToken('ExpoPushToken[xyz-123]')).toBe('ExpoPushToken[xyz-123]');
    expect(cleanExpoPushToken(null)).toBeNull();
    expect(cleanExpoPushToken('   ')).toBeNull();
    for (const bad of ['abc', 'ExponentPushToken[]', 'ExponentPushToken[a b]', `ExponentPushToken[${'x'.repeat(520)}]`, 42]) {
      expect(() => cleanExpoPushToken(bad)).toThrow();
    }
  });

  it('batches Expo messages 100 per request', () => {
    const message = (i: number): ExpoPushMessage => ({
      to: `ExponentPushToken[${i}]`,
      title: 't',
      body: 'b',
      priority: 'high',
      sound: 'default',
      data: { notificationLogId: i, councilId: 1 },
    });
    const requests = buildExpoPushRequests(Array.from({ length: 250 }, (_, i) => message(i)));
    expect(requests.map((r) => r.body.length)).toEqual([100, 100, 50]);
    expect(requests[0]).toMatchObject({ method: 'POST', url: EXPO_PUSH_ENDPOINT });
  });

  it('picks the last completed period of each form', () => {
    expect(supremeReportingPeriod('AnnualSurvey', NOW)).toEqual({ fromDate: '2025-01-01', toDate: '2025-12-31', label: '2025' });
    expect(supremeReportingPeriod('CouncilAudit', NOW)).toEqual({ fromDate: '2026-01-01', toDate: '2026-06-30', label: 'January-June 2026' });
    expect(supremeReportingPeriod('CouncilAudit', new Date(2026, 2, 1))).toEqual({
      fromDate: '2025-07-01',
      toDate: '2025-12-31',
      label: 'July-December 2025',
    });
  });

  it('accepts numeric survey ids only', () => {
    expect(cleanAlchemerSurveyId(' 123456 ')).toBe('123456');
    expect(cleanAlchemerSurveyId(123456)).toBe('123456');
    for (const bad of ['', 'abc', '12/34', '1'.repeat(101), null]) expect(() => cleanAlchemerSurveyId(bad)).toThrow();
  });

  it('compiles hours, donations and checks, and encodes them as an Alchemer v5 survey response', () => {
    const period = supremeReportingPeriod('CouncilAudit', NOW);
    const snapshot = compileSupremeSnapshot('CouncilAudit', period, {
      council: { id: 1, CouncilNumber: 15295, CouncilName: 'St. Jude' },
      eventTime: [
        { MemberID: 1, Hours: 2.25, category: 'Service' },
        { MemberID: 2, Hours: 1.5, category: 'Service' },
      ],
      activityTime: [{ MemberID: 1, Hours: 3, category: 'Faith Building' }],
      events: [{ Spend: 10.1 }, { Spend: null }],
      donations: [
        { DonationAmount: 20.1, kind: 'cash' },
        { DonationAmount: 30.2, kind: 'card' },
        { DonationAmount: 99, kind: 'item' },
      ],
      disbursements: [{ TotalAmount: 42.5 }, { TotalAmount: 7.25 }],
    });
    expect(snapshot).toMatchObject({
      volunteerHours: { events: 3.75, activities: 3, total: 6.75 },
      hoursByCategory: [
        { category: 'Faith Building', hours: 3 },
        { category: 'Service', hours: 3.75 },
      ],
      volunteers: 2,
      eventsHeld: 2,
      donations: { count: 3, cash: 20.1, electronic: 30.2, raised: 50.3, itemValue: 99 },
      eventSpend: 10.1,
      expenseChecks: { count: 2, total: 49.75 },
    });

    const request = buildAlchemerRequest('123456', { council_number: 15295, reporting_period: '2026-01-01 to 2026-06-30' });
    expect(request.method).toBe('POST');
    const url = new URL(request.url);
    expect(url.origin + url.pathname).toBe('https://api.alchemer.com/v5/survey/123456/surveyresponse');
    expect(url.searchParams.get('_method')).toBe('PUT');
    expect(url.searchParams.has('api_token')).toBe(true);
    expect(url.searchParams.has('api_token_secret')).toBe(true);
    const body = new URLSearchParams(request.body);
    expect(body.get('data[council_number][value]')).toBe('15295');
    expect(body.get('data[reporting_period][value]')).toBe('2026-01-01 to 2026-06-30');
    expect(body.get('status')).toBe('Complete');
  });

  it('gates alerts and syncs to council leadership', () => {
    const actor = (over: Partial<MemberWriteActor>): MemberWriteActor => ({ memberId: 9, councilId: OWN, memberType: 'Member', active: true, roles: [], ...over });
    for (const check of [mayDispatchCouncilAlerts, maySyncSupremeReports]) {
      expect(check(actor({}), OWN)).toBe(false);
      expect(check(actor({ roles: ['Grand Knight'] }), OWN)).toBe(false);
      expect(check(actor({ roles: ['Treasurer'] }), OWN)).toBe(true);
      expect(check(actor({ roles: ['Financial Secretary'] }), OWN)).toBe(true);
      expect(check(actor({ roles: ['Treasurer'] }), OTHER)).toBe(false);
      expect(check(actor({ roles: ['Treasurer'], active: false }), OWN)).toBe(false);
      expect(check(actor({ memberType: 'Admin' }), OWN)).toBe(true);
      expect(check(actor({ memberType: 'Admin' }), OTHER)).toBe(false);
      expect(check(actor({ memberType: 'Super Admin' }), OTHER)).toBe(true);
    }
  });
});

describe.each(drivers)('$name driver: device tokens and member alerts', (d) => {
  it('lets any member register, move and clear their device token, and never returns it from member reads', async () => {
    const db = await d.make();
    await db.notifications.registerDeviceToken(MEMBER.member, TOKEN_A);
    expect(rawMember(d, db, MEMBER.member).ExpoPushToken).toBe(TOKEN_A);

    const member = await db.members.get(MEMBER.member);
    expect(member).not.toHaveProperty('ExpoPushToken');
    expect((await db.members.listByCouncil(OWN)).some((m) => 'ExpoPushToken' in m)).toBe(false);
    expect(await db.members.getByEmail(member!.Email)).not.toHaveProperty('ExpoPushToken');
    expect(await db.members.update(MEMBER.member, MEMBER.member, { Phone: '503-555-0199' })).not.toHaveProperty('ExpoPushToken');

    // The same phone signed in as another member: the token follows the phone.
    await db.notifications.registerDeviceToken(MEMBER.admin, TOKEN_A);
    expect(rawMember(d, db, MEMBER.admin).ExpoPushToken).toBe(TOKEN_A);
    expect(rawMember(d, db, MEMBER.member).ExpoPushToken).toBeNull();

    await db.notifications.registerDeviceToken(MEMBER.admin, null);
    expect(rawMember(d, db, MEMBER.admin).ExpoPushToken).toBeNull();
  });

  it('rejects a malformed token or an unknown member', async () => {
    const db = await d.make();
    await expectRule(db.notifications.registerDeviceToken(MEMBER.member, 'not-a-token'), 'INVALID_INPUT');
    await expectRule(db.notifications.registerDeviceToken(999, TOKEN_A), 'MEMBER_NOT_FOUND');
    await expectRule(db.notifications.listMemberAlerts(999), 'MEMBER_NOT_FOUND');
  });

  it('lists only the member\'s own alerts of the trailing six months, newest first', async () => {
    const db = await d.make();
    insertAlert(d, db, MEMBER.member, '2026-03-19 12:00:00'); // just over six months before NOW
    insertAlert(d, db, MEMBER.member, '2026-03-21 12:00:00');
    insertAlert(d, db, MEMBER.member, '2026-09-01 12:00:00');
    insertAlert(d, db, MEMBER.admin, '2026-09-02 12:00:00');
    const alerts = await db.notifications.listMemberAlerts(MEMBER.member);
    expect(alerts.map((a) => a.SentAt)).toEqual(['2026-09-01 12:00:00', '2026-03-21 12:00:00']);
    expect(alerts.every((a) => a.TargetMemberID === MEMBER.member)).toBe(true);
  });
});

describe.each(drivers)('$name driver: high-priority alert dispatch', (d) => {
  it('logs one alert per recipient and pushes to registered devices through the Expo stub', async () => {
    const log = vi.fn();
    const db = await makeWith(d, { log });
    const skillId = await giveSkill(db, MEMBER.member);
    const packing = await shiftByName(db, 'Packing Shift'); // the Super Admin's signup
    await db.notifications.registerDeviceToken(MEMBER.member, TOKEN_A);
    const before = d.count(db, 'NotificationLog');

    const result = await db.notifications.dispatchHighPriorityAlert(MEMBER.admin, OWN, { skillIds: [skillId], shiftIds: [packing.id] }, ALERT);
    expect(result.recipientIds).toEqual([MEMBER.superAdmin, MEMBER.member]);
    expect(result.unreachableMemberIds).toEqual([MEMBER.superAdmin]);
    expect(d.count(db, 'NotificationLog')).toBe(before + 2);
    expect(result.logs[0]).toMatchObject({ CouncilID: OWN, Title: ALERT.title, MessageBody: ALERT.body, Priority: 'High', IsRead: 0 });

    expect(result.pushRequests).toHaveLength(1);
    expect(result.pushRequests[0].body).toEqual([
      {
        to: TOKEN_A,
        title: ALERT.title,
        body: ALERT.body,
        priority: 'high',
        sound: 'default',
        data: { notificationLogId: result.logs[1].id, councilId: OWN },
      },
    ]);
    expect(log).toHaveBeenCalledWith('[expo-push]', JSON.stringify(result.pushRequests[0], null, 2));

    const mine = await db.notifications.listMemberAlerts(MEMBER.member);
    expect(mine.map((a) => a.id)).toEqual([result.logs[1].id]);
  });

  it('lets a Treasurer alert their own council, with the priority they choose', async () => {
    const db = await d.make();
    const skillId = await giveSkill(db, MEMBER.admin);
    grantRole(d, db, MEMBER.member, 'Treasurer');
    const result = await db.notifications.dispatchHighPriorityAlert(MEMBER.member, OWN, { skillIds: [skillId] }, { ...ALERT, priority: 'Medium' });
    expect(result.recipientIds).toEqual([MEMBER.admin]);
    expect(result.logs[0].Priority).toBe('Medium');
    expect(result.pushRequests).toEqual([]);
  });

  it('refuses members without leadership and other councils, writing nothing', async () => {
    const db = await d.make();
    const skillId = await giveSkill(db, MEMBER.member);
    await expectPrivilege(db.notifications.dispatchHighPriorityAlert(MEMBER.member, OWN, { skillIds: [skillId] }, ALERT), 'ADMIN_REQUIRED');
    await expectPrivilege(db.notifications.dispatchHighPriorityAlert(MEMBER.admin, OTHER, { skillIds: [skillId] }, ALERT), 'COUNCIL_ACCESS_DENIED');
    await expectRule(db.notifications.dispatchHighPriorityAlert(999, OWN, { skillIds: [skillId] }, ALERT), 'MEMBER_NOT_FOUND');
    expect(d.count(db, 'NotificationLog')).toBe(0);
  });

  it('validates filters and payload, and needs someone to alert', async () => {
    const db = await d.make();
    const skillId = await giveSkill(db, MEMBER.member);
    const send = (filters: object, payload: object = ALERT, councilId = OWN) =>
      db.notifications.dispatchHighPriorityAlert(MEMBER.superAdmin, councilId, filters, payload as typeof ALERT);
    await expectRule(send({}), 'INVALID_INPUT');
    await expectRule(send({ skillIds: [0] }), 'INVALID_INPUT');
    await expectRule(send({ skillIds: [9999] }), 'INVALID_INPUT');
    await expectRule(send({ shiftIds: [9999] }), 'INVALID_INPUT');
    await expectRule(send({ skillIds: [skillId] }, { ...ALERT, title: ' ' }), 'INVALID_INPUT');
    await expectRule(send({ skillIds: [skillId] }, { ...ALERT, body: 'x'.repeat(2001) }), 'INVALID_INPUT');
    await expectRule(send({ skillIds: [skillId] }, { ...ALERT, priority: 'Urgent' }), 'INVALID_INPUT');
    await expectRule(send({ skillIds: [skillId] }, ALERT, 9999), 'INVALID_INPUT');
    // The skill's only holder belongs to council 1.
    await expectRule(send({ skillIds: [skillId] }, ALERT, OTHER), 'NO_RECIPIENTS');
    expect(d.count(db, 'NotificationLog')).toBe(0);
  });

  it('keeps sent alerts when their council is deleted', async () => {
    const db = await d.make();
    const skillId = await giveSkill(db, MEMBER.member);
    await db.notifications.dispatchHighPriorityAlert(MEMBER.admin, OWN, { skillIds: [skillId] }, ALERT);
    const err = await expectRule(db.councils.remove(MEMBER.superAdmin, OWN), 'RECORD_IN_USE');
    expect(err.details.usage).toContainEqual({ table: 'NotificationLog', column: 'CouncilID', count: 1 });
  });
});

describe.each(drivers)('$name driver: Supreme Council Alchemer sync', (d) => {
  it('compiles the Form 1295 snapshot from the ledgers and records a successful sync', async () => {
    const log = vi.fn();
    const db = await makeWith(d, { log });
    const [activity] = await db.activities.listByCouncil(OWN);
    await db.activityTime.logHours(MEMBER.member, activity.id, 2.5, '2026-04-10');
    await db.activityTime.logHours(MEMBER.admin, activity.id, 1.25, '2026-06-30');
    await db.activityTime.logHours(MEMBER.admin, activity.id, 4, '2026-07-01'); // after the period
    const cash = (await db.donations.listMethods(OWN)).find((m) => m.kind === 'cash')!;
    const [type] = await db.donations.listTypes(OWN);
    await db.donations.record(MEMBER.admin, { CouncilID: OWN, DonationMethodID: cash.method.id, DonationTypeID: type.id, DonationAmount: 20, DonationDate: '2026-05-01' });

    const result = await db.supreme.syncAlchemerReport(MEMBER.admin, OWN, 'CouncilAudit', '123456');
    expect(result.error).toBeNull();
    expect(result.sync).toMatchObject({ CouncilID: OWN, FormType: 'CouncilAudit', SyncedByID: MEMBER.admin, AlchemerSurveyID: '123456', Status: 'Success' });
    expect(d.count(db, 'SupremeReportingSync')).toBe(1);
    expect(result.snapshot).toMatchObject({
      councilNumber: 15295,
      period: { fromDate: '2026-01-01', toDate: '2026-06-30' },
      volunteerHours: { events: 0, activities: 3.75, total: 3.75 },
      volunteers: 2,
      donations: { count: 1, cash: 20, raised: 20 },
      expenseChecks: { count: 0, total: 0 },
    });
    expect(Object.keys(result.request.answers)).toEqual([...ALCHEMER_SHORTNAMES.CouncilAudit]);
    expect(result.request.answers).toMatchObject({ council_number: 15295, receipts_cash: 20, receipts_total: 20 });
    expect(log).toHaveBeenCalledWith('[alchemer]', JSON.stringify(result.request, null, 2));
  });

  it('records a failed post as a Failed sync instead of rejecting', async () => {
    const db = await makeWith(d, { postAlchemer: async () => Promise.reject(new Error('503 Service Unavailable')) });
    const result = await db.supreme.syncAlchemerReport(MEMBER.superAdmin, OTHER, 'AnnualSurvey', '777');
    expect(result.sync.Status).toBe('Failed');
    expect(result.error).toBe('503 Service Unavailable');
    expect(Object.keys(result.request.answers)).toEqual([...ALCHEMER_SHORTNAMES.AnnualSurvey]);
    expect(d.count(db, 'SupremeReportingSync')).toBe(1);

    const rejected = await makeWith(d, { postAlchemer: async () => ({ result_ok: false, message: 'Survey is closed' }) });
    const closed = await rejected.supreme.syncAlchemerReport(MEMBER.admin, OWN, 'AnnualSurvey', '777');
    expect(closed).toMatchObject({ sync: { Status: 'Failed' }, error: 'Survey is closed' });
  });

  it('is limited to council leadership and validates its inputs, writing nothing', async () => {
    const db = await d.make();
    await expectPrivilege(db.supreme.syncAlchemerReport(MEMBER.member, OWN, 'AnnualSurvey', '123'), 'ADMIN_REQUIRED');
    await expectPrivilege(db.supreme.syncAlchemerReport(MEMBER.admin, OTHER, 'AnnualSurvey', '123'), 'COUNCIL_ACCESS_DENIED');
    await expectRule(db.supreme.syncAlchemerReport(MEMBER.admin, OWN, 'AnnualSurvey', 'abc'), 'INVALID_INPUT');
    await expectRule(db.supreme.syncAlchemerReport(MEMBER.admin, OWN, 'Form99' as 'AnnualSurvey', '123'), 'INVALID_INPUT');
    await expectRule(db.supreme.syncAlchemerReport(MEMBER.superAdmin, 9999, 'AnnualSurvey', '123'), 'INVALID_INPUT');
    expect(d.count(db, 'SupremeReportingSync')).toBe(0);

    grantRole(d, db, MEMBER.member, 'Financial Secretary');
    expect((await db.supreme.syncAlchemerReport(MEMBER.member, OWN, 'AnnualSurvey', '123')).sync.Status).toBe('Success');
  });
});
