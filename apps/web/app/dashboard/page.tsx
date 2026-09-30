'use client';
// Executive Summaries: one council's month at a glance from reports.monthlySummary. Four stat tiles (labor
// hours, unique Knights, net balance, outreach), the ledger figures behind the balance as a table, and the
// month's event highlights as a scrollable feed. Open to the council's Admins, Financial Secretary and Treasurer,
// its Grand Knight and Deputy Grand Knight (Sprint 5Z-2.5), and any Super Admin (who may pick the council).
//
// Under the month, the council's Admins, Grand Knight, Deputy Grand Knight and Super Admins (canViewExecutiveAudits) also
// get two personnel audits:
// every no-show of the trailing NO_SHOW_AUDIT_MONTHS (reports.listNoShowsAudit, with or without a reason), and every
// past signup still waiting for hours (reports.listShiftsAwaitingHours), flagged once the day-5 reminder is due.
//
// Beside the scorecards (Sprint 5Y-4), the same readers (canReviewBudgetPerformance) get budget tracking gauges for the
// fraternal year of the chosen month (budget.getBudgetProgress): each budget category's actual spend so far - events,
// approved and reimbursed expenses, and charity checks - against its ApprovedBudgetAmount cap, flagged from 85%.
//
// Above them (Sprint 5Z-2) the same readers get the Faith-in-Action Mission Tracking card (reports.missionAreaFootprint):
// the fraternal year's donations and volunteer service hours by mission area (Faith, Family, Community, Life).
import { useState, type ReactNode } from 'react';
import {
  BUDGET_WARNING_THRESHOLD_PERCENT,
  canReviewBudgetPerformance,
  canViewExecutiveAudits,
  currentFraternalYear,
  formatShiftWhen,
  HOURS_REMINDER_FIRST_DAY,
  hoursRemindersDue,
  NO_SHOW_AUDIT_MONTHS,
  SHIFT_HISTORY_MONTHS,
  type MonthlySummary,
} from '@kofc/shared';
import { BudgetAlertTag, BudgetGauge, formatPercent } from '@/components/BudgetParts';
import { CouncilSelect, RequireArea, useCouncilScope } from '@/components/CouncilScope';
import { MissionTracking } from '@/components/MissionTracking';
import { cx, Empty, Field, Notice, PageTitle, Panel, Pill, Select, Table, Td } from '@/components/ui';
import { formatDecimalHours, formatFullDate, formatMoney, formatPersonName, formatPhone } from '@/lib/format';
import { useUser } from '@/lib/session';
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

/**
 * Budget tracking gauges for one fraternal year: the whole budget, then each category with an approved cap or spend.
 * Before the council approves the year there are no caps, so the panel says so and shows only what has been spent.
 */
