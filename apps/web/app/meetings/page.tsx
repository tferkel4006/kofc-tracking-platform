'use client';
// Meeting center: schedule a council meeting and invite members, record who attended, and attach the
// minutes. Admins, Super Admins and any officer of the council may do all of this; the invitation message
// and the day-before reminder are the data layer's job, so this page only chooses who is invited.
import { useState } from 'react';
import {
  canManageMeetings,
  describeError,
  formatDate,
  formatTimeRange,
  toIsoDate,
  type Meeting,
  type MeetingInviteMode,
  type MeetingType,
  type NewMeeting,
} from '@kofc/shared';
import { CouncilSelect, RequireArea, useCouncilScope } from '@/components/CouncilScope';
import { Button, cx, Empty, Field, Input, Notice, PageTitle, Panel, Pill, Select, Table, Td, Textarea } from '@/components/ui';
import { minutesFileName } from '@/lib/format';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

type Message = { tone: 'error' | 'info'; text: string };
type InviteChoice = 'allActive' | 'officers' | 'none' | 'pick';

const INVITE_LABELS: Record<InviteChoice, string> = {
  allActive: 'All active members',
  officers: 'Officers only',
  pick: 'Choose members…',
  none: 'Nobody yet',
};

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

// ---- schedule a meeting ------------------------------------------------------

