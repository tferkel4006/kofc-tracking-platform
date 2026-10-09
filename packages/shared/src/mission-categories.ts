// =========================================================================
// FIXED CATEGORY TO SUPREME MISSION AREA COUPLING (Sprint 6L Extension 4, schema version 53)
// Six fixed local categories (the Category lookup) each count toward one Supreme Faith in Action mission area,
// stored in Category.SupremeMissionArea by Seed.sql. The coupling is read-only: the event, meeting and grant request
// forms show it as a badge beside the Local Category picker, and no form offers a way to override it. A grant
// request's MissionAreaID follows its category's coupling to the council's CouncilMissionArea of the same name.
// =========================================================================
import type { Category, CouncilMissionArea } from './types';
import { BusinessRuleError } from './rules';

/** Supreme's four Faith in Action mission areas. */
export const SUPREME_MISSION_AREAS = ['Faith', 'Family', 'Community', 'Life'] as const;
export type SupremeMissionArea = (typeof SUPREME_MISSION_AREAS)[number];

/** The six fixed local categories and their Supreme mission areas, exactly as Seed.sql writes them. */
export const FIXED_CATEGORY_MISSION_AREAS: Readonly<Record<string, SupremeMissionArea>> = {
  Fellowship: 'Family',
  Service: 'Community',
  'Faith Building': 'Faith',
  'Parish Community': 'Community',
  Fundraising: 'Community',
  Evangelization: 'Faith',
};

/** The fixed category names, in seed order; the lookup grid may not rename or delete them. */
export const FIXED_CATEGORY_NAMES = Object.keys(FIXED_CATEGORY_MISSION_AREAS);

/** Label of the read-only badge the entry forms show beside the Local Category picker. */
export const SUPREME_MISSION_AREA_BADGE_LABEL = 'Supreme Mission Area';

/** The category's stored Supreme mission area, or null for a category with no coupling (or no category). */
export function supremeMissionAreaOf(category: Pick<Category, 'SupremeMissionArea'> | null | undefined): SupremeMissionArea | null {
  const area = category?.SupremeMissionArea;
  return area != null && (SUPREME_MISSION_AREAS as readonly string[]).includes(area) ? (area as SupremeMissionArea) : null;
}

/** Rejects a CategoryID that names no Category row; null and undefined pass (unfiled). */
export function assertCategoryExists(categoryId: number | null | undefined, categories: readonly Pick<Category, 'id'>[]): void {
  if (categoryId == null || categories.some((c) => c.id === categoryId)) return;
  throw new BusinessRuleError('INVALID_INPUT', `No local category with id ${categoryId}.`, { categoryId });
}

/**
 * The council's CouncilMissionArea id matching the category's Supreme mission area by name (ignoring case), or null
 * when the category has no coupling or the council keeps no area of that name.
 */
export function councilMissionAreaForCategory(
  categoryId: number,
  categories: readonly Pick<Category, 'id' | 'SupremeMissionArea'>[],
  areas: readonly Pick<CouncilMissionArea, 'id' | 'CouncilID' | 'MissionAreaName'>[],
  councilId: number,
): number | null {
  const area = supremeMissionAreaOf(categories.find((c) => c.id === categoryId));
  if (area === null) return null;
  return areas.find((a) => a.CouncilID === councilId && a.MissionAreaName.trim().toLowerCase() === area.toLowerCase())?.id ?? null;
}
