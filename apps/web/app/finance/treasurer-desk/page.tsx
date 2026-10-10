'use client';
// Treasurer Ledger Audit Desk (Sprint 6Q): the middle line of expense approval, between the Financial Secretary's
// written order and the Grand Knight's counter-signature. The council's Treasurer, its Admins and any Super Admin open
// it (canOpenTreasurerDesk; the drivers: listTreasurerQueue). It lists every 'Submitted' sheet that carries the written
// order but no ledger coding, oldest first. On each row the Treasurer must choose both the budget line
// ('Assign Ledger Budget Line Item') and the general ledger account ('Assign General Ledger Account'); '🧾 Code to
// Ledger' (expenses.treasurerLedgerAudit) saves both and sends the sheet to the Grand Knight. These two dropdowns exist
// only here, so members and the other signers never see account codes. Only the Treasurer or a Super Admin codes, never
// on their own sheet and never the officer who issued its order (expenseLedgerCodeBlock; the drivers:
// TREASURER_REQUIRED, SELF_APPROVAL_BLOCKED, DUAL_SIGNATURE_CONFLICT). Admins read the desk and may return sheets.
import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  canAuditCouncilExpenses,
  canOpenExpenseAuthorizeDesk,
  canOpenTreasurerDesk,
  describeError,
  expenseLedgerAccountChoices,
  expenseLedgerCodeBlock,
  listExpenseReferences,
  sumAmounts,
  TREASURER_CODE_EXPENSE_LABEL,
  type ExpenseReferenceOptions,
  type ExpenseReportDetail,
} from '@kofc/shared';
import { CouncilSelect, RequireArea, useCouncilScope } from '@/components/CouncilScope';
import {
  BudgetLinePicker,
  LedgerAccountPicker,
  ReturnToMemberForm,
  SignatureDeskTable,
  submitterName,
  useCouncilGLAccounts,
  useExpenseBudgetLineAssignments,
} from '@/components/ExpenseParts';
import { Button, Notice, PageTitle, Panel, Pill } from '@/components/ui';
import { formatMoney } from '@/lib/format';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

/** `next` links the confirmation to the Grand Knight Authorization Desk. */
type Message = { tone: 'error' | 'info'; text: string; next?: boolean };

const NO_REFS: ExpenseReferenceOptions = { events: [], meetings: [], activities: [] };

