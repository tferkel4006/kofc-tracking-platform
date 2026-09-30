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
import type {
  DonationChanges,
  DonationMethodKind,
  DonationTotals,
  EventChanges,
  MeetingHoursEntry,
  MemberSkillInput,
  MemberTrainingInput,
  NewDonation,
  NewMember,
} from './contract';
import type { Donation, Meeting, MeetingResponseStatus, Member, Shift } from './types';

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
  | 'CREDENTIALS_MISSING'
  | 'INVALID_INPUT'
  | 'EVENT_NOT_FOUND'
  | 'MEETING_NOT_FOUND'
  | 'NOT_INVITED'
  | 'THREAD_NOT_FOUND'
  | 'MESSAGE_NOT_FOUND'
  | 'SHIFT_HAS_SIGNUPS'
  | 'LOOKUP_IN_USE'
  | 'LOOKUP_PROTECTED'
  | 'DONATION_METHOD_NOT_ENABLED'
  | 'NO_RECIPIENTS'
  | 'ADMIN_REQUIRED'
  | 'SUPER_ADMIN_REQUIRED'
  | 'COUNCIL_ACCESS_DENIED'
  | 'FINANCE_OFFICER_REQUIRED'
  | 'RECORD_NOT_FOUND'
  | 'RECORD_IN_USE'
  | 'FUNDS_MANAGED_BY_DONATIONS'
  | 'NO_SHOW_HAS_HOURS'
  | 'EXPENSE_STATUS_CONFLICT'
  | 'SELF_APPROVAL_BLOCKED'
  | 'SELF_PAYOUT_BLOCKED'
  | 'NOMINATIONS_WINDOW_CLOSED'
  | 'ROLE_NOT_ON_BALLOT'
  | 'ROLE_NOT_ELECTED'
  | 'ROLE_NOT_APPOINTED'
  | 'ROLE_NOT_HELD'
  | 'ROLE_OCCUPIED'
  | 'ALREADY_NOMINATED'
  | 'NOT_ACTIVE_COUNCIL_MEMBER'
  | 'GRAND_KNIGHT_TERM_CONTINUES'
  | 'GRAND_KNIGHT_REQUIRED'
  | 'CHARITY_ALREADY_REGISTERED'
  | 'PROPOSAL_STATUS_CONFLICT'
  | 'BUDGET_LINE_EXISTS'
  | 'BUDGET_YEAR_FINALIZED'
  | 'BUDGET_WINDOW_NOT_OPEN'
  | 'BUDGET_YEAR_APPROVED'
  | 'VETTING_AUTHORITY_REQUIRED'
  | 'SELF_VETTING_BLOCKED'
  | 'REQUEST_STATUS_CONFLICT';

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

/**
 * A request the caller's privileges do not allow. A BusinessRuleError so screens that already report rule
 * failures report this one too; nothing has been written when it throws. The code names the tier needed.
 */
export class SecurityPrivilegeError extends BusinessRuleError {
  constructor(
    code:
      | 'ADMIN_REQUIRED'
      | 'SUPER_ADMIN_REQUIRED'
      | 'COUNCIL_ACCESS_DENIED'
      | 'FINANCE_OFFICER_REQUIRED'
      | 'GRAND_KNIGHT_REQUIRED'
      | 'VETTING_AUTHORITY_REQUIRED',
    message: string,
    details: Record<string, unknown> = {},
  ) {
    super(code, message, details);
    this.name = 'SecurityPrivilegeError';
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

// ---- field validators for the maintenance screens ---------------------------
// Shared by every driver so a bad value is refused with the same message everywhere.

const invalid = (message: string, details: Record<string, unknown> = {}) =>
  new BusinessRuleError('INVALID_INPUT', message, details);

/** Trimmed text of at most `maxLength` characters; `required` rejects an empty result. */
export function assertText(value: unknown, label: string, maxLength: number, required = true): string {
  if (typeof value !== 'string') throw invalid(`${label} must be text; received ${JSON.stringify(value)}.`, { label });
  const text = value.trim();
  if (required && text === '') throw invalid(`${label} is required.`, { label });
  if (text.length > maxLength) {
    throw invalid(`${label} must be at most ${maxLength} characters; received ${text.length}.`, { label, maxLength });
  }
  return text;
}

/** A whole number of at least `min`. */
export function assertInteger(value: unknown, label: string, min = 0): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min) {
    throw invalid(`${label} must be a whole number of at least ${min}; received ${String(value)}.`, { label, min });
  }
  return value;
}

/** A non-negative amount of money with at most two decimal places. */
export function assertMoney(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || Math.abs(value * 100 - Math.round(value * 100)) > 1e-6) {
    throw invalid(`${label} must be an amount of 0 or more with at most two decimal places; received ${String(value)}.`, {
      label,
    });
  }
  return Math.round(value * 100) / 100;
}

/** HH:MM or HH:MM:SS (24-hour), returned as HH:MM:SS. */
export function assertTimeOfDay(value: unknown, label: string): string {
  const m = typeof value === 'string' ? /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value) : null;
  if (m && Number(m[1]) < 24 && Number(m[2]) < 60 && Number(m[3] ?? 0) < 60) return `${m[1]}:${m[2]}:${m[3] ?? '00'}`;
  throw invalid(`${label} must be a 24-hour time such as 09:30 or 09:30:00; received ${JSON.stringify(value)}.`, { label });
}

/** An event may not end before it starts. */
export function assertEventRange(startDate: string, endDate: string): void {
  if (endDate < startDate) {
    throw invalid(`The event ends (${endDate}) before it starts (${startDate}).`, { startDate, endDate });
  }
}

// ---- Phase 2: shift time, meeting hours, donations, member profiles ----------

/**
 * Specifications: "Time reported against a shift can be more than the shift's duration."
 * A shift's StartTime-EndTime is its planned layout, not a cap: assertValidHours (15-minute
 * steps, at most 24 per entry) is the only bound on hours logged against a shift.
 */
export const SHIFT_DURATION_IS_A_CEILING = false;

/**
 * Hours from `start` to `end` (HH:MM or HH:MM:SS), rounded to 2 decimals. An end before the
 * start is taken to run past midnight, so 22:00-01:00 is 3 hours; equal times are 0.
 */
export function hoursBetween(start: string, end: string): number {
  const minutes = (t: string) => {
    const [h = 0, m = 0, s = 0] = t.split(':').map(Number);
    return h * 60 + m + s / 60;
  };
  let span = minutes(end) - minutes(start);
  if (span < 0) span += 24 * 60;
  return Math.round((span / 60) * 100) / 100;
}

/** Length of a meeting in hours, from its Time Start and Time End. */
export const meetingDurationHours = (m: Pick<Meeting, 'Time Start' | 'Time End'>): number =>
  hoursBetween(m['Time Start'], m['Time End']);

/**
 * Meeting Hour Aggregator: orders attended meetings oldest first and adds a running total.
 * Callers pass only meetings whose MeetingInvites row has Attended = 1.
 */
export function aggregateMeetingHours(
  attended: readonly Pick<Meeting, 'id' | 'Meeting Name' | 'Date' | 'Time Start' | 'Time End'>[],
): { totalHours: number; meetings: MeetingHoursEntry[] } {
  const sorted = [...attended].sort(
    (a, b) => a.Date.localeCompare(b.Date) || a['Time Start'].localeCompare(b['Time Start']) || a.id - b.id,
  );
  let running = 0;
  const meetings = sorted.map((m) => {
    const hours = meetingDurationHours(m);
    running = Math.round((running + hours) * 100) / 100;
    return { meetingId: m.id, meetingName: m['Meeting Name'], date: m.Date, hours, runningTotal: running };
  });
  return { totalHours: running, meetings };
}

/**
 * Sprint 5Y-5: the default hours a member reports for a shift, from its StartTime-EndTime (an overnight shift runs
 * past midnight, as in hoursBetween), rounded to the nearest HOURS_STEP so the default always passes
 * assertValidHours' 15-minute rule. The member may still report more or less (SHIFT_DURATION_IS_A_CEILING).
 */
