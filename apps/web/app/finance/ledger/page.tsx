'use client';
// General Ledger Spreadsheet (Sprint 5Z-8): the council's chart of accounts (finance.listChartOfAccounts) as one table
// per account type - Assets, Liabilities, Equity, Revenue, Expenses - with each account's posted debits, credits and
// normal-side balance, virtual goals indented under their bank account. Every account name opens the drill-down drawer
// (finance.getAccountLedger): every line ever posted to it with its date, description, check number, linked event and
// running balance, and each line's whole multi-line posting. Same readers as the Financial Management Center
// (canReadGeneralLedger).
import Link from 'next/link';
import { useState } from 'react';
import { GL_ACCOUNT_TYPE_LABELS, GL_ACCOUNT_TYPES, type GLAccount, type GLAccountType } from '@kofc/shared';
import { CouncilSelect, RequireArea, useCouncilScope } from '@/components/CouncilScope';
import { AccountLedgerDrawer, flattenChart, Money } from '@/components/FinanceParts';
import { Empty, Notice, PageTitle, Pill, Table, Td } from '@/components/ui';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

const NORMAL_SIDE: Record<GLAccountType, string> = {
  Asset: 'debit',
  Liability: 'credit',
  Equity: 'credit',
  Revenue: 'credit',
  Expense: 'debit',
};

function LedgerSpreadsheet() {
  const user = useUser();
  const scope = useCouncilScope();
  const chart = useLoad(() => db.finance.listChartOfAccounts(user.memberId, scope.councilId), [user.memberId, scope.councilId]);
  const [drill, setDrill] = useState<GLAccount | null>(null);
  const nodes = flattenChart(chart.data);

  return (
    <div className="flex flex-col gap-6">
      <PageTitle
        actions={
          <div className="flex flex-wrap items-end gap-3">
            <CouncilSelect scope={scope} />
            <Link href="/finance/dashboard" className="text-sm font-bold underline">
              Financial Management Center
            </Link>
          </div>
        }
      >
        General Ledger Spreadsheet
      </PageTitle>
      {chart.error ? <Notice tone="error">{chart.error}</Notice> : null}
      {chart.loading && !chart.data ? <p className="text-sm">Loading…</p> : null}
      {chart.data && nodes.length === 0 ? <Empty>This council has no chart of accounts yet.</Empty> : null}

      {chart.data
        ? GL_ACCOUNT_TYPES.map((type) => {
            const rows = nodes.filter((n) => n.account.AccountType === type);
            if (!rows.length) return null;
            // A group's total counts top-level accounts' rolled-up balances, so nested goals are not counted twice.
            const total = rows.filter((n) => n.depth === 0).reduce((sum, n) => sum + Math.round(n.rolledUpBalance * 100), 0) / 100;
            return (
              <section key={type} aria-labelledby={`ledger-${type}`} className="flex flex-col gap-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2 border-b-4 border-gold pb-1">
                  <h2 id={`ledger-${type}`} className="font-serif text-xl font-bold">
                    {GL_ACCOUNT_TYPE_LABELS[type]}
                  </h2>
                  <p className="text-sm">
                    Normal {NORMAL_SIDE[type]} balance · total <Money value={total} className="font-bold" />
                  </p>
                </div>
                <Table caption={`${GL_ACCOUNT_TYPE_LABELS[type]} accounts`} head={['Account', 'Debits', 'Credits', 'Balance', 'With sub-accounts']}>
                  {rows.map((n) => (
                    <tr key={n.account.id}>
                      <Td>
                        <span style={{ paddingLeft: `${n.depth * 1.5}rem` }} className="inline-flex flex-wrap items-center gap-2">
                          {n.depth > 0 ? <span aria-hidden="true">↳</span> : null}
                          <button
                            type="button"
                            onClick={() => setDrill(n.account)}
                            className="text-left font-bold underline"
                            aria-label={`Open the ${n.account.AccountName} ledger`}
                          >
                            {n.account.AccountName}
                          </button>
                          {n.account.IsVirtualGoal === 1 ? <Pill tone="gold">Virtual goal</Pill> : null}
                        </span>
                      </Td>
                      <Td className="text-right">
                        <Money value={n.debitTotal} />
                      </Td>
                      <Td className="text-right">
                        <Money value={n.creditTotal} />
                      </Td>
                      <Td className="text-right font-bold">
                        <Money value={n.balance} />
                      </Td>
                      <Td className="text-right">{n.children.length ? <Money value={n.rolledUpBalance} /> : '–'}</Td>
                    </tr>
                  ))}
                </Table>
              </section>
            );
          })
        : null}

      {drill ? <AccountLedgerDrawer account={drill} onClose={() => setDrill(null)} /> : null}
    </div>
  );
}

export default function LedgerSpreadsheetPage() {
  return (
    <RequireArea area="finance/ledger">
      <LedgerSpreadsheet />
    </RequireArea>
  );
}
