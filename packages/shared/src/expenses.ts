// =========================================================================
// EXPENSE REPORTING (Sprint 5R)
// Pure helpers behind the expenses.* service methods: input cleaning, the
// status life cycle and the report details the screens read. Drivers load rows,
// call these, then only store. Who may review a council's sheets is decided in
// rules.ts (assertMayAuditCouncilExpenses). The form helpers at the end are
// shared by the web portal and the phone app (Sprint 5R-2).
// =========================================================================
import type { DataService, DisbursementCheckDetails, ExpenseLineItemInput, ExpenseReportDetail, ExpenseReportInput } from './contract';
import { meetingLastDate } from './meetings';
import { addDays } from './planning';
import { formatDate } from './presentation';
import { assertIsoDate, assertMoney, assertText, BusinessRuleError, optionalText, toIsoDate } from './rules';
import type { Event, ExpenseDisbursement, ExpenseLineItem, ExpenseReport, ExpenseReportStatus, Meeting, Member } from './types';

/** Every ExpenseReport.Status, in life-cycle order. */
export const EXPENSE_REPORT_STATUSES: readonly ExpenseReportStatus[] = ['Draft', 'Submitted', 'Approved', 'Reimbursed'];
/** Statuses shown in the council queue (expenses.listCouncilQueue). */
export const EXPENSE_QUEUE_STATUSES: readonly ExpenseReportStatus[] = ['Submitted', 'Approved'];
/** Statuses whose line items count as council spend in reports.monthlySummary (Sprint 5R-1.5). */
export const EXPENSE_SPEND_STATUSES: readonly ExpenseReportStatus[] = ['Approved', 'Reimbursed'];

/** Longest ExpenseLineItem.VendorName (VARCHAR(255)). */
export const EXPENSE_VENDOR_MAX_LENGTH = 255;
/** Longest ExpenseLineItem.ReceiptPhotoURL (VARCHAR(2000)). */
export const EXPENSE_RECEIPT_URL_MAX_LENGTH = 2000;
/** Longest ExpenseLineItem.ExpenseDescription; the column is TEXT, the cap keeps a sheet readable. */
export const EXPENSE_DESCRIPTION_MAX_LENGTH = 2000;
/** Longest ExpenseDisbursement.CheckNumber (VARCHAR(50)). */
export const CHECK_NUMBER_MAX_LENGTH = 50;
/** Longest ExpenseReport.RejectionReason (VARCHAR(2000)). */
export const REJECTION_REASON_MAX_LENGTH = 2000;
/** Longest ExpenseDisbursement.Notes; the column is TEXT. */
export const DISBURSEMENT_NOTES_MAX_LENGTH = 2000;

const invalid = (message: string, details: Record<string, unknown> = {}) => new BusinessRuleError('INVALID_INPUT', message, details);

const isId = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v > 0;

function optionalId(value: unknown, label: string): number | null {
  if (value === undefined || value === null) return null;
  if (!isId(value)) throw invalid(`${label} must be a record id; received ${JSON.stringify(value)}.`, { label });
  return value;
}

export interface CleanExpenseReportInput {
  id: number | null;
  Status: 'Draft' | 'Submitted';
  LinkedEventID: number | null;
  LinkedMeetingID: number | null;
  /** BIT (Sprint 6E): 1 when the submitter ticked "This item is a long-term Council Asset". */
  is_long_term_asset: number;
  /** Sprint 6G Extension: the charitable request the sheet spends for; the driver checks it is the sheet's council's. */
  charity_request_id: number | null;
}

/** expenses.submitReport: the sheet's own fields. Only 'Draft' and 'Submitted' may be written by a member. */
export function cleanExpenseReportInput(input: ExpenseReportInput): CleanExpenseReportInput {
  if (typeof input !== 'object' || input === null) throw invalid('An expense report is required.');
  if (input.Status !== 'Draft' && input.Status !== 'Submitted') {
    throw invalid(`An expense report can be saved only as 'Draft' or 'Submitted'; received ${JSON.stringify(input.Status)}.`, {
      status: input.Status,
    });
  }
  return {
    id: optionalId(input.id, 'Expense report id'),
    Status: input.Status,
    LinkedEventID: optionalId(input.LinkedEventID, 'Linked event'),
    LinkedMeetingID: optionalId(input.LinkedMeetingID, 'Linked meeting'),
    is_long_term_asset: longTermAssetFlag(input.is_long_term_asset),
    charity_request_id: optionalId(input.charity_request_id, 'Linked charitable request'),
  };
}