export const shiftDefaultLengthHours = (shift: Pick<Shift, 'StartTime' | 'EndTime'>): number =>
  Math.round(hoursBetween(shift.StartTime, shift.EndTime) / HOURS_STEP) * HOURS_STEP;

/** The RSVP answers an invitee may give (MeetingInvites.ResponseStatus, Sprint 5Y-5); 'NoResponse' is the default. */
export const MEETING_RESPONSE_STATUSES = ['NoResponse', 'Accepted', 'Declined'] as const satisfies readonly MeetingResponseStatus[];

/** Rejects INVALID_INPUT for anything but one of MEETING_RESPONSE_STATUSES. */
export function assertMeetingResponseStatus(value: unknown): MeetingResponseStatus {
  if ((MEETING_RESPONSE_STATUSES as readonly unknown[]).includes(value)) return value as MeetingResponseStatus;
  throw new BusinessRuleError(
    'INVALID_INPUT',
    `A meeting response must be ${MEETING_RESPONSE_STATUSES.join(', ')}; received ${JSON.stringify(value)}.`,
    { field: 'ResponseStatus', value },
  );
}

/** DonationMethod names the phone UI treats specially; any other name a Super Admin adds is 'other'. */
const DONATION_METHOD_KINDS: Record<string, DonationMethodKind> = {
  cash: 'cash',
  'credit card': 'card',
  venmo: 'qr',
  zelle: 'qr',
  zeffy: 'qr',
  parishsoft: 'qr',
  'physical items': 'item',
};

export const donationMethodKind = (methodName: string): DonationMethodKind =>
  DONATION_METHOD_KINDS[methodName.trim().toLowerCase()] ?? 'other';

/** Trimmed optional text; undefined, null or blank becomes null. */
export const optionalText = (value: unknown, label: string, maxLength: number): string | null => {
  if (value === undefined || value === null) return null;
  const text = assertText(value, label, maxLength, false);
  return text === '' ? null : text;
};

export type CleanDonation = Omit<NewDonation, 'DonationDate'> & { DonationDate: string };

/**
 * Validates a new donation's own fields and fills DonationDate with today. The driver still checks
 * the ids against the database (council, enabled method, the council's type, the council's event).
 */
export function cleanNewDonation(input: NewDonation, now: Date): CleanDonation {
  const today = toIsoDate(now);
  const date = input.DonationDate === undefined ? today : assertIsoDate(input.DonationDate, 'Donation date');
  if (date > today) {
    throw invalid(`Donation date ${date} is in the future (today is ${today}).`, { donationDate: date, today });
  }
  const amount = assertMoney(input.DonationAmount, 'Donation amount');
  if (amount === 0) throw invalid('Donation amount must be greater than 0.', { label: 'Donation amount' });
  return {
    CouncilID: assertInteger(input.CouncilID, 'Council', 1),
    DonationDate: date,
    DonationMethodID: assertInteger(input.DonationMethodID, 'Donation method', 1),
    DonationTypeID: assertInteger(input.DonationTypeID, 'Donation type', 1),
    Donor: optionalText(input.Donor, 'Donor name', 100),
    DonationDesciption: optionalText(input.DonationDesciption, 'Donation description', 255),
    EventID: input.EventID == null ? null : assertInteger(input.EventID, 'Event', 1),
    DonationAmount: amount,
    DonationPhotoURL: optionalText(input.DonationPhotoURL, 'Donation photo link', 255),
  };
}

/** Physical items are recorded with a description of what was given (the amount is its estimated value). */
export function assertDonationFitsMethod(kind: DonationMethodKind, donation: Pick<NewDonation, 'DonationDesciption'>): void {
  if (kind === 'item' && !donation.DonationDesciption) {
    throw invalid('A physical-item donation needs a description of the items.', { kind });
  }
}

/** Specifications: "Event donations can be made during or after an event." */
export function assertDonationDateForEvent(date: string, event: { id: number; EventName: string; StartDate: string }): void {
  if (date < event.StartDate) {
    throw invalid(
      `Donation date ${date} is before "${event.EventName}" starts (${event.StartDate}); event donations are recorded during or after the event.`,
      { donationDate: date, eventId: event.id, startDate: event.StartDate },
    );
  }
}

// ---- Sprint 5K: donation corrections and the event funds rollup ---------------

/** Donation columns a correction may change. CouncilID and RecordedBy are fixed for the life of the row. */
export const DONATION_EDITABLE_COLUMNS = [
  'DonationDate',
  'DonationMethodID',
  'DonationTypeID',
  'Donor',
  'DonationDesciption',
  'EventID',
  'DonationAmount',
  'DonationPhotoURL',
] as const satisfies readonly (keyof DonationChanges)[];

/**
 * donations.update: applies `changes` over the stored row and validates the result as a whole donation.
 * Unknown fields, CouncilID and RecordedBy are refused (INVALID_INPUT). The driver still checks the ids.
 */
export function mergeDonationChanges(existing: Donation, changes: DonationChanges, now: Date): CleanDonation {
  const editable: readonly string[] = DONATION_EDITABLE_COLUMNS;
  for (const key of Object.keys(changes ?? {})) {
    if (key === 'CouncilID' || key === 'RecordedBy') {
      throw invalid(`A donation's ${key} cannot be changed; delete it and record it again instead.`, { field: key });
    }
    if (!editable.includes(key)) throw invalid(`A donation has no field "${key}".`, { field: key });
  }
  const current = Object.fromEntries(DONATION_EDITABLE_COLUMNS.map((c) => [c, existing[c] ?? null]));
  const merged = { ...current, ...changes, CouncilID: existing.CouncilID } as NewDonation;
  return cleanNewDonation(merged, now);
}

/** Which event funds column a donation method feeds; physical items feed neither. */
export const donationFundsBucket = (kind: DonationMethodKind): 'cash' | 'electronic' | null =>
  kind === 'item' ? null : kind === 'cash' ? 'cash' : 'electronic';

/** Totals of `donations` to the cent, summed in whole cents so no floating-point drift builds up. */
export function summarizeDonations(donations: readonly { DonationAmount: number; kind: DonationMethodKind }[]): DonationTotals {
  const cents = { cash: 0, electronic: 0, item: 0 };
  for (const d of donations) cents[donationFundsBucket(d.kind) ?? 'item'] += Math.round(d.DonationAmount * 100);
  return {
    count: donations.length,
    cash: cents.cash / 100,
    electronic: cents.electronic / 100,
    itemValue: cents.item / 100,
    raised: (cents.cash + cents.electronic) / 100,
  };
}

/** The synced value of an event's FundsRaised columns. */
export interface EventFunds {
  'FundsRaised-Cash': number;
  'FundsRaised-Electronic': number;
}

/**
 * The event's funds rollup from all of its donations, or null when none of them is cash or electronic
 * (then the columns are the ledger's hand-entered values).
 */
export function rollupEventFunds(donations: readonly { DonationAmount: number; kind: DonationMethodKind }[]): EventFunds | null {
  if (!donations.some((d) => donationFundsBucket(d.kind) !== null)) return null;
  const totals = summarizeDonations(donations);
  return { 'FundsRaised-Cash': totals.cash, 'FundsRaised-Electronic': totals.electronic };
}

/**
 * What a donation write must store in the event's funds columns, given the rollup before and after it:
 * the new sums while donations remain, null in both when the last one went, and nothing (null result)
 * when the event had no cash or electronic donations either side, so hand-entered values survive.
 */
export function nextEventFunds(
  before: EventFunds | null,
  after: EventFunds | null,
): { 'FundsRaised-Cash': number | null; 'FundsRaised-Electronic': number | null } | null {
  if (after) return after;
  return before ? { 'FundsRaised-Cash': null, 'FundsRaised-Electronic': null } : null;
}

