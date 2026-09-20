// =========================================================================
// KNIGHTS OF COLUMBUS BUSINESS RULES
// Pure guard functions shared by every DataService driver (SQLite on mobile,
// in-memory on web). Each guard throws a BusinessRuleError that names the rule
// and carries the offending values, and each is called BEFORE any write so a
// rejected request never changes the database.
//
// Every date-window guard takes `now` so tests can pin the clock.
// Dates are local-time YYYY-MM-DD strings, matching the schema's DATE columns.
// =========================================================================
import type { Shift } from './types';

/** Time entries move in 15-minute steps (Blueprint: "Time Increments & History Boundaries"). */
export const HOURS_STEP = 0.25;
/** No single entry can exceed one day. */
export const MAX_HOURS_PER_ENTRY = 24;
/** Activity time may be logged or changed this many months back. */
export const ACTIVITY_HISTORY_MONTHS = 6;
/** Retrospective shift time may be reported this many months back. */
export const SHIFT_HISTORY_MONTHS = 3;
export const MIN_PASSWORD_LENGTH = 8;
/**
 * Credentials.Password value of a pre-provisioned member who has not chosen a
 * password yet. Member.CredentialID is NOT NULL, so every preloaded member
 * already owns a Credentials row; auth.signUp fills this placeholder in.
 * It can never equal a SHA-256 digest, so it can never sign in.
 */
export const UNREGISTERED_PASSWORD = '';

export type BusinessRuleCode =
  | 'INVALID_HOURS'
  | 'HOURS_OUT_OF_RANGE'
  | 'INVALID_HOURS_INCREMENT'
  | 'INVALID_DATE'
  | 'ACTIVITY_DATE_TOO_OLD'
  | 'SHIFT_REPORT_TOO_OLD'
  | 'SHIFT_LOCKED'
  | 'SHIFT_NOT_FOUND'
  | 'MEMBER_NOT_FOUND'
  | 'ACTIVITY_NOT_FOUND'
  | 'ALREADY_SIGNED_UP'
  | 'NOT_SIGNED_UP'
  | 'PASSWORD_TOO_SHORT'
  | 'ALREADY_REGISTERED'
  | 'CREDENTIALS_MISSING';

/** A request the business rules refuse. `details` holds the values that caused it. */
export class BusinessRuleError extends Error {
  constructor(
    readonly code: BusinessRuleCode,
    message: string,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'BusinessRuleError';
  }
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Local-time YYYY-MM-DD. */
export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * The calendar date `months` before `today`, clamped to the end of a shorter
 * month (2026-08-31 minus 6 months is 2026-02-28).
 */
export function subtractMonths(today: Date, months: number): string {
  const total = today.getFullYear() * 12 + today.getMonth() - months;
  const year = Math.floor(total / 12);
  const month = total - year * 12;
  const lastDay = new Date(year, month + 1, 0).getDate();
  return toIsoDate(new Date(year, month, Math.min(today.getDate(), lastDay)));
}

/** Returns `value` when it is a real calendar date in YYYY-MM-DD form, otherwise throws. */
export function assertIsoDate(value: unknown, label: string): string {
  const m = typeof value === 'string' ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value) : null;
  if (m) {
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const date = new Date(y, mo - 1, d);
    if (date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d) return value as string;
  }
  throw new BusinessRuleError('INVALID_DATE', `${label} must be a real calendar date in YYYY-MM-DD form; received ${JSON.stringify(value)}.`, {
    value,
  });
}

/** Hours must be a number, greater than 0, at most 24, and an exact multiple of 0.25. */
export function assertValidHours(hours: unknown, label = 'Hours'): number {
  if (typeof hours !== 'number' || !Number.isFinite(hours)) {
    throw new BusinessRuleError('INVALID_HOURS', `${label} must be a number; received ${String(hours)}.`, { hours });
  }
  if (hours <= 0 || hours > MAX_HOURS_PER_ENTRY) {
    throw new BusinessRuleError(
      'HOURS_OUT_OF_RANGE',
      `${label} must be greater than 0 and at most ${MAX_HOURS_PER_ENTRY}; received ${hours}.`,
      { hours },
    );
  }
  // Multiples of 0.25 are exact in binary floating point, so this test has no rounding slack.
  if (hours % HOURS_STEP !== 0) {
    const below = Math.floor(hours / HOURS_STEP) * HOURS_STEP;
    throw new BusinessRuleError(
      'INVALID_HOURS_INCREMENT',
      `${label} must be an exact multiple of ${HOURS_STEP} (15-minute steps); received ${hours}. Nearest valid values: ${below} or ${below + HOURS_STEP}.`,
      { hours, step: HOURS_STEP },
    );
  }
  return hours;
}

/** Activity time can be logged or changed for dates up to 6 months back. */
export function assertActivityDateAllowed(activityDate: unknown, now: Date): string {
  const date = assertIsoDate(activityDate, 'Activity date');
  const earliest = subtractMonths(now, ACTIVITY_HISTORY_MONTHS);
  if (date < earliest) {
    throw new BusinessRuleError(
      'ACTIVITY_DATE_TOO_OLD',
      `Activity date ${date} is more than ${ACTIVITY_HISTORY_MONTHS} months in the past; the earliest date you can log or change is ${earliest} (today is ${toIsoDate(now)}).`,
      { activityDate: date, earliest, today: toIsoDate(now) },
    );
  }
  return date;
}

/** Retrospective shift time can be reported for shifts up to 3 months back. */
export function assertShiftReportAllowed(shiftDate: string, now: Date, shiftId?: number): void {
  const earliest = subtractMonths(now, SHIFT_HISTORY_MONTHS);
  if (shiftDate < earliest) {
    throw new BusinessRuleError(
      'SHIFT_REPORT_TOO_OLD',
      `Shift${shiftId === undefined ? '' : ` ${shiftId}`} took place on ${shiftDate}, more than ${SHIFT_HISTORY_MONTHS} months ago; the earliest shift date you can report time for is ${earliest} (today is ${toIsoDate(now)}).`,
      { shiftId, shiftDate, earliest, today: toIsoDate(now) },
    );
  }
}

/** A shift is locked once NumberVolunteersSignedUp reaches MinNumberVolunteers. */
export function assertShiftHasRoom(
  shift: Pick<Shift, 'id' | 'ShiftName' | 'MinNumberVolunteers' | 'NumberVolunteersSignedUp'>,
): void {
  if (shift.NumberVolunteersSignedUp >= shift.MinNumberVolunteers) {
    throw new BusinessRuleError(
      'SHIFT_LOCKED',
      `Shift "${shift.ShiftName}" (id ${shift.id}) is locked: ${shift.NumberVolunteersSignedUp} of ${shift.MinNumberVolunteers} volunteers are already signed up.`,
      {
        shiftId: shift.id,
        signedUp: shift.NumberVolunteersSignedUp,
        limit: shift.MinNumberVolunteers,
      },
    );
  }
}

export function assertPasswordAcceptable(password: unknown): string {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    throw new BusinessRuleError(
      'PASSWORD_TOO_SHORT',
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters long; received ${typeof password === 'string' ? password.length : 0}.`,
      { minLength: MIN_PASSWORD_LENGTH },
    );
  }
  return password;
}

/** True for a lowercase hex SHA-256 digest, the format stored in Credentials.Password. */
export const isSha256Hex = (value: string): boolean => /^[0-9a-f]{64}$/.test(value);
