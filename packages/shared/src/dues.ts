// =========================================================================
// MEMBERSHIP DUES & BUDGET PERFORMANCE TRACKER (Sprint 6A, Phase 5)
// Pure helpers behind the Financial Management Center's two Phase 5 panels:
//   - buildDuesForecast: the council's projected dues income - its Active and Inactive members times
//     Council.base_dues_rate (schema 41).
//   - buildConcludedBudgetPerformance (budget.getConcludedPerformance): budget against actual spend for the events and
//     meetings of the current fraternal year that have concluded, with each annual event's previous occurrence as a
//     read-only Historical Benchmark. Benchmarks never enter the totals, and nothing here touches the general ledger or
//     cash on hand.
// Drivers load rows already scoped to one council, call these, and return the result.
// Sprint 6B: councils.setDuesRate writes base_dues_rate, and only the council's Grand Knight or Financial Secretary may
// (assertMayEditDuesRate / canEditDuesRate) - no Admin or Super Admin bypass.
// =========================================================================
import { budgetAlertOf, budgetPercentUsed, fraternalYearBounds, BUDGET_MEETINGS_LINE_NAME, type BudgetAlert } from './budget';
import { BusinessRuleError, describeActor, SecurityPrivilegeError, type MemberWriteActor } from './rules';
import type { CouncilBudgetForecast, MemberStatus } from './types';

const cents = (value: number | null | undefined) => Math.round((value ?? 0) * 100);
const sumCents = (values: readonly (number | null | undefined)[]) => values.reduce<number>((t, v) => t + cents(v), 0) / 100;
const nameKey = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();

// ---- membership dues -----------------------------------------------------------

/** Council.base_dues_rate's column default, used when a council row has no rate. */
export const DEFAULT_BASE_DUES_RATE = 40;

/** The member statuses that owe dues: Former and Deceased members are off the dues roll. */
export const DUES_BILLABLE_STATUSES: readonly MemberStatus['Status'][] = ['Active', 'Inactive'];

export interface DuesForecast {
  rate: number;
  activeCount: number;
  inactiveCount: number;
  billableCount: number;
  activeIncome: number;
  inactiveIncome: number;
  /** billableCount times rate: the projected dues income budget line. */
  projectedIncome: number;
}

/** The council's dues rate, or DEFAULT_BASE_DUES_RATE when the row has none (or a negative one). */
export function duesRateOf(council: { base_dues_rate?: number | null } | null | undefined): number {
  const rate = council?.base_dues_rate;
  return rate == null || !Number.isFinite(rate) || rate < 0 ? DEFAULT_BASE_DUES_RATE : cents(rate) / 100;
}

/** Counts the members by status name (MemberStatus lookup) and multiplies the billable ones by the council's rate. */
export function buildDuesForecast(input: {
  council: { base_dues_rate?: number | null } | null | undefined;
  members: readonly { StatusID: number }[];
  statuses: readonly MemberStatus[];
}): DuesForecast {
  const rate = duesRateOf(input.council);
  const nameOf = new Map(input.statuses.map((s) => [s.id, s.Status]));
  const count = (status: MemberStatus['Status']) => input.members.filter((m) => nameOf.get(m.StatusID) === status).length;
  const activeCount = count('Active');
  const inactiveCount = count('Inactive');
  const income = (n: number) => (n * cents(rate)) / 100;
  return {
    rate,
    activeCount,
    inactiveCount,
    billableCount: activeCount + inactiveCount,
    activeIncome: income(activeCount),
    inactiveIncome: income(inactiveCount),
    projectedIncome: income(activeCount + inactiveCount),
  };
}

// ---- the base dues rate editor (Sprint 6B) -------------------------------------

/** The seats that set Council.base_dues_rate, matched by Role name like FINANCE_ROLE_NAMES. Nobody else may. */
export const DUES_RATE_EDITOR_ROLE_NAMES = ['Grand Knight', 'Financial Secretary'] as const;

/** The largest rate Council.base_dues_rate's DECIMAL(10,2) holds. */
export const DUES_RATE_MAX = 99_999_999.99;

const holdsDuesRateSeat = (roles: readonly string[] | undefined) =>
  (roles ?? []).some((r) => (DUES_RATE_EDITOR_ROLE_NAMES as readonly string[]).includes(r));

/**
 * councils.setDuesRate: an Active Grand Knight or Financial Secretary of the council. Admins and Super Admins without
 * one of those seats are refused (DUES_RATE_EDITOR_REQUIRED); a seat-holder of another council gets COUNCIL_ACCESS_DENIED.
 */
