'use client';
// Budget Allocation & YOY Variance Analyzer (Sprint 6G Extension 2) on the Financial Management Center. One
// summary card (SummaryCard: navy on white inside a navy frame) over budget.getBudgetAnalysis:
//   - Target ceiling: the year's approved total against a 'Target Spending Ceiling ($)' with the unallocated contingency
//     buffer (buildBudgetCeilingTrack). Only the budget's editors type a ceiling (canManageBudgetForecast: Admins,
//     Financial Secretary, Treasurer, Budget Director, Super Admins). Sprint 6M: the ceiling is saved with the year's
//     budget (budget.setTargetSpendingCeiling, CouncilBudgetForecast.target_spending_ceiling), no longer in one
//     browser's storage; what the editor types is previewed live until saved.
//   - Category footprints: each universal_category's share of the approved total, with its change from last year.
//   - Line comparison: every line's approved cap against the previous year's line it continues.
// Direction is carried by words and symbols (▲ ▼ ●), never colour alone.
import { useEffect, useId, useState } from 'react';
import { buildBudgetCeilingTrack, describeError, type BudgetAnalysis, type BudgetCeilingTrack, type BudgetYearOverYearChange } from '@kofc/shared';
import { formatPercent } from '@/components/BudgetParts';
import { SummaryCard } from '@/components/DuesParts';
import { Button, cx, Input } from '@/components/ui';
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

/** A white bar filled in gold to `percent` (capped at 100), labelled for screen readers. */
function Track({ percent, label }: { percent: number | null; label: string }) {
  const width = Math.max(0, Math.min(100, percent ?? 0));
  return (
    <div role="img" aria-label={label} className="h-4 w-full overflow-hidden rounded border-2 border-line bg-white">
      <div className="h-full bg-gold" style={{ width: `${width}%` }} />
    </div>
  );
}

function ChangeTag({ change }: { change: BudgetYearOverYearChange }) {
  const strong = change === 'Increased' || change === 'Decreased';
  return (
    <span className={cx('inline-block whitespace-nowrap rounded border-2 px-2 py-0.5 text-sm uppercase tracking-wide', strong ? 'border-brand-red text-brand-red' : 'border-line text-navy')}>
      {CHANGE_LABEL[change]}
    </span>
  );
}