/**
 * events.update: while donations drive an event's funds columns (`rollup` not null), a change to either is
 * refused. Resending the stored value is allowed, so a ledger form that saves every field still works.
 */
export function assertFundsEditable(event: { id: number; EventName: string }, changes: EventChanges, rollup: EventFunds | null): void {
  if (!rollup) return;
  for (const key of ['FundsRaised-Cash', 'FundsRaised-Electronic'] as const) {
    if (changes[key] !== undefined && changes[key] !== rollup[key]) {
      throw new BusinessRuleError(
        'FUNDS_MANAGED_BY_DONATIONS',
        `"${event.EventName}" totals its ${key} from its recorded donations (${rollup[key].toFixed(2)}); correct the donations instead of the total.`,
        { eventId: event.id, field: key, rollup: rollup[key], received: changes[key] },
      );
    }
  }
}

/** The Knights of Columbus was founded in 1882; no training can predate it. */
export const EARLIEST_TRAINING_YEAR = 1882;

/** Validates the lists for memberProfiles.updateExtensions. Ids are checked against the database by the driver. */
export function cleanMemberExtensions(
  skills: readonly MemberSkillInput[],
  training: readonly MemberTrainingInput[],
  workingStatusId: number | null,
  now: Date,
): { skills: MemberSkillInput[]; training: MemberTrainingInput[]; workingStatusId: number | null } {
  if (!Array.isArray(skills) || !Array.isArray(training)) {
    throw invalid('Skills and training must each be a list (use an empty list to clear them).');
  }
  const seenSkills = new Set<number>();
  const cleanSkills = skills.map((s) => {
    const skillId = assertInteger(s?.skillId, 'Skill', 1);
    const skillLevelId = assertInteger(s?.skillLevelId, 'Skill level', 1);
    if (seenSkills.has(skillId)) throw invalid(`Skill ${skillId} is listed more than once.`, { skillId });
    seenSkills.add(skillId);
    return { skillId, skillLevelId };
  });
  const thisYear = now.getFullYear();
  const seenClasses = new Set<string>();
  const cleanTraining = training.map((t) => {
    const trainingClassId = assertInteger(t?.trainingClassId, 'Training class', 1);
    const year = assertInteger(t?.year, 'Training year', EARLIEST_TRAINING_YEAR);
    if (year > thisYear) throw invalid(`Training year ${year} is in the future (this year is ${thisYear}).`, { year });
    const key = `${trainingClassId}:${year}`;
    if (seenClasses.has(key)) {
      throw invalid(`Training class ${trainingClassId} is listed twice for ${year}.`, { trainingClassId, year });
    }
    seenClasses.add(key);
    return { trainingClassId, year };
  });
  return {
    skills: cleanSkills,
    training: cleanTraining,
    workingStatusId: workingStatusId === null ? null : assertInteger(workingStatusId, 'Working status', 1),
  };
}

/** MemberTraining.YearTaken is a DATE; the year is stored as January 1st. */
export const trainingYearToDate = (year: number): string => `${year}-01-01`;
export const trainingDateToYear = (date: string): number => Number(date.slice(0, 4));

/** Columns members.create writes, besides CredentialID. The only member names a driver interpolates into SQL. */
export const MEMBER_COLUMNS = [
  'CouncilID',
  'MemberNumber',
  'MemberFirstName',
  'MemberLastName',
  'Phone',
  'StreetAddress1',
  'StreetAddress2',
  'City',
  'State',
  'ZipCode',
  'Email',
  'DateOfBirth',
  'StatusID',
  'DegreeID',
  'MemberTypeID',
  'WorkingStatusID',
  'ProfilePhotoURL',
  'Biography',
  'IsBudgetDirector',
] as const satisfies readonly (keyof NewMember)[];

/** Longest Member.ProfilePhotoURL (VARCHAR(2000)). */
export const MEMBER_PHOTO_URL_MAX_LENGTH = 2000;
/** Longest Member.Biography; the column is TEXT, the cap keeps a biography short. */
export const MEMBER_BIOGRAPHY_MAX_LENGTH = 2000;

/** The member type only a Super Admin may grant. A protected MemberType value, so it cannot be renamed. */
export const SUPER_ADMIN_TYPE = 'Super Admin';

/** The caller of a member write, as the driver read it from the database, never as the client describes itself. */
export interface MemberWriteActor {
  memberId: number;
  /** The caller's own council: an Admin's writes stay inside it. */
  councilId: number;
  memberType: string | undefined;
  active: boolean;
  /** Names of the Roles the caller holds; only the donation rules read them. */
  roles?: readonly string[];
  /** Member.IsBudgetDirector (Sprint 5Y-3): may prepare their own council's budget. */
  budgetDirector?: boolean;
  /** Holds at least one Role with Officer = 1 (Sprint 5Z-1: officers and Trustees vet charitable requests). */
  officer?: boolean;
}

/** Officer roles that keep the council's books: they maintain its donations and read its monthly summaries. */
export const FINANCE_ROLE_NAMES = ['Financial Secretary', 'Treasurer'] as const;

export const holdsFinanceRole = (roles: readonly string[] | undefined): boolean =>
  (roles ?? []).some((r) => (FINANCE_ROLE_NAMES as readonly string[]).includes(r));

/**
 * Only an Active Super Admin may create a Super Admin or promote a member to Super Admin. `grantedType` is
 * the MemberType.Type being written; `currentType` is the target's type before an update (omit on create),
 * so saving a Super Admin's other fields is not a promotion.
 */
export function assertMayGrantMemberType(actor: MemberWriteActor, grantedType: string | undefined, currentType?: string): void {
  if (grantedType !== SUPER_ADMIN_TYPE || currentType === SUPER_ADMIN_TYPE) return;
  if (hasSuperAdminRights(actor)) return;
  throw new SecurityPrivilegeError(
    'SUPER_ADMIN_REQUIRED',
    `Only an active Super Admin can grant the Super Admin member type; member ${actor.memberId} is ${describeActor(actor)}.`,
    { actorId: actor.memberId, actorType: actor.memberType ?? null, grantedType },
  );
}

/**
 * lookups.create/update/remove: only an Active Super Admin maintains the eight global lookup tables
 * (Specifications: "Super Admin Functions"). `actor` is read from the database, like a member write's.
 */
export function assertMayMaintainLookups(actor: MemberWriteActor, table: string, verb: 'change' | 'view' = 'change'): void {
  if (hasSuperAdminRights(actor)) return;
  throw new SecurityPrivilegeError(
    'SUPER_ADMIN_REQUIRED',
    `Only an active Super Admin can ${verb} the ${table} lookup table; member ${actor.memberId} is ${describeActor(actor)}.`,
    { actorId: actor.memberId, actorType: actor.memberType ?? null, table },
  );
}

/** Council-specific lookups the council's finance officers (FINANCE_ROLE_NAMES) also maintain. */
export const FINANCE_LOOKUP_TABLES: readonly string[] = ['DonationType', 'CouncilDonationMethod', 'CouncilBudgetCategory'];

/**
 * lookups.listCouncilSpecific/saveCouncilSpecific/removeCouncilSpecific: an Active Super Admin for any council;
 * an Active Admin, or for FINANCE_LOOKUP_TABLES an Active Financial Secretary or Treasurer, for their own council
 * only. Reads and writes share the rule. `action` completes "cannot ...".
 */
