'use client';
// My Expense Reports: every signed-in member's self-service expense desk. A member drafts a sheet of receipts
// (vendor, date, amount, description and an attached receipt file), optionally naming the event or meeting it
// was spent on, saves it as a draft or submits it to the council's leadership, and follows it through Submitted,
// Approved and Reimbursed (with the check that paid it). A sheet leadership returned comes back as a draft with a
// red banner quoting their reason until it is resubmitted. The drivers show a member only their own sheets.
// Sprint 5Z-6: a sheet naming an event or meeting outside its submission window (from the day it starts through 30 days
// after it ends) shows a padlock and its submit button is disabled; it can still be saved as a draft.
// Sprint 6H: 'Link to Vetted Charity Request' names the council's vetted charitable request the receipts were spent for
// (charities.listLinkableCharitableRequests), saved as ExpenseReport.charity_request_id. The signature desks then
// pre-select that request's target budget line.
import { useMemo, useRef, useState } from 'react';
import {
  blankExpenseLine,
  describeError,
  expenseDraftTotal,
  expenseLineDraftFrom,
  expenseLinesFromDrafts,
  expenseReferenceChoices,
  expenseReferenceKey,
  expenseReferenceLabel,
  expenseReferenceSpan,
  isLongTermAssetExpense,
  expenseWindowLockMessage,
  listExpenseReferences,
  parseExpenseReferenceKey,
  toIsoDate,
  EXPENSE_DESCRIPTION_MAX_LENGTH,
  EXPENSE_VENDOR_MAX_LENGTH,
  type ExpenseLineDraft,
  type ExpenseReferenceOptions,
  type ExpenseReportDetail,
  type LinkableCharitableRequest,
} from '@kofc/shared';
import { RequireArea } from '@/components/CouncilScope';
import { ExpenseLineItemsTable, ExpenseStatusPill, ReceiptLink } from '@/components/ExpenseParts';
import { Button, Empty, Field, Input, Notice, PageTitle, Panel, Select, Table, Td } from '@/components/ui';
import { formatFullDate, formatMoney } from '@/lib/format';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';
import { archiveToDriveVault, localFileLink } from '@/services/drive-vault-transport';

type Message = { tone: 'error' | 'info'; text: string };
type Row = ExpenseLineDraft & { key: number };

const NO_REFS: ExpenseReferenceOptions = { events: [], meetings: [], activities: [] };
const NO_CHARITIES: LinkableCharitableRequest[] = [];

/** 'St. Jude Youth Ministry · $800.00 (#7)' for the charity link dropdown and the read-only sheet. */
const charityLabel = (r: Pick<LinkableCharitableRequest, 'id' | 'OrganizationName' | 'AmountRequested'>) =>
  `${r.OrganizationName} · ${formatMoney(r.AmountRequested)} (#${r.id})`;

/** The linked request's label, or its number when it is no longer open for linking. */
const linkedCharityLabel = (requestId: number, charities: readonly LinkableCharitableRequest[]) => {
  const found = charities.find((c) => c.id === requestId);
  return found ? charityLabel(found) : `Charitable request #${requestId}`;
};

// ---- the sheet editor ------------------------------------------------------------------

