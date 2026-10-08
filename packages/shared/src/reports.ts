// =========================================================================
// ACTIVITY HISTORY, DONATION HISTORY AND MONTHLY SUMMARIES (Sprint 5K)
// Pure builders shared by every DataService driver. A driver loads the rows
// (already scoped to the council and date range) and hands them here, so the
// sorting and the arithmetic are identical on every platform.
// =========================================================================
import type {
  ActivitySummary,
  ActivityTimeLog,
  DonationHistory,
  DonationHistoryEntry,
  EventDonationSummary,
  FeedbackInboxEntry,
  LessonsRegistryEntry,
  LessonsRegistryFilters,
  MonthlySummary,
  NoShowAuditEntry,
  ShiftAwaitingHours,
} from './contract';
import { daysBetween } from './planning';
import {
  assertInteger,
  assertIsoDate,
  assertText,
  BusinessRuleError,
  FEEDBACK_MAX_LENGTH,
  donationMethodKind,
  mayChangeLesson,
  rollupEventFunds,
  SHIFT_HISTORY_MONTHS,
  subtractMonths,
  summarizeDonations,
  toIsoDate,
  type MemberWriteActor,
} from './rules';
import type {
  Activities,
  ActivityTime,
  Category,
  Council,
  Donation,
  DonationMethod,
  DonationType,
  Event,
  EventSignup,
  LessonsLearned,
  LessonsLearnedCategory,
  Member,
  NoShowReason,
  Shift,
  SystemFeedback,
} from './types';

/** Adds hour or money values in hundredths, so 0.1 + 0.2 style drift never reaches a report. */
const sumHundredths = (values: readonly (number | null | undefined)[]): number =>
  values.reduce<number>((total, v) => total + Math.round((v ?? 0) * 100), 0) / 100;

// ---- activities --------------------------------------------------------------

/** Each activity, in the order given, with its logged time in total. Archived once any time is logged. */
export function summarizeActivities(
  activities: readonly Activities[],
  times: readonly Pick<ActivityTime, 'ActivityID' | 'ActivityDate' | 'Hours'>[],
): ActivitySummary[] {
  return activities.map((activity) => {
    const mine = times.filter((t) => t.ActivityID === activity.id);
    const lastLoggedOn = mine.reduce<string | null>((latest, t) => (latest === null || t.ActivityDate > latest ? t.ActivityDate : latest), null);
    return { activity, entryCount: mine.length, totalHours: sumHundredths(mine.map((t) => t.Hours)), lastLoggedOn, archived: mine.length > 0 };
  });
}

/** An activity's entries with member names, newest ActivityDate first (then newest entry), and their total. */
export function buildActivityTimeLog(
  activity: Activities,
  times: readonly ActivityTime[],
  members: ReadonlyMap<number, { MemberFirstName: string; MemberLastName: string }>,
): ActivityTimeLog {
  const entries = times
    .filter((t) => t.ActivityID === activity.id)
    .map((row) => ({ row, firstName: members.get(row.MemberID)?.MemberFirstName ?? '', lastName: members.get(row.MemberID)?.MemberLastName ?? '' }))
    .sort((a, b) => b.row.ActivityDate.localeCompare(a.row.ActivityDate) || b.row.id - a.row.id);
  return { activity, entries, totalHours: sumHundredths(entries.map((e) => e.row.Hours)) };
}

// ---- donations ---------------------------------------------------------------

export interface DonationHistoryRows {
  /** The council's standalone donations plus every council's donations to `events`. */
  donations: readonly Donation[];
  /** The events to summarize: the council's events, or just the requested one. */
  events: readonly Event[];
  methods: readonly DonationMethod[];
  types: readonly DonationType[];
  /** "First Last" by member id, for RecordedBy. */
  names: ReadonlyMap<number, string>;
}

/**
 * donations.listHistory. Without `eventId`: the council's standalone donations and a summary of every event
 * that has donations. With it: the council's donations to that event and that event's summary (even when empty).
 */
