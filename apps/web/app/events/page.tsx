'use client';
// Event planner: a split screen. The council's events are on the left, newest first; the selected event
// opens on the right with its details, the councils it is shared with, its shifts and a "copy as a twin"
// action. Admins plan for their own council, Super Admins pick any council.
import { useState } from 'react';
import {
  describeError,
  formatDate,
  formatTimeRange,
  isUrgent,
  shiftStatus,
  type Category,
  type Council,
  type Event,
  type EventChanges,
  type Member,
  type NewEvent,
  type Shift,
} from '@kofc/shared';
import { CouncilSelect, RequireArea, useCouncilScope } from '@/components/CouncilScope';
import { Button, cx, Empty, Field, Input, Notice, PageTitle, Panel, Pill, Select, Table, Td, Textarea } from '@/components/ui';
import { formatMoney, parseNumberField, toField } from '@/lib/format';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

type Message = { tone: 'error' | 'info'; text: string };

/** Runs a save, reports the outcome in one place and returns whether it worked. */
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

// ---- event details -----------------------------------------------------------

function EventForm({
  event,
  linkedCouncilIds,
  councilId,
  councils,
  categories,
  owners,
  onSaved,
}: {
  event: Event | null;
  linkedCouncilIds: number[];
  councilId: number;
  councils: Council[];
  categories: Category[];
  owners: Member[];
  onSaved: (id: number) => void;
}) {
  const user = useUser();
  const { message, setMessage, run } = useAction();
  const [name, setName] = useState(event?.EventName ?? '');
  const [description, setDescription] = useState(event?.EventDescription ?? '');
  const [location, setLocation] = useState(event?.Location ?? '');
  const [startDate, setStartDate] = useState(event?.StartDate ?? '');
  const [endDate, setEndDate] = useState(event?.EndDate ?? '');
  const [categoryId, setCategoryId] = useState(event?.CategoryID ?? categories[0]?.id ?? 0);
  const [ownerId, setOwnerId] = useState(event?.OwnerID ?? (owners.some((o) => o.id === user.memberId) ? user.memberId : (owners[0]?.id ?? 0)));
  const [budget, setBudget] = useState(toField(event?.Budget));
  const [planned, setPlanned] = useState(toField(event?.PlannedNumberAttendees));
  const [linked, setLinked] = useState<number[]>(event ? linkedCouncilIds : [councilId]);

  const toggleCouncil = (id: number) => setLinked((now) => (now.includes(id) ? now.filter((c) => c !== id) : [...now, id]));

  const save = () =>
    run(async () => {
      const budgetValue = parseNumberField(budget, 'Budget');
      const plannedValue = parseNumberField(planned, 'Planned attendees');
      if (event) {
        const changes: EventChanges = {
          EventName: name,
          EventDescription: description,
          Location: location,
          StartDate: startDate,
          EndDate: endDate,
          CategoryID: categoryId,
          OwnerID: ownerId,
          Budget: budgetValue,
          PlannedNumberAttendees: plannedValue,
        };
        await db.events.update(event.id, changes);
        await db.events.setCouncils(event.id, linked);
        onSaved(event.id);
      } else {
        const created: NewEvent = {
          EventName: name,
          EventDescription: description,
          Location: location,
          StartDate: startDate,
          EndDate: endDate,
          CategoryID: categoryId,
          OwnerID: ownerId,
        };
        if (budgetValue !== null) created.Budget = budgetValue;
        if (plannedValue !== null) created.PlannedNumberAttendees = plannedValue;
        onSaved((await db.events.create(created, linked)).id);
      }
    }, event ? 'Event saved.' : 'Event created. Add its shifts below.');

  return (
    <Panel title={event ? 'Event details' : 'New event'}>
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
        <Field label="Event name" className="col-span-2">
          {(id) => <Input id={id} value={name} maxLength={100} onChange={(e) => setName(e.target.value)} required />}
        </Field>
        <Field label="Description" className="col-span-2">
          {(id) => <Textarea id={id} value={description} maxLength={255} onChange={(e) => setDescription(e.target.value)} />}
        </Field>
        <Field label="Starts">{(id) => <Input id={id} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />}</Field>
        <Field label="Ends">{(id) => <Input id={id} type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />}</Field>
        <Field label="Location" className="col-span-2">
          {(id) => <Input id={id} value={location} maxLength={255} onChange={(e) => setLocation(e.target.value)} required />}
        </Field>
        <Field label="Category">
          {(id) => (
            <Select id={id} value={categoryId} onChange={(e) => setCategoryId(Number(e.target.value))}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.Category}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Owner" hint="The owner may also record the post-event results.">
          {(id) => (
            <Select id={id} value={ownerId} onChange={(e) => setOwnerId(Number(e.target.value))}>
              {owners.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.MemberLastName}, {m.MemberFirstName}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Budget ($)">
          {(id) => <Input id={id} inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="0.00" />}
        </Field>
        <Field label="Planned attendees">
          {(id) => <Input id={id} inputMode="numeric" value={planned} onChange={(e) => setPlanned(e.target.value)} />}
        </Field>
        <fieldset className="col-span-2 flex flex-col gap-1">
          <legend className="text-xs font-bold uppercase tracking-wide">Councils sharing this event</legend>
          <div className="flex flex-wrap gap-x-6 gap-y-1">
            {councils.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={linked.includes(c.id)} onChange={() => toggleCouncil(c.id)} />
                {c.CouncilNumber} – {c.CouncilName}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="col-span-2">
          <Button type="submit">{event ? 'Save event' : 'Create event'}</Button>
        </div>
      </form>
    </Panel>
  );
}

// ---- shifts ------------------------------------------------------------------

interface ShiftDraft {
  name: string;
  description: string;
  date: string;
  start: string;
  end: string;
  needed: string;
}

const blankShift = (event: Event): ShiftDraft => ({ name: '', description: '', date: event.StartDate, start: '09:00', end: '12:00', needed: '4' });
const draftOf = (s: Shift): ShiftDraft => ({
  name: s.ShiftName,
  description: s.ShiftDescription,
  date: s.ShiftDate,
  start: s.StartTime.slice(0, 5),
  end: s.EndTime.slice(0, 5),
  needed: String(s.MinNumberVolunteers),
});

function ShiftCells({ draft, set, label }: { draft: ShiftDraft; set: (d: ShiftDraft) => void; label: string }) {
  return (
    <>
      <Td>
        <Input aria-label={`${label} name`} value={draft.name} maxLength={100} onChange={(e) => set({ ...draft, name: e.target.value })} />
      </Td>
      <Td>
        <Input aria-label={`${label} date`} type="date" value={draft.date} onChange={(e) => set({ ...draft, date: e.target.value })} />
      </Td>
      <Td>
        <div className="flex items-center gap-1">
          <Input aria-label={`${label} start time`} type="time" value={draft.start} onChange={(e) => set({ ...draft, start: e.target.value })} />
          <span aria-hidden="true">–</span>
          <Input aria-label={`${label} end time`} type="time" value={draft.end} onChange={(e) => set({ ...draft, end: e.target.value })} />
        </div>
      </Td>
      <Td>
        <Input aria-label={`${label} volunteers needed`} className="w-20" inputMode="numeric" value={draft.needed} onChange={(e) => set({ ...draft, needed: e.target.value })} />
      </Td>
    </>
  );
}

function ShiftsPanel({ event }: { event: Event }) {
  const shifts = useLoad(() => db.events.listShifts(event.id), [event.id]);
  const { message, setMessage, run } = useAction();
  const [adding, setAdding] = useState<ShiftDraft>(() => blankShift(event));
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<ShiftDraft>(() => blankShift(event));
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const today = new Date();

  const fields = (d: ShiftDraft) => ({
    ShiftName: d.name,
    ShiftDescription: d.description,
    ShiftDate: d.date,
    StartTime: d.start,
    EndTime: d.end,
    MinNumberVolunteers: parseNumberField(d.needed, 'Volunteers needed') as number,
  });

  const after = async (ok: boolean) => {
    if (ok) await shifts.reload();
    return ok;
  };

  const add = async () => {
    const ok = await after(await run(async () => void (await db.events.createShift({ ...fields(adding), EventID: event.id })), 'Shift added.'));
    if (ok) setAdding(blankShift(event));
  };
  const save = async (id: number) => {
    if (await after(await run(async () => void (await db.events.updateShift(id, fields(draft))), 'Shift saved.'))) setEditingId(null);
  };
  const remove = async (id: number) => {
    if (await after(await run(() => db.events.deleteShift(id), 'Shift deleted.'))) setConfirmId(null);
  };

  return (
    <Panel title="Shifts">
      <div className="flex flex-col gap-3">
        <Banner message={message} onDismiss={() => setMessage(null)} />
        {shifts.error ? <Notice tone="error">{shifts.error}</Notice> : null}
        <Table caption={`Shifts for ${event.EventName}`} head={['Shift', 'Date', 'Time', 'Needed', 'Signed up', 'Status', 'Actions']}>
          <tr>
            <ShiftCells draft={adding} set={setAdding} label="New shift" />
            <Td />
            <Td />
            <Td>
              <Button size="sm" onClick={() => void add()}>
                Add shift
              </Button>
            </Td>
          </tr>
          {(shifts.data ?? []).map((s) => {
            const editing = editingId === s.id;
            const { status, remaining } = shiftStatus(s, today);
            return (
              <tr key={s.id} className={cx(editing && 'outline outline-2 -outline-offset-2 outline-gold')}>
                {editing ? (
                  <ShiftCells draft={draft} set={setDraft} label={s.ShiftName} />
                ) : (
                  <>
                    <Td>{s.ShiftName}</Td>
                    <Td>{formatDate(s.ShiftDate)}</Td>
                    <Td>{formatTimeRange(s.StartTime, s.EndTime)}</Td>
                    <Td>{s.MinNumberVolunteers}</Td>
                  </>
                )}
                <Td>{s.NumberVolunteersSignedUp}</Td>
                <Td>
                  {status === 'locked' ? (
                    <Pill tone="navy">Full</Pill>
                  ) : isUrgent(s.ShiftDate, today) ? (
                    <Pill tone="red">Needs {remaining} soon</Pill>
                  ) : status === 'priority' ? (
                    <Pill tone="gold">Needs {remaining}</Pill>
                  ) : (
                    <Pill tone="outline">Needs {remaining}</Pill>
                  )}
                </Td>
                <Td>
                  <div className="flex gap-2">
                    {editing ? (
                      <>
                        <Button size="sm" onClick={() => void save(s.id)}>
                          Save
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => setEditingId(null)}>
                          Cancel
                        </Button>
                      </>
                    ) : confirmId === s.id ? (
                      <>
                        <Button size="sm" variant="danger" onClick={() => void remove(s.id)}>
                          Confirm delete
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => setConfirmId(null)}>
                          Keep
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setEditingId(s.id);
                            setDraft(draftOf(s));
                          }}
                        >
                          Edit
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => setConfirmId(s.id)}>
                          Delete
                        </Button>
                      </>
                    )}
                  </div>
                </Td>
              </tr>
            );
          })}
        </Table>
        {shifts.data?.length === 0 ? <Empty>No shifts yet. Add the first one above; its date must fall inside the event.</Empty> : null}
      </div>
    </Panel>
  );
}

