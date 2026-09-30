'use client';
// Financial Secretary Audit Desk (Sprint 5Z-4): the first line of expense dual approval. The council's Financial
// Secretary, its Admins and any Super Admin open it (canOpenExpenseAuditDesk). It lists every 'Submitted' sheet still
// waiting for its written order, oldest first, with a receipt drawer and the gold '📜 Issue Written Order' command
// (expenses.financialSecretaryAuditOrder). Only the Financial Secretary or a Super Admin signs, never on their own
// sheet (expenseOrderBlock; the drivers: FINANCIAL_SECRETARY_REQUIRED, SELF_APPROVAL_BLOCKED); an Admin without the
// seat reads the desk and may return sheets. A signed row stays on the desk for the session with a confirmation badge,
// then moves to the Grand Knight Authorization Desk.
import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  awaitsWrittenOrder,
  canAuditCouncilExpenses,
  canOpenExpenseAuditDesk,
  canOpenExpenseAuthorizeDesk,
  describeError,
  expenseOrderBlock,
  listExpenseReferences,
  sumAmounts,
  type ExpenseReferenceOptions,
  type ExpenseReportDetail,
} from '@kofc/shared';
import { CouncilSelect, RequireArea, useCouncilScope } from '@/components/CouncilScope';
import { ReturnToMemberForm, SignatureDeskTable, submitterName } from '@/components/ExpenseParts';
import { Button, Notice, PageTitle, Panel, Pill } from '@/components/ui';
import { formatMoney } from '@/lib/format';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

/** `next` links the confirmation to the Grand Knight Authorization Desk. */
type Message = { tone: 'error' | 'info'; text: string; next?: boolean };

const NO_REFS: ExpenseReferenceOptions = { events: [], meetings: [] };

function AuditDesk() {
  const user = useUser();
  const scope = useCouncilScope();
  const councilId = scope.councilId;
  const canOpen = canOpenExpenseAuditDesk(user, councilId);
  const queue = useLoad(() => (canOpen ? db.expenses.listCouncilQueue(user.memberId, councilId) : Promise.resolve([])), [user.memberId, councilId, canOpen]);
  const refsLoad = useLoad(() => listExpenseReferences(db, councilId), [councilId]);
  const refs = refsLoad.data ?? NO_REFS;
  // Sheets ordered from this desk in this session: they stay in view, advanced, with a confirmation badge.
  const [ordered, setOrdered] = useState<ReadonlyMap<number, ExpenseReportDetail>>(new Map());
  const [busyId, setBusyId] = useState<number | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  useEffect(() => {
    setOrdered(new Map());
    setMessage(null);
  }, [councilId]);

  const pending = (queue.data ?? []).filter((d) => awaitsWrittenOrder(d.report) && !ordered.has(d.report.id));
  const rows = [...pending, ...ordered.values()].sort((a, b) => a.report.id - b.report.id);
  const pendingTotal = sumAmounts(pending.map((d) => d.total));
  const mayReturn = canAuditCouncilExpenses(user, councilId);

  const issue = async (d: ExpenseReportDetail) => {
    setBusyId(d.report.id);
    setMessage(null);
    try {
      const signed = await db.expenses.financialSecretaryAuditOrder(user.memberId, d.report.id);
      setOrdered((now) => new Map(now).set(signed.report.id, signed));
      setMessage({
        tone: 'info',
        text: `Written order issued on report #${signed.report.id} (${formatMoney(signed.total)}) for ${submitterName(signed)}. It now waits for the Grand Knight's counter-signature.`,
        next: true,
      });
      await queue.reload();
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setBusyId(null);
    }
  };

  const action = (d: ExpenseReportDetail) => {
    if (ordered.has(d.report.id)) return <Pill tone="navy">✓ Written order issued</Pill>;
    const block = expenseOrderBlock(user, d.report);
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        <Button
          variant="gold"
          disabled={block !== null || busyId !== null}
          aria-label={`Issue the written order for report ${d.report.id}`}
          title={
            block === 'own-report'
              ? 'For accounting controls, another officer must issue the order for your own report.'
              : block === 'seat'
                ? 'Only the Financial Secretary or a Super Admin issues written orders.'
                : undefined
          }
          onClick={() => void issue(d)}
        >
          {busyId === d.report.id ? 'Issuing…' : '📜 Issue Written Order'}
        </Button>
        {block === 'own-report' ? <Pill tone="redOutline">Your own report</Pill> : null}
        {block === 'seat' ? <Pill tone="outline">Financial Secretary signs</Pill> : null}
      </span>
    );
  };

  return (
    <>
      <PageTitle actions={<CouncilSelect scope={scope} />}>Financial Secretary Audit Desk</PageTitle>
      {!canOpen ? (
        <Notice tone="error">Only this council&apos;s Financial Secretary and Admins, or a Super Admin, open its audit desk.</Notice>
      ) : (
        <div className="flex flex-col gap-4">
          {queue.error ?? refsLoad.error ? <Notice tone="error">{queue.error ?? refsLoad.error}</Notice> : null}
          {message ? (
            <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
              {message.text}
              {message.next && canOpenExpenseAuthorizeDesk(user, councilId) ? (
                <>
                  {' '}
                  <Link href="/expenses/authorize" className="font-bold underline">
                    Open the Grand Knight Authorization Desk
                  </Link>
                </>
              ) : null}
            </Notice>
          ) : null}
          <Panel title={`Awaiting the written order (${pending.length})`} actions={<span className="text-sm font-bold">{formatMoney(pendingTotal)} pending</span>}>
            {queue.loading && !queue.data ? (
              <p className="text-sm text-muted">Loading…</p>
            ) : (
              <SignatureDeskTable
                rows={rows}
                refs={refs}
                caption="Submitted expense reports awaiting the Financial Secretary's written order, oldest first. Open a report's receipts to audit them."
                empty="No submitted expense reports are waiting for a written order."
                action={action}
                drawer={(d) =>
                  mayReturn && !ordered.has(d.report.id) ? (
                    <div className="border-t border-line pt-3">
                      <ReturnToMemberForm
                        key={d.report.id}
                        detail={d}
                        onDone={async (text) => {
                          setMessage({ tone: 'info', text });
                          await queue.reload();
                        }}
                      />
                    </div>
                  ) : null
                }
              />
            )}
          </Panel>
        </div>
      )}
    </>
  );
}

export default function ExpenseAuditPage() {
  return (
    <RequireArea area="expenses/audit">
      <AuditDesk />
    </RequireArea>
  );
}
