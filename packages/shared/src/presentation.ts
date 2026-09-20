// =========================================================================
// PRESENTATION LOGIC
// Framework-neutral rules the screens share, kept out of components so they can
// be unit-tested and reused by both apps: urgency, feed filtering, the
// hour/minute picker, reply-tree flattening and date/time formatting.
// =========================================================================
import type { ShiftFeedItem, ThreadMessage } from './contract';
import { daysBetween } from './planning';
import { assertValidHours, HOURS_STEP, subtractMonths, toIsoDate } from './rules';
import type { Council, Shift } from './types';

/** Shifts starting within this many days are shown in Secondary Red. */
export const URGENT_WITHIN_DAYS = 2;
/** An open shift this close, or with nobody signed up, is a priority. */
export const PRIORITY_WITHIN_DAYS = 7;
/** The signup feed looks this far ahead. */
export const FEED_HORIZON_MONTHS = 6;
/** The no-show badge counts this many months back. */
export const NO_SHOW_WINDOW_MONTHS = 12;

// ---- dates ---------------------------------------------------------------

/** Whole days from today to `date` (0 = today, negative = past). */
export const daysUntil = (date: string, today: Date): number => daysBetween(toIsoDate(today), date);

/** True for a shift today or in the next URGENT_WITHIN_DAYS days. */
export function isUrgent(date: string, today: Date): boolean {
  const d = daysUntil(date, today);
  return d >= 0 && d <= URGENT_WITHIN_DAYS;
}

/** The calendar date `months` after `today`, clamped to the end of a shorter month. */
export const addMonths = (today: Date, months: number): string => subtractMonths(today, -months);

/** First day of the rolling no-show window. */
export const noShowWindowStart = (today: Date): string => subtractMonths(today, NO_SHOW_WINDOW_MONTHS);

/** [today, today + 6 months], the range the signup feed covers. */
export const feedWindow = (today: Date): { fromDate: string; toDate: string } => ({
  fromDate: toIsoDate(today),
  toDate: addMonths(today, FEED_HORIZON_MONTHS),
});

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 'Thu, Sep 24'. Hand-formatted so output never depends on the device's Intl support. */
export function formatDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return `${WEEKDAYS[new Date(y, m - 1, d).getDay()]}, ${MONTHS[m - 1]} ${d}`;
}

/** '13:00:00' -> '1:00 PM'. */
export function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

export const formatTimeRange = (start: string, end: string): string => `${formatTime(start)} – ${formatTime(end)}`;

/** 'Thu, Sep 24 · 1:00 PM – 4:00 PM' */
export const formatShiftWhen = (s: Pick<Shift, 'ShiftDate' | 'StartTime' | 'EndTime'>): string =>
  `${formatDate(s.ShiftDate)} · ${formatTimeRange(s.StartTime, s.EndTime)}`;

/** '15295 – St. Jude Council' */
export const councilLabel = (c: Pick<Council, 'CouncilNumber' | 'CouncilName'>): string =>
  `${c.CouncilNumber} – ${c.CouncilName}`;

/** Councils in dropdown order: ascending CouncilNumber, then name (Specifications: "User Interface Behaviors"). */
export const sortCouncils = <T extends Pick<Council, 'CouncilNumber' | 'CouncilName'>>(councils: readonly T[]): T[] =>
  [...councils].sort((a, b) => a.CouncilNumber - b.CouncilNumber || a.CouncilName.localeCompare(b.CouncilName));

// ---- shift feed ----------------------------------------------------------

export type ShiftStatus = 'locked' | 'priority' | 'open';

/**
 * 'locked' once NumberVolunteersSignedUp reaches MinNumberVolunteers (nobody else can join);
 * 'priority' when volunteers are still needed and either nobody has signed up or the shift is close;
 * otherwise 'open'. `remaining` is how many more volunteers it needs.
 */
export function shiftStatus(
  shift: Pick<Shift, 'ShiftDate' | 'MinNumberVolunteers' | 'NumberVolunteersSignedUp'>,
  today: Date,
): { status: ShiftStatus; remaining: number } {
  const remaining = Math.max(0, shift.MinNumberVolunteers - shift.NumberVolunteersSignedUp);
  if (remaining === 0) return { status: 'locked', remaining };
  const close = daysUntil(shift.ShiftDate, today) <= PRIORITY_WITHIN_DAYS;
  return { status: shift.NumberVolunteersSignedUp === 0 || close ? 'priority' : 'open', remaining };
}

