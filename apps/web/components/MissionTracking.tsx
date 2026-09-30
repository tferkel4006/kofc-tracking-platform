'use client';
// Faith-in-Action Mission Tracking (Sprint 5Z-2): the executive dashboard's card showing the council's fraternal
// footprint for one fraternal year by mission area (reports.missionAreaFootprint) - recorded donations and volunteer
// service hours at each area's events.
//
// Dollars and hours are different scales, so they are two small-multiple bar charts, each with its own axis, never one
// dual-axis chart. Each chart is a single series, so the title names it and no legend is needed: dollars in navy,
// hours in gold with a navy edge (gold alone is under 3:1 on white, so every bar also carries its value as a direct
// label, and the table view lists every figure). Every bar is focusable and shows its tooltip on hover and focus.
import { useState } from 'react';
import type { MissionAreaFootprint, MissionAreaFootprintEntry } from '@kofc/shared';
import { Button, cx, Empty, Notice, Table, Td } from '@/components/ui';
import { formatDecimalHours, formatFullDate, formatMoney } from '@/lib/format';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

type Measure = 'donations' | 'serviceHours';

const MEASURES: Record<Measure, { title: string; format: (v: number) => string; bar: string }> = {
  donations: { title: 'Recorded donations', format: formatMoney, bar: 'border-navy bg-navy' },
  serviceHours: { title: 'Volunteer service hours', format: (v) => `${formatDecimalHours(v)} h`, bar: 'border-navy bg-gold' },
};

const share = (value: number, total: number) => (total > 0 ? `${Math.round((value / total) * 100)}% of the year` : 'nothing recorded yet');

