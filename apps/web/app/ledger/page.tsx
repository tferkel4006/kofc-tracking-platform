'use client';
// Post-event ledger: after an event has started, record what it really cost and raised, how many people
// came, the highlights, and the lessons learned. Admins do this for their councils' events; the event's
// owner may too (canRecordLedger), which is why every role sees this section. Events still waiting for
// results sit in the active queue; once anything is recorded (hasLedgerResults) they move to the archive.
// While an event has cash or electronic donations its funds raised are synced from them (donations.record/update/
// remove), so those two fields are shown read-only here and are corrected on the Donations page instead.
// The volunteer turnout grid also marks and clears no-shows (events.setNoShow): Admins for their councils'
// events, Super Admins for any; the controls follow mayMarkNoShow and the driver enforces the same rule.
import { useEffect, useState } from 'react';
import {
  canRecordLedger,
  describeError,
  formatDate,
  formatHours,
  hasLedgerResults,
  mayMarkNoShow,
  toIsoDate,
  type Event,
  type EventChanges,
  type LessonsLearnedCategory,
  type MemberWriteActor,
  type VolunteerTurnout,
} from '@kofc/shared';
import { CouncilSelect, RequireArea, useCouncilScope } from '@/components/CouncilScope';
import { Button, cx, Empty, Field, Input, Notice, PageTitle, Panel, Pill, Select, Table, Tabs, Td, Textarea } from '@/components/ui';
import { formatMoney, parseNumberField, toField } from '@/lib/format';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

type Message = { tone: 'error' | 'info'; text: string };

function useAction() {
  const [message, setMessage] = useState<Message | null>(null);
  const run = async (action: () => Promise<void>, done: string): Promise<boolean> => {
    setMessage(null);
    try {
      await action();
      setMessage({ tone: 'info', text: done });
      return true;
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
      return false;
    }
  };
  return { message, setMessage, run };
}

const Banner = ({ message, onDismiss }: { message: Message | null; onDismiss: () => void }) =>
  message ? (
    <Notice tone={message.tone} onDismiss={onDismiss}>
      {message.text}
    </Notice>
  ) : null;

/** A recorded result, or null while the box is blank; used so totals never treat "not entered" as zero. */
const sum = (...parts: (number | undefined)[]): number | null => {
  const entered = parts.filter((p): p is number => p !== undefined && p !== null);
  return entered.length === 0 ? null : entered.reduce((a, b) => a + b, 0);
};

// ---- results -----------------------------------------------------------------

