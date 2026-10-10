// Sprint 6R (Schema 57): the council EIN, the six 'feature_*' flags, the Feature Flags Control Center, the stricter
// post-event results audience, standalone gallery uploads, the Co-Pilot tooltip and the unified Council Artifacts drawer.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ALL_FEATURES_ON,
  assertMayChangeLesson,
  canOpenFeatureFlagsControlCenter,
  canRecordLedger,
  canUploadStandaloneMedia,
  cleanEinNumber,
  cleanVaultUpload,
  complianceReportEntries,
  councilFeatureFlags,
  FEATURE_FLAG_NAMES,
  portalAreas,
  portalSidebar,
  unifiedArtifacts,
  type CouncilAudit,
  type MemberWriteActor,
} from '@kofc/shared';
import { drivers, expectRule, MEMBER } from './helpers';

const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');

const superAdmin = { memberId: 1, councilId: 1, memberType: 'Super Admin' as const, isOfficer: true, roles: ['Grand Knight'] };
const admin = { memberId: 2, councilId: 1, memberType: 'Admin' as const, isOfficer: false };
const officer = { memberId: 9, councilId: 1, memberType: 'Member' as const, isOfficer: true, roles: ['Recorder'] };
const member = { memberId: 10, councilId: 1, memberType: 'Member' as const, isOfficer: false };

const NEW_FLAGS = [
  'feature_expense_reporting',
  'feature_faith_center',
  'feature_constitutional_advisor',
  'feature_council_bylaws',
  'feature_council_history',
  'feature_live_meeting_console',
] as const;

describe('Schema 57', () => {
  it('adds ein_number and the six feature flags to Council and bumps the phone schema version', () => {
    const schema = read('Schema.sql');
    expect(schema).toContain('ALTER TABLE [Council] ADD [ein_number] VARCHAR(20) NULL;');
    for (const flag of NEW_FLAGS) expect(schema).toContain(`ALTER TABLE [Council] ADD [${flag}] BIT NOT NULL DEFAULT 1;`);
    expect(read('apps/mobile/services/drivers/sqlite.ts')).toMatch(/const SCHEMA_VERSION = (5[7-9]|[6-9]\d);/);
  });
});

describe('council EIN', () => {
  it('stores nine digits as NN-NNNNNNN and clears a blank value', () => {
    expect(cleanEinNumber('12-3456789')).toBe('12-3456789');
    expect(cleanEinNumber(' 123456789 ')).toBe('12-3456789');
    expect(cleanEinNumber('12 345 6789')).toBe('12-3456789');
    expect(cleanEinNumber('  ')).toBeNull();
    expect(cleanEinNumber(undefined)).toBeNull();
    expect(() => cleanEinNumber('12-345678')).toThrow(/nine digits/);
    expect(() => cleanEinNumber('AB-CDEFGHI')).toThrow(/nine digits/);
  });

  it('shows an EIN field on the Councils page and no feature flags panel there', () => {
    const page = read('apps/web/app/councils/page.tsx');
    expect(page).toContain("key: 'ein_number'");
    expect(page).not.toContain('setFeatureFlags');
  });
});

describe.each(drivers)('$name driver: council EIN', (d) => {
  it('saves, normalizes, clears and rejects an EIN', async () => {
    const db = await d.make();
    const created = await db.councils.create(MEMBER.superAdmin, { CouncilNumber: 98765, CouncilName: 'St. Joseph', State: 'OR', ein_number: '931234567' });
    expect(created.ein_number).toBe('93-1234567');
    const cleared = await db.councils.update(MEMBER.superAdmin, created.id, { ein_number: null });
    expect(cleared.ein_number ?? null).toBeNull();
    await expectRule(db.councils.update(MEMBER.superAdmin, created.id, { ein_number: '123' }), 'INVALID_INPUT');
    await expectRule(db.councils.update(MEMBER.admin, created.id, { ein_number: '93-1234567' }), 'SUPER_ADMIN_REQUIRED');
  });
});