export function assertMayManageCouncilLookups(actor: MemberWriteActor, councilId: number, table: string, action: string): void {
  if (hasSuperAdminRights(actor)) return;
  const financeTable = FINANCE_LOOKUP_TABLES.includes(table);
  const financeOfficer = financeTable && actor.active && holdsFinanceRole(actor.roles);
  if (!hasAdminRights(actor) && !financeOfficer) {
    throw new SecurityPrivilegeError(
      'ADMIN_REQUIRED',
      `Only an active Admin${financeTable ? ', Financial Secretary or Treasurer' : ''} or Super Admin can ${action}; member ${actor.memberId} is ${describeActor(actor)}.`,
      { actorId: actor.memberId, actorType: actor.memberType ?? null, councilId, table },
    );
  }
  if (actor.councilId === councilId) return;
  throw new SecurityPrivilegeError(
    'COUNCIL_ACCESS_DENIED',
    `Member ${actor.memberId} of council ${actor.councilId} cannot ${action} in council ${councilId}; council lookups are managed only by that council's own officers.`,
    { actorId: actor.memberId, actorCouncilId: actor.councilId, councilId, table },
  );
}

/** lessonsLearned.listGlobalRegistry: every council's lessons are open to Active Admins and Super Admins. */
export function assertMayReadLessonsRegistry(actor: MemberWriteActor): void {
  if (hasAdminRights(actor)) return;
  throw new SecurityPrivilegeError(
    'ADMIN_REQUIRED',
    `Only an active Admin or Super Admin can browse the lessons learned registry; member ${actor.memberId} is ${describeActor(actor)}.`,
    { actorId: actor.memberId, actorType: actor.memberType ?? null },
  );
}

/** Why `actor` may not add or remove lessons of `event`, or null when they may. See assertMayChangeLesson. */
function lessonChangeDenial(
  actor: MemberWriteActor,
  event: { id: number; OwnerID: number },
  eventCouncilIds: readonly number[],
  action: string,
): SecurityPrivilegeError | null {
  if (actor.active && event.OwnerID === actor.memberId) return null;
  if (!hasAdminRights(actor)) {
    return new SecurityPrivilegeError(
      'ADMIN_REQUIRED',
      `Member ${actor.memberId} cannot ${action}: only the event's owner or an active Admin can; member ${actor.memberId} is ${describeActor(actor)}.`,
      { actorId: actor.memberId, actorType: actor.memberType ?? null, eventId: event.id },
    );
  }
  if (hasSuperAdminRights(actor) || eventCouncilIds.includes(actor.councilId)) return null;
  return new SecurityPrivilegeError(
    'COUNCIL_ACCESS_DENIED',
    `Admin ${actor.memberId} of council ${actor.councilId} cannot ${action}; event ${event.id} belongs to council${eventCouncilIds.length === 1 ? '' : 's'} ${eventCouncilIds.join(', ')}. Admins may read every council's lessons but change only their own.`,
    { actorId: actor.memberId, actorCouncilId: actor.councilId, eventId: event.id, eventCouncilIds: [...eventCouncilIds] },
  );
}

/**
 * lessonsLearned.add/remove: the event's Active owner, an Active Admin of a council the event is linked to, and
 * any Active Super Admin (the same people who record the event's ledger, permissions.canRecordLedger).
 */
export function assertMayChangeLesson(
  actor: MemberWriteActor,
  event: { id: number; OwnerID: number },
  eventCouncilIds: readonly number[],
  action: string,
): void {
  const denial = lessonChangeDenial(actor, event, eventCouncilIds, action);
  if (denial) throw denial;
}

/** assertMayChangeLesson as a yes/no, for the registry's `canModify`. */
export const mayChangeLesson = (actor: MemberWriteActor, event: { id: number; OwnerID: number }, eventCouncilIds: readonly number[]): boolean =>
  lessonChangeDenial(actor, event, eventCouncilIds, 'change lessons') === null;

/** The signup being marked or cleared, with the council links of its shift's event. */
export interface NoShowTarget {
  signupId: number;
  /** The member who signed up. */
  memberId: number;
  eventId: number;
  eventCouncilIds: readonly number[];
}

/** Why `actor` may not mark (`noShow` true) or clear a no-show on `target`, or null when they may. */
function noShowChangeDenial(actor: MemberWriteActor, target: NoShowTarget, noShow: boolean): SecurityPrivilegeError | null {
  const verb = noShow ? 'mark' : 'clear';
  if (hasSuperAdminRights(actor)) return null;
  // Anyone active reports their own absence, but cannot erase a no-show, which could be one an Admin recorded.
  if (actor.active && noShow && target.memberId === actor.memberId) return null;
  if (hasAdminRights(actor)) {
    if (target.eventCouncilIds.includes(actor.councilId)) return null;
    return new SecurityPrivilegeError(
      'COUNCIL_ACCESS_DENIED',
      `Admin ${actor.memberId} of council ${actor.councilId} cannot ${verb} a no-show on signup ${target.signupId}; its event ${target.eventId} belongs to council${target.eventCouncilIds.length === 1 ? '' : 's'} ${target.eventCouncilIds.join(', ')}.`,
      { actorId: actor.memberId, actorCouncilId: actor.councilId, signupId: target.signupId, eventCouncilIds: [...target.eventCouncilIds] },
    );
  }
  return new SecurityPrivilegeError(
    'ADMIN_REQUIRED',
    noShow
      ? `Member ${actor.memberId} cannot mark a no-show on signup ${target.signupId}: members report only their own absence, and an active Admin marks others; member ${actor.memberId} is ${describeActor(actor)}.`
      : `Member ${actor.memberId} cannot clear the no-show on signup ${target.signupId}: only an active Admin of the event's council or a Super Admin can; member ${actor.memberId} is ${describeActor(actor)}.`,
    { actorId: actor.memberId, actorType: actor.memberType ?? null, signupId: target.signupId, noShow },
  );
}

/**
 * events.setNoShow: an Active member marks only their own signup and never clears one; an Active Admin marks or
 * clears any signup on events linked to their own council; an Active Super Admin any signup.
 */
export function assertMayMarkNoShow(actor: MemberWriteActor, target: NoShowTarget, noShow: boolean): void {
  const denial = noShowChangeDenial(actor, target, noShow);
  if (denial) throw denial;
}

/** assertMayMarkNoShow as a yes/no, for the screens' Mark and Clear controls. */
export const mayMarkNoShow = (actor: MemberWriteActor, target: NoShowTarget, noShow: boolean): boolean =>
  noShowChangeDenial(actor, target, noShow) === null;

/** A no-show and logged hours on the same shift contradict each other, so a signup with hours is never marked. */
export function assertNoShowWithoutHours(target: NoShowTarget, hoursLogged: number | null): void {
  if (hoursLogged === null) return;
  throw new BusinessRuleError(
    'NO_SHOW_HAS_HOURS',
    `Signup ${target.signupId} cannot be marked a no-show: member ${target.memberId} has ${hoursLogged} hours logged on that shift.`,
    { signupId: target.signupId, memberId: target.memberId, hoursLogged },
  );
}

export const signupNotFound = (signupId: number): BusinessRuleError =>
  new BusinessRuleError('RECORD_NOT_FOUND', `No shift signup with id ${signupId}.`, { signupId });

/**
 * events.setNoShow's NoShowReasonID: marking needs one of `knownReasonIds` (INVALID_INPUT otherwise), and clearing
 * removes the reason, so the result is null.
 */
export function noShowReasonFor(noShow: boolean, reasonId: unknown, knownReasonIds: readonly number[]): number | null {
  if (!noShow) return null;
  if (typeof reasonId === 'number' && knownReasonIds.includes(reasonId)) return reasonId;
  throw new BusinessRuleError(
    'INVALID_INPUT',
    reasonId === undefined || reasonId === null ? 'Choose a reason for the no-show.' : `No no-show reason with id ${String(reasonId)}.`,
    { reasonId: reasonId ?? null },
  );
}

/** Longest SystemFeedback.FeedbackText (VARCHAR(2000)). */
export const FEEDBACK_MAX_LENGTH = 2000;

/** feedback.listInbox: the feedback inbox is read only by Active Super Admins. */
export function assertMayReadFeedback(actor: MemberWriteActor): void {
  if (hasSuperAdminRights(actor)) return;
  throw new SecurityPrivilegeError(
    'SUPER_ADMIN_REQUIRED',
    `Only an active Super Admin can read the feedback inbox; member ${actor.memberId} is ${describeActor(actor)}.`,
    { actorId: actor.memberId, actorType: actor.memberType ?? null },
  );
}

