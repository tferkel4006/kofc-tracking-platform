// =========================================================================
// EVENT AND SHIFT PLANNING
// Pure helpers behind the admin planner: field validation, date arithmetic and
// the "copy as a twin" plan. Drivers call these and then only have to store rows.
// =========================================================================
import type { CopyEventOptions, EventChanges, NewEvent, NewShift, ShiftChanges } from './contract';
import {
  assertInteger,
  assertIsoDate,
  assertMoney,
  assertText,
  assertTimeOfDay,
  BusinessRuleError,
  toIsoDate,
} from './rules';
import type { Event, Shift } from './types';

/** Columns a caller may write on Event. The only names a driver interpolates into SQL for an update. */
export const EVENT_COLUMNS = [
  'EventName',
  'EventDescription',
  'OwnerID',
  'StartDate',
  'EndDate',
  'Location',
  'CategoryID',
  'Budget',
  'Spend',
  'FundsRaised-Cash',
  'FundsRaised-Electronic',
  'Highlights',
  'PlannedNumberAttendees',
  'ActualNumberAttendees',
] as const satisfies readonly (keyof NewEvent)[];

export const SHIFT_COLUMNS = [
  'ShiftName',
  'ShiftDescription',
  'ShiftDate',
  'StartTime',
  'EndTime',
  'MinNumberVolunteers',
] as const satisfies readonly (keyof ShiftChanges)[];

const MS_PER_DAY = 86_400_000;