function TreasurerDesk() {
  const user = useUser();
  const scope = useCouncilScope();
  const councilId = scope.councilId;
  const canOpen = canOpenTreasurerDesk(user, councilId);
  const queue = useLoad(() => (canOpen ? db.expenses.listTreasurerQueue(user.memberId, councilId) : Promise.resolve([])), [user.memberId, councilId, canOpen]);
  const refsLoad = useLoad(() => listExpenseReferences(db, councilId), [councilId]);
  const refs = refsLoad.data ?? NO_REFS;
  const budgetLines = useExpenseBudgetLineAssignments(councilId, refs);
  const ledger = useCouncilGLAccounts(councilId);
  // The Treasurer's account pick per sheet; a sheet starts blank when its council has more than one choice.
  const [accountPicks, setAccountPicks] = useState<ReadonlyMap<number, number | null>>(new Map());
  // Sheets coded from this desk in this session: they stay in view, advanced, with a confirmation badge.
  const [coded, setCoded] = useState<ReadonlyMap<number, ExpenseReportDetail>>(new Map());
  const [busyId, setBusyId] = useState<number | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  useEffect(() => {
    setCoded(new Map());
    setAccountPicks(new Map());
    setMessage(null);
  }, [councilId]);

  const pending = (queue.data ?? []).filter((d) => !coded.has(d.report.id));
  const rows = [...pending, ...coded.values()].sort((a, b) => a.report.id - b.report.id);
  const pendingTotal = sumAmounts(pending.map((d) => d.total));
  const mayReturn = canAuditCouncilExpenses(user, councilId);

  const accountOf = (d: ExpenseReportDetail): number | null => {
    if (accountPicks.has(d.report.id)) return accountPicks.get(d.report.id) ?? null;
    const choices = expenseLedgerAccountChoices(ledger.accounts, d.report);
    return choices.length === 1 ? choices[0].id : null;
  };

  const code = async (d: ExpenseReportDetail, budgetLineId: number, generalLedgerAccountId: number) => {
    setBusyId(d.report.id);
    setMessage(null);
    try {
      const signed = await db.expenses.treasurerLedgerAudit(user.memberId, d.report.id, { budgetLineId, generalLedgerAccountId });
      setCoded((now) => new Map(now).set(signed.report.id, signed));
      setMessage({
        tone: 'info',
        text: `Coded report #${signed.report.id} (${formatMoney(signed.total)}) for ${submitterName(signed)}. It now waits for the Grand Knight's counter-signature.`,
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
    if (coded.has(d.report.id)) return <Pill tone="navy">✓ Coded to the ledger</Pill>;
    const block = expenseLedgerCodeBlock(user, d.report);
    if (block === 'collusion') {
      return (
        <span title="Collusion Guard: you issued the written order on this report, so another officer must code it.">
          <Pill tone="redOutline">🔒 Collusion Guard</Pill>
        </span>
      );
    }
    if (block === 'own-report') {
      return (
        <span title="For accounting controls, another officer must code your own report.">
          <Pill tone="redOutline">Your own report</Pill>
        </span>
      );
    }
    if (block === 'seat') return <Pill tone="outline">Treasurer codes</Pill>;
    const lineId = budgetLines.lineIdOf(d);
    const accountId = accountOf(d);
    const ready = lineId !== null && accountId !== null;
    return (
      <span className="inline-flex flex-col items-start gap-2">
        <BudgetLinePicker detail={d} assignments={budgetLines} disabled={busyId !== null} />
        <LedgerAccountPicker
          detail={d}
          accounts={ledger.accounts}
          value={accountId}
          disabled={busyId !== null}
          onChange={(id) => setAccountPicks((now) => new Map(now).set(d.report.id, id))}
        />
        <Button
          variant="gold"
          disabled={busyId !== null || !ready}
          aria-label={`Code expense report ${d.report.id} to the ledger`}
          title={ready ? undefined : 'Choose a budget line and a ledger account first.'}
          onClick={() => (ready ? void code(d, lineId, accountId) : undefined)}
        >
          {busyId === d.report.id ? 'Locking…' : TREASURER_CODE_EXPENSE_LABEL}
        </Button>
      </span>
    );
  };

  const loadError = queue.error ?? refsLoad.error ?? budgetLines.error ?? ledger.error;

  return (
    <>
      <PageTitle actions={<CouncilSelect scope={scope} />}>Treasurer Ledger Audit Desk</PageTitle>
      {!canOpen ? (
        <Notice tone="error">Only this council&apos;s Treasurer and Admins, or a Super Admin, open its Treasurer desk.</Notice>
      ) : (
        <div className="flex flex-col gap-4">
          {loadError ? <Notice tone="error">{loadError}</Notice> : null}
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
          <Panel title={`Ordered, awaiting ledger coding (${pending.length})`} actions={<span className="text-sm font-bold">{formatMoney(pendingTotal)} pending</span>}>
            {queue.loading && !queue.data ? (
              <p className="text-sm text-muted">Loading…</p>
            ) : (
              <SignatureDeskTable
                rows={rows}
                refs={refs}
                caption="Expense reports carrying the Financial Secretary's written order, oldest first. Choose a budget line and a ledger account for each, then code it."
                empty="No written orders are waiting for ledger coding."
                action={action}
                drawer={(d) =>
                  mayReturn && !coded.has(d.report.id) ? (
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

export default function TreasurerDeskPage() {
  return (
    <RequireArea area="finance/treasurer-desk">
      <TreasurerDesk />
    </RequireArea>
  );
}
