'use client';
// Grand Knight Authorization Desk (Sprint 5Z-4): the second line of expense dual approval. The council's Grand Knight,
// its Admins and any Super Admin open it (canOpenExpenseAuthorizeDesk; the drivers: listAuthorizationQueue). It lists
// only 'Submitted' sheets that carry the Financial Secretary's written order, oldest first, with the '✍️ Countersign
// Expense' command (expenses.grandKnightAuthorizeOrder), which saves the row's budget line pick (Sprint 6G Extension),
// sets the sheet 'Approved' and releases it to the Treasurer's disbursement vault. Only the Grand Knight or a Super
// Admin counter-signs, never on their own sheet, and never the officer who issued the order (expenseCounterSignBlock;
// the drivers: GRAND_KNIGHT_REQUIRED, SELF_APPROVAL_BLOCKED, DUAL_SIGNATURE_CONFLICT). A row the viewer may not sign
// shows no picker and no button, only the reason (the Collusion Guard badge for the order's own issuer).
import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  canAuditCouncilExpenses,
  canDisburseCouncilExpenses,
  canOpenExpenseAuthorizeDesk,
  describeError,
  expenseCounterSignBlock,
  listExpenseReferences,
  sumAmounts,
  type ExpenseReferenceOptions,
  type ExpenseReportDetail,
} from '@kofc/shared';
import { CouncilSelect, RequireArea, useCouncilScope } from '@/components/CouncilScope';
import {
  BudgetLinePicker,
  EXPENSE_COUNTERSIGN_LABEL,
  ReturnToMemberForm,
  SignatureDeskTable,
  submitterName,
  useExpenseBudgetLineAssignments,
} from '@/components/ExpenseParts';
import { Button, Notice, PageTitle, Panel, Pill } from '@/components/ui';
import { formatMoney } from '@/lib/format';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

/** `next` links the confirmation to the Treasurer's disbursement vault. */
type Message = { tone: 'error' | 'info'; text: string; next?: boolean };

const NO_REFS: ExpenseReferenceOptions = { events: [], meetings: [] };

function AuthorizationDesk() {
  const user = useUser();
  const scope = useCouncilScope();
  const councilId = scope.councilId;
  const canOpen = canOpenExpenseAuthorizeDesk(user, councilId);
  const queue = useLoad(
    () => (canOpen ? db.expenses.listAuthorizationQueue(user.memberId, councilId) : Promise.resolve([])),
    [user.memberId, councilId, canOpen],
  );
  const refsLoad = useLoad(() => listExpenseReferences(db, councilId), [councilId]);
  const refs = refsLoad.data ?? NO_REFS;
  const budgetLines = useExpenseBudgetLineAssignments(councilId, refs);
  // Sheets counter-signed from this desk in this session: they stay in view, advanced, with a confirmation badge.
  const [released, setReleased] = useState<ReadonlyMap<number, ExpenseReportDetail>>(new Map());
  const [busyId, setBusyId] = useState<number | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  useEffect(() => {
    setReleased(new Map());
    setMessage(null);
  }, [councilId]);

  const pending = (queue.data ?? []).filter((d) => !released.has(d.report.id));
  const rows = [...pending, ...released.values()].sort((a, b) => a.report.id - b.report.id);
  const pendingTotal = sumAmounts(pending.map((d) => d.total));
  const mayReturn = canAuditCouncilExpenses(user, councilId);

  const counterSign = async (d: ExpenseReportDetail) => {
    setBusyId(d.report.id);
    setMessage(null);
    try {
      const signed = await db.expenses.grandKnightAuthorizeOrder(user.memberId, d.report.id, budgetLines.lineIdOf(d));
      setReleased((now) => new Map(now).set(signed.report.id, signed));
      setMessage({
        tone: 'info',
        text: `Counter-signed report #${signed.report.id} (${formatMoney(signed.total)}) for ${submitterName(signed)}. It is approved and released to the Treasurer's desk.`,
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
    if (released.has(d.report.id)) return <Pill tone="navy">✓ Released to the Treasurer</Pill>;
    const block = expenseCounterSignBlock(user, d.report);
    // Sprint 6G Extension: a row the viewer may not sign shows no signing controls at all, only why.
    if (block === 'collusion') {
      return (
        <span title="Collusion Guard: you issued the written order on this report, so another officer must counter-sign it.">
          <Pill tone="redOutline">🔒 Collusion Guard</Pill>
        </span>
      );
    }
    if (block === 'own-report') {
      return (
        <span title="For accounting controls, another officer must counter-sign your own report.">
          <Pill tone="redOutline">Your own report</Pill>
        </span>
      );
    }
    if (block === 'seat') return <Pill tone="outline">Grand Knight signs</Pill>;
    const unassigned = budgetLines.lineIdOf(d) === null;
    return (
      <span className="inline-flex flex-col items-start gap-2">
        <BudgetLinePicker detail={d} assignments={budgetLines} disabled={busyId !== null} />
        <Button
          disabled={busyId !== null || unassigned}
          className="px-5 py-2"
          aria-label={`Countersign expense report ${d.report.id}`}
          title={unassigned ? 'Assign a ledger budget line item first.' : undefined}
          onClick={() => void counterSign(d)}
        >
          {busyId === d.report.id ? 'Countersigning…' : EXPENSE_COUNTERSIGN_LABEL}
        </Button>
      </span>
    );
  };

  return (
    <>
      <PageTitle actions={<CouncilSelect scope={scope} />}>Grand Knight Authorization Desk</PageTitle>
      {!canOpen ? (
        <Notice tone="error">Only this council&apos;s Grand Knight and Admins, or a Super Admin, open its authorization desk.</Notice>
      ) : (
        <div className="flex flex-col gap-4">
          {(queue.error ?? refsLoad.error ?? budgetLines.error) ? (
            <Notice tone="error">{queue.error ?? refsLoad.error ?? budgetLines.error}</Notice>
          ) : null}
          {message ? (
            <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
              {message.text}
              {message.next && canDisburseCouncilExpenses(user, councilId) ? (
                <>
                  {' '}
                  <Link href="/expenses/disbursements" className="font-bold underline">
                    Open Bulk Check Disbursements
                  </Link>
                </>
              ) : null}
            </Notice>
          ) : null}
          <Panel title={`Ordered, awaiting counter-signature (${pending.length})`} actions={<span className="text-sm font-bold">{formatMoney(pendingTotal)} pending</span>}>
            {queue.loading && !queue.data ? (
              <p className="text-sm text-muted">Loading…</p>
            ) : (
              <SignatureDeskTable
                rows={rows}
                refs={refs}
                caption="Expense reports carrying the Financial Secretary's written order, oldest first. Open a report's receipts to review them."
                empty="No written orders are waiting for your counter-signature."
                action={action}
                drawer={(d) =>
                  mayReturn && !released.has(d.report.id) ? (
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

export default function ExpenseAuthorizePage() {
  return (
    <RequireArea area="expenses/authorize">
      <AuthorizationDesk />
    </RequireArea>
  );
}
