'use client';
// Event planner: a split screen. The council's events are on the left, newest first; the selected event
// opens on the right with its details, the councils it is shared with, its shifts and a "copy as a twin"
// action. Admins plan for their own council, Super Admins pick any council.
// Sprint 6I: the manual Budget field is gone with Event.Budget (schema 47); an event's budget is its line in the
// council's annual budget (/budget).
// Sprint 6L Extension 4: the Local Category picker shows the category's fixed Supreme Mission Area as a read-only badge.
// Sprint 6P: an All-Hands shift has no volunteer target at all (stored as 0) and shows an open-ended count, and the
// Planning Hours panel logs preparation time before the event's first day (events.logPlanningTime).
import { useState } from 'react';
import {
  canLogPlanningTime,
  describeError,
  formatDate,
  formatHours,
  formatTimeRange,
  isAllHandsShift,
  PLANNING_NOTES_MAX_LENGTH,
  isUrgent,
  shiftStatus,
  withNewMemberBadge,
  type Category,
  type Council,
  type Event,
  type EventChanges,
  type Member,
  type NewEvent,
  type Shift,
} from '@kofc/shared';
import { CouncilSelect, RequireArea, useCouncilScope } from '@/components/CouncilScope';
import { LocalCategoryField } from '@/components/MissionCategoryParts';
import { Button, cx, Empty, Field, Input, Notice, PageTitle, Panel, Pill, Select, Table, Td, Textarea } from '@/components/ui';
import { parseNumberField, toField } from '@/lib/format';
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
  const [planned, setPlanned] = useState(toField(event?.PlannedNumberAttendees));
  const [linked, setLinked] = useState<number[]>(event ? linkedCouncilIds : [councilId]);
  const [annual, setAnnual] = useState(event?.IsAnnual === 1);
  // Sprint 5Y-6: a one-day event hides its End date and ends the day it starts. An older event already spanning days
  // opens with the box ticked so its End date is not lost.
  const [multiDay, setMultiDay] = useState(event ? event.IsMultiDay === 1 || event.StartDate !== event.EndDate : false);
  const lastDay = multiDay ? endDate : startDate;

  const toggleCouncil = (id: number) => setLinked((now) => (now.includes(id) ? now.filter((c) => c !== id) : [...now, id]));

  const save = () =>
    run(async () => {
      const plannedValue = parseNumberField(planned, 'Planned attendees');
      if (event) {
        const changes: EventChanges = {
          EventName: name,
          EventDescription: description,
          Location: location,
          StartDate: startDate,
          EndDate: lastDay,
          CategoryID: categoryId,
          OwnerID: ownerId,
          PlannedNumberAttendees: plannedValue,
          IsAnnual: annual ? 1 : 0,
          IsMultiDay: multiDay ? 1 : 0,
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
          EndDate: lastDay,
          CategoryID: categoryId,
          OwnerID: ownerId,
          IsAnnual: annual ? 1 : 0,
          IsMultiDay: multiDay ? 1 : 0,
        };
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
        <Field label={multiDay ? 'Starts' : 'Date'}>
          {(id) => <Input id={id} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />}
        </Field>
        <label className="flex items-center gap-2 self-end pb-2 text-sm">
          <input
            type="checkbox"
            className="size-4"
            checked={multiDay}
            onChange={(e) => {
              setMultiDay(e.target.checked);
              if (e.target.checked && endDate <= startDate) setEndDate('');
            }}
          />
          <span>
            <span className="font-bold">Multi-Day Assembly / Extended Event</span>
            <span className="block text-xs text-muted">Unticked, the event is one day and ends the day it starts.</span>
          </span>
        </label>
        {multiDay ? (
          <Field label="Ends" className="col-span-2 sm:col-span-1">
            {(id) => <Input id={id} type="date" value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} required />}
          </Field>
        ) : null}
        <Field label="Location" className="col-span-2">
          {(id) => <Input id={id} value={location} maxLength={255} onChange={(e) => setLocation(e.target.value)} required />}
        </Field>
        <LocalCategoryField className="col-span-2" categories={categories} value={categoryId} required onChange={(id) => setCategoryId(id ?? 0)} />
        <Field label="Owner" hint="The owner may also record the post-event results.">
          {(id) => (
            <Select id={id} value={ownerId} onChange={(e) => setOwnerId(Number(e.target.value))}>
              {owners.map((m) => (
                <option key={m.id} value={m.id}>
                  {withNewMemberBadge(`${m.MemberLastName}, ${m.MemberFirstName}`, m, new Date())}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Planned attendees">
          {(id) => <Input id={id} inputMode="numeric" value={planned} onChange={(e) => setPlanned(e.target.value)} />}
        </Field>
        <label className="col-span-2 flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-0.5 size-4" checked={annual} onChange={(e) => setAnnual(e.target.checked)} />
          <span>
            <span className="font-bold">Is Annual</span>
            <span className="block text-xs text-muted">
              A budgeting tag only: when next year's budget is drafted (May 1 - June 30), the Annual Budget Projections read this event&apos;s actual spend. It does not copy the event or add future dates.
            </span>
          </span>
        </label>
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
  /** Phase 4.5: an All-Hands shift has no volunteer cap (Shift.IsAllHands). */
  allHands: boolean;
}

const blankShift = (event: Event): ShiftDraft => ({ name: '', description: '', date: event.StartDate, start: '09:00', end: '12:00', needed: '4', allHands: false });
const draftOf = (s: Shift): ShiftDraft => ({
  name: s.ShiftName,
  description: s.ShiftDescription,
  date: s.ShiftDate,
  start: s.StartTime.slice(0, 5),
  end: s.EndTime.slice(0, 5),
  // Sprint 6P: an All-Hands shift stores no target (0), so turning All-Hands off starts from the usual 4.
  needed: s.MinNumberVolunteers > 0 ? String(s.MinNumberVolunteers) : '4',
  allHands: isAllHandsShift(s),
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
        <div className="flex flex-col gap-1">
          {draft.allHands ? (
            <span className="text-sm font-bold">No cap</span>
          ) : (
            <Input aria-label={`${label} volunteers needed`} className="w-20" inputMode="numeric" value={draft.needed} onChange={(e) => set({ ...draft, needed: e.target.value })} />
          )}
          <label className="flex items-center gap-1.5 text-xs font-bold">
            <input type="checkbox" aria-label={`${label} is an All-Hands shift`} checked={draft.allHands} onChange={(e) => set({ ...draft, allHands: e.target.checked })} />
            All hands
          </label>
        </div>
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
    // Sprint 6P: an All-Hands shift has no numeric target; the drivers store 0 whatever is sent.
    MinNumberVolunteers: d.allHands ? 0 : (parseNumberField(d.needed, 'Volunteers needed') as number),
    IsAllHands: d.allHands ? 1 : 0,
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
                    <Td>{isAllHandsShift(s) ? 'All hands' : s.MinNumberVolunteers}</Td>
                  </>
                )}
                <Td>{isAllHandsShift(s) ? `${s.NumberVolunteersSignedUp} joined · open-ended` : s.NumberVolunteersSignedUp}</Td>
                <Td>
                  {isAllHandsShift(s) ? (
                    <Pill tone="outline">All hands · no cap</Pill>
                  ) : status === 'locked' ? (
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

// ---- planning hours (Sprint 6P) ----------------------------------------------

function PlanningHoursPanel({ event, councilIds }: { event: Event; councilIds: number[] }) {
  const user = useUser();
  const log = useLoad(() => db.events.listPlanningTime(event.id), [event.id]);
  const { message, setMessage, run } = useAction();
  const [date, setDate] = useState('');
  const [hours, setHours] = useState('1');
  const [notes, setNotes] = useState('');
  const mayLog = canLogPlanningTime(user, event, councilIds);

  const add = async () => {
    const ok = await run(async () => {
      await db.events.logPlanningTime(user.memberId, event.id, { planningDate: date, hours: Number(hours), notes });
    }, 'Planning Hours logged.');
    if (ok) {
      setNotes('');
      await log.reload();
    }
  };
  const remove = async (id: number) => {
    if (await run(() => db.events.deletePlanningTime(user.memberId, id), 'Entry deleted.')) await log.reload();
  };

  return (
    <Panel title="Planning Hours" actions={log.data ? <Pill tone="outline">{formatHours(log.data.totalHours)} total</Pill> : undefined}>
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted">
          Time spent preparing this event before {formatDate(event.StartDate)}: meetings, buying supplies, making flyers. These hours are kept apart
          from shift hours.
        </p>
        <Banner message={message} onDismiss={() => setMessage(null)} />
        {log.error ? <Notice tone="error">{log.error}</Notice> : null}
        {mayLog ? (
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Planning date">{(id) => <Input id={id} type="date" value={date} max={event.StartDate} onChange={(e) => setDate(e.target.value)} />}</Field>
            <Field label="Hours">
              {(id) => <Input id={id} className="w-24" type="number" min={0.25} max={24} step={0.25} value={hours} onChange={(e) => setHours(e.target.value)} />}
            </Field>
            <Field label="What you did" className="min-w-64 flex-1">
              {(id) => <Input id={id} value={notes} maxLength={PLANNING_NOTES_MAX_LENGTH} onChange={(e) => setNotes(e.target.value)} />}
            </Field>
            <Button onClick={() => void add()} disabled={!date}>
              Log hours
            </Button>
          </div>
        ) : null}
        {log.data && log.data.entries.length > 0 ? (
          <Table caption={`Planning Hours for ${event.EventName}`} head={['Date', 'Member', 'Hours', 'Notes', '']}>
            {log.data.entries.map((e) => (
              <tr key={e.id}>
                <Td>{formatDate(e.planning_date)}</Td>
                <Td>{e.memberName}</Td>
                <Td>{formatHours(e.hours)}</Td>
                <Td>{e.notes ?? ''}</Td>
                <Td>
                  {/* assertMayDeletePlanningTime: the author, an Admin of a linked council, or a Super Admin. */}
                  {(e.member_id === user.memberId && mayLog) ||
                  user.memberType === 'Super Admin' ||
                  (user.memberType === 'Admin' && councilIds.includes(user.councilId)) ? (
                    <Button size="sm" variant="secondary" onClick={() => void remove(e.id)}>
                      Delete
                    </Button>
                  ) : null}
                </Td>
              </tr>
            ))}
          </Table>
        ) : log.data ? (
          <Empty>No Planning Hours logged yet.</Empty>
        ) : null}
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
          <PlanningHoursPanel event={event.data} councilIds={linked.data} />
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
