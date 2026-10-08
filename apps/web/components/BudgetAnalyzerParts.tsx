'use client';
// Budget Allocation & YOY Variance Analyzer (Sprint 6G Extension 2) on the Financial Management Center. One black
// high-contrast card (HighContrastCard: bold white on black inside thick hc-gold borders) over budget.getBudgetAnalysis:
//   - Target ceiling: the year's approved total against a 'Target Spending Ceiling ($)' with the unallocated contingency
//     buffer (buildBudgetCeilingTrack, computed live in the browser). Only the budget's editors type a ceiling
//     (canManageBudgetForecast: Admins, Financial Secretary, Treasurer, Budget Director, Super Admins). The ceiling is a
//     what-if figure: it is never stored on the server, only remembered in this browser per council and year.
//   - Category footprints: each universal_category's share of the approved total, with its change from last year.
//   - Line comparison: every line's approved cap against the previous year's line it continues.
// Direction is carried by words and symbols (▲ ▼ ●), never colour alone.
import { useEffect, useId, useState } from 'react';
import { buildBudgetCeilingTrack, type BudgetAnalysis, type BudgetCeilingTrack, type BudgetYearOverYearChange } from '@kofc/shared';
import { formatPercent } from '@/components/BudgetParts';
import { HighContrastCard } from '@/components/DuesParts';
import { cx, Input } from '@/components/ui';
import { formatMoney } from '@/lib/format';

const CHANGE_LABEL: Record<BudgetYearOverYearChange, string> = {
  Increased: '▲ Increased',
  Decreased: '▼ Decreased',
  Unchanged: '● Unchanged',
  New: '✚ New',
  Discontinued: '✖ Discontinued',
};

const CEILING_LABEL: Record<BudgetCeilingTrack['status'], string> = {
  'Within Ceiling': '✓ Within ceiling',
  'At Ceiling': '● At ceiling',
  'Over Ceiling': '✖ Over ceiling',
};

/** A signed dollar change, '+$1,200.00' or '−$300.00'. */
const formatDelta = (delta: number): string => (delta > 0 ? `+${formatMoney(delta)}` : delta < 0 ? `−${formatMoney(-delta)}` : formatMoney(0));
const formatSignedPercent = (percent: number | null): string => (percent === null ? '—' : percent > 0 ? `+${formatPercent(percent)}` : formatPercent(percent));

const storageKey = (councilId: number, year: string) => `kofc.budgetCeiling.${councilId}.${year}`;

function readStoredCeiling(councilId: number, year: string): string {
  try {
    return window.localStorage.getItem(storageKey(councilId, year)) ?? '';
  } catch {
    return '';
  }
}

function storeCeiling(councilId: number, year: string, value: string): void {
  try {
    if (value.trim() === '') window.localStorage.removeItem(storageKey(councilId, year));
    else window.localStorage.setItem(storageKey(councilId, year), value);
  } catch {
    // Storage is a convenience only; the analyzer works without it.
  }
}

/** A white bar filled in hc-gold to `percent` (capped at 100), labelled for screen readers. */
function Track({ percent, label }: { percent: number | null; label: string }) {
  const width = Math.max(0, Math.min(100, percent ?? 0));
  return (
    <div role="img" aria-label={label} className="h-4 w-full overflow-hidden rounded border-2 border-white bg-black">
      <div className="h-full bg-hc-gold" style={{ width: `${width}%` }} />
    </div>
  );
}

function ChangeTag({ change }: { change: BudgetYearOverYearChange }) {
  const strong = change === 'Increased' || change === 'Decreased';
  return (
    <span className={cx('inline-block whitespace-nowrap rounded border-2 px-2 py-0.5 text-sm uppercase tracking-wide', strong ? 'border-hc-gold text-hc-gold' : 'border-white text-white')}>
      {CHANGE_LABEL[change]}
    </span>
  );
}

