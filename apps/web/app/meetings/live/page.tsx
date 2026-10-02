'use client';
// Live Meeting Console (Sprint 5Z-10): the chair's parliamentary flight deck - for the Grand Knight, the Recorder and
// the council's other officers and Admins, or the meeting's owner (canRunLiveAssembly; the drivers:
// assertMayRunLiveAssembly). Pick a meeting and start the console (meetings.startLiveAssemblyConsole); then:
//   - the giant top bar shows the active topic with a countdown progress ring, counted from the item's start time so
//     every phone following the meeting shows the same clock;
//   - "Advance the agenda" pushes the next topic (meetings.advanceActiveAgendaItem), from the meeting's own agenda lines
//     or typed in;
//   - the live roster checks members in whatever they answered to the invitation (meetings.logLiveAttendanceOverride),
//     against the quorum base locked at start;
//   - each motion can go to a secret smartphone ballot (meetings.launchSecretSmartphoneBallot), its tally drawn as live
//     bars, and be decided Passed, Failed or Tabled (meetings.finalizeProposedMotionVote) - the decision buttons follow the
//     ballot (assertResultMatchesTally).
// The state is polled every LIVE_POLL_MS (meetings.getLiveAssemblyState), as the phones do.
import { useEffect, useMemo, useState } from 'react';
import {
  agendaTopics,
  assertResultMatchesTally,
  canRunLiveAssembly,
  describeError,
  formatCountdown,
  LIVE_AGENDA_ITEM_MAX_MINUTES,
  LIVE_AGENDA_ITEM_NAME_MAX_LENGTH,
  toIsoDate,
  type BallotTally,
  type FinalMotionResult,
  type LiveAssemblyState,
  type LiveMotionState,
  type Meeting,
} from '@kofc/shared';
import { CouncilSelect, RequireArea, useCouncilScope } from '@/components/CouncilScope';
import { Button, cx, Empty, Field, Input, Notice, PageTitle, Panel, Pill, Select } from '@/components/ui';
import { formatFullDate, formatPersonName } from '@/lib/format';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

/** How often the console re-reads the live state, as the phones do. */
const LIVE_POLL_MS = 3000;
/** Quick allotments for a new agenda item, in minutes. */
const MINUTE_CHOICES = [2, 5, 10, 15, 20, 30];
/** A countdown turns brand-red in its last minute. */
const WARNING_SECONDS = 60;

/** Seconds left on the active item, ticking locally between polls from the moment the state was read. */
function useCountdown(state: LiveAssemblyState | undefined, readAt: number): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const item = state?.activeItem;
  if (!item) return null;
  return Math.max(0, item.secondsRemaining - Math.floor((now - readAt) / 1000));
}

/** The countdown progress ring: a gold arc on navy that empties as the allotment runs out, brand-red in the last minute. */
function CountdownRing({ remaining, total }: { remaining: number; total: number }) {
  const r = 52;
  const circumference = 2 * Math.PI * r;
  const share = total > 0 ? remaining / total : 0;
  const warning = remaining <= WARNING_SECONDS;
  return (
    <div
      role="timer"
      aria-live="off"
      aria-label={`${formatCountdown(remaining)} remaining`}
      className="relative h-36 w-36 shrink-0"
    >
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="60" cy="60" r={r} fill="none" strokeWidth="10" className="stroke-white/20" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - share)}
          className={cx('transition-all duration-1000 ease-linear', warning ? 'stroke-brand-red' : 'stroke-gold')}
        />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold tabular-nums">{formatCountdown(remaining)}</span>
        <span className="text-xs uppercase tracking-wide">remaining</span>
      </span>
    </div>
  );
}

/** The Sprint 5Z-Clean-Shell welcome for the executive demo logins seeded in Seed.sql (Credentials 19-21). */
const DEMO_ROSTER_WELCOME =
  'Welcome Worthy Grand Knight Tom, Worthy Deputy Grand Knight David, and Worthy Trustee Hector! St. Jude Council 15295 Assembly Console is Fully Operational.';

