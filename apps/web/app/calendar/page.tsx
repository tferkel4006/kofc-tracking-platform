'use client';
// Visual Master Calendar: the council's events, shifts and meetings on a Month, Week or Day grid
// (events.listCalendarRange, with the shift feed for volunteer counts). Brand colour manual:
//   solid navy          - formal assemblies, council sessions and officer meetings
//   red, pulsing        - an assignment starting within 48 hours
//   gold border         - a shift still short of volunteers
// Choosing a day slides open a details card with that day's meetings (and their Drive files), the open shifts
// with an instant "Sign up", and each event's turnout register.
import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  calendarDays,
  calendarTone,
  describeError,
  entriesOn,
  formatTimeRange,
  isShiftUrgent,
  shiftNeedsVolunteers,
  shiftStart,
  stepCalendar,
  toIsoDate,
  URGENT_WITHIN_HOURS,
  type CalendarEntry,
  type CalendarTone,
  type CalendarView,
  type ShiftFeedItem,
} from '@kofc/shared';
import { CouncilSelect, RequireArea, useCouncilScope } from '@/components/CouncilScope';
import { DriveButtons } from '@/components/DriveLinks';
import { Button, cx, Empty, Notice, PageTitle, Pill, Tabs } from '@/components/ui';
import { formatPersonName } from '@/lib/format';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

const VIEWS = [
  { id: 'month', label: 'Monthly' },
  { id: 'week', label: 'Weekly' },
  { id: 'day', label: 'Daily' },
] as const satisfies readonly { id: CalendarView; label: string }[];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const TONE_CLASS: Record<CalendarTone, string> = {
  meeting: 'border-navy bg-navy text-white',
  urgent: 'border-brand-red bg-brand-red text-white motion-safe:animate-pulse',
  needs: 'border-gold bg-white text-navy',
  normal: 'border-line bg-white text-navy',
};

const TONE_LABEL: Record<CalendarTone, string> = {
  meeting: 'Council meeting',
  urgent: `Within ${URGENT_WITHIN_HOURS} hours`,
  needs: 'Needs volunteers',
  normal: 'Scheduled',
};

const toDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const longDay = (iso: string) => toDate(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
const shortDay = (iso: string) => toDate(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

function viewTitle(view: CalendarView, anchor: string, days: readonly string[]): string {
  if (view === 'month') return toDate(anchor).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  if (view === 'day') return longDay(anchor);
  return `${shortDay(days[0])} – ${shortDay(days[days.length - 1])}, ${days[days.length - 1].slice(0, 4)}`;
}

/** Shifts of the feed keyed by `${eventId}|${date}`. */
function shiftsByEventDay(feed: readonly ShiftFeedItem[]): Map<string, ShiftFeedItem[]> {
  const map = new Map<string, ShiftFeedItem[]>();
  for (const item of feed) {
    const key = `${item.event.id}|${item.shift.ShiftDate}`;
    map.set(key, [...(map.get(key) ?? []), item]);
  }
  return map;
}

/** A meeting's clock times, or 'All day' for a multi-day meeting (Sprint 5Y-6), which has none. */
const meetingTimes = (m: Pick<CalendarEntry, 'startTime' | 'endTime'>): string =>
  m.startTime && m.endTime ? formatTimeRange(m.startTime, m.endTime) : 'All day';

// ---- badges ------------------------------------------------------------------

function EntryBadge({ entry, tone }: { entry: CalendarEntry; tone: CalendarTone }) {
  return (
    <span className={cx('block truncate rounded border-2 px-1.5 py-0.5 text-left text-xs font-bold', TONE_CLASS[tone])} title={`${entry.title} · ${TONE_LABEL[tone]}`}>
      {entry.kind === 'meeting' && entry.startTime ? `${entry.startTime.slice(0, 5)} ` : ''}
      {entry.title}
      <span className="sr-only"> ({TONE_LABEL[tone]})</span>
    </span>
  );
}

function Legend() {
  return (
    <ul aria-label="Calendar colour key" className="flex flex-wrap gap-3 text-xs">
      {(['meeting', 'urgent', 'needs', 'normal'] as const).map((tone) => (
        <li key={tone} className="flex items-center gap-1.5">
          <span aria-hidden="true" className={cx('inline-block h-3 w-5 rounded-sm border-2', TONE_CLASS[tone].replace('motion-safe:animate-pulse', ''))} />
          {TONE_LABEL[tone]}
        </li>
      ))}
    </ul>
  );
}

// ---- the grid ----------------------------------------------------------------

interface DayModel {
  date: string;
  items: { entry: CalendarEntry; tone: CalendarTone }[];
}

function DayCell({
  day,
  inMonth,
  isToday,
  selected,
  limit,
  onSelect,
}: {
  day: DayModel;
  inMonth: boolean;
  isToday: boolean;
  selected: boolean;
  limit: number;
  onSelect: () => void;
}) {
  const shown = day.items.slice(0, limit);
  const more = day.items.length - shown.length;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`${longDay(day.date)}: ${day.items.length === 0 ? 'nothing scheduled' : `${day.items.length} item${day.items.length === 1 ? '' : 's'}`}`}
      className={cx(
        'flex h-full min-h-28 w-full flex-col gap-1 border-t-4 bg-white p-1.5 text-left align-top hover:bg-white',
        isToday ? 'border-t-gold' : 'border-t-transparent',
        selected ? 'outline outline-2 -outline-offset-2 outline-navy' : '',
      )}
    >
      <span className={cx('text-sm font-bold', inMonth ? 'text-navy' : 'text-muted')}>
        {Number(day.date.slice(8))}
        {isToday ? <span className="ml-1 text-xs font-normal">today</span> : null}
      </span>
      {shown.map(({ entry, tone }) => (
        <EntryBadge key={`${entry.kind}-${entry.id}`} entry={entry} tone={tone} />
      ))}
      {more > 0 ? <span className="text-xs font-bold text-muted">+{more} more</span> : null}
    </button>
  );
}

