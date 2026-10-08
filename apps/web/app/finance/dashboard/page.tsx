'use client';
// Financial Management Center (Sprint 5Z-8): the council's general ledger at a glance for its Admins, every seated
// officer and any Super Admin (canReadGeneralLedger; the drivers: assertMayReadGeneralLedger). Three parts:
//   - Cash flow liquidity baffle gauges (buildLiquidityGauges): each bank account's cash beside what its virtual goals
//     reserve, leaving the true liquid operating cash, with every goal's progress toward its target.
//   - Balance sheet summary (finance.getLatestBalanceSheet): assets against liabilities and equity on a two-pan scale,
//     with the green '✓ Ledger Balanced (Zero Leaks)' badge when they agree to the penny.
//   - Quick-action hub: the electronic CSV bank audit (finance.uploadBankStatementReconciliation) and the asset transfer
//     drawer (finance.transferAssetFunds). Both post to the books, so they belong to the council's Financial Secretary
//     and Treasurer and any Super Admin (canPostGeneralLedger); other readers see why they are locked.
//   - Sprint 6A (Phase 5): the Membership Dues Revenue Forecast (Active and Inactive members times the council's
//     base_dues_rate, buildDuesForecast) and the Budgeted vs. Current Actual Spend grid (budget.getConcludedPerformance),
//     both high-contrast cards (DuesParts). Read-only: neither posts to the books nor changes cash on hand.
//   - Sprint 6G Extension 2: the Budget Allocation & YOY Variance Analyzer (budget.getBudgetAnalysis, BudgetAnalyzerParts)
//     for the current fraternal year, with a what-if Target Spending Ceiling for the budget's editors. Read-only too.
import Link from 'next/link';
import { useState } from 'react';
import { buildDuesForecast, buildLiquidityGauges, canManageBudgetForecast, canPostGeneralLedger, currentFraternalYear } from '@kofc/shared';
import { CouncilSelect, RequireArea, useCouncilScope } from '@/components/CouncilScope';
import { BalanceScale, BankStatementUploader, LiquidityGaugeCard, TransferDrawer } from '@/components/FinanceParts';
import { BudgetAnalyzerCard } from '@/components/BudgetAnalyzerParts';
import { ConcludedPerformanceGrid, DuesForecastCard } from '@/components/DuesParts';
import { Button, Empty, Notice, PageTitle, Panel } from '@/components/ui';
import { formatFullDate } from '@/lib/format';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

function FinanceDashboard() {
  const user = useUser();
  const scope = useCouncilScope();
  const councilId = scope.councilId;
  const chart = useLoad(() => db.finance.listChartOfAccounts(user.memberId, councilId), [user.memberId, councilId]);
  const sheet = useLoad(() => db.finance.getLatestBalanceSheet(user.memberId, councilId), [user.memberId, councilId]);
  const dues = useLoad(async () => {
    const [council, members, statuses] = await Promise.all([db.councils.get(councilId), db.members.listByCouncil(councilId), db.lookups.list('MemberStatus')]);
    return buildDuesForecast({ council, members, statuses });
  }, [councilId]);
  const concluded = useLoad(() => db.budget.getConcludedPerformance(user.memberId, councilId), [user.memberId, councilId]);
  const analysisYear = currentFraternalYear(new Date());
  const analysis = useLoad(() => db.budget.getBudgetAnalysis(user.memberId, councilId, analysisYear), [user.memberId, councilId, analysisYear]);
  const [transferring, setTransferring] = useState(false);
  const canPost = canPostGeneralLedger(user, councilId);
  const reload = async () => {
    await Promise.all([chart.reload(), sheet.reload()]);
  };
  const gauges = chart.data ? buildLiquidityGauges(chart.data) : [];

  return (
    <div className="flex flex-col gap-6">
      <PageTitle
        actions={
          <div className="flex flex-wrap items-end gap-3">
            <CouncilSelect scope={scope} />
            <Link href="/finance/ledger" className="text-sm font-bold underline">
              General ledger
            </Link>
            <Link href="/finance/balance-sheet" className="text-sm font-bold underline">
              Full balance sheet
            </Link>
          </div>
        }
      >
        Financial Management Center
      </PageTitle>
      {chart.error ? <Notice tone="error">{chart.error}</Notice> : null}
      {sheet.error ? <Notice tone="error">{sheet.error}</Notice> : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Panel title="Cash flow liquidity">
          {chart.loading && !chart.data ? (
            <p className="text-sm">Loading…</p>
          ) : gauges.length === 0 ? (
            <Empty>No bank account has virtual goals set aside inside it yet.</Empty>
          ) : (
            <div className="flex flex-col gap-8">
              {gauges.map((g) => (
                <LiquidityGaugeCard key={g.account.id} gauge={g} />
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Balance sheet summary" actions={sheet.data ? <span className="text-xs text-muted">As of {formatFullDate(sheet.data.asOf)}</span> : undefined}>
          {sheet.data ? <BalanceScale sheet={sheet.data} /> : sheet.loading ? <p className="text-sm">Loading…</p> : null}
        </Panel>
      </div>

      {dues.error ? <Notice tone="error">{dues.error}</Notice> : null}
      {concluded.error ? <Notice tone="error">{concluded.error}</Notice> : null}
      {dues.data ? <DuesForecastCard forecast={dues.data} /> : dues.loading ? <p className="text-sm">Loading…</p> : null}
      {concluded.data ? <ConcludedPerformanceGrid performance={concluded.data} /> : concluded.loading ? <p className="text-sm">Loading…</p> : null}
      {analysis.error ? <Notice tone="error">{analysis.error}</Notice> : null}
      {analysis.data ? (
        <BudgetAnalyzerCard analysis={analysis.data} canSetCeiling={canManageBudgetForecast(user, councilId)} />
      ) : analysis.loading ? (
        <p className="text-sm">Loading…</p>
      ) : null}

      <Panel
        title="Quick actions"
        actions={
          canPost && chart.data ? (
            <Button variant="primary" onClick={() => setTransferring(true)}>
              Transfer between accounts
            </Button>
          ) : undefined
        }
      >
        {!canPost ? (
          <Notice tone="info">
            Posting transfers and reconciling bank statements belongs to the council&apos;s Financial Secretary and Treasurer (and Super Admins). You can read every figure on this
            page.
          </Notice>
        ) : chart.data ? (
          <div className="flex flex-col gap-2">
            <h3 className="font-serif text-lg font-bold">Electronic bank statement audit</h3>
            <BankStatementUploader councilId={councilId} chart={chart.data} onDone={reload} />
          </div>
        ) : null}
      </Panel>

      {transferring && chart.data ? <TransferDrawer councilId={councilId} chart={chart.data} onClose={() => setTransferring(false)} onDone={reload} /> : null}
    </div>
  );
}

export default function FinanceDashboardPage() {
  return (
    <RequireArea area="finance/dashboard">
      <FinanceDashboard />
    </RequireArea>
  );
}
