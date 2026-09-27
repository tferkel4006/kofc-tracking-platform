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
  DonationMethodKind,
  MeetingHoursEntry,
  MemberSkillInput,
  MemberTrainingInput,
  NewDonation,
  NewMember,
} from './contract';
import type { Meeting, Member, Shift } from './types';

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
  | 'THREAD_NOT_FOUND'
  | 'MESSAGE_NOT_FOUND'
  | 'SHIFT_HAS_SIGNUPS'
  | 'LOOKUP_IN_USE'
  | 'LOOKUP_PROTECTED'
  | 'DONATION_METHOD_NOT_ENABLED'
  | 'NO_RECIPIENTS'
  | 'ADMIN_REQUIRED'
  | 'SUPER_ADMIN_REQUIRED'
  | 'COUNCIL_ACCESS_DENIED';

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
  constructor(code: 'ADMIN_REQUIRED' | 'SUPER_ADMIN_REQUIRED' | 'COUNCIL_ACCESS_DENIED', message: string, details: Record<string, unknown> = {}) {
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

const optionalText = (value: unknown, label: string, maxLength: number): string | null => {
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
] as const satisfies readonly (keyof NewMember)[];

/** The member type only a Super Admin may grant. A protected MemberType value, so it cannot be renamed. */
export const SUPER_ADMIN_TYPE = 'Super Admin';

/** The caller of a member write, as the driver read it from the database, never as the client describes itself. */
export interface MemberWriteActor {
  memberId: number;
  /** The caller's own council: an Admin's writes stay inside it. */
  councilId: number;
  memberType: string | undefined;
  active: boolean;
}

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

const hasSuperAdminRights = (a: MemberWriteActor): boolean => a.active && a.memberType === SUPER_ADMIN_TYPE;
const hasAdminRights = (a: MemberWriteActor): boolean => a.active && (a.memberType === 'Admin' || a.memberType === SUPER_ADMIN_TYPE);
const describeActor = (a: MemberWriteActor): string => `${a.active ? '' : 'an inactive '}${a.memberType ?? 'of unknown type'}`;

/** The member fields a Member without admin rights may change on their own record (contact details). */
export const MEMBER_SELF_SERVICE_COLUMNS = [
  'Phone',
  'StreetAddress1',
  'StreetAddress2',
  'City',
  'State',
  'ZipCode',
  'Email',
  'WorkingStatusID',
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
  };
}
