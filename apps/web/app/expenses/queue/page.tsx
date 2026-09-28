'use client';
// Leadership Auditing Queue: the council leadership's desk for submitted expense reports (an Admin, Financial
// Secretary or Treasurer of the council, or any Super Admin: canAuditCouncilExpenses). The grid lists every
// 'Submitted' sheet, oldest first; choosing one expands its receipts with two commands: Approve (a confirm step;
// never on the officer's own sheet, whatever their role) and Reject & Return, which requires a reason the member
// sees. The drivers enforce the same rules (assertMayAuditCouncilExpenses, SELF_APPROVAL_BLOCKED).
import Link from 'next/link';
import { Fragment, useState } from 'react';
import {
  canApproveExpenseReport,
  canAuditCouncilExpenses,
  canDisburseCouncilExpenses,
  describeError,
  expenseReferenceLabel,
  listExpenseReferences,
  REJECTION_REASON_MAX_LENGTH,
  type ExpenseReferenceOptions,
  type ExpenseReportDetail,
} from '@kofc/shared';
import { CouncilSelect, RequireArea, useCouncilScope } from '@/components/CouncilScope';
import { ExpenseLineItemsTable, ExpenseStatusPill } from '@/components/ExpenseParts';
import { Button, Empty, Field, Notice, PageTitle, Panel, Table, Td, Textarea } from '@/components/ui';
import { formatMoney, formatPersonName } from '@/lib/format';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

type Message = { tone: 'error' | 'info'; text: string };

const NO_REFS: ExpenseReferenceOptions = { events: [], meetings: [] };
const submitterName = (d: ExpenseReportDetail) => formatPersonName(d.submitterFirstName, d.submitterLastName) || `Member ${d.report.SubmitterMemberID}`;

/** Approve and Reject & Return for one sheet. Rendered only for the council's leadership. */
function AuditActions({ detail, onDone }: { detail: ExpenseReportDetail; onDone: (message: Message) => Promise<void> }) {
  const user = useUser();
  const [mode, setMode] = useState<'idle' | 'approve' | 'reject'>('idle');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { report } = detail;
  const who = submitterName(detail);
  const mayApprove = canApproveExpenseReport(user, report);

  const run = async (action: () => Promise<unknown>, done: string) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      await onDone({ tone: 'info', text: done });
    } catch (err) {
      setError(describeError(err));
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 border-t border-line pt-3">
      {error ? (
        <Notice tone="error" onDismiss={() => setError(null)}>
          {error}
        </Notice>
      ) : null}
      {mode === 'idle' ? (
        <div className="flex flex-wrap items-center gap-2">
          {mayApprove ? (
            <Button onClick={() => setMode('approve')}>Approve</Button>
          ) : (
            <Notice tone="info">This is your own expense report. For accounting controls, another officer must approve it.</Notice>
          )}
          <Button variant="danger" onClick={() => setMode('reject')}>
            Reject &amp; Return
          </Button>
        </div>
      ) : mode === 'approve' ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-bold">
            Approve {formatMoney(detail.total)} for {who}? It moves to the check disbursement ledger.
          </p>
          <Button disabled={busy} onClick={() => void run(() => db.expenses.approveReport(user.memberId, report.id), `Approved report #${report.id} (${formatMoney(detail.total)}) for ${who}.`)}>
            {busy ? 'Approving…' : 'Confirm approval'}
          </Button>
          <Button variant="secondary" disabled={busy} onClick={() => setMode('idle')}>
            Cancel
          </Button>
        </div>
      ) : (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void run(() => db.expenses.rejectReport(user.memberId, report.id, reason), `Returned report #${report.id} to ${who} with your reason.`);
          }}
        >
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
            <Button variant="secondary" disabled={busy} onClick={() => setMode('idle')}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