// ---- copy as a twin ----------------------------------------------------------

function CopyPanel({ event, onCopied }: { event: Event; onCopied: (id: number) => void }) {
  const { message, setMessage, run } = useAction();
  const [startDate, setStartDate] = useState('');
  const [name, setName] = useState(event.EventName);

  const copy = async () => {
    let id = 0;
    const ok = await run(async () => {
      id = (await db.events.copy(event.id, { startDate, eventName: name })).id;
    }, 'Copied. The twin is open on the right.');
    if (ok) onCopied(id);
  };

  return (
    <Panel title="Copy as a twin">
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted">
          Makes a new event with the same details, councils and shifts, moved to a new first day. Signups, hours and post-event results are not copied.
        </p>
        <Banner message={message} onDismiss={() => setMessage(null)} />
        <div className="flex flex-wrap items-end gap-4">
          <Field label="New event name" className="w-72">
            {(id) => <Input id={id} value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />}
          </Field>
          <Field label="New first day">{(id) => <Input id={id} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />}</Field>
          <Button variant="secondary" onClick={() => void copy()}>
            Copy event
          </Button>
        </div>
      </div>
    </Panel>
  );
}

// ---- the selected event ------------------------------------------------------

function EventEditor({
  eventId,
  councilId,
  councils,
  onSaved,
}: {
  eventId: number | null;
  councilId: number;
  councils: Council[];
  onSaved: (id: number) => void;
}) {
  const event = useLoad(() => (eventId === null ? Promise.resolve(null) : db.events.get(eventId)), [eventId]);
  const linked = useLoad(() => (eventId === null ? Promise.resolve([councilId]) : db.events.listCouncilIds(eventId)), [eventId, councilId]);
  const categories = useLoad(() => db.lookups.list('Category'), []);
  const owners = useLoad(() => db.members.listByCouncil(councilId), [councilId]);
  const affiliated = useLoad(() => db.councils.listAffiliated(councilId), [councilId]);

  const failure = event.error ?? linked.error ?? categories.error ?? owners.error ?? affiliated.error;
  if (failure) return <Notice tone="error">{failure}</Notice>;
  if (event.data === undefined || linked.data === undefined || !categories.data || !owners.data || !affiliated.data) {
    return <p className="text-sm text-muted">Loading the event…</p>;
  }
  if (eventId !== null && event.data === null) return <Notice tone="error">That event no longer exists.</Notice>;

  // A council can share an event when it is this council, one affiliated with it, or already linked.
  const allowed = new Set([councilId, ...affiliated.data.map((c) => c.id), ...linked.data]);
  const choices = councils.filter((c) => allowed.has(c.id));

  return (
    <div className="flex flex-col gap-4">
      <EventForm
        event={event.data}
        linkedCouncilIds={linked.data}
        councilId={councilId}
        councils={choices}
        categories={categories.data}
        owners={owners.data}
        onSaved={onSaved}
      />
      {event.data ? (
        <>
          <ShiftsPanel event={event.data} />
          <CopyPanel event={event.data} onCopied={onSaved} />
        </>
      ) : null}
    </div>
  );
}

