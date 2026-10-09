'use client';
// Bulk Check Disbursements: the checkbook of the council's Financial Secretary and Treasurer, or a Super Admin
// (canDisburseCouncilExpenses; council Admins without a finance role audit the queue but do not pay it). Every
// 'Approved' expense sheet is listed with a checkbox; the officer ticks the sheets one check pays, enters the check
// number and payout date, and "Issue Disbursement Check" records it with expenses.recordDisbursement, which stamps
// every ticked sheet 'Reimbursed' in one transaction. Nobody may tick their own sheet, whatever their role
// (canPayExpenseReport; the drivers: FINANCE_OFFICER_REQUIRED and SELF_PAYOUT_BLOCKED).
// Sprint 5Z-4 vault filter: only sheets carrying both the Financial Secretary's written order and the Grand Knight's
// counter-signature are listed (isPayableExpenseReport); anything else is hidden, and the drivers refuse to pay it
// (assertDualSigned, EXPENSE_STATUS_CONFLICT).
import { Fragment, useEffect, useState } from 'react';
import {
  canDisburseCouncilExpenses,
  canPayExpenseReport,
  CHECK_NUMBER_MAX_LENGTH,
  describeError,
  DISBURSEMENT_NOTES_MAX_LENGTH,
  expenseReferenceLabel,
  isPayableExpenseReport,
  listExpenseReferences,
  sumAmounts,
  toIsoDate,
  type ExpenseDisbursementResult,
  type ExpenseReferenceOptions,
  type ExpenseReportDetail,
} from '@kofc/shared';
import { CouncilSelect, RequireArea, useCouncilScope } from '@/components/CouncilScope';
import { ExpenseLineItemsTable, SignatureTrail, submitterName } from '@/components/ExpenseParts';
import { Button, Empty, Field, Input, Notice, PageTitle, Panel, Pill, Table, Td, Textarea } from '@/components/ui';
import { formatFullDate, formatMoney } from '@/lib/format';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

const NO_REFS: ExpenseReferenceOptions = { events: [], meetings: [], activities: [] };

/** The check just issued: its number, date, total and the sheets it paid. */
function IssuedCheck({ result, onDismiss }: { result: ExpenseDisbursementResult; onDismiss: () => void }) {
  const { disbursement, reports } = result;
  return (
    <section aria-label="Disbursement check issued" className="rounded border-2 border-navy border-l-8 border-l-gold bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide">Disbursement check issued</p>
          <p className="font-serif text-xl font-bold">
            Check {disbursement.CheckNumber} · {formatMoney(disbursement.TotalAmount)}
          </p>
          <p className="text-sm">
            Dated {formatFullDate(disbursement.PayoutDate)} · pays {reports.length} report{reports.length === 1 ? '' : 's'}, now Reimbursed
            {disbursement.Notes ? ` · ${disbursement.Notes}` : ''}
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
      <ul className="mt-2 text-sm">
        {reports.map((d) => (
          <li key={d.report.id}>
            #{d.report.id} · {submitterName(d)} · {formatMoney(d.total)}
          </li>
        ))}
      </ul>
    </section>
  );
}

