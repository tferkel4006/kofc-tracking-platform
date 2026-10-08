'use client';
// Pieces shared by the expense screens (My Expense Reports, the audit queue, the two dual-approval desks and check
// disbursements): the status chip, the receipt link, the read-only receipt grid, the signature trail, the return form
// and the signature desk grid (Sprint 5Z-4), and the desks' 'Assign Ledger Budget Line Item' picker (Sprint 6G).
import { Fragment, useState, type ReactNode } from 'react';
import {
  assignableExpenseBudgetLines,
  currentFraternalYear,
  defaultExpenseBudgetLineId,
  describeError,
  expenseReferenceLabel,
  expenseStatusBadge,
  REJECTION_REASON_MAX_LENGTH,
  type CouncilBudgetForecast,
  type ExpenseLineItem,
  type ExpenseReferenceOptions,
  type ExpenseReport,
  type ExpenseReportDetail,
  driveFileViewUrl,
  isDriveFileId,
} from '@kofc/shared';
import { Button, Empty, Field, Notice, Pill, Select, Table, Td, Textarea } from '@/components/ui';
import { formatFullDate, formatMoney, formatPersonName, minutesFileName } from '@/lib/format';
import { photoName, photoSrc } from '@/lib/media';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

export const submitterName = (d: ExpenseReportDetail) =>
  formatPersonName(d.submitterFirstName, d.submitterLastName) || `Member ${d.report.SubmitterMemberID}`;

export function ExpenseStatusPill({ report }: { report: Pick<ExpenseReport, 'Status' | 'RejectionReason' | 'FinancialSecretaryMemberID'> }) {
  const { label, tone } = expenseStatusBadge(report);
  return <Pill tone={tone}>{label}</Pill>;
}

/**
 * A stored receipt reference. Files attached in the portal are browser blob links with the file name after the #
 * (as meeting minutes are); a phone's file:// path exists only on that phone, so it is named but not linked.
 */
export function ReceiptLink({ url }: { url: string | null | undefined }) {
  if (!url) return <span className="text-muted">None</span>;
  if (isDriveFileId(url)) {
    return (
      <a href={driveFileViewUrl(url)} target="_blank" rel="noreferrer" className="font-bold underline">
        Receipt (Google Drive)
      </a>
    );
  }
  const name = url.includes('#') ? (minutesFileName(url) ?? url) : photoName(url);
  const src = photoSrc(url);
  if (!src) {
    return (
      <span className="text-xs" title={url}>
        {name} <span className="text-muted">(on the member&apos;s phone)</span>
      </span>
    );
  }
  return (
    <a href={src} target="_blank" rel="noreferrer" className="font-bold underline">
      {name}
    </a>
  );
}

/** A sheet's receipts, oldest first as the driver returns them, with their total. */
export function ExpenseLineItemsTable({ items, total, caption }: { items: readonly ExpenseLineItem[]; total: number; caption: string }) {
  return (
    <Table caption={caption} head={['Date', 'Vendor', 'Description', 'Receipt', 'Amount']}>
      {items.map((li) => (
        <tr key={li.id}>
          <Td className="whitespace-nowrap">{formatFullDate(li.DateOfExpense)}</Td>
          <Td className="font-bold">{li.VendorName}</Td>
          <Td>{li.ExpenseDescription}</Td>
          <Td>
            <ReceiptLink url={li.ReceiptPhotoURL} />
          </Td>
          <Td className="whitespace-nowrap text-right">{formatMoney(li.Amount)}</Td>
        </tr>
      ))}
      <tr>
        <Td colSpan={4} className="text-right text-xs font-bold uppercase tracking-wide">
          Total
        </Td>
        <Td className="whitespace-nowrap text-right font-bold">{formatMoney(total)}</Td>
      </tr>
    </Table>
  );
}

/** One signature line: who signed and when, or that it is still awaited. */
function SignatureLine({ label, memberId, name, at }: { label: string; memberId: number | null | undefined; name: string; at: string | null | undefined }) {
  return (
    <div className="rounded border border-line p-2">
      <dt className="text-xs font-bold uppercase tracking-wide">{label}</dt>
      <dd className="text-sm">
        {memberId != null ? (
          <>
            <span className="font-bold">{name || `Member ${memberId}`}</span> · {formatFullDate(at)}
          </>
        ) : (
          <span className="text-muted">Awaiting signature</span>
        )}
      </dd>
    </div>
  );
}

