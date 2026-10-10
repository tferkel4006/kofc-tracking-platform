// Sprint 7B: volunteer time quarantine (Schema 61) - the 5/5 over-reporting guards, the +1 hour shift padding gate and the
// leadership clearance desk.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  canReviewVolunteerQuarantine,
  FEATURE_FLAG_NAMES,
  isQuarantinedHours,
  isQuarantineExempt,
  mayReviewQuarantine,
  quarantineActivityKey,
  quarantineReasons,
  type DataService,
  type MemberWriteActor,
} from '@kofc/shared';
import { drivers, expectRule, MEMBER, shiftByName } from './helpers';

const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');
const DAY = '2026-09-15';
const keys = (...ids: number[]) => new Set(ids.map((id) => quarantineActivityKey('MANUAL', id)));

describe('Schema 61', () => {
  it('adds VolunteerQuarantine and the feature flag, and bumps the phone schema version', () => {
    const schema = read('Schema.sql');
    expect(schema).toContain('CREATE TABLE [VolunteerQuarantine]');
    for (const column of ['[user_id] INT NOT NULL', '[activity_type] VARCHAR(10) NOT NULL', '[activity_id] INT NOT NULL', '[hours_reported] DECIMAL(5,2) NOT NULL', '[date_logged] DATETIME NOT NULL', '[quarantine_reason] VARCHAR(500) NOT NULL', "[clearance_status] VARCHAR(10) NOT NULL DEFAULT 'PENDING'"]) {
      expect(schema).toContain(column);
    }
    expect(schema).toContain('ALTER TABLE [Council] ADD [feature_volunteer_quarantine] BIT NOT NULL DEFAULT 1;');
    expect(read('apps/mobile/services/drivers/sqlite.ts')).toMatch(/const SCHEMA_VERSION = (6[1-9]|[7-9]\d);/);
    expect(FEATURE_FLAG_NAMES).toContain('feature_volunteer_quarantine');
  });
});