/** The long-term asset checkbox as a BIT: true or 1 is 1; false, 0 or left out is 0 (Sprint 6E). */
function longTermAssetFlag(value: unknown): number {
  if (value === undefined || value === null || value === false || value === 0) return 0;
  if (value === true || value === 1) return 1;
  throw invalid(`The long-term asset flag must be true or false; received ${JSON.stringify(value)}.`, { field: 'is_long_term_asset' });
}

/**
 * expenses.submitReport: the complete list of receipts. Each needs a past or present date, an amount above 0 in
 * whole cents, a vendor and a description; a 'Submitted' sheet needs at least one.
 */
export function cleanExpenseLineItems(
  items: readonly ExpenseLineItemInput[],
  status: 'Draft' | 'Submitted',
  now: Date,
): ExpenseLineItemInput[] {
  if (!Array.isArray(items)) throw invalid('Line items must be a list.');
  if (status === 'Submitted' && items.length === 0) {
    throw invalid('A submitted expense report needs at least one line item.');
  }
  const today = toIsoDate(now);
  return items.map((item, i) => {
    const label = `Line item ${i + 1}`;
    if (typeof item !== 'object' || item === null) throw invalid(`${label} is missing.`, { index: i });
    const date = assertIsoDate(item.DateOfExpense, `${label} date`);
    if (date > today) throw invalid(`${label} is dated ${date}, which is in the future.`, { index: i, date });
    const amount = assertMoney(item.Amount, `${label} amount`);
    if (amount === 0) throw invalid(`${label} amount must be more than 0.`, { index: i });
    return {
      DateOfExpense: date,
      Amount: amount,
      VendorName: assertText(item.VendorName, `${label} vendor`, EXPENSE_VENDOR_MAX_LENGTH),
      ReceiptPhotoURL: optionalText(item.ReceiptPhotoURL, `${label} receipt photo`, EXPENSE_RECEIPT_URL_MAX_LENGTH),
      ExpenseDescription: assertText(item.ExpenseDescription, `${label} description`, EXPENSE_DESCRIPTION_MAX_LENGTH),
    };
  });
}

/**
 * A sheet may point only at an event linked to its council and a meeting of its council. `eventCouncilIds` is null
 * when the linked event does not exist, `meeting` null when the linked meeting does not; each is read only when the
 * sheet links one.
 */
export function assertExpenseLinks(
  report: Pick<CleanExpenseReportInput, 'LinkedEventID' | 'LinkedMeetingID'>,
  councilId: number,
  eventCouncilIds: readonly number[] | null,
  meeting: Pick<Meeting, 'CouncilID'> | null,
): void {
  const eventId = report.LinkedEventID;
  if (eventId !== null) {
    if (eventCouncilIds === null) throw invalid(`No event with id ${eventId}.`, { eventId });
    if (!eventCouncilIds.includes(councilId)) {
      throw invalid(`Event ${eventId} is not linked to council ${councilId}, so an expense report of that council cannot name it.`, { eventId, councilId });
    }
  }
  const meetingId = report.LinkedMeetingID;
  if (meetingId !== null) {
    if (meeting === null) throw invalid(`No meeting with id ${meetingId}.`, { meetingId });
    if (meeting.CouncilID !== councilId) {
      throw invalid(`Meeting ${meetingId} belongs to another council, so an expense report of council ${councilId} cannot name it.`, { meetingId, councilId });
    }
  }
}

/** expenses.submitReport (Sprint 6G Extension): a linked charitable request must exist and be the sheet's council's. */
export function assertExpenseCharityRequestLink(
  report: Pick<CleanExpenseReportInput, 'charity_request_id'>,
  councilId: number,
  request: { CouncilID: number } | null,
): void {
  const requestId = report.charity_request_id;
  if (requestId === null) return;
  if (request === null) throw invalid(`No charitable request with id ${requestId}.`, { charityRequestId: requestId });
  if (request.CouncilID !== councilId) {
    throw invalid(`Charitable request ${requestId} belongs to another council, so an expense report of council ${councilId} cannot name it.`, {
      charityRequestId: requestId,
      councilId,
    });
  }
}