export function buildDonationHistory(councilId: number, eventId: number | undefined, rows: DonationHistoryRows): DonationHistory {
  const methodName = new Map(rows.methods.map((m) => [m.id, m.DonationMethod]));
  const typeName = new Map(rows.types.map((t) => [t.id, t.DonationType]));
  const kindOf = (d: Donation) => donationMethodKind(methodName.get(d.DonationMethodID) ?? '');

  const entries: DonationHistoryEntry[] = rows.donations
    .filter((d) => d.CouncilID === councilId && (eventId === undefined ? d.EventID == null : d.EventID === eventId))
    .sort((a, b) => b.DonationDate.localeCompare(a.DonationDate) || b.id - a.id)
    .map((donation) => ({
      donation,
      methodName: methodName.get(donation.DonationMethodID) ?? '',
      kind: kindOf(donation),
      typeName: typeName.get(donation.DonationTypeID) ?? '',
      recordedByName: donation.RecordedBy == null ? null : (rows.names.get(donation.RecordedBy) ?? null),
    }));

  const events: EventDonationSummary[] = [];
  for (const event of rows.events) {
    const given = rows.donations.filter((d) => d.EventID === event.id).map((d) => ({ DonationAmount: d.DonationAmount, kind: kindOf(d) }));
    if (eventId === undefined && given.length === 0) continue;
    events.push({ event, totals: summarizeDonations(given), fundsManaged: rollupEventFunds(given) !== null });
  }
  events.sort((a, b) => b.event.StartDate.localeCompare(a.event.StartDate) || b.event.id - a.event.id);
  return { entries, events };
}

// ---- monthly summary ---------------------------------------------------------

/** The first and last day of a month, validating the year (1882-9999) and month (1-12). */
export function monthBounds(year: number, month: number): { fromDate: string; toDate: string } {
  assertInteger(year, 'Year', 1882);
  if (year > 9999) throw new BusinessRuleError('INVALID_INPUT', `Year must be at most 9999; received ${year}.`, { year });
  assertInteger(month, 'Month', 1);
  if (month > 12) throw new BusinessRuleError('INVALID_INPUT', `Month must be between 1 and 12; received ${month}.`, { month });
  return { fromDate: toIsoDate(new Date(year, month - 1, 1)), toDate: toIsoDate(new Date(year, month, 0)) };
}

export interface MonthRows {
  /** The council's events whose StartDate falls in the month. */
  events: readonly Event[];
  /** EventTime on the council's events whose shift falls in the month. */
  eventTime: readonly { MemberID: number; Hours: number }[];
  /** ActivityTime on the council's activities dated in the month. */
  activityTime: readonly { MemberID: number; Hours: number }[];
  /** Line items dated in the month on the council's 'Approved' and 'Reimbursed' expense sheets. */
  expenseItems: readonly { Amount: number }[];
  /** The council's CharitableDisbursementLedger checks with a PayoutDate in the month (Sprint 5V). */
  charitableGifts: readonly { Amount: number }[];
}

/** reports.monthlySummary from rows already scoped to the council and month. */
export function summarizeMonth(councilId: number, year: number, month: number, rows: MonthRows): MonthlySummary {
  const { fromDate, toDate } = monthBounds(year, month);
  const eventHours = sumHundredths(rows.eventTime.map((t) => t.Hours));
  const activityHours = sumHundredths(rows.activityTime.map((t) => t.Hours));
  const members = new Set([...rows.eventTime, ...rows.activityTime].map((t) => t.MemberID));

  // Sprint 6I: spend rolls up only from expense report lines and charity checks (Event.Spend was dropped in schema 47).
  const expenses = sumHundredths(rows.expenseItems.map((li) => li.Amount));
  const charitableGiving = sumHundredths(rows.charitableGifts.map((g) => g.Amount));
  const spend = sumHundredths([expenses, charitableGiving]);
  const cash = sumHundredths(rows.events.map((e) => e['FundsRaised-Cash']));
  const electronic = sumHundredths(rows.events.map((e) => e['FundsRaised-Electronic']));
  const raised = sumHundredths([cash, electronic]);

  const highlights = [...rows.events]
    .sort((a, b) => a.StartDate.localeCompare(b.StartDate) || a.id - b.id)
    .filter((e) => typeof e.Highlights === 'string' && e.Highlights.trim() !== '')
    .map((e) => ({ eventId: e.id, eventName: e.EventName, startDate: e.StartDate, text: (e.Highlights as string).trim() }));

  return {
    councilId,
    year,
    month,
    fromDate,
    toDate,
    laborHours: { events: eventHours, activities: activityHours, total: sumHundredths([eventHours, activityHours]) },
    uniqueMembers: members.size,
    finances: { spend, expenses, charitableGiving, cash, electronic, raised, net: Math.round((raised - spend) * 100) / 100 },
    outreach: { attendees: rows.events.reduce((n, e) => n + (e.ActualNumberAttendees ?? 0), 0), events: rows.events.length },
    highlights,
  };
}

// ---- executive audits (Sprint 5L) ----------------------------------------------