/** One measure as horizontal bars, one row per mission area, on its own zero-based scale. */
function BarChart({ measure, rows, total }: { measure: Measure; rows: MissionAreaFootprintEntry[]; total: number }) {
  const spec = MEASURES[measure];
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(0, ...rows.map((r) => r[measure]));
  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-bold">{spec.title}</span>
        <span className="text-xs text-muted">Total {spec.format(total)}</span>
      </figcaption>
      <ul className="flex flex-col gap-0.5">
        {rows.map((row, i) => {
          const value = row[measure];
          const width = max > 0 ? Math.max((value / max) * 100, value > 0 ? 1.5 : 0) : 0;
          const tip = `${row.missionAreaName}: ${spec.format(value)} · ${share(value, total)} · ${row.events} event${row.events === 1 ? '' : 's'}`;
          return (
            <li key={row.missionAreaId ?? 'unfiled'} className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-2">
              <span className="truncate text-sm font-bold" title={row.missionAreaName}>
                {row.missionAreaName}
              </span>
              <div
                tabIndex={0}
                role="img"
                aria-label={tip}
                onPointerEnter={() => setActive(i)}
                onPointerLeave={() => setActive((a) => (a === i ? null : a))}
                onFocus={() => setActive(i)}
                onBlur={() => setActive((a) => (a === i ? null : a))}
                className="relative flex h-8 items-center gap-2 rounded py-1"
              >
                {/* The row is the hit target: bigger than the bar, so a short bar is still easy to hover. */}
                <div
                  aria-hidden="true"
                  className={cx('h-full rounded-r border-2 transition-opacity', spec.bar, active !== null && active !== i && 'opacity-60')}
                  style={{ width: `${width}%`, minWidth: value > 0 ? '4px' : '0' }}
                />
                <span aria-hidden="true" className="shrink-0 text-xs font-bold text-navy">
                  {spec.format(value)}
                </span>
                {active === i ? (
                  <span
                    role="tooltip"
                    className="pointer-events-none absolute -top-9 left-0 z-10 whitespace-nowrap rounded border-2 border-navy bg-white px-2 py-1 text-xs text-navy shadow"
                  >
                    <span className="font-bold">{spec.format(value)}</span> · {row.missionAreaName} · {share(value, total)}
                  </span>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      <div aria-hidden="true" className="ml-[7rem] flex justify-between border-t border-line pt-0.5 text-[0.65rem] text-muted">
        <span>0</span>
        <span>{spec.format(max)}</span>
      </div>
    </figure>
  );
}

/** The card: two charts side by side, a totals line and a table view of every figure. */
export function MissionTracking({ actorId, councilId, fraternalYear }: { actorId: number; councilId: number; fraternalYear: string }) {
  const footprint = useLoad(() => db.reports.missionAreaFootprint(actorId, councilId, fraternalYear), [actorId, councilId, fraternalYear]);
  const [showTable, setShowTable] = useState(false);
  const f: MissionAreaFootprint | undefined = footprint.data;
  const rows = f ? [...f.areas, ...(f.unfiled.donations > 0 || f.unfiled.serviceHours > 0 ? [f.unfiled] : [])] : [];

  return (
    <section aria-labelledby="mission-tracking-title" className="rounded border-2 border-navy border-t-8 border-t-gold bg-white">
      <header data-surface="navy" className="flex flex-wrap items-center justify-between gap-3 bg-navy px-4 py-2 text-white">
        <div>
          <h2 id="mission-tracking-title" className="font-serif text-lg font-bold">
            Faith-in-Action Mission Tracking
          </h2>
          <p className="text-xs">Fraternal year {fraternalYear} · donations and service hours at the council&apos;s events, by mission area</p>
        </div>
        {f ? (
          <Button size="sm" variant="secondary" aria-pressed={showTable} onClick={() => setShowTable((s) => !s)}>
            {showTable ? 'Show charts' : 'Show table'}
          </Button>
        ) : null}
      </header>
      <div className="flex flex-col gap-4 p-4">
        {footprint.error ? <Notice tone="error">{footprint.error}</Notice> : null}
        {!f ? (
          footprint.error ? null : <p className="text-sm text-muted">Loading the mission footprint…</p>
        ) : f.areas.length === 0 ? (
          <Empty>This council has no mission areas yet. Add them in the council lookups to file events under Faith, Family, Community and Life.</Empty>
        ) : (
          <>
            <dl className="grid grid-cols-3 gap-3">
              {[
                ['Donations', formatMoney(f.totals.donations)],
                ['Service hours', formatDecimalHours(f.totals.serviceHours)],
                ['Events', f.totals.events.toLocaleString('en-US')],
              ].map(([label, value]) => (
                <div key={label} className="rounded border border-line px-3 py-2">
                  <dt className="text-xs font-bold uppercase tracking-wide">{label}</dt>
                  <dd className="text-2xl font-bold leading-tight">{value}</dd>
                </div>
              ))}
            </dl>
            {showTable ? (
              <Table caption={`Mission footprint for ${fraternalYear}`} head={['Mission area', 'Events', 'Donations', 'Service hours']}>
                {rows.map((r) => (
                  <tr key={r.missionAreaId ?? 'unfiled'}>
                    <Td className="font-bold">{r.missionAreaName}</Td>
                    <Td className="text-right">{r.events}</Td>
                    <Td className="text-right">{formatMoney(r.donations)}</Td>
                    <Td className="text-right">{formatDecimalHours(r.serviceHours)}</Td>
                  </tr>
                ))}
                <tr className="font-bold">
                  <Td>Total</Td>
                  <Td className="text-right">{f.totals.events}</Td>
                  <Td className="text-right">{formatMoney(f.totals.donations)}</Td>
                  <Td className="text-right">{formatDecimalHours(f.totals.serviceHours)}</Td>
                </tr>
              </Table>
            ) : (
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <BarChart measure="donations" rows={rows} total={f.totals.donations} />
                <BarChart measure="serviceHours" rows={rows} total={f.totals.serviceHours} />
              </div>
            )}
            <p className="text-xs text-muted">
              {formatFullDate(f.fromDate)} to {formatFullDate(f.toDate)}. Donations are recorded donations at each area&apos;s events (physical items are not
              counted); hours are volunteer time logged on their shifts. Events filed under no mission area appear as Unfiled.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
