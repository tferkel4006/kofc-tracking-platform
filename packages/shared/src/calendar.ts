// =========================================================================
// VISUAL MASTER CALENDAR (Sprint 5Q)
// Pure helpers behind the portal's /calendar page: which dates a Month, Week or
// Day view shows, how the view steps backwards and forwards, and the brand tone
// of each item (Blueprint colour manual):
//   meeting - formal assemblies, council sessions, officer meetings: solid navy
//   urgent  - a shift starting within URGENT_WITHIN_HOURS: red highlight
//   needs   - a shift still short of volunteers: gold border
//   normal  - everything else: navy outline
// =========================================================================
import type { CalendarEntry } from './contract';
import { addDays, daysBetween } from './planning';
import { assertIsoDate, toIsoDate } from './rules';
import type { Shift } from './types';

export type CalendarView = 'month' | 'week' | 'day';
export type CalendarTone = 'meeting' | 'urgent' | 'needs' | 'normal';

/** A shift starting this many hours from now or sooner is urgent. */
export const URGENT_WITHIN_HOURS = 48;

const MS_PER_HOUR = 3_600_000;

const parts = (date: string): [number, number, number] => assertIsoDate(date, 'Calendar date').split('-').map(Number) as [number, number, number];

/** 0 (Sunday) to 6 (Saturday). */
const weekday = (date: string): number => {
  const [y, m, d] = parts(date);
  return new Date(y, m - 1, d).getDay();
};

/** The Sunday on or before `date`. */
export const startOfWeek = (date: string): string => addDays(date, -weekday(date));

/** The first of `date`'s month. */
export const startOfMonth = (date: string): string => `${date.slice(0, 7)}-01`;

/**
 * Every date the view shows around `anchor`, in order: a Day view is the anchor itself, a Week view Sunday to
 * Saturday, and a Month view the whole weeks (Sunday first) covering the anchor's month, 4 to 6 rows of 7.
 */
export function calendarDays(view: CalendarView, anchor: string): string[] {
  assertIsoDate(anchor, 'Calendar date');
  if (view === 'day') return [anchor];
  let first: string;
  let count: number;
  if (view === 'week') {
    first = startOfWeek(anchor);
    count = 7;
  } else {
    const monthStart = startOfMonth(anchor);
    const [y, m] = parts(monthStart);
    const monthEnd = toIsoDate(new Date(y, m, 0));
    first = startOfWeek(monthStart);
    count = (daysBetween(first, addDays(startOfWeek(monthEnd), 6)) + 1);
  }
  return Array.from({ length: count }, (_, i) => addDays(first, i));
}

/** The anchor one view-length before (`step` -1) or after (+1): a month (to its first), a week or a day. */
export function stepCalendar(view: CalendarView, anchor: string, step: number): string {
  if (view === 'day') return addDays(anchor, step);
  if (view === 'week') return addDays(anchor, 7 * step);
  const [y, m] = parts(anchor);
  return toIsoDate(new Date(y, m - 1 + step, 1));
}

/** Items on the calendar that cover `date` (an event spanning several days appears on each). */
export const entriesOn = (entries: readonly CalendarEntry[], date: string): CalendarEntry[] =>
  entries.filter((e) => e.startDate <= date && e.endDate >= date);

/** The local date-time a shift starts. */
export function shiftStart(shift: Pick<Shift, 'ShiftDate' | 'StartTime'>): Date {
  const [y, m, d] = parts(shift.ShiftDate);
  const [hh = 0, mm = 0] = shift.StartTime.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm);
}

/** True for a shift starting between now and URGENT_WITHIN_HOURS from now. */
export function isShiftUrgent(shift: Pick<Shift, 'ShiftDate' | 'StartTime'>, now: Date): boolean {
  const hours = (shiftStart(shift).getTime() - now.getTime()) / MS_PER_HOUR;
  return hours >= 0 && hours <= URGENT_WITHIN_HOURS;
}

/** True while fewer volunteers are signed up than the shift calls for. */
export const shiftNeedsVolunteers = (shift: Pick<Shift, 'NumberVolunteersSignedUp' | 'MinNumberVolunteers'>): boolean =>
  shift.NumberVolunteersSignedUp < shift.MinNumberVolunteers;

/**
 * The brand tone of a calendar item. Meetings are always navy. An event takes the most pressing tone of `shifts`
 * (pass the event's shifts on the day shown): urgent before short of volunteers; shifts already started or past
 * never count as short.
 */
export function calendarTone(entry: CalendarEntry, shifts: readonly Shift[], now: Date): CalendarTone {
  if (entry.kind === 'meeting') return 'meeting';
  if (shifts.some((s) => isShiftUrgent(s, now))) return 'urgent';
  if (shifts.some((s) => shiftNeedsVolunteers(s) && shiftStart(s).getTime() > now.getTime())) return 'needs';
  return 'normal';
}
