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
import { GRAND_KNIGHT_ROLE } from './elections';
import { formatDate, formatTimeRange } from './presentation';
import {
  assertIsoDate,
  assertText,
  BusinessRuleError,
  describeActor,
  hasAdminRights,
  hasSuperAdminRights,
  SecurityPrivilegeError,
  type MemberWriteActor,
} from './rules';
import type { Meeting, MeetingType } from './types';

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

function agendaDenial(actor: MemberWriteActor, councilId: number): SecurityPrivilegeError | null {
  if (hasSuperAdminRights(actor)) return null;
  const grandKnight = actor.active && (actor.roles ?? []).includes(GRAND_KNIGHT_ROLE);
  if (!hasAdminRights(actor) && !grandKnight) {
    return new SecurityPrivilegeError(
      'ADMIN_REQUIRED',
      `Only an active Admin or the Grand Knight of the council, or a Super Admin, can edit its agenda templates; member ${actor.memberId} is ${describeActor(actor)}.`,
      { actorId: actor.memberId, actorType: actor.memberType ?? null, councilId },
    );
  }
  if (actor.councilId !== councilId) {
    return new SecurityPrivilegeError(
      'COUNCIL_ACCESS_DENIED',
      `Member ${actor.memberId} of council ${actor.councilId} cannot edit the agenda templates of council ${councilId}.`,
      { actorId: actor.memberId, actorCouncilId: actor.councilId, councilId },
    );
  }
  return null;
}

/** meetings.saveAgendaTemplate: an Active Admin or Grand Knight of the council, or an Active Super Admin. */
export function assertMayManageAgendaTemplates(actor: MemberWriteActor, councilId: number): void {
  const denial = agendaDenial(actor, councilId);
  if (denial) throw denial;
}

export const mayManageAgendaTemplates = (actor: MemberWriteActor, councilId: number): boolean => agendaDenial(actor, councilId) === null;

/** An agenda template's text, trimmed; '' means "remove the template". Rejects INVALID_INPUT past the cap. */
export const cleanAgendaTemplateText = (value: unknown): string => assertText(value, 'Agenda template', AGENDA_TEMPLATE_MAX_LENGTH, false);