export function assertMayEditDuesRate(actor: MemberWriteActor, councilId: number): void {
  if (!actor.active || !holdsDuesRateSeat(actor.roles)) {
    throw new SecurityPrivilegeError(
      'DUES_RATE_EDITOR_REQUIRED',
      `Only the council's Grand Knight or Financial Secretary can set its base dues rate; member ${actor.memberId} is ${describeActor(actor)}.`,
      { actorId: actor.memberId, councilId },
    );
  }
  if (actor.councilId !== councilId) {
    throw new SecurityPrivilegeError(
      'COUNCIL_ACCESS_DENIED',
      `Member ${actor.memberId} of council ${actor.councilId} cannot set the base dues rate of council ${councilId}.`,
      { actorId: actor.memberId, actorCouncilId: actor.councilId, councilId },
    );
  }
}

/** The Base Dues Rate panel's Save button, mirroring assertMayEditDuesRate (activity status is checked there). */
export const canEditDuesRate = (u: { councilId: number; roles?: readonly string[] }, councilId: number): boolean =>
  holdsDuesRateSeat(u.roles) && u.councilId === councilId;

/** A dues rate in dollars: a finite number from 0 to DUES_RATE_MAX in whole cents. Rejects INVALID_INPUT otherwise. */
export function cleanDuesRate(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > DUES_RATE_MAX || Math.abs(value * 100 - Math.round(value * 100)) > 1e-6) {
    throw new BusinessRuleError('INVALID_INPUT', `The base dues rate must be a dollar amount from 0 to ${DUES_RATE_MAX} in whole cents; got ${String(value)}.`, {
      field: 'base_dues_rate',
      value,
    });
  }
  return cents(value) / 100;
}

// ---- budgeted vs. actual for concluded events and meetings ----------------------

/** The rows a driver loads for budget.getConcludedPerformance, all scoped to one council. */
export interface ConcludedPerformanceRows {
  /** Every event linked to the council, any year (earlier years supply the benchmarks). */
  events: readonly {
    id: number;
    EventName: string;
    StartDate: string;
    EndDate: string;
    IsAnnual?: boolean | number | null;
    Budget?: number | null;
  }[];
  /** Line items of the council's 'Approved' and 'Reimbursed' expense sheets linked to an event or a meeting. */
  expenses: readonly { EventID: number | null; MeetingID: number | null; Amount: number }[];
  /** The council's meetings, any date. */
  meetings: readonly { id: number; Date: string; EndDate?: string | null }[];
  /** The year's forecast lines; the 'Council Meetings' line supplies the meetings budget once the year is approved. */
  lines: readonly CouncilBudgetForecast[];
}

/** An annual event's previous occurrence: shown beside it for reference only, never added to any total. */
export interface HistoricalBenchmark {
  eventId: number;
  eventName: string;
  startDate: string;
  budget: number | null;
  actual: number;
  percentUsed: number | null;
}

export interface ConcludedEventPerformance {
  eventId: number;
  eventName: string;
  startDate: string;
  endDate: string;
  isAnnual: boolean;
  /** Event.Budget; null when the event was never given one. */
  budget: number | null;
  /**
   * The sum of the event's line items on 'Approved' and 'Reimbursed' expense sheets (Sprint 6B: the manual Event.Spend
   * field is never read).
   */
  actual: number;
  /** budget minus actual (negative when over); null without a budget. */
  variance: number | null;
  percentUsed: number | null;
  alert: BudgetAlert;
  /** Annual events only: the most recent earlier event of the same name; null when there is none. */
  benchmark: HistoricalBenchmark | null;
}

export interface ConcludedMeetingsPerformance {
  lineName: string;
  meetingCount: number;
  /** The year's approved 'Council Meetings' cap; null until the year is approved or without such a line. */
  budget: number | null;
  actual: number;
  variance: number | null;
  percentUsed: number | null;
  alert: BudgetAlert;
}

export interface ConcludedBudgetPerformance {
  councilId: number;
  fraternalYear: string;
  fromDate: string;
  /** The last day counted: yesterday, or the year's June 30 once it has ended. */
  throughDate: string;
  /** Newest first. */
  events: ConcludedEventPerformance[];
  meetings: ConcludedMeetingsPerformance;
  /** Events and meetings together; benchmarks are excluded. */
  totals: { budget: number; actual: number; variance: number; percentUsed: number | null; alert: BudgetAlert };
}

