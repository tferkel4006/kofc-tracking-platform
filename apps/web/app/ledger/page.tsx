'use client';
// Post-event ledger: after an event has started, record what it really cost and raised, how many people
// came, the highlights, and the lessons learned. Admins do this for their councils' events; the event's
// owner may too (canRecordLedger), which is why every role sees this section.
import { useState } from 'react';
import {
  canRecordLedger,
  describeError,
  formatDate,
  toIsoDate,
  type Event,
  type EventChanges,
  type LessonsLearnedCategory,
} from '@kofc/shared';
import { CouncilSelect, RequireArea, useCouncilScope } from '@/components/CouncilScope';
import { Button, cx, Empty, Field, Input, Notice, PageTitle, Panel, Pill, Select, Table, Td, Textarea } from '@/components/ui';
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
        'FundsRaised-Cash': parseNumberField(cash, 'Cash funds raised'),
        'FundsRaised-Electronic': parseNumberField(electronic, 'Electronic funds raised'),
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
        <Field label="Cash raised ($)">
          {(id) => <Input id={id} inputMode="decimal" value={cash} onChange={(e) => setCash(e.target.value)} placeholder="0.00" />}
        </Field>
        <Field label="Electronic raised ($)">
          {(id) => <Input id={id} inputMode="decimal" value={electronic} onChange={(e) => setElectronic(e.target.value)} placeholder="0.00" />}
        </Field>
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

function LessonsPanel({ eventId, categories }: { eventId: number; categories: LessonsLearnedCategory[] }) {
  const lessons = useLoad(() => db.lessonsLearned.list(eventId), [eventId]);
  const { message, setMessage, run } = useAction();
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? 0);
  const [text, setText] = useState('');
  const label = new Map(categories.map((c) => [c.id, c.LessonsLearnedCategory]));

  const change = async (action: () => Promise<void>, done: string) => {
    if (await run(action, done)) await lessons.reload();
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
                  if (e.key === 'Enter') void change(async () => { await db.lessonsLearned.add(eventId, categoryId, text); setText(''); }, 'Lesson added.');
                }}
              />
            )}
          </Field>
          <Button onClick={() => void change(async () => { await db.lessonsLearned.add(eventId, categoryId, text); setText(''); }, 'Lesson added.')}>Add lesson</Button>
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
                  <Button size="sm" variant="secondary" onClick={() => void change(() => db.lessonsLearned.remove(l.id), 'Lesson removed.')}>
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
      <LessonsPanel eventId={eventId} categories={categories.data} />
    </div>
  );
}

// ---- the page ----------------------------------------------------------------

function Ledger() {
  const user = useUser();
  const scope = useCouncilScope();
  const [selected, setSelected] = useState<number | null>(null);
  const today = toIsoDate(new Date());

  // Only events that have started and that this member may record for.
  const events = useLoad(async () => {
    const all = (await db.events.listByCouncil(scope.councilId)).filter((e) => e.StartDate <= today);
    const allowed = await Promise.all(all.map(async (e) => canRecordLedger(user, e, await db.events.listCouncilIds(e.id))));
    return all.filter((_, i) => allowed[i]);
  }, [scope.councilId, today, user.memberId]);

  return (
    <>
      <PageTitle actions={<CouncilSelect scope={scope} />}>Post-event ledger</PageTitle>
      <div className="grid grid-cols-[20rem_minmax(0,1fr)] items-start gap-4">
        <Panel title="Events">
          {events.error ? <Notice tone="error">{events.error}</Notice> : null}
          {events.data?.length === 0 ? <Empty>No events you can record results for have started yet.</Empty> : null}
          <ul className="flex flex-col gap-1">
            {(events.data ?? []).map((e: Event) => (
              <li key={e.id}>
                <button
                  type="button"
                  aria-current={selected === e.id ? 'true' : undefined}
                  onClick={() => setSelected(e.id)}
                  className={cx('block w-full border-l-8 px-3 py-2 text-left', selected === e.id ? 'border-gold bg-white outline outline-1 outline-line' : 'border-transparent hover:underline')}
                >
                  <span className="block text-sm font-bold">{e.EventName}</span>
                  <span className="block text-xs text-muted">{formatDate(e.EndDate)}</span>
                  <span className="mt-1 block">
                    {e.Spend == null && e['FundsRaised-Cash'] == null && e['FundsRaised-Electronic'] == null ? <Pill tone="gold">Results needed</Pill> : <Pill tone="outline">Recorded</Pill>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
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