/** How many days after a linked event or meeting ends its expense sheets may still be submitted (Sprint 5Z-5). */
export const EXPENSE_SUBMISSION_GRACE_DAYS = 30;

/**
 * The days a linked event or meeting spans, for the expense submission window: an event runs StartDate - EndDate, a
 * meeting Date - its last day (EndDate for a multi-day meeting).
 */
export interface ExpenseWindowSpan {
  kind: 'event' | 'meeting';
  id: number;
  start: string;
  end: string;
}

export const eventExpenseSpan = (e: Pick<Event, 'id' | 'StartDate' | 'EndDate'>): ExpenseWindowSpan => ({
  kind: 'event',
  id: e.id,
  start: String(e.StartDate).slice(0, 10),
  end: String(e.EndDate).slice(0, 10),
});

export const meetingExpenseSpan = (m: Pick<Meeting, 'id' | 'Date'> & Partial<Pick<Meeting, 'IsMultiDay' | 'EndDate'>>): ExpenseWindowSpan => ({
  kind: 'meeting',
  id: m.id,
  start: String(m.Date).slice(0, 10),
  end: String(meetingLastDate(m)).slice(0, 10),
});

/** Where `today` falls against a span's submission window. */
export type ExpenseWindowState = 'not-open' | 'open' | 'closed';

/** The last day a span's expenses may be submitted: EXPENSE_SUBMISSION_GRACE_DAYS after it ends. */
export const expenseWindowCloses = (span: ExpenseWindowSpan): string => addDays(span.end, EXPENSE_SUBMISSION_GRACE_DAYS);

/** 'not-open' before the span starts, 'closed' after expenseWindowCloses, otherwise 'open' (both ends inclusive). */
export function expenseWindowState(span: ExpenseWindowSpan, today: string): ExpenseWindowState {
  if (today < span.start) return 'not-open';
  if (today > expenseWindowCloses(span)) return 'closed';
  return 'open';
}

/** The lock line the forms show beside a span outside its window, or null when it is open. */
export function expenseWindowLockMessage(span: ExpenseWindowSpan, today: string): string | null {
  const state = expenseWindowState(span, today);
  if (state === 'open') return null;
  if (state === 'not-open') return `Submission opens ${formatDate(span.start)}, when the ${span.kind} starts. Save a draft until then.`;
  return `Submission closed ${formatDate(expenseWindowCloses(span))}, ${EXPENSE_SUBMISSION_GRACE_DAYS} days after the ${span.kind} ended.`;
}

/**
 * expenses.submitReport timeline rule (Sprint 5Z-5; meetings too since Sprint 5Z-6): a sheet linked to an event or a
 * meeting may be submitted only from the day it starts through EXPENSE_SUBMISSION_GRACE_DAYS days after it ends, both
 * inclusive, by the local calendar date of `now`. Earlier rejects EXPENSE_WINDOW_NOT_OPEN, later EXPENSE_WINDOW_CLOSED.
 * Every linked span must be open. Drafts may be saved at any time, and a sheet linking nothing is not limited. Call after
 * assertExpenseLinks.
 */
export function assertExpenseSubmissionWindow(status: 'Draft' | 'Submitted', spans: readonly ExpenseWindowSpan[], now: Date): void {
  if (status !== 'Submitted') return;
  const today = toIsoDate(now);
  for (const span of spans) {
    const state = expenseWindowState(span, today);
    const details = { kind: span.kind, id: span.id, startDate: span.start, endDate: span.end, today };
    if (state === 'not-open') {
      throw new BusinessRuleError(
        'EXPENSE_WINDOW_NOT_OPEN',
        `Expenses for ${span.kind} ${span.id} can be submitted from the day it starts (${span.start}); save the sheet as a draft until then.`,
        details,
      );
    }
    if (state === 'closed') {
      throw new BusinessRuleError(
        'EXPENSE_WINDOW_CLOSED',
        `Expenses for ${span.kind} ${span.id} had to be submitted within ${EXPENSE_SUBMISSION_GRACE_DAYS} days of its end (${span.end}); the window closed on ${expenseWindowCloses(span)}.`,
        { ...details, closesOn: expenseWindowCloses(span) },
      );
    }
  }
}

