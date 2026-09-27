'use client';
// Executive Summaries: one council's month at a glance from reports.monthlySummary. Four stat tiles (labor
// hours, unique Knights, net balance, outreach), the ledger figures behind the balance as a table, and the
// month's event highlights as a scrollable feed. Open to the council's Admins, Financial Secretary and Treasurer,
// and any Super Admin (who may pick the council).
import { useState, type ReactNode } from 'react';
import { type MonthlySummary } from '@kofc/shared';
import { CouncilSelect, RequireArea, useCouncilScope } from '@/components/CouncilScope';
import { cx, Empty, Field, Notice, PageTitle, Panel, Select, Table, Td } from '@/components/ui';
import { formatDecimalHours, formatFullDate, formatMoney } from '@/lib/format';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** A stat tile: sentence-case label, the value large in the body font, one line of context under it. */
function StatTile({ label, value, detail, tone = 'navy' }: { label: string; value: ReactNode; detail: ReactNode; tone?: 'navy' | 'red' }) {
  return (
    <section aria-label={label} className="flex flex-col gap-1 rounded border-2 border-navy border-t-8 border-t-gold bg-white px-4 py-3">
      <h2 className="text-sm font-bold">{label}</h2>
      <p className={cx('text-4xl font-bold leading-tight', tone === 'red' ? 'text-brand-red' : 'text-navy')}>{value}</p>
      <p className="text-xs text-muted">{detail}</p>
    </section>
  );
}

function Scorecards({ s }: { s: MonthlySummary }) {
  const deficit = s.finances.net < 0;
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <StatTile
        label="Total labor hours"
        value={formatDecimalHours(s.laborHours.total)}
        detail={`${formatDecimalHours(s.laborHours.events)} at events · ${formatDecimalHours(s.laborHours.activities)} on activities`}
      />
      <StatTile
        label="Unique Knights participating"
        value={s.uniqueMembers.toLocaleString('en-US')}
        detail="Members who logged event or activity time"
      />
      <StatTile
        label="Net balance"
        tone={deficit ? 'red' : 'navy'}
        value={formatMoney(s.finances.net)}
        detail={`${deficit ? 'Deficit' : s.finances.net > 0 ? 'Surplus' : 'Break-even'}: ${formatMoney(s.finances.raised)} raised − ${formatMoney(s.finances.spend)} spent`}
      />
      <StatTile
        label="Community outreach"
        value={s.outreach.attendees.toLocaleString('en-US')}
        detail={`Attendees across ${s.outreach.events} event${s.outreach.events === 1 ? '' : 's'}`}
      />
    </div>
  );
}

function Dashboard() {
  const scope = useCouncilScope();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const summary = useLoad(() => db.reports.monthlySummary(scope.councilId, year, month), [scope.councilId, year, month]);
  const years = Array.from({ length: 7 }, (_, i) => now.getFullYear() + 1 - i);
  const s = summary.data;

  return (
    <>
      <PageTitle
        actions={
          <div className="flex items-end gap-3">
            <Field label="Month" className="w-40">
              {(id) => (
                <Select id={id} value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                  {MONTHS.map((name, i) => (
                    <option key={name} value={i + 1}>
                      {name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Year" className="w-28">
              {(id) => (
                <Select id={id} value={year} onChange={(e) => setYear(Number(e.target.value))}>
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <CouncilSelect scope={scope} />
          </div>
        }
      >
        Executive Summary: {MONTHS[month - 1]} {year}
      </PageTitle>
      {summary.error ? <Notice tone="error">{summary.error}</Notice> : null}
      {!s ? (
        <p className="text-sm text-muted">Loading the month…</p>
      ) : (
        <div className="flex flex-col gap-4">
          <Scorecards s={s} />
          <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[24rem_minmax(0,1fr)]">
            <Panel title="Financial ledger">
              <Table caption={`Ledger for ${MONTHS[month - 1]} ${year}`} head={['Line', 'Amount']}>
                <tr>
                  <Td>Cash raised</Td>
                  <Td className="text-right">{formatMoney(s.finances.cash)}</Td>
                </tr>
                <tr>
                  <Td>Electronic raised</Td>
                  <Td className="text-right">{formatMoney(s.finances.electronic)}</Td>
                </tr>
                <tr className="font-bold">
                  <Td>Total raised</Td>
                  <Td className="text-right">{formatMoney(s.finances.raised)}</Td>
                </tr>
                <tr>
                  <Td>Spend</Td>
                  <Td className="text-right">−{formatMoney(s.finances.spend)}</Td>
                </tr>
                <tr className="font-bold">
                  <Td>Net balance</Td>
                  <Td className={cx('text-right', s.finances.net < 0 && 'text-brand-red')}>{formatMoney(s.finances.net)}</Td>
                </tr>
              </Table>
              <p className="mt-2 text-xs text-muted">
                Events starting {formatFullDate(s.fromDate)} to {formatFullDate(s.toDate)}. Funds raised come from each event&apos;s ledger, which is kept
                in step with its recorded donations; physical items are not counted.
              </p>
            </Panel>
            <Panel title={`Monthly highlights (${s.highlights.length})`}>
              {s.highlights.length === 0 ? (
                <Empty>No event this month has highlights recorded. Add them in the post-event ledger.</Empty>
              ) : (
                <ol className="flex max-h-96 flex-col gap-3 overflow-y-auto pr-2" aria-label="Event highlights">
                  {s.highlights.map((h) => (
                    <li key={h.eventId} className="rounded border-l-4 border-gold bg-white px-3 py-2 ring-1 ring-line">
                      <p className="font-serif text-base font-bold">{h.eventName}</p>
                      <p className="text-xs text-muted">{formatFullDate(h.startDate)}</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm">{h.text}</p>
                    </li>
                  ))}
                </ol>
              )}
            </Panel>
          </div>
        </div>
      )}
    </>
  );
}

export default function DashboardPage() {
  return (
    <RequireArea area="dashboard">
      <Dashboard />
    </RequireArea>
  );
}