describe('quarantine rules', () => {
  it('holds a sixth activity in a day, but not another entry on an activity already logged that day', () => {
    const base = { activityType: 'MANUAL' as const, hours: 1, otherHoursSameActivity: 0 };
    expect(quarantineReasons({ ...base, activityId: 5, dayActivityKeys: keys(1, 2, 3, 4) })).toEqual([]);
    expect(quarantineReasons({ ...base, activityId: 6, dayActivityKeys: keys(1, 2, 3, 4, 5) })[0]).toMatch(/More than 5 activities in one day/);
    expect(quarantineReasons({ ...base, activityId: 1, dayActivityKeys: keys(1, 2, 3, 4, 5) })).toEqual([]);
    // A shift and an activity with the same id are different activities.
    expect(quarantineActivityKey('SHIFT', 1)).not.toBe(quarantineActivityKey('MANUAL', 1));
  });

  it('holds more than 5.0 hours against one activity in a day, counting the day\'s other entries on it', () => {
    const base = { activityType: 'MANUAL' as const, activityId: 1, dayActivityKeys: keys(1) };
    expect(quarantineReasons({ ...base, hours: 5, otherHoursSameActivity: 0 })).toEqual([]);
    expect(quarantineReasons({ ...base, hours: 5.25, otherHoursSameActivity: 0 })[0]).toMatch(/More than 5.0 hours/);
    expect(quarantineReasons({ ...base, hours: 2, otherHoursSameActivity: 3.25 })[0]).toMatch(/5.25 hours/);
  });

  it('holds a shift report more than 1.0 hour over the scheduled length', () => {
    const base = { activityType: 'SHIFT' as const, activityId: 9, dayActivityKeys: new Set<string>() };
    expect(quarantineReasons({ ...base, hours: 4, scheduledHours: 3 })).toEqual([]);
    const reasons = quarantineReasons({ ...base, hours: 4.25, scheduledHours: 3 });
    expect(reasons).toHaveLength(1);
    expect(reasons[0]).toMatch(/More than 1.0 hour over the scheduled shift/);
    // A long shift: 6 hours scheduled, 6.5 reported - within the padding but over the 5-hour rule.
    expect(quarantineReasons({ ...base, hours: 6.5, scheduledHours: 6 })[0]).toMatch(/More than 5.0 hours/);
  });

  it('exempts Admins, Super Admins, elected officers, Trustees and the event owner - not appointed officers', () => {
    expect(isQuarantineExempt({ memberType: 'Admin', roles: [] })).toBe(true);
    expect(isQuarantineExempt({ memberType: 'Super Admin', roles: [] })).toBe(true);
    expect(isQuarantineExempt({ memberType: 'Member', roles: ['Grand Knight'] })).toBe(true);
    expect(isQuarantineExempt({ memberType: 'Member', roles: ['Warden'] })).toBe(true);
    expect(isQuarantineExempt({ memberType: 'Member', roles: ['Trustee 2'] })).toBe(true);
    expect(isQuarantineExempt({ memberType: 'Member', roles: [], ownsEvent: true })).toBe(true);
    expect(isQuarantineExempt({ memberType: 'Member', roles: ['Financial Secretary'] })).toBe(false);
    expect(isQuarantineExempt({ memberType: 'Member', roles: ['Member'] })).toBe(false);
  });

  it('lets the council\'s Grand Knight, Deputy Grand Knight and Admins review, and any Super Admin', () => {
    const actor = (memberType: string, roles: string[], councilId = 1, active = true): MemberWriteActor => ({ memberId: 50, councilId, memberType, active, roles });
    expect(mayReviewQuarantine(actor('Member', ['Grand Knight']), 1)).toBe(true);
    expect(mayReviewQuarantine(actor('Member', ['Deputy Grand Knight']), 1)).toBe(true);
    expect(mayReviewQuarantine(actor('Admin', []), 1)).toBe(true);
    expect(mayReviewQuarantine(actor('Super Admin', [], 2), 1)).toBe(true);
    expect(mayReviewQuarantine(actor('Member', ['Treasurer']), 1)).toBe(false);
    expect(mayReviewQuarantine(actor('Member', ['Grand Knight'], 2), 1)).toBe(false);
    expect(mayReviewQuarantine(actor('Admin', [], 1, false), 1)).toBe(false);
    const session = (memberType: 'Member' | 'Admin' | 'Super Admin', roles: string[], councilId = 1) => ({ memberId: 50, councilId, memberType, isOfficer: roles.length > 0, roles });
    expect(canReviewVolunteerQuarantine(session('Member', ['Deputy Grand Knight']), 1)).toBe(true);
    expect(canReviewVolunteerQuarantine(session('Admin', [], 2), 1)).toBe(false);
    expect(canReviewVolunteerQuarantine(session('Member', ['Recorder']), 1)).toBe(false);
  });
});

const totalHours = async (db: DataService) => (await db.reports.monthlySummary(1, 2026, 9)).laborHours.total;

