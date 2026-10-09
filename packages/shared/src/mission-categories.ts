// =========================================================================
// FIXED CATEGORY TO SUPREME MISSION AREA COUPLING (Sprint 6L Extension 4, schema version 53; Life added in 54)
// Seven fixed local categories (the Category lookup) each count toward one Supreme Faith in Action mission area,
// stored in Category.SupremeMissionArea by Seed.sql. The coupling is read-only: the event and activity forms show it as
// a badge beside the Local Category picker, and no form offers a way to override it. Meetings carry no category, and a
// grant request keeps its own overridable mission area (CharitableRequest.MissionAreaID).
// =========================================================================
import type { Category } from './types';

/** Supreme's four Faith in Action mission areas. */
export const SUPREME_MISSION_AREAS = ['Faith', 'Family', 'Community', 'Life'] as const;
export type SupremeMissionArea = (typeof SUPREME_MISSION_AREAS)[number];

/** The seven fixed local categories and their Supreme mission areas, exactly as Seed.sql writes them. */
export const FIXED_CATEGORY_MISSION_AREAS: Readonly<Record<string, SupremeMissionArea>> = {
  Fellowship: 'Family',
  Service: 'Community',
  'Faith Building': 'Faith',
  'Parish Community': 'Community',
  Fundraising: 'Community',
  Evangelization: 'Faith',
  Life: 'Life',
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
