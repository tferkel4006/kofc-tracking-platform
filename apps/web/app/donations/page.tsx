'use client';
// Donations: the council's donation log. Standalone donations are listed newest first; donations to events are
// collated into one summary block per event (choose a block to see its donations). A form records a new donation
// from the desktop with any method the council has enabled. Open to the council's Admins, its Financial Secretary
// and Treasurer, and any Super Admin (canManageFinances). A donation can be corrected or deleted by those people,
// by the member who recorded it and by its event's owner; the drivers enforce the same rule, and every write
// re-totals the event's FundsRaised columns, so the post-event ledger always matches the donations.
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  canChangeDonation,
  canManageFinances,
  describeError,
  toIsoDate,
  type CouncilDonationOption,
  type Donation,
  type DonationHistoryEntry,
  type DonationType,
  type Event,
  type NewDonation,
} from '@kofc/shared';
import { CouncilSelect, RequireArea, useCouncilScope } from '@/components/CouncilScope';
import { Drawer } from '@/components/Drawer';
import { Button, cx, Empty, Field, Input, Notice, PageTitle, Panel, Pill, Select, Table, Td, Textarea } from '@/components/ui';
import { formatFullDate, formatMoney, parseNumberField } from '@/lib/format';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

type Message = { tone: 'error' | 'info'; text: string };

interface FormDraft {
  DonationMethodID: string;
  DonationTypeID: string;
  DonationAmount: string;
  DonationDate: string;
  EventID: string;
  Donor: string;
  DonationDesciption: string;
  DonationPhotoURL: string;
}

const KIND_LABEL: Record<CouncilDonationOption['kind'], string> = {
  cash: 'Cash',
  card: 'Card',
  qr: 'Electronic (QR)',
  item: 'Physical items',
  other: 'Other',
};

function blankDraft(methods: CouncilDonationOption[], types: DonationType[], today: string): FormDraft {
  return {
    DonationMethodID: String(methods[0]?.method.id ?? ''),
    DonationTypeID: String(types[0]?.id ?? ''),
    DonationAmount: '',
    DonationDate: today,
    EventID: '',
    Donor: '',
    DonationDesciption: '',
    DonationPhotoURL: '',
  };
}

const draftFrom = (d: Donation): FormDraft => ({
  DonationMethodID: String(d.DonationMethodID),
  DonationTypeID: String(d.DonationTypeID),
  DonationAmount: String(d.DonationAmount),
  DonationDate: d.DonationDate,
  EventID: d.EventID == null ? '' : String(d.EventID),
  Donor: d.Donor ?? '',
  DonationDesciption: d.DonationDesciption ?? '',
  DonationPhotoURL: d.DonationPhotoURL ?? '',
});

/** The typed fields both `record` and `update` accept; the driver validates them again. */
function toFields(d: FormDraft): Omit<NewDonation, 'CouncilID'> & { DonationDate: string } {
  const amount = parseNumberField(d.DonationAmount, 'Amount');
  return {
    DonationMethodID: Number(d.DonationMethodID),
    DonationTypeID: Number(d.DonationTypeID),
    DonationAmount: amount ?? 0,
    DonationDate: d.DonationDate,
    EventID: d.EventID === '' ? null : Number(d.EventID),
    Donor: d.Donor.trim() || null,
    DonationDesciption: d.DonationDesciption.trim() || null,
    DonationPhotoURL: d.DonationPhotoURL.trim() || null,
  };
}