/** reports.listNoShowsAudit looks back this many months by default. */
export const NO_SHOW_AUDIT_MONTHS = 6;

/** A signup with the rows around it, as a driver loads it for the audits. */
export interface SignupContextRow {
  signup: EventSignup;
  shift: Shift;
  event: Event;
  member: Pick<Member, 'id' | 'MemberNumber' | 'MemberFirstName' | 'MemberLastName' | 'Phone' | 'Email'>;
}

/** Newest ShiftDate first, then last name, first name and signup id. */
const byShiftThenName = (a: SignupContextRow, b: SignupContextRow) =>
  b.shift.ShiftDate.localeCompare(a.shift.ShiftDate) ||
  a.member.MemberLastName.localeCompare(b.member.MemberLastName) ||
  a.member.MemberFirstName.localeCompare(b.member.MemberFirstName) ||
  a.signup.id - b.signup.id;

/** reports.listNoShowsAudit's threshold: the one given (validated), or NO_SHOW_AUDIT_MONTHS before today. */
export const noShowAuditThreshold = (dateThreshold: unknown, now: Date): string =>
  dateThreshold === undefined ? subtractMonths(now, NO_SHOW_AUDIT_MONTHS) : assertIsoDate(dateThreshold, 'No-show audit date threshold');

/** reports.listNoShowsAudit from the council's no-show signups; `reason` is null where none was recorded. */
export function buildNoShowAudit(rows: readonly (SignupContextRow & { reason: NoShowReason | null })[]): NoShowAuditEntry[] {
  return [...rows].sort(byShiftThenName).map(({ signup, shift, event, member, reason }) => ({
    signup,
    shift,
    event,
    memberId: member.id,
    memberNumber: member.MemberNumber,
    firstName: member.MemberFirstName,
    lastName: member.MemberLastName,
    reason,
  }));
}

/**
 * How a shift with unlogged hours stands today. `closed` mirrors assertShiftReportAllowed exactly: once the
 * shift is older than SHIFT_HISTORY_MONTHS, eventTime.logHours refuses it. `loggableThrough` is the last day
 * that still accepts it.
 */
export function awaitingHoursStatus(shiftDate: string, now: Date): { daysSinceShift: number; closed: boolean; loggableThrough: string } {
  const [y, m, d] = shiftDate.slice(0, 10).split('-').map(Number);
  return {
    daysSinceShift: daysBetween(shiftDate, toIsoDate(now)),
    closed: shiftDate < subtractMonths(now, SHIFT_HISTORY_MONTHS),
    loggableThrough: subtractMonths(new Date(y, m - 1, d), -SHIFT_HISTORY_MONTHS),
  };
}

/** reports.listShiftsAwaitingHours from the council's past, non-no-show signups that have no EventTime row. */
export function buildShiftsAwaitingHours(rows: readonly SignupContextRow[], now: Date): ShiftAwaitingHours[] {
  return [...rows].sort(byShiftThenName).map(({ signup, shift, event, member }) => ({
    signup,
    shift,
    event,
    memberId: member.id,
    firstName: member.MemberFirstName,
    lastName: member.MemberLastName,
    phone: member.Phone,
    email: member.Email,
    ...awaitingHoursStatus(shift.ShiftDate, now),
  }));
}

// ---- the lessons learned registry (Sprint 5L) --------------------------------

/** Validates lessonsLearned.listGlobalRegistry's filters; blank search text is dropped. */
export function cleanLessonsRegistryFilters(filters: LessonsRegistryFilters = {}): LessonsRegistryFilters {
  const out: LessonsRegistryFilters = {};
  if (filters.councilId !== undefined) out.councilId = assertInteger(filters.councilId, 'Council filter', 1);
  if (filters.lessonsCategoryId !== undefined) out.lessonsCategoryId = assertInteger(filters.lessonsCategoryId, 'Lessons category filter', 1);
  if (filters.eventCategoryId !== undefined) out.eventCategoryId = assertInteger(filters.eventCategoryId, 'Event category filter', 1);
  if (filters.fromDate !== undefined) out.fromDate = assertIsoDate(filters.fromDate, 'From date');
  if (filters.toDate !== undefined) out.toDate = assertIsoDate(filters.toDate, 'To date');
  const search = typeof filters.search === 'string' ? filters.search.trim() : '';
  if (search !== '') out.search = search;
  return out;
}