/** The giant navy top bar: the officer greeting, what the floor is on now, and its countdown. */
function TopicBar({ state, remaining }: { state: LiveAssemblyState; remaining: number | null }) {
  const item = state.activeItem;
  return (
    <section
      data-surface="navy"
      aria-label="Active agenda item"
      className="flex flex-wrap items-center justify-between gap-6 rounded border-b-8 border-gold bg-navy px-8 py-6 text-white"
    >
      <p className="w-full border-b border-white/20 pb-3 text-center text-sm font-bold text-gold">{DEMO_ROSTER_WELCOME}</p>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {state.isLive ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-brand-red px-3 py-1 text-xs font-bold uppercase tracking-wide">
              <span aria-hidden="true" className="h-2 w-2 rounded-full bg-white motion-safe:animate-pulse" />
              Live
            </span>
          ) : (
            <span className="rounded-full border border-white px-3 py-1 text-xs font-bold uppercase tracking-wide">Not live</span>
          )}
          <span className="text-sm">
            {state.meeting['Meeting Name']} · {formatFullDate(state.meeting.Date)}
          </span>
        </div>
        <p className="mt-3 text-xs font-bold uppercase tracking-wide text-gold">Now on the floor</p>
        <h2 className="font-serif text-4xl font-bold leading-tight md:text-5xl">{item ? item.name : state.isLive ? 'Awaiting the first agenda item' : 'Start the console to begin'}</h2>
      </div>
      {item && remaining !== null ? <CountdownRing remaining={remaining} total={item.allottedMinutes * 60} /> : null}
    </section>
  );
}

/** Check-ins against the roster locked at start: the quorum strip. */
function QuorumStrip({ state }: { state: LiveAssemblyState }) {
  const base = state.rosterCount;
  const share = base ? Math.min(100, Math.round((state.checkedInCount / base) * 100)) : 0;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span className="font-bold">Checked in</span>
        <span>
          <span className="text-2xl font-bold tabular-nums">{state.checkedInCount}</span>
          {base !== null ? ` of ${base} on the locked roster (${share}%)` : ''}
        </span>
      </div>
      <div
        role="meter"
        aria-label="Members checked in against the locked roster"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={share}
        className="h-3 overflow-hidden rounded border-2 border-navy bg-white"
      >
        <div className="h-full bg-navy" style={{ width: `${share}%` }} />
      </div>
    </div>
  );
}

/** One ballot choice as a live horizontal bar against the members checked in. */
function TallyBar({ label, count, eligible, fill }: { label: string; count: number; eligible: number; fill: string }) {
  const width = eligible > 0 ? Math.min(100, (count / eligible) * 100) : 0;
  return (
    <div className="grid grid-cols-[5.5rem_1fr_2.5rem] items-center gap-2 text-sm">
      <span className="font-bold">{label}</span>
      <div className="h-6 overflow-hidden rounded border-2 border-navy bg-white" aria-hidden="true">
        <div className={cx('h-full transition-all duration-500', fill)} style={{ width: `${width}%` }} />
      </div>
      <span className="text-right text-lg font-bold tabular-nums">{count}</span>
    </div>
  );
}

function Tally({ tally }: { tally: BallotTally }) {
  return (
    <div className="flex flex-col gap-1.5" role="group" aria-label={`Ballot tally: ${tally.approve} approve, ${tally.deny} deny, ${tally.abstain} abstain of ${tally.eligible} checked in`}>
      <TallyBar label="Approve" count={tally.approve} eligible={tally.eligible} fill="bg-navy" />
      <TallyBar label="Deny" count={tally.deny} eligible={tally.eligible} fill="bg-brand-red" />
      <TallyBar label="Abstain" count={tally.abstain} eligible={tally.eligible} fill="bg-gold" />
      <p className="text-xs text-muted">
        {tally.total} of {tally.eligible} checked-in member{tally.eligible === 1 ? '' : 's'} have voted. Ballots are secret: no voter is recorded.
      </p>
    </div>
  );
}