/** expenses.rejectReport: why the sheet goes back to its submitter; required. */
export const cleanRejectionReason = (value: unknown): string => assertText(value, 'Rejection reason', REJECTION_REASON_MAX_LENGTH);

/** expenses.recordDisbursement: a sheet being paid must belong to the paying council. */
export function assertReportInCouncil(report: Pick<ExpenseReport, 'id' | 'CouncilID'>, councilId: number): void {
  if (report.CouncilID === councilId) return;
  throw invalid(`Expense report ${report.id} belongs to council ${report.CouncilID}, not council ${councilId}.`, {
    reportId: report.id,
    reportCouncilId: report.CouncilID,
    councilId,
  });
}

/** expenses.recordDisbursement: a non-empty list of distinct sheet ids. */
export function cleanExpenseReportIds(reportIds: readonly number[]): number[] {
  if (!Array.isArray(reportIds) || reportIds.length === 0) throw invalid('Choose at least one expense report to pay.');
  const seen = new Set<number>();
  for (const id of reportIds) {
    if (!isId(id)) throw invalid(`Expense report ids must be record ids; received ${JSON.stringify(id)}.`);
    if (seen.has(id)) throw invalid(`Expense report ${id} is listed more than once.`, { reportId: id });
    seen.add(id);
  }
  return [...reportIds];
}

/** expenses.recordDisbursement: the check. */
export function cleanDisbursementCheck(details: DisbursementCheckDetails): Required<DisbursementCheckDetails> {
  if (typeof details !== 'object' || details === null) throw invalid('Check details are required.');
  return {
    CheckNumber: assertText(details.CheckNumber, 'Check number', CHECK_NUMBER_MAX_LENGTH),
    PayoutDate: assertIsoDate(details.PayoutDate, 'Payout date'),
    Notes: optionalText(details.Notes, 'Notes', DISBURSEMENT_NOTES_MAX_LENGTH),
  };
}

/** A check number may be used once per council (compared ignoring case and surrounding spaces). */
export function assertCheckNumberUnused(checkNumber: string, councilId: number, existing: readonly Pick<ExpenseDisbursement, 'CheckNumber'>[]): void {
  const key = checkNumber.trim().toLowerCase();
  if (existing.some((d) => d.CheckNumber.trim().toLowerCase() === key)) {
    throw invalid(`Council ${councilId} already recorded check ${checkNumber}.`, { councilId, checkNumber });
  }
}

export const expenseReportNotFound = (reportId: number): BusinessRuleError =>
  new BusinessRuleError('RECORD_NOT_FOUND', `Expense report ${reportId} does not exist.`, { table: 'ExpenseReport', id: reportId });

/** Rejects EXPENSE_STATUS_CONFLICT unless the sheet is in `expected`. `action` completes "cannot ...". */
export function assertExpenseStatus(report: Pick<ExpenseReport, 'id' | 'Status'>, expected: ExpenseReportStatus, action: string): void {
  if (report.Status === expected) return;
  throw new BusinessRuleError(
    'EXPENSE_STATUS_CONFLICT',
    `Expense report ${report.id} is ${report.Status}, so it cannot ${action}; only a ${expected} report can.`,
    { reportId: report.id, status: report.Status, expected },
  );
}

/** The two signature lines on a submitted sheet (Sprint 5Z-3), in the order they are signed. */
export type ExpenseSignatureStage = 'financialSecretary' | 'grandKnight';

/**
 * Rejects EXPENSE_STATUS_CONFLICT unless the sheet is ready for `stage`: 'Submitted' in both cases, with no written order
 * yet for the Financial Secretary, and with the order already issued for the Grand Knight.
 */