const dayBefore = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  const prev = new Date(y, m - 1, d - 1);
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-${String(prev.getDate()).padStart(2, '0')}`;
};

/**
 * Budget against actual spend for the year's events and meetings that ended before `today` (YYYY-MM-DD). An event is
 * counted when its EndDate falls between the year's July 1 and the day before `today`; a meeting likewise by its
 * EndDate, or its Date for a one-day meeting. An annual event carries its benchmark: the most recent earlier event of
 * the same name (ignoring case and spacing) that had itself concluded.
 */
export function buildConcludedBudgetPerformance(input: {
  councilId: number;
  fraternalYear: string;
  today: string;
  rows: ConcludedPerformanceRows;
}): ConcludedBudgetPerformance {
  const { councilId, fraternalYear, today, rows } = input;
  const { fromDate, toDate } = fraternalYearBounds(fraternalYear);
  const yesterday = dayBefore(today);
  const throughDate = yesterday < toDate ? yesterday : toDate;
  const inYear = (date: string) => date >= fromDate && date <= throughDate;

  const eventExpenseCents = new Map<number, number>();
  const meetingExpenseCents = new Map<number, number>();
  for (const x of rows.expenses) {
    if (x.EventID != null) eventExpenseCents.set(x.EventID, (eventExpenseCents.get(x.EventID) ?? 0) + cents(x.Amount));
    else if (x.MeetingID != null) meetingExpenseCents.set(x.MeetingID, (meetingExpenseCents.get(x.MeetingID) ?? 0) + cents(x.Amount));
  }
  const actualOf = (e: ConcludedPerformanceRows['events'][number]) => (eventExpenseCents.get(e.id) ?? 0) / 100;
  const budgetOf = (e: ConcludedPerformanceRows['events'][number]) => (e.Budget == null ? null : cents(e.Budget) / 100);
  const concluded = rows.events.filter((e) => e.EndDate < today);

  const benchmarkOf = (e: ConcludedPerformanceRows['events'][number]): HistoricalBenchmark | null => {
    const prior = concluded
      .filter((p) => p.id !== e.id && p.StartDate < e.StartDate && nameKey(p.EventName) === nameKey(e.EventName))
      .sort((a, b) => b.StartDate.localeCompare(a.StartDate) || b.id - a.id)[0];
    if (!prior) return null;
    const budget = budgetOf(prior);
    const actual = actualOf(prior);
    return { eventId: prior.id, eventName: prior.EventName, startDate: prior.StartDate, budget, actual, percentUsed: budgetPercentUsed(budget ?? 0, actual) };
  };

  const events: ConcludedEventPerformance[] = concluded
    .filter((e) => inYear(e.EndDate))
    .sort((a, b) => b.EndDate.localeCompare(a.EndDate) || b.id - a.id)
    .map((e) => {
      const budget = budgetOf(e);
      const actual = actualOf(e);
      const isAnnual = !!e.IsAnnual;
      return {
        eventId: e.id,
        eventName: e.EventName,
        startDate: e.StartDate,
        endDate: e.EndDate,
        isAnnual,
        budget,
        actual,
        variance: budget == null ? null : sumCents([budget, -actual]),
        percentUsed: budgetPercentUsed(budget ?? 0, actual),
        alert: budgetAlertOf(budget ?? 0, actual),
        benchmark: isAnnual ? benchmarkOf(e) : null,
      };
    });

  const heldMeetings = rows.meetings.filter((m) => inYear(m.EndDate ?? m.Date));
  const meetingsActual = heldMeetings.reduce((t, m) => t + (meetingExpenseCents.get(m.id) ?? 0), 0) / 100;
  const meetingsLine = rows.lines.find(
    (l) => l.CategoryType === 'Operational' && l.ReferenceSourceID == null && nameKey(l.LineItemName) === nameKey(BUDGET_MEETINGS_LINE_NAME),
  );
  const meetingsBudget = meetingsLine && meetingsLine.BudgetStatus === 'Approved' ? cents(meetingsLine.ApprovedBudgetAmount) / 100 : null;
  const meetings: ConcludedMeetingsPerformance = {
    lineName: meetingsLine?.LineItemName ?? BUDGET_MEETINGS_LINE_NAME,
    meetingCount: heldMeetings.length,
    budget: meetingsBudget,
    actual: meetingsActual,
    variance: meetingsBudget == null ? null : sumCents([meetingsBudget, -meetingsActual]),
    percentUsed: budgetPercentUsed(meetingsBudget ?? 0, meetingsActual),
    alert: budgetAlertOf(meetingsBudget ?? 0, meetingsActual),
  };

  const budget = sumCents([...events.map((e) => e.budget), meetings.budget]);
  const actual = sumCents([...events.map((e) => e.actual), meetings.actual]);
  return {
    councilId,
    fraternalYear,
    fromDate,
    throughDate,
    events,
    meetings,
    totals: { budget, actual, variance: sumCents([budget, -actual]), percentUsed: budgetPercentUsed(budget, actual), alert: budgetAlertOf(budget, actual) },
  };
}