function DisbursementLedger() {
  const user = useUser();
  const scope = useCouncilScope();
  const councilId = scope.councilId;
  const today = toIsoDate(new Date());
  const canDisburse = canDisburseCouncilExpenses(user, councilId);
  const queue = useLoad(() => (canDisburse ? db.expenses.listCouncilQueue(user.memberId, councilId) : Promise.resolve([])), [user.memberId, councilId, canDisburse]);
  const refsLoad = useLoad(() => listExpenseReferences(db, councilId), [councilId]);
  const refs = refsLoad.data ?? NO_REFS;
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [expanded, setExpanded] = useState<number | null>(null);
  const [checkNumber, setCheckNumber] = useState('');
  const [payoutDate, setPayoutDate] = useState(today);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<ExpenseDisbursementResult | null>(null);
  useEffect(() => {
    setSelected(new Set());
    setIssued(null);
  }, [councilId]);

  // The vault: 'Approved' and dual-signed only. A sheet missing either signature never reaches the checkbook.
  const approved = (queue.data ?? []).filter((d) => isPayableExpenseReport(d.report));
  const payable = approved.filter((d) => canPayExpenseReport(user, d.report));
  const chosen = approved.filter((d) => selected.has(d.report.id));
  const chosenTotal = sumAmounts(chosen.map((d) => d.total));
  const allChosen = payable.length > 0 && payable.every((d) => selected.has(d.report.id));

  const toggle = (id: number) =>
    setSelected((now) => {
      const next = new Set(now);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const issue = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await db.expenses.recordDisbursement(
        user.memberId,
        councilId,
        chosen.map((d) => d.report.id),
        { CheckNumber: checkNumber, PayoutDate: payoutDate, Notes: notes.trim() || null },
      );
      setIssued(result);
      setSelected(new Set());
      setCheckNumber('');
      setNotes('');
      await queue.reload();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  const selectAll = (
    <input
      type="checkbox"
      aria-label="Select every report you may pay"
      checked={allChosen}
      disabled={payable.length === 0}
      onChange={() => setSelected(allChosen ? new Set() : new Set(payable.map((d) => d.report.id)))}
      className="size-4"
    />
  );

  return (
    <>
      <PageTitle actions={<CouncilSelect scope={scope} />}>Bulk Check Disbursements</PageTitle>
      {!canDisburse ? (
        <Notice tone="error">Only this council&apos;s Financial Secretary or Treasurer, or a Super Admin, issues expense checks.</Notice>
      ) : (
        <div className="flex flex-col gap-4">
          {queue.error ?? refsLoad.error ? <Notice tone="error">{queue.error ?? refsLoad.error}</Notice> : null}
          {issued ? <IssuedCheck result={issued} onDismiss={() => setIssued(null)} /> : null}

          <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
            <Panel title={`Dual-signed, awaiting payment (${approved.length})`}>
              {queue.loading && !queue.data ? (
                <p className="text-sm text-muted">Loading…</p>
              ) : approved.length === 0 ? (
                <Empty>No dual-signed expense reports are waiting for a check.</Empty>
              ) : (
                <Table caption="Expense reports carrying the Financial Secretary's written order and the Grand Knight's counter-signature. Tick the reports this check pays." head={[selectAll, 'Report', 'Payee', 'Spent for', 'Receipts', 'Total', '']}>
                  {approved.map((d) => {
                    const mayPay = canPayExpenseReport(user, d.report);
                    const open = expanded === d.report.id;
                    return (
                      <Fragment key={d.report.id}>
                        <tr>
                          <Td className="w-10">
                            <input
                              type="checkbox"
                              aria-label={`Pay report ${d.report.id} for ${submitterName(d)}`}
                              checked={selected.has(d.report.id)}
                              disabled={!mayPay}
                              onChange={() => toggle(d.report.id)}
                              className="size-4"
                            />
                          </Td>
                          <Td className="font-bold">#{d.report.id}</Td>
                          <Td>
                            {submitterName(d)}
                            {!mayPay ? (
                              <span className="ml-2" title="For accounting controls, another finance officer must issue the check for your own report.">
                                <Pill tone="redOutline">Your own report</Pill>
                              </span>
                            ) : null}
                          </Td>
                          <Td>{expenseReferenceLabel(d.report, refs)}</Td>
                          <Td>{d.lineItems.length}</Td>
                          <Td className="whitespace-nowrap text-right font-bold">{formatMoney(d.total)}</Td>
                          <Td className="text-right">
                            <Button size="sm" variant="secondary" aria-expanded={open} onClick={() => setExpanded(open ? null : d.report.id)}>
                              {open ? 'Hide receipts' : 'Receipts'}
                            </Button>
                          </Td>
                        </tr>
                        {open ? (
                          <tr>
                            <Td colSpan={7} className="border-l-8 border-l-gold">
                              <div className="flex flex-col gap-3 py-2">
                                <ExpenseLineItemsTable items={d.lineItems} total={d.total} caption={`Receipts on expense report ${d.report.id}`} />
                                <SignatureTrail detail={d} />
                              </div>
                            </Td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </Table>
              )}
            </Panel>

            <Panel title="Issue a check">
              <form
                className="flex flex-col gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void issue();
                }}
              >
                {error ? (
                  <Notice tone="error" onDismiss={() => setError(null)}>
                    {error}
                  </Notice>
                ) : null}
                <div className="rounded border border-line p-3">
                  <p className="text-xs font-bold uppercase tracking-wide">Check amount</p>
                  <p className="font-serif text-2xl font-bold">{formatMoney(chosenTotal)}</p>
                  <p className="text-xs text-muted">
                    {chosen.length} report{chosen.length === 1 ? '' : 's'} selected
                  </p>
                </div>
                <Field label="Check number">
                  {(id) => <Input id={id} required maxLength={CHECK_NUMBER_MAX_LENGTH} value={checkNumber} onChange={(e) => setCheckNumber(e.target.value)} placeholder="e.g. 1042" />}
                </Field>
                <Field label="Payout date">
                  {(id) => <Input id={id} type="date" required value={payoutDate} onChange={(e) => setPayoutDate(e.target.value)} />}
                </Field>
                <Field label="Notes (optional)">
                  {(id) => <Textarea id={id} maxLength={DISBURSEMENT_NOTES_MAX_LENGTH} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. September reimbursements" />}
                </Field>
                <Button type="submit" disabled={busy || chosen.length === 0 || checkNumber.trim() === '' || payoutDate === ''}>
                  {busy ? 'Recording the check…' : 'Issue Disbursement Check'}
                </Button>
                <p className="text-xs text-muted">Every selected report is marked Reimbursed with this check, or none are if any cannot be paid.</p>
              </form>
            </Panel>
          </div>
        </div>
      )}
    </>
  );
}

export default function DisbursementsPage() {
  return (
    <RequireArea area="expenses/disbursements">
      <DisbursementLedger />
    </RequireArea>
  );
}