export function assertExpenseSignatureStage(
  report: Pick<ExpenseReport, 'id' | 'Status' | 'FinancialSecretaryMemberID'>,
  stage: ExpenseSignatureStage,
): void {
  const ordered = report.FinancialSecretaryMemberID != null;
  if (stage === 'financialSecretary') {
    assertExpenseStatus(report, 'Submitted', 'receive a written order');
    if (!ordered) return;
    throw new BusinessRuleError('EXPENSE_STATUS_CONFLICT', `Expense report ${report.id} already carries the Financial Secretary's written order.`, {
      reportId: report.id,
      status: report.Status,
      stage,
    });
  }
  assertExpenseStatus(report, 'Submitted', 'be authorized');
  if (ordered) return;
  throw new BusinessRuleError(
    'EXPENSE_STATUS_CONFLICT',
    `Expense report ${report.id} awaits the Financial Secretary's written order, so the Grand Knight cannot counter-sign it yet.`,
    { reportId: report.id, status: report.Status, stage },
  );
}

type SignatureFields = Pick<ExpenseReport, 'FinancialSecretaryMemberID' | 'GrandKnightMemberID'>;

/** The sheet carries both the Financial Secretary's written order and the Grand Knight's counter-signature. */
export const isDualSigned = (report: SignatureFields): boolean => report.FinancialSecretaryMemberID != null && report.GrandKnightMemberID != null;

/** A 'Submitted' sheet on the Financial Secretary Audit Desk: no written order yet (Sprint 5Z-4). */
export const awaitsWrittenOrder = (report: Pick<ExpenseReport, 'Status'> & SignatureFields): boolean =>
  report.Status === 'Submitted' && report.FinancialSecretaryMemberID == null;

/** A 'Submitted' sheet on the Grand Knight Authorization Desk: ordered, not yet counter-signed (Sprint 5Z-4). */
export const awaitsCounterSignature = (report: Pick<ExpenseReport, 'Status'> & SignatureFields): boolean =>
  report.Status === 'Submitted' && report.FinancialSecretaryMemberID != null && report.GrandKnightMemberID == null;

/** A sheet the checkbook may pay: 'Approved' with both signatures (the disbursement vault shows nothing else). */
export const isPayableExpenseReport = (report: Pick<ExpenseReport, 'Status'> & SignatureFields): boolean =>
  report.Status === 'Approved' && isDualSigned(report);

/**
 * expenses.recordDisbursement (Sprint 5Z-4): no check pays a sheet missing either signature, whatever its Status
 * (EXPENSE_STATUS_CONFLICT). Call after assertExpenseStatus(report, 'Approved', ...).
 */
export function assertDualSigned(report: Pick<ExpenseReport, 'id'> & SignatureFields): void {
  if (isDualSigned(report)) return;
  throw new BusinessRuleError(
    'EXPENSE_STATUS_CONFLICT',
    `Expense report ${report.id} lacks the Financial Secretary's written order or the Grand Knight's counter-signature, so no check can pay it.`,
    { reportId: report.id, financialSecretaryMemberId: report.FinancialSecretaryMemberID ?? null, grandKnightMemberId: report.GrandKnightMemberID ?? null },
  );
}

/**
 * What expenses.rejectReport writes over the signature lines: a returned sheet starts its approvals again, and its
 * budget line is chosen afresh (Sprint 6G Extension).
 */
export const CLEARED_EXPENSE_SIGNATURES = {
  FinancialSecretaryMemberID: null,
  FinancialSecretaryApprovedAt: null,
  GrandKnightMemberID: null,
  GrandKnightApprovedAt: null,
  budget_line_id: null,
} as const;

/** Amounts summed to the cent, free of floating-point drift. */
export const sumAmounts = (amounts: readonly number[]): number =>
  amounts.reduce((cents, a) => cents + Math.round(a * 100), 0) / 100;

/**
 * Joins sheets with their line items, submitters and checks, keeping the order of `reports`. Line items run oldest
 * DateOfExpense first, then id.
 */