/**
 * Why `actor` may not attach media to records of `councilIds`, or null when they may: an Active Super Admin
 * anywhere; an Active Admin, Financial Secretary or Treasurer of one of those councils (finance officers because
 * event and meeting media back the council's fundraising records). `ownerId` is the record's owner, who may too.
 */
function mediaDenial(
  actor: MemberWriteActor,
  councilIds: readonly number[],
  ownerId: number | null,
  action: string,
  details: Record<string, unknown>,
): SecurityPrivilegeError | null {
  if (hasSuperAdminRights(actor)) return null;
  if (actor.active && ownerId !== null && ownerId === actor.memberId) return null;
  const officer = hasAdminRights(actor) || (actor.active && holdsFinanceRole(actor.roles));
  if (!officer) {
    return new SecurityPrivilegeError(
      'ADMIN_REQUIRED',
      `Member ${actor.memberId} cannot ${action}: only ${ownerId === null ? '' : 'the owner, '}an active Admin, Financial Secretary or Treasurer of the council, or a Super Admin can; member ${actor.memberId} is ${describeActor(actor)}.`,
      { actorId: actor.memberId, actorType: actor.memberType ?? null, ...details },
    );
  }
  if (councilIds.includes(actor.councilId)) return null;
  return new SecurityPrivilegeError(
    'COUNCIL_ACCESS_DENIED',
    `Member ${actor.memberId} of council ${actor.councilId} cannot ${action}; it belongs to council${councilIds.length === 1 ? '' : 's'} ${councilIds.join(', ')}.`,
    { actorId: actor.memberId, actorCouncilId: actor.councilId, councilIds: [...councilIds], ...details },
  );
}

/**
 * events.uploadPhotos: the event's Active owner, an Active Admin, Financial Secretary or Treasurer of a council the
 * event is linked to, and any Active Super Admin.
 */
export function assertMayAttachEventMedia(
  actor: MemberWriteActor,
  event: { id: number; OwnerID: number },
  eventCouncilIds: readonly number[],
  action: string,
): void {
  const denial = mediaDenial(actor, eventCouncilIds, event.OwnerID, action, { eventId: event.id });
  if (denial) throw denial;
}

/** assertMayAttachEventMedia as a yes/no, for photo upload controls. */
export const mayAttachEventMedia = (actor: MemberWriteActor, event: { id: number; OwnerID: number }, eventCouncilIds: readonly number[]): boolean =>
  mediaDenial(actor, eventCouncilIds, event.OwnerID, 'add photos', { eventId: event.id }) === null;

/** The meeting fields the Drive-link rule reads. */
export interface MediaMeeting {
  id: number;
  CouncilID: number;
  OwnerID?: number | null;
}

/**
 * meetings.linkGoogleDrive: the meeting's Active owner, an Active Admin, Financial Secretary or Treasurer of the
 * meeting's council, and any Active Super Admin.
 */
export function assertMayLinkMeetingDrive(actor: MemberWriteActor, meeting: MediaMeeting, action: string): void {
  const denial = mediaDenial(actor, [meeting.CouncilID], meeting.OwnerID ?? null, action, { meetingId: meeting.id });
  if (denial) throw denial;
}

/** assertMayLinkMeetingDrive as a yes/no, for Google Drive link controls. */
export const mayLinkMeetingDrive = (actor: MemberWriteActor, meeting: MediaMeeting): boolean =>
  mediaDenial(actor, [meeting.CouncilID], meeting.OwnerID ?? null, 'link Google Drive files', { meetingId: meeting.id }) === null;

/** An Active Super Admin. */
export const hasSuperAdminRights = (a: MemberWriteActor): boolean => a.active && a.memberType === SUPER_ADMIN_TYPE;
/** An Active Admin or Super Admin. */
export const hasAdminRights = (a: MemberWriteActor): boolean => a.active && (a.memberType === 'Admin' || a.memberType === SUPER_ADMIN_TYPE);
/** 'Admin', 'an inactive Member', ... for refusal messages. */
export const describeActor = (a: MemberWriteActor): string => `${a.active ? '' : 'an inactive '}${a.memberType ?? 'of unknown type'}`;

/** The member fields a Member without admin rights may change on their own record (contact details, photo and biography). */
export const MEMBER_SELF_SERVICE_COLUMNS = [
  'Phone',
  'StreetAddress1',
  'StreetAddress2',
  'City',
  'State',
  'ZipCode',
  'Email',
  'WorkingStatusID',
  'ProfilePhotoURL',
  'Biography',
] as const satisfies readonly (typeof MEMBER_COLUMNS)[number][];

/**
 * Tenant boundary: a Super Admin writes members of any council, an Admin only of their own
 * (permissions.canAdministerCouncil). Call only for callers with admin rights.
 */
function assertAdminCouncil(actor: MemberWriteActor, councilId: number, action: string, memberId?: number): void {
  if (hasSuperAdminRights(actor) || actor.councilId === councilId) return;
  throw new SecurityPrivilegeError(
    'COUNCIL_ACCESS_DENIED',
    `Admin ${actor.memberId} of council ${actor.councilId} cannot ${action} in council ${councilId}; an Admin manages only their own council's members.`,
    { actorId: actor.memberId, actorCouncilId: actor.councilId, councilId, ...(memberId === undefined ? {} : { memberId }) },
  );
}

/** Fields a Super Admin's clearance rests on: an Admin changing either could demote or disable them. */
const CLEARANCE_COLUMNS: readonly string[] = ['MemberTypeID', 'StatusID'];

/**
 * Only an active Admin or Super Admin may create members, an Admin only in their own council; a Super Admin
 * row also needs a Super Admin.
 */
export function assertMayCreateMember(actor: MemberWriteActor, member: Pick<NewMember, 'CouncilID'>, grantedType: string | undefined): void {
  if (!hasAdminRights(actor)) {
    throw new SecurityPrivilegeError(
      'ADMIN_REQUIRED',
      `Only an active Admin or Super Admin can add members; member ${actor.memberId} is ${describeActor(actor)}.`,
      { actorId: actor.memberId, actorType: actor.memberType ?? null },
    );
  }
  assertAdminCouncil(actor, member.CouncilID, 'add a member');
  assertMayGrantMemberType(actor, grantedType);
}

/**
 * members.update. Without admin rights a member may change only their own contact details
 * (MEMBER_SELF_SERVICE_COLUMNS). An Admin may change only members of their own council, and may not move
 * one to another council or change a Super Admin's type or status. Only a Super Admin
 * may grant Super Admin. `existing` is the stored row, `next` the validated result, and the types are
 * MemberType.Type names for `existing` and `next`.
 */
export function assertMayUpdateMember(
  actor: MemberWriteActor,
  existing: Member,
  next: NewMember,
  types: { current: string | undefined; next: string | undefined },
): void {
  const changed = MEMBER_COLUMNS.filter((c) => (existing[c] ?? null) !== (next[c] ?? null));
  if (!hasAdminRights(actor)) {
    if (actor.memberId !== existing.id) {
      throw new SecurityPrivilegeError(
        'ADMIN_REQUIRED',
        `Member ${actor.memberId} may only change their own record, not member ${existing.id}.`,
        { actorId: actor.memberId, memberId: existing.id },
      );
    }
    const selfService: readonly string[] = MEMBER_SELF_SERVICE_COLUMNS;
    const restricted = changed.filter((c) => !selfService.includes(c));
    if (restricted.length > 0) {
      throw new SecurityPrivilegeError(
        'ADMIN_REQUIRED',
        `Only an Admin can change ${restricted.join(', ')}; members may update their own contact details.`,
        { actorId: actor.memberId, fields: restricted },
      );
    }
  } else {
    assertAdminCouncil(actor, existing.CouncilID, `change member ${existing.id}`, existing.id);
    assertAdminCouncil(actor, next.CouncilID, `move member ${existing.id}`, existing.id);
  }
  if (hasAdminRights(actor) && types.current === SUPER_ADMIN_TYPE && !hasSuperAdminRights(actor)) {
    const clearance = changed.filter((c) => CLEARANCE_COLUMNS.includes(c));
    if (clearance.length > 0) {
      throw new SecurityPrivilegeError(
        'SUPER_ADMIN_REQUIRED',
        `Only a Super Admin can change a Super Admin's ${clearance.join(' or ')}; member ${actor.memberId} is ${describeActor(actor)}.`,
        { actorId: actor.memberId, memberId: existing.id, fields: clearance },
      );
    }
  }
  assertMayGrantMemberType(actor, types.next, types.current);
}