/** The two dual-approval signatures on a sheet (Sprint 5Z-3): the written order, then the counter-signature. */
export function SignatureTrail({ detail }: { detail: ExpenseReportDetail }) {
  const { report } = detail;
  return (
    <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2" aria-label={`Signatures on expense report ${report.id}`}>
      <SignatureLine
        label="📜 Written order · Financial Secretary"
        memberId={report.FinancialSecretaryMemberID}
        name={detail.financialSecretaryName}
        at={report.FinancialSecretaryApprovedAt}
      />
      <SignatureLine
        label="✍️ Counter-signature · Grand Knight"
        memberId={report.GrandKnightMemberID}
        name={detail.grandKnightName}
        at={report.GrandKnightApprovedAt}
      />
    </dl>
  );
}

/**
 * Reject & Return for one submitted sheet (expenses.rejectReport; council leadership only): a required reason the
 * member reads on their expense page. Returning clears any signatures, so the sheet is signed afresh.
 */
export function ReturnToMemberForm({ detail, onDone }: { detail: ExpenseReportDetail; onDone: (text: string) => Promise<void> }) {
  const user = useUser();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { report } = detail;
  const who = submitterName(detail);
  if (!open) {
    return (
      <Button variant="danger" onClick={() => setOpen(true)}>
        Reject &amp; Return
      </Button>
    );
  }
  return (
    <form
      className="flex w-full flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        db.expenses
          .rejectReport(user.memberId, report.id, reason)
          .then(() => onDone(`Returned report #${report.id} to ${who} with your reason.`))
          .catch((err: unknown) => {
            setError(describeError(err));
            setBusy(false);
          });
      }}
    >
      {error ? (
        <Notice tone="error" onDismiss={() => setError(null)}>
          {error}
        </Notice>
      ) : null}
      <Field label="Reason for returning (required)" hint={`${who} sees this on their expense page. ${reason.trim().length}/${REJECTION_REASON_MAX_LENGTH} characters.`}>
        {(id) => (
          <Textarea
            id={id}
            required
            autoFocus
            maxLength={REJECTION_REASON_MAX_LENGTH}
            placeholder="e.g. Please attach the itemized Costco receipt; the photo is of the card slip."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        )}
      </Field>
      <div className="flex gap-2">
        <Button type="submit" variant="danger" disabled={busy || reason.trim() === ''}>
          {busy ? 'Returning…' : 'Return to member'}
        </Button>
        <Button variant="secondary" disabled={busy} onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/**
 * The spreadsheet shared by the dual-approval desks: one row per sheet with its submitter, purpose, receipt count,
 * total and status, a receipt drawer, and the desk's command beside the drawer toggle. `action` renders that command
 * (or its lock) for a row; `drawer` adds content under the receipts.
 */
export function SignatureDeskTable({
  rows,
  refs,
  caption,
  empty,
  action,
  drawer,
}: {
  rows: readonly ExpenseReportDetail[];
  refs: ExpenseReferenceOptions;
  caption: string;
  empty: string;
  action: (detail: ExpenseReportDetail) => ReactNode;
  drawer?: (detail: ExpenseReportDetail) => ReactNode;
}) {
  const [openId, setOpenId] = useState<number | null>(null);
  if (rows.length === 0) return <Empty>{empty}</Empty>;
  return (
    <Table caption={caption} head={['Report', 'Submitted by', 'Spent for', 'Receipts', 'Total', 'Status', 'Action']}>
      {rows.map((d) => {
        const open = d.report.id === openId;
        return (
          <Fragment key={d.report.id}>
            <tr>
              <Td className="font-bold">#{d.report.id}</Td>
              <Td>{submitterName(d)}</Td>
              <Td>{expenseReferenceLabel(d.report, refs)}</Td>
              <Td>
                <Button
                  size="sm"
                  variant="secondary"
                  aria-expanded={open}
                  aria-controls={`desk-${d.report.id}`}
                  onClick={() => setOpenId(open ? null : d.report.id)}
                >
                  {open ? '▾' : '▸'} {d.lineItems.length} receipt{d.lineItems.length === 1 ? '' : 's'}
                </Button>
              </Td>
              <Td className="whitespace-nowrap text-right font-bold">{formatMoney(d.total)}</Td>
              <Td>
                <ExpenseStatusPill report={d.report} />
              </Td>
              <Td className="whitespace-nowrap">{action(d)}</Td>
            </tr>
            {open ? (
              <tr>
                <Td colSpan={7} className="border-l-8 border-l-gold bg-white">
                  <div id={`desk-${d.report.id}`} className="flex flex-col gap-3 py-2">
                    <ExpenseLineItemsTable items={d.lineItems} total={d.total} caption={`Receipts on expense report ${d.report.id}`} />
                    <SignatureTrail detail={d} />
                    {drawer ? drawer(d) : null}
                  </div>
                </Td>
              </tr>
            ) : null}
          </Fragment>
        );
      })}
    </Table>
  );
}

