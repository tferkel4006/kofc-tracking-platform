// Sprint 6Z-Dual-Gate-Model (Schema 39): Council.tenant_type and the two guards in workflow.ts - the feature gate
// (isFeatureEnabled) and the tenant gate (isFraternalExtension) - with the portal areas, vocabulary and driver
// operations they decide.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ALL_FEATURES_ON,
  assertFeatureEnabled,
  assertFraternalExtension,
  BusinessRuleError,
  clearCouncilGates,
  councilTenantType,
  FEATURE_GATE_WORKFLOW,
  FRATERNAL_AREAS,
  isFeatureEnabled,
  isFraternalExtension,
  portalAreas,
  portalSidebar,
  registerCouncilGates,
  TENANT_GATE_WORKFLOW,
  whiteLabel,
  type DataService,
} from '@kofc/shared';
import type { MemoryDataService } from '../apps/web/services/drivers/memory';
import { drivers, expectRule, MEMBER, type DriverUnderTest } from './helpers';
import { openDatabases } from './shims/expo-sqlite';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (path: string) => readFileSync(join(root, path), 'utf8');

const superAdmin = { memberId: 1, councilId: 1, memberType: 'Super Admin' as const, isOfficer: true, roles: ['Grand Knight'] };

afterEach(() => clearCouncilGates());

describe('schema 39', () => {
  it('appends Council.tenant_type defaulting to KOFC and bumps the phone database version', () => {
    expect(read('Schema.sql')).toMatch(/ALTER TABLE \[Council\] ADD \[tenant_type\] VARCHAR\(20\) NOT NULL DEFAULT 'KOFC';/);
    expect(read('apps/mobile/services/drivers/sqlite.ts')).toMatch(/const SCHEMA_VERSION = 39;/);
    expect(read('data_dictionary.md')).toMatch(/tenant_type \(VARCHAR\(20\), NOT NULL, DEFAULT 'KOFC'\)/);
  });
});

describe('tenant type', () => {
  it('reads a missing, NULL or blank column as KOFC and any other value as a white label', () => {
    expect(councilTenantType(null)).toBe('KOFC');
    expect(councilTenantType({ tenant_type: null })).toBe('KOFC');
    expect(councilTenantType({ tenant_type: '  ' })).toBe('KOFC');
    expect(councilTenantType({ tenant_type: ' kofc ' })).toBe('KOFC');
    expect(councilTenantType({ tenant_type: 'GENERIC' })).toBe('GENERIC');
    expect(councilTenantType({ tenant_type: 'Rotary' })).toBe('GENERIC');
  });
});

describe('workflow guards', () => {
  it('declares both gates as workflows', () => {
    expect(FEATURE_GATE_WORKFLOW.states).toEqual(['On', 'Off']);
    expect(TENANT_GATE_WORKFLOW.states).toEqual(['KOFC', 'GENERIC']);
  });

  it('isFeatureEnabled reads the passed row, then the registered row, else every module on', () => {
    expect(isFeatureEnabled(7, 'flag_meeting_management')).toBe(true);
    registerCouncilGates({ id: 7, flag_meeting_management: 0 });
    expect(isFeatureEnabled(7, 'flag_meeting_management')).toBe(false);
    expect(isFeatureEnabled(7, 'flag_complex_shifts')).toBe(true);
    expect(isFeatureEnabled(7, 'flag_meeting_management', { id: 7, flag_meeting_management: 1 })).toBe(true);
    expect(() => assertFeatureEnabled(7, 'flag_meeting_management')).toThrow(BusinessRuleError);
    try {
      assertFeatureEnabled(7, 'flag_meeting_management');
    } catch (err) {
      expect((err as BusinessRuleError).code).toBe('FEATURE_DISABLED');
      expect((err as BusinessRuleError).message).toMatch(/Meeting management/);
    }
  });

  it('isFraternalExtension is true only for a KOFC council, and an unknown council reads as KOFC', () => {
    expect(isFraternalExtension(9)).toBe(true);
    registerCouncilGates({ id: 9, tenant_type: 'GENERIC' });
    expect(isFraternalExtension(9)).toBe(false);
    expect(isFraternalExtension(9, { id: 9, tenant_type: 'KOFC' })).toBe(true);
    expect(() => assertFraternalExtension(9, 'file a Supreme Council report')).toThrow(/not a Knights of Columbus council/);
    clearCouncilGates();
    expect(() => assertFraternalExtension(9, 'file a Supreme Council report')).not.toThrow();
  });
});