/**
 * Applies the council dropdown and the "show full shifts" switch. Full shifts the member already
 * holds stay visible either way, because they belong to the member.
 */
export function visibleFeed(
  items: readonly ShiftFeedItem[],
  filter: { councilId: number | 'all'; showLocked: boolean },
): ShiftFeedItem[] {
  return items.filter((item) => {
    if (filter.councilId !== 'all' && !item.councilIds.includes(filter.councilId)) return false;
    const full = item.shift.NumberVolunteersSignedUp >= item.shift.MinNumberVolunteers;
    return filter.showLocked || !full || item.isSignedUp;
  });
}

// ---- hour / minute picker ------------------------------------------------

export const MINUTE_OPTIONS = [0, 15, 30, 45] as const;
export const MAX_PICKER_HOURS = 24;
export const HOUR_OPTIONS: readonly number[] = Array.from({ length: MAX_PICKER_HOURS + 1 }, (_, i) => i);

/** '00', '15', '30', '45' for the dropdown labels. */
export const padMinutes = (m: number): string => String(m).padStart(2, '0');

/**
 * Converts the picker's selections into the decimal the DataService stores: 1 h 45 m -> 1.75.
 * Every option is a multiple of 15 minutes, so the result is an exact multiple of 0.25.
 */
export function pickerToHours(hours: number, minutes: number): number {
  if (!Number.isInteger(hours) || hours < 0 || hours > MAX_PICKER_HOURS) {
    throw new RangeError(`Hours must be a whole number from 0 to ${MAX_PICKER_HOURS}; received ${hours}.`);
  }
  if (!(MINUTE_OPTIONS as readonly number[]).includes(minutes)) {
    throw new RangeError(`Minutes must be one of ${MINUTE_OPTIONS.map(padMinutes).join(', ')}; received ${minutes}.`);
  }
  return hours + (minutes * HOURS_STEP) / 15;
}

/** The picker selections for a stored value (rounded to the nearest 15 minutes). */
export function hoursToPicker(value: number): { hours: number; minutes: number } {
  const quarters = Math.round(value / HOURS_STEP);
  return { hours: Math.floor(quarters / 4), minutes: (quarters % 4) * 15 };
}

/** Picker -> validated decimal, or an error message when the selection cannot be saved (zero or over a day). */
export function pickerResult(hours: number, minutes: number): { hours: number } | { error: string } {
  try {
    return { hours: assertValidHours(pickerToHours(hours, minutes)) };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

/** 2.25 -> '2 h 15 m'. */
export function formatHours(value: number): string {
  const { hours, minutes } = hoursToPicker(value);
  return minutes === 0 ? `${hours} h` : hours === 0 ? `${minutes} m` : `${hours} h ${minutes} m`;
}

// ---- threads -------------------------------------------------------------

export interface FlatReply {
  item: ThreadMessage;
  /** 0 for a top-level message, 1 for a reply to it, and so on. */
  depth: number;
}

/**
 * Orders a thread for display as a nested conversation: each message is followed by its replies
 * (ParentMessageID), oldest first at every level. A message whose parent is missing or not in the
 * list is shown at the top level, so nothing is ever dropped.
 */
export function flattenReplies(messages: readonly ThreadMessage[]): FlatReply[] {
  const ids = new Set(messages.map((m) => m.message.id));
  const children = new Map<number | null, ThreadMessage[]>();
  for (const m of messages) {
    const parent = m.message.ParentMessageID;
    const key = parent != null && parent !== m.message.id && ids.has(parent) ? parent : null;
    children.set(key, [...(children.get(key) ?? []), m]);
  }
  const out: FlatReply[] = [];
  const seen = new Set<number>();
  const walk = (key: number | null, depth: number) => {
    for (const item of children.get(key) ?? []) {
      if (seen.has(item.message.id)) continue;
      seen.add(item.message.id);
      out.push({ item, depth });
      walk(item.message.id, depth + 1);
    }
  };
  walk(null, 0);
  // A cycle (A replies to B, B replies to A) has no root; surface those messages rather than hide them.
  for (const m of messages) if (!seen.has(m.message.id)) out.push({ item: m, depth: 0 });
  return out;
}

/** True when a message the member received has not been read. */
export const isUnread = (m: ThreadMessage): boolean => m.receipt !== null && m.receipt.ReadAt == null;

/** A short preview of a message body for list rows. */
export function preview(text: string | undefined, max = 80): string {
  const flat = (text ?? '').replace(/\s+/g, ' ').trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1).trimEnd()}…`;
}