// ---- 'Assign Ledger Budget Line Item' (Sprint 6G) ---------------------------------------------------

export const ASSIGN_BUDGET_LINE_LABEL = 'Assign Ledger Budget Line Item';
/** The signing commands of the two dual-approval desks (Sprint 6G Extension). */
export const EXPENSE_APPROVE_LABEL = '📜 Approve Expense';
export const EXPENSE_COUNTERSIGN_LABEL = '✍️ Countersign Expense';

export interface ExpenseBudgetLineAssignments {
  fraternalYear: string;
  /** The council's Approved forecast lines for the fraternal year in progress, in forecast order. */
  lines: readonly CouncilBudgetForecast[];
  loading: boolean;
  error: string | null;
  /**
   * The sheet's line: the signer's pick, else the line already saved on the sheet (budget_line_id), else the line its
   * charitable request, event or meeting link matches; null keeps the approval locked.
   */
  lineIdOf(detail: ExpenseReportDetail): number | null;
  choose(reportId: number, lineId: number | null): void;
}

/**
 * The picker state a signature desk keeps for its rows. A sheet starts on the line saved on it by the written order
 * (ExpenseReport.budget_line_id, Sprint 6G Extension), else on its matching line (defaultExpenseBudgetLineId: its
 * charitable request's line, its Event line, or the fraternal-activities meetings line); a loose receipt starts blank.
 * The signature sends the choice to the data service, which saves it on the sheet.
 */
export function useExpenseBudgetLineAssignments(councilId: number, refs: ExpenseReferenceOptions): ExpenseBudgetLineAssignments {
  const user = useUser();
  const fraternalYear = currentFraternalYear(new Date());
  const forecast = useLoad(() => db.budget.listAnnualForecast(user.memberId, councilId, fraternalYear), [user.memberId, councilId, fraternalYear]);
  const lines = assignableExpenseBudgetLines(forecast.data?.lines ?? []);
  const [picked, setPicked] = useState<ReadonlyMap<number, number | null>>(new Map());
  const lineIdOf = (d: ExpenseReportDetail) => {
    if (picked.has(d.report.id)) return picked.get(d.report.id) ?? null;
    const saved = d.report.budget_line_id ?? null;
    if (saved !== null && lines.some((l) => l.id === saved)) return saved;
    const eventId = d.report.LinkedEventID ?? null;
    return defaultExpenseBudgetLineId(lines, {
      EventID: eventId,
      EventName: eventId === null ? null : (refs.events.find((e) => e.id === eventId)?.EventName ?? null),
      MeetingID: d.report.LinkedMeetingID ?? null,
      CharityBudgetLineID: d.charityBudgetLineId,
    });
  };
  return {
    fraternalYear,
    lines,
    loading: forecast.loading && !forecast.data,
    error: forecast.error,
    lineIdOf,
    choose: (reportId, lineId) => setPicked((now) => new Map(now).set(reportId, lineId)),
  };
}

/** A desk row's 'Assign Ledger Budget Line Item' dropdown. Blank means unassigned, and the approval stays locked. */
export function BudgetLinePicker({
  detail,
  assignments,
  disabled,
}: {
  detail: ExpenseReportDetail;
  assignments: ExpenseBudgetLineAssignments;
  disabled?: boolean;
}) {
  const { lines, fraternalYear } = assignments;
  const value = assignments.lineIdOf(detail);
  const hint =
    lines.length === 0
      ? assignments.loading
        ? 'Loading the budget…'
        : `The ${fraternalYear} budget has no approved lines yet.`
      : value === null
        ? 'Choose a line to unlock the approval.'
        : undefined;
  return (
    <Field label={ASSIGN_BUDGET_LINE_LABEL} hint={hint} className="min-w-56">
      {(id) => (
        <Select
          id={id}
          value={value === null ? '' : String(value)}
          disabled={disabled || lines.length === 0}
          required
          aria-invalid={value === null}
          onChange={(e) => assignments.choose(detail.report.id, e.target.value === '' ? null : Number(e.target.value))}
        >
          <option value="">— Select a {fraternalYear} budget line —</option>
          {lines.map((l) => (
            <option key={l.id} value={l.id}>
              {l.LineItemName} ({l.CategoryType}, {formatMoney(l.ApprovedBudgetAmount)})
            </option>
          ))}
        </Select>
      )}
    </Field>
  );
}