describe('Sprint 6R feature flags', () => {
  it('names the six new switches and reads them as on by default', () => {
    for (const flag of NEW_FLAGS) {
      expect(FEATURE_FLAG_NAMES).toContain(flag);
      expect(ALL_FEATURES_ON[flag]).toBe(true);
    }
    expect(councilFeatureFlags({ feature_faith_center: 0 })).toEqual({ ...ALL_FEATURES_ON, feature_faith_center: false });
  });

  it('hides each module when its switch is off and leaves the others', () => {
    const without = (flag: (typeof NEW_FLAGS)[number]) => portalAreas(superAdmin, { ...ALL_FEATURES_ON, [flag]: false });
    const expenses = without('feature_expense_reporting');
    for (const gone of ['expenses', 'expenses/queue', 'expenses/audit', 'expenses/authorize', 'expenses/disbursements', 'finance/treasurer-desk']) {
      expect(expenses).not.toContain(gone);
    }
    for (const kept of ['finance/ledger', 'financials/budget', 'ledger']) expect(expenses).toContain(kept);
    expect(without('feature_faith_center')).not.toContain('faith-center');
    expect(without('feature_constitutional_advisor')).not.toContain('governance/advisor');
    expect(without('feature_council_bylaws')).not.toContain('governance/bylaws');
    expect(without('feature_council_history')).not.toContain('history');
    const noConsole = without('feature_live_meeting_console');
    expect(noConsole).not.toContain('meetings/live');
    expect(noConsole).toContain('meetings');
  });

  it('gates the phone expense screen, the expense card and the Faith Center pieces', () => {
    expect(read('apps/mobile/app/(app)/expenses.tsx')).toContain('<FeatureGate flag="feature_expense_reporting">');
    const home = read('apps/mobile/app/(app)/index.tsx');
    expect(home).toContain('features.feature_expense_reporting');
    expect(home).toContain('features.feature_faith_center');
    expect(read('apps/mobile/components/FaithCenter.tsx')).toContain('feature_faith_center');
  });
});

describe.each(drivers)('$name driver: Sprint 6R flags', (d) => {
  it('lets a Super Admin switch a feature_* module off and back on', async () => {
    const db = await d.make();
    const off = await db.councils.setFeatureFlags(MEMBER.superAdmin, 1, { feature_council_history: false, feature_expense_reporting: false });
    expect(councilFeatureFlags(off)).toEqual({ ...ALL_FEATURES_ON, feature_council_history: false, feature_expense_reporting: false });
    await db.councils.setFeatureFlags(MEMBER.superAdmin, 1, { feature_council_history: true, feature_expense_reporting: true });
    expect(councilFeatureFlags(await db.councils.get(1))).toEqual(ALL_FEATURES_ON);
    await expectRule(db.councils.setFeatureFlags(MEMBER.admin, 1, { feature_faith_center: false }), 'SUPER_ADMIN_REQUIRED');
  });
});

describe('Feature Flags Control Center', () => {
  it('is a Super Admin sidebar link in the Setup pillar, after Councils', () => {
    expect(canOpenFeatureFlagsControlCenter(superAdmin)).toBe(true);
    for (const u of [admin, officer, member]) {
      expect(canOpenFeatureFlagsControlCenter(u)).toBe(false);
      expect(portalAreas(u)).not.toContain('feature-flags');
    }
    const setup = portalSidebar(superAdmin).find((g) => g.id === 'setup')!;
    const items = setup.entries.map((e) => e.item);
    expect(items.indexOf('feature-flags')).toBe(items.indexOf('councils') + 1);
    const sidebar = read('apps/web/components/Sidebar.tsx');
    expect(sidebar).toContain("label: 'Feature Flags Control Center'");
  });

  it('draws every flag for every council and saves through councils.setFeatureFlags', () => {
    const page = read('apps/web/app/feature-flags/page.tsx');
    expect(page).toContain('<RequireArea area="feature-flags">');
    expect(page).toContain('FEATURE_FLAG_NAMES.map');
    expect(page).toContain('db.councils.setFeatureFlags');
  });
});

