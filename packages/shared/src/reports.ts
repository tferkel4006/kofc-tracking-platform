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
  MonthlySummary,
} from './contract';
import { assertInteger, BusinessRuleError, donationMethodKind, rollupEventFunds, summarizeDonations, toIsoDate } from './rules';
import type { Activities, ActivityTime, Donation, DonationMethod, DonationType, Event } from './types';

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
}

/** reports.monthlySummary from rows already scoped to the council and month. */
export function summarizeMonth(councilId: number, year: number, month: number, rows: MonthRows): MonthlySummary {
  const { fromDate, toDate } = monthBounds(year, month);
  const eventHours = sumHundredths(rows.eventTime.map((t) => t.Hours));
  const activityHours = sumHundredths(rows.activityTime.map((t) => t.Hours));
  const members = new Set([...rows.eventTime, ...rows.activityTime].map((t) => t.MemberID));

  const spend = sumHundredths(rows.events.map((e) => e.Spend));
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
    finances: { spend, cash, electronic, raised, net: Math.round((raised - spend) * 100) / 100 },
    outreach: { attendees: rows.events.reduce((n, e) => n + (e.ActualNumberAttendees ?? 0), 0), events: rows.events.length },
    highlights,
  };
}
