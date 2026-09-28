'use client';
// My Expense Reports: every signed-in member's self-service expense desk. A member drafts a sheet of receipts
// (vendor, date, amount, description and an attached receipt file), optionally naming the event or meeting it
// was spent on, saves it as a draft or submits it to the council's leadership, and follows it through Submitted,
// Approved and Reimbursed (with the check that paid it). A sheet leadership returned comes back as a draft with a
// red banner quoting their reason until it is resubmitted. The drivers show a member only their own sheets.
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
  listExpenseReferences,
  parseExpenseReferenceKey,
  toIsoDate,
  EXPENSE_DESCRIPTION_MAX_LENGTH,
  EXPENSE_VENDOR_MAX_LENGTH,
  type ExpenseLineDraft,
  type ExpenseReferenceOptions,
  type ExpenseReportDetail,
} from '@kofc/shared';
import { RequireArea } from '@/components/CouncilScope';
import { ExpenseLineItemsTable, ExpenseStatusPill, ReceiptLink } from '@/components/ExpenseParts';
import { Button, Empty, Field, Input, Notice, PageTitle, Panel, Select, Table, Td } from '@/components/ui';
import { formatFullDate, formatMoney } from '@/lib/format';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

type Message = { tone: 'error' | 'info'; text: string };
type Row = ExpenseLineDraft & { key: number };

const NO_REFS: ExpenseReferenceOptions = { events: [], meetings: [] };

// ---- the sheet editor ------------------------------------------------------------------

/** A new sheet (no `detail`) or one of the member's drafts: the reference picker and the receipt grid. */
function ExpenseSheetForm({
  detail,
  refs,
  today,
  onSaved,
  onCancel,
}: {
  detail: ExpenseReportDetail | null;
  refs: ExpenseReferenceOptions;
  today: string;
  onSaved: (saved: ExpenseReportDetail) => Promise<void>;
  onCancel: () => void;
}) {
  const user = useUser();
  const nextKey = useRef(0);
  const keyed = (line: ExpenseLineDraft): Row => ({ ...line, key: nextKey.current++ });
  const [reference, setReference] = useState(() => (detail ? expenseReferenceKey(detail.report) : ''));
  const [rows, setRows] = useState<Row[]>(() =>
    detail && detail.lineItems.length > 0 ? detail.lineItems.map((li) => keyed(expenseLineDraftFrom(li))) : [keyed(blankExpenseLine(today))],
  );
  const [busy, setBusy] = useState<'Draft' | 'Submitted' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const choices = useMemo(() => expenseReferenceChoices(refs), [refs]);

  const setCell = (key: number, field: keyof ExpenseLineDraft, value: string) =>
    setRows((now) => now.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  const attach = (key: number, file: File | undefined) => {
    // The memory driver has no file store, so a receipt is a browser blob link carrying its file name after the #.
    if (file) setCell(key, 'ReceiptPhotoURL', `${URL.createObjectURL(file)}#${encodeURIComponent(file.name)}`);
  };

  const save = async (status: 'Draft' | 'Submitted') => {
    setBusy(status);
    setError(null);
    try {
      const items = expenseLinesFromDrafts(rows);
      const saved = await db.expenses.submitReport(user.memberId, { id: detail?.report.id ?? null, Status: status, ...parseExpenseReferenceKey(reference) }, items);
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
        void save('Submitted');
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
      <Field label="Spent for" hint="The event or meeting these receipts were for, if any." className="max-w-xl">
        {(id) => (
          <Select id={id} value={reference} onChange={(e) => setReference(e.target.value)}>
            <option value="">General council expense (no event or meeting)</option>
            {(['Events', 'Meetings'] as const).map((group) => {
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
                      attach(row.key, e.target.files?.[0]);
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

      <div className="flex flex-wrap gap-2 border-t border-line pt-3">
        <Button type="submit" disabled={busy !== null}>
          {busy === 'Submitted' ? 'Submitting…' : 'Submit for approval'}
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

function ExpenseSheetView({ detail, refs }: { detail: ExpenseReportDetail; refs: ExpenseReferenceOptions }) {
  const { report, disbursement } = detail;
  const note: Record<typeof report.Status, string> = {
    Draft: '',
    Submitted: 'Waiting for your council’s leadership to review it.',
    Approved: 'Approved. The Financial Secretary or Treasurer will include it in the next check run.',
    Reimbursed: 'Paid.',
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <ExpenseStatusPill report={report} />
        <span>{expenseReferenceLabel(report, refs)}</span>
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
      {reports.error ?? refsLoad.error ? <Notice tone="error">{reports.error ?? refsLoad.error}</Notice> : null}

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
            <ExpenseSheetView detail={selected} refs={refs} />
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