function ResultsForm({ event, onSaved }: { event: Event; onSaved: () => void }) {
  const { message, setMessage, run } = useAction();
  // Every council's donations count toward the event's funds, so ask through any council the event is linked to.
  const donations = useLoad(async () => {
    const [councilId] = await db.events.listCouncilIds(event.id);
    return councilId === undefined ? null : ((await db.donations.listHistory(councilId, event.id)).events[0] ?? null);
  }, [event.id]);
  const managed = donations.data?.fundsManaged === true;
  const [spend, setSpend] = useState(toField(event.Spend));
  const [cash, setCash] = useState(toField(event['FundsRaised-Cash']));
  const [electronic, setElectronic] = useState(toField(event['FundsRaised-Electronic']));
  const [attendees, setAttendees] = useState(toField(event.ActualNumberAttendees));
  const [highlights, setHighlights] = useState(event.Highlights ?? '');

  // Live totals from what is typed, so the person sees the net before saving. Unparseable text shows as blank.
  const typed = (text: string, label: string): number | undefined => {
    try {
      return parseNumberField(text, label) ?? undefined;
    } catch {
      return undefined;
    }
  };
  const raised = sum(typed(cash, 'Cash'), typed(electronic, 'Electronic'));
  const spent = typed(spend, 'Spend');
  const net = raised === null && spent === undefined ? null : (raised ?? 0) - (spent ?? 0);

  const save = () =>
    run(async () => {
      const changes: EventChanges = {
        Spend: parseNumberField(spend, 'Spend'),
        ...(managed
          ? {}
          : {
              'FundsRaised-Cash': parseNumberField(cash, 'Cash funds raised'),
              'FundsRaised-Electronic': parseNumberField(electronic, 'Electronic funds raised'),
            }),
        ActualNumberAttendees: parseNumberField(attendees, 'Actual attendees'),
        Highlights: highlights.trim() === '' ? null : highlights,
      };
      await db.events.update(event.id, changes);
      onSaved();
    }, 'Results saved.');

  return (
    <Panel title="Results">
      <form
        className="grid grid-cols-2 gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className="col-span-2">
          <Banner message={message} onDismiss={() => setMessage(null)} />
        </div>
        <p className="col-span-2 text-sm text-muted">
          Planned: budget {formatMoney(event.Budget)}, {event.PlannedNumberAttendees ?? '–'} attendees.
        </p>
        <Field label="Spend ($)">{(id) => <Input id={id} inputMode="decimal" value={spend} onChange={(e) => setSpend(e.target.value)} placeholder="0.00" />}</Field>
        <Field label="Actual attendees">
          {(id) => <Input id={id} inputMode="numeric" value={attendees} onChange={(e) => setAttendees(e.target.value)} />}
        </Field>
        <Field label="Cash raised ($)" hint={managed ? 'Synced from donations' : undefined}>
          {(id) => (
            <Input id={id} inputMode="decimal" value={cash} readOnly={managed} disabled={managed} onChange={(e) => setCash(e.target.value)} placeholder="0.00" />
          )}
        </Field>
        <Field label="Electronic raised ($)" hint={managed ? 'Synced from donations' : undefined}>
          {(id) => (
            <Input
              id={id}
              inputMode="decimal"
              value={electronic}
              readOnly={managed}
              disabled={managed}
              onChange={(e) => setElectronic(e.target.value)}
              placeholder="0.00"
            />
          )}
        </Field>
        {managed && donations.data ? (
          <p className="col-span-2 text-xs text-muted">
            Funds raised total {donations.data.totals.count} recorded donation{donations.data.totals.count === 1 ? '' : 's'}
            {donations.data.totals.itemValue > 0 ? ` (plus ${formatMoney(donations.data.totals.itemValue)} of donated items, not counted)` : ''}. Correct them
            on the Donations page.
          </p>
        ) : null}
        <p className="col-span-2 text-sm font-bold" aria-live="polite">
          Raised {formatMoney(raised)} · Spent {formatMoney(spent)} · Net {formatMoney(net)}
        </p>
        <Field label="Highlights" className="col-span-2">
          {(id) => <Textarea id={id} value={highlights} onChange={(e) => setHighlights(e.target.value)} />}
        </Field>
        <div className="col-span-2">
          <Button type="submit">Save results</Button>
        </div>
      </form>
    </Panel>
  );
}

// ---- lessons learned -----------------------------------------------------------

