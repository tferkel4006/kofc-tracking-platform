// Sprint 7C: Council Wide Settings and Platform Settings (Schema 62) - the configurable volunteer time limits, the
// inactivity window, the Super Admins' universal limits and the plain-English button labels.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  canEditCouncilWideSettings,
  cleanCouncilWideSettings,
  cleanPlatformSettings,
  cleanPrayerIntentionText,
  councilWideSettings,
  isQuarantinedHours,
  mayEditCouncilWideSettings,
  planInactivitySweep,
  platformSettings,
  PORTAL_NAV_GROUPS,
  portalAreas,
  quarantineActivityKey,
  quarantineReasons,
  shiftDefaultLengthHours,
  TREASURER_CODE_EXPENSE_LABEL,
  type MemberWriteActor,
} from '@kofc/shared';
import { TABLES } from '../apps/web/services/generated/schema.generated';
import { drivers, expectRule, MEMBER, shiftByName } from './helpers';

const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');
const DAY = '2026-09-15';
const keys = (...ids: number[]) => new Set(ids.map((id) => quarantineActivityKey('MANUAL', id)));

describe('Schema 62', () => {
  it('adds the four Council columns and PlatformSettings, and bumps the phone schema version', () => {
    const schema = read('Schema.sql');
    expect(schema).toContain('ALTER TABLE [Council] ADD [quarantine_max_daily_activities] INT NOT NULL DEFAULT 5;');
    expect(schema).toContain('ALTER TABLE [Council] ADD [quarantine_max_single_hours] DECIMAL(5,2) NOT NULL DEFAULT 5.0;');
    expect(schema).toContain('ALTER TABLE [Council] ADD [max_shift_padding_hours] DECIMAL(5,2) NOT NULL DEFAULT 1.0;');
    expect(schema).toContain('ALTER TABLE [Council] ADD [inactivity_threshold_days] INT NOT NULL DEFAULT 365;');
    expect(schema).toContain('CREATE TABLE [PlatformSettings]');
    expect(TABLES.PlatformSettings.columns.map((c) => c.name)).toEqual(['id', 'oral_history_max_seconds', 'diary_text_max_length', 'prayer_intention_max_length']);
    expect(read('Seed.sql')).toMatch(/INSERT INTO \[PlatformSettings\][^;]*VALUES \(1, 900, 4000, 500\);/);
    expect(read('apps/mobile/services/drivers/sqlite.ts')).toMatch(/const SCHEMA_VERSION = (6[2-9]|[7-9]\d);/);
  });
});

describe('council wide settings (pure)', () => {
  it('reads defaults for missing values', () => {
    expect(councilWideSettings(null)).toEqual({
      quarantine_max_daily_activities: 5,
      quarantine_max_single_hours: 5,
      max_shift_padding_hours: 1,
      inactivity_threshold_days: 365,
    });
    expect(councilWideSettings({ quarantine_max_daily_activities: 3, inactivity_threshold_days: null }).quarantine_max_daily_activities).toBe(3);
  });

  it('cleans ranges, quarter hours, unknown and empty input', () => {
    expect(cleanCouncilWideSettings({ quarantine_max_single_hours: 4.75, max_shift_padding_hours: 0 })).toEqual({ quarantine_max_single_hours: 4.75, max_shift_padding_hours: 0 });
    expect(() => cleanCouncilWideSettings({ quarantine_max_single_hours: 4.1 })).toThrow(/multiple of 0.25/);
    expect(() => cleanCouncilWideSettings({ quarantine_max_daily_activities: 0 })).toThrow(/from 1 to 24/);
    expect(() => cleanCouncilWideSettings({ inactivity_threshold_days: 29 })).toThrow(/from 30 to 3,650/);
    expect(() => cleanCouncilWideSettings({ inactivity_threshold_days: 400.5 })).toThrow(/whole number/);
    expect(() => cleanCouncilWideSettings({ base_dues_rate: 10 })).toThrow(/Unknown council setting/);
    expect(() => cleanCouncilWideSettings({})).toThrow(/at least one/);
  });

  it("lets the council's Admins and officers edit, and any Super Admin", () => {
    const actor = (memberType: string, officer: boolean, councilId = 1, active = true): MemberWriteActor => ({ memberId: 50, councilId, memberType, active, officer, roles: [] });
    expect(mayEditCouncilWideSettings(actor('Admin', false), 1)).toBe(true);
    expect(mayEditCouncilWideSettings(actor('Member', true), 1)).toBe(true);
    expect(mayEditCouncilWideSettings(actor('Super Admin', false, 2), 1)).toBe(true);
    expect(mayEditCouncilWideSettings(actor('Member', false), 1)).toBe(false);
    expect(mayEditCouncilWideSettings(actor('Member', true, 2), 1)).toBe(false);
    expect(mayEditCouncilWideSettings(actor('Member', true, 1, false), 1)).toBe(false);
  });

  it('feeds the council limits into the quarantine guards', () => {
    const limits = { quarantine_max_daily_activities: 2, quarantine_max_single_hours: 3, max_shift_padding_hours: 0.5 };
    const manual = { activityType: 'MANUAL' as const, hours: 1, otherHoursSameActivity: 0 };
    expect(quarantineReasons({ ...manual, activityId: 3, dayActivityKeys: keys(1, 2) }, limits)[0]).toMatch(/More than 2 activities in one day/);
    expect(quarantineReasons({ ...manual, activityId: 3, dayActivityKeys: keys(1) }, limits)).toEqual([]);
    expect(quarantineReasons({ ...manual, activityId: 1, hours: 3.25, dayActivityKeys: keys(1) }, limits)[0]).toMatch(/More than 3.0 hours/);
    const shift = { activityType: 'SHIFT' as const, activityId: 9, dayActivityKeys: new Set<string>(), scheduledHours: 2 };
    expect(quarantineReasons({ ...shift, hours: 2.5 }, limits)).toEqual([]);
    expect(quarantineReasons({ ...shift, hours: 2.75 }, limits)[0]).toMatch(/More than 0.5 hours over the scheduled shift/);
    // Left out, the limits are the Sprint 7B defaults.
    expect(quarantineReasons({ ...shift, hours: 3, scheduledHours: 2 })).toEqual([]);
  });

  it('uses the council window in the inactivity sweep', () => {
    const input = {
      members: [{ id: 7, StatusID: 1, MemberTypeID: 1, DateJoinedCouncil: '2026-01-01' }],
      statuses: [{ id: 1, Status: 'Active' }],
      memberTypes: [{ id: 1, Type: 'Member' }],
      logs: [],
      today: '2026-10-10',
    };
    expect(planInactivitySweep(input)).toEqual([]);
    expect(planInactivitySweep({ ...input, thresholdDays: 90 })).toEqual([7]);
  });
});