function NewMeetingForm({ councilId, types, onCreated }: { councilId: number; types: MeetingType[]; onCreated: (id: number) => void }) {
  const { message, setMessage, run } = useAction();
  const members = useLoad(() => db.members.listByCouncil(councilId, { activeOnly: true }), [councilId]);
  const [name, setName] = useState('');
  const [typeId, setTypeId] = useState(types[0]?.id ?? 0);
  const [date, setDate] = useState('');
  const [start, setStart] = useState('19:00');
  const [end, setEnd] = useState('20:30');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [agenda, setAgenda] = useState('');
  const [choice, setChoice] = useState<InviteChoice>('allActive');
  const [picked, setPicked] = useState<number[]>([]);

  const toggle = (id: number) => setPicked((now) => (now.includes(id) ? now.filter((m) => m !== id) : [...now, id]));

  const create = async () => {
    let id = 0;
    const ok = await run(async () => {
      if (name.trim() === '' || date === '' || location.trim() === '') throw new Error('A meeting needs a name, a date and a location.');
      if (end <= start) throw new Error(`The meeting ends (${end}) before it starts (${start}).`);
      const meeting: NewMeeting = {
        CouncilID: councilId,
        'Meeting Name': name.trim(),
        Date: date,
        'Time Start': `${start}:00`,
        'Time End': `${end}:00`,
        Location: location.trim(),
        MeetingType: typeId,
      };
      if (description.trim() !== '') meeting['Meeting Description'] = description.trim();
      if (agenda.trim() !== '') meeting.Agenda = agenda.trim();
      const invite: MeetingInviteMode = choice === 'pick' ? { memberIds: picked } : choice;
      id = (await db.meetings.create(meeting, invite)).id;
    }, 'Meeting scheduled and invitations sent.');
    if (ok) onCreated(id);
  };

  return (
    <Panel title="Schedule a meeting">
      <form
        className="grid grid-cols-2 gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void create();
        }}
      >
        <div className="col-span-2">
          <Banner message={message} onDismiss={() => setMessage(null)} />
        </div>
        <Field label="Meeting name">{(id) => <Input id={id} value={name} maxLength={100} onChange={(e) => setName(e.target.value)} required />}</Field>
        <Field label="Type">
          {(id) => (
            <Select id={id} value={typeId} onChange={(e) => setTypeId(Number(e.target.value))}>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.Type}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Date">{(id) => <Input id={id} type="date" value={date} onChange={(e) => setDate(e.target.value)} required />}</Field>
        <Field label="Location">{(id) => <Input id={id} value={location} maxLength={255} onChange={(e) => setLocation(e.target.value)} required />}</Field>
        <Field label="Starts">{(id) => <Input id={id} type="time" value={start} onChange={(e) => setStart(e.target.value)} required />}</Field>
        <Field label="Ends">{(id) => <Input id={id} type="time" value={end} onChange={(e) => setEnd(e.target.value)} required />}</Field>
        <Field label="Description" className="col-span-2">
          {(id) => <Input id={id} value={description} maxLength={255} onChange={(e) => setDescription(e.target.value)} />}
        </Field>
        <Field label="Agenda" className="col-span-2">
          {(id) => <Textarea id={id} value={agenda} onChange={(e) => setAgenda(e.target.value)} />}
        </Field>
        <Field label="Invite" hint="Invited members receive a message in the app." className="col-span-2 sm:col-span-1">
          {(id) => (
            <Select id={id} value={choice} onChange={(e) => setChoice(e.target.value as InviteChoice)}>
              {(Object.keys(INVITE_LABELS) as InviteChoice[]).map((c) => (
                <option key={c} value={c}>
                  {INVITE_LABELS[c]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {choice === 'pick' ? (
          <fieldset className="col-span-2 flex flex-col gap-1">
            <legend className="text-xs font-bold uppercase tracking-wide">Members to invite</legend>
            <div className="grid max-h-56 grid-cols-2 gap-x-6 gap-y-1 overflow-y-auto rounded border border-line p-2">
              {(members.data ?? []).map((m) => (
                <label key={m.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={picked.includes(m.id)} onChange={() => toggle(m.id)} />
                  {m.MemberLastName}, {m.MemberFirstName}
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}
        <div className="col-span-2">
          <Button type="submit">Schedule meeting</Button>
        </div>
      </form>
    </Panel>
  );
}

// ---- one meeting: attendance and minutes -------------------------------------

function MeetingDetail({ meetingId, councilId, editable, onChanged }: { meetingId: number; councilId: number; editable: boolean; onChanged: () => void }) {
  const meeting = useLoad(() => db.meetings.get(meetingId), [meetingId]);
  const invites = useLoad(() => db.meetings.listInvites(meetingId), [meetingId]);
  const members = useLoad(() => db.members.listByCouncil(councilId), [councilId]);
  const { message, setMessage, run } = useAction();

  const failure = meeting.error ?? invites.error ?? members.error;
  if (failure) return <Notice tone="error">{failure}</Notice>;
  if (!meeting.data || !invites.data || !members.data) return <p className="text-sm text-muted">Loading the meeting…</p>;

  const m: Meeting = meeting.data;
  const name = new Map(members.data.map((x) => [x.id, `${x.MemberLastName}, ${x.MemberFirstName}`]));
  const invited = new Set(invites.data.map((i) => i.MemberID));
  const notInvited = members.data.filter((x) => !invited.has(x.id));
  const attended = invites.data.filter((i) => i.Attended === 1).length;
  const fileName = minutesFileName(m.MinutesURL);

  const refresh = async () => {
    await Promise.all([meeting.reload(), invites.reload()]);
    onChanged();
  };
  const act = async (action: () => Promise<void>, done: string) => {
    if (await run(action, done)) await refresh();
  };

  const attach = (file: File | undefined) => {
    if (!file) return;
    // The memory driver has no file store yet, so the minutes are a browser blob whose file name rides after the #.
    void act(async () => void (await db.meetings.setMinutes(m.id, `${URL.createObjectURL(file)}#${encodeURIComponent(file.name)}`)), 'Minutes attached.');
  };

  return (
    <div className="flex flex-col gap-4">
      <Panel title={m['Meeting Name']}>
        <dl className="grid grid-cols-[8rem_1fr] gap-y-1 text-sm">
          <dt className="font-bold">When</dt>
          <dd>
            {formatDate(m.Date)} · {formatTimeRange(m['Time Start'], m['Time End'])}
          </dd>
          <dt className="font-bold">Where</dt>
          <dd>{m.Location}</dd>
          {m['Meeting Description'] ? (
            <>
              <dt className="font-bold">About</dt>
              <dd>{m['Meeting Description']}</dd>
            </>
          ) : null}
          {m.Agenda ? (
            <>
              <dt className="font-bold">Agenda</dt>
              <dd className="whitespace-pre-line">{m.Agenda}</dd>
            </>
          ) : null}
        </dl>
      </Panel>

      <Panel title="Minutes">
        <div className="flex flex-col gap-3">
          <Banner message={message} onDismiss={() => setMessage(null)} />
          {fileName && m.MinutesURL ? (
            <p className="text-sm">
              <a href={m.MinutesURL.split('#')[0]} download={fileName} className="font-bold underline">
                {fileName}
              </a>
            </p>
          ) : (
            <Empty>No minutes have been uploaded for this meeting.</Empty>
          )}
          {editable ? (
            <div className="flex flex-wrap items-end gap-3">
              <Field label={fileName ? 'Replace minutes' : 'Upload minutes'}>
                {(id) => <input id={id} type="file" accept=".pdf,.doc,.docx,.txt" onChange={(e) => attach(e.target.files?.[0])} className="text-sm" />}
              </Field>
              {fileName ? (
                <Button variant="secondary" size="sm" onClick={() => void act(async () => void (await db.meetings.setMinutes(m.id, null)), 'Minutes removed.')}>
                  Remove minutes
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </Panel>

      <Panel
        title={`Invitations and attendance (${attended} of ${invites.data.length} attended)`}
        actions={
          editable && notInvited.length > 0 ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                void act(async () => {
                  const active = (await db.members.listByCouncil(councilId, { activeOnly: true })).filter((x) => !invited.has(x.id));
                  await db.meetings.invite(m.id, active.map((x) => x.id));
                }, 'Invited every active member who was missing.')
              }
            >
              Invite all active members
            </Button>
          ) : undefined
        }
      >
        {invites.data.length === 0 ? (
          <Empty>Nobody is invited yet.</Empty>
        ) : (
          <Table caption={`Invitations for ${m['Meeting Name']}`} head={['Member', 'Attended']}>
            {[...invites.data]
              .sort((a, b) => (name.get(a.MemberID) ?? '').localeCompare(name.get(b.MemberID) ?? ''))
              .map((i) => (
                <tr key={i.id}>
                  <Td>{name.get(i.MemberID) ?? `Member ${i.MemberID}`}</Td>
                  <Td>
                    <input
                      type="checkbox"
                      aria-label={`${name.get(i.MemberID) ?? i.MemberID} attended`}
                      checked={i.Attended === 1}
                      disabled={!editable}
                      onChange={(e) => void act(() => db.meetings.setAttended(m.id, i.MemberID, e.target.checked), 'Attendance saved.')}
                    />
                  </Td>
                </tr>
              ))}
          </Table>
        )}
      </Panel>
    </div>
  );
}

// ---- the page ----------------------------------------------------------------

function MeetingCenter() {
  const user = useUser();
  const scope = useCouncilScope();
  const [selected, setSelected] = useState<number | 'new' | null>(null);
  const types = useLoad(() => db.lookups.list('MeetingType'), []);
  const today = toIsoDate(new Date());
  // fromDate reaches back far enough to list past meetings too, so their attendance and minutes stay reachable.
  const meetings = useLoad(async () => {
    const all = await db.meetings.listUpcoming(scope.councilId, { fromDate: '1900-01-01' });
    return [...all.filter((m) => m.Date >= today), ...all.filter((m) => m.Date < today).reverse()];
  }, [scope.councilId, today]);
  const editable = canManageMeetings(user, scope.councilId);
  const typeName = new Map((types.data ?? []).map((t) => [t.id, t.Type]));

  return (
    <>
      <PageTitle actions={<CouncilSelect scope={scope} />}>Meeting center</PageTitle>
      {!editable ? <Notice tone="info">You can view this council&apos;s meetings, but only its officers and admins can change them.</Notice> : null}
      <div className="mt-4 grid grid-cols-[20rem_minmax(0,1fr)] items-start gap-4">
        <Panel title="Meetings" actions={editable ? <Button size="sm" onClick={() => setSelected('new')}>New meeting</Button> : undefined}>
          {meetings.error ? <Notice tone="error">{meetings.error}</Notice> : null}
          {meetings.data?.length === 0 ? <Empty>No meetings scheduled for this council.</Empty> : null}
          <ul className="flex flex-col gap-1">
            {(meetings.data ?? []).map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  aria-current={selected === m.id ? 'true' : undefined}
                  onClick={() => setSelected(m.id)}
                  className={cx('block w-full border-l-8 px-3 py-2 text-left', selected === m.id ? 'border-gold bg-white outline outline-1 outline-line' : 'border-transparent hover:underline')}
                >
                  <span className="block text-sm font-bold">{m['Meeting Name']}</span>
                  <span className="block text-xs text-muted">
                    {formatDate(m.Date)} · {typeName.get(m.MeetingType) ?? ''}
                  </span>
                  <span className="mt-1 flex gap-1">
                    {m.Date < today ? <Pill tone="outline">Past</Pill> : <Pill tone="navy">Upcoming</Pill>}
                    {m.Date < today && !m.MinutesURL ? <Pill tone="redOutline">No minutes</Pill> : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Panel>
        <div>
          {selected === null ? (
            <Empty>Choose a meeting on the left{editable ? ', or schedule a new one' : ''}.</Empty>
          ) : selected === 'new' ? (
            <NewMeetingForm
              key={`${scope.councilId}-${types.data?.length ?? 0}`}
              councilId={scope.councilId}
              types={types.data ?? []}
              onCreated={(id) => {
                void meetings.reload().then(() => setSelected(id));
              }}
            />
          ) : (
            <MeetingDetail key={selected} meetingId={selected} councilId={scope.councilId} editable={editable} onChanged={() => void meetings.reload()} />
          )}
        </div>
      </div>
    </>
  );
}

export default function MeetingsPage() {
  return (
    <RequireArea area="meetings">
      <MeetingCenter />
    </RequireArea>
  );
}