const RESULT_TONE: Record<string, 'navy' | 'red' | 'gold' | 'outline'> = { Pending: 'outline', Passed: 'navy', Failed: 'red', Tabled: 'gold' };

/** A decision the ballot allows (always, without a ballot). */
const allowed = (m: LiveMotionState, result: FinalMotionResult): boolean => {
  try {
    assertResultMatchesTally(result, m.tally, m.motion.BallotOpenedAt != null);
    return true;
  } catch {
    return false;
  }
};

function MotionCard({
  m,
  presenter,
  live,
  anotherOpen,
  busy,
  onLaunch,
  onDecide,
}: {
  m: LiveMotionState;
  presenter: string;
  live: boolean;
  anotherOpen: boolean;
  busy: boolean;
  onLaunch: () => void;
  onDecide: (result: FinalMotionResult) => void;
}) {
  const pending = m.motion.VoteResult === 'Pending';
  return (
    <article className={cx('flex flex-col gap-3 rounded border-2 p-4', m.ballotOpen ? 'border-gold border-l-8' : 'border-navy')}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wide">
            Motion #{m.motion.id} · {m.motion.AllocatedMinutes} min{presenter ? ` · presented by ${presenter}` : ''}
          </p>
          <p className="font-serif text-lg font-bold">{m.motion.MotionText}</p>
        </div>
        <div className="flex items-center gap-2">
          {m.ballotOpen ? (
            <span className="motion-safe:animate-pulse">
              <Pill tone="gold">Ballot open</Pill>
            </span>
          ) : null}
          <Pill tone={RESULT_TONE[m.motion.VoteResult] ?? 'outline'}>{m.motion.VoteResult}</Pill>
        </div>
      </div>
      {m.motion.BallotOpenedAt != null ? <Tally tally={m.tally} /> : null}
      {pending ? (
        <div className="flex flex-wrap gap-2">
          {m.motion.BallotOpenedAt == null ? (
            <Button variant="gold" disabled={!live || anotherOpen || busy} onClick={onLaunch} title={!live ? 'Start the console first' : anotherOpen ? 'Decide the open ballot first' : undefined}>
              Launch secret smartphone ballot
            </Button>
          ) : null}
          <Button disabled={busy || !allowed(m, 'Passed')} onClick={() => onDecide('Passed')}>
            Passed
          </Button>
          <Button variant="danger" disabled={busy || !allowed(m, 'Failed')} onClick={() => onDecide('Failed')}>
            Failed
          </Button>
          <Button variant="secondary" disabled={busy} onClick={() => onDecide('Tabled')}>
            Tabled
          </Button>
        </div>
      ) : null}
    </article>
  );
}

