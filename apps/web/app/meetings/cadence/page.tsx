'use client';
// Cadence Engine (Sprint 5Z-6): the council's standing meeting patterns and the annual calendar they lay down.
// Each of the council's meeting types may carry one cadence (CouncilCadenceConfig): a recurrence pattern such as
// 'First Tuesday', a start time, a default location and the recipient group its meetings invite. 'Populate Annual
// Cadence' calls meetings.populateAnnualCadence, which writes the fraternal year's twelve meetings in one transaction.
// Drip release: those meetings are on the master calendar at once, but their invitations stay out of members' own
// feeds until five days before each meeting; the canvas below shows each month's release day. Open to the council's
// Admins and Grand Knight and to Super Admins (canManageCouncilCadence; the data layer checks again).
import { useState } from 'react';
import {
  CADENCE_INVITE_LEAD_DAYS,
  CADENCE_LOCATION_MAX_LENGTH,
  CADENCE_ORDINALS,
  CADENCE_RECIPIENT_GROUPS,
  CADENCE_WEEKDAYS,
  cadenceDatesForYear,
  cadenceInviteReleaseDate,
  cadenceMeetingTimes,
  cadenceRecipientLabel,
  canManageCouncilCadence,
  currentFraternalYear,
  describeError,
  formatDate,
  formatTimeRange,
  fraternalYearBounds,
  isInvitationReleased,
  parseCadencePattern,
  toIsoDate,
  type CadenceOrdinal,
  type CadenceRecipientGroup,
  type CadenceWeekday,
  type CouncilCadenceConfig,
  type CouncilMeetingType,
  type Meeting,
} from '@kofc/shared';
import { CouncilSelect, RequireArea, useCouncilScope } from '@/components/CouncilScope';
import { Button, Empty, Field, Input, Notice, PageTitle, Panel, Pill, Select, Table, Td } from '@/components/ui';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

type Message = { tone: 'error' | 'info'; text: string };

const nextYear = (year: string): string => {
  const start = Number(year.slice(0, 4)) + 1;
  return `${start}-${start + 1}`;
};