export function buildExpenseReportDetails(
  reports: readonly ExpenseReport[],
  lineItems: readonly ExpenseLineItem[],
  members: readonly Pick<Member, 'id' | 'MemberFirstName' | 'MemberLastName'>[],
  disbursements: readonly ExpenseDisbursement[],
  charityRequests: readonly { id: number; TargetBudgetLineID?: number | null }[] = [],
): ExpenseReportDetail[] {
  return reports.map((report) => {
    const items = lineItems
      .filter((li) => li.ExpenseReportID === report.id)
      .map((li) => ({ ...li }))
      .sort((a, b) => a.DateOfExpense.localeCompare(b.DateOfExpense) || a.id - b.id);
    const submitter = members.find((m) => m.id === report.SubmitterMemberID);
    const fullName = (id: number | null | undefined) => {
      const m = id == null ? undefined : members.find((x) => x.id === id);
      return m ? `${m.MemberFirstName} ${m.MemberLastName}`.trim() : '';
    };
    const disbursement = disbursements.find((d) => d.id === report.DisbursementID);
    return {
      report: { ...report },
      lineItems: items,
      total: sumAmounts(items.map((li) => li.Amount)),
      submitterFirstName: submitter?.MemberFirstName ?? '',
      submitterLastName: submitter?.MemberLastName ?? '',
      disbursement: disbursement ? { ...disbursement } : null,
      financialSecretaryName: fullName(report.FinancialSecretaryMemberID),
      grandKnightName: fullName(report.GrandKnightMemberID),
      charityBudgetLineId:
        report.charity_request_id == null ? null : (charityRequests.find((r) => r.id === report.charity_request_id)?.TargetBudgetLineID ?? null),
    };
  });
}

// ---- expense forms (web portal and phone app) ----------------------------------------

/** 'Thu, Sep 24, 2026': expense sheets name events and meetings from earlier years too. */
const datedLabel = (date: string): string => `${formatDate(date)}, ${date.slice(0, 4)}`;

/** The events and meetings an expense sheet of the council may name, newest first. */
export interface ExpenseReferenceOptions {
  events: Event[];
  meetings: Meeting[];
}

/** Every event linked to the council and every meeting of it, past and future, newest first. */
export async function listExpenseReferences(db: Pick<DataService, 'events' | 'meetings'>, councilId: number): Promise<ExpenseReferenceOptions> {
  const [events, meetings] = await Promise.all([db.events.listByCouncil(councilId), db.meetings.listUpcoming(councilId, { fromDate: '0001-01-01' })]);
  return { events, meetings: [...meetings].reverse() };
}

/**
 * The single Event-or-Meeting picker on the expense forms stores one key: '' for no reference, 'event:<id>' or
 * 'meeting:<id>'. A sheet naming both (the data allows it; the forms never write it) reads as its event.
 */
export function expenseReferenceKey(report: Pick<ExpenseReport, 'LinkedEventID' | 'LinkedMeetingID'>): string {
  if (report.LinkedEventID != null) return `event:${report.LinkedEventID}`;
  if (report.LinkedMeetingID != null) return `meeting:${report.LinkedMeetingID}`;
  return '';
}

/** A picker key back to the sheet's link columns. Anything unrecognised is no reference. */
export function parseExpenseReferenceKey(key: string): { LinkedEventID: number | null; LinkedMeetingID: number | null } {
  const m = /^(event|meeting):(\d+)$/.exec(key);
  const id = m ? Number(m[2]) : null;
  return { LinkedEventID: m?.[1] === 'event' ? id : null, LinkedMeetingID: m?.[1] === 'meeting' ? id : null };
}

/** The picker's choices, events first; each label names its date. */
export function expenseReferenceChoices(refs: ExpenseReferenceOptions): { group: 'Events' | 'Meetings'; key: string; label: string }[] {
  return [
    ...refs.events.map((e) => ({ group: 'Events' as const, key: `event:${e.id}`, label: `${e.EventName} · ${datedLabel(e.StartDate)}` })),
    ...refs.meetings.map((m) => ({ group: 'Meetings' as const, key: `meeting:${m.id}`, label: `${m['Meeting Name']} · ${datedLabel(m.Date)}` })),
  ];
}

/** What a sheet was spent on, for grids and cards: 'Event: Pancake Breakfast', 'Meeting: …' or 'General council expense'. */
export function expenseReferenceLabel(report: Pick<ExpenseReport, 'LinkedEventID' | 'LinkedMeetingID'>, refs: ExpenseReferenceOptions): string {
  if (report.LinkedEventID != null) {
    const event = refs.events.find((e) => e.id === report.LinkedEventID);
    return `Event: ${event?.EventName ?? `#${report.LinkedEventID}`}`;
  }
  if (report.LinkedMeetingID != null) {
    const meeting = refs.meetings.find((m) => m.id === report.LinkedMeetingID);
    return `Meeting: ${meeting?.['Meeting Name'] ?? `#${report.LinkedMeetingID}`}`;
  }
  return 'General council expense';
}

