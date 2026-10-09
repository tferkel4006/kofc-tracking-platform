// =========================================================================
// PRE-EVENT PLANNING HOURS (Sprint 6P)
// Pure helpers behind events.listPlanningTime, logPlanningTime and deletePlanningTime. Planning Hours are the time a
// member spends preparing an event (meetings with vendors, buying supplies, making the flyer) before its first day.
// Each entry is the logger's own time, dated before the event's StartDate and not in the future, in 15-minute steps
// (assertValidHours). They are kept apart from shift hours (EventTime) and volunteer hour totals.
// =========================================================================
import type { EventPlanningLog, PlanningTimeEntry, PlanningTimeInput } from './contract';
import {
  assertIsoDate,
  assertText,
  assertValidHours,
  BusinessRuleError,
  describeActor,
  hasAdminRights,
  hasSuperAdminRights,
  SecurityPrivilegeError,
  type MemberWriteActor,
} from './rules';
import type { Event, EventPlanningTime, Member } from './types';

/** Longest EventPlanningTime.notes (VARCHAR(255)). */
export const PLANNING_NOTES_MAX_LENGTH = 255;

type PlanningEvent = Pick<Event, 'id' | 'OwnerID'>;

function planningDenial(actor: MemberWriteActor, event: PlanningEvent, councilIds: readonly number[], action: string): SecurityPrivilegeError | null {
  if (hasSuperAdminRights(actor)) return null;
  if (actor.active && event.OwnerID === actor.memberId) return null;
  if (!hasAdminRights(actor) && !(actor.active && actor.officer)) {
    return new SecurityPrivilegeError(
      'ADMIN_REQUIRED',
      `Member ${actor.memberId} cannot ${action}: Planning Hours are logged by the event's owner, an officer or Admin of a council it is linked to, or a Super Admin; member ${actor.memberId} is ${describeActor(actor)}.`,
      { actorId: actor.memberId, eventId: event.id },
    );
  }
  if (councilIds.includes(actor.councilId)) return null;
  return new SecurityPrivilegeError(
    'COUNCIL_ACCESS_DENIED',
    `Member ${actor.memberId} of council ${actor.councilId} cannot ${action}; event ${event.id} belongs to council${councilIds.length === 1 ? '' : 's'} ${councilIds.join(', ')}.`,
    { actorId: actor.memberId, actorCouncilId: actor.councilId, councilIds: [...councilIds], eventId: event.id },
  );
}

/**
 * events.logPlanningTime: the event's Active owner, an Active officer or Admin of a council the event is linked to, or
 * any Active Super Admin (ADMIN_REQUIRED, COUNCIL_ACCESS_DENIED).
 */
export function assertMayLogPlanningTime(actor: MemberWriteActor, event: PlanningEvent, councilIds: readonly number[], action: string): void {
  const denial = planningDenial(actor, event, councilIds, action);
  if (denial) throw denial;
}

/** assertMayLogPlanningTime as a yes/no, for the Planning Hours panel. */
export const mayLogPlanningTime = (actor: MemberWriteActor, event: PlanningEvent, councilIds: readonly number[]): boolean =>
  planningDenial(actor, event, councilIds, 'log Planning Hours') === null;

/**
 * events.deletePlanningTime: the member who logged the entry while they may still log Planning Hours for the event,
 * or an Active Admin of a linked council or Super Admin.
 */
export function assertMayDeletePlanningTime(
  actor: MemberWriteActor,
  entry: Pick<EventPlanningTime, 'id' | 'member_id'>,
  event: PlanningEvent,
  councilIds: readonly number[],
): void {
  const action = `delete Planning Hours entry ${entry.id}`;
  if (hasSuperAdminRights(actor)) return;
  if (hasAdminRights(actor) && councilIds.includes(actor.councilId)) return;
  if (entry.member_id !== actor.memberId) {
    throw new SecurityPrivilegeError('ADMIN_REQUIRED', `Member ${actor.memberId} cannot ${action}: only its author or an Admin can.`, {
      actorId: actor.memberId,
      entryId: entry.id,
    });
  }
  assertMayLogPlanningTime(actor, event, councilIds, action);
}

/**
 * Validates one Planning Hours entry for `event` on `today` (YYYY-MM-DD): a real date before the event's StartDate and
 * not after today (INVALID_DATE for a malformed date, INVALID_INPUT otherwise), hours in 15-minute steps in (0, 24]
 * (INVALID_HOURS, HOURS_OUT_OF_RANGE, INVALID_HOURS_INCREMENT), and notes of at most PLANNING_NOTES_MAX_LENGTH.
 */
export function cleanPlanningTimeInput(
  input: PlanningTimeInput,
  event: Pick<Event, 'id' | 'EventName' | 'StartDate'>,
  today: string,
): { planning_date: string; hours: number; notes: string | null } {
  const date = assertIsoDate(input?.planningDate, 'Planning date');
  if (date >= event.StartDate) {
    throw new BusinessRuleError(
      'INVALID_INPUT',
      `Planning Hours are logged before the event: "${event.EventName}" starts ${event.StartDate}, so the planning date must be before that day; received ${date}.`,
      { eventId: event.id, planningDate: date, startDate: event.StartDate },
    );
  }
  if (date > today) {
    throw new BusinessRuleError('INVALID_INPUT', `The planning date ${date} is in the future; log Planning Hours after the work is done.`, { planningDate: date, today });
  }
  const hours = assertValidHours(input.hours, 'Planning hours');
  const notes = input.notes == null ? '' : assertText(input.notes, 'Planning notes', PLANNING_NOTES_MAX_LENGTH, false);
  return { planning_date: date, hours, notes: notes === '' ? null : notes };
}

/** RECORD_NOT_FOUND unless the entry exists. */
export function requirePlanningTime<T extends EventPlanningTime>(row: T | null | undefined, entryId: number): T {
  if (!row) throw new BusinessRuleError('RECORD_NOT_FOUND', `Planning Hours entry ${entryId} does not exist.`, { entryId });
  return row;
}

/** The event's Planning Hours log: entries newest planning date first (then newest id), names attached, and the total. */
export function buildPlanningLog(eventId: number, rows: readonly EventPlanningTime[], members: readonly Pick<Member, 'id' | 'MemberFirstName' | 'MemberLastName'>[]): EventPlanningLog {
  const name = new Map(members.map((m) => [m.id, `${m.MemberFirstName} ${m.MemberLastName}`]));
  const entries: PlanningTimeEntry[] = rows
    .filter((r) => r.event_id === eventId)
    .map((r) => ({ ...r, hours: Number(r.hours), memberName: name.get(r.member_id) ?? `Member ${r.member_id}` }))
    .sort((a, b) => b.planning_date.localeCompare(a.planning_date) || b.id - a.id);
  const totalHours = Math.round(entries.reduce((sum, e) => sum + e.hours, 0) * 100) / 100;
  return { eventId, entries, totalHours };
}