// ---- the day details card ----------------------------------------------------

function ShiftRow({ item, now, onSignUp, busy }: { item: ShiftFeedItem; now: Date; onSignUp: () => void; busy: boolean }) {
  const { shift, isSignedUp } = item;
  const started = shiftStart(shift).getTime() <= now.getTime();
  const urgent = isShiftUrgent(shift, now);
  const needs = shiftNeedsVolunteers(shift);
  return (
    <li className={cx('flex flex-col gap-1 rounded border-2 p-2', urgent ? 'border-brand-red' : needs && !started ? 'border-gold' : 'border-line')}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold">{shift.ShiftName}</p>
          <p className="text-xs text-muted">{formatTimeRange(shift.StartTime, shift.EndTime)}</p>
        </div>
        <span className="flex flex-wrap justify-end gap-1">
          {urgent ? <Pill tone="red">Within {URGENT_WITHIN_HOURS} h</Pill> : null}
          {isSignedUp ? <Pill tone="navy">Signed up</Pill> : needs ? <Pill tone="gold">Needs {shift.MinNumberVolunteers - shift.NumberVolunteersSignedUp}</Pill> : <Pill tone="outline">Full</Pill>}
        </span>
      </div>
      <p className="text-xs">
        {shift.NumberVolunteersSignedUp} of {shift.MinNumberVolunteers} volunteers signed up
      </p>
      {!isSignedUp && needs && !started ? (
        <div>
          <Button size="sm" onClick={onSignUp} disabled={busy}>
            {busy ? 'Signing up…' : 'Sign up'}
          </Button>
        </div>
      ) : null}
    </li>
  );
}