/** Record and correct share one form. Events are those of the council that have already started. */
function DonationForm({
  initial,
  methods,
  types,
  events,
  today,
  submitLabel,
  onSubmit,
}: {
  initial: FormDraft;
  methods: CouncilDonationOption[];
  types: DonationType[];
  events: Event[];
  today: string;
  submitLabel: string;
  /** Resolves to a confirmation, or throws a rule error to show. */
  onSubmit: (draft: FormDraft) => Promise<string>;
}) {
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  useEffect(() => setDraft(initial), [initial]);
  const set = (key: keyof FormDraft) => (value: string) => setDraft((d) => ({ ...d, [key]: value }));
  const kind = methods.find((m) => String(m.method.id) === draft.DonationMethodID)?.kind;
  const started = events.filter((e) => e.StartDate <= today);

  const submit = async () => {
    setBusy(true);
    setMessage(null);
    try {
      setMessage({ tone: 'info', text: await onSubmit(draft) });
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setBusy(false);
    }
  };

  if (methods.length === 0) {
    return <Empty>This council has not enabled any donation methods yet, so donations cannot be recorded.</Empty>;
  }
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      {message ? (
        <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
          {message.text}
        </Notice>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Method">
          {(id) => (
            <Select id={id} value={draft.DonationMethodID} onChange={(e) => set('DonationMethodID')(e.target.value)}>
              {methods.map((m) => (
                <option key={m.link.id} value={m.method.id}>
                  {m.method.DonationMethod} ({KIND_LABEL[m.kind]})
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Type">
          {(id) => (
            <Select id={id} value={draft.DonationTypeID} onChange={(e) => set('DonationTypeID')(e.target.value)}>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.DonationType}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={kind === 'item' ? 'Estimated value ($)' : 'Amount ($)'}>
          {(id) => <Input id={id} inputMode="decimal" required value={draft.DonationAmount} onChange={(e) => set('DonationAmount')(e.target.value)} />}
        </Field>
        <Field label="Date">
          {(id) => <Input id={id} type="date" required max={today} value={draft.DonationDate} onChange={(e) => set('DonationDate')(e.target.value)} />}
        </Field>
        <Field label="Event" className="col-span-2" hint="Leave as standalone for a donation not tied to an event.">
          {(id) => (
            <Select id={id} value={draft.EventID} onChange={(e) => set('EventID')(e.target.value)}>
              <option value="">Standalone (no event)</option>
              {started.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.EventName} – {formatFullDate(e.StartDate)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Donor (optional)" className="col-span-2">
          {(id) => <Input id={id} maxLength={100} value={draft.Donor} onChange={(e) => set('Donor')(e.target.value)} />}
        </Field>
        <Field label={kind === 'item' ? 'Description of the items' : 'Description (optional)'} className="col-span-2">
          {(id) => (
            <Textarea id={id} maxLength={255} required={kind === 'item'} value={draft.DonationDesciption} onChange={(e) => set('DonationDesciption')(e.target.value)} />
          )}
        </Field>
        <Field label="Photo link (optional)" className="col-span-2">
          {(id) => <Input id={id} type="url" maxLength={255} value={draft.DonationPhotoURL} onChange={(e) => set('DonationPhotoURL')(e.target.value)} />}
        </Field>
      </div>
      <div>
        <Button type="submit" disabled={busy}>
          {busy ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </form>
  );
}

/** Donation rows with per-row correct and two-step delete where the signed-in member has the right. */
function DonationTable({
  caption,
  entries,
  eventOwner,
  showEvent,
  eventName,
  onEdit,
  onDelete,
}: {
  caption: string;
  entries: DonationHistoryEntry[];
  eventOwner: (eventId: number | null | undefined) => number | null;
  showEvent: boolean;
  eventName: (eventId: number | null | undefined) => string;
  onEdit: (d: Donation) => void;
  onDelete: (d: Donation) => Promise<void>;
}) {
  const user = useUser();
  const [confirming, setConfirming] = useState<number | null>(null);
  const head = ['Date', 'Method', 'Type', ...(showEvent ? ['Event'] : []), 'Donor / description', 'Amount', 'Recorded by', ''];
  return (
    <Table caption={caption} head={head}>
      {entries.map(({ donation: d, methodName, kind, typeName, recordedByName }) => {
        const allowed = canChangeDonation(user, d, eventOwner(d.EventID));
        return (
          <tr key={d.id}>
            <Td className="whitespace-nowrap">{formatFullDate(d.DonationDate)}</Td>
            <Td>
              {methodName}
              {kind === 'item' ? (
                <>
                  {' '}
                  <Pill tone="outline">Item</Pill>
                </>
              ) : null}
            </Td>
            <Td>{typeName}</Td>
            {showEvent ? <Td>{eventName(d.EventID)}</Td> : null}
            <Td className="text-xs">
              {d.Donor ? <span className="font-bold">{d.Donor}</span> : null}
              {d.Donor && d.DonationDesciption ? <br /> : null}
              {d.DonationDesciption ?? (d.Donor ? null : '–')}
            </Td>
            <Td className="whitespace-nowrap text-right font-bold">{formatMoney(d.DonationAmount)}</Td>
            <Td className="text-xs">{recordedByName ?? '–'}</Td>
            <Td className="whitespace-nowrap text-right">
              {allowed ? (
                confirming === d.id ? (
                  <span className="flex justify-end gap-1">
                    <Button size="sm" variant="danger" onClick={() => void onDelete(d).finally(() => setConfirming(null))}>
                      Confirm delete
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setConfirming(null)}>
                      Keep
                    </Button>
                  </span>
                ) : (
                  <span className="flex justify-end gap-1">
                    <Button size="sm" variant="secondary" onClick={() => onEdit(d)}>
                      Correct
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setConfirming(d.id)}>
                      Delete
                    </Button>
                  </span>
                )
              ) : null}
            </Td>
          </tr>
        );
      })}
    </Table>
  );
}

function DonationsWorkspace() {
  const user = useUser();
  const scope = useCouncilScope();
  const councilId = scope.councilId;
  const today = toIsoDate(new Date());
  const setup = useLoad(async () => {
    const [methods, types, events] = await Promise.all([db.donations.listMethods(councilId), db.donations.listTypes(councilId), db.events.listByCouncil(councilId)]);
    return { methods, types, events };
  }, [councilId]);
  const history = useLoad(() => db.donations.listHistory(councilId), [councilId]);
  const [eventId, setEventId] = useState<number | null>(null);
  const eventHistory = useLoad(() => (eventId === null ? Promise.resolve(null) : db.donations.listHistory(councilId, eventId)), [councilId, eventId]);
  const [editing, setEditing] = useState<Donation | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  useEffect(() => setEventId(null), [councilId]);
  // Sprint 6L Extension: once the chosen event's donations load, bring its drill-down into view and move focus to its
  // heading, smoothly unless the viewer asked the system for reduced motion.
  const drillDown = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (eventId === null || !eventHistory.data || !drillDown.current) return;
    const reduced = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    drillDown.current.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    drillDown.current.querySelector<HTMLElement>('h3')?.focus({ preventScroll: true });
  }, [eventId, eventHistory.data]);
  // Stable drafts: DonationForm resets itself whenever `initial` changes identity.
  const blank = useMemo(() => (setup.data ? blankDraft(setup.data.methods, setup.data.types, today) : null), [setup.data, today]);
  const editDraft = useMemo(() => (editing ? draftFrom(editing) : null), [editing]);

  const canManage = canManageFinances(user, councilId);
  const events = setup.data?.events ?? [];
  const eventById = new Map(events.map((e) => [e.id, e]));
  const eventOwner = (id: number | null | undefined) => (id == null ? null : (eventById.get(id)?.OwnerID ?? null));
  const eventName = (id: number | null | undefined) => (id == null ? 'Standalone' : (eventById.get(id)?.EventName ?? `Event ${id}`));
  const reloadAll = async () => {
    await Promise.all([history.reload(), eventHistory.reload(), setup.reload()]);
  };
  const remove = async (d: Donation) => {
    setMessage(null);
    try {
      await db.donations.remove(user.memberId, d.id);
      setMessage({ tone: 'info', text: `Deleted the ${formatMoney(d.DonationAmount)} donation of ${formatFullDate(d.DonationDate)}.` });
      await reloadAll();
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    }
  };
  const failure = setup.error ?? history.error ?? eventHistory.error;
  const standalone = history.data?.entries ?? [];
  const summaries = history.data?.events ?? [];
  const standaloneTotal = standalone.filter((e) => e.kind !== 'item').reduce((cents, e) => cents + Math.round(e.donation.DonationAmount * 100), 0) / 100;

  return (
    <>
      <PageTitle actions={<CouncilSelect scope={scope} />}>Donations</PageTitle>
      {failure ? <Notice tone="error">{failure}</Notice> : null}
      {message ? (
        <div className="mb-4">
          <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
            {message.text}
          </Notice>
        </div>
      ) : null}

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_26rem]">
        <div className="flex flex-col gap-4">
          <Panel title={`Event donations (${summaries.length})`}>
            {summaries.length === 0 ? (
              <Empty>No donations have been recorded against an event yet.</Empty>
            ) : (
              <ul className="grid grid-cols-1 gap-3 md:grid-cols-2" aria-label="Event donation summaries">
                {summaries.map(({ event, totals, fundsManaged }) => {
                  const chosen = event.id === eventId;
                  return (
                    <li key={event.id}>
                      <button
                        type="button"
                        aria-pressed={chosen}
                        onClick={() => setEventId(chosen ? null : event.id)}
                        className={cx('w-full rounded bg-white text-left', chosen ? 'border-[6px] border-gold p-[calc(0.75rem-4px)] shadow-md' : 'border-2 border-line p-3 hover:border-navy')}
                      >
                        <span className="flex items-start justify-between gap-2">
                          <span>
                            <span className="block font-serif text-base font-bold">{event.EventName}</span>
                            <span className="block text-xs text-muted">
                              {formatFullDate(event.StartDate)} · {totals.count} donation{totals.count === 1 ? '' : 's'}
                            </span>
                          </span>
                          <span className="text-right text-lg font-bold">{formatMoney(totals.raised)}</span>
                        </span>
                        <span className="mt-2 grid grid-cols-3 gap-2 text-xs">
                          <span>
                            <span className="block font-bold uppercase tracking-wide text-muted">Cash</span>
                            {formatMoney(totals.cash)}
                          </span>
                          <span>
                            <span className="block font-bold uppercase tracking-wide text-muted">Electronic</span>
                            {formatMoney(totals.electronic)}
                          </span>
                          <span>
                            <span className="block font-bold uppercase tracking-wide text-muted">Items (est.)</span>
                            {formatMoney(totals.itemValue)}
                          </span>
                        </span>
                        {fundsManaged ? (
                          <span className="mt-2 block">
                            <Pill tone="gold">✓ Automatically Logged to Treasury Ledger</Pill>
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {eventId !== null && eventHistory.data ? (
              <div
                ref={drillDown}
                id="donation-drill-down"
                aria-live="polite"
                className="mt-4 flex scroll-mt-4 flex-col gap-2 rounded border-[6px] border-gold bg-white p-3"
              >
                <h3 tabIndex={-1} className="font-serif text-base font-bold">
                  {eventName(eventId)}: your council&apos;s donations
                </h3>
                {eventHistory.data.entries.length === 0 ? (
                  <Empty>Your council has not recorded donations for this event.</Empty>
                ) : (
                  <DonationTable
                    caption={`Donations to ${eventName(eventId)}`}
                    entries={eventHistory.data.entries}
                    eventOwner={eventOwner}
                    showEvent={false}
                    eventName={eventName}
                    onEdit={setEditing}
                    onDelete={remove}
                  />
                )}
              </div>
            ) : null}
          </Panel>

          <Panel title={`Standalone donations (${standalone.length})`} actions={<span className="text-sm font-bold">{formatMoney(standaloneTotal)} raised</span>}>
            {standalone.length === 0 ? (
              <Empty>No standalone donations yet.</Empty>
            ) : (
              <DonationTable
                caption="Standalone donations, newest first"
                entries={standalone}
                eventOwner={eventOwner}
                showEvent={false}
                eventName={eventName}
                onEdit={setEditing}
                onDelete={remove}
              />
            )}
          </Panel>
        </div>

        <div className="flex flex-col gap-4">
          <Panel title="Record a donation">
            {!canManage ? (
              <Notice tone="info">Only this council&apos;s Admins, Financial Secretary and Treasurer record donations here.</Notice>
            ) : setup.data ? (
              <DonationForm
                key={councilId}
                initial={blank!}
                methods={setup.data.methods}
                types={setup.data.types}
                events={events}
                today={today}
                submitLabel="Record donation"
                onSubmit={async (draft) => {
                  const saved = await db.donations.record(user.memberId, { ...toFields(draft), CouncilID: councilId });
                  await reloadAll();
                  return `Recorded ${formatMoney(saved.DonationAmount)}${saved.EventID != null ? ` for ${eventName(saved.EventID)}` : ' as a standalone donation'}.`;
                }}
              />
            ) : null}
          </Panel>
        </div>
      </div>

      {editing && setup.data ? (
        <Drawer title={`Correct donation of ${formatFullDate(editing.DonationDate)}`} onClose={() => setEditing(null)}>
          <DonationForm
            initial={editDraft!}
            methods={setup.data.methods}
            types={setup.data.types}
            events={events}
            today={today}
            submitLabel="Save correction"
            onSubmit={async (draft) => {
              await db.donations.update(user.memberId, editing.id, toFields(draft));
              await reloadAll();
              setEditing(null);
              setMessage({ tone: 'info', text: 'Donation corrected.' });
              return 'Saved.';
            }}
          />
        </Drawer>
      ) : null}
    </>
  );
}

export default function DonationsPage() {
  return (
    <RequireArea area="donations">
      <DonationsWorkspace />
    </RequireArea>
  );
}