function BudgetTracking({ actorId, councilId, fraternalYear }: { actorId: number; councilId: number; fraternalYear: string }) {
  const progress = useLoad(() => db.budget.getBudgetProgress(actorId, councilId, fraternalYear), [actorId, councilId, fraternalYear]);
  const p = progress.data;
  const active = p ? p.categories.filter((c) => c.approved > 0 || c.actual > 0) : [];
  const flagged = active.filter((c) => c.alert === 'Warning' || c.alert === 'Over Budget').length;
  return (
    <Panel
      title={`Budget tracking · ${fraternalYear}`}
      actions={flagged > 0 ? <Pill tone="red">{flagged} past {BUDGET_WARNING_THRESHOLD_PERCENT}%</Pill> : p ? <Pill tone="outline">{p.status}</Pill> : null}
    >
      {progress.error ? <Notice tone="error">{progress.error}</Notice> : null}
      {!p ? (
        progress.error ? null : <p className="text-sm text-muted">Loading the budget…</p>
      ) : (
        <div className="flex flex-col gap-4">
          {p.status !== 'Approved' ? (
            <Notice tone="info">
              The {fraternalYear} budget has not been approved and finalized yet ({p.status.toLowerCase()}), so there are no caps to track against. Spend so far:{' '}
              {formatMoney(p.actualTotal)}.
            </Notice>
          ) : (
            <>
              <div className="rounded border-2 border-navy bg-white p-3">
                <BudgetGauge label="Whole budget" approved={p.approvedTotal} actual={p.actualTotal} percentUsed={p.utilizationPercent} alert={p.alert} />
              </div>
              {active.length === 0 ? (
                <Empty>No category has an approved cap or any spend yet.</Empty>
              ) : (
                <ul className="grid grid-cols-1 gap-4 md:grid-cols-2" aria-label="Budget categories">
                  {active.map((c) => (
                    <li key={c.categoryId ?? 'uncategorized'}>
                      <BudgetGauge label={c.label} approved={c.approved} actual={c.actual} percentUsed={c.percentUsed} alert={c.alert} />
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2 text-xs">
            <span>
              Unbudgeted spend: <span className="font-bold">{formatMoney(p.unbudgetedActual)}</span>{' '}
              {p.unbudgetedActual > 0 ? <BudgetAlertTag alert="Unbudgeted" /> : null}
            </span>
            <span className="text-muted">
              {formatFullDate(p.fromDate)} to {formatFullDate(p.throughDate)} · {formatPercent(p.utilizationPercent)} of the approved budget used
            </span>
          </div>
        </div>
      )}
    </Panel>
  );
}

function NoShowAudit({ councilId }: { councilId: number }) {
  const audit = useLoad(() => db.reports.listNoShowsAudit(councilId), [councilId]);
  const rows = audit.data ?? [];
  const unexplained = rows.filter((r) => r.reason === null).length;
  return (
    <Panel
      title={`No-show audit: last ${NO_SHOW_AUDIT_MONTHS} months (${rows.length})`}
      actions={unexplained > 0 ? <Pill tone="red">{unexplained} without a reason</Pill> : null}
    >
      {audit.error ? <Notice tone="error">{audit.error}</Notice> : null}
      {audit.data && rows.length === 0 ? <Empty>No no-shows recorded in the last {NO_SHOW_AUDIT_MONTHS} months.</Empty> : null}
      {rows.length > 0 ? (
        <div className="max-h-[28rem] overflow-y-auto">
          <Table caption="No-shows in the trailing six months" head={['Member', 'Member #', 'Shift date', 'Event', 'Shift', 'Reason']}>
            {rows.map((r) => (
              <tr key={r.signup.id}>
                <Td className="font-bold">{formatPersonName(r.firstName, r.lastName)}</Td>
                <Td>{r.memberNumber}</Td>
                <Td className="whitespace-nowrap">{formatFullDate(r.shift.ShiftDate)}</Td>
                <Td>{r.event.EventName}</Td>
                <Td>
                  {r.shift.ShiftName}
                  <span className="block text-xs text-muted">Shift #{r.shift.id}</span>
                </Td>
                <Td>
                  {r.reason ? (
                    <>
                      <Pill tone="outline">{r.reason.NoShowReasonCode}</Pill> {r.reason.NoShowReasonDescription}
                    </>
                  ) : (
                    <Pill tone="red">No reason provided</Pill>
                  )}
                </Td>
              </tr>
            ))}
          </Table>
        </div>
      ) : null}
    </Panel>
  );
}

function AwaitingHours({ councilId }: { councilId: number }) {
  const awaiting = useLoad(() => db.reports.listShiftsAwaitingHours(councilId), [councilId]);
  const rows = awaiting.data ?? [];
  const overdue = rows.filter((r) => !r.closed && r.daysSinceShift >= HOURS_REMINDER_FIRST_DAY).length;
  return (
    <Panel title={`Shifts awaiting hours (${rows.length})`} actions={overdue > 0 ? <Pill tone="red">{overdue} past {HOURS_REMINDER_FIRST_DAY} days</Pill> : null}>
      {awaiting.error ? <Notice tone="error">{awaiting.error}</Notice> : null}
      {awaiting.data && rows.length === 0 ? <Empty>Every volunteer on a past shift has logged their hours.</Empty> : null}
      {rows.length > 0 ? (
        <div className="max-h-[28rem] overflow-y-auto">
          <Table caption="Past shifts whose volunteers have not logged hours" head={['Member', 'Phone', 'Shift', 'Event', 'Days since', 'Reminders']}>
            {rows.map((r) => {
              const late = !r.closed && r.daysSinceShift >= HOURS_REMINDER_FIRST_DAY;
              const due = hoursRemindersDue(r);
              return (
                <tr key={r.signup.id} className={cx(late && 'border-l-8 border-brand-red')}>
                  <Td className="font-bold">{formatPersonName(r.firstName, r.lastName)}</Td>
                  <Td className="whitespace-nowrap">{formatPhone(r.phone)}</Td>
                  <Td className="whitespace-nowrap">
                    {formatShiftWhen(r.shift)}
                    <span className="block text-xs text-muted">{r.shift.ShiftName}</span>
                  </Td>
                  <Td>{r.event.EventName}</Td>
                  <Td className={cx('font-bold', late && 'text-brand-red')}>{r.daysSinceShift}</Td>
                  <Td>
                    {r.closed ? (
                      <Pill tone="outline">Closed: past {SHIFT_HISTORY_MONTHS} months</Pill>
                    ) : late ? (
                      <>
                        <Pill tone="red">⚠ Overdue</Pill>
                        <span className="block text-xs text-brand-red">
                          {due} text reminder{due === 1 ? '' : 's'} due so far · log by {formatFullDate(r.loggableThrough)}
                        </span>
                      </>
                    ) : (
                      <span className="text-xs text-muted">First reminder on day {HOURS_REMINDER_FIRST_DAY}</span>
                    )}
                  </Td>
                </tr>
              );
            })}
          </Table>
        </div>
      ) : null}
      <p className="mt-2 text-xs text-muted">
        Members who checked in but have not reported time. A text reminder goes out on day {HOURS_REMINDER_FIRST_DAY} and weekly after that, until the{' '}
        {SHIFT_HISTORY_MONTHS}-month logging window closes.
      </p>
    </Panel>
  );
}

function Dashboard() {
  const user = useUser();
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
          {canReviewBudgetPerformance(user, scope.councilId) ? (
            <>
              <MissionTracking actorId={user.memberId} councilId={scope.councilId} fraternalYear={currentFraternalYear(new Date(year, month - 1, 1))} />
              <BudgetTracking actorId={user.memberId} councilId={scope.councilId} fraternalYear={currentFraternalYear(new Date(year, month - 1, 1))} />
            </>
          ) : null}
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
      {canViewExecutiveAudits(user, scope.councilId) ? (
        <div className="mt-6 flex flex-col gap-4">
          <h2 className="font-serif text-xl font-bold">Executive audits</h2>
          <div className="grid grid-cols-1 items-start gap-4 2xl:grid-cols-2">
            <NoShowAudit councilId={scope.councilId} />
            <AwaitingHours councilId={scope.councilId} />
          </div>
        </div>
      ) : null}
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
