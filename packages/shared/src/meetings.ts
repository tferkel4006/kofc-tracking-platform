// =========================================================================
// COUNCIL MEETING ARCHITECTURE (Sprint 5Y-6)
// Multi-day meetings, council agenda templates and the global meeting category a council meeting type maps to.
//
// A multi-day meeting (IsMultiDay = 1) runs from Date through EndDate as whole days, with no clock times: its
// Time Start and Time End (NOT NULL) are stored as MULTI_DAY_MEETING_TIME, so it counts no meeting hours. A one-day
// meeting keeps EndDate NULL.
//
// Agenda templates (CouncilAgendaTemplate) are kept by the council's Admins, its Grand Knight and any Super Admin
// (meetings.saveAgendaTemplate); every member's meeting form reads them (meetings.getAgendaTemplate).
// =========================================================================
import { assertFraternalYear } from './budget';
import { GRAND_KNIGHT_ROLE } from './elections';
import { addDays } from './planning';
import { formatDate, formatTimeRange } from './presentation';
import {
  assertIsoDate,
  assertText,
  assertTimeOfDay,
  BusinessRuleError,
  describeActor,
  hasAdminRights,
  hasSuperAdminRights,
  SecurityPrivilegeError,
  type MemberWriteActor,
} from './rules';
import type { CadenceRecipientGroup, Meeting, MeetingType, ProposedMotionSourceType, ProposedMotionVoteResult } from './types';

/** The Time Start and Time End stored on a multi-day meeting, which has no clock times. */
export const MULTI_DAY_MEETING_TIME = '00:00:00';

/** CouncilAgendaTemplate.TemplateText is TEXT; the drivers cap it so a template stays a readable outline. */
export const AGENDA_TEMPLATE_MAX_LENGTH = 10_000;

type MeetingSpan = Pick<Meeting, 'Date' | 'Time Start' | 'Time End'> & Partial<Pick<Meeting, 'IsMultiDay' | 'EndDate'>>;

/** True for a meeting that spans more than one day. */
export const isMultiDayMeeting = (m: Partial<Pick<Meeting, 'IsMultiDay' | 'EndDate'>>): boolean => m.IsMultiDay === 1 && !!m.EndDate;

/** The meeting's last day: EndDate for a multi-day meeting, otherwise its Date. */
export const meetingLastDate = (m: Pick<Meeting, 'Date'> & Partial<Pick<Meeting, 'IsMultiDay' | 'EndDate'>>): string =>
  isMultiDayMeeting(m) ? m.EndDate! : m.Date;

/** 'Thu, Oct 8 · 7:00 PM – 8:30 PM', or 'Thu, Oct 8 – Sat, Oct 10' for a multi-day meeting (no clock times). */
export const formatMeetingWhen = (m: MeetingSpan): string =>
  isMultiDayMeeting(m) ? `${formatDate(m.Date)} – ${formatDate(m.EndDate!)}` : `${formatDate(m.Date)} · ${formatTimeRange(m['Time Start'], m['Time End'])}`;

function multiDayFlag(value: unknown): 0 | 1 {
  if (value === undefined || value === null || value === 0 || value === false) return 0;
  if (value === 1 || value === true) return 1;
  throw new BusinessRuleError('INVALID_INPUT', `IsMultiDay must be 0, 1, true or false; received ${JSON.stringify(value)}.`, { field: 'IsMultiDay' });
}

/**
 * A new meeting's days, as stored: a one-day meeting keeps its times and has no EndDate; a multi-day meeting needs an
 * EndDate after its Date and stores MULTI_DAY_MEETING_TIME for both times. Rejects INVALID_INPUT otherwise.
 */
export function cleanMeetingSpan(m: MeetingSpan): { IsMultiDay: 0 | 1; EndDate: string | null; 'Time Start': string; 'Time End': string } {
  const multiDay = multiDayFlag(m.IsMultiDay);
  if (multiDay === 0) {
    if (m.EndDate != null) {
      throw new BusinessRuleError('INVALID_INPUT', 'Only a multi-day meeting has an end date.', { field: 'EndDate', EndDate: m.EndDate });
    }
    return { IsMultiDay: 0, EndDate: null, 'Time Start': m['Time Start'], 'Time End': m['Time End'] };
  }
  if (m.EndDate == null) throw new BusinessRuleError('INVALID_INPUT', 'A multi-day meeting needs an end date.', { field: 'EndDate' });
  const start = assertIsoDate(m.Date, 'Meeting date');
  const end = assertIsoDate(m.EndDate, 'Meeting end date');
  if (end <= start) {
    throw new BusinessRuleError('INVALID_INPUT', `A multi-day meeting must end (${end}) after the day it starts (${start}).`, { Date: start, EndDate: end });
  }
  return { IsMultiDay: 1, EndDate: end, 'Time Start': MULTI_DAY_MEETING_TIME, 'Time End': MULTI_DAY_MEETING_TIME };
}