/**
 * memberProfiles.updateExtensions: anyone maintains their own skills and training; otherwise an Admin
 * those of their own council's members and a Super Admin anyone's.
 */
export function assertMayEditMemberExtensions(actor: MemberWriteActor, member: Pick<Member, 'id' | 'CouncilID'>): void {
  if (actor.memberId === member.id) return;
  if (!hasAdminRights(actor)) {
    throw new SecurityPrivilegeError(
      'ADMIN_REQUIRED',
      `Member ${actor.memberId} may only change their own skills, training and working status, not member ${member.id}'s.`,
      { actorId: actor.memberId, memberId: member.id },
    );
  }
  assertAdminCouncil(actor, member.CouncilID, `change member ${member.id}'s skills and training`, member.id);
}

/**
 * councils.create/update/remove: only an Active Super Admin maintains councils. `actor` is read from the
 * database, like a member write's.
 */
export function assertMayMaintainCouncils(actor: MemberWriteActor, action: string): void {
  if (hasSuperAdminRights(actor)) return;
  throw new SecurityPrivilegeError(
    'SUPER_ADMIN_REQUIRED',
    `Only an active Super Admin can ${action}; member ${actor.memberId} is ${describeActor(actor)}.`,
    { actorId: actor.memberId, actorType: actor.memberType ?? null },
  );
}

/**
 * Parishes, pastors, activities and distribution lists: an Active Admin maintains those of their own council,
 * an Active Super Admin those of any council (permissions.canAdministerCouncil). Call once for every council a
 * write touches, so moving a row between councils needs rights over both. `action` completes "cannot ...".
 */
export function assertMayMaintainCouncilRecords(actor: MemberWriteActor, councilId: number, action: string): void {
  if (!hasAdminRights(actor)) {
    throw new SecurityPrivilegeError(
      'ADMIN_REQUIRED',
      `Only an active Admin or Super Admin can ${action}; member ${actor.memberId} is ${describeActor(actor)}.`,
      { actorId: actor.memberId, actorType: actor.memberType ?? null, councilId },
    );
  }
  if (hasSuperAdminRights(actor) || actor.councilId === councilId) return;
  throw new SecurityPrivilegeError(
    'COUNCIL_ACCESS_DENIED',
    `Admin ${actor.memberId} of council ${actor.councilId} cannot ${action} in council ${councilId}; an Admin maintains only their own council's records.`,
    { actorId: actor.memberId, actorCouncilId: actor.councilId, councilId },
  );
}

/**
 * donations.update/remove: the Active member who recorded the donation and the Active owner of its event may
 * correct it, as may an Active Financial Secretary or Treasurer of its council, an Active Admin of its council
 * and any Active Super Admin. `eventOwnerId` is the OwnerID
 * of the donation's event (null when standalone). Call once for the stored row and, on a move, once for the
 * result, so the right must hold on both sides.
 */
export function assertMayChangeDonation(
  actor: MemberWriteActor,
  donation: Pick<Donation, 'id' | 'CouncilID' | 'RecordedBy'>,
  eventOwnerId: number | null,
  action: string,
): void {
  if (actor.active && (donation.RecordedBy === actor.memberId || eventOwnerId === actor.memberId)) return;
  if (actor.active && holdsFinanceRole(actor.roles) && actor.councilId === donation.CouncilID) return;
  if (!hasAdminRights(actor)) {
    throw new SecurityPrivilegeError(
      'ADMIN_REQUIRED',
      `Member ${actor.memberId} cannot ${action}: only the member who recorded it, the event's owner, the council's Financial Secretary or Treasurer, or an active Admin can; member ${actor.memberId} is ${describeActor(actor)}.`,
      { actorId: actor.memberId, actorType: actor.memberType ?? null, donationId: donation.id },
    );
  }
  if (hasSuperAdminRights(actor) || actor.councilId === donation.CouncilID) return;
  throw new SecurityPrivilegeError(
    'COUNCIL_ACCESS_DENIED',
    `Admin ${actor.memberId} of council ${actor.councilId} cannot ${action} in council ${donation.CouncilID}; an Admin maintains only their own council's records.`,
    { actorId: actor.memberId, actorCouncilId: actor.councilId, councilId: donation.CouncilID, donationId: donation.id },
  );
}

/**
 * Expense reporting leadership (Sprint 5R): expenses.listCouncilQueue, approveReport and rejectReport (checks follow
 * the narrower assertMayDisburseCouncilExpenses since Sprint 5S). An Active
 * Super Admin for any council; an Active Admin, Financial Secretary or Treasurer for their own council only. Members
 * reach their own sheets through listUserReports and submitReport, which need no leadership. `action` completes
 * "cannot ...".
 */
export function assertMayAuditCouncilExpenses(actor: MemberWriteActor, councilId: number, action: string): void {
  const denial = expenseAuditDenial(actor, councilId, action);
  if (denial) throw denial;
}

/** assertMayAuditCouncilExpenses as a yes/no. */
export const mayAuditCouncilExpenses = (actor: MemberWriteActor, councilId: number): boolean =>
  expenseAuditDenial(actor, councilId, 'review expense reports') === null;

/**
 * expenses.recordDisbursement (Sprint 5S): checks are issued only by an Active Financial Secretary or Treasurer
 * (FINANCE_ROLE_NAMES) of the council, or an Active Super Admin for any council. A council Admin without a finance
 * role audits the queue but may not pay it (FINANCE_OFFICER_REQUIRED). `action` completes "cannot ...".
 */
export function assertMayDisburseCouncilExpenses(actor: MemberWriteActor, councilId: number, action: string): void {
  const denial = disbursementDenial(actor, councilId, action);
  if (denial) throw denial;
}

/** assertMayDisburseCouncilExpenses as a yes/no. */
export const mayDisburseCouncilExpenses = (actor: MemberWriteActor, councilId: number): boolean =>
  disbursementDenial(actor, councilId, 'record expense checks') === null;

/**
 * charities.hydrateAndDisburse (Sprint 5V): a charity check comes out of the same checkbook, so the same officers issue
 * it as an expense check (assertMayDisburseCouncilExpenses). `action` completes "cannot ...".
 */
export function assertMayDisburseCharity(actor: MemberWriteActor, councilId: number, action: string): void {
  const denial = disbursementDenial(actor, councilId, action);
  if (denial) throw denial;
}

/** assertMayDisburseCharity as a yes/no. */
export const mayDisburseCharity = (actor: MemberWriteActor, councilId: number): boolean =>
  disbursementDenial(actor, councilId, 'record charity checks') === null;

function disbursementDenial(actor: MemberWriteActor, councilId: number, action: string): SecurityPrivilegeError | null {
  if (hasSuperAdminRights(actor)) return null;
  if (!(actor.active && holdsFinanceRole(actor.roles))) {
    return new SecurityPrivilegeError(
      'FINANCE_OFFICER_REQUIRED',
      `Only an active Financial Secretary, Treasurer or Super Admin can ${action}; member ${actor.memberId} is ${describeActor(actor)} without a finance role.`,
      { actorId: actor.memberId, actorType: actor.memberType ?? null, councilId },
    );
  }
  if (actor.councilId === councilId) return null;
  return new SecurityPrivilegeError(
    'COUNCIL_ACCESS_DENIED',
    `Member ${actor.memberId} of council ${actor.councilId} cannot ${action} in council ${councilId}; a council's checks are issued only by its own finance officers.`,
    { actorId: actor.memberId, actorCouncilId: actor.councilId, councilId },
  );
}

