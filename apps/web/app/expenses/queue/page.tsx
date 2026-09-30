'use client';
// Leadership Auditing Queue: the council leadership's overview of submitted expense reports (an Admin, Financial
// Secretary or Treasurer of the council, or any Super Admin: canAuditCouncilExpenses). The grid lists every
// 'Submitted' sheet, oldest first, with where it stands in dual approval; choosing one expands its receipts and
// signatures with Reject & Return, which requires a reason the member sees (the drivers: assertMayAuditCouncilExpenses).
// Sprint 5Z-4 retired the single-step Approve command: a sheet is approved only by the Financial Secretary's written
// order (/expenses/audit) and the Grand Knight's counter-signature (/expenses/authorize).
import Link from 'next/link';
import { Fragment, useState } from 'react';
import {
  awaitsWrittenOrder,
  canAuditCouncilExpenses,
  canDisburseCouncilExpenses,
  canOpenExpenseAuditDesk,
  canOpenExpenseAuthorizeDesk,
  expenseReferenceLabel,
  isPayableExpenseReport,
  listExpenseReferences,
  sumAmounts,
  type ExpenseReferenceOptions,
} from '@kofc/shared';
import { CouncilSelect, RequireArea, useCouncilScope } from '@/components/CouncilScope';
import { ExpenseLineItemsTable, ExpenseStatusPill, ReturnToMemberForm, SignatureTrail, submitterName } from '@/components/ExpenseParts';
import { Empty, Notice, PageTitle, Panel, Table, Td } from '@/components/ui';
import { formatMoney } from '@/lib/format';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

type Message = { tone: 'error' | 'info'; text: string };

const NO_REFS: ExpenseReferenceOptions = { events: [], meetings: [] };

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
  const awaitingPayment = all.filter((d) => isPayableExpenseReport(d.report));
  const pendingTotal = sumAmounts(pending.map((d) => d.total));

  const desk = (awaitingOrder: boolean) => {
    const href = awaitingOrder ? '/expenses/audit' : '/expenses/authorize';
    const label = awaitingOrder ? 'Awaiting written order' : 'Awaiting counter-signature';
    const reachable = awaitingOrder ? canOpenExpenseAuditDesk(user, councilId) : canOpenExpenseAuthorizeDesk(user, councilId);
    return reachable ? (
      <Link href={href} className="font-bold underline">
        {label}
      </Link>
    ) : (
      label
    );
  };

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
          <Notice tone="info">
            Expense reports are approved by two signatures: the Financial Secretary&apos;s written order, then the Grand Knight&apos;s counter-signature.
            This queue tracks them and returns reports to their members.
          </Notice>
          {awaitingPayment.length > 0 ? (
            <Notice tone="info">
              {awaitingPayment.length} dual-signed report{awaitingPayment.length === 1 ? ' is' : 's are'} waiting for a check
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
              <Table
                caption="Submitted expense reports, oldest first. Choose one to review its receipts and signatures."
                head={['', 'Report', 'Submitted by', 'Spent for', 'Receipts', 'Total', 'Status', 'Signatures']}
              >
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
                        <Td className="text-sm">
                          {/* The desk link opens its desk, not this row's receipts. */}
                          <span onClick={(e) => e.stopPropagation()}>{desk(awaitsWrittenOrder(d.report))}</span>
                        </Td>
                      </tr>
                      {open ? (
                        <tr>
                          <Td colSpan={8} className="border-l-8 border-l-gold bg-white">
                            <div id={`audit-${d.report.id}`} className="flex flex-col gap-3 py-2">
                              <ExpenseLineItemsTable items={d.lineItems} total={d.total} caption={`Receipts on expense report ${d.report.id}`} />
                              <SignatureTrail detail={d} />
                              <div className="border-t border-line pt-3">
                                <ReturnToMemberForm
                                  key={d.report.id}
                                  detail={d}
                                  onDone={async (text) => {
                                    setMessage({ tone: 'info', text });
                                    setOpenId(null);
                                    await queue.reload();
                                  }}
                                />
                              </div>
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
