// Sprint 6A: council feature flags (Schema 30) and the phone's rapid-tap 15-minute activity tracker.
import { describe, expect, it } from 'vitest';
import {
  ALL_FEATURES_ON,
  cleanFeatureFlagChanges,
  councilFeatureFlags,
  FEATURE_FLAG_NAMES,
  mobileTabEnabled,
  nextQuarterHourTotal,
  portalAreas,
  portalSidebar,
  type FeatureFlags,
} from '@kofc/shared';
import { drivers, expectRule, MEMBER } from './helpers';

const superAdmin = { memberId: 1, councilId: 1, memberType: 'Super Admin' as const, isOfficer: true, roles: ['Grand Knight'] };
const allOff: FeatureFlags = { flag_mobile_elections: false, flag_donations_hub: false, flag_complex_shifts: false, flag_meeting_management: false };

describe('feature flag rules', () => {
  it('reads a council row, treating missing columns as on', () => {
    expect(councilFeatureFlags(null)).toEqual(ALL_FEATURES_ON);
    expect(councilFeatureFlags({ flag_donations_hub: 0, flag_meeting_management: 1 })).toEqual({ ...ALL_FEATURES_ON, flag_donations_hub: false });
  });

  it('leaves every module in the portal while all flags are on', () => {
    expect(portalAreas(superAdmin, ALL_FEATURES_ON)).toEqual(portalAreas(superAdmin));
  });

  it('hides each switched-off module but keeps the financial engine and the service logs', () => {
    const areas = portalAreas(superAdmin, allOff);
    for (const gone of ['elections', 'elections/appointments', 'donations', 'events', 'meetings', 'meetings/cadence', 'meetings/live']) {
      expect(areas).not.toContain(gone);
    }
    for (const kept of ['member-actions', 'ledger', 'expenses', 'finance/ledger', 'finance/balance-sheet', 'financials/budget', 'activities']) {
      expect(areas).toContain(kept);
    }
  });

  it('drops a switched-off desk from the sidebar instead of showing it locked', () => {
    const member = { memberId: 9, councilId: 1, memberType: 'Member' as const, isOfficer: false };
    const desks = (flags: FeatureFlags) => portalSidebar(member, flags).find((g) => g.id === 'executive')?.entries.map((e) => e.item) ?? [];
    expect(desks(ALL_FEATURES_ON)).toContain('meetings/live');
    expect(desks({ ...ALL_FEATURES_ON, flag_meeting_management: false })).not.toContain('meetings/live');
  });

  it('hides the matching phone tabs and never Home or Report', () => {
    expect(['index', 'log', 'shifts', 'meetings', 'donate'].filter((t) => mobileTabEnabled(t as never, allOff))).toEqual(['index', 'log']);
    expect(mobileTabEnabled('donate', { ...ALL_FEATURES_ON, flag_donations_hub: false })).toBe(false);
    expect(mobileTabEnabled('shifts', { ...ALL_FEATURES_ON, flag_donations_hub: false })).toBe(true);
  });

  it('accepts only known flags with boolean values', () => {
    expect(cleanFeatureFlagChanges({ flag_complex_shifts: false, flag_donations_hub: true })).toEqual({ flag_complex_shifts: 0, flag_donations_hub: 1 });
    expect(() => cleanFeatureFlagChanges({ flag_unknown: true } as never)).toThrow(/not a feature flag/);
    expect(() => cleanFeatureFlagChanges({ flag_complex_shifts: 0 } as never)).toThrow(/true or false/);
  });

  it('adds exactly 15 minutes per tap and stops at 24 hours', () => {
    expect(nextQuarterHourTotal(null)).toBe(0.25);
    expect(nextQuarterHourTotal(1.5)).toBe(1.75);
    expect(() => nextQuarterHourTotal(24)).toThrow(/at most 24/);
  });
});

describe.each(drivers)('$name driver: councils.setFeatureFlags', (d) => {
  it('starts every council with every module on', async () => {
    const db = await d.make();
    const council = await db.councils.get(1);
    for (const name of FEATURE_FLAG_NAMES) expect(council?.[name]).toBe(1);
  });

  it('lets a Super Admin switch modules off and back on, keeping the flags not named', async () => {
    const db = await d.make();
    const off = await db.councils.setFeatureFlags(MEMBER.superAdmin, 1, { flag_meeting_management: false, flag_complex_shifts: false });
    expect(councilFeatureFlags(off)).toEqual({ ...ALL_FEATURES_ON, flag_meeting_management: false, flag_complex_shifts: false });
    await db.councils.setFeatureFlags(MEMBER.superAdmin, 1, { flag_complex_shifts: true });
    expect(councilFeatureFlags(await db.councils.get(1))).toEqual({ ...ALL_FEATURES_ON, flag_meeting_management: false });
  });

  it('refuses Admins and unknown councils, writing nothing', async () => {
    const db = await d.make();
    await expectRule(db.councils.setFeatureFlags(MEMBER.admin, 1, { flag_donations_hub: false }), 'SUPER_ADMIN_REQUIRED');
    await expectRule(db.councils.setFeatureFlags(MEMBER.superAdmin, 999, { flag_donations_hub: false }), 'RECORD_NOT_FOUND');
    await expectRule(db.councils.setFeatureFlags(MEMBER.superAdmin, 1, { flag_bogus: false } as never), 'INVALID_INPUT');
    expect(councilFeatureFlags(await db.councils.get(1))).toEqual(ALL_FEATURES_ON);
  });
});

describe.each(drivers)('$name driver: activityTime.addQuarterHour', (d) => {
  it('logs 0.25 hours on the first tap and grows the same entry on every tap after', async () => {
    const db = await d.make();
    const first = await db.activityTime.addQuarterHour(MEMBER.member, 3, '2026-09-20');
    expect(first).toMatchObject({ MemberID: MEMBER.member, ActivityID: 3, ActivityDate: '2026-09-20', Hours: 0.25 });
    await db.activityTime.addQuarterHour(MEMBER.member, 3, '2026-09-20');
    const third = await db.activityTime.addQuarterHour(MEMBER.member, 3, '2026-09-20');
    expect(third.id).toBe(first.id);
    expect(third.Hours).toBe(0.75);
    expect(d.count(db, 'ActivityTime')).toBe(1);
  });

  it('keeps a separate entry per activity, day and member', async () => {
    const db = await d.make();
    await db.activityTime.addQuarterHour(MEMBER.member, 3, '2026-09-20');
    await db.activityTime.addQuarterHour(MEMBER.member, 4, '2026-09-20');
    await db.activityTime.addQuarterHour(MEMBER.member, 3, '2026-09-19');
    await db.activityTime.addQuarterHour(MEMBER.admin, 3, '2026-09-20');
    expect(d.count(db, 'ActivityTime')).toBe(4);
  });

  it('refuses a tap past 24 hours, an unknown activity and a date past the 6-month wall', async () => {
    const db = await d.make();
    await db.activityTime.logHours(MEMBER.member, 3, 24, '2026-09-20');
    await expectRule(db.activityTime.addQuarterHour(MEMBER.member, 3, '2026-09-20'), 'HOURS_OUT_OF_RANGE');
    await expectRule(db.activityTime.addQuarterHour(MEMBER.member, 999, '2026-09-20'), 'ACTIVITY_NOT_FOUND');
    await expectRule(db.activityTime.addQuarterHour(MEMBER.member, 3, '2026-03-19'), 'ACTIVITY_DATE_TOO_OLD');
    expect((await db.activityTime.listByActivity(3)).totalHours).toBe(24);
  });
});
