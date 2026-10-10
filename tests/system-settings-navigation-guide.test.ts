// Sprint 7C Extension (Schema 63): the Setup pillar renamed System Settings, the Super Admin's Global System Parameters
// page, and the role-filtered Navigation Guide.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ALL_FEATURES_ON,
  canOpenGlobalSystemParameters,
  FEATURE_FLAG_NAMES,
  NAVIGATION_EXPLANATIONS,
  navigationGuide,
  navigationPersona,
  PORTAL_NAV_GROUPS,
  portalAreas,
  portalSidebar,
  type PortalNavItem,
} from '@kofc/shared';

const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');
const actor = (over: Partial<Parameters<typeof portalAreas>[0]> = {}) => ({ memberId: 9, councilId: 1, memberType: 'Member' as const, isOfficer: false, roles: [] as string[], ...over });
const superAdmin = actor({ memberId: 1, memberType: 'Super Admin' });
const admin = actor({ memberId: 2, memberType: 'Admin' });
const grandKnight = actor({ isOfficer: true, roles: ['Grand Knight'] });
const member = actor();

const FINANCE_DESKS = ['finance/ledger', 'finance/balance-sheet', 'finance/dashboard', 'finance/audit', 'finance/treasurer-desk', 'expenses/queue', 'expenses/audit', 'expenses/authorize', 'expenses/disbursements', 'charities/queue', 'charities/vetting', 'donations', 'dashboard'];
const ADMIN_DESKS = ['councils', 'feature-flags', 'system-settings/global-settings', 'setup/council-settings', 'members', 'supreme-sync', 'council-lookups', 'credentials-vault', 'lookups', 'parishes', 'activities', 'events'];

describe('Schema 63', () => {
  it('bumps the phone schema version and records the release without a table change', () => {
    expect(read('apps/mobile/services/drivers/sqlite.ts')).toMatch(/const SCHEMA_VERSION = (6[3-9]|[7-9]\d);/);
    expect(read('Schema.sql')).toContain('Sprint 7C Extension: SYSTEM SETTINGS (schema version 63)');
  });
});