function CeilingSection({
  analysis,
  canSetCeiling,
  onSaveCeiling,
}: {
  analysis: BudgetAnalysis;
  canSetCeiling: boolean;
  onSaveCeiling?: (ceiling: number | null) => Promise<void>;
}) {
  const inputId = useId();
  const hintId = useId();
  const { councilId, fraternalYear, storedTargetSpendingCeiling: saved } = analysis;
  const savedText = saved === null ? '' : saved.toFixed(2);
  const [raw, setRaw] = useState(savedText);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);
  useEffect(() => setRaw(savedText), [councilId, fraternalYear, savedText]);

  // The saved ceiling's track, or a live preview of what the editor is typing.
  let track: BudgetCeilingTrack | null = null;
  let error: string | null = null;
  let typed: number | null = null;
  if (raw.trim() !== '') {
    try {
      typed = Number(raw.replace(/[$,\s]/g, ''));
      track = buildBudgetCeilingTrack(analysis.approvedTotal, typed);
    } catch {
      typed = null;
      error = 'Type an amount of 0 or more with at most two decimal places, as 45000 or 45000.00.';
    }
  }
  const dirty = raw.trim() === '' ? saved !== null : typed !== null && typed !== saved;
  const hasLines = analysis.lines.some((l) => l.lineId !== null);

  async function save(value: number | null) {
    if (!onSaveCeiling) return;
    setSaving(true);
    setMessage(null);
    try {
      await onSaveCeiling(value);
      setMessage({ tone: 'info', text: value === null ? `The ${fraternalYear} target ceiling is cleared.` : `Saved ${formatMoney(value)} as the ${fraternalYear} target ceiling.` });
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded border-2 border-line p-3">
      <h3 className="font-serif text-xl">Target ceiling</h3>
      <p className="mt-1 text-base">
        Saved target for {fraternalYear}: <span className="tabular-nums">{saved === null ? 'none yet' : formatMoney(saved)}</span>
      </p>
      {canSetCeiling && onSaveCeiling ? (
        <div className="mt-2 flex flex-col gap-1 sm:max-w-md">
          <label htmlFor={inputId} className="text-sm uppercase tracking-wide text-muted">
            Target Spending Ceiling ($)
          </label>
          <Input
            id={inputId}
            inputMode="decimal"
            value={raw}
            placeholder="45000.00"
            aria-describedby={hintId}
            aria-invalid={error ? true : undefined}
            className="!border-2 !border-gold !text-lg !font-bold"
            onChange={(e) => setRaw(e.target.value)}
          />
          <span id={hintId} className="text-sm font-normal">
            {hasLines
              ? "Saved with the council's budget for this year, so every officer sees the same target. It changes no budget figure."
              : "Add or pre-populate this year's budget lines first; the target is saved with them."}
          </span>
          {error ? (
            <span role="alert" className="text-base text-navy">
              {error}
            </span>
          ) : null}
          <div className="mt-1 flex flex-wrap gap-2">
            <Button variant="gold" disabled={saving || !dirty || !!error || !hasLines} onClick={() => void save(raw.trim() === '' ? null : typed)}>
              {saving ? 'Saving…' : raw.trim() === '' ? 'Clear saved target' : 'Save target ceiling'}
            </Button>
            {saved !== null && raw.trim() !== '' ? (
              <Button variant="secondary" disabled={saving} onClick={() => void save(null)}>
                Clear
              </Button>
            ) : null}
          </div>
          {message ? (
            <span role={message.tone === 'error' ? 'alert' : 'status'} className={cx('text-base', message.tone === 'error' && 'text-brand-red')}>
              {message.text}
            </span>
          ) : null}
        </div>
      ) : (
        <p className="mt-2 text-base font-normal">Setting a target ceiling belongs to the council&apos;s budget officers and Super Admins.</p>
      )}
      {track ? (
        <div className="mt-3 flex flex-col gap-2" aria-live="polite">
          {dirty ? <p className="text-sm uppercase tracking-wide text-muted">Preview: not saved yet</p> : null}
          <dl className="grid grid-cols-1 gap-2 text-lg sm:grid-cols-3">
            <div>
              <dt className="text-sm uppercase tracking-wide text-muted">Allocated</dt>
              <dd className="tabular-nums">{formatMoney(track.allocated)}</dd>
            </div>
            <div>
              <dt className="text-sm uppercase tracking-wide text-muted">Ceiling</dt>
              <dd className="tabular-nums">{formatMoney(track.ceiling)}</dd>
            </div>
            <div>
              <dt className="text-sm uppercase tracking-wide text-muted">{track.buffer < 0 ? 'Over the ceiling by' : 'Unallocated buffer'}</dt>
              <dd className={cx('tabular-nums', track.buffer < 0 && 'text-brand-red')}>{formatMoney(Math.abs(track.buffer))}</dd>
            </div>
          </dl>
          <Track percent={track.percentOfCeiling} label={`${formatPercent(track.percentOfCeiling)} of the ceiling allocated`} />
          <p className="text-base">
            {formatPercent(track.percentOfCeiling)} of the ceiling allocated · <span className={cx(track.status === 'Over Ceiling' && 'text-brand-red')}>{CEILING_LABEL[track.status]}</span>
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function BudgetAnalyzerCard({
  analysis,
  canSetCeiling,
  onSaveCeiling,
}: {
  analysis: BudgetAnalysis;
  canSetCeiling: boolean;
  /** Saves (or with null clears) the year's Target Spending Ceiling (budget.setTargetSpendingCeiling) and reloads. */
  onSaveCeiling?: (ceiling: number | null) => Promise<void>;
}) {
  const priorNote =
    analysis.priorStatus === null
      ? `${analysis.priorFraternalYear} has no budget lines, so every line is compared with $0.00.`
      : analysis.priorStatus !== 'Approved'
        ? `${analysis.priorFraternalYear} was never approved, so its caps count as $0.00.`
        : null;
  return (
    <SummaryCard
      id="budget-analyzer-title"
      title="📊 Budget Allocation & YOY Variance Analyzer"
      subtitle={`Approved caps for fraternal year ${analysis.fraternalYear} against ${analysis.priorFraternalYear}`}
    >
      <div className="flex flex-col gap-6">
        {analysis.status !== 'Approved' ? (
          <p className="rounded border-2 border-gold p-3 text-base">
            {analysis.fraternalYear} is {analysis.status}. Caps come from the council&apos;s approved figures, so they read $0.00 until the council votes the budget.
          </p>
        ) : null}

        <dl className="grid grid-cols-1 gap-3 text-lg sm:grid-cols-3">
          <div className="rounded border-2 border-line p-3">
            <dt className="text-sm uppercase tracking-wide text-muted">{analysis.fraternalYear} approved</dt>
            <dd className="text-2xl tabular-nums">{formatMoney(analysis.approvedTotal)}</dd>
          </div>
          <div className="rounded border-2 border-line p-3">
            <dt className="text-sm uppercase tracking-wide text-muted">{analysis.priorFraternalYear} approved</dt>
            <dd className="text-2xl tabular-nums">{formatMoney(analysis.priorApprovedTotal)}</dd>
          </div>
          <div className="rounded border-2 border-line p-3">
            <dt className="text-sm uppercase tracking-wide text-muted">Year-over-year change</dt>
            <dd className="text-2xl tabular-nums">
              {formatDelta(analysis.totalDelta)} <span className="text-lg">({formatSignedPercent(analysis.totalVariancePercent)})</span>
            </dd>
          </div>
        </dl>
        {priorNote ? <p className="text-base font-normal">{priorNote}</p> : null}

        <CeilingSection analysis={analysis} canSetCeiling={canSetCeiling} onSaveCeiling={onSaveCeiling} />

        <div>
          <h3 className="font-serif text-xl">Category footprints</h3>
          {analysis.categories.length === 0 ? (
            <p className="mt-2 text-base font-normal">No budget lines in either year.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-3">
              {analysis.categories.map((c) => (
                <li key={c.key} className="rounded border-2 border-line p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2 text-lg">
                    <span>
                      {c.label} <span className="text-sm font-normal">({c.lineCount} {c.lineCount === 1 ? 'line' : 'lines'})</span>
                    </span>
                    <span className="tabular-nums">
                      {formatMoney(c.approved)} · <span className="text-navy">{formatPercent(c.allocationPercent)}</span>
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
                <tr className="border-b-4 border-gold text-left text-sm uppercase tracking-wide">
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
                  <tr key={l.lineId ?? `prior-${l.priorLineId}`} className="border-b-2 border-line">
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
    </SummaryCard>
  );
}