function CeilingSection({ analysis, canSetCeiling }: { analysis: BudgetAnalysis; canSetCeiling: boolean }) {
  const inputId = useId();
  const hintId = useId();
  const { councilId, fraternalYear } = analysis;
  const [raw, setRaw] = useState('');
  useEffect(() => setRaw(canSetCeiling ? readStoredCeiling(councilId, fraternalYear) : ''), [councilId, fraternalYear, canSetCeiling]);

  let track: BudgetCeilingTrack | null = null;
  let error: string | null = null;
  if (raw.trim() !== '') {
    try {
      track = buildBudgetCeilingTrack(analysis.approvedTotal, Number(raw.replace(/[$,\s]/g, '')));
    } catch {
      error = 'Type an amount of 0 or more with at most two decimal places, as 45000 or 45000.00.';
    }
  }

  return (
    <div className="rounded border-2 border-white p-3">
      <h3 className="font-serif text-xl">Target ceiling</h3>
      {canSetCeiling ? (
        <div className="mt-2 flex flex-col gap-1 sm:max-w-sm">
          <label htmlFor={inputId} className="text-sm uppercase tracking-wide text-hc-gold">
            Target Spending Ceiling ($)
          </label>
          <Input
            id={inputId}
            inputMode="decimal"
            value={raw}
            placeholder="45000.00"
            aria-describedby={hintId}
            aria-invalid={error ? true : undefined}
            className="!border-2 !border-hc-gold !text-lg !font-bold"
            onChange={(e) => {
              setRaw(e.target.value);
              storeCeiling(councilId, fraternalYear, e.target.value);
            }}
          />
          <span id={hintId} className="text-sm font-normal">
            A what-if target. It is kept in this browser only and changes no budget figure.
          </span>
          {error ? (
            <span role="alert" className="text-base text-hc-gold">
              {error}
            </span>
          ) : null}
        </div>
      ) : (
        <p className="mt-2 text-base font-normal">Setting a target ceiling belongs to the council&apos;s budget officers and Super Admins.</p>
      )}
      {track ? (
        <div className="mt-3 flex flex-col gap-2" aria-live="polite">
          <dl className="grid grid-cols-1 gap-2 text-lg sm:grid-cols-3">
            <div>
              <dt className="text-sm uppercase tracking-wide text-hc-gold">Allocated</dt>
              <dd className="tabular-nums">{formatMoney(track.allocated)}</dd>
            </div>
            <div>
              <dt className="text-sm uppercase tracking-wide text-hc-gold">Ceiling</dt>
              <dd className="tabular-nums">{formatMoney(track.ceiling)}</dd>
            </div>
            <div>
              <dt className="text-sm uppercase tracking-wide text-hc-gold">{track.buffer < 0 ? 'Over the ceiling by' : 'Unallocated buffer'}</dt>
              <dd className={cx('tabular-nums', track.buffer < 0 && 'text-hc-gold')}>{formatMoney(Math.abs(track.buffer))}</dd>
            </div>
          </dl>
          <Track percent={track.percentOfCeiling} label={`${formatPercent(track.percentOfCeiling)} of the ceiling allocated`} />
          <p className="text-base">
            {formatPercent(track.percentOfCeiling)} of the ceiling allocated · <span className={cx(track.status === 'Over Ceiling' && 'text-hc-gold')}>{CEILING_LABEL[track.status]}</span>
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function BudgetAnalyzerCard({ analysis, canSetCeiling }: { analysis: BudgetAnalysis; canSetCeiling: boolean }) {
  const priorNote =
    analysis.priorStatus === null
      ? `${analysis.priorFraternalYear} has no budget lines, so every line is compared with $0.00.`
      : analysis.priorStatus !== 'Approved'
        ? `${analysis.priorFraternalYear} was never approved, so its caps count as $0.00.`
        : null;
  return (
    <HighContrastCard
      id="budget-analyzer-title"
      title="📊 Budget Allocation & YOY Variance Analyzer"
      subtitle={`Approved caps for fraternal year ${analysis.fraternalYear} against ${analysis.priorFraternalYear}`}
    >
      <div className="flex flex-col gap-6">
        {analysis.status !== 'Approved' ? (
          <p className="rounded border-2 border-hc-gold p-3 text-base">
            {analysis.fraternalYear} is {analysis.status}. Caps come from the council&apos;s approved figures, so they read $0.00 until the council votes the budget.
          </p>
        ) : null}

        <dl className="grid grid-cols-1 gap-3 text-lg sm:grid-cols-3">
          <div className="rounded border-2 border-white p-3">
            <dt className="text-sm uppercase tracking-wide text-hc-gold">{analysis.fraternalYear} approved</dt>
            <dd className="text-2xl tabular-nums">{formatMoney(analysis.approvedTotal)}</dd>
          </div>
          <div className="rounded border-2 border-white p-3">
            <dt className="text-sm uppercase tracking-wide text-hc-gold">{analysis.priorFraternalYear} approved</dt>
            <dd className="text-2xl tabular-nums">{formatMoney(analysis.priorApprovedTotal)}</dd>
          </div>
          <div className="rounded border-2 border-white p-3">
            <dt className="text-sm uppercase tracking-wide text-hc-gold">Year-over-year change</dt>
            <dd className="text-2xl tabular-nums">
              {formatDelta(analysis.totalDelta)} <span className="text-lg">({formatSignedPercent(analysis.totalVariancePercent)})</span>
            </dd>
          </div>
        </dl>
        {priorNote ? <p className="text-base font-normal">{priorNote}</p> : null}

        <CeilingSection analysis={analysis} canSetCeiling={canSetCeiling} />

        <div>
          <h3 className="font-serif text-xl">Category footprints</h3>
          {analysis.categories.length === 0 ? (
            <p className="mt-2 text-base font-normal">No budget lines in either year.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-3">
              {analysis.categories.map((c) => (
                <li key={c.key} className="rounded border-2 border-white p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2 text-lg">
                    <span>
                      {c.label} <span className="text-sm font-normal">({c.lineCount} {c.lineCount === 1 ? 'line' : 'lines'})</span>
                    </span>
                    <span className="tabular-nums">
                      {formatMoney(c.approved)} · <span className="text-hc-gold">{formatPercent(c.allocationPercent)}</span>
                    </span>
                  </div>
                  <div className="mt-2">
                    <Track percent={c.allocationPercent} label={`${c.label}: ${formatPercent(c.allocationPercent)} of the approved total`} />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-base">
                    <ChangeTag change={c.change} />
                    <span className="tabular-nums">
                      {formatDelta(c.delta)} ({formatSignedPercent(c.variancePercent)}) from {formatMoney(c.priorApproved)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h3 className="font-serif text-xl">Line comparison</h3>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[40rem] border-collapse text-lg">
              <caption className="sr-only">
                Each budget line&apos;s approved cap for {analysis.fraternalYear} against {analysis.priorFraternalYear}
              </caption>
              <thead>
                <tr className="border-b-4 border-hc-gold text-left text-sm uppercase tracking-wide">
                  <th scope="col" className="px-3 py-2">
                    Line
                  </th>
                  <th scope="col" className="px-3 py-2 text-right">
                    {analysis.priorFraternalYear}
                  </th>
                  <th scope="col" className="px-3 py-2 text-right">
                    {analysis.fraternalYear}
                  </th>
                  <th scope="col" className="px-3 py-2 text-right">
                    Change
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Trend
                  </th>
                </tr>
              </thead>
              <tbody>
                {analysis.lines.map((l) => (
                  <tr key={l.lineId ?? `prior-${l.priorLineId}`} className="border-b-2 border-white">
                    <th scope="row" className="px-3 py-2 text-left">
                      {l.LineItemName}
                      <span className="block text-sm font-normal">{analysis.categories.find((c) => c.key === l.category)?.label}</span>
                    </th>
                    <td className="px-3 py-2 text-right tabular-nums">{formatMoney(l.priorApproved)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatMoney(l.approved)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatDelta(l.delta)}
                      <span className="block text-sm">{formatSignedPercent(l.variancePercent)}</span>
                    </td>
                    <td className="px-3 py-2">
                      <ChangeTag change={l.change} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </HighContrastCard>
  );
}
