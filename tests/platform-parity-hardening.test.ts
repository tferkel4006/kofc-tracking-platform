// Sprint 6I (Phase 6): Platform Parity and Database Hardening. The phone expense form's long-term asset switch, the
// Super Admin's Global Council Parameters Dashboard (councils.setGlobalParameters: tenant_type and base_dues_rate), and
// schema 47, which drops the legacy Event.Budget and Event.Spend columns. Spend now rolls up only from expense report
// lines: reports.monthlySummary has no eventSpend, and the Supreme snapshot's eventSpend sums the expense lines linked
// to the period's events.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cleanEventFields, cleanGlobalCouncilParameters, cleanTenantType, councilTenantType, type DataService } from '@kofc/shared';
import { MemoryDataService } from '../apps/web/services/drivers/memory';
import { TABLES } from '../apps/web/services/generated/schema.generated';
import { SCHEMA_STATEMENTS } from '../apps/mobile/services/generated/schema.sqlite';
import { drivers, expectRule, MEMBER, type DriverUnderTest } from './helpers';
import { openDatabases } from './shims/expo-sqlite';

const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');
const OWN = 1;

/** Writes a row straight into the backing store; resolves to its id. */
function raw(d: DriverUnderTest, db: DataService, table: string, row: Record<string, string | number | null>): number {
  if (d.name === 'memory') return (db as MemoryDataService).debugStore.insert(table, row).id as number;
  const cols = Object.keys(row);
  const res = openDatabases
    .at(-1)!
    .prepare(`INSERT INTO [${table}] (${cols.map((c) => `[${c}]`).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`)
    .run(...Object.values(row));
  return Number(res.lastInsertRowid);
}

describe('schema 47: legacy Event money columns purged', () => {
  it('drops Event.Budget and Event.Spend everywhere and bumps the phone database version', () => {
    const schema = read('Schema.sql');
    expect(schema).toContain('ALTER TABLE [Event] DROP COLUMN [Budget];');
    expect(schema).toContain('ALTER TABLE [Event] DROP COLUMN [Spend];');
    expect(schema).not.toMatch(/\[Event\]\.\[(Budget|Spend)\]/); // view_Event no longer lists them
    const columns = TABLES.Event.columns.map((c) => c.name);
    expect(columns).not.toContain('Budget');
    expect(columns).not.toContain('Spend');
    expect(columns).toContain('FundsRaised-Cash');
    const createEvent = SCHEMA_STATEMENTS.find((sql) => sql.startsWith('CREATE TABLE [Event] ('))!;
    expect(createEvent).not.toMatch(/\[(Budget|Spend)\]/);
    expect(read('Seed.sql')).not.toMatch(/\[Event\][^;]*\[(Budget|Spend)\]/);
    expect(read('apps/mobile/services/drivers/sqlite.ts')).toMatch(/const SCHEMA_VERSION = (4[7-9]|[5-9]\d);/);
    expect(read('data_dictionary.md')).toMatch(/Sprint 6I \(schema version 47\)/);
  });

  it('refuses the dropped columns as unknown event fields', () => {
    expect(() => cleanEventFields({ Budget: 100 } as never)).toThrow(/no field "Budget"/);
    expect(() => cleanEventFields({ Spend: 100 } as never)).toThrow(/no field "Spend"/);
  });

  it('teaches the generator to drop a column', () => {
    expect(read('scripts/gen-db-assets.mjs')).toMatch(/DROP COLUMN/);
  });
});

describe('global council parameters (pure)', () => {
  it('accepts exactly KOFC or GENERIC as a tenant type', () => {
    expect(cleanTenantType('KOFC')).toBe('KOFC');
    expect(cleanTenantType(' generic ')).toBe('GENERIC');
    for (const bad of ['', 'Parish', null, 3]) expect(() => cleanTenantType(bad)).toThrow(/KOFC, GENERIC/);
  });

  it('cleans either field alone or both, and refuses nothing, unknowns and bad values', () => {
    expect(cleanGlobalCouncilParameters({ tenant_type: 'generic' })).toEqual({ tenant_type: 'GENERIC' });
    expect(cleanGlobalCouncilParameters({ base_dues_rate: 45.5 })).toEqual({ base_dues_rate: 45.5 });
    expect(cleanGlobalCouncilParameters({ tenant_type: 'KOFC', base_dues_rate: 0 })).toEqual({ tenant_type: 'KOFC', base_dues_rate: 0 });
    expect(() => cleanGlobalCouncilParameters({})).toThrow(/tenant type, a base dues rate/);
    expect(() => cleanGlobalCouncilParameters({ CouncilName: 'x' } as never)).toThrow(/Unknown council parameter/);
    expect(() => cleanGlobalCouncilParameters({ base_dues_rate: -1 })).toThrow(/whole cents/);
    expect(() => cleanGlobalCouncilParameters({ base_dues_rate: 40.005 })).toThrow(/whole cents/);
  });
});