/**
 * expenses.approveReport: nobody may approve an expense sheet they submitted (accounting controls). Since Sprint 5S
 * this holds for every role, Super Admins included. Call after assertMayAuditCouncilExpenses.
 */
export function assertNotSelfApproval(actor: MemberWriteActor, report: { id: number; SubmitterMemberID: number }): void {
  if (isOwnExpense(actor, report)) {
    throw new BusinessRuleError('SELF_APPROVAL_BLOCKED', 'For accounting controls, an officer cannot approve their own expense report.', {
      actorId: actor.memberId,
      reportId: report.id,
    });
  }
}

/**
 * expenses.recordDisbursement: nobody may issue a check that pays an expense sheet they submitted (accounting
 * controls, Sprint 5R-2; no Super Admin override since Sprint 5S). Call after assertMayDisburseCouncilExpenses.
 */
export function assertNoSelfPayout(actor: MemberWriteActor, report: { id: number; SubmitterMemberID: number }): void {
  if (isOwnExpense(actor, report)) {
    throw new BusinessRuleError('SELF_PAYOUT_BLOCKED', 'For accounting controls, an officer cannot issue a check that pays their own expense report.', {
      actorId: actor.memberId,
      reportId: report.id,
    });
  }
}

/** The sheet is the actor's own, which they may neither approve nor pay, whatever their role. */
const isOwnExpense = (actor: MemberWriteActor, report: { SubmitterMemberID: number }): boolean => report.SubmitterMemberID === actor.memberId;

const expenseAuditDenial = (actor: MemberWriteActor, councilId: number, action: string): SecurityPrivilegeError | null =>
  councilLeadershipDenial(actor, councilId, action, "expense reports are reviewed only by that council's own leadership");

/**
 * Push alerts (Sprint 5T): notifications.dispatchHighPriorityAlert. The same leadership as the expense queue: an
 * Active Super Admin for any council; an Active Admin, Financial Secretary or Treasurer for their own council only.
 * Registering a device and reading one's own alerts need no leadership. `action` completes "cannot ...".
 */
export function assertMayDispatchCouncilAlerts(actor: MemberWriteActor, councilId: number, action: string): void {
  const denial = councilLeadershipDenial(actor, councilId, action, "a council's alerts are sent only by its own leadership");
  if (denial) throw denial;
}

/** assertMayDispatchCouncilAlerts as a yes/no. */
export const mayDispatchCouncilAlerts = (actor: MemberWriteActor, councilId: number): boolean =>
  councilLeadershipDenial(actor, councilId, 'send alerts', '') === null;

/**
 * Supreme Council reporting (Sprint 5T): supreme.syncAlchemerReport, with the same leadership as
 * assertMayDispatchCouncilAlerts. `action` completes "cannot ...".
 */
export function assertMaySyncSupremeReports(actor: MemberWriteActor, councilId: number, action: string): void {
  const denial = councilLeadershipDenial(actor, councilId, action, "a council's Supreme reports are filed only by its own leadership");
  if (denial) throw denial;
}

/** assertMaySyncSupremeReports as a yes/no. */
export const maySyncSupremeReports = (actor: MemberWriteActor, councilId: number): boolean =>
  councilLeadershipDenial(actor, councilId, 'file Supreme reports', '') === null;

/**
 * charities.connectCouncilToCharity (Sprint 5V), with the same leadership as assertMayDispatchCouncilAlerts. `action`
 * completes "cannot ...".
 */
export function assertMayConnectCouncilCharity(actor: MemberWriteActor, councilId: number, action: string): void {
  const denial = councilLeadershipDenial(actor, councilId, action, "a council's charities are chosen only by its own leadership");
  if (denial) throw denial;
}

/** assertMayConnectCouncilCharity as a yes/no. */
export const mayConnectCouncilCharity = (actor: MemberWriteActor, councilId: number): boolean =>
  councilLeadershipDenial(actor, councilId, 'connect charities', '') === null;

/**
 * charities.listCouncilProposals, listCouncilLedger and rejectProposal (Sprint 5V-2): the council's leadership, as for
 * the expense queue. `action` completes "cannot ...".
 */
export function assertMayReviewCharityProposals(actor: MemberWriteActor, councilId: number, action: string): void {
  const denial = councilLeadershipDenial(actor, councilId, action, "a council's charity proposals are reviewed only by its own leadership");
  if (denial) throw denial;
}

/**
 * charities.addGlobalCharity (Sprint 5V): the registry is shared by every council, and any Active Admin or Super Admin
 * may add to it. Finance officers register a charity only while paying it (hydrateAndDisburse).
 */
export function assertMayAddGlobalCharity(actor: MemberWriteActor): void {
  if (hasAdminRights(actor)) return;
  throw new SecurityPrivilegeError(
    'ADMIN_REQUIRED',
    `Only an active Admin or Super Admin can add a charity to the global registry; member ${actor.memberId} is ${describeActor(actor)}.`,
    { actorId: actor.memberId, actorType: actor.memberType ?? null },
  );
}

/** assertMayAddGlobalCharity as a yes/no. */
export const mayAddGlobalCharity = (actor: MemberWriteActor): boolean => hasAdminRights(actor);

/**
 * charities.proposeDonation and listSuggestedLocal (Sprint 5V): any Active member of the council, or an Active Super
 * Admin for any council. `action` completes "cannot ...".
 */
export function assertMayProposeCharityGift(actor: MemberWriteActor, councilId: number, action: string): void {
  if (hasSuperAdminRights(actor)) return;
  if (actor.active && actor.councilId === councilId) return;
  throw new SecurityPrivilegeError(
    'COUNCIL_ACCESS_DENIED',
    `Only active members of council ${councilId} can ${action}; member ${actor.memberId} is ${describeActor(actor)} of council ${actor.councilId}.`,
    { actorId: actor.memberId, actorCouncilId: actor.councilId, councilId },
  );
}

/**
 * The charitable-request vetting desk (Sprint 5Z-1): charities.listCharitableRequestsQueue and triageRequestStatus.
 * Vetting authority belongs to the council's Active officers (any Role with Officer = 1, Trustees included) and
 * Admins, and to any Active Super Admin. `action` completes "cannot ...".
 */
export function assertMayVetCharitableRequests(actor: MemberWriteActor, councilId: number, action: string): void {
  const denial = vettingDenial(actor, councilId, action);
  if (denial) throw denial;
}

/** assertMayVetCharitableRequests as a yes/no. */
export const mayVetCharitableRequests = (actor: MemberWriteActor, councilId: number): boolean =>
  vettingDenial(actor, councilId, 'vet charitable requests') === null;

function vettingDenial(actor: MemberWriteActor, councilId: number, action: string): SecurityPrivilegeError | null {
  if (hasSuperAdminRights(actor)) return null;
  if (!hasAdminRights(actor) && !(actor.active && actor.officer)) {
    return new SecurityPrivilegeError(
      'VETTING_AUTHORITY_REQUIRED',
      `Only an active officer, Trustee, Admin or Super Admin can ${action}; member ${actor.memberId} is ${describeActor(actor)} without an officer seat.`,
      { actorId: actor.memberId, actorType: actor.memberType ?? null, councilId },
    );
  }
  if (actor.councilId === councilId) return null;
  return new SecurityPrivilegeError(
    'COUNCIL_ACCESS_DENIED',
    `Member ${actor.memberId} of council ${actor.councilId} cannot ${action} in council ${councilId}; a council's requests are vetted only by its own officers.`,
    { actorId: actor.memberId, actorCouncilId: actor.councilId, councilId },
  );
}