function LessonsPanel({ eventId, categories, onChanged }: { eventId: number; categories: LessonsLearnedCategory[]; onChanged: () => void }) {
  const user = useUser();
  const lessons = useLoad(() => db.lessonsLearned.list(eventId), [eventId]);
  const { message, setMessage, run } = useAction();
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? 0);
  const [text, setText] = useState('');
  const label = new Map(categories.map((c) => [c.id, c.LessonsLearnedCategory]));

  // A lesson counts as a result, so adding the first or removing the last moves the event between tabs.
  const change = async (action: () => Promise<void>, done: string) => {
    if (await run(action, done)) {
      await lessons.reload();
      onChanged();
    }
  };

  return (
    <Panel title="Lessons learned">
      <div className="flex flex-col gap-3">
        <Banner message={message} onDismiss={() => setMessage(null)} />
        {lessons.error ? <Notice tone="error">{lessons.error}</Notice> : null}
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Category" className="w-44">
            {(id) => (
              <Select id={id} value={categoryId} onChange={(e) => setCategoryId(Number(e.target.value))}>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.LessonsLearnedCategory}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="What did we learn?" className="min-w-64 flex-1">
            {(id) => (
              <Input
                id={id}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void change(async () => { await db.lessonsLearned.add(user.memberId, eventId, categoryId, text); setText(''); }, 'Lesson added.');
                }}
              />
            )}
          </Field>
          <Button onClick={() => void change(async () => { await db.lessonsLearned.add(user.memberId, eventId, categoryId, text); setText(''); }, 'Lesson added.')}>Add lesson</Button>
        </div>
        {lessons.data?.length === 0 ? (
          <Empty>No lessons recorded yet.</Empty>
        ) : (
          <Table caption="Lessons learned" head={['Category', 'Lesson', 'Actions']}>
            {(lessons.data ?? []).map((l) => (
              <tr key={l.id}>
                <Td>
                  <Pill tone="outline">{label.get(l.LeassonsLearnedCategoryID) ?? 'Other'}</Pill>
                </Td>
                <Td>{l.LessonsLearnedDescription}</Td>
                <Td>
                  <Button size="sm" variant="secondary" onClick={() => void change(() => db.lessonsLearned.remove(user.memberId, l.id), 'Lesson removed.')}>
                    Remove
                  </Button>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </div>
    </Panel>
  );
}

// ---- volunteer turnout ---------------------------------------------------------

/** The no-show cell of one turnout row: the reason and a Clear control, or Mark no-show with its reason picker. */
function NoShowCell({
  row,
  actor,
  eventId,
  councilIds,
  reasons,
  onChange,
}: {
  row: VolunteerTurnout;
  actor: MemberWriteActor;
  eventId: number;
  councilIds: readonly number[];
  reasons: readonly { id: number; NoShowReasonCode: string; NoShowReasonDescription: string }[];
  onChange: (action: () => Promise<void>, done: string) => Promise<boolean>;
}) {
  const [picking, setPicking] = useState(false);
  const [reasonId, setReasonId] = useState('');
  const { signup } = row;
  const name = `${row.MemberFirstName} ${row.MemberLastName}`;
  const target = { signupId: signup.id, memberId: signup.MemberID, eventId, eventCouncilIds: councilIds };

  if (signup.NoShow === 1) {
    const reason = reasons.find((r) => r.id === signup.NoShowReasonID);
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone="red">No-show</Pill>
        <span className="text-xs">{reason ? `${reason.NoShowReasonCode} · ${reason.NoShowReasonDescription}` : 'No reason provided'}</span>
        {mayMarkNoShow(actor, target, false) ? (
          <Button size="sm" variant="secondary" onClick={() => void onChange(() => db.events.setNoShow(actor.memberId, signup.id, false).then(() => undefined), `Cleared the no-show for ${name}.`)}>
            Clear
          </Button>
        ) : null}
      </div>
    );
  }
  if (!mayMarkNoShow(actor, target, true)) return null;
  if (row.hoursLogged !== null) return <span className="text-xs text-muted">Hours logged</span>;
  if (!picking) {
    return (
      <Button size="sm" variant="secondary" onClick={() => setPicking(true)}>
        Mark no-show
      </Button>
    );
  }
  const confirm = async () => {
    const ok = await onChange(
      () => db.events.setNoShow(actor.memberId, signup.id, true, Number(reasonId)).then(() => undefined),
      `Marked ${name} as a no-show.`,
    );
    if (ok) setPicking(false);
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select aria-label={`No-show reason for ${name}`} value={reasonId} onChange={(e) => setReasonId(e.target.value)} className="w-auto">
        <option value="">Choose a reason…</option>
        {reasons.map((r) => (
          <option key={r.id} value={r.id}>
            {r.NoShowReasonCode} · {r.NoShowReasonDescription}
          </option>
        ))}
      </Select>
      <Button size="sm" variant="danger" disabled={reasonId === ''} onClick={() => void confirm()}>
        Confirm
      </Button>
      <Button size="sm" variant="secondary" onClick={() => setPicking(false)}>
        Cancel
      </Button>
    </div>
  );
}

function TurnoutPanel({ eventId }: { eventId: number }) {
  const user = useUser();
  const turnout = useLoad(() => db.events.listTurnout(eventId), [eventId]);
  const context = useLoad(
    async () => ({ councilIds: await db.events.listCouncilIds(eventId), reasons: await db.lookups.list('NoShowReason') }),
    [eventId],
  );
  const { message, setMessage, run } = useAction();
  const rows = turnout.data ?? [];
  const total = rows.reduce((hours, r) => hours + (r.hoursLogged ?? 0), 0);
  // The session belongs to a signed-in member; the driver re-reads the caller's type and status before any write.
  const actor: MemberWriteActor = { memberId: user.memberId, councilId: user.councilId, memberType: user.memberType, active: true, roles: user.roles };
  const change = async (action: () => Promise<void>, done: string) => {
    const ok = await run(action, done);
    if (ok) await turnout.reload();
    return ok;
  };
  return (
    <Panel title="Fraternal Volunteer Turnout Summary">
      <Banner message={message} onDismiss={() => setMessage(null)} />
      {turnout.error || context.error ? <Notice tone="error">{turnout.error ?? context.error}</Notice> : null}
      {turnout.data?.length === 0 ? (
        <Empty>Nobody signed up for this event&apos;s shifts.</Empty>
      ) : (
        <Table caption="Volunteers who signed up for this event's shifts, with hours logged and no-shows" head={['Brother', 'Shift', 'Date', 'Hours', 'No-show']}>
          {rows.map((r) => (
            <tr key={r.signup.id} className={cx(r.signup.NoShow === 1 && 'border-l-8 border-brand-red')}>
              <Td className="font-bold">
                {r.MemberFirstName} {r.MemberLastName}
              </Td>
              <Td>{r.shift.ShiftName}</Td>
              <Td>{formatDate(r.shift.ShiftDate)}</Td>
              <Td>{r.hoursLogged === null ? '—' : formatHours(r.hoursLogged)}</Td>
              <Td>
                {context.data ? (
                  <NoShowCell row={r} actor={actor} eventId={eventId} councilIds={context.data.councilIds} reasons={context.data.reasons} onChange={change} />
                ) : null}
              </Td>
            </tr>
          ))}
          {rows.length > 0 ? (
            <tr>
              <Td className="font-bold" colSpan={3}>
                Total ({rows.length} {rows.length === 1 ? 'signup' : 'signups'})
              </Td>
              <Td className="font-bold">{formatHours(total)}</Td>
              <Td />
            </tr>
          ) : null}
        </Table>
      )}
    </Panel>
  );
}

// ---- the selected event ------------------------------------------------------

function EventLedger({ eventId, onSaved }: { eventId: number; onSaved: () => void }) {
  const event = useLoad(() => db.events.get(eventId), [eventId]);
  const categories = useLoad(() => db.lookups.list('LessonsLearnedCategory'), []);
  const failure = event.error ?? categories.error;
  if (failure) return <Notice tone="error">{failure}</Notice>;
  if (event.data === undefined || !categories.data) return <p className="text-sm text-muted">Loading the event…</p>;
  if (event.data === null) return <Notice tone="error">That event no longer exists.</Notice>;
  return (
    <div className="flex flex-col gap-4">
      <Panel title={event.data.EventName}>
        <p className="text-sm">
          {formatDate(event.data.StartDate)}
          {event.data.EndDate !== event.data.StartDate ? ` – ${formatDate(event.data.EndDate)}` : ''} · {event.data.Location}
        </p>
      </Panel>
      <ResultsForm
        event={event.data}
        onSaved={() => {
          void event.reload();
          onSaved();
        }}
      />
      <TurnoutPanel eventId={eventId} />
      <LessonsPanel eventId={eventId} categories={categories.data} onChanged={onSaved} />
    </div>
  );
}

// ---- the page ----------------------------------------------------------------

type LedgerTab = 'queue' | 'archive';

function Ledger() {
  const user = useUser();
  const scope = useCouncilScope();
  const [selected, setSelected] = useState<number | null>(null);
  const [tab, setTab] = useState<LedgerTab>('queue');
  const today = toIsoDate(new Date());

  // Only events that have started and that this member may record for, each marked with whether
  // anything has been recorded yet (hasLedgerResults, which also counts lessons learned).
  const events = useLoad(async () => {
    const all = (await db.events.listByCouncil(scope.councilId)).filter((e) => e.StartDate <= today);
    const allowed = await Promise.all(all.map(async (e) => canRecordLedger(user, e, await db.events.listCouncilIds(e.id))));
    const mine = all.filter((_, i) => allowed[i]);
    const lessons = await Promise.all(mine.map((e) => db.lessonsLearned.list(e.id)));
    return mine.map((event, i) => ({ event, recorded: hasLedgerResults(event, lessons[i].length) }));
  }, [scope.councilId, today, user.memberId]);

  const queue = (events.data ?? []).filter((e) => !e.recorded);
  const archive = (events.data ?? []).filter((e) => e.recorded);
  const shown = tab === 'queue' ? queue : archive;

  // Keep the open event's tab in view: once its results are saved it moves to the archive, and back to
  // the queue if everything is cleared.
  const selectedRecorded = events.data?.find((e) => e.event.id === selected)?.recorded;
  useEffect(() => {
    if (selectedRecorded !== undefined) setTab(selectedRecorded ? 'archive' : 'queue');
  }, [selectedRecorded]);

  return (
    <>
      <PageTitle actions={<CouncilSelect scope={scope} />}>Post-event ledger</PageTitle>
      <div className="grid grid-cols-[20rem_minmax(0,1fr)] items-start gap-4">
        <Panel title="Events">
          <Tabs
            tabs={[
              { id: 'queue', label: `Active queue (${queue.length})` },
              { id: 'archive', label: `Historic archive (${archive.length})` },
            ]}
            value={tab}
            onChange={setTab}
            label="Ledger events"
            idPrefix="ledger"
          />
          <div id="ledger-panel" role="tabpanel" aria-labelledby={`ledger-tab-${tab}`} className="flex flex-col gap-2 pt-3">
            {events.error ? <Notice tone="error">{events.error}</Notice> : null}
            {events.data && shown.length === 0 ? (
              <Empty>{tab === 'queue' ? 'No events are waiting for results.' : 'No events have recorded results yet.'}</Empty>
            ) : null}
            <ul className="flex flex-col gap-1">
              {shown.map(({ event: e, recorded }: { event: Event; recorded: boolean }) => (
                <li key={e.id}>
                  <button
                    type="button"
                    aria-current={selected === e.id ? 'true' : undefined}
                    onClick={() => setSelected(e.id)}
                    className={cx('block w-full border-l-8 px-3 py-2 text-left', selected === e.id ? 'border-gold bg-white outline outline-1 outline-line' : 'border-transparent hover:underline')}
                  >
                    <span className="block text-sm font-bold">{e.EventName}</span>
                    <span className="block text-xs text-muted">{formatDate(e.EndDate)}</span>
                    <span className="mt-1 block">{recorded ? <Pill tone="outline">Recorded</Pill> : <Pill tone="gold">Results needed</Pill>}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </Panel>
        <div>
          {selected === null ? (
            <Empty>Choose an event on the left to record its results.</Empty>
          ) : (
            <EventLedger key={selected} eventId={selected} onSaved={() => void events.reload()} />
          )}
        </div>
      </div>
    </>
  );
}

export default function LedgerPage() {
  return (
    <RequireArea area="ledger">
      <Ledger />
    </RequireArea>
  );
}