describe('post-event results audience', () => {
  it('admits the owner, an elected officer or Admin of a linked council, and Super Admins only', () => {
    expect(canRecordLedger(member, { OwnerID: member.memberId }, [1])).toBe(true);
    expect(canRecordLedger(officer, { OwnerID: 50 }, [1])).toBe(true);
    expect(canRecordLedger(officer, { OwnerID: 50 }, [2])).toBe(false);
    expect(canRecordLedger(admin, { OwnerID: 50 }, [1])).toBe(true);
    expect(canRecordLedger(superAdmin, { OwnerID: 50 }, [7])).toBe(true);
    expect(canRecordLedger(member, { OwnerID: 50 }, [1])).toBe(false);
  });

  it('lets a linked council officer record lessons, and nobody else without rights', () => {
    const actor = (over: Partial<MemberWriteActor>): MemberWriteActor => ({ memberId: 9, councilId: 1, memberType: 'Member', active: true, roles: ['Recorder'], officer: true, ...over });
    const event = { id: 4, OwnerID: 50 };
    expect(() => assertMayChangeLesson(actor({}), event, [1], 'add a lesson')).not.toThrow();
    expect(() => assertMayChangeLesson(actor({ councilId: 2 }), event, [1], 'add a lesson')).toThrow(/elected officer of its council/);
    expect(() => assertMayChangeLesson(actor({ active: false }), event, [1], 'add a lesson')).toThrow();
    expect(() => assertMayChangeLesson(actor({ officer: false, roles: [] }), event, [1], 'add a lesson')).toThrow();
  });

  it('shows the calendar ledger link only to those who may update the results', () => {
    const calendar = read('apps/web/app/calendar/page.tsx');
    expect(calendar).toContain('canRecordLedger(user, event, councilIds)');
    expect(calendar).toContain('recordable.data?.has(e.id)');
  });
});

describe('standalone gallery uploads', () => {
  it('validates the council, the year and the exclusive tags', () => {
    expect(cleanVaultUpload({ councilId: 1, calendarYear: 2024, fileUrls: ['campout.jpg'], locationTag: ' Camp Meriwether ' })).toEqual({
      eventId: null,
      meetingId: null,
      councilId: 1,
      calendarYear: 2024,
      fileUrls: ['campout.jpg'],
      locationTag: 'Camp Meriwether',
    });
    expect(() => cleanVaultUpload({ eventId: 1, councilId: 1, fileUrls: ['a.jpg'] })).toThrow(/leave the council out/);
    expect(() => cleanVaultUpload({ meetingId: 1, calendarYear: 2024, fileUrls: ['a.jpg'] })).toThrow(/leave the year out/);
    expect(() => cleanVaultUpload({ councilId: 1, calendarYear: 1850, fileUrls: ['a.jpg'] })).toThrow();
    expect(() => cleanVaultUpload({ councilId: 1, calendarYear: 3000, fileUrls: ['a.jpg'] })).toThrow(/1900-2999/);
    expect(canUploadStandaloneMedia(member, 1)).toBe(true);
    expect(canUploadStandaloneMedia(member, 2)).toBe(false);
    expect(canUploadStandaloneMedia(superAdmin, 2)).toBe(true);
  });

  it('offers past events, past meetings and standalone on the gallery page', () => {
    const page = read('apps/web/app/gallery/page.tsx');
    for (const label of ["'Past event'", "'Past meeting'", "'Standalone'"]) expect(page).toContain(label);
    expect(page).toContain('e.StartDate <= today');
    expect(page).toContain('m.date <= today');
  });
});

