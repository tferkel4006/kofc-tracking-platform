'use client';
// Sprint 7A: the Executive Summary's engagement row (reports.councilEngagement). Two cards side by side:
//   - Monthly activity overview: a high-contrast navy card with white text and a gold edge - the month's volunteer
//     count, cash collected (the monthly summary's cash raised), total hours, and every volunteer's name with hours.
//   - Top 5 Volunteers Leaderboard: gold-bordered, the council's Active members ranked by all hours ever logged at its
//     events and activities. The council's Admins and Super Admins also set the canonization shield's thresholds here
//     (councils.setRankThresholds), the bar a member's phone shield is measured against.
import { useEffect, useState } from 'react';
import {
  canAdministerCouncil,
  CANONIZATION_LEVELS,
  councilRankThresholds,
  describeError,
  RANK_THRESHOLD_MAX_EVENTS,
  RANK_THRESHOLD_MAX_HOURS,
  type Council,
  type MonthlySummary,
} from '@kofc/shared';
import { Button, Field, Input, Notice } from '@/components/ui';
import { formatDecimalHours, formatMoney, formatPersonName } from '@/lib/format';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

const MEDALS = ['🥇', '🥈', '🥉'];

function ThresholdEditor({ council, onSaved }: { council: Council; onSaved: () => void }) {
  const user = useUser();
  const current = councilRankThresholds(council);
  const [hours, setHours] = useState(String(current.hours));
  const [events, setEvents] = useState(String(current.events));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);
  useEffect(() => {
    setHours(String(current.hours));
    setEvents(String(current.events));
  }, [current.hours, current.events]);

  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await db.councils.setRankThresholds(user.memberId, council.id, { hours: Number(hours), events: Number(events) });
      setMessage({ tone: 'info', text: 'Shield thresholds saved.' });
      onSaved();
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="mt-3 flex flex-col gap-2 border-t border-line pt-3"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <p className="text-xs">
        <span className="font-bold">Canonization shield thresholds.</span> A member reaches Saint once both are met; Blessed at two thirds and Venerable at one
        third of each.
      </p>
      <div className="flex items-end gap-2">
        <Field label="Hours" className="w-28">
          {(id) => <Input id={id} type="number" min={1} max={RANK_THRESHOLD_MAX_HOURS} step={1} value={hours} onChange={(e) => setHours(e.target.value)} />}
        </Field>
        <Field label="Events" className="w-28">
          {(id) => <Input id={id} type="number" min={1} max={RANK_THRESHOLD_MAX_EVENTS} step={1} value={events} onChange={(e) => setEvents(e.target.value)} />}
        </Field>
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </Button>
      </div>
      {message ? (
        <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
          {message.text}
        </Notice>
      ) : null}
    </form>
  );
}

export function EngagementCards({
  councilId,
  year,
  month,
  monthLabel,
  summary,
}: {
  councilId: number;
  year: number;
  month: number;
  monthLabel: string;
  summary: MonthlySummary;
}) {
  const user = useUser();
  const engagement = useLoad(() => db.reports.councilEngagement(user.memberId, councilId, year, month), [user.memberId, councilId, year, month]);
  const council = useLoad(() => db.councils.get(councilId), [councilId]);
  const e = engagement.data;
  const totalHours = e ? e.volunteers.reduce((sum, v) => sum + v.hours, 0) : 0;

  return (
    <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
      <section aria-label="Monthly activity overview" className="rounded border-4 border-gold bg-navy px-5 py-4 text-white">
        <h2 className="font-serif text-xl font-bold">Monthly activity overview · {monthLabel}</h2>
        {engagement.error ? <Notice tone="error">{engagement.error}</Notice> : null}
        <dl className="mt-3 grid grid-cols-3 gap-3">
          <div>
            <dt className="text-xs font-bold uppercase tracking-wide text-gold">Volunteers</dt>
            <dd className="text-4xl font-bold">{e ? e.volunteers.length.toLocaleString('en-US') : '…'}</dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase tracking-wide text-gold">Cash collected</dt>
            <dd className="text-4xl font-bold">{formatMoney(summary.finances.cash)}</dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase tracking-wide text-gold">Hours served</dt>
            <dd className="text-4xl font-bold">{e ? formatDecimalHours(totalHours) : '…'}</dd>
          </div>
        </dl>
        <h3 className="mt-4 text-sm font-bold text-gold">Who served</h3>
        {e && e.volunteers.length === 0 ? <p className="text-sm">Nobody logged service at the council&apos;s events or activities this month.</p> : null}
        {e && e.volunteers.length > 0 ? (
          <ul className="mt-1 grid max-h-64 grid-cols-1 gap-x-4 overflow-y-auto text-sm sm:grid-cols-2" aria-label="Volunteers this month">
            {e.volunteers.map((v) => (
              <li key={v.memberId} className="flex justify-between gap-2 border-b border-white/20 py-1">
                <span className="font-bold">{formatPersonName(v.firstName, v.lastName)}</span>
                <span>{formatDecimalHours(v.hours)}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <p className="mt-3 text-xs">Cash collected is the month&apos;s cash raised at the council&apos;s events, as in the financial ledger below.</p>
      </section>

      <section aria-label="Top 5 Volunteers Leaderboard" className="rounded border-4 border-gold bg-white px-5 py-4 ring-4 ring-gold/30">
        <h2 className="font-serif text-xl font-bold">🏆 Top 5 Volunteers Leaderboard</h2>
        <p className="text-xs text-muted">Active members ranked by all hours ever logged at the council&apos;s events and activities.</p>
        {e && e.leaderboard.length === 0 ? <p className="mt-3 text-sm">No member has logged hours yet. Be the first!</p> : null}
        {e && e.leaderboard.length > 0 ? (
          <ol className="mt-3 flex flex-col gap-2" aria-label="Leaderboard">
            {e.leaderboard.map((l) => (
              <li key={l.memberId} className="flex items-center gap-3 rounded border-2 border-navy px-3 py-2">
                <span className="w-10 text-center text-2xl font-bold text-navy" aria-label={`Rank ${l.rank}`}>
                  {MEDALS[l.rank - 1] ?? `#${l.rank}`}
                </span>
                <span className="flex-1 font-bold">{formatPersonName(l.firstName, l.lastName)}</span>
                <span className="rounded bg-gold px-2 py-0.5 text-sm font-bold text-navy">{formatDecimalHours(l.hours)}</span>
              </li>
            ))}
          </ol>
        ) : null}
        <p className="mt-3 text-xs text-muted">Shield levels on the phone: {CANONIZATION_LEVELS.join(' → ')}.</p>
        {council.data && canAdministerCouncil(user, councilId) ? <ThresholdEditor council={council.data} onSaved={() => void council.reload()} /> : null}
      </section>
    </div>
  );
}
