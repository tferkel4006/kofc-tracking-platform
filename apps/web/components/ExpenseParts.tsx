'use client';
// Pieces shared by the expense screens (My Expense Reports, the audit queue, the two dual-approval desks and check
// disbursements): the status chip, the receipt link, the read-only receipt grid, the signature trail, the return form
// and the signature desk grid (Sprint 5Z-4), and the Treasurer Ledger Audit Desk's budget line and ledger account
// pickers (Sprint 6G; the Treasurer's alone since Sprint 6Q).
import { Fragment, useState, type ReactNode } from 'react';
import {
  assignableExpenseBudgetLines,
  currentFraternalYear,
  defaultExpenseBudgetLineId,
  describeError,
  expenseReferenceLabel,
  expenseStatusBadge,
  HONOR_VOUCHER_BADGE,
  REJECTION_REASON_MAX_LENGTH,
  type CouncilBudgetForecast,
  type ChartOfAccountsNode,
  type ExpenseLineItem,
  type ExpenseReceipts,
  type GLAccount,
  expenseLedgerAccountChoices,
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

export function ExpenseStatusPill({ report }: { report: Pick<ExpenseReport, 'Status' | 'RejectionReason' | 'FinancialSecretaryMemberID' | 'TreasurerMemberID'> }) {
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

/**
 * The Honor Voucher badge (Sprint 6S): high contrast, on any sheet flagged as having no receipt or carrying none at
 * all. With `reason` it also quotes the member's explanation.
 */
export function HonorVoucherBadge({ detail, withReason = false }: { detail: Pick<ExpenseReportDetail, 'honorVoucher' | 'report'>; withReason?: boolean }) {
  if (!detail.honorVoucher) return null;
  const reason = detail.report.missing_receipt_reason;
  return (
    <span className="inline-flex flex-col gap-1">
      <span role="status" className="inline-block rounded border-2 border-memorial bg-gold px-2 py-0.5 text-xs font-black uppercase tracking-wide text-memorial">
        {HONOR_VOUCHER_BADGE}
      </span>
      {withReason ? (
        <span className="text-sm">
          <span className="font-bold">Member’s reason:</span> {reason ? <span className="whitespace-pre-wrap">{reason}</span> : <span className="text-muted">None given; the sheet carries no receipt file.</span>}
        </span>
      ) : null}
    </span>
  );
}

/** A sheet's receipts (Sprint 6S): merchant, gross total and file. */
export function ExpenseReceiptsTable({ receipts, caption }: { receipts: readonly ExpenseReceipts[]; caption: string }) {
  if (receipts.length === 0) return null;
  return (
    <Table caption={caption} head={['#', 'Merchant', 'Receipt file', 'Gross total']}>
      {receipts.map((r, i) => (
        <tr key={r.id}>
          <Td className="text-xs font-bold">R{i + 1}</Td>
          <Td className="font-bold">{r.merchant_name}</Td>
          <Td>
            <ReceiptLink url={r.receipt_file_url} />
          </Td>
          <Td className="whitespace-nowrap text-right">{formatMoney(r.gross_total)}</Td>
        </tr>
      ))}
    </Table>
  );
}

/**
 * A sheet's line items, oldest first as the driver returns them, with the total the council pays. Sprint 6S: a line
 * itemised from a receipt names it (R1, R2…), and personal exclusions are struck through and left out of the total.
 */
export function ExpenseLineItemsTable({
  items,
  total,
  caption,
  receipts = [],
  personalTotal = 0,
}: {
  items: readonly ExpenseLineItem[];
  total: number;
  caption: string;
  receipts?: readonly ExpenseReceipts[];
  personalTotal?: number;
}) {
  const receiptLabel = (id: number | null | undefined) => {
    const i = id == null ? -1 : receipts.findIndex((r) => r.id === id);
    return i < 0 ? null : `R${i + 1}`;
  };
  return (
    <Table caption={caption} head={['Date', 'Vendor', 'Description', 'Receipt', 'Amount']}>
      {items.map((li) => {
        const personal = Boolean(li.is_personal_exclusion);
        const fromReceipt = receiptLabel(li.receipt_id);
        return (
          <tr key={li.id}>
            <Td className="whitespace-nowrap">{formatFullDate(li.DateOfExpense)}</Td>
            <Td className="font-bold">{li.VendorName}</Td>
            <Td>
              {li.ExpenseDescription}
              {personal ? <span className="ml-2 rounded border border-navy px-1 text-xs font-bold uppercase">Personal, not reimbursed</span> : null}
            </Td>
            <Td>{li.ReceiptPhotoURL ? <ReceiptLink url={li.ReceiptPhotoURL} /> : fromReceipt ? <span className="font-bold">{fromReceipt}</span> : <ReceiptLink url={null} />}</Td>
            <Td className={`whitespace-nowrap text-right ${personal ? 'text-muted line-through' : ''}`}>{formatMoney(li.Amount)}</Td>
          </tr>
        );
      })}
      {personalTotal > 0 ? (
        <tr>
          <Td colSpan={4} className="text-right text-xs font-bold uppercase tracking-wide">
            Personal exclusions (paid by the member)
          </Td>
          <Td className="whitespace-nowrap text-right text-muted">{formatMoney(personalTotal)}</Td>
        </tr>
      ) : null}
      <tr>
        <Td colSpan={4} className="text-right text-xs font-bold uppercase tracking-wide">
          {personalTotal > 0 ? 'Council reimburses' : 'Total'}
        </Td>
        <Td className="whitespace-nowrap text-right font-bold">{formatMoney(total)}</Td>
      </tr>
    </Table>
  );
}

/** The receipts and line items of one sheet, as every expense screen shows them (Sprint 6S). */
export function ExpenseSheetItems({ detail }: { detail: ExpenseReportDetail }) {
  const id = detail.report.id;
  return (
    <>
      <ExpenseReceiptsTable receipts={detail.receipts} caption={`Receipts on expense report ${id}`} />
      <ExpenseLineItemsTable
        items={detail.lineItems}
        total={detail.total}
        receipts={detail.receipts}
        personalTotal={detail.personalTotal}
        caption={`Line items on expense report ${id}`}
      />
    </>
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

/**
 * The signatures on a sheet: the written order (Sprint 5Z-3), the Treasurer's ledger coding (Sprint 6Q), then the
 * counter-signature.
 */
export function SignatureTrail({ detail }: { detail: ExpenseReportDetail }) {
  const { report } = detail;
  return (
    <dl className="grid grid-cols-1 gap-2 sm:grid-cols-3" aria-label={`Signatures on expense report ${report.id}`}>
      <SignatureLine
        label="📜 Written order · Financial Secretary"
        memberId={report.FinancialSecretaryMemberID}
        name={detail.financialSecretaryName}
        at={report.FinancialSecretaryApprovedAt}
      />
      <SignatureLine label="🧾 Ledger coding · Treasurer" memberId={report.TreasurerMemberID} name={detail.treasurerName} at={report.TreasurerReviewedAt} />
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
              <Td className="font-bold">
                <span className="flex flex-col items-start gap-1">
                  #{d.report.id}
                  <HonorVoucherBadge detail={d} />
                </span>
              </Td>
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
                    <HonorVoucherBadge detail={d} withReason />
                    <ExpenseSheetItems detail={d} />
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

/** The Treasurer desk row's 'Assign Ledger Budget Line Item' dropdown. Blank means unassigned, and coding stays locked. */
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
        ? 'Choose a line to unlock the coding.'
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

// ---- 'Assign General Ledger Account' (Sprint 6Q) --------------------------------------------------

export const ASSIGN_LEDGER_ACCOUNT_LABEL = 'Assign General Ledger Account';

/** Every account of the chart, parents before children (finance.listChartOfAccounts flattened). */
export function flattenChart(nodes: readonly ChartOfAccountsNode[]): GLAccount[] {
  return nodes.flatMap((n) => [n.account, ...flattenChart(n.children)]);
}

/** The council's general ledger accounts, for the Treasurer's pickers and the coding note. */
export function useCouncilGLAccounts(councilId: number): { accounts: GLAccount[]; loading: boolean; error: string | null } {
  const user = useUser();
  const chart = useLoad(() => db.finance.listChartOfAccounts(user.memberId, councilId), [user.memberId, councilId]);
  return { accounts: flattenChart(chart.data?.accounts ?? []), loading: chart.loading && !chart.data, error: chart.error };
}

/**
 * A Treasurer desk row's 'Assign General Ledger Account' dropdown: the council's Expense accounts (and its physical
 * property account for a long-term asset sheet). Blank keeps the coding locked.
 */
export function LedgerAccountPicker({
  detail,
  accounts,
  value,
  onChange,
  disabled,
}: {
  detail: ExpenseReportDetail;
  accounts: readonly GLAccount[];
  value: number | null;
  onChange: (accountId: number | null) => void;
  disabled?: boolean;
}) {
  const choices = expenseLedgerAccountChoices(accounts, detail.report);
  return (
    <Field label={ASSIGN_LEDGER_ACCOUNT_LABEL} hint={choices.length === 0 ? 'The chart of accounts has no expense accounts.' : undefined} className="min-w-56">
      {(id) => (
        <Select
          id={id}
          value={value === null ? '' : String(value)}
          disabled={disabled || choices.length === 0}
          required
          aria-invalid={value === null}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        >
          <option value="">— Select a ledger account —</option>
          {choices.map((a) => (
            <option key={a.id} value={a.id}>
              {a.AccountName}
            </option>
          ))}
        </Select>
      )}
    </Field>
  );
}

/** The Treasurer's coding on a sheet, as the Grand Knight reads it: 'Charged to <line> · <account>'. */
export function LedgerCodingNote({
  detail,
  lines,
  accounts,
}: {
  detail: ExpenseReportDetail;
  lines: readonly CouncilBudgetForecast[];
  accounts: readonly GLAccount[];
}) {
  const { budget_line_id: lineId, general_ledger_account_id: accountId } = detail.report;
  if (lineId == null && accountId == null) return null;
  const line = lines.find((l) => l.id === lineId);
  const account = accounts.find((a) => a.id === accountId);
  return (
    <p className="text-sm">
      <span className="font-bold">Charged to:</span> {line?.LineItemName ?? (lineId == null ? 'no budget line' : `budget line #${lineId}`)} ·{' '}
      {account?.AccountName ?? (accountId == null ? 'no ledger account' : `account #${accountId}`)}
    </p>
  );
}