// ---- the page ----------------------------------------------------------------

function Planner() {
  const scope = useCouncilScope();
  const [selected, setSelected] = useState<number | 'new' | null>(null);
  const events = useLoad(() => db.events.listByCouncil(scope.councilId), [scope.councilId]);

  const open = async (id: number) => {
    await events.reload();
    setSelected(id);
  };

  return (
    <>
      <PageTitle actions={<CouncilSelect scope={scope} />}>Event planner</PageTitle>
      <div className="grid grid-cols-[20rem_minmax(0,1fr)] items-start gap-4">
        <Panel title="Events" actions={<Button size="sm" onClick={() => setSelected('new')}>New event</Button>}>
          {events.error ? <Notice tone="error">{events.error}</Notice> : null}
          {events.data?.length === 0 ? <Empty>No events yet for this council.</Empty> : null}
          <ul className="flex flex-col gap-1">
            {(events.data ?? []).map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  aria-current={selected === e.id ? 'true' : undefined}
                  onClick={() => setSelected(e.id)}
                  className={cx('block w-full border-l-8 px-3 py-2 text-left', selected === e.id ? 'border-gold bg-white outline outline-1 outline-line' : 'border-transparent hover:underline')}
                >
                  <span className="block text-sm font-bold">{e.EventName}</span>
                  <span className="block text-xs text-muted">
                    {e.StartDate === e.EndDate ? formatDate(e.StartDate) : `${formatDate(e.StartDate)} – ${formatDate(e.EndDate)}`} · {e.Location}
                  </span>
                  {e.Budget != null ? <span className="block text-xs text-muted">Budget {formatMoney(e.Budget)}</span> : null}
                </button>
              </li>
            ))}
          </ul>
        </Panel>
        <div>
          {selected === null ? (
            <Empty>Choose an event on the left, or start a new one.</Empty>
          ) : (
            <EventEditor
              key={String(selected)}
              eventId={selected === 'new' ? null : selected}
              councilId={scope.councilId}
              councils={scope.councils}
              onSaved={(id) => void open(id)}
            />
          )}
        </div>
      </div>
    </>
  );
}

export default function EventsPage() {
  return (
    <RequireArea area="events">
      <Planner />
    </RequireArea>
  );
}