/**
 * The global MeetingType a council meeting type files under (Meeting.MeetingType is still NOT NULL): the global type
 * of the same name, ignoring case, or else the first global type. Undefined only when there are no global types.
 */
export function globalMeetingTypeFor(typeName: string, globals: readonly Pick<MeetingType, 'id' | 'Type'>[]): number | undefined {
  const wanted = typeName.trim().toLowerCase();
  return (globals.find((g) => String(g.Type).trim().toLowerCase() === wanted) ?? globals[0])?.id;
}

/**
 * The council's meeting keepers - an Active Admin or Grand Knight of the council, or any Active Super Admin - who edit
 * its agenda templates and lay down its annual meeting cadence. `can` completes "can ...", `cannot` "cannot ...".
 */
function meetingKeeperDenial(actor: MemberWriteActor, councilId: number, can: string, cannot: string): SecurityPrivilegeError | null {
  if (hasSuperAdminRights(actor)) return null;
  const grandKnight = actor.active && (actor.roles ?? []).includes(GRAND_KNIGHT_ROLE);
  if (!hasAdminRights(actor) && !grandKnight) {
    return new SecurityPrivilegeError(
      'ADMIN_REQUIRED',
      `Only an active Admin or the Grand Knight of the council, or a Super Admin, can ${can}; member ${actor.memberId} is ${describeActor(actor)}.`,
      { actorId: actor.memberId, actorType: actor.memberType ?? null, councilId },
    );
  }
  if (actor.councilId !== councilId) {
    return new SecurityPrivilegeError(
      'COUNCIL_ACCESS_DENIED',
      `Member ${actor.memberId} of council ${actor.councilId} cannot ${cannot}.`,
      { actorId: actor.memberId, actorCouncilId: actor.councilId, councilId },
    );
  }
  return null;
}

const agendaDenial = (actor: MemberWriteActor, councilId: number): SecurityPrivilegeError | null =>
  meetingKeeperDenial(actor, councilId, 'edit its agenda templates', `edit the agenda templates of council ${councilId}`);

/** meetings.saveAgendaTemplate: an Active Admin or Grand Knight of the council, or an Active Super Admin. */
export function assertMayManageAgendaTemplates(actor: MemberWriteActor, councilId: number): void {
  const denial = agendaDenial(actor, councilId);
  if (denial) throw denial;
}

export const mayManageAgendaTemplates = (actor: MemberWriteActor, councilId: number): boolean => agendaDenial(actor, councilId) === null;

/** councils.setBylaws (Sprint 6Z): the council's meeting keepers, as for its agenda templates. */
export function assertMayEditBylaws(actor: MemberWriteActor, councilId: number): void {
  const denial = meetingKeeperDenial(actor, councilId, 'edit its bylaws', `edit the bylaws of council ${councilId}`);
  if (denial) throw denial;
}

/** An agenda template's text, trimmed; '' means "remove the template". Rejects INVALID_INPUT past the cap. */
export const cleanAgendaTemplateText = (value: unknown): string => assertText(value, 'Agenda template', AGENDA_TEMPLATE_MAX_LENGTH, false);

// ---- parliamentary cadence (Sprint 5Z-5) ---------------------------------------
//
// A CouncilCadenceConfig names when one of the council's meeting types recurs ('First Tuesday', 'Last Thursday'):
// meetings.populateAnnualCadence expands it into the twelve meetings of a fraternal year, July through June, each at
// DefaultStartTime for CADENCE_MEETING_MINUTES at DefaultLocation, with the council's agenda template for the type.

/** How long a meeting laid down by populateAnnualCadence runs; the config carries only a start time. */
export const CADENCE_MEETING_MINUTES = 120;

/** The ordinals a CadencePattern may use. 'Fifth' is left out: not every month has one, and a year needs twelve. */
export const CADENCE_ORDINALS = ['First', 'Second', 'Third', 'Fourth', 'Last'] as const;
export type CadenceOrdinal = (typeof CADENCE_ORDINALS)[number];

/** Weekday names in Date.getDay() order. */
export const CADENCE_WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
export type CadenceWeekday = (typeof CADENCE_WEEKDAYS)[number];

