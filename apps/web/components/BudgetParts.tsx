'use client';
// Budget-versus-actual pieces shared by the dashboard's budget gauges and the budget page's Historical Performance
// Review (Sprint 5Y-4): the alert tag and the high-contrast progress gauge. A gauge fills navy while on track, gold from
// BUDGET_WARNING_THRESHOLD_PERCENT of its approved cap and brand-red past the cap; the warning and over-budget tags
// pulse (only where the viewer allows motion). Gold is a fill with navy text, never text on white.
import { BUDGET_WARNING_THRESHOLD_PERCENT, type BudgetAlert } from '@kofc/shared';
import { cx, Pill } from '@/components/ui';
import { formatMoney } from '@/lib/format';

/** A percentage to one decimal place, or an em dash without a cap. */
export const formatPercent = (percent: number | null): string => (percent === null ? '—' : `${percent.toLocaleString('en-US', { maximumFractionDigits: 1 })}%`);

const ALERT_LABEL: Record<BudgetAlert, string> = {
  None: 'No activity',
  'On Track': 'On track',
  Warning: `⚠ ${BUDGET_WARNING_THRESHOLD_PERCENT}%+ of cap`,
  'Over Budget': '⚠ Over budget',
  Unbudgeted: 'No approved cap',
};

/** The alert as a status tag; warnings and overruns pulse. */
export function BudgetAlertTag({ alert }: { alert: BudgetAlert }) {
  const tone = alert === 'Over Budget' ? 'red' : alert === 'Warning' ? 'gold' : alert === 'Unbudgeted' ? 'redOutline' : 'outline';
  const flashing = alert === 'Over Budget' || alert === 'Warning';
  return (
    <span className={cx('inline-block', flashing && 'motion-safe:animate-pulse')} role={flashing ? 'status' : undefined}>
      <Pill tone={tone}>{ALERT_LABEL[alert]}</Pill>
    </span>
  );
}

/** One category's spend against its approved cap: a labelled bar with the warning threshold marked. */
export function BudgetGauge({
  label,
  approved,
  actual,
  percentUsed,
  alert,
}: {
  label: string;
  approved: number;
  actual: number;
  percentUsed: number | null;
  alert: BudgetAlert;
}) {
  const fill = alert === 'Over Budget' ? 'bg-brand-red' : alert === 'Warning' ? 'bg-gold' : 'bg-navy';
  const width = percentUsed === null ? (actual > 0 ? 100 : 0) : Math.min(percentUsed, 100);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-bold">{label}</span>
        <BudgetAlertTag alert={alert} />
      </div>
      <div
        role="meter"
        aria-label={`${label}: ${formatMoney(actual)} spent of ${formatMoney(approved)} approved`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(width)}
        aria-valuetext={percentUsed === null ? `${formatMoney(actual)} spent with no approved cap` : `${formatPercent(percentUsed)} of the approved cap`}
        className="relative h-4 overflow-hidden rounded border-2 border-navy bg-white"
      >
        <div className={cx('h-full', percentUsed === null && actual > 0 ? 'bg-brand-red/40' : fill)} style={{ width: `${width}%` }} />
        <div aria-hidden="true" className="absolute inset-y-0 w-0.5 bg-brand-red" style={{ left: `${BUDGET_WARNING_THRESHOLD_PERCENT}%` }} />
      </div>
      <p className="text-xs text-muted">
        <span className={cx('font-bold', alert === 'Over Budget' ? 'text-brand-red' : 'text-navy')}>{formatMoney(actual)}</span> of {formatMoney(approved)} approved ·{' '}
        {formatPercent(percentUsed)}
      </p>
    </div>
  );
}