function AuditQueue() {
  const user = useUser();
  const scope = useCouncilScope();
  const councilId = scope.councilId;
  const canAudit = canAuditCouncilExpenses(user, councilId);
  const queue = useLoad(() => (canAudit ? db.expenses.listCouncilQueue(user.memberId, councilId) : Promise.resolve([])), [user.memberId, councilId, canAudit]);
  const refsLoad = useLoad(() => listExpenseReferences(db, councilId), [councilId]);
  const refs = refsLoad.data ?? NO_REFS;
  const [openId, setOpenId] = useState<number | null>(null);
  const [message, setMessage] = useState<Message | null>(null);

  const all = queue.data ?? [];
  const pending = all.filter((d) => d.report.Status === 'Submitted');
  const awaitingPayment = all.filter((d) => d.report.Status === 'Approved');
  const pendingTotal = pending.reduce((cents, d) => cents + Math.round(d.total * 100), 0) / 100;

  return (
    <>
      <PageTitle actions={<CouncilSelect scope={scope} />}>Leadership Auditing Queue</PageTitle>
      {!canAudit ? (
        <Notice tone="error">Only this council&apos;s Admins, Financial Secretary and Treasurer, or a Super Admin, review its expense reports.</Notice>
      ) : (
        <div className="flex flex-col gap-4">
          {queue.error ?? refsLoad.error ? <Notice tone="error">{queue.error ?? refsLoad.error}</Notice> : null}
          {message ? (
            <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
              {message.text}
            </Notice>
          ) : null}
          {awaitingPayment.length > 0 ? (
            <Notice tone="info">
              {awaitingPayment.length} approved report{awaitingPayment.length === 1 ? ' is' : 's are'} waiting for a check
              {canDisburseCouncilExpenses(user, councilId) ? (
                <>
                  .{' '}
                  <Link href="/expenses/disbursements" className="font-bold underline">
                    Open Bulk Check Disbursements
                  </Link>
                </>
              ) : (
                ' from the Financial Secretary or Treasurer.'
              )}
            </Notice>
          ) : null}
          <Panel title={`Submitted for review (${pending.length})`} actions={<span className="text-sm font-bold">{formatMoney(pendingTotal)} pending</span>}>
            {queue.loading && !queue.data ? (
              <p className="text-sm text-muted">Loading…</p>
            ) : pending.length === 0 ? (
              <Empty>No expense reports are waiting for review.</Empty>
            ) : (
              <Table caption="Submitted expense reports, oldest first. Choose one to review its receipts." head={['', 'Report', 'Submitted by', 'Spent for', 'Receipts', 'Total', 'Status']}>
                {pending.map((d) => {
                  const open = d.report.id === openId;
                  return (
                    <Fragment key={d.report.id}>
                      <tr className="cursor-pointer hover:underline" onClick={() => setOpenId(open ? null : d.report.id)}>
                        <Td className="w-10">
                          <button
                            type="button"
                            aria-expanded={open}
                            aria-controls={`audit-${d.report.id}`}
                            aria-label={`${open ? 'Hide' : 'Show'} receipts on report ${d.report.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenId(open ? null : d.report.id);
                            }}
                            className="font-bold"
                          >
                            {open ? '▾' : '▸'}
                          </button>
                        </Td>
                        <Td className="font-bold">#{d.report.id}</Td>
                        <Td>{submitterName(d)}</Td>
                        <Td>{expenseReferenceLabel(d.report, refs)}</Td>
                        <Td>{d.lineItems.length}</Td>
                        <Td className="whitespace-nowrap text-right font-bold">{formatMoney(d.total)}</Td>
                        <Td>
                          <ExpenseStatusPill report={d.report} />
                        </Td>
                      </tr>
                      {open ? (
                        <tr>
                          <Td colSpan={7} className="border-l-8 border-l-gold bg-white">
                            <div id={`audit-${d.report.id}`} className="flex flex-col gap-3 py-2">
                              <ExpenseLineItemsTable items={d.lineItems} total={d.total} caption={`Receipts on expense report ${d.report.id}`} />
                              <AuditActions
                                key={d.report.id}
                                detail={d}
                                onDone={async (m) => {
                                  setMessage(m);
                                  setOpenId(null);
                                  await queue.reload();
                                }}
                              />
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
        </div>
      )}
    </>
  );
}

export default function ExpenseQueuePage() {
  return (
    <RequireArea area="expenses/queue">
      <AuditQueue />
    </RequireArea>
  );
}