export interface CadenceRule {
  ordinal: CadenceOrdinal;
  weekday: CadenceWeekday;
}

const capitalized = (word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();

/** 'first tuesday' -> { ordinal: 'First', weekday: 'Tuesday' }. Rejects INVALID_INPUT for anything else. */
export function parseCadencePattern(value: unknown): CadenceRule {
  const words = typeof value === 'string' ? value.trim().split(/\s+/).map(capitalized) : [];
  const [ordinal, weekday] = words;
  if (words.length === 2 && (CADENCE_ORDINALS as readonly string[]).includes(ordinal) && (CADENCE_WEEKDAYS as readonly string[]).includes(weekday)) {
    return { ordinal: ordinal as CadenceOrdinal, weekday: weekday as CadenceWeekday };
  }
  throw new BusinessRuleError(
    'INVALID_INPUT',
    `A cadence pattern is an ordinal (${CADENCE_ORDINALS.join(', ')}) and a weekday, as 'First Tuesday'; received ${JSON.stringify(value)}.`,
    { field: 'CadencePattern', value },
  );
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** The day in `year`/`month` (1-12) that `rule` names, as YYYY-MM-DD. */
export function cadenceDateInMonth(rule: CadenceRule, year: number, month: number): string {
  const target = CADENCE_WEEKDAYS.indexOf(rule.weekday);
  const daysInMonth = new Date(year, month, 0).getDate();
  let day: number;
  if (rule.ordinal === 'Last') {
    const lastWeekday = new Date(year, month - 1, daysInMonth).getDay();
    day = daysInMonth - ((lastWeekday - target + 7) % 7);
  } else {
    const firstWeekday = new Date(year, month - 1, 1).getDay();
    day = 1 + ((target - firstWeekday + 7) % 7) + 7 * CADENCE_ORDINALS.indexOf(rule.ordinal);
  }
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/** The twelve dates `pattern` names in `fraternalYear` ('YYYY-YYYY'), July of its first year through June of its second. */
export function cadenceDatesForYear(pattern: unknown, fraternalYear: string): string[] {
  const rule = parseCadencePattern(pattern);
  const start = Number(assertFraternalYear(fraternalYear).slice(0, 4));
  return Array.from({ length: 12 }, (_, i) => {
    const month = ((6 + i) % 12) + 1; // July (7) .. June (6)
    return cadenceDateInMonth(rule, month >= 7 ? start : start + 1, month);
  });
}

/** A cadence meeting's Time Start and Time End: DefaultStartTime and CADENCE_MEETING_MINUTES later, kept on the same day. */
export function cadenceMeetingTimes(defaultStartTime: unknown): { 'Time Start': string; 'Time End': string } {
  const start = assertTimeOfDay(defaultStartTime, 'Default start time');
  const [h, m] = start.split(':').map(Number);
  const endMinutes = Math.min(h * 60 + m + CADENCE_MEETING_MINUTES, 23 * 60 + 59);
  return { 'Time Start': start, 'Time End': `${pad2(Math.floor(endMinutes / 60))}:${pad2(endMinutes % 60)}:00` };
}

/** The name populateAnnualCadence gives a meeting of the council type `typeName`: 'Monthly' -> 'Monthly Meeting'. */
export const cadenceMeetingName = (typeName: string): string => `${typeName.trim()} Meeting`.slice(0, 100);

export const cadenceConfigNotFound = (configId: number, councilId: number): BusinessRuleError =>
  new BusinessRuleError('RECORD_NOT_FOUND', `Council ${councilId} has no meeting cadence with id ${configId}.`, { configId, councilId });

/** meetings.populateAnnualCadence: the council's meeting keepers - an Active Admin or Grand Knight, or an Active Super Admin. */
export function assertMayScheduleCouncilCadence(actor: MemberWriteActor, councilId: number): void {
  const denial = meetingKeeperDenial(actor, councilId, 'lay down its annual meeting cadence', `lay down the meeting cadence of council ${councilId}`);
  if (denial) throw denial;
}

// ---- proposed motions (Sprint 5Z-5) ---------------------------------------------

/** Every ProposedMotion.SourceType. */
export const PROPOSED_MOTION_SOURCE_TYPES: readonly ProposedMotionSourceType[] = ['CharitableRequest', 'GeneralMember'];
/** Every ProposedMotion.VoteResult; 'Pending' until the council votes. */
export const PROPOSED_MOTION_VOTE_RESULTS: readonly ProposedMotionVoteResult[] = ['Pending', 'Passed', 'Failed', 'Tabled'];
/** ProposedMotion.AllocatedMinutes default (the column's DEFAULT 5). */
export const PROPOSED_MOTION_DEFAULT_MINUTES = 5;

// ---- drip-release invitations and cadence recipients (Sprint 5Z-6) ---------------
//
// A cadence meeting is on the master calendar from the day populateAnnualCadence lays it down, and its invitation
// rows exist from then too, but members' own feeds (listUpcoming for a member, listSchedules, rsvpToInvite) ignore
// them until Meeting.InviteReleaseDate, CADENCE_INVITE_LEAD_DAYS calendar days before the meeting. That keeps a
// year of monthly invitations from crowding the phone's meeting list.

/** Calendar days before a cadence meeting that its invitations reach members' feeds. */
export const CADENCE_INVITE_LEAD_DAYS = 5;

/** Who a cadence's meetings may invite: the built-in distribution groups, or nobody (invite by hand later). */
export const CADENCE_RECIPIENT_GROUPS: readonly { value: CadenceRecipientGroup; label: string }[] = [
  { value: 'all_members', label: 'All Members' },
  { value: 'active_officers', label: 'Active Officers' },
  { value: 'none', label: 'Nobody (invite by hand)' },
];

export const cadenceRecipientLabel = (group: CadenceRecipientGroup): string =>
  CADENCE_RECIPIENT_GROUPS.find((g) => g.value === group)?.label ?? group;

/** The meetings.create invitation mode a recipient group stands for. */
export function cadenceInviteMode(group: CadenceRecipientGroup): 'allActive' | 'officers' | 'none' {
  if (group === 'all_members') return 'allActive';
  if (group === 'active_officers') return 'officers';
  return 'none';
}

/** The day a cadence meeting on `date` releases its invitations: CADENCE_INVITE_LEAD_DAYS days before. */
export const cadenceInviteReleaseDate = (date: string): string => addDays(date, -CADENCE_INVITE_LEAD_DAYS);

/** True once the meeting's invitations may appear in members' feeds on `today` (YYYY-MM-DD). */
export const isInvitationReleased = (m: Partial<Pick<Meeting, 'InviteReleaseDate'>>, today: string): boolean =>
  m.InviteReleaseDate == null || String(m.InviteReleaseDate).slice(0, 10) <= today;

/** What meetings.saveCadenceConfig writes for one of the council's meeting types. */
export interface CadenceConfigInput {
  MeetingTypeID: number;
  CadencePattern: string;
  DefaultStartTime: string;
  DefaultLocation: string;
  DefaultRecipientGroup?: CadenceRecipientGroup;
}

/** Longest CouncilCadenceConfig.DefaultLocation; the column is TEXT, the cap matches Meeting.Location (VARCHAR(100)). */
export const CADENCE_LOCATION_MAX_LENGTH = 100;

/**
 * meetings.saveCadenceConfig: the pattern stored in its canonical spelling ('first tuesday' -> 'First Tuesday'), the
 * start time as 'HH:MM', a required location and a known recipient group (default 'all_members'). Rejects INVALID_INPUT.
 */
export function cleanCadenceConfigInput(input: CadenceConfigInput): Required<CadenceConfigInput> {
  if (typeof input !== 'object' || input === null) throw new BusinessRuleError('INVALID_INPUT', 'A meeting cadence is required.');
  if (!Number.isInteger(input.MeetingTypeID) || input.MeetingTypeID <= 0) {
    throw new BusinessRuleError('INVALID_INPUT', `A meeting cadence needs one of the council's meeting types; received ${JSON.stringify(input.MeetingTypeID)}.`, {
      field: 'MeetingTypeID',
    });
  }
  const rule = parseCadencePattern(input.CadencePattern);
  const group = input.DefaultRecipientGroup ?? 'all_members';
  if (!CADENCE_RECIPIENT_GROUPS.some((g) => g.value === group)) {
    throw new BusinessRuleError('INVALID_INPUT', `Unknown recipient group ${JSON.stringify(group)}.`, { field: 'DefaultRecipientGroup', value: group });
  }
  return {
    MeetingTypeID: input.MeetingTypeID,
    CadencePattern: `${rule.ordinal} ${rule.weekday}`,
    DefaultStartTime: assertTimeOfDay(input.DefaultStartTime, 'Default start time').slice(0, 5),
    DefaultLocation: assertText(input.DefaultLocation, 'Default location', CADENCE_LOCATION_MAX_LENGTH),
    DefaultRecipientGroup: group,
  };
}
