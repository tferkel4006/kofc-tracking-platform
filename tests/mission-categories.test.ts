// Sprint 6L Extension 4: the six fixed local categories and their read-only Supreme Mission Area couplings - schema
// 53's Category.SupremeMissionArea, Meeting.CategoryID and CharitableRequest.CategoryID - and the Local Category picker
// with its status badge on the web event, meeting and grant request forms.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  assertCategoryExists,
  councilMissionAreaForCategory,
  FIXED_CATEGORY_MISSION_AREAS,
  FIXED_CATEGORY_NAMES,
  LOOKUP_META,
  SUPREME_MISSION_AREAS,
  supremeMissionAreaOf,
  BusinessRuleError,
  type NewCharitableRequest,
} from '@kofc/shared';
import { TABLES } from '../apps/web/services/generated/schema.generated';
import { drivers, expectRule, MEMBER } from './helpers';

const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');
const OWN = 1;

const form = (over: Partial<NewCharitableRequest> = {}): NewCharitableRequest => ({
  OrganizationName: 'St. Jude Youth Ministry',
  AmountRequested: 800,
  RelationshipTypeID: 1,
  ...over,
});

describe('fixed category coupling rules', () => {
  it('couples each of the six fixed categories to one Supreme mission area', () => {
    expect(FIXED_CATEGORY_NAMES).toEqual(['Fellowship', 'Service', 'Faith Building', 'Parish Community', 'Fundraising', 'Evangelization']);
    for (const area of Object.values(FIXED_CATEGORY_MISSION_AREAS)) expect(SUPREME_MISSION_AREAS).toContain(area);
  });

  it('reads only a known Supreme mission area from a category', () => {
    expect(supremeMissionAreaOf({ SupremeMissionArea: 'Faith' })).toBe('Faith');
    expect(supremeMissionAreaOf({ SupremeMissionArea: 'Patriotism' })).toBeNull();
    expect(supremeMissionAreaOf({ SupremeMissionArea: null })).toBeNull();
    expect(supremeMissionAreaOf(null)).toBeNull();
  });

  it("finds the council's mission area of the coupled name, and nothing for an uncoupled category", () => {
    const categories = [
      { id: 1, SupremeMissionArea: 'Family' },
      { id: 2, SupremeMissionArea: null },
    ];
    const areas = [
      { id: 7, CouncilID: OWN, MissionAreaName: ' family ' },
      { id: 8, CouncilID: 2, MissionAreaName: 'Family' },
    ];
    expect(councilMissionAreaForCategory(1, categories, areas, OWN)).toBe(7);
    expect(councilMissionAreaForCategory(1, categories, areas, 3)).toBeNull();
    expect(councilMissionAreaForCategory(2, categories, areas, OWN)).toBeNull();
    expect(() => assertCategoryExists(9, categories)).toThrow(BusinessRuleError);
    expect(() => assertCategoryExists(null, categories)).not.toThrow();
  });

  it('protects the fixed categories in the lookup grid and keeps the coupling off it', () => {
    expect(LOOKUP_META.Category.protectedValues).toEqual(FIXED_CATEGORY_NAMES);
    expect(LOOKUP_META.Category.fields.map((f) => f.key)).not.toContain('SupremeMissionArea');
    expect(LOOKUP_META.Category.references).toEqual(
      expect.arrayContaining([
        { table: 'Meeting', column: 'CategoryID' },
        { table: 'CharitableRequest', column: 'CategoryID' },
      ]),
    );
  });
});

describe('schema 53', () => {
  it('declares the coupling and category columns and bumps the phone database', () => {
    const columns = (table: string) => TABLES[table].columns.map((c) => c.name);
    expect(columns('Category')).toContain('SupremeMissionArea');
    expect(columns('Meeting')).toContain('CategoryID');
    expect(columns('CharitableRequest')).toContain('CategoryID');
    expect(read('apps/mobile/services/drivers/sqlite.ts')).toMatch(/const SCHEMA_VERSION = (5[3-9]|[6-9]\d);/);
  });
});

describe.each(drivers)('$name driver: fixed categories', (d) => {
  it('seeds the six fixed categories with their Supreme couplings', async () => {
    const db = await d.make();
    const rows = await db.lookups.list('Category');
    expect(Object.fromEntries(rows.map((c) => [c.Category, c.SupremeMissionArea]))).toEqual(FIXED_CATEGORY_MISSION_AREAS);
  });

  it('files a grant request under the mission area its category is coupled to, overriding any area sent', async () => {
    const db = await d.make();
    const categories = await db.lookups.list('Category');
    const areas = await db.charities.listCouncilMissionAreas(OWN);
    const faithBuilding = categories.find((c) => c.Category === 'Faith Building')!;
    const family = areas.find((a) => a.MissionAreaName === 'Family')!;
    const detail = await db.charities.submitCharitableRequest(MEMBER.member, form({ CategoryID: faithBuilding.id, MissionAreaID: family.id }));
    expect(detail.request.CategoryID).toBe(faithBuilding.id);
    expect(detail.missionAreaName).toBe('Faith');
    await expectRule(db.charities.submitCharitableRequest(MEMBER.member, form({ CategoryID: 999 })), 'INVALID_INPUT');
  });

  it('stores a meeting\'s local category and rejects an unknown one', async () => {
    const db = await d.make();
    const service = (await db.lookups.list('Category')).find((c) => c.Category === 'Service')!;
    const meetingType = (await db.lookups.list('MeetingType'))[0].id;
    const meeting = {
      OwnerID: null,
      CouncilID: OWN,
      'Meeting Name': 'Service planning night',
      Date: '2027-03-12',
      'Time Start': '19:00:00',
      'Time End': '20:30:00',
      Location: 'Council Hall',
      MeetingType: meetingType,
    };
    expect((await db.meetings.create({ ...meeting, CategoryID: service.id })).CategoryID).toBe(service.id);
    expect((await db.meetings.create(meeting)).CategoryID ?? null).toBeNull();
    await expectRule(db.meetings.create({ ...meeting, CategoryID: 999 }), 'INVALID_INPUT');
  });
});

describe('web entry forms', () => {
  it('render the Local Category picker with the read-only badge on events, meetings and grant requests', () => {
    for (const page of ['apps/web/app/events/page.tsx', 'apps/web/app/meetings/page.tsx', 'apps/web/app/charities/propose/page.tsx']) {
      expect(read(page)).toContain('<LocalCategoryField');
    }
    const parts = read('apps/web/components/MissionCategoryParts.tsx');
    expect(parts).toContain('role="status"');
    expect(parts).not.toMatch(/<Select[^>]*SupremeMissionArea/);
  });

  it('drops the manual mission area dropdown from the grant request form', () => {
    const page = read('apps/web/app/charities/propose/page.tsx');
    expect(page).not.toContain('Choose a mission area');
    expect(page).not.toContain('MissionAreaID');
  });
});