describe.each(drivers)('$name driver: volunteer time quarantine', (d) => {
  it('holds a shift report more than 1 hour over the scheduled 3 hours, out of every total', async () => {
    const db = await d.make();
    const shift = await shiftByName(db, 'Leaf Raking'); // 08:00-11:00, member 3 signed up
    const before = await totalHours(db);
    const held = await db.eventTime.logHours(MEMBER.member, shift.id, 4.25, 'stayed to bag leaves');
    expect(isQuarantinedHours(held)).toBe(true);
    if (!isQuarantinedHours(held)) return;
    expect(held.quarantined).toMatchObject({
      user_id: MEMBER.member,
      activity_type: 'SHIFT',
      activity_id: shift.id,
      hours_reported: 4.25,
      scheduled_hours: 3,
      clearance_status: 'PENDING',
    });
    expect(held.quarantined.quarantine_reason).toMatch(/1.0 hour over the scheduled shift/);
    expect(d.count(db, 'EventTime')).toBe(0);
    expect(await totalHours(db)).toBe(before);
  });

  it('logs a report within the padding directly, and a new report replaces a still-pending one', async () => {
    const db = await d.make();
    const shift = await shiftByName(db, 'Leaf Raking');
    await db.eventTime.logHours(MEMBER.member, shift.id, 6);
    expect(d.count(db, 'VolunteerQuarantine')).toBe(1);
    const logged = await db.eventTime.logHours(MEMBER.member, shift.id, 4);
    expect(logged).toMatchObject({ ShiftID: shift.id, MemberID: MEMBER.member, Hours: 4 });
    expect(d.count(db, 'VolunteerQuarantine')).toBe(0);
    expect(d.count(db, 'EventTime')).toBe(1);
  });

  it('exempts an Admin from the padding gate', async () => {
    const db = await d.make();
    const shift = await shiftByName(db, 'Leaf Raking');
    await db.events.signupForShift(MEMBER.admin, shift.id);
    const logged = await db.eventTime.logHours(MEMBER.admin, shift.id, 8);
    expect(isQuarantinedHours(logged)).toBe(false);
    expect(d.count(db, 'VolunteerQuarantine')).toBe(0);
  });

  it('holds more than 5.0 hours on one activity in a day, counting earlier entries that day', async () => {
    const db = await d.make();
    await db.activityTime.logHours(MEMBER.member, 3, 3, DAY);
    await db.activityTime.logHours(MEMBER.member, 4, 2, DAY);
    const held = await db.activityTime.logHours(MEMBER.member, 3, 2.25, DAY, 'sorted the pantry');
    expect(isQuarantinedHours(held)).toBe(true);
    expect(d.count(db, 'ActivityTime')).toBe(2);
    expect((await db.activityTime.listByActivity(3)).totalHours).toBe(3);
    // A big single entry is held whole; the same hours on another day log.
    expect(isQuarantinedHours(await db.activityTime.logHours(MEMBER.member, 5, 7, DAY))).toBe(true);
    expect(isQuarantinedHours(await db.activityTime.logHours(MEMBER.member, 3, 2.25, '2026-09-16'))).toBe(false);
  });

  it('holds a sixth activity in one day, counting shifts by their date', async () => {
    const db = await d.make();
    const shift = await shiftByName(db, 'Leaf Raking');
    await db.eventTime.logHours(MEMBER.member, shift.id, 3);
    for (const activityId of [1, 2, 3, 4]) {
      expect(isQuarantinedHours(await db.activityTime.logHours(MEMBER.member, activityId, 1, shift.ShiftDate))).toBe(false);
    }
    const sixth = await db.activityTime.logHours(MEMBER.member, 5, 1, shift.ShiftDate);
    expect(isQuarantinedHours(sixth)).toBe(true);
    if (isQuarantinedHours(sixth)) expect(sixth.quarantined.quarantine_reason).toMatch(/activity 6 reported for the day/);
    // Another entry on an activity already logged that day is not a new activity.
    expect(isQuarantinedHours(await db.activityTime.logHours(MEMBER.member, 1, 1, shift.ShiftDate))).toBe(false);
  });

  it('holds rapid taps past 5 hours in one growing entry and keeps the logged 5 hours', async () => {
    const db = await d.make();
    await db.activityTime.logHours(MEMBER.member, 3, 5, DAY);
    const first = await db.activityTime.addQuarterHour(MEMBER.member, 3, DAY);
    expect(isQuarantinedHours(first)).toBe(true);
    const second = await db.activityTime.addQuarterHour(MEMBER.member, 3, DAY);
    expect(isQuarantinedHours(second) && second.quarantined.hours_reported).toBe(0.5);
    expect(d.count(db, 'VolunteerQuarantine')).toBe(1);
    expect((await db.activityTime.listByActivity(3)).totalHours).toBe(5);
  });

  it('lists pending entries on the desk and clears one into the totals', async () => {
    const db = await d.make();
    const before = await totalHours(db);
    await db.activityTime.logHours(MEMBER.member, 3, 6, DAY, 'drove the food truck twice');
    const [entry] = await db.volunteerQuarantine.listPending(MEMBER.admin, 1);
    expect(entry).toMatchObject({ activityLabel: 'Food drive', description: 'drove the food truck twice' });
    expect(entry.memberName).toMatch(/\w+ \w+/);
    const cleared = await db.volunteerQuarantine.clear(MEMBER.admin, entry.row.id);
    expect(cleared).toMatchObject({ clearance_status: 'APPROVED', reviewed_by_member_id: MEMBER.admin });
    expect(cleared.cleared_time_id).toBeGreaterThan(0);
    expect(await totalHours(db)).toBe(before + 6);
    expect(await db.volunteerQuarantine.listPending(MEMBER.admin, 1)).toEqual([]);
    await expectRule(db.volunteerQuarantine.clear(MEMBER.admin, entry.row.id), 'QUARANTINE_STATUS_CONFLICT');
  });

  it('clears a held shift report into EventTime', async () => {
    const db = await d.make();
    const shift = await shiftByName(db, 'Leaf Raking');
    const held = await db.eventTime.logHours(MEMBER.member, shift.id, 5, 'set up and tore down');
    if (!isQuarantinedHours(held)) throw new Error('expected the report to be held');
    const [entry] = await db.volunteerQuarantine.listPending(MEMBER.superAdmin, 1);
    expect(entry.activityLabel).toContain('Leaf Raking');
    await db.volunteerQuarantine.clear(MEMBER.superAdmin, held.quarantined.id);
    const turnout = await db.events.listTurnout(shift.EventID);
    expect(turnout.find((t) => t.signup.MemberID === MEMBER.member && t.shift.id === shift.id)?.hoursLogged).toBe(5);
  });

  it('deletes fraudulent time: REJECTED, and the hours never count', async () => {
    const db = await d.make();
    const before = await totalHours(db);
    const held = await db.activityTime.logHours(MEMBER.member, 3, 12, DAY);
    if (!isQuarantinedHours(held)) throw new Error('expected the entry to be held');
    const rejected = await db.volunteerQuarantine.reject(MEMBER.admin, held.quarantined.id);
    expect(rejected).toMatchObject({ clearance_status: 'REJECTED', reviewed_by_member_id: MEMBER.admin, cleared_time_id: null });
    expect(d.count(db, 'ActivityTime')).toBe(0);
    expect(await totalHours(db)).toBe(before);
    await expectRule(db.volunteerQuarantine.reject(MEMBER.admin, held.quarantined.id), 'QUARANTINE_STATUS_CONFLICT');
    await expectRule(db.volunteerQuarantine.clear(MEMBER.admin, 999), 'RECORD_NOT_FOUND');
  });

  it('refuses a plain member at the desk, writing nothing', async () => {
    const db = await d.make();
    const held = await db.activityTime.logHours(MEMBER.member, 3, 6, DAY);
    if (!isQuarantinedHours(held)) throw new Error('expected the entry to be held');
    await expectRule(db.volunteerQuarantine.listPending(MEMBER.member, 1), 'ADMIN_REQUIRED');
    await expectRule(db.volunteerQuarantine.clear(MEMBER.member, held.quarantined.id), 'ADMIN_REQUIRED');
    await expectRule(db.volunteerQuarantine.reject(MEMBER.member, held.quarantined.id), 'ADMIN_REQUIRED');
    expect(d.count(db, 'ActivityTime')).toBe(0);
    await expectRule(db.volunteerQuarantine.listPending(MEMBER.admin, 999), 'INVALID_INPUT');
  });

  it('logs everything directly and closes the desk while the flag is off', async () => {
    const db = await d.make();
    await db.councils.setFeatureFlags(MEMBER.superAdmin, 1, { feature_volunteer_quarantine: false });
    expect(isQuarantinedHours(await db.activityTime.logHours(MEMBER.member, 3, 8, DAY))).toBe(false);
    expect(d.count(db, 'VolunteerQuarantine')).toBe(0);
    await expectRule(db.volunteerQuarantine.listPending(MEMBER.admin, 1), 'FEATURE_DISABLED');
  });
});