describe('phone expense form parity', () => {
  it('offers the long-term asset switch and sends its state on every save', () => {
    const screen = read('apps/mobile/app/(app)/expenses.tsx');
    expect(screen).toMatch(/<ToggleSwitch\s+label="Long-term Council Asset"/);
    expect(screen).toMatch(/useState\(\(\) => isLongTermAssetExpense\(detail\?\.report \?\? \{\}\)\)/);
    expect(screen).toMatch(/is_long_term_asset: longTermAsset,/);
    expect(screen).toMatch(/charity_request_id: detail\?\.report\.charity_request_id \?\? null/);
  });
});

describe('web admin card', () => {
  it('puts the Global Council Parameters Dashboard on the Super-Admin-only lookups page', () => {
    const card = read('apps/web/components/GlobalParametersCard.tsx');
    expect(card).toContain('Global Council Parameters Dashboard');
    expect(card).toContain('db.councils.setGlobalParameters(');
    expect(card).toMatch(/border-navy bg-white/);
    expect(read('apps/web/app/lookups/page.tsx')).toContain('<GlobalParametersCard />');
  });
});

describe.each(drivers)('sprint 6I ($name driver)', (d) => {
  it('re-saving a phone-style draft keeps the asset flag it sends', async () => {
    const db = await d.make();
    const receipt = { DateOfExpense: '2026-09-15', Amount: 300, VendorName: 'Costco', ReceiptPhotoURL: null, ExpenseDescription: 'Grill' };
    const first = await db.expenses.submitReport(MEMBER.member, { Status: 'Draft', is_long_term_asset: true }, [receipt]);
    const again = await db.expenses.submitReport(MEMBER.member, { id: first.report.id, Status: 'Draft', is_long_term_asset: true }, [receipt]);
    expect(again.report.is_long_term_asset).toBe(1);
  });

  it('lets only a Super Admin set the tenant type and base dues rate', async () => {
    const db = await d.make();
    const both = await db.councils.setGlobalParameters(MEMBER.superAdmin, OWN, { tenant_type: 'GENERIC', base_dues_rate: 52.25 });
    expect(councilTenantType(both)).toBe('GENERIC');
    expect(both.base_dues_rate).toBe(52.25);
    const rateOnly = await db.councils.setGlobalParameters(MEMBER.superAdmin, OWN, { base_dues_rate: 60 });
    expect(rateOnly).toMatchObject({ tenant_type: 'GENERIC', base_dues_rate: 60 });

    await expectRule(db.councils.setGlobalParameters(MEMBER.admin, OWN, { tenant_type: 'KOFC' }), 'SUPER_ADMIN_REQUIRED');
    await expectRule(db.councils.setGlobalParameters(MEMBER.member, OWN, { base_dues_rate: 1 }), 'SUPER_ADMIN_REQUIRED');
    await expectRule(db.councils.setGlobalParameters(MEMBER.superAdmin, 999, { tenant_type: 'KOFC' }), 'RECORD_NOT_FOUND');
    await expectRule(db.councils.setGlobalParameters(MEMBER.superAdmin, OWN, { tenant_type: 'PARISH' }), 'INVALID_INPUT');
    expect(await db.councils.get(OWN)).toMatchObject({ tenant_type: 'GENERIC', base_dues_rate: 60 });
  });

  it("totals a period's event spend from the expense lines linked to its events", async () => {
    const db = await d.make();
    const category = (await db.lookups.list('Category'))[0].id;
    const event = await db.events.create(
      { EventName: 'Spring Fish Fry', EventDescription: 'Lent', OwnerID: MEMBER.admin, StartDate: '2026-03-06', EndDate: '2026-03-06', Location: 'Hall', CategoryID: category },
      [OWN],
    );
    const sheet = (status: string) =>
      raw(d, db, 'ExpenseReport', { CouncilID: OWN, SubmitterMemberID: MEMBER.member, Status: status, LinkedEventID: event.id, LinkedMeetingID: null });
    const approved = sheet('Approved');
    raw(d, db, 'ExpenseLineItem', { ExpenseReportID: approved, DateOfExpense: '2026-03-05', Amount: 75.25, VendorName: 'Costco', ExpenseDescription: 'Fish' });
    raw(d, db, 'ExpenseLineItem', { ExpenseReportID: approved, DateOfExpense: '2026-03-05', Amount: 0.25, VendorName: 'Costco', ExpenseDescription: 'Lemons' });
    raw(d, db, 'ExpenseLineItem', { ExpenseReportID: sheet('Draft'), DateOfExpense: '2026-03-05', Amount: 999, VendorName: 'Costco', ExpenseDescription: 'Not yet approved' });

    const snapshot = await db.supreme.previewReport(MEMBER.admin, OWN, 'CouncilAudit');
    expect(snapshot.period).toMatchObject({ fromDate: '2026-01-01', toDate: '2026-06-30' });
    expect(snapshot.eventSpend).toBe(75.5);
    expect((await db.reports.monthlySummary(OWN, 2026, 3)).finances).not.toHaveProperty('eventSpend');
  });
});