export interface LessonsRegistryRows {
  lessons: readonly LessonsLearned[];
  /** At least every event a lesson points at. */
  events: readonly Pick<Event, 'id' | 'EventName' | 'StartDate' | 'CategoryID' | 'OwnerID'>[];
  eventCouncils: readonly { EventID: number; CouncilID: number }[];
  councils: readonly Pick<Council, 'id' | 'CouncilNumber' | 'CouncilName'>[];
  categories: readonly Category[];
  lessonCategories: readonly LessonsLearnedCategory[];
}

/**
 * lessonsLearned.listGlobalRegistry from every lesson and the rows around it: applies the (cleaned) filters,
 * marks what `actor` may change (rules.mayChangeLesson) and orders newest event StartDate first, then lesson id.
 */
export function buildLessonsRegistry(actor: MemberWriteActor, filters: LessonsRegistryFilters, rows: LessonsRegistryRows): LessonsRegistryEntry[] {
  const events = new Map(rows.events.map((e) => [e.id, e]));
  const councils = new Map(rows.councils.map((c) => [c.id, c]));
  const category = new Map(rows.categories.map((c) => [c.id, c.Category]));
  const lessonCategory = new Map(rows.lessonCategories.map((c) => [c.id, c.LessonsLearnedCategory]));
  const councilIds = new Map<number, number[]>();
  for (const ec of rows.eventCouncils) councilIds.set(ec.EventID, [...(councilIds.get(ec.EventID) ?? []), ec.CouncilID]);
  const search = filters.search?.toLowerCase();

  const out: LessonsRegistryEntry[] = [];
  for (const lesson of rows.lessons) {
    const event = events.get(lesson.EventID);
    if (!event) continue;
    const linked = councilIds.get(event.id) ?? [];
    if (filters.councilId !== undefined && !linked.includes(filters.councilId)) continue;
    if (filters.lessonsCategoryId !== undefined && lesson.LeassonsLearnedCategoryID !== filters.lessonsCategoryId) continue;
    if (filters.eventCategoryId !== undefined && event.CategoryID !== filters.eventCategoryId) continue;
    if (filters.fromDate !== undefined && event.StartDate < filters.fromDate) continue;
    if (filters.toDate !== undefined && event.StartDate > filters.toDate) continue;
    if (
      search !== undefined &&
      !lesson.LessonsLearnedDescription.toLowerCase().includes(search) &&
      !event.EventName.toLowerCase().includes(search)
    ) {
      continue;
    }
    out.push({
      lesson,
      eventId: event.id,
      eventName: event.EventName,
      eventStartDate: event.StartDate,
      eventCategory: category.get(event.CategoryID) ?? '',
      lessonsCategory: lessonCategory.get(lesson.LeassonsLearnedCategoryID) ?? '',
      councils: linked
        .map((id) => councils.get(id))
        .filter((c): c is NonNullable<typeof c> => c !== undefined)
        .map((c) => ({ id: c.id, CouncilNumber: c.CouncilNumber, CouncilName: c.CouncilName }))
        .sort((a, b) => a.CouncilNumber - b.CouncilNumber || a.id - b.id),
      canModify: mayChangeLesson(actor, event, linked),
    });
  }
  return out.sort((a, b) => b.eventStartDate.localeCompare(a.eventStartDate) || a.lesson.id - b.lesson.id);
}

// ---- system feedback (Sprint 5P) -------------------------------------------------

/** feedback.submit's text: trimmed, required, at most FEEDBACK_MAX_LENGTH characters. */
export const cleanFeedbackText = (text: unknown): string => assertText(text, 'Feedback', FEEDBACK_MAX_LENGTH);

/** feedback.listInbox from every report and the members and councils around them: newest SubmittedAt first, then newest id. */
export function buildFeedbackInbox(
  feedback: readonly SystemFeedback[],
  members: readonly Pick<Member, 'id' | 'CouncilID' | 'MemberFirstName' | 'MemberLastName' | 'Phone' | 'Email'>[],
  councils: readonly Pick<Council, 'id' | 'CouncilNumber'>[],
): FeedbackInboxEntry[] {
  const memberById = new Map(members.map((m) => [m.id, m]));
  const councilNumber = new Map(councils.map((c) => [c.id, c.CouncilNumber]));
  return [...feedback]
    .sort((a, b) => b.SubmittedAt.localeCompare(a.SubmittedAt) || b.id - a.id)
    .map((f) => {
      const m = memberById.get(f.MemberID);
      return {
        feedback: { ...f },
        firstName: m?.MemberFirstName ?? '',
        lastName: m?.MemberLastName ?? '',
        councilNumber: (m && councilNumber.get(m.CouncilID)) ?? 0,
        phone: m?.Phone ?? '',
        email: m?.Email ?? '',
      };
    });
}
