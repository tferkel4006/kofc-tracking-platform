// =========================================================================
// PERFORMANCE CHARTS (Sprint 6Z)
// The Growth & Hours Charts page (/performance/charts) shows, for the trailing months ending with the current one:
//   - membership growth velocity: members who joined the council each month (Member.DateJoinedCouncil), with the
//     roster size at each month's end;
//   - council hours: each month's total labor hours (reports.monthlySummary).
// These helpers lay out the month axis and the growth series; the page fetches the hours month by month.
// =========================================================================
import type { Member } from './types';

export interface MonthKey {
  year: number;
  /** 1-12 */
  month: number;
}

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 'Oct 2026' */
export const monthLabel = ({ year, month }: MonthKey): string => `${MONTH_ABBR[month - 1]} ${year}`;

/** The `count` months ending with `end`, oldest first. */
export function trailingMonths(end: MonthKey, count: number): MonthKey[] {
  const out: MonthKey[] = [];
  for (let k = count - 1; k >= 0; k -= 1) {
    const index = end.year * 12 + (end.month - 1) - k;
    out.push({ year: Math.floor(index / 12), month: (index % 12) + 1 });
  }
  return out;
}

export interface GrowthPoint extends MonthKey {
  /** Members whose DateJoinedCouncil falls in the month. */
  joined: number;
  /** Members who had joined by the month's end. */
  rosterSize: number;
}

/**
 * Membership growth for `months` (from trailingMonths). A member with no DateJoinedCouncil is left out of both counts,
 * since the roster does not say when they joined; `undated` reports how many were left out.
 */
export function membershipGrowth(
  members: readonly Pick<Member, 'DateJoinedCouncil'>[],
  months: readonly MonthKey[],
): { points: GrowthPoint[]; undated: number } {
  const keys = members.map((m) => (m.DateJoinedCouncil ?? '').slice(0, 7)).filter((d) => /^\d{4}-\d{2}$/.test(d));
  const pad = (k: MonthKey) => `${k.year}-${String(k.month).padStart(2, '0')}`;
  return {
    points: months.map((k) => ({
      ...k,
      joined: keys.filter((d) => d === pad(k)).length,
      rosterSize: keys.filter((d) => d <= pad(k)).length,
    })),
    undated: members.length - keys.length,
  };
}
