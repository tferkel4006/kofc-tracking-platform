'use client';
// Membership Dues & Budget Performance Tracker (Sprint 6A, Phase 5) on the Financial Management Center. Both cards use
// the standard portal palette: navy text on white inside a navy frame, warnings in brand red (Sprint 6L Extension
// moved the high-contrast layout to the phone alone). Status is carried by words and symbols, never colour alone.
//   - DuesForecastCard: Active and Inactive members times Council.base_dues_rate (buildDuesForecast).
//   - ConcludedPerformanceGrid: budget.getConcludedPerformance - each concluded event and the year's held meetings,
//     budget against actual, with annual events' Historical Benchmark lines shown apart from every total.
//     Sprint 6C: an event's budget is its approved CouncilBudgetForecast line, never Event.Budget.
//     Sprint 6D: a line with a quantity is split, so each event shows its own block ("Occurrence 2 of 3").
import type { ReactNode } from 'react';
import type { BudgetAlert, ConcludedBudgetPerformance, ConcludedEventPerformance, DuesForecast } from '@kofc/shared';
import { formatPercent } from '@/components/BudgetParts';
import { cx } from '@/components/ui';
import { formatFullDate, formatMoney } from '@/lib/format';

const STATUS_LABEL: Record<BudgetAlert, string> = {
  None: 'No spend',
  'On Track': '✓ On track',
  Warning: '⚠ Near cap',
  'Over Budget': '✖ Over budget',
  Unbudgeted: '○ No budget set',
};