const monthLabel = (date: string): string =>
  new Date(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

// ---- the recurrence form -------------------------------------------------------

function CadenceForm({
  councilId,
  types,
  editing,
  takenTypeIds,
  onSaved,
  onCancel,
}: {
  councilId: number;
  types: CouncilMeetingType[];
  editing: CouncilCadenceConfig | null;
  takenTypeIds: number[];
  onSaved: (saved: CouncilCadenceConfig) => void;
  onCancel: () => void;
}) {
  const user = useUser();
  const open = types.filter((t) => t.id === editing?.MeetingTypeID || !takenTypeIds.includes(t.id));
  const rule = editing ? parseCadencePattern(editing.CadencePattern) : { ordinal: 'First' as CadenceOrdinal, weekday: 'Tuesday' as CadenceWeekday };
  const [typeId, setTypeId] = useState<number | null>(editing?.MeetingTypeID ?? open[0]?.id ?? null);
  const [ordinal, setOrdinal] = useState<CadenceOrdinal>(rule.ordinal);
  const [weekday, setWeekday] = useState<CadenceWeekday>(rule.weekday);
  const [start, setStart] = useState(editing?.DefaultStartTime.slice(0, 5) ?? '19:30');
  const [location, setLocation] = useState(editing?.DefaultLocation ?? '');
  const [group, setGroup] = useState<CadenceRecipientGroup>(editing?.DefaultRecipientGroup ?? 'all_members');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (open.length === 0) {
    return <Empty>Every meeting type of this council already has a cadence. Edit one, or add a meeting type in Council Lookups.</Empty>;
  }

  const save = async () => {
    if (typeId === null) return;
    setBusy(true);
    setError(null);
    try {
      const saved = await db.meetings.saveCadenceConfig(user.memberId, councilId, {
        MeetingTypeID: typeId,
        CadencePattern: `${ordinal} ${weekday}`,
        DefaultStartTime: start,
        DefaultLocation: location,
        DefaultRecipientGroup: group,
      });
      onSaved(saved);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="grid grid-cols-2 gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      {error ? (
        <div className="col-span-2">
          <Notice tone="error" onDismiss={() => setError(null)}>
            {error}
          </Notice>
        </div>
      ) : null}
      <Field label="Meeting type" className="col-span-2" hint="One cadence per meeting type.">
        {(id) => (
          <Select id={id} value={typeId ?? ''} disabled={editing !== null} onChange={(e) => setTypeId(Number(e.target.value))}>
            {open.map((t) => (
              <option key={t.id} value={t.id}>
                {t.TypeName}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Recurrence pattern: week">
        {(id) => (
          <Select id={id} value={ordinal} onChange={(e) => setOrdinal(e.target.value as CadenceOrdinal)}>
            {CADENCE_ORDINALS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Recurrence pattern: day">
        {(id) => (
          <Select id={id} value={weekday} onChange={(e) => setWeekday(e.target.value as CadenceWeekday)}>
            {CADENCE_WEEKDAYS.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Start time" hint="Each meeting runs two hours.">
        {(id) => <Input id={id} type="time" value={start} onChange={(e) => setStart(e.target.value)} required />}
      </Field>
      <Field label="Default recipient group" hint={`Invitations reach members ${CADENCE_INVITE_LEAD_DAYS} days before each meeting.`}>
        {(id) => (
          <Select id={id} value={group} onChange={(e) => setGroup(e.target.value as CadenceRecipientGroup)}>
            {CADENCE_RECIPIENT_GROUPS.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Default location" className="col-span-2">
        {(id) => <Input id={id} value={location} maxLength={CADENCE_LOCATION_MAX_LENGTH} onChange={(e) => setLocation(e.target.value)} required />}
      </Field>
      <div className="col-span-2 flex gap-2">
        <Button type="submit" disabled={busy}>
          {editing ? 'Save cadence' : 'Add cadence'}
        </Button>
        <Button variant="secondary" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ---- the drip-release canvas -----------------------------------------------------

function DripCanvas({ config, year, meetings, today }: { config: CouncilCadenceConfig; year: string; meetings: Meeting[]; today: string }) {
  const times = cadenceMeetingTimes(config.DefaultStartTime);
  const byDate = new Map(meetings.filter((m) => m.MeetingTypeID === config.MeetingTypeID).map((m) => [m.Date.slice(0, 10), m]));
  return (
    <ol className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4" aria-label={`Drip-release canvas for ${year}`}>
      {cadenceDatesForYear(config.CadencePattern, year).map((date) => {
        const meeting = byDate.get(date);
        const release = meeting?.InviteReleaseDate ?? cadenceInviteReleaseDate(date);
        const past = date < today;
        const released = meeting ? isInvitationReleased(meeting, today) : release <= today;
        return (
          <li key={date} className={`rounded border-2 p-3 ${meeting ? 'border-navy bg-white' : 'border-dashed border-line bg-white'}`}>
            <p className="text-xs font-bold uppercase tracking-wide text-muted">{monthLabel(date)}</p>
            <p className="font-serif text-lg font-bold">{formatDate(date)}</p>
            <p className="text-xs">{formatTimeRange(meeting?.['Time Start'] ?? times['Time Start'], meeting?.['Time End'] ?? times['Time End'])}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {!meeting ? (
                <Pill tone="outline">Not laid down</Pill>
              ) : past ? (
                <Pill tone="outline">Held</Pill>
              ) : released ? (
                <Pill tone="navy">Invitations released</Pill>
              ) : (
                <Pill tone="gold">Hidden until {formatDate(release)}</Pill>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// ---- the page ----------------------------------------------------------------------

function CadenceEngine() {
  const user = useUser();
  const scope = useCouncilScope();
  const councilId = scope.councilId;
  const now = new Date();
  const today = toIsoDate(now);
  const thisYear = currentFraternalYear(now);
  const [year, setYear] = useState(thisYear);
  const types = useLoad(() => db.meetings.listCouncilMeetingTypes(councilId), [councilId]);
  const configs = useLoad(() => db.meetings.listCadenceConfigs(councilId), [councilId]);
  const meetings = useLoad(async () => {
    const { fromDate, toDate } = fraternalYearBounds(year);
    return (await db.meetings.listUpcoming(councilId, { fromDate })).filter((m) => m.Date.slice(0, 10) <= toDate);
  }, [councilId, year]);
  const [editing, setEditing] = useState<CouncilCadenceConfig | 'new' | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const [busy, setBusy] = useState(false);

  const allowed = canManageCouncilCadence(user, councilId);
  const typeName = new Map((types.data ?? []).map((t) => [t.id, t.TypeName]));
  const list = configs.data ?? [];
  const selected = list.find((c) => c.id === selectedId) ?? list[0] ?? null;

  const act = async (action: () => Promise<string>) => {
    setBusy(true);
    setMessage(null);
    try {
      setMessage({ tone: 'info', text: await action() });
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setBusy(false);
    }
  };

  const populate = (config: CouncilCadenceConfig) =>
    void act(async () => {
      const result = await db.meetings.populateAnnualCadence(user.memberId, councilId, config.id, year);
      await meetings.reload();
      const skipped = result.skippedDates.length;
      return `Laid down ${result.created.length} ${typeName.get(config.MeetingTypeID) ?? ''} meeting${result.created.length === 1 ? '' : 's'} for ${year}${
        skipped > 0 ? `; ${skipped} date${skipped === 1 ? ' was' : 's were'} already on the calendar` : ''
      }. Invitations go out ${CADENCE_INVITE_LEAD_DAYS} days before each meeting.`;
    });

  const remove = (config: CouncilCadenceConfig) =>
    void act(async () => {
      await db.meetings.removeCadenceConfig(user.memberId, councilId, config.id);
      await configs.reload();
      return `Removed the ${typeName.get(config.MeetingTypeID) ?? ''} cadence. Meetings already on the calendar stay.`;
    });

  const failure = types.error ?? configs.error ?? meetings.error;

  return (
    <>
      <PageTitle actions={<CouncilSelect scope={scope} />}>Cadence Engine</PageTitle>
      {!allowed ? (
        <Notice tone="error">Only the council&apos;s Admins and Grand Knight, or a Super Admin, manage its meeting cadence.</Notice>
      ) : (
        <div className="flex flex-col gap-4">
          {failure ? <Notice tone="error">{failure}</Notice> : null}
          {message ? (
            <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
              {message.text}
            </Notice>
          ) : null}

          <div className="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] items-start gap-4">
            <Panel
              title="Standing cadences"
              actions={
                editing === null ? (
                  <Button size="sm" onClick={() => setEditing('new')}>
                    Add cadence
                  </Button>
                ) : undefined
              }
            >
              {list.length === 0 ? (
                <Empty>No standing cadences yet. Add one to lay down the year&apos;s meetings in a single step.</Empty>
              ) : (
                <Table caption="Standing meeting cadences" head={['Meeting type', 'Recurrence pattern', 'Start time', 'Default location', 'Recipients', '']}>
                  {list.map((c) => (
                    <tr key={c.id} className={selected?.id === c.id ? 'border-l-8 border-gold' : undefined}>
                      <Td className="font-bold">{typeName.get(c.MeetingTypeID) ?? `Type ${c.MeetingTypeID}`}</Td>
                      <Td>{c.CadencePattern}</Td>
                      <Td>{cadenceMeetingTimes(c.DefaultStartTime)['Time Start'].slice(0, 5)}</Td>
                      <Td>{c.DefaultLocation}</Td>
                      <Td>{cadenceRecipientLabel(c.DefaultRecipientGroup)}</Td>
                      <Td>
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="secondary" onClick={() => setSelectedId(c.id)}>
                            Canvas
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => setEditing(c)}>
                            Edit
                          </Button>
                          <Button size="sm" variant="danger" disabled={busy} onClick={() => remove(c)}>
                            Remove
                          </Button>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </Table>
              )}
            </Panel>

            <Panel title={editing === null ? 'Populate the year' : editing === 'new' ? 'New cadence' : 'Edit cadence'}>
              {editing !== null && types.data ? (
                <CadenceForm
                  key={editing === 'new' ? 'new' : editing.id}
                  councilId={councilId}
                  types={types.data}
                  editing={editing === 'new' ? null : editing}
                  takenTypeIds={list.map((c) => c.MeetingTypeID)}
                  onCancel={() => setEditing(null)}
                  onSaved={(saved) => {
                    setEditing(null);
                    setSelectedId(saved.id);
                    setMessage({ tone: 'info', text: `Saved the ${typeName.get(saved.MeetingTypeID) ?? ''} cadence: ${saved.CadencePattern}.` });
                    void configs.reload();
                  }}
                />
              ) : selected ? (
                <div className="flex flex-col gap-4">
                  <Field label="Fraternal year" hint="July 1 through June 30.">
                    {(id) => (
                      <Select id={id} value={year} onChange={(e) => setYear(e.target.value)}>
                        {[thisYear, nextYear(thisYear)].map((y) => (
                          <option key={y} value={y}>
                            {y}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>
                  <p className="text-sm">
                    <span className="font-bold">{typeName.get(selected.MeetingTypeID)}</span>: {selected.CadencePattern} at{' '}
                    {cadenceMeetingTimes(selected.DefaultStartTime)['Time Start'].slice(0, 5)}, {selected.DefaultLocation}. Invites{' '}
                    {cadenceRecipientLabel(selected.DefaultRecipientGroup)}.
                  </p>
                  <Button variant="gold" disabled={busy} onClick={() => populate(selected)}>
                    Populate Annual Cadence
                  </Button>
                  <p className="text-xs text-muted">
                    Writes all twelve meetings of {year} in one step. Dates already on the calendar are skipped, so running it again only fills gaps.
                  </p>
                </div>
              ) : (
                <Empty>Add a cadence to populate the year.</Empty>
              )}
            </Panel>
          </div>

          {selected ? (
            <Panel title={`Drip-release canvas: ${typeName.get(selected.MeetingTypeID) ?? ''} ${year}`}>
              <DripCanvas config={selected} year={year} meetings={meetings.data ?? []} today={today} />
            </Panel>
          ) : null}
        </div>
      )}
    </>
  );
}

export default function CadencePage() {
  return (
    <RequireArea area="meetings/cadence">
      <CadenceEngine />
    </RequireArea>
  );
}