describe.each(drivers)('$name driver: standalone gallery uploads', (d) => {
  it('stores untagged photos for any member of the council and lists them in the library', async () => {
    const db = await d.make();
    const [row] = await db.media.uploadToVault(MEMBER.member, { councilId: 1, calendarYear: 2024, fileUrls: ['campout.jpg'], locationTag: 'Camp Meriwether' });
    expect(row).toMatchObject({ council_id: 1, event_id: null, meeting_id: null, calendar_year: 2024, location_tag: 'Camp Meriwether', uploaded_by_member_id: MEMBER.member });
    // The same photo again writes nothing.
    expect(await db.media.uploadToVault(MEMBER.member, { councilId: 1, fileUrls: ['campout.jpg'] })).toEqual([]);
    const item = (await db.media.getLibrary(MEMBER.member, 1)).items.find((i) => i.fileUrl === 'campout.jpg');
    expect(item).toMatchObject({ eventId: null, meetingId: null, calendarYear: 2024, locationTag: 'Camp Meriwether' });
    const [thisYear] = await db.media.uploadToVault(MEMBER.member, { councilId: 1, fileUrls: ['picnic.jpg'] });
    expect(thisYear.calendar_year).toBe(Number(thisYear.uploaded_at.slice(0, 4)));
  });

  it('refuses members of another council and unknown councils', async () => {
    const db = await d.make();
    await expectRule(db.media.uploadToVault(MEMBER.member, { councilId: 2, fileUrls: ['x.jpg'] }), 'COUNCIL_ACCESS_DENIED');
    await expectRule(db.media.uploadToVault(MEMBER.superAdmin, { councilId: 999, fileUrls: ['x.jpg'] }), 'INVALID_INPUT');
  });
});

describe('Co-Pilot tooltip', () => {
  it('disables Design Advanced Collateral without a key and links the tooltip to the Credentials Vault', () => {
    const box = read('apps/web/components/CopilotPrompt.tsx');
    expect(box).toContain('Design Advanced Collateral');
    expect(box).toContain('role="tooltip"');
    expect(box).toContain('group-hover:visible');
    expect(box).toContain('group-focus-within:visible');
    expect(box).toContain('href="/credentials-vault"');
  });
});

describe('unified Council Artifacts drawer', () => {
  const audit = (over: Partial<CouncilAudit>): CouncilAudit => ({
    id: 1,
    council_id: 1,
    audit_period: 'JUL-DEC',
    fiscal_year: '2025-2026',
    execution_status: 'LOCKED',
    locked_at: '2026-01-15 18:00:00',
    created_at: '2026-01-05 10:00:00',
    ...over,
  });

  it('lists locked Form 1295 audits only, dated by their lock', () => {
    const entries = complianceReportEntries([audit({}), audit({ id: 2, execution_status: 'DRAFT', locked_at: null, audit_period: 'JAN-JUN' })]);
    expect(entries).toEqual([
      {
        source: 'system',
        key: 'audit-1',
        kind: 'Form 1295 audit',
        title: expect.stringContaining('Semiannual Trustee Audit'),
        date: '2026-01-15',
        audit: { fiscalYear: '2025-2026', period: 'JUL-DEC' },
      },
    ]);
  });

  it('merges Drive cards and compliance reports, newest first', () => {
    const drive = [
      { key: 'meeting-1-minutes', kind: 'Minutes' as const, title: 'October meeting', date: '2026-10-06', href: 'https://drive.google.com/x' },
      { key: 'event-2-flyer', kind: 'Flyer' as const, title: 'Fish Fry', date: '2025-03-07', href: 'https://drive.google.com/y' },
    ];
    const merged = unifiedArtifacts(drive, complianceReportEntries([audit({})]));
    expect(merged.map((e) => [e.source, e.key])).toEqual([
      ['drive', 'meeting-1-minutes'],
      ['system', 'audit-1'],
      ['drive', 'event-2-flyer'],
    ]);
  });

  it('shows the compliance reports to readers of the books and compiles their PDF on request', () => {
    const page = read('apps/web/app/resources/bulletins/page.tsx');
    expect(page).toContain('canReadGeneralLedger(user, user.councilId)');
    expect(page).toContain('db.finance.listTrusteeAudits');
    expect(page).toContain('compileForm1295');
  });
});