function DayDetails({
  date,
  entries,
  feed,
  now,
  onClose,
  onChanged,
}: {
  date: string;
  entries: CalendarEntry[];
  feed: ShiftFeedItem[];
  now: Date;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const user = useUser();
  const events = entries.filter((e): e is Extract<CalendarEntry, { kind: 'event' }> => e.kind === 'event');
  const meetings = entries.filter((e): e is Extract<CalendarEntry, { kind: 'meeting' }> => e.kind === 'meeting');
  const eventIds = events.map((e) => e.id);
  const turnout = useLoad(async () => {
    const lists = await Promise.all(eventIds.map((id) => db.events.listTurnout(id)));
    return new Map(eventIds.map((id, i) => [id, lists[i]]));
  }, [date, eventIds.join(',')]);
  const [busyShift, setBusyShift] = useState<number | null>(null);
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);

  const signUp = async (item: ShiftFeedItem) => {
    setBusyShift(item.shift.id);
    setMessage(null);
    try {
      await db.events.signupForShift(user.memberId, item.shift.id);
      setMessage({ tone: 'info', text: `You are signed up for ${item.shift.ShiftName} at ${item.event.EventName}. Thank you!` });
      await Promise.all([onChanged(), turnout.reload()]);
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setBusyShift(null);
    }
  };

  return (
    <aside aria-label={`Details for ${longDay(date)}`} className="motion-safe:animate-slide-in flex flex-col self-start overflow-hidden rounded border-l-8 border-gold bg-white shadow-lg outline outline-1 outline-line">
      <header data-surface="navy" className="flex items-center justify-between gap-3 bg-navy px-4 py-3 text-white">
        <h2 className="font-serif text-lg font-bold">{longDay(date)}</h2>
        <button type="button" onClick={onClose} className="font-bold underline">
          Close
        </button>
      </header>
      <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto p-4">
        {message ? (
          <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
            {message.text}
          </Notice>
        ) : null}
        {entries.length === 0 ? <Empty>Nothing is scheduled on this day.</Empty> : null}

        {meetings.map((m) => (
          <section key={`m-${m.id}`} className="flex flex-col gap-2 rounded border-2 border-navy p-3">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-serif text-base font-bold">{m.title}</h3>
              <Pill tone="navy">Meeting</Pill>
            </div>
            <p className="text-sm">
              {meetingTimes(m)} · {m.location}
            </p>
            {m.meeting['Meeting Description'] ? <p className="text-xs text-muted">{m.meeting['Meeting Description']}</p> : null}
            <DriveButtons meeting={m.meeting} />
            <Link href="/meetings" className="text-sm font-bold underline">
              Open in the Meeting center
            </Link>
          </section>
        ))}

        {events.map((e) => {
          const shifts = feed.filter((f) => f.event.id === e.id && f.shift.ShiftDate === date);
          const register = (turnout.data?.get(e.id) ?? []).filter((t) => t.shift.ShiftDate === date);
          const tone = calendarTone(e, shifts.map((s) => s.shift), now);
          return (
            <section key={`e-${e.id}`} className={cx('flex flex-col gap-2 rounded border-2 p-3', tone === 'urgent' ? 'border-brand-red' : tone === 'needs' ? 'border-gold' : 'border-line')}>
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-serif text-base font-bold">{e.title}</h3>
                {tone === 'urgent' ? <Pill tone="red">Urgent</Pill> : tone === 'needs' ? <Pill tone="gold">Needs volunteers</Pill> : <Pill tone="outline">Event</Pill>}
              </div>
              <p className="text-sm">
                {e.startDate === e.endDate ? shortDay(e.startDate) : `${shortDay(e.startDate)} – ${shortDay(e.endDate)}`} · {e.location}
              </p>

              <h4 className="text-xs font-bold uppercase tracking-wide">Shifts this day</h4>
              {shifts.length === 0 ? (
                <p className="text-xs text-muted">No shifts are scheduled for this event on this day.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {shifts.map((item) => (
                    <ShiftRow key={item.shift.id} item={item} now={now} busy={busyShift === item.shift.id} onSignUp={() => void signUp(item)} />
                  ))}
                </ul>
              )}

              <h4 className="text-xs font-bold uppercase tracking-wide">Turnout register</h4>
              {turnout.error ? <Notice tone="error">{turnout.error}</Notice> : null}
              {register.length === 0 ? (
                <p className="text-xs text-muted">{turnout.loading ? 'Loading…' : 'Nobody has signed up for this day yet.'}</p>
              ) : (
                <ul className="flex flex-col gap-0.5 text-sm">
                  {register.map((t) => (
                    <li key={t.signup.id} className="flex justify-between gap-2">
                      <span>
                        {formatPersonName(t.MemberFirstName, t.MemberLastName)}
                        {t.signup.MemberID === user.memberId ? ' (you)' : ''}
                      </span>
                      <span className="text-xs text-muted">
                        {t.shift.ShiftName}
                        {t.signup.NoShow === 1 ? ' · no-show' : t.hoursLogged != null ? ` · ${t.hoursLogged} h` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap gap-3 text-sm">
                <Link href="/member-actions" className="font-bold underline">
                  All open shifts
                </Link>
                <Link href="/ledger" className="font-bold underline">
                  Post-event ledger
                </Link>
              </div>
            </section>
          );
        })}
      </div>
    </aside>
  );
}

// ---- the page ----------------------------------------------------------------

function MasterCalendar() {
  const user = useUser();
  const scope = useCouncilScope();
  const today = toIsoDate(new Date());
  const [view, setView] = useState<CalendarView>('month');
  const [anchor, setAnchor] = useState(today);
  const [selected, setSelected] = useState<string | null>(null);

  const days = useMemo(() => calendarDays(view, anchor), [view, anchor]);
  const from = days[0];
  const to = days[days.length - 1];
  const data = useLoad(async () => {
    const [entries, feed] = await Promise.all([
      db.events.listCalendarRange(scope.councilId, from, to),
      db.events.listShiftFeed({ memberId: user.memberId, councilIds: [scope.councilId], fromDate: from, toDate: to }),
    ]);
    return { entries, feed };
  }, [scope.councilId, from, to, user.memberId]);

  const now = new Date();
  const entries = data.data?.entries ?? [];
  const feed = data.data?.feed ?? [];
  const byEventDay = shiftsByEventDay(feed);
  const model: DayModel[] = days.map((date) => ({
    date,
    items: entriesOn(entries, date).map((entry) => ({
      entry,
      tone: calendarTone(entry, entry.kind === 'event' ? (byEventDay.get(`${entry.id}|${date}`) ?? []).map((f) => f.shift) : [], now),
    })),
  }));
  const month = anchor.slice(0, 7);
  const openDay = view === 'day' ? anchor : selected;

  const go = (next: string) => {
    setAnchor(next);
    setSelected(null);
  };

  const grid =
    view === 'day' ? null : (
      <div className="overflow-x-auto rounded border border-line">
        <div className="grid min-w-[42rem] grid-cols-7 bg-navy text-center text-xs font-bold uppercase tracking-wide text-white" data-surface="navy">
          {WEEKDAYS.map((d) => (
            <div key={d} className="px-2 py-1.5">
              {d}
            </div>
          ))}
        </div>
        <div className="grid min-w-[42rem] grid-cols-7 gap-px bg-line">
          {model.map((day) => (
            <DayCell
              key={day.date}
              day={day}
              inMonth={view === 'week' || day.date.slice(0, 7) === month}
              isToday={day.date === today}
              selected={selected === day.date}
              limit={view === 'week' ? 12 : 3}
              onSelect={() => setSelected(selected === day.date ? null : day.date)}
            />
          ))}
        </div>
      </div>
    );

  return (
    <>
      <PageTitle actions={<CouncilSelect scope={scope} />}>Visual Master Calendar</PageTitle>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <Tabs
            tabs={VIEWS}
            value={view}
            onChange={(v) => {
              setView(v);
              setSelected(null);
            }}
            label="Calendar view"
            idPrefix="calendar"
          />
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => go(stepCalendar(view, anchor, -1))} aria-label={`Previous ${view}`}>
              ‹ Prev
            </Button>
            <Button variant="secondary" size="sm" onClick={() => go(today)}>
              Today
            </Button>
            <Button variant="secondary" size="sm" onClick={() => go(stepCalendar(view, anchor, 1))} aria-label={`Next ${view}`}>
              Next ›
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-serif text-xl font-bold" aria-live="polite">
            {viewTitle(view, anchor, days)}
          </h2>
          <Legend />
        </div>
        {data.error ? <Notice tone="error">{data.error}</Notice> : null}

        <div id="calendar-panel" role="tabpanel" aria-labelledby={`calendar-tab-${view}`} className={cx('grid items-start gap-4', openDay ? 'xl:grid-cols-[minmax(0,1fr)_26rem]' : '')}>
          {view === 'day' ? (
            <div className="flex flex-col gap-2">
              {model[0].items.length === 0 ? (
                <Empty>{data.loading ? 'Loading the day…' : 'Nothing is scheduled on this day.'}</Empty>
              ) : (
                model[0].items.map(({ entry, tone }) => (
                  <div key={`${entry.kind}-${entry.id}`} className={cx('flex items-center justify-between gap-3 rounded border-2 px-3 py-2', TONE_CLASS[tone])}>
                    <span className="font-bold">{entry.title}</span>
                    <span className="text-sm">{entry.kind === 'meeting' ? meetingTimes(entry) : TONE_LABEL[tone]}</span>
                  </div>
                ))
              )}
            </div>
          ) : (
            grid
          )}
          {openDay ? (
            <DayDetails
              key={openDay}
              date={openDay}
              entries={entriesOn(entries, openDay)}
              feed={feed}
              now={now}
              onClose={() => (view === 'day' ? setView('month') : setSelected(null))}
              onChanged={data.reload}
            />
          ) : null}
        </div>
      </div>
    </>
  );
}

export default function CalendarPage() {
  return (
    <RequireArea area="calendar">
      <MasterCalendar />
    </RequireArea>
  );
}