/** The navy-on-white summary card frame shared by both panels (and, since Sprint 6G Extension 2, the Budget Analyzer). */
export function SummaryCard({ id, title, subtitle, children }: { id: string; title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="rounded border-2 border-navy bg-white p-4 text-navy sm:p-6">
      <h2 id={id} className="font-serif text-2xl">
        {title}
      </h2>
      {subtitle ? <p className="mt-1 text-base text-navy">{subtitle}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function StatusTag({ alert }: { alert: BudgetAlert }) {
  const strong = alert === 'Over Budget' || alert === 'Warning';
  return (
    <span className={cx('inline-block whitespace-nowrap rounded border-2 px-2 py-0.5 text-sm uppercase tracking-wide', strong ? 'border-brand-red text-brand-red' : 'border-line text-navy')}>
      {STATUS_LABEL[alert]}
    </span>
  );
}

/** The performance-to-budget ratio in large type; brand red once spend reaches the warning threshold. */
function Ratio({ percent, alert }: { percent: number | null; alert: BudgetAlert }) {
  return <span className={cx('text-xl tabular-nums', alert === 'Over Budget' || alert === 'Warning' ? 'text-brand-red' : 'text-navy')}>{formatPercent(percent)}</span>;
}

export function DuesForecastCard({ forecast }: { forecast: DuesForecast }) {
  const rows: [string, number, number][] = [
    ['Active members', forecast.activeCount, forecast.activeIncome],
    ['Inactive members', forecast.inactiveCount, forecast.inactiveIncome],
  ];
  return (
    <SummaryCard id="dues-forecast-title" title="Membership Dues Revenue Forecast" subtitle={`${formatMoney(forecast.rate)} dues per member each year`}>
      <dl className="grid grid-cols-1 gap-3 text-lg sm:grid-cols-2">
        {rows.map(([label, count, income]) => (
          <div key={label} className="rounded border-2 border-line p-3">
            <dt className="text-base">{label}</dt>
            <dd className="text-2xl tabular-nums">
              {count} × {formatMoney(forecast.rate)} = {formatMoney(income)}
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 rounded border-4 border-gold p-4" role="status" aria-label={`Projected dues income ${formatMoney(forecast.projectedIncome)}`}>
        <p className="text-base">Projected dues income · budget line item</p>
        <p className="text-4xl tabular-nums">{formatMoney(forecast.projectedIncome)}</p>
        <p className="mt-1 text-base">
          {forecast.billableCount} billable members (Active and Inactive). Former and deceased members are not counted.
        </p>
      </div>
    </SummaryCard>
  );
}

function EventRows({ e }: { e: ConcludedEventPerformance }) {
  return (
    <>
      <tr className="border-t-2 border-line">
        <th scope="row" className="px-3 py-2 text-left">
          {e.eventName}
          <span className="block text-sm">
            Ended {formatFullDate(e.endDate)}
            {e.isAnnual ? ' · Annual' : ''}
            {e.allocation && e.allocation.quantity > 1 ? ` · Occurrence ${e.allocation.sequence} of ${e.allocation.quantity}` : ''}
            {e.budget === null ? (e.allocation ? ' · past the forecast line’s quantity' : ' · no approved forecast line') : ''}
          </span>
        </th>
        <td className="px-3 py-2 text-right tabular-nums">{formatMoney(e.budget)}</td>
        <td className="px-3 py-2 text-right tabular-nums">{formatMoney(e.actual)}</td>
        <td className="px-3 py-2 text-right">
          <Ratio percent={e.percentUsed} alert={e.alert} />
        </td>
        <td className="px-3 py-2">
          <StatusTag alert={e.alert} />
        </td>
      </tr>
      {e.isAnnual ? (
        <tr className="border-t border-dashed border-gold">
          <td colSpan={5} className="px-3 py-2 pl-8 text-base">
            <span className="mr-2 rounded border-2 border-gold px-2 py-0.5 text-sm uppercase tracking-wide text-muted">Historical Benchmark</span>
            {e.benchmark ? (
              <>
                {e.benchmark.eventName} ({formatFullDate(e.benchmark.startDate)}): budget {formatMoney(e.benchmark.budget)}, actual {formatMoney(e.benchmark.actual)},{' '}
                {formatPercent(e.benchmark.percentUsed)} of budget. Reference only; not counted in any total.
              </>
            ) : (
              'No earlier occurrence of this event is on record.'
            )}
          </td>
        </tr>
      ) : null}
    </>
  );
}

export function ConcludedPerformanceGrid({ performance }: { performance: ConcludedBudgetPerformance }) {
  const { events, meetings, totals } = performance;
  return (
    <SummaryCard
      id="concluded-performance-title"
      title="Budgeted vs. Current Actual Spend"
      subtitle={`Concluded events and meetings, fraternal year ${performance.fraternalYear} (${formatFullDate(performance.fromDate)} – ${formatFullDate(performance.throughDate)})`}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] border-collapse text-lg">
          <caption className="sr-only">Budget against actual spend for each concluded event and the council&apos;s meetings</caption>
          <thead>
            <tr className="border-b-4 border-gold text-left text-sm uppercase tracking-wide">
              <th scope="col" className="px-3 py-2">
                Event or meeting
              </th>
              <th scope="col" className="px-3 py-2 text-right">
                Budgeted
              </th>
              <th scope="col" className="px-3 py-2 text-right">
                Actual spend
              </th>
              <th scope="col" className="px-3 py-2 text-right">
                Of budget
              </th>
              <th scope="col" className="px-3 py-2">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-3 text-base">
                  No event has concluded yet this fraternal year.
                </td>
              </tr>
            ) : (
              events.map((e) => <EventRows key={e.eventId} e={e} />)
            )}
            <tr className="border-t-2 border-line">
              <th scope="row" className="px-3 py-2 text-left">
                {meetings.lineName}
                <span className="block text-sm">
                  {meetings.meetingCount} {meetings.meetingCount === 1 ? 'meeting' : 'meetings'} held
                  {meetings.budget === null ? ' · budget counts once the year is approved' : ''}
                </span>
              </th>
              <td className="px-3 py-2 text-right tabular-nums">{formatMoney(meetings.budget)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatMoney(meetings.actual)}</td>
              <td className="px-3 py-2 text-right">
                <Ratio percent={meetings.percentUsed} alert={meetings.alert} />
              </td>
              <td className="px-3 py-2">
                <StatusTag alert={meetings.alert} />
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr className="border-t-4 border-gold text-xl">
              <th scope="row" className="px-3 py-3 text-left">
                Total
              </th>
              <td className="px-3 py-3 text-right tabular-nums">{formatMoney(totals.budget)}</td>
              <td className="px-3 py-3 text-right tabular-nums">{formatMoney(totals.actual)}</td>
              <td className="px-3 py-3 text-right">
                <Ratio percent={totals.percentUsed} alert={totals.alert} />
              </td>
              <td className="px-3 py-3">
                <StatusTag alert={totals.alert} />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="mt-3 text-base">
        Actual spend is each event&apos;s recorded spend plus its approved and reimbursed expenses. Historical Benchmark lines are for comparison only: they are not part of
        the totals or of cash on hand.
      </p>
    </SummaryCard>
  );
}
