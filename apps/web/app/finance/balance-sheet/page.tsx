'use client';
// Balance Sheet (Sprint 5Z-8): the council's full statement of position from finance.getLatestBalanceSheet. Every asset
// account (bank accounts with their virtual goals nested under them, savings and physical property), every liability,
// every equity account (Opening Balance Equity among them), and the surplus split into prior years and the fraternal
// year to date, totalled in whole cents with the balanced-ledger badge. Figures are navy on white (brand-red when below
// zero), totals bold over a navy rule, so every number keeps at least 7:1 contrast. Same readers as the Financial
// Management Center (canReadGeneralLedger).
import Link from 'next/link';
import type { ReactNode } from 'react';
import type { BalanceSheet, BalanceSheetLine } from '@kofc/shared';
import { CouncilSelect, RequireArea, useCouncilScope } from '@/components/CouncilScope';
import { LedgerBalanceBadge, Money } from '@/components/FinanceParts';
import { Notice, PageTitle, Pill } from '@/components/ui';
import { formatFullDate } from '@/lib/format';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

function Row({ label, value, indent = 0, tag, strong = false }: { label: ReactNode; value: number; indent?: number; tag?: ReactNode; strong?: boolean }) {
  return (
    <tr className={strong ? 'border-t-2 border-navy font-bold' : 'border-t border-line'}>
      <th scope="row" className="px-3 py-1.5 text-left font-normal" style={{ paddingLeft: `${0.75 + indent * 1.5}rem` }}>
        <span className={strong ? 'font-bold' : undefined}>{label}</span> {tag}
      </th>
      <td className="px-3 py-1.5 text-right">
        <Money value={value} className={strong ? 'font-bold' : undefined} />
      </td>
    </tr>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <tr>
        <th colSpan={2} scope="colgroup" className="bg-navy px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-white">
          {title}
        </th>
      </tr>
      {children}
    </>
  );
}

/** Asset lines with each virtual goal under its parent account. */
function assetRows(lines: BalanceSheetLine[]): { line: BalanceSheetLine; depth: number }[] {
  const ids = new Set(lines.map((l) => l.accountId));
  const out: { line: BalanceSheetLine; depth: number }[] = [];
  const add = (line: BalanceSheetLine, depth: number) => {
    out.push({ line, depth });
    for (const child of lines.filter((l) => l.parentAccountId === line.accountId)) add(child, depth + 1);
  };
  for (const line of lines.filter((l) => l.parentAccountId === null || !ids.has(l.parentAccountId))) add(line, 0);
  return out;
}

function Statement({ sheet }: { sheet: BalanceSheet }) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <table className="w-full border-collapse rounded border-2 border-navy bg-white text-sm text-navy">
        <caption className="pb-2 text-left font-serif text-xl font-bold">Assets</caption>
        <tbody>
          <Section title="Asset accounts">
            {assetRows(sheet.assets.lines).map(({ line, depth }) => (
              <Row
                key={line.accountId}
                label={line.accountName}
                value={line.balance}
                indent={depth}
                tag={line.isVirtualGoal ? <Pill tone="gold">Virtual goal</Pill> : undefined}
              />
            ))}
          </Section>
          <Row label="Total assets" value={sheet.totalAssets} strong />
        </tbody>
      </table>

      <table className="w-full border-collapse rounded border-2 border-navy bg-white text-sm text-navy">
        <caption className="pb-2 text-left font-serif text-xl font-bold">Liabilities &amp; Equity</caption>
        <tbody>
          <Section title="Liabilities">
            {sheet.liabilities.lines.length ? (
              sheet.liabilities.lines.map((l) => <Row key={l.accountId} label={l.accountName} value={l.balance} />)
            ) : (
              <Row label="No liability accounts" value={0} />
            )}
            <Row label="Total liabilities" value={sheet.totalLiabilities} strong />
          </Section>
          <Section title="Equity">
            {sheet.equity.lines.map((l) => (
              <Row key={l.accountId} label={l.accountName} value={l.balance} />
            ))}
            <Row label="Surplus from prior fraternal years" value={sheet.priorYearsSurplus} />
            <Row label={`Year-to-date surplus (${sheet.fraternalYear})`} value={sheet.yearToDateSurplus} />
            <Row label="Total equity" value={sheet.totalEquity} strong />
          </Section>
          <Row label="Total liabilities & equity" value={sheet.totalLiabilitiesAndEquity} strong />
        </tbody>
      </table>
    </div>
  );
}

function BalanceSheetView() {
  const user = useUser();
  const scope = useCouncilScope();
  const sheet = useLoad(() => db.finance.getLatestBalanceSheet(user.memberId, scope.councilId), [user.memberId, scope.councilId]);
  const s = sheet.data;
  return (
    <div className="flex flex-col gap-6">
      <PageTitle
        actions={
          <div className="flex flex-wrap items-end gap-3">
            <CouncilSelect scope={scope} />
            <Link href="/finance/ledger" className="text-sm font-bold underline">
              General ledger
            </Link>
          </div>
        }
      >
        Balance Sheet
      </PageTitle>
      {sheet.error ? <Notice tone="error">{sheet.error}</Notice> : null}
      {s ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">
              As of {formatFullDate(s.asOf)} · {s.entryCount} journal line{s.entryCount === 1 ? '' : 's'}
            </p>
            <LedgerBalanceBadge sheet={s} />
          </div>
          <Statement sheet={s} />
          <section aria-label="Income behind the surplus" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              ['Revenue', s.revenue.total],
              ['Expenses', s.expenses.total],
              ['Net surplus', s.netSurplus],
            ].map(([label, value]) => (
              <div key={label as string} className="rounded border-2 border-navy border-t-8 border-t-gold bg-white px-4 py-3">
                <h2 className="text-sm font-bold">{label}</h2>
                <p className="text-3xl font-bold">
                  <Money value={value as number} />
                </p>
              </div>
            ))}
          </section>
        </>
      ) : sheet.loading ? (
        <p className="text-sm">Loading…</p>
      ) : null}
    </div>
  );
}

export default function BalanceSheetPage() {
  return (
    <RequireArea area="finance/balance-sheet">
      <BalanceSheetView />
    </RequireArea>
  );
}
