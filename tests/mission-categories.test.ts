// Sprint 6L Extensions 4-5: the seven fixed local categories and their read-only Supreme Mission Area couplings -
// Category.SupremeMissionArea (schema 53, Life added in 54) - and the Local Category picker with its status badge on the
// web event and activity forms. Meetings carry no category, and the Propose Charity Grant form keeps its own
// overridable Mission area drop-down.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FIXED_CATEGORY_MISSION_AREAS, FIXED_CATEGORY_NAMES, LOOKUP_META, SUPREME_MISSION_AREAS, supremeMissionAreaOf, type NewCharitableRequest } from '@kofc/shared';
import { TABLES } from '../apps/web/services/generated/schema.generated';
import { drivers, MEMBER } from './helpers';

const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');
const OWN = 1;

const form = (over: Partial<NewCharitableRequest> = {}): NewCharitableRequest => ({
  OrganizationName: 'St. Jude Youth Ministry',
  AmountRequested: 800,
  RelationshipTypeID: 1,
  ...over,
});

describe('fixed category coupling rules', () => {
  it('couples each of the seven fixed categories to one Supreme mission area, Life to Life', () => {
    expect(FIXED_CATEGORY_NAMES).toEqual(['Fellowship', 'Service', 'Faith Building', 'Parish Community', 'Fundraising', 'Evangelization', 'Life']);
    expect(FIXED_CATEGORY_MISSION_AREAS.Life).toBe('Life');
    for (const area of Object.values(FIXED_CATEGORY_MISSION_AREAS)) expect(SUPREME_MISSION_AREAS).toContain(area);
    expect(new Set(Object.values(FIXED_CATEGORY_MISSION_AREAS))).toEqual(new Set(SUPREME_MISSION_AREAS));
  });

  it('reads only a known Supreme mission area from a category', () => {
    expect(supremeMissionAreaOf({ SupremeMissionArea: 'Life' })).toBe('Life');
    expect(supremeMissionAreaOf({ SupremeMissionArea: 'Patriotism' })).toBeNull();
    expect(supremeMissionAreaOf({ SupremeMissionArea: null })).toBeNull();
    expect(supremeMissionAreaOf(null)).toBeNull();
  });

  it('protects the fixed categories in the lookup grid, keeps the coupling off it and points only events and activities at it', () => {
    expect(LOOKUP_META.Category.protectedValues).toEqual(FIXED_CATEGORY_NAMES);
    expect(LOOKUP_META.Category.fields.map((f) => f.key)).not.toContain('SupremeMissionArea');
    expect(LOOKUP_META.Category.references).toEqual([
      { table: 'Event', column: 'CategoryID' },
      { table: 'Activities', column: 'CategoryID' },
    ]);
  });
});

describe('schema 54 taxonomy', () => {
  it('keeps the coupling column, drops the meeting and grant request category columns and bumps the phone database', () => {
    const columns = (table: string) => TABLES[table].columns.map((c) => c.name);
    expect(columns('Category')).toContain('SupremeMissionArea');
    expect(columns('Meeting')).not.toContain('CategoryID');
    expect(columns('CharitableRequest')).not.toContain('CategoryID');
    expect(read('apps/mobile/services/drivers/sqlite.ts')).toMatch(/const SCHEMA_VERSION = (5[4-9]|[6-9]\d);/);
  });
});

describe.each(drivers)('$name driver: fixed categories', (d) => {
  it('seeds the seven fixed categories with their Supreme couplings, Life last', async () => {
    const db = await d.make();
    const rows = await db.lookups.list('Category');
    expect(Object.fromEntries(rows.map((c) => [c.Category, c.SupremeMissionArea]))).toEqual(FIXED_CATEGORY_MISSION_AREAS);
    expect(rows.at(-1)).toMatchObject({ id: 7, Category: 'Life', SupremeMissionArea: 'Life' });
  });

  it("keeps the grant request's own mission area, as the member chose it", async () => {
    const db = await d.make();
    const family = (await db.charities.listCouncilMissionAreas(OWN)).find((a) => a.MissionAreaName === 'Family')!;
    const detail = await db.charities.submitCharitableRequest(MEMBER.member, form({ MissionAreaID: family.id }));
    expect(detail.request.MissionAreaID).toBe(family.id);
    expect(detail.missionAreaName).toBe('Family');
  });
});

describe('web entry forms', () => {
  it('render the Local Category picker with the read-only badge on events and activities only', () => {
    expect(read('apps/web/app/events/page.tsx')).toContain('<LocalCategoryField');
    expect(read('apps/web/app/activities/page.tsx')).toContain('<LocalCategoryPicker');
    expect(read('apps/web/app/meetings/page.tsx')).not.toContain('LocalCategory');
    expect(read('apps/web/app/charities/propose/page.tsx')).not.toContain('LocalCategory');
    const parts = read('apps/web/components/MissionCategoryParts.tsx');
    expect(parts).toContain('role="status"');
    expect(parts).not.toMatch(/<Select[^>]*SupremeMissionArea/);
  });

  it('restores the overridable Mission area drop-down on the grant request form', () => {
    const page = read('apps/web/app/charities/propose/page.tsx');
    expect(page).toContain('Choose a mission area');
    expect(page).toContain("set('MissionAreaID', e.target.value)");
    expect(page).not.toContain('CategoryID');
  });
});