/**
 * charities.triageRequestStatus: vetting must be independent, so the Knight Shepherd who carries a request may never
 * claim, annotate or advance it - Super Admins included. Call after assertMayVetCharitableRequests.
 */
export function assertIndependentVetter(actor: MemberWriteActor, request: { id: number; ShepherdMemberID: number }): void {
  if (request.ShepherdMemberID !== actor.memberId) return;
  throw new BusinessRuleError('SELF_VETTING_BLOCKED', 'For independent vetting, the Knight Shepherd of a request cannot vet it.', {
    actorId: actor.memberId,
    requestId: request.id,
  });
}

/**
 * budget.* writes (Sprint 5Y): pre-populating and adjusting a council's budget forecast belongs to its leadership - an
 * Active Admin, Financial Secretary or Treasurer of the council - its Active Designated Budget Director
 * (Member.IsBudgetDirector, Sprint 5Y-3), or any Active Super Admin. `action` completes "cannot ...".
 */
export function assertMayManageBudgetForecast(actor: MemberWriteActor, councilId: number, action: string): void {
  const denial = budgetWriteDenial(actor, councilId, action);
  if (denial) throw denial;
}

/** assertMayManageBudgetForecast as a yes/no. */
export const mayManageBudgetForecast = (actor: MemberWriteActor, councilId: number): boolean =>
  budgetWriteDenial(actor, councilId, 'manage the budget forecast') === null;

function budgetWriteDenial(actor: MemberWriteActor, councilId: number, action: string): SecurityPrivilegeError | null {
  if (actor.active && actor.budgetDirector && actor.councilId === councilId) return null;
  return councilLeadershipDenial(actor, councilId, action, "a council's budget is kept only by its own leadership");
}

/**
 * budget.approveAndFinalizeEntireBudget (Sprint 5Y-4): recording the council's vote belongs to its leadership - an
 * Active Admin, Financial Secretary or Treasurer of the council - or any Active Super Admin. The Designated Budget
 * Director prepares the budget but does not finalize it. `action` completes "cannot ...".
 */
export function assertMayApproveBudget(actor: MemberWriteActor, councilId: number, action: string): void {
  const denial = councilLeadershipDenial(actor, councilId, action, "a council's budget is approved only by its own leadership");
  if (denial) throw denial;
}

/**
 * budget.getBudgetProgress and budget.getHistoricalKPIs (Sprint 5Y-4): budget-versus-actual figures sit beside the
 * monthly executive summaries, so they are for the same readers - the council's Active Admins, Financial Secretary and
 * Treasurer, and any Active Super Admin. `action` completes "cannot ...".
 */
export function assertMayReviewBudgetPerformance(actor: MemberWriteActor, councilId: number, action: string): void {
  const denial = councilLeadershipDenial(actor, councilId, action, "a council's budget performance is reviewed only by its own leadership");
  if (denial) throw denial;
}

/**
 * budget.listAnnualForecast (Sprint 5Y-3 transparency): every Active member of the council may read its budget, and an
 * Active Super Admin any council's. `action` completes "cannot ...".
 */
export function assertMayViewBudgetForecast(actor: MemberWriteActor, councilId: number, action: string): void {
  if (hasSuperAdminRights(actor)) return;
  if (actor.active && actor.councilId === councilId) return;
  throw new SecurityPrivilegeError(
    'COUNCIL_ACCESS_DENIED',
    `Only active members of council ${councilId} can ${action}; member ${actor.memberId} is ${describeActor(actor)} of council ${actor.councilId}.`,
    { actorId: actor.memberId, actorCouncilId: actor.councilId, councilId },
  );
}

/**
 * Council leadership: an Active Super Admin anywhere, or an Active Admin, Financial Secretary or Treasurer in their own
 * council. `why` explains a cross-council refusal.
 */
function councilLeadershipDenial(actor: MemberWriteActor, councilId: number, action: string, why: string): SecurityPrivilegeError | null {
  if (hasSuperAdminRights(actor)) return null;
  if (!hasAdminRights(actor) && !(actor.active && holdsFinanceRole(actor.roles))) {
    return new SecurityPrivilegeError(
      'ADMIN_REQUIRED',
      `Only an active Admin, Financial Secretary, Treasurer or Super Admin can ${action}; member ${actor.memberId} is ${describeActor(actor)}.`,
      { actorId: actor.memberId, actorType: actor.memberType ?? null, councilId },
    );
  }
  if (actor.councilId === councilId) return null;
  return new SecurityPrivilegeError(
    'COUNCIL_ACCESS_DENIED',
    `Member ${actor.memberId} of council ${actor.councilId} cannot ${action} in council ${councilId}; ${why}.`,
    { actorId: actor.memberId, actorCouncilId: actor.councilId, councilId },
  );
}

/** members.update: applies `changes` over the stored row and validates the result as a whole member. */
export function mergeMemberChanges(existing: Member, changes: Partial<NewMember>, now: Date): NewMember {
  const current = Object.fromEntries(MEMBER_COLUMNS.map((c) => [c, existing[c]])) as unknown as NewMember;
  return cleanNewMember({ ...current, ...changes }, now);
}

/** Validates a new member's fields against Schema.sql's lengths. Ids are checked against the database by the driver. */
export function cleanNewMember(input: NewMember, now: Date): NewMember {
  const allowed = new Set<string>(MEMBER_COLUMNS);
  for (const key of Object.keys(input)) {
    if (!allowed.has(key)) throw invalid(`A member has no field "${key}".`, { field: key });
  }
  const email = assertText(input.Email, 'Email', 50);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw invalid(`Email "${email}" is not a valid address.`, { email });
  const dob = assertIsoDate(input.DateOfBirth, 'Date of birth');
  if (dob >= toIsoDate(now)) throw invalid(`Date of birth ${dob} must be in the past.`, { dateOfBirth: dob });
  return {
    CouncilID: assertInteger(input.CouncilID, 'Council', 1),
    MemberNumber: assertInteger(input.MemberNumber, 'Member number', 1),
    MemberFirstName: assertText(input.MemberFirstName, 'First name', 100),
    MemberLastName: assertText(input.MemberLastName, 'Last name', 100),
    Phone: assertText(input.Phone, 'Phone', 50),
    StreetAddress1: assertText(input.StreetAddress1, 'Street address', 255),
    StreetAddress2: optionalText(input.StreetAddress2, 'Street address line 2', 255) ?? undefined,
    City: assertText(input.City, 'City', 50),
    State: assertText(input.State, 'State', 20),
    ZipCode: assertText(input.ZipCode, 'ZIP code', 15),
    Email: email,
    DateOfBirth: dob,
    StatusID: assertInteger(input.StatusID, 'Member status', 1),
    DegreeID: assertInteger(input.DegreeID, 'Degree', 1),
    MemberTypeID: assertInteger(input.MemberTypeID, 'Member type', 1),
    WorkingStatusID: input.WorkingStatusID == null ? null : assertInteger(input.WorkingStatusID, 'Working status', 1),
    ProfilePhotoURL: optionalText(input.ProfilePhotoURL, 'Profile photo', MEMBER_PHOTO_URL_MAX_LENGTH),
    Biography: optionalText(input.Biography, 'Biography', MEMBER_BIOGRAPHY_MAX_LENGTH),
    IsBudgetDirector: bitFlag(input.IsBudgetDirector, 'IsBudgetDirector'),
  };
}

/** A BIT NOT NULL DEFAULT 0 flag: 0, 1, false or true, stored as 0 or 1; omitted or null is 0. */
function bitFlag(value: unknown, label: string): number {
  if (value === undefined || value === null || value === 0 || value === false) return 0;
  if (value === 1 || value === true) return 1;
  throw invalid(`${label} must be 0, 1, true or false; received ${JSON.stringify(value)}.`, { field: label });
}