describe('platform settings (pure)', () => {
  it('fills defaults, refuses values past the column sizes, and applies the prayer limit', () => {
    expect(platformSettings(undefined)).toEqual({ id: 1, oral_history_max_seconds: 900, diary_text_max_length: 4000, prayer_intention_max_length: 500 });
    expect(cleanPlatformSettings({ oral_history_max_seconds: 600 })).toEqual({ oral_history_max_seconds: 600 });
    expect(() => cleanPlatformSettings({ prayer_intention_max_length: 501 })).toThrow(/from 50 to 500/);
    expect(() => cleanPlatformSettings({ diary_text_max_length: 4001 })).toThrow(/from 100 to 4,000/);
    expect(() => cleanPlatformSettings({ oral_history_max_seconds: 30 })).toThrow(/from 60 to 3,600/);
    expect(() => cleanPlatformSettings({ tenant_type: 'KOFC' })).toThrow(/Unknown platform setting/);
    expect(cleanPrayerIntentionText('x'.repeat(60), 100)).toHaveLength(60);
    expect(() => cleanPrayerIntentionText('x'.repeat(101), 100)).toThrow(/at most 100/);
    // A limit above the column size is never honoured.
    expect(() => cleanPrayerIntentionText('x'.repeat(501), 900)).toThrow(/at most 500/);
  });
});