/**
 * Status chip on both platforms. A draft leadership sent back reads 'Returned' in red until it is resubmitted; a
 * submitted sheet carrying the Financial Secretary's written order reads 'Order Issued' (Sprint 5Z-4).
 */
export function expenseStatusBadge(report: Pick<ExpenseReport, 'Status' | 'RejectionReason' | 'FinancialSecretaryMemberID'>): {
  label: string;
  tone: 'outline' | 'gold' | 'navy' | 'redOutline';
} {
  if (report.Status === 'Draft' && report.RejectionReason) return { label: 'Returned', tone: 'redOutline' };
  if (report.Status === 'Submitted' && report.FinancialSecretaryMemberID != null) return { label: 'Order Issued', tone: 'gold' };
  const tone = { Draft: 'outline', Submitted: 'gold', Approved: 'navy', Reimbursed: 'navy' } as const;
  return { label: report.Status, tone: tone[report.Status] };
}

/** One receipt row as the forms hold it: text exactly as typed. ReceiptPhotoURL '' means no receipt attached. */
export interface ExpenseLineDraft {
  DateOfExpense: string;
  Amount: string;
  VendorName: string;
  ExpenseDescription: string;
  ReceiptPhotoURL: string;
}

export const blankExpenseLine = (today: string): ExpenseLineDraft => ({
  DateOfExpense: today,
  Amount: '',
  VendorName: '',
  ExpenseDescription: '',
  ReceiptPhotoURL: '',
});

export const expenseLineDraftFrom = (item: ExpenseLineItemInput): ExpenseLineDraft => ({
  DateOfExpense: item.DateOfExpense,
  Amount: String(item.Amount),
  VendorName: item.VendorName,
  ExpenseDescription: item.ExpenseDescription,
  ReceiptPhotoURL: item.ReceiptPhotoURL ?? '',
});

/**
 * Form rows to expenses.submitReport line items. A row left completely empty (only its default date) is dropped,
 * so an unused blank row never blocks saving; a missing or non-numeric amount is refused naming the row. Everything
 * else is validated again by the driver (cleanExpenseLineItems), whose messages use the same row numbers as long as
 * the empty rows come last.
 */
export function expenseLinesFromDrafts(lines: readonly ExpenseLineDraft[]): ExpenseLineItemInput[] {
  const used = lines.filter((l) => [l.Amount, l.VendorName, l.ExpenseDescription, l.ReceiptPhotoURL].some((v) => v.trim() !== ''));
  return used.map((line, i) => {
    const text = line.Amount.trim().replace(/[$,\s]/g, '');
    const amount = Number(text);
    if (text === '' || !Number.isFinite(amount)) {
      throw invalid(
        text === '' ? `Line item ${i + 1} needs an amount.` : `Line item ${i + 1} amount must be a dollar amount such as 42.50; received "${line.Amount}".`,
        { index: i },
      );
    }
    return {
      DateOfExpense: line.DateOfExpense.trim(),
      Amount: amount,
      VendorName: line.VendorName,
      ExpenseDescription: line.ExpenseDescription,
      ReceiptPhotoURL: line.ReceiptPhotoURL.trim() || null,
    };
  });
}

/** The running total of the rows' amounts, ignoring any that are blank or not yet a number. */
export const expenseDraftTotal = (lines: readonly ExpenseLineDraft[]): number =>
  sumAmounts(lines.map((l) => Number(l.Amount.trim().replace(/[$,\s]/g, ''))).filter((n) => Number.isFinite(n)));

/** The event or meeting a form's reference key names, as an expense window span; null for '' or an unknown id. */
export function expenseReferenceSpan(key: string, refs: ExpenseReferenceOptions): ExpenseWindowSpan | null {
  const { LinkedEventID, LinkedMeetingID } = parseExpenseReferenceKey(key);
  if (LinkedEventID !== null) {
    const event = refs.events.find((e) => e.id === LinkedEventID);
    return event ? eventExpenseSpan(event) : null;
  }
  if (LinkedMeetingID !== null) {
    const meeting = refs.meetings.find((m) => m.id === LinkedMeetingID);
    return meeting ? meetingExpenseSpan(meeting) : null;
  }
  return null;
}