function LiveConsole() {
  const user = useUser();
  const scope = useCouncilScope();
  const councilId = scope.councilId;
  const fromDate = toIsoDate(new Date(Date.now() - 7 * 86_400_000));
  const meetings = useLoad(() => db.meetings.listUpcoming(councilId, { fromDate }), [councilId, fromDate]);
  const runnable = useMemo(() => (meetings.data ?? []).filter((m) => canRunLiveAssembly(user, m)), [meetings.data, user]);
  const [chosen, setChosen] = useState<number | null>(null);
  const meetingId = chosen ?? runnable.find((m) => m.IsLiveInProgress === 1)?.id ?? runnable[0]?.id ?? null;

  const [state, setState] = useState<LiveAssemblyState>();
  const [readAt, setReadAt] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const remaining = useCountdown(state, readAt);

  const roster = useLoad(() => db.members.listByCouncil(councilId, { activeOnly: true }), [councilId]);
  const motions = useLoad(() => (meetingId === null ? Promise.resolve([]) : db.meetings.listProposedMotions(meetingId)), [meetingId]);
  const presenters = new Map((motions.data ?? []).map((d) => [d.motion.id, formatPersonName(d.presenterFirstName, d.presenterLastName)]));

  const accept = (next: LiveAssemblyState) => {
    setState(next);
    setReadAt(Date.now());
  };

  // Poll the live state, as the phones do.
  useEffect(() => {
    if (meetingId === null) return;
    let alive = true;
    const read = () =>
      db.meetings.getLiveAssemblyState(user.memberId, meetingId).then(
        (next) => alive && accept(next),
        (err: unknown) => alive && setError(describeError(err)),
      );
    void read();
    const timer = window.setInterval(() => void read(), LIVE_POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [meetingId, user.memberId]);

  const act = async (run: () => Promise<LiveAssemblyState | unknown>) => {
    if (meetingId === null) return;
    setBusy(true);
    setError(null);
    try {
      await run();
      accept(await db.meetings.getLiveAssemblyState(user.memberId, meetingId));
      await Promise.all([motions.reload(), meetings.reload()]);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  // Agenda controls.
  const meeting: Meeting | undefined = state?.meeting ?? runnable.find((m) => m.id === meetingId);
  const topics = agendaTopics(meeting?.Agenda);
  const [topic, setTopic] = useState('');
  const [minutes, setMinutes] = useState(5);
  const push = (name: string) => act(() => db.meetings.advanceActiveAgendaItem(user.memberId, meetingId!, name, minutes));

  // Roster controls.
  const [search, setSearch] = useState('');
  const checkedIn = new Set(state?.checkedInMemberIds ?? []);
  const people = (roster.data ?? [])
    .filter((m) => `${m.MemberFirstName} ${m.MemberLastName}`.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => formatPersonName(a.MemberFirstName, a.MemberLastName).localeCompare(formatPersonName(b.MemberFirstName, b.MemberLastName)));

  const live = !!state?.isLive;
  const openBallot = state?.motions.find((m) => m.ballotOpen);

  return (
    <div className="flex flex-col gap-6">
      <PageTitle
        actions={
          <div className="flex flex-wrap items-end gap-3">
            <CouncilSelect scope={scope} />
            <Field label="Meeting" className="w-80">
              {(id) => (
                <Select id={id} value={meetingId ?? ''} onChange={(e) => setChosen(Number(e.target.value))} disabled={runnable.length === 0}>
                  {runnable.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.IsLiveInProgress === 1 ? '● LIVE · ' : ''}
                      {formatFullDate(m.Date)} · {m['Meeting Name']}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
        }
      >
        Live Meeting Console
      </PageTitle>
      {error ? (
        <Notice tone="error" onDismiss={() => setError(null)}>
          {error}
        </Notice>
      ) : null}
      {meetings.error ? <Notice tone="error">{meetings.error}</Notice> : null}
      {!meetings.loading && runnable.length === 0 ? <Empty>No meeting from the past week on is yours to run. Schedule one in the Meeting Center.</Empty> : null}

      {state ? (
        <>
          <TopicBar state={state} remaining={remaining} />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-72 flex-1">
              <QuorumStrip state={state} />
            </div>
            {live ? (
              <Button variant="secondary" disabled={busy || !!openBallot} title={openBallot ? 'Decide the open ballot first' : undefined} onClick={() => void act(() => db.meetings.closeLiveAssemblyConsole(user.memberId, meetingId!))}>
                Close the console
              </Button>
            ) : (
              <Button variant="gold" disabled={busy} onClick={() => void act(() => db.meetings.startLiveAssemblyConsole(user.memberId, meetingId!))}>
                Start live console
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <Panel title="Advance the agenda" className="xl:col-span-1">
              <div className="flex flex-col gap-3">
                <Field label="Allotted minutes">
                  {(id) => (
                    <Select id={id} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
                      {MINUTE_CHOICES.filter((n) => n <= LIVE_AGENDA_ITEM_MAX_MINUTES).map((n) => (
                        <option key={n} value={n}>
                          {n} minutes
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                {topics.length ? (
                  <div className="flex flex-col gap-1">
                    <p className="text-xs font-bold uppercase tracking-wide">From the meeting&apos;s agenda</p>
                    <ul className="flex flex-col gap-1">
                      {topics.map((t, i) => {
                        const current = state.activeItem?.name === t;
                        return (
                          <li key={`${i}-${t}`}>
                            <button
                              type="button"
                              disabled={!live || busy}
                              onClick={() => void push(t)}
                              aria-current={current ? 'step' : undefined}
                              className={cx(
                                'w-full rounded border-2 px-3 py-1.5 text-left text-sm disabled:cursor-not-allowed disabled:opacity-45',
                                current ? 'border-gold bg-gold font-bold text-navy' : 'border-navy bg-white hover:underline',
                              )}
                            >
                              {i + 1}. {t}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : (
                  <p className="text-sm text-muted">This meeting has no agenda lines; type each topic below.</p>
                )}
                <Field label="Another topic">
                  {(id) => <Input id={id} value={topic} maxLength={LIVE_AGENDA_ITEM_NAME_MAX_LENGTH} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Good of the Order" />}
                </Field>
                <Button
                  disabled={!live || busy || topic.trim() === ''}
                  onClick={() => {
                    void push(topic.trim());
                    setTopic('');
                  }}
                >
                  Push to the top bar
                </Button>
                {!live ? <p className="text-xs text-muted">Start the live console to push topics.</p> : null}
              </div>
            </Panel>

            <Panel title="Motions & secret ballots" className="xl:col-span-2">
              {state.motions.length === 0 ? (
                <Empty>No motion is on this meeting&apos;s agenda. Vetted charitable requests are placed here from the vetting desk.</Empty>
              ) : (
                <div className="flex flex-col gap-4">
                  {state.motions.map((m) => (
                    <MotionCard
                      key={m.motion.id}
                      m={m}
                      presenter={presenters.get(m.motion.id) ?? ''}
                      live={live}
                      anotherOpen={!!openBallot && openBallot.motion.id !== m.motion.id}
                      busy={busy}
                      onLaunch={() => void act(() => db.meetings.launchSecretSmartphoneBallot(user.memberId, m.motion.id))}
                      onDecide={(result) => void act(() => db.meetings.finalizeProposedMotionVote(user.memberId, m.motion.id, result))}
                    />
                  ))}
                </div>
              )}
            </Panel>
          </div>

          <Panel title="Live attendance" actions={<span className="text-sm">{state.checkedInCount} checked in</span>}>
            <div className="flex flex-col gap-3">
              <p className="text-sm">
                Members check themselves in from the phone app&apos;s live feed. Check anyone else in here, whatever they answered to the invitation; once checked in they may vote.
              </p>
              <Field label="Find a member" className="max-w-sm">
                {(id) => <Input id={id} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name" />}
              </Field>
              {roster.error ? <Notice tone="error">{roster.error}</Notice> : null}
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {people.map((m) => {
                  const here = checkedIn.has(m.id);
                  return (
                    <li key={m.id} className={cx('flex items-center justify-between gap-2 rounded border-2 px-3 py-2', here ? 'border-navy bg-white' : 'border-line')}>
                      <span className={cx('text-sm', here && 'font-bold')}>
                        {here ? '✓ ' : ''}
                        {formatPersonName(m.MemberFirstName, m.MemberLastName)}
                      </span>
                      {here ? (
                        <Pill tone="navy">Checked in</Pill>
                      ) : (
                        <Button size="sm" variant="secondary" disabled={!live || busy} onClick={() => void act(() => db.meetings.logLiveAttendanceOverride(user.memberId, meetingId!, m.id))}>
                          Check in
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </Panel>
        </>
      ) : meetingId !== null && !error ? (
        <p className="text-sm">Loading…</p>
      ) : null}
    </div>
  );
}

export default function LiveConsolePage() {
  return (
    <RequireArea area="meetings/live">
      <LiveConsole />
    </RequireArea>
  );
}
