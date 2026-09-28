// =========================================================================
// SUPREME COUNCIL REPORTING THROUGH ALCHEMER (Sprint 5T)
// Pure helpers behind supreme.syncAlchemerReport: the reporting period of each
// form, the compliance snapshot compiled from the council's logged hours,
// events, donations and expense checks, and the Alchemer REST API v5 request
// that files it as a survey response.
//
// Alchemer v5 creates a response with
//   POST https://api.alchemer.com/v5/survey/{surveyId}/surveyresponse?_method=PUT
//        &api_token=...&api_token_secret=...
// and form-encoded answers `data[<question shortname>][value]=...`. Answers go by
// shortname rather than numeric question id, so the survey owner only has to give
// each question the shortname listed in ALCHEMER_SHORTNAMES. No Alchemer account
// is configured yet, so the credentials are placeholders and the default
// transport prints the request with console.log instead of sending it.
// =========================================================================
import type { AlchemerRequest, AlchemerResponse, DonationMethodKind, SupremeComplianceSnapshot, SupremeReportingPeriod } from './contract';
import { BusinessRuleError, summarizeDonations, toIsoDate } from './rules';
import type { SupremeFormType, SupremeSyncStatus } from './types';

export const SUPREME_FORM_TYPES: readonly SupremeFormType[] = ['AnnualSurvey', 'CouncilAudit'];
/** Longest SupremeReportingSync.AlchemerSurveyID (VARCHAR(100)). */
export const ALCHEMER_SURVEY_ID_MAX_LENGTH = 100;
export const ALCHEMER_API_BASE = 'https://api.alchemer.com/v5';
/**
 * Placeholders until an Alchemer account is configured. The production driver must hold the real pair server-side
 * and never log it.
 */
export const ALCHEMER_CREDENTIALS = { apiToken: '[ALCHEMER_API_TOKEN]', apiTokenSecret: '[ALCHEMER_API_TOKEN_SECRET]' } as const;

const invalid = (message: string, details: Record<string, unknown> = {}) => new BusinessRuleError('INVALID_INPUT', message, details);

export function cleanSupremeFormType(formType: unknown): SupremeFormType {
  if (SUPREME_FORM_TYPES.includes(formType as SupremeFormType)) return formType as SupremeFormType;
  throw invalid(`Form type must be one of ${SUPREME_FORM_TYPES.join(', ')}; received ${String(formType)}.`, { formType });
}

/** An Alchemer survey id: digits only, since it is placed in the request URL. */
export function cleanAlchemerSurveyId(surveyId: unknown): string {
  const text = typeof surveyId === 'number' && Number.isInteger(surveyId) ? String(surveyId) : typeof surveyId === 'string' ? surveyId.trim() : '';
  if (!/^\d+$/.test(text) || text.length > ALCHEMER_SURVEY_ID_MAX_LENGTH) {
    throw invalid(`The Alchemer survey id must be a number of at most ${ALCHEMER_SURVEY_ID_MAX_LENGTH} digits; received ${JSON.stringify(surveyId)}.`, {
      surveyId,
    });
  }
  return text;
}

/**
 * The last completed period a form covers on `now`: Form 1728 (AnnualSurvey) the previous calendar year; Form 1295
 * (CouncilAudit) the previous half-year, January-June or July-December.
 */
export function supremeReportingPeriod(formType: SupremeFormType, now: Date): SupremeReportingPeriod {
  const year = now.getFullYear();
  if (formType === 'AnnualSurvey') {
    return { fromDate: `${year - 1}-01-01`, toDate: `${year - 1}-12-31`, label: `${year - 1}` };
  }
  return now.getMonth() < 6
    ? { fromDate: `${year - 1}-07-01`, toDate: `${year - 1}-12-31`, label: `July-December ${year - 1}` }
    : { fromDate: `${year}-01-01`, toDate: toIsoDate(new Date(year, 5, 30)), label: `January-June ${year}` };
}

/** The raw rows a driver reads for a snapshot, already limited to the council and the period. */
export interface SupremeSnapshotRows {
  council: { id: number; CouncilNumber: number; CouncilName: string };
  /** EventTime on the council's events, on shifts dated in the period; `category` is the event's Category. */
  eventTime: readonly { MemberID: number; Hours: number; category: string }[];
  /** ActivityTime on the council's activities, dated in the period; `category` is the activity's Category. */
  activityTime: readonly { MemberID: number; Hours: number; category: string }[];
  /** The council's events starting in the period. */
  events: readonly { Spend?: number | null }[];
  /** The council's donations dated in the period. */
  donations: readonly { DonationAmount: number; kind: DonationMethodKind }[];
  /** The council's expense checks paid in the period. */
  disbursements: readonly { TotalAmount: number }[];
}

const quarterHours = (hours: number) => Math.round(hours * 4) / 4;
const cents = (amount: number) => Math.round(amount * 100);

