'use client';
// Council Balance Sheet & Equity Ledger (Sprint 6M): the council's true net worth on one high-contrast statement card
// (HighContrastCard: bold white on black inside thick hc-gold borders) over finance.getCouncilNetWorth -
//   liquid cash        every ledger cash account, the virtual goals inside a bank account rolled into it
// + equipment          ACTIVE CouncilAssetsInventory rows at cost basis
// - unpaid approvals   expense sheets the Grand Knight approved that are not yet paid
// = net worth
// Read-only. Shown on the Financial Management Center and the full balance sheet.
import type { CouncilNetWorth } from '@kofc/shared';
import { HighContrastCard } from '@/components/DuesParts';
import { cx } from '@/components/ui';
import { formatMoney } from '@/lib/format';

/** One statement row: an operator, the label and the amount, with an optional breakdown underneath. */
function StatementRow({ op, label, amount, total, children }: { op: '' | '+' | '−' | '='; label: string; amount: number; total?: boolean; children?: React.ReactNode }) {
  return (
    <div className={cx('rounded border-white p-3', total ? 'border-4 border-hc-gold' : 'border-2')}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <dt className={cx(total ? 'text-xl uppercase tracking-wide' : 'text-lg')}>
          <span aria-hidden="true" className="mr-2 inline-block w-5 text-center text-hc-gold">
            {op}
          </span>
          {label}
        </dt>
        <dd className={cx('tabular-nums', total ? 'text-4xl' : 'text-2xl', amount < 0 && 'text-hc-gold')}>{formatMoney(amount)}</dd>
      </div>
      {children ? <div className="mt-2 pl-7 text-base">{children}</div> : null}
    </div>
  );
}

export function NetWorthCard({ worth }: { worth: CouncilNetWorth }) {
  return (
    <HighContrastCard id="net-worth-title" title="🏛️ Council Balance Sheet & Equity Ledger" subtitle="Liquid cash plus equipment, less approved expenses not yet paid: the council's true net worth">
      <dl className="flex flex-col gap-3" aria-label="Net worth statement">
        <StatementRow op="" label="Liquid cash balances" amount={worth.liquidCash}>
          {worth.cashAccounts.length === 0 ? (
            <p>No cash accounts in the ledger yet.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {worth.cashAccounts.map((a) => (
                <li key={a.accountId} className="flex justify-between gap-3">
                  <span>{a.accountName}</span>
                  <span className="tabular-nums">{formatMoney(a.balance)}</span>
                </li>
              ))}
            </ul>
          )}
        </StatementRow>
        <StatementRow op="+" label="Equipment and long-term assets (at cost)" amount={worth.equipmentValue}>
          {worth.equipment.length === 0 ? (
            <p>No active items in the assets inventory.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {worth.equipment.map((a) => (
                <li key={a.assetId} className="flex justify-between gap-3">
                  <span>
                    {a.assetName} <span className="text-sm">({a.purchaseDate})</span>
                  </span>
                  <span className="tabular-nums">{formatMoney(a.costBasis)}</span>
                </li>
              ))}
            </ul>
          )}
        </StatementRow>
        <StatementRow op="−" label="Approved expense reports not yet paid" amount={worth.unpaidApprovedExpenses}>
          {worth.unpaidReports.length === 0 ? (
            <p>Every approved expense report is paid.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {worth.unpaidReports.map((r) => (
                <li key={r.reportId} className="flex justify-between gap-3">
                  <span>
                    Expense report #{r.reportId}
                    {r.approvedAt ? <span className="text-sm"> (approved {r.approvedAt.slice(0, 10)})</span> : null}
                  </span>
                  <span className="tabular-nums">{formatMoney(r.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </StatementRow>
        <StatementRow op="=" label="Council net worth" amount={worth.netWorth} total />
      </dl>
      <p className="mt-3 text-sm">
        As of {worth.asOf.slice(0, 16)} UTC. Ledger accounts for physical property are left out of cash, so equipment is counted once, from the assets inventory.
        {worth.netWorth < 0 ? ' The figure is negative: approved bills exceed cash and equipment.' : ''}
      </p>
    </HighContrastCard>
  );
}