describe('System Settings pillar', () => {
  it('renames the Setup pillar to System Settings and keeps its id', () => {
    const group = PORTAL_NAV_GROUPS.find((g) => g.id === 'setup')!;
    expect(group.label).toBe('System Settings');
    expect(PORTAL_NAV_GROUPS.map((g) => g.label)).not.toContain('Setup');
    expect(group.items.indexOf('system-settings/global-settings')).toBe(group.items.indexOf('feature-flags') + 1);
  });

  it('opens Global System Parameters to Super Admins only', () => {
    expect([superAdmin, admin, grandKnight, member].map(canOpenGlobalSystemParameters)).toEqual([true, false, false, false]);
    expect(portalAreas(superAdmin)).toContain('system-settings/global-settings');
    for (const u of [admin, grandKnight, member]) expect(portalAreas(u)).not.toContain('system-settings/global-settings');
  });

  it('moves the dues, tenant and Platform Limits cards off System Lookups and keeps the flag grid to on/off switches', () => {
    const page = read('apps/web/app/system-settings/global-settings/page.tsx');
    expect(page).toContain('<PageTitle>Global System Parameters</PageTitle>');
    expect(page).toContain('<RequireArea area="system-settings/global-settings">');
    expect(page).toContain('<GlobalParametersCard />');
    expect(page).toContain('<PlatformSettingsCard />');
    const lookups = read('apps/web/app/lookups/page.tsx');
    expect(lookups).not.toContain('GlobalParametersCard');
    expect(lookups).not.toContain('PlatformSettingsCard');
    const flags = read('apps/web/app/feature-flags/page.tsx');
    for (const limit of ['base_dues_rate', 'oral_history_max_seconds', 'diary_text_max_length', 'prayer_intention_max_length', 'PlatformSettings']) {
      expect(flags).not.toContain(limit);
      expect(FEATURE_FLAG_NAMES as readonly string[]).not.toContain(limit);
    }
    expect(read('apps/web/components/Sidebar.tsx')).toMatch(/'system-settings\/global-settings': \{\s*href: '\/system-settings\/global-settings',\s*label: 'Global System Parameters'/);
  });
});

describe('Navigation Guide', () => {
  it('is every member\'s area, pinned above the pillars rather than filed in one', () => {
    for (const u of [superAdmin, admin, grandKnight, member]) expect(portalAreas(u)).toContain('navigation-guide');
    expect(PORTAL_NAV_GROUPS.flatMap((g) => g.items) as string[]).not.toContain('navigation-guide');
    const sidebar = read('apps/web/components/Sidebar.tsx');
    expect(sidebar).toMatch(/'navigation-guide': \{\s*href: '\/navigation-guide',\s*label: 'Navigation Guide'/);
    expect(sidebar.indexOf('<NavLink item="navigation-guide"')).toBeLessThan(sidebar.indexOf('{groups.map('));
    expect(read('apps/web/app/navigation-guide/page.tsx')).toContain('<RequireArea area="navigation-guide">');
  });

  it('explains every sidebar link', () => {
    for (const item of PORTAL_NAV_GROUPS.flatMap((g) => g.items)) expect(NAVIGATION_EXPLANATIONS[item as PortalNavItem].member.length).toBeGreaterThan(10);
  });

  it('reads the persona from the member type and the officer Roles', () => {
    expect([superAdmin, admin, grandKnight, member].map(navigationPersona)).toEqual(['Super Admin', 'Council Admin', 'Council Officer', 'Member']);
    expect(navigationGuide(grandKnight).roles).toEqual(['Grand Knight']);
  });

  it('lists exactly the links each persona\'s sidebar shows, in order', () => {
    for (const u of [superAdmin, admin, grandKnight, member]) {
      const guide = navigationGuide(u);
      expect(guide.groups.map((g) => [g.label, g.entries.map((e) => e.item)])).toEqual(portalSidebar(u).map((g) => [g.label, g.entries.map((e) => e.item)]));
    }
  });

  it('keeps administrative and financial desks out of an ordinary member\'s guide and uses the member wording', () => {
    const guide = navigationGuide(member);
    const items = guide.groups.flatMap((g) => g.entries.map((e) => e.item as string));
    for (const desk of [...FINANCE_DESKS, ...ADMIN_DESKS]) expect(items).not.toContain(desk);
    expect(guide.groups.map((g) => g.label)).not.toContain('System Settings');
    expect(guide.summary).toContain('Leadership pages are not shown to you');
    const budget = guide.groups.flatMap((g) => g.entries).find((e) => e.item === 'financials/budget')!;
    expect(budget.explanation).toBe(NAVIGATION_EXPLANATIONS['financials/budget'].member);
    expect(guide.topBar.map((t) => t.item)).toEqual(['messages', 'distribution-lists', 'profile']);
  });

  it('gives leadership the fuller wording and their own desks', () => {
    const guide = navigationGuide(grandKnight);
    const entries = guide.groups.flatMap((g) => g.entries);
    expect(entries.find((e) => e.item === 'financials/budget')!.explanation).toBe(NAVIGATION_EXPLANATIONS['financials/budget'].leader);
    expect(entries.map((e) => e.item)).toContain('expenses/authorize');
    expect(navigationGuide(superAdmin).groups.find((g) => g.id === 'setup')!.entries.map((e) => e.item)).toContain('system-settings/global-settings');
  });

  it('follows the feature flags: a switched-off module leaves the guide too', () => {
    const items = navigationGuide(member, { ...ALL_FEATURES_ON, feature_faith_center: false }).groups.flatMap((g) => g.entries.map((e) => e.item));
    expect(items).not.toContain('faith-center');
  });
});