describe('portal gating and vocabulary', () => {
  it('keeps every area for a KOFC council and drops only the fraternal ones for a white label', () => {
    const kofc = portalAreas(superAdmin, ALL_FEATURES_ON, 'KOFC');
    expect(kofc).toEqual(portalAreas(superAdmin));
    for (const area of FRATERNAL_AREAS) expect(kofc).toContain(area);
    const generic = portalAreas(superAdmin, ALL_FEATURES_ON, 'GENERIC');
    expect(generic).toEqual(kofc.filter((a) => !FRATERNAL_AREAS.includes(a)));
  });

  it('hides fraternal desks from the sidebar rather than locking them', () => {
    const member = { memberId: 3, councilId: 1, memberType: 'Member' as const, isOfficer: false };
    const items = portalSidebar(member, ALL_FEATURES_ON, 'GENERIC').flatMap((g) => g.entries.map((e) => e.item));
    for (const area of FRATERNAL_AREAS) expect(items).not.toContain(area);
    const adminItems = portalSidebar(superAdmin, ALL_FEATURES_ON, 'GENERIC').flatMap((g) => g.entries.map((e) => e.item));
    for (const area of FRATERNAL_AREAS) expect(adminItems).not.toContain(area);
  });

  it('white-labels the vocabulary for a GENERIC tenant and leaves KOFC text alone', () => {
    const text = 'Nominate brother Knights; restricted to the Deputy Grand Knight, the Grand Knight and the Supreme Council';
    expect(whiteLabel(text, 'KOFC')).toBe(text);
    expect(whiteLabel(text, 'GENERIC')).toBe('Nominate fellow members; restricted to the Vice President, the President and the National Office');
    expect(whiteLabel('Faith In Action', 'GENERIC')).toBe('Service In Action');
    expect(whiteLabel('GK Expense Authorize', 'GENERIC')).toBe('President Expense Authorize');
    expect(whiteLabel('Council Lookup Tables for councils', 'GENERIC')).toBe('Chapter Lookup Tables for chapters');
    expect(whiteLabel('Fraternal Photo Gallery', 'GENERIC')).toBe('Community Photo Gallery');
  });
});

/** Sets the council's tenant_type straight in the backing store; no driver method writes it yet. */
function setTenantType(d: DriverUnderTest, db: DataService, councilId: number, tenantType: string): void {
  if (d.name === 'memory') {
    const row = (db as MemoryDataService).debugStore.rows('Council').find((c) => c.id === councilId) as Record<string, unknown>;
    row.tenant_type = tenantType;
  } else {
    openDatabases.at(-1)!.prepare('UPDATE [Council] SET [tenant_type] = ? WHERE [id] = ?').run(tenantType, councilId);
  }
}

describe.each(drivers)('$name driver: the tenant gate on supreme.*', (d) => {
  const OWN = 1;

  it('seeds every council as KOFC and still runs the Supreme operations', async () => {
    const db = await d.make();
    expect((await db.councils.get(OWN))?.tenant_type).toBe('KOFC');
    await expect(db.supreme.listSyncHistory(MEMBER.admin, OWN)).resolves.toBeInstanceOf(Array);
  });

  it('rejects every Supreme operation for a white-label council with FRATERNAL_EXTENSION_REQUIRED', async () => {
    const db = await d.make();
    setTenantType(d, db, OWN, 'GENERIC');
    expect(councilTenantType(await db.councils.get(OWN))).toBe('GENERIC');
    await expectRule(db.supreme.previewReport(MEMBER.admin, OWN, 'CouncilAudit', { year: 2026, half: 1 }), 'FRATERNAL_EXTENSION_REQUIRED');
    await expectRule(db.supreme.syncAlchemerReport(MEMBER.admin, OWN, 'CouncilAudit', '123456', { year: 2026, half: 1 }), 'FRATERNAL_EXTENSION_REQUIRED');
    await expectRule(db.supreme.listSyncHistory(MEMBER.admin, OWN), 'FRATERNAL_EXTENSION_REQUIRED');
    await expectRule(db.supreme.syncSupremeRoster(MEMBER.admin, OWN, []), 'FRATERNAL_EXTENSION_REQUIRED');
    expect(d.count(db, 'SupremeReportingSync')).toBe(0);
  });

  it('still checks the caller before the tenant', async () => {
    const db = await d.make();
    setTenantType(d, db, OWN, 'GENERIC');
    await expectRule(db.supreme.syncSupremeRoster(MEMBER.member, OWN, []), 'ADMIN_REQUIRED');
  });
});
