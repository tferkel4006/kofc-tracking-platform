'use client';
// Growth & Hours Charts (Sprint 6Z): the trailing twelve months of the member's council.
//   - Membership growth velocity: active members who joined each month (Member.DateJoinedCouncil, membershipGrowth),
//     with the dated roster size at the end of the window as a stat tile.
//   - Council hours: each month's total labor hours, events and activities together (reports.monthlySummary).
// Each chart is one series in navy (no legend; the title names it), with a hover tooltip on every bar, the latest
// month labelled, and a table view. Two measures, two charts - never one chart with two scales.
// The executive dashboard's audience reads it (portalAreas 'performance/charts').
import { useState } from 'react';
import { membershipGrowth, monthLabel, trailingMonths, type MonthKey } from '@kofc/shared';
import { RequireArea } from '@/components/CouncilScope';
import { Notice, PageTitle, Panel, Table, Td } from '@/components/ui';
import { formatDecimalHours } from '@/lib/format';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

const MONTHS = 12;
const W = 720;
const H = 260;
const PAD = { top: 24, right: 12, bottom: 32, left: 44 };

/** Round numbers for the y axis: 0 to a tidy maximum in four steps. */
function ticks(max: number): number[] {
  if (max <= 0) return [0, 1];
  const raw = max / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  return Array.from({ length: Math.ceil(max / step) + 1 }, (_, i) => i * step);
}

/** A bar with 4px rounded data-end, anchored square to the baseline. */
function barPath(x: number, y: number, w: number, h: number): string {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}

function BarChart({ title, months, values, format }: { title: string; months: MonthKey[]; values: number[]; format: (v: number) => string }) {
  const [hover, setHover] = useState<number | null>(null);
  const axis = ticks(Math.max(...values, 0));
  const top = axis[axis.length - 1];
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const slot = plotW / months.length;
  const barW = Math.max(4, slot - 2 - slot * 0.3);
  const y = (v: number) => PAD.top + plotH - (v / top) * plotH;
  const last = values.length - 1;
  return (
    <figure className="relative flex flex-col gap-2">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}, bar chart of the last ${months.length} months`} className="w-full">
        {axis.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--color-line)" strokeWidth={t === 0 ? 2 : 1} />
            <text x={PAD.left - 6} y={y(t)} textAnchor="end" dominantBaseline="middle" fontSize="11" fill="var(--color-muted)">
              {format(t)}
            </text>
          </g>
        ))}
        {values.map((v, i) => {
          const x = PAD.left + i * slot + (slot - barW) / 2;
          const h = Math.max(0, y(0) - y(v));
          return (
            <g key={i}>
              {h > 0 ? <path d={barPath(x, y(v), barW, h)} fill="var(--color-navy)" opacity={hover === null || hover === i ? 1 : 0.55} /> : null}
              <text x={x + barW / 2} y={H - PAD.bottom + 16} textAnchor="middle" fontSize="11" fill="var(--color-muted)">
                {monthLabel(months[i]).slice(0, 3)}
              </text>
              {i === last ? (
                <text x={x + barW / 2} y={y(v) - 6} textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--color-navy)">
                  {format(v)}
                </text>
              ) : null}
              {/* Hit target: the whole column, taller and wider than the bar. */}
              <rect
                x={PAD.left + i * slot}
                y={PAD.top}
                width={slot}
                height={plotH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              >
                <title>{`${monthLabel(months[i])}: ${format(v)}`}</title>
              </rect>
            </g>
          );
        })}
      </svg>
      {hover !== null ? (
        <div
          role="status"
          className="pointer-events-none absolute rounded border-2 border-navy bg-white px-2 py-1 text-sm shadow"
          style={{ left: `${((PAD.left + hover * slot + slot / 2) / W) * 100}%`, top: 0, transform: 'translateX(-50%)' }}
        >
          <span className="font-bold">{monthLabel(months[hover])}</span> · {format(values[hover])}
        </div>
      ) : null}
      <details className="text-sm">
        <summary className="cursor-pointer font-bold">Show as a table</summary>
        <Table head={['Month', title]} caption={title}>
          {months.map((m, i) => (
            <tr key={i}>
              <Td>{monthLabel(m)}</Td>
              <Td>{format(values[i])}</Td>
            </tr>
          ))}
        </Table>
      </details>
    </figure>
  );
}

function Tile({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <section aria-label={label} className="flex flex-col gap-1 rounded border-2 border-navy border-t-8 border-t-gold bg-white px-4 py-3">
      <h2 className="text-sm font-bold">{label}</h2>
      <p className="text-4xl font-bold leading-tight text-navy">{value}</p>
      <p className="text-xs text-muted">{detail}</p>
    </section>
  );
}

function PerformanceCharts() {
  const user = useUser();
  const now = new Date();
  const months = trailingMonths({ year: now.getFullYear(), month: now.getMonth() + 1 }, MONTHS);
  const key = `${months[months.length - 1].year}-${months[months.length - 1].month}`;
  const growth = useLoad(async () => membershipGrowth(await db.members.listByCouncil(user.councilId, { activeOnly: true }), months), [user.councilId, key]);
  const hours = useLoad(
    () => Promise.all(months.map((m) => db.reports.monthlySummary(user.councilId, m.year, m.month).then((s) => s.laborHours.total))),
    [user.councilId, key],
  );
  const g = growth.data;
  const joined = g ? g.points.reduce((sum, p) => sum + p.joined, 0) : 0;
  const totalHours = hours.data ? hours.data.reduce((sum, h) => sum + h, 0) : 0;
  const span = `${monthLabel(months[0])} – ${monthLabel(months[months.length - 1])}`;

  return (
    <>
      <PageTitle>Growth &amp; Hours Charts</PageTitle>
      <div className="flex flex-col gap-4">
        {growth.error ? <Notice tone="error">{growth.error}</Notice> : null}
        {hours.error ? <Notice tone="error">{hours.error}</Notice> : null}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Tile label="New members" value={g ? String(joined) : '–'} detail={span} />
          <Tile label="Dated roster" value={g ? String(g.points[g.points.length - 1].rosterSize) : '–'} detail="Active members with a join date" />
          <Tile label="Council hours" value={hours.data ? formatDecimalHours(totalHours) : '–'} detail={span} />
        </div>
        <Panel title="Membership growth velocity: new members per month">
          {g ? (
            <>
              <BarChart title="New members" months={months} values={g.points.map((p) => p.joined)} format={(v) => String(v)} />
              {g.undated > 0 ? (
                <p className="mt-2 text-xs text-muted">
                  {g.undated} active members have no join date on the roster and are not counted. Supreme Excel Sync fills in join dates.
                </p>
              ) : null}
            </>
          ) : null}
        </Panel>
        <Panel title="Council hours per month">
          {hours.data ? <BarChart title="Labor hours" months={months} values={hours.data} format={formatDecimalHours} /> : null}
        </Panel>
      </div>
    </>
  );
}

export default function PerformanceChartsPage() {
  return (
    <RequireArea area="performance/charts">
      <PerformanceCharts />
    </RequireArea>
  );
}