/** A new sheet (no `detail`) or one of the member's drafts: the reference picker and the receipt grid. */
function ExpenseSheetForm({
  detail,
  refs,
  charities,
  today,
  onSaved,
  onCancel,
}: {
  detail: ExpenseReportDetail | null;
  refs: ExpenseReferenceOptions;
  charities: readonly LinkableCharitableRequest[];
  today: string;
  onSaved: (saved: ExpenseReportDetail) => Promise<void>;
  onCancel: () => void;
}) {
  const user = useUser();
  const nextKey = useRef(0);
  const keyed = (line: ExpenseLineDraft): Row => ({ ...line, key: nextKey.current++ });
  const [reference, setReference] = useState(() => (detail ? expenseReferenceKey(detail.report) : ''));
  const [charityRequestId, setCharityRequestId] = useState(() => (detail?.report.charity_request_id != null ? String(detail.report.charity_request_id) : ''));
  const [longTermAsset, setLongTermAsset] = useState(() => isLongTermAssetExpense(detail?.report ?? {}));
  const [rows, setRows] = useState<Row[]>(() =>
    detail && detail.lineItems.length > 0 ? detail.lineItems.map((li) => keyed(expenseLineDraftFrom(li))) : [keyed(blankExpenseLine(today))],
  );
  const [busy, setBusy] = useState<'Draft' | 'Submitted' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const choices = useMemo(() => expenseReferenceChoices(refs), [refs]);
  const span = expenseReferenceSpan(reference, refs);
  const locked = span ? expenseWindowLockMessage(span, today) : null;

  const setCell = (key: number, field: keyof ExpenseLineDraft, value: string) =>
    setRows((now) => now.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  const attach = async (key: number, file: File | undefined) => {
    if (!file) return;
    // Sprint 6D: an Admin's receipt goes to the Drive vault's Vouchers folder and only its file id is kept. Otherwise
    // the memory driver has no file store, so a receipt is a browser blob link carrying its file name after the #.
    try {
      setCell(key, 'ReceiptPhotoURL', (await archiveToDriveVault(user, 'voucher', file)) ?? localFileLink(file));
    } catch (err) {
      setError(describeError(err));
    }
  };

  const save = async (status: 'Draft' | 'Submitted') => {
    setBusy(status);
    setError(null);
    try {
      const items = expenseLinesFromDrafts(rows);
      const saved = await db.expenses.submitReport(user.memberId, {
          id: detail?.report.id ?? null,
          Status: status,
          ...parseExpenseReferenceKey(reference),
          is_long_term_asset: longTermAsset,
          charity_request_id: charityRequestId ? Number(charityRequestId) : null,
        }, items);
      await onSaved(saved);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!locked) void save('Submitted');
      }}
    >
      {detail?.report.RejectionReason ? (
        <Notice tone="error">
          <span className="font-bold">Returned by council leadership:</span> <span className="whitespace-pre-wrap">{detail.report.RejectionReason}</span>
        </Notice>
      ) : null}
      {error ? (
        <Notice tone="error" onDismiss={() => setError(null)}>
          {error}
        </Notice>
      ) : null}
      <Field
        label="Spent for"
        hint="The event, meeting or ongoing activity (such as the Ultrasound Initiative) these receipts were for, if any."
        className="max-w-xl"
      >
        {(id) => (
          <Select id={id} value={reference} onChange={(e) => setReference(e.target.value)}>
            <option value="">General council expense (no event, meeting or activity)</option>
            {(['Events', 'Meetings', 'Activities'] as const).map((group) => {
              const options = choices.filter((c) => c.group === group);
              return options.length === 0 ? null : (
                <optgroup key={group} label={group}>
                  {options.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </Select>
        )}
      </Field>

      <Field
        label="Link to Vetted Charity Request"
        hint={charities.length === 0 ? 'Your council has no vetted charity requests open right now.' : 'The vetted charity request these receipts were spent for, if any.'}
        className="max-w-xl"
      >
        {(id) => (
          <Select id={id} value={charityRequestId} onChange={(e) => setCharityRequestId(e.target.value)}>
            <option value="">Not for a charity request</option>
            {charities.map((c) => (
              <option key={c.id} value={c.id}>
                {charityLabel(c)}
              </option>
            ))}
            {charityRequestId && !charities.some((c) => String(c.id) === charityRequestId) ? (
              <option value={charityRequestId}>{linkedCharityLabel(Number(charityRequestId), charities)} (no longer open)</option>
            ) : null}
          </Select>
        )}
      </Field>

      <label className="flex max-w-xl items-start gap-2 text-sm">
        <input type="checkbox" className="mt-0.5 size-4" checked={longTermAsset} onChange={(e) => setLongTermAsset(e.target.checked)} />
        <span>
          <span className="font-bold">This item is a long-term Council Asset</span>
          <span className="block text-xs text-muted">
            When the Grand Knight approves this report, the item is added to the council’s assets inventory at the report total.
          </span>
        </span>
      </label>

      <Table caption="Receipt line items" head={['#', 'Expense date', 'Vendor name', 'Description', 'Amount ($)', 'Receipt', '']}>
        {rows.map((row, i) => (
          <tr key={row.key}>
            <Td className="text-xs font-bold">{i + 1}</Td>
            <Td className="w-40">
              <Input type="date" aria-label={`Line ${i + 1} expense date`} required max={today} value={row.DateOfExpense} onChange={(e) => setCell(row.key, 'DateOfExpense', e.target.value)} />
            </Td>
            <Td className="min-w-40">
              <Input aria-label={`Line ${i + 1} vendor name`} maxLength={EXPENSE_VENDOR_MAX_LENGTH} placeholder="e.g. Costco" value={row.VendorName} onChange={(e) => setCell(row.key, 'VendorName', e.target.value)} />
            </Td>
            <Td className="min-w-56">
              <Input
                aria-label={`Line ${i + 1} description`}
                maxLength={EXPENSE_DESCRIPTION_MAX_LENGTH}
                placeholder="What was bought"
                value={row.ExpenseDescription}
                onChange={(e) => setCell(row.key, 'ExpenseDescription', e.target.value)}
              />
            </Td>
            <Td className="w-32">
              <Input aria-label={`Line ${i + 1} amount`} inputMode="decimal" placeholder="0.00" className="text-right" value={row.Amount} onChange={(e) => setCell(row.key, 'Amount', e.target.value)} />
            </Td>
            <Td className="min-w-44">
              {row.ReceiptPhotoURL ? (
                <span className="flex flex-wrap items-center gap-2">
                  <ReceiptLink url={row.ReceiptPhotoURL} />
                  <Button size="sm" variant="secondary" onClick={() => setCell(row.key, 'ReceiptPhotoURL', '')}>
                    Remove
                  </Button>
                </span>
              ) : (
                <label className="inline-block cursor-pointer rounded border-2 border-navy bg-white px-2 py-0.5 text-xs font-bold text-navy focus-within:outline-2">
                  Attach receipt…
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    aria-label={`Line ${i + 1} receipt file`}
                    className="sr-only"
                    onChange={(e) => {
                      void attach(row.key, e.target.files?.[0]);
                      e.target.value = '';
                    }}
                  />
                </label>
              )}
            </Td>
            <Td className="text-right">
              <Button size="sm" variant="secondary" aria-label={`Remove line ${i + 1}`} disabled={rows.length === 1} onClick={() => setRows((now) => now.filter((r) => r.key !== row.key))}>
                ×
              </Button>
            </Td>
          </tr>
        ))}
      </Table>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="secondary" size="sm" onClick={() => setRows((now) => [...now, keyed(blankExpenseLine(today))])}>
          + Add line item
        </Button>
        <p className="text-sm">
          <span className="text-xs font-bold uppercase tracking-wide">Report total </span>
          <span className="text-lg font-bold">{formatMoney(expenseDraftTotal(rows))}</span>
        </p>
      </div>

      {locked ? (
        <p role="status" className="flex items-center gap-2 rounded border-2 border-navy px-3 py-2 text-sm font-bold">
          <span aria-hidden="true">🔒</span>
          {locked}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2 border-t border-line pt-3">
        <Button type="submit" disabled={busy !== null || locked !== null} title={locked ?? undefined}>
          {locked ? '🔒 Submission locked' : busy === 'Submitted' ? 'Submitting…' : 'Submit for approval'}
        </Button>
        <Button variant="secondary" disabled={busy !== null} onClick={() => void save('Draft')}>
          {busy === 'Draft' ? 'Saving…' : 'Save draft'}
        </Button>
        <Button variant="secondary" disabled={busy !== null} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ---- a sheet that is no longer the member's to edit ------------------------------------

function ExpenseSheetView({ detail, refs, charities }: { detail: ExpenseReportDetail; refs: ExpenseReferenceOptions; charities: readonly LinkableCharitableRequest[] }) {
  const { report, disbursement } = detail;
  const note: Record<typeof report.Status, string> = {
    Draft: '',
    Submitted: report.FinancialSecretaryMemberID != null
      ? 'The Financial Secretary issued the written order; waiting for the Grand Knight’s counter-signature.'
      : 'Waiting for the Financial Secretary’s written order.',
    Approved: 'Approved. The Financial Secretary or Treasurer will include it in the next check run.',
    Reimbursed: 'Paid.',
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <ExpenseStatusPill report={report} />
        <span>{expenseReferenceLabel(report, refs)}</span>
        {report.charity_request_id != null ? <span className="font-bold">Charity: {linkedCharityLabel(report.charity_request_id, charities)}</span> : null}
        {isLongTermAssetExpense(report) ? <span className="text-xs font-bold uppercase tracking-wide">Long-term Council Asset</span> : null}
        <span className="text-muted">{note[report.Status]}</span>
      </div>
      {disbursement ? (
        <Notice tone="info">
          Reimbursed by check <span className="font-bold">{disbursement.CheckNumber}</span> dated {formatFullDate(disbursement.PayoutDate)}.
        </Notice>
      ) : null}
      <ExpenseLineItemsTable items={detail.lineItems} total={detail.total} caption={`Receipts on expense report ${report.id}`} />
    </div>
  );
}

// ---- the page --------------------------------------------------------------------------

function MyExpenses() {
  const user = useUser();
  const today = toIsoDate(new Date());
  const reports = useLoad(() => db.expenses.listUserReports(user.memberId), [user.memberId]);
  const refsLoad = useLoad(() => listExpenseReferences(db, user.councilId), [user.councilId]);
  const refs = refsLoad.data ?? NO_REFS;
  const charitiesLoad = useLoad(() => db.charities.listLinkableCharitableRequests(user.memberId, user.councilId), [user.memberId, user.councilId]);
  const charities = charitiesLoad.data ?? NO_CHARITIES;
  const [openId, setOpenId] = useState<number | 'new' | null>(null);
  const [message, setMessage] = useState<Message | null>(null);

  const list = reports.data ?? [];
  const returned = list.filter((d) => d.report.Status === 'Draft' && d.report.RejectionReason);
  const selected = typeof openId === 'number' ? list.find((d) => d.report.id === openId) : undefined;
  const editing = openId === 'new' || selected?.report.Status === 'Draft';
  const open = (id: number | 'new' | null) => {
    setOpenId(id);
    setMessage(null);
  };

  return (
    <>
      <PageTitle actions={<Button onClick={() => open('new')}>New expense report</Button>}>My Expense Reports</PageTitle>
      {reports.error ?? refsLoad.error ?? charitiesLoad.error ? <Notice tone="error">{reports.error ?? refsLoad.error ?? charitiesLoad.error}</Notice> : null}

      {returned.map(({ report, total }) => (
        <section key={report.id} role="alert" aria-labelledby={`returned-${report.id}`} className="mb-4 overflow-hidden rounded border-4 border-brand-red bg-white">
          <header className="flex flex-wrap items-center justify-between gap-3 bg-brand-red px-4 py-2 text-white">
            <h2 id={`returned-${report.id}`} className="font-serif text-lg font-bold">
              Expense report #{report.id} ({formatMoney(total)}) was returned for changes
            </h2>
            <Button variant="secondary" size="sm" onClick={() => open(report.id)}>
              Fix and resubmit
            </Button>
          </header>
          <div className="px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wide text-brand-red">Reason from council leadership</p>
            <p className="whitespace-pre-wrap text-base text-navy">{report.RejectionReason}</p>
          </div>
        </section>
      ))}

      {message ? (
        <div className="mb-4">
          <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
            {message.text}
          </Notice>
        </div>
      ) : null}

      <div className="flex flex-col gap-4">
        <Panel title={`My reports (${list.length})`}>
          {reports.loading && !reports.data ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : list.length === 0 ? (
            <Empty>You have not filed any expense reports. Choose “New expense report” to claim a reimbursement.</Empty>
          ) : (
            <Table caption="My expense reports, newest first" head={['Report', 'Spent for', 'Receipts', 'Total', 'Status', 'Paid by check', '']}>
              {list.map((d) => {
                const chosen = d.report.id === openId;
                return (
                  <tr key={d.report.id}>
                    <Td className="font-bold">#{d.report.id}</Td>
                    <Td>{expenseReferenceLabel(d.report, refs)}</Td>
                    <Td>{d.lineItems.length}</Td>
                    <Td className="whitespace-nowrap text-right font-bold">{formatMoney(d.total)}</Td>
                    <Td>
                      <ExpenseStatusPill report={d.report} />
                    </Td>
                    <Td className="text-xs">{d.disbursement ? `${d.disbursement.CheckNumber} · ${formatFullDate(d.disbursement.PayoutDate)}` : '–'}</Td>
                    <Td className="text-right">
                      <Button size="sm" variant={chosen ? 'primary' : 'secondary'} aria-pressed={chosen} onClick={() => open(chosen ? null : d.report.id)}>
                        {d.report.Status === 'Draft' ? 'Edit' : 'View'}
                      </Button>
                    </Td>
                  </tr>
                );
              })}
            </Table>
          )}
        </Panel>

        {editing ? (
          <Panel title={openId === 'new' ? 'New expense report' : `Edit draft #${openId}`}>
            <ExpenseSheetForm
              key={String(openId)}
              detail={selected ?? null}
              refs={refs}
              charities={charities}
              today={today}
              onCancel={() => open(null)}
              onSaved={async (saved) => {
                await reports.reload();
                setOpenId(saved.report.Status === 'Draft' ? saved.report.id : null);
                setMessage({
                  tone: 'info',
                  text:
                    saved.report.Status === 'Draft'
                      ? `Saved draft #${saved.report.id} (${formatMoney(saved.total)}). Submit it when your receipts are complete.`
                      : `Submitted report #${saved.report.id} for ${formatMoney(saved.total)} to your council’s leadership.`,
                });
              }}
            />
          </Panel>
        ) : selected ? (
          <Panel title={`Expense report #${selected.report.id}`} actions={<Button size="sm" variant="secondary" onClick={() => open(null)}>Close</Button>}>
            <ExpenseSheetView detail={selected} refs={refs} charities={charities} />
          </Panel>
        ) : null}
      </div>
    </>
  );
}

export default function ExpensesPage() {
  return (
    <RequireArea area="expenses">
      <MyExpenses />
    </RequireArea>
  );
}