export function compileSupremeSnapshot(
  formType: SupremeFormType,
  period: SupremeReportingPeriod,
  rows: SupremeSnapshotRows,
): SupremeComplianceSnapshot {
  const sum = (list: readonly { Hours: number }[]) => quarterHours(list.reduce((n, r) => n + r.Hours, 0));
  const byCategory = new Map<string, number>();
  for (const r of [...rows.eventTime, ...rows.activityTime]) byCategory.set(r.category, (byCategory.get(r.category) ?? 0) + r.Hours);
  const events = sum(rows.eventTime);
  const activities = sum(rows.activityTime);
  return {
    councilId: rows.council.id,
    councilNumber: rows.council.CouncilNumber,
    councilName: rows.council.CouncilName,
    formType,
    period,
    volunteerHours: { events, activities, total: quarterHours(events + activities) },
    hoursByCategory: [...byCategory]
      .map(([category, hours]) => ({ category, hours: quarterHours(hours) }))
      .sort((a, b) => a.category.localeCompare(b.category)),
    volunteers: new Set([...rows.eventTime, ...rows.activityTime].map((r) => r.MemberID)).size,
    eventsHeld: rows.events.length,
    donations: summarizeDonations(rows.donations),
    eventSpend: rows.events.reduce((n, e) => n + cents(e.Spend ?? 0), 0) / 100,
    expenseChecks: {
      count: rows.disbursements.length,
      total: rows.disbursements.reduce((n, d) => n + cents(d.TotalAmount), 0) / 100,
    },
  };
}

/** The question shortnames each form's Alchemer survey must use. */
export const ALCHEMER_SHORTNAMES = {
  AnnualSurvey: [
    'council_number',
    'reporting_period',
    'volunteer_hours_events',
    'volunteer_hours_activities',
    'volunteer_hours_total',
    'volunteers',
    'events_held',
    'charitable_donations',
    'donated_item_value',
  ],
  CouncilAudit: [
    'council_number',
    'reporting_period',
    'receipts_cash',
    'receipts_electronic',
    'receipts_total',
    'donation_count',
    'event_spend',
    'expense_checks_count',
    'expense_checks_total',
  ],
} as const satisfies Record<SupremeFormType, readonly string[]>;

/** The snapshot as answers keyed by question shortname, in ALCHEMER_SHORTNAMES order. */
export function alchemerAnswers(snapshot: SupremeComplianceSnapshot): Record<string, string | number> {
  const s = snapshot;
  const all: Record<string, string | number> = {
    council_number: s.councilNumber,
    reporting_period: `${s.period.fromDate} to ${s.period.toDate}`,
    volunteer_hours_events: s.volunteerHours.events,
    volunteer_hours_activities: s.volunteerHours.activities,
    volunteer_hours_total: s.volunteerHours.total,
    volunteers: s.volunteers,
    events_held: s.eventsHeld,
    charitable_donations: s.donations.raised,
    donated_item_value: s.donations.itemValue,
    receipts_cash: s.donations.cash,
    receipts_electronic: s.donations.electronic,
    receipts_total: s.donations.raised,
    donation_count: s.donations.count,
    event_spend: s.eventSpend,
    expense_checks_count: s.expenseChecks.count,
    expense_checks_total: s.expenseChecks.total,
  };
  return Object.fromEntries(ALCHEMER_SHORTNAMES[s.formType].map((key) => [key, all[key]]));
}

/**
 * The Alchemer v5 "create survey response" request for `answers`, marked Complete. Credentials default to the
 * ALCHEMER_CREDENTIALS placeholders.
 */
export function buildAlchemerRequest(
  surveyId: string,
  answers: Record<string, string | number>,
  credentials: { apiToken: string; apiTokenSecret: string } = ALCHEMER_CREDENTIALS,
): AlchemerRequest {
  const query = new URLSearchParams({ _method: 'PUT', api_token: credentials.apiToken, api_token_secret: credentials.apiTokenSecret });
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(answers)) body.append(`data[${key}][value]`, String(value));
  body.append('status', 'Complete');
  return {
    method: 'POST',
    url: `${ALCHEMER_API_BASE}/survey/${encodeURIComponent(surveyId)}/surveyresponse?${query.toString()}`,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
    answers,
  };
}

/**
 * The default transport while no Alchemer account exists: prints the request and answers as Alchemer would on
 * success. The driver records a 'Failed' sync when a transport throws or answers `result_ok: false`.
 */
export function logAlchemerRequest(log: (...args: unknown[]) => void): (request: AlchemerRequest) => Promise<AlchemerResponse> {
  return async (request) => {
    log('[alchemer]', JSON.stringify(request, null, 2));
    return { result_ok: true };
  };
}

/** Posts the request through `post`; a throw or `result_ok: false` makes the sync 'Failed' rather than rejecting. */
export async function postAlchemerReport(
  post: (request: AlchemerRequest) => Promise<AlchemerResponse>,
  request: AlchemerRequest,
): Promise<{ status: SupremeSyncStatus; error: string | null }> {
  try {
    const response = await post(request);
    return response.result_ok ? { status: 'Success', error: null } : { status: 'Failed', error: response.message ?? 'Alchemer did not accept the response.' };
  } catch (err) {
    return { status: 'Failed', error: err instanceof Error ? err.message : String(err) };
  }
}