/** Whole calendar days from `from` to `to` (negative when `to` is earlier). Immune to daylight-saving shifts. */
export function daysBetween(from: string, to: string): number {
  const utc = (iso: string) => {
    const [y, m, d] = assertIsoDate(iso, 'Date').split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((utc(to) - utc(from)) / MS_PER_DAY);
}

/** The calendar date `days` after `date` (before, when negative). */
export function addDays(date: string, days: number): string {
  const [y, m, d] = assertIsoDate(date, 'Date').split('-').map(Number);
  return toIsoDate(new Date(y, m - 1, d + days));
}

const REQUIRED_EVENT_FIELDS = [
  'EventName',
  'EventDescription',
  'OwnerID',
  'StartDate',
  'EndDate',
  'Location',
  'CategoryID',
] as const;

const NULLABLE_MONEY = ['Budget', 'Spend', 'FundsRaised-Cash', 'FundsRaised-Electronic'] as const;
const NULLABLE_COUNTS = ['PlannedNumberAttendees', 'ActualNumberAttendees'] as const;
const FIELD_LABELS: Record<(typeof NULLABLE_MONEY)[number] | (typeof NULLABLE_COUNTS)[number], string> = {
  Budget: 'Budget',
  Spend: 'Spend',
  'FundsRaised-Cash': 'Cash funds raised',
  'FundsRaised-Electronic': 'Electronic funds raised',
  PlannedNumberAttendees: 'Planned attendees',
  ActualNumberAttendees: 'Actual attendees',
};

/**
 * Validates the fields present in `input` (undefined means "not supplied") and returns them cleaned.
 * `null` is kept for the optional columns so they can be cleared. Rejects unknown fields.
 */
export function cleanEventFields(input: EventChanges): EventChanges {
  const allowed = new Set<string>(EVENT_COLUMNS);
  for (const key of Object.keys(input)) {
    if (!allowed.has(key)) {
      throw new BusinessRuleError('INVALID_INPUT', `An event has no field "${key}".`, { field: key });
    }
  }
  const has = (k: keyof NewEvent) => input[k] !== undefined;
  const out: EventChanges = {};
  if (has('EventName')) out.EventName = assertText(input.EventName, 'Event name', 100);
  if (has('EventDescription')) out.EventDescription = assertText(input.EventDescription, 'Event description', 255, false);
  if (has('Location')) out.Location = assertText(input.Location, 'Location', 255);
  if (has('OwnerID')) out.OwnerID = assertInteger(input.OwnerID, 'Event owner', 1);
  if (has('CategoryID')) out.CategoryID = assertInteger(input.CategoryID, 'Event category', 1);
  if (has('StartDate')) out.StartDate = assertIsoDate(input.StartDate, 'Start date');
  if (has('EndDate')) out.EndDate = assertIsoDate(input.EndDate, 'End date');
  for (const key of NULLABLE_MONEY) {
    if (has(key)) out[key] = input[key] === null ? null : assertMoney(input[key], FIELD_LABELS[key]);
  }
  for (const key of NULLABLE_COUNTS) {
    if (has(key)) out[key] = input[key] === null ? null : assertInteger(input[key], FIELD_LABELS[key], 0);
  }
  if (has('Highlights')) out.Highlights = input.Highlights === null ? null : assertText(input.Highlights, 'Highlights', 10_000, false);
  return out;
}

/** A complete new event: every required field present and valid, End on or after Start. */
export function cleanNewEvent(input: NewEvent): NewEvent {
  const missing = REQUIRED_EVENT_FIELDS.filter((k) => input[k] === undefined || input[k] === null);
  if (missing.length > 0) {
    throw new BusinessRuleError('INVALID_INPUT', `An event needs ${missing.join(', ')}.`, { missing });
  }
  return cleanEventFields(input) as NewEvent;
}

/** Validates the shift fields present in `input`. Unknown fields are rejected. */
export function cleanShiftFields(input: ShiftChanges & { EventID?: number }): ShiftChanges & { EventID?: number } {
  const allowed = new Set<string>([...SHIFT_COLUMNS, 'EventID']);
  for (const key of Object.keys(input)) {
    if (!allowed.has(key)) throw new BusinessRuleError('INVALID_INPUT', `A shift has no field "${key}".`, { field: key });
  }
  const out: ShiftChanges & { EventID?: number } = {};
  if (input.EventID !== undefined) out.EventID = assertInteger(input.EventID, 'Shift event', 1);
  if (input.ShiftName !== undefined) out.ShiftName = assertText(input.ShiftName, 'Shift name', 100);
  if (input.ShiftDescription !== undefined) out.ShiftDescription = assertText(input.ShiftDescription, 'Shift description', 255, false);
  if (input.ShiftDate !== undefined) out.ShiftDate = assertIsoDate(input.ShiftDate, 'Shift date');
  if (input.StartTime !== undefined) out.StartTime = assertTimeOfDay(input.StartTime, 'Shift start time');
  if (input.EndTime !== undefined) out.EndTime = assertTimeOfDay(input.EndTime, 'Shift end time');
  if (input.MinNumberVolunteers !== undefined) {
    out.MinNumberVolunteers = assertInteger(input.MinNumberVolunteers, 'Volunteers needed', 1);
  }
  return out;
}

/** A shift must fall on one of its event's days. */
export function assertShiftInsideEvent(shiftDate: string, event: Pick<Event, 'id' | 'EventName' | 'StartDate' | 'EndDate'>): void {
  if (shiftDate < event.StartDate || shiftDate > event.EndDate) {
    throw new BusinessRuleError(
      'INVALID_INPUT',
      `Shift date ${shiftDate} is outside "${event.EventName}", which runs ${event.StartDate} to ${event.EndDate}.`,
      { eventId: event.id, shiftDate, startDate: event.StartDate, endDate: event.EndDate },
    );
  }
}

/** At least one linked council, each a positive id, no repeats. */
export function cleanCouncilIds(councilIds: readonly number[]): number[] {
  if (councilIds.length === 0) {
    throw new BusinessRuleError('INVALID_INPUT', 'An event must be linked to at least one council.', {});
  }
  return [...new Set(councilIds.map((id) => assertInteger(id, 'Council id', 1)))];
}

/**
 * What a "copy as a twin" produces: the same event and shifts moved so the first day is
 * `options.startDate`. Signups, time and the post-event ledger are deliberately left behind.
 */
export function planEventCopy(
  event: Event,
  shifts: readonly Shift[],
  options: CopyEventOptions,
): { event: NewEvent; shifts: Omit<NewShift, 'EventID'>[] } {
  const startDate = assertIsoDate(options.startDate, 'New start date');
  const offset = daysBetween(event.StartDate, startDate);
  const copy: NewEvent = {
    EventName: options.eventName === undefined ? event.EventName : assertText(options.eventName, 'Event name', 100),
    EventDescription: event.EventDescription,
    OwnerID: options.ownerId ?? event.OwnerID,
    StartDate: startDate,
    EndDate: addDays(event.EndDate, offset),
    Location: event.Location,
    CategoryID: event.CategoryID,
  };
  if (event.Budget != null) copy.Budget = event.Budget;
  if (event.PlannedNumberAttendees != null) copy.PlannedNumberAttendees = event.PlannedNumberAttendees;
  return {
    event: copy,
    shifts: shifts.map((s) => ({
      ShiftName: s.ShiftName,
      ShiftDescription: s.ShiftDescription,
      ShiftDate: addDays(s.ShiftDate, offset),
      StartTime: s.StartTime,
      EndTime: s.EndTime,
      MinNumberVolunteers: s.MinNumberVolunteers,
    })),
  };
}

/** A complete new shift: every field present and valid. NumberVolunteersSignedUp is not accepted. */
export function cleanNewShift(input: NewShift): NewShift {
  const required = ['ShiftName', 'ShiftDate', 'StartTime', 'EndTime', 'EventID', 'MinNumberVolunteers'] as const;
  const missing = required.filter((k) => input[k] === undefined || input[k] === null);
  if (missing.length > 0) throw new BusinessRuleError('INVALID_INPUT', `A shift needs ${missing.join(', ')}.`, { missing });
  return cleanShiftFields(input) as NewShift;
}