describe.each(drivers)('$name driver: council wide settings', (d) => {
  it('saves the settings for Admins and Super Admins only', async () => {
    const db = await d.make();
    const saved = await db.councils.setCouncilWideSettings(MEMBER.admin, 1, { quarantine_max_daily_activities: 3, inactivity_threshold_days: 90 });
    expect(saved).toMatchObject({ quarantine_max_daily_activities: 3, inactivity_threshold_days: 90, quarantine_max_single_hours: 5, max_shift_padding_hours: 1 });
    await expectRule(db.councils.setCouncilWideSettings(MEMBER.member, 1, { inactivity_threshold_days: 60 }), 'ADMIN_REQUIRED');
    await expectRule(db.councils.setCouncilWideSettings(MEMBER.admin, 1, { quarantine_max_single_hours: 2.2 }), 'INVALID_INPUT');
    await expectRule(db.councils.setCouncilWideSettings(MEMBER.superAdmin, 9999, { inactivity_threshold_days: 60 }), 'RECORD_NOT_FOUND');
    expect((await db.councils.setCouncilWideSettings(MEMBER.superAdmin, 1, { max_shift_padding_hours: 0.25 })).max_shift_padding_hours).toBe(0.25);
  });

  it('holds hours past the council limits, not the old fixed ones', async () => {
    const db = await d.make();
    await db.councils.setCouncilWideSettings(MEMBER.admin, 1, { quarantine_max_single_hours: 2, quarantine_max_daily_activities: 1 });
    expect(isQuarantinedHours(await db.activityTime.logHours(MEMBER.member, 3, 2, DAY))).toBe(false);
    expect(isQuarantinedHours(await db.activityTime.logHours(MEMBER.member, 3, 0.25, DAY))).toBe(true);
    expect(isQuarantinedHours(await db.activityTime.logHours(MEMBER.member, 4, 0.5, DAY))).toBe(true);
    // Raising the limits lets the same entries through.
    await db.councils.setCouncilWideSettings(MEMBER.admin, 1, { quarantine_max_single_hours: 8, quarantine_max_daily_activities: 10 });
    expect(isQuarantinedHours(await db.activityTime.logHours(MEMBER.member, 5, 6, DAY))).toBe(false);
  });

  it('holds a shift report past the council padding allowance', async () => {
    const db = await d.make();
    const shift = await shiftByName(db, 'Leaf Raking');
    await db.councils.setCouncilWideSettings(MEMBER.admin, 1, { max_shift_padding_hours: 0 });
    const scheduled = shiftDefaultLengthHours(shift);
    const held = await db.eventTime.logHours(MEMBER.member, shift.id, scheduled + 0.25);
    expect(isQuarantinedHours(held)).toBe(true);
    if (isQuarantinedHours(held)) expect(held.quarantined.quarantine_reason).toMatch(/over the scheduled shift/);
  });

  it('sweeps on the council window', async () => {
    const db = await d.make();
    expect(await db.members.sweepInactive(MEMBER.admin, 1)).toEqual([]);
    await db.councils.setCouncilWideSettings(MEMBER.admin, 1, { inactivity_threshold_days: 30 });
    const swept = await db.members.sweepInactive(MEMBER.admin, 1);
    expect(swept.every((m) => m.CouncilID === 1 && m.StatusID === 2)).toBe(true);
  });

  it('keeps the platform settings for Super Admins and applies the prayer limit', async () => {
    const db = await d.make();
    expect(await db.councils.getPlatformSettings()).toEqual({ id: 1, oral_history_max_seconds: 900, diary_text_max_length: 4000, prayer_intention_max_length: 500 });
    await expectRule(db.councils.setPlatformSettings(MEMBER.admin, { oral_history_max_seconds: 600 }), 'SUPER_ADMIN_REQUIRED');
    const saved = await db.councils.setPlatformSettings(MEMBER.superAdmin, { oral_history_max_seconds: 600, prayer_intention_max_length: 60 });
    expect(saved).toMatchObject({ oral_history_max_seconds: 600, prayer_intention_max_length: 60, diary_text_max_length: 4000 });
    expect(await db.councils.getPlatformSettings()).toEqual(saved);
    await expectRule(db.prayers.addIntention(MEMBER.member, 1, 'x'.repeat(61)), 'INVALID_INPUT');
  });
});

describe('Council Wide Settings page and plain-English labels', () => {
  it('puts the page in the Setup pillar for Admins and officers only', () => {
    const base = { memberId: 9, councilId: 1, isOfficer: false };
    expect(canEditCouncilWideSettings({ ...base, memberType: 'Member' })).toBe(false);
    expect(canEditCouncilWideSettings({ ...base, memberType: 'Member', isOfficer: true })).toBe(true);
    expect(portalAreas({ ...base, memberType: 'Admin' })).toContain('setup/council-settings');
    expect(PORTAL_NAV_GROUPS.find((g) => g.id === 'setup')!.items).toContain('setup/council-settings');
    const page = read('apps/web/app/setup/council-settings/page.tsx');
    expect(page).toContain('Council Wide Settings');
    expect(page).toContain('db.councils.setCouncilWideSettings');
    expect(read('apps/web/app/lookups/page.tsx')).toContain('<PlatformSettingsCard />');
  });

  it('uses the new button text everywhere', () => {
    expect(read('apps/web/components/QuarantineDesk.tsx')).toContain('[ 🟢 Approve & Add to Time Log ]');
    expect(read('apps/web/components/QuarantineDesk.tsx')).toContain('[ 🔴 Reject & Remove ]');
    expect(TREASURER_CODE_EXPENSE_LABEL).toBe('🏷️ Categorize & Lock Expense');
    const parts = read('apps/web/components/ExpenseParts.tsx');
    expect(parts).toContain("EXPENSE_APPROVE_LABEL = '📝 Verify & Sign Expense'");
    expect(parts).toContain("EXPENSE_COUNTERSIGN_LABEL = '✍️ Final Release for Payment'");
    expect(read('apps/web/app/members/page.tsx')).toContain('🔍 Check for Inactive Members');
    const guide = read('docs/ADMIN_USER_GUIDE.md');
    for (const old of ['Clear Hours to Ledger', 'Delete Fraudulent Time', 'Code to Ledger', '📜 Approve Expense', 'Countersign Expense', 'Run inactivity sweep']) {
      expect(guide).not.toContain(old);
    }
    expect(guide).toContain('## 16. Council Wide Settings and platform limits');
  });
});
