// =========================================================================
// EXPENSE REPORTING (Sprint 5R)
// Pure helpers behind the expenses.* service methods: input cleaning, the
// status life cycle and the report details the screens read. Drivers load rows,
// call these, then only store. Who may review a council's sheets is decided in
// rules.ts (assertMayAuditCouncilExpenses).
// =========================================================================
import type { DisbursementCheckDetails, ExpenseLineItemInput, ExpenseReportDetail, ExpenseReportInput } from './contract';
import { assertIsoDate, assertMoney, assertText, BusinessRuleError, optionalText, toIsoDate } from './rules';
import type { ExpenseDisbursement, ExpenseLineItem, ExpenseReport, ExpenseReportStatus, Meeting, Member } from './types';

/** Every ExpenseReport.Status, in life-cycle order. */
export const EXPENSE_REPORT_STATUSES: readonly ExpenseReportStatus[] = ['Draft', 'Submitted', 'Approved', 'Reimbursed'];
/** Statuses shown in the council queue (expenses.listCouncilQueue). */
export const EXPENSE_QUEUE_STATUSES: readonly ExpenseReportStatus[] = ['Submitted', 'Approved'];

/** Longest ExpenseLineItem.VendorName (VARCHAR(255)). */
export const EXPENSE_VENDOR_MAX_LENGTH = 255;
/** Longest ExpenseLineItem.ReceiptPhotoURL (VARCHAR(2000)). */
export const EXPENSE_RECEIPT_URL_MAX_LENGTH = 2000;
/** Longest ExpenseLineItem.ExpenseDescription; the column is TEXT, the cap keeps a sheet readable. */
export const EXPENSE_DESCRIPTION_MAX_LENGTH = 2000;
/** Longest ExpenseDisbursement.CheckNumber (VARCHAR(50)). */
export const CHECK_NUMBER_MAX_LENGTH = 50;
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
  };
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
): ExpenseReportDetail[] {
  return reports.map((report) => {
    const items = lineItems
      .filter((li) => li.ExpenseReportID === report.id)
      .map((li) => ({ ...li }))
      .sort((a, b) => a.DateOfExpense.localeCompare(b.DateOfExpense) || a.id - b.id);
    const submitter = members.find((m) => m.id === report.SubmitterMemberID);
    const disbursement = disbursements.find((d) => d.id === report.DisbursementID);
    return {
      report: { ...report },
      lineItems: items,
      total: sumAmounts(items.map((li) => li.Amount)),
      submitterFirstName: submitter?.MemberFirstName ?? '',
      submitterLastName: submitter?.MemberLastName ?? '',
      disbursement: disbursement ? { ...disbursement } : null,
    };
  });
}
