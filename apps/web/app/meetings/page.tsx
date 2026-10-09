'use client';
// Meeting center: schedule a council meeting and invite members, record who attended, and attach the
// minutes. Admins, Super Admins and any officer of the council schedule meetings; a meeting's owner (OwnerID)
// manages that meeting alongside them. Every member may open the center read-only. The Google Drive minutes and
// flyer links are saved by the owner, the council's Admins and finance officers, and Super Admins. The invitation
// message and the day-before reminder are the data layer's job, so this page only chooses who is invited.
//
// Sprint 5Y-6: the schedule form offers the council's own meeting types (CouncilMeetingType, saved as MeetingTypeID);
// picking one fills the agenda with the council's template for it (meetings.getAgendaTemplate), which stays editable.
// A Multi-Day Assembly checkbox swaps the clock times for an End Date: the meeting then runs over whole days.
//
// Sprint 5Z-6: a meeting's detail shows its Proposed Motions (ProposedMotionsSection) and, for a cadence meeting whose
// invitations are still held back by the drip release, the day they reach members' feeds. Cadences live at
// /meetings/cadence (Cadence Engine).
//
// Sprint 6L Extension 4: the schedule form files the meeting under a Local Category (Meeting.CategoryID) and shows that
// category's fixed Supreme Mission Area as a read-only badge.
import { useEffect, useRef, useState } from 'react';
import {
  canLinkMeetingDrive,
  canManageMeeting,
  canManageMeetings,
  describeError,
  formatDate,
  formatMeetingWhen,
  globalMeetingTypeFor,
  isInvitationReleased,
  meetingLastDate,
  toIsoDate,
  withNewMemberBadge,
  type CouncilMeetingType,
  type Meeting,
  type MeetingInviteMode,
  type MeetingType,
  type NewMeeting,
  driveFileViewUrl,
  isDriveFileId,
} from '@kofc/shared';
import { CouncilSelect, RequireArea, useCouncilScope } from '@/components/CouncilScope';
import { DriveButtons, DriveLinkEditor } from '@/components/DriveLinks';
import { LocalCategoryField } from '@/components/MissionCategoryParts';
import { ProposedMotionsSection } from '@/components/MotionParts';
import { Button, cx, Empty, Field, Input, NewMemberBadge, Notice, PageTitle, Panel, Pill, Select, Table, Td, Textarea } from '@/components/ui';
import { minutesFileName } from '@/lib/format';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';
import { archiveToDriveVault, localFileLink } from '@/services/drive-vault-transport';

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

function NewMeetingForm({
  councilId,
  types,
  councilTypes,
  onCreated,
}: {
  councilId: number;
  types: MeetingType[];
  councilTypes: CouncilMeetingType[];
  onCreated: (id: number) => void;
}) {
  const user = useUser();
  const { message, setMessage, run } = useAction();
  const members = useLoad(() => db.members.listByCouncil(councilId, { activeOnly: true }), [councilId]);
  const categories = useLoad(() => db.lookups.list('Category'), []);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [name, setName] = useState('');
  // A council with its own meeting types files the meeting under one (MeetingTypeID); otherwise the global types.
  const useCouncilTypes = councilTypes.length > 0;
  const [councilTypeId, setCouncilTypeId] = useState<number | null>(councilTypes[0]?.id ?? null);
  const [typeId, setTypeId] = useState(types[0]?.id ?? 0);
  const [date, setDate] = useState('');
  const [multiDay, setMultiDay] = useState(false);
  const [endDate, setEndDate] = useState('');
  const [start, setStart] = useState('19:00');
  const [end, setEnd] = useState('20:30');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [agenda, setAgenda] = useState('');
  const [ownerId, setOwnerId] = useState<number | null>(user.memberId);
  const [choice, setChoice] = useState<InviteChoice>('allActive');
  const [picked, setPicked] = useState<number[]>([]);
  // The template text last put in the agenda box, so choosing another type replaces it but never someone's own edits.
  const applied = useRef('');
  const [offeredTemplate, setOfferedTemplate] = useState<string | null>(null);

  // On-change trigger: each meeting type chosen (the first on open) fetches the council's template for it.
  useEffect(() => {
    if (councilTypeId === null) return;
    let current = true;
    void db.meetings.getAgendaTemplate(councilId, councilTypeId).then(
      (template) => {
        if (!current) return;
        const text = template?.TemplateText ?? '';
        setAgenda((now) => {
          if (now.trim() === '' || now === applied.current) {
            applied.current = text;
            setOfferedTemplate(null);
            return text;
          }
          setOfferedTemplate(text === '' ? null : text);
          return now;
        });
      },
      (err: unknown) => {
        if (current) setMessage({ tone: 'error', text: describeError(err) });
      },
    );
    return () => {
      current = false;
    };
  }, [councilId, councilTypeId, setMessage]);

  const toggle = (id: number) => setPicked((now) => (now.includes(id) ? now.filter((m) => m !== id) : [...now, id]));

  const create = async () => {
    let id = 0;
    const ok = await run(async () => {
      if (name.trim() === '' || date === '' || location.trim() === '') throw new Error('A meeting needs a name, a date and a location.');
      if (multiDay) {
        if (endDate === '') throw new Error('A multi-day assembly needs an end date.');
        if (endDate <= date) throw new Error(`A multi-day assembly must end (${endDate}) after the day it starts (${date}).`);
      } else if (end <= start) {
        throw new Error(`The meeting ends (${end}) before it starts (${start}).`);
      }
      const councilType = councilTypes.find((t) => t.id === councilTypeId);
      const globalType = councilType ? globalMeetingTypeFor(councilType.TypeName, types) : typeId;
      if (globalType === undefined) throw new Error('No meeting categories are set up yet; ask a Super Admin to add one.');
      const meeting: NewMeeting = {
        CouncilID: councilId,
        'Meeting Name': name.trim(),
        Date: date,
        // The data service stores a multi-day assembly without clock times.
        'Time Start': `${start}:00`,
        'Time End': `${end}:00`,
        IsMultiDay: multiDay ? 1 : 0,
        EndDate: multiDay ? endDate : null,
        Location: location.trim(),
        MeetingType: globalType,
        MeetingTypeID: councilType?.id ?? null,
        OwnerID: ownerId,
        CategoryID: categoryId,
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
        <Field label="Type" hint={useCouncilTypes ? "Your council's meeting types; each may fill in the agenda from its template." : undefined}>
          {(id) =>
            useCouncilTypes ? (
              <Select id={id} value={councilTypeId ?? ''} onChange={(e) => setCouncilTypeId(Number(e.target.value))}>
                {councilTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.TypeName}
                  </option>
                ))}
              </Select>
            ) : (
              <Select id={id} value={typeId} onChange={(e) => setTypeId(Number(e.target.value))}>
                {types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.Type}
                  </option>
                ))}
              </Select>
            )
          }
        </Field>
        <LocalCategoryField className="col-span-2" categories={categories.data ?? []} value={categoryId} onChange={setCategoryId} />
        <Field label="Location">{(id) => <Input id={id} value={location} maxLength={255} onChange={(e) => setLocation(e.target.value)} required />}</Field>
        <Field label={multiDay ? 'Start date' : 'Date'}>{(id) => <Input id={id} type="date" value={date} onChange={(e) => setDate(e.target.value)} required />}</Field>
        <label className="flex items-center gap-2 self-end pb-2 text-sm">
          <input type="checkbox" className="size-4" checked={multiDay} onChange={(e) => setMultiDay(e.target.checked)} />
          <span>
            <span className="font-bold">Multi-Day Assembly / Extended Event</span>
            <span className="block text-xs text-muted">Runs over whole days, with no clock times.</span>
          </span>
        </label>
        {multiDay ? (
          <Field label="End date" className="col-span-2 sm:col-span-1">
            {(id) => <Input id={id} type="date" value={endDate} min={date || undefined} onChange={(e) => setEndDate(e.target.value)} required />}
          </Field>
        ) : (
          <>
            <Field label="Starts">{(id) => <Input id={id} type="time" value={start} onChange={(e) => setStart(e.target.value)} required />}</Field>
            <Field label="Ends">{(id) => <Input id={id} type="time" value={end} onChange={(e) => setEnd(e.target.value)} required />}</Field>
          </>
        )}
        <Field label="Meeting owner" hint="The owner manages this meeting, its attendance, minutes and Drive links, alongside the council's admins." className="col-span-2">
          {(id) => (
            <Select id={id} value={ownerId ?? ''} onChange={(e) => setOwnerId(e.target.value === '' ? null : Number(e.target.value))}>
              <option value="">No owner</option>
              {(members.data ?? []).map((m) => (
                <option key={m.id} value={m.id}>
                  {withNewMemberBadge(`${m.MemberLastName}, ${m.MemberFirstName}`, m, new Date())}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Description" className="col-span-2">
          {(id) => <Input id={id} value={description} maxLength={255} onChange={(e) => setDescription(e.target.value)} />}
        </Field>
        <Field label="Agenda" className="col-span-2" hint={useCouncilTypes ? "Starts from the council's template for the type chosen; edit it freely." : undefined}>
          {(id) => <Textarea id={id} rows={8} value={agenda} onChange={(e) => setAgenda(e.target.value)} />}
        </Field>
        {offeredTemplate !== null ? (
          <div className="col-span-2 -mt-2 flex items-center gap-2 text-xs text-muted">
            Your own agenda was kept. This meeting type has a template too.
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                applied.current = offeredTemplate;
                setAgenda(offeredTemplate);
                setOfferedTemplate(null);
              }}
            >
              Use the template
            </Button>
          </div>
        ) : null}
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
                  <NewMemberBadge member={m} />
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

function MeetingDetail({ meetingId, councilId, onChanged }: { meetingId: number; councilId: number; onChanged: () => void }) {
  const user = useUser();
  const meeting = useLoad(() => db.meetings.get(meetingId), [meetingId]);
  const invites = useLoad(() => db.meetings.listInvites(meetingId), [meetingId]);
  const members = useLoad(() => db.members.listByCouncil(councilId), [councilId]);
  const { message, setMessage, run } = useAction();

  const failure = meeting.error ?? invites.error ?? members.error;
  if (failure) return <Notice tone="error">{failure}</Notice>;
  if (!meeting.data || !invites.data || !members.data) return <p className="text-sm text-muted">Loading the meeting…</p>;

  const m: Meeting = meeting.data;
  const editable = canManageMeeting(user, m);
  const canLink = canLinkMeetingDrive(user, m);
  const name = new Map(members.data.map((x) => [x.id, `${x.MemberLastName}, ${x.MemberFirstName}`]));
  const memberById = new Map(members.data.map((x) => [x.id, x]));
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
    // Sprint 6D: an Admin's minutes go to the Drive vault's Minutes folder and only the file id is stored. Otherwise the
    // memory driver has no file store yet, so the minutes are a browser blob whose file name rides after the #.
    void act(async () => {
      const fileId = await archiveToDriveVault(user, 'minutes', file);
      await db.meetings.setMinutes(m.id, fileId ?? localFileLink(file));
    }, 'Minutes attached.');
  };

  return (
    <div className="flex flex-col gap-4">
      <Panel title={m['Meeting Name']}>
        <dl className="grid grid-cols-[8rem_1fr] gap-y-1 text-sm">
          <dt className="font-bold">When</dt>
          <dd>{formatMeetingWhen(m)}</dd>
          <dt className="font-bold">Where</dt>
          <dd>{m.Location}</dd>
          <dt className="font-bold">Owner</dt>
          <dd>{m.OwnerID != null ? (name.get(m.OwnerID) ?? `Member ${m.OwnerID}`) : 'None designated'}</dd>
          {m['Meeting Description'] ? (
            <>
              <dt className="font-bold">About</dt>
              <dd>{m['Meeting Description']}</dd>
            </>
          ) : null}
          {!isInvitationReleased(m, toIsoDate(new Date())) && m.InviteReleaseDate ? (
            <>
              <dt className="font-bold">Invitations</dt>
              <dd>
                <Pill tone="gold">Drip release</Pill> Hidden from members&apos; feeds until {formatDate(m.InviteReleaseDate)}.
              </dd>
            </>
          ) : null}
          {m.Agenda ? (
            <>
              <dt className="font-bold">Agenda</dt>
              <dd className="whitespace-pre-line">{m.Agenda}</dd>
            </>
          ) : null}
        </dl>
        <div className="mt-4 border-t border-line pt-3">
          <DriveButtons meeting={m} />
        </div>
      </Panel>

      <ProposedMotionsSection meetingId={m.id} />

      {canLink ? (
        <Panel title="Google Drive files">
          <DriveLinkEditor key={`${m.GoogleDriveMinutesURL ?? ''}|${m.GoogleDriveFlyerURL ?? ''}`} meeting={m} onSaved={refresh} />
        </Panel>
      ) : null}

      <Panel title="Minutes">
        <div className="flex flex-col gap-3">
          <Banner message={message} onDismiss={() => setMessage(null)} />
          {fileName && m.MinutesURL ? (
            <p className="text-sm">
              <a
                href={isDriveFileId(m.MinutesURL) ? driveFileViewUrl(m.MinutesURL) : m.MinutesURL.split('#')[0]}
                download={isDriveFileId(m.MinutesURL) ? undefined : fileName}
                target={isDriveFileId(m.MinutesURL) ? '_blank' : undefined}
                rel="noreferrer"
                className="font-bold underline"
              >
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
                  <Td>
                    {name.get(i.MemberID) ?? `Member ${i.MemberID}`}
                    <NewMemberBadge member={memberById.get(i.MemberID)} />
                  </Td>
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
  const councilTypes = useLoad(() => db.meetings.listCouncilMeetingTypes(scope.councilId), [scope.councilId]);
  const today = toIsoDate(new Date());
  // fromDate reaches back far enough to list past meetings too, so their attendance and minutes stay reachable.
  const meetings = useLoad(async () => {
    const all = await db.meetings.listUpcoming(scope.councilId, { fromDate: '1900-01-01' });
    return [...all.filter((m) => meetingLastDate(m) >= today), ...all.filter((m) => meetingLastDate(m) < today).reverse()];
  }, [scope.councilId, today]);
  const editable = canManageMeetings(user, scope.councilId);
  const typeName = new Map((types.data ?? []).map((t) => [t.id, t.Type]));
  const councilTypeName = new Map((councilTypes.data ?? []).map((t) => [t.id, t.TypeName]));

  return (
    <>
      <PageTitle actions={<CouncilSelect scope={scope} />}>Meeting center</PageTitle>
      {!editable ? (
        <Notice tone="info">You can view this council&apos;s meetings. Its officers and admins schedule them, and a meeting&apos;s owner manages that meeting.</Notice>
      ) : null}
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
                    {m.IsMultiDay === 1 && m.EndDate ? `${formatDate(m.Date)} – ${formatDate(m.EndDate)}` : formatDate(m.Date)} ·{' '}
                    {(m.MeetingTypeID != null ? councilTypeName.get(m.MeetingTypeID) : undefined) ?? typeName.get(m.MeetingType) ?? ''}
                  </span>
                  <span className="mt-1 flex gap-1">
                    {meetingLastDate(m) < today ? <Pill tone="outline">Past</Pill> : <Pill tone="navy">Upcoming</Pill>}
                    {m.IsMultiDay === 1 ? <Pill tone="gold">Multi-day</Pill> : null}
                    {meetingLastDate(m) < today && !m.MinutesURL && !m.GoogleDriveMinutesURL ? <Pill tone="redOutline">No minutes</Pill> : null}
                    {m.GoogleDriveMinutesURL || m.GoogleDriveFlyerURL ? <Pill tone="gold">Drive</Pill> : null}
                    {m.OwnerID === user.memberId ? <Pill tone="outline">Mine</Pill> : null}
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
              key={`${scope.councilId}-${types.data?.length ?? 0}-${councilTypes.data?.length ?? 0}`}
              councilId={scope.councilId}
              types={types.data ?? []}
              councilTypes={councilTypes.data ?? []}
              onCreated={(id) => {
                void meetings.reload().then(() => setSelected(id));
              }}
            />
          ) : (
            <MeetingDetail key={selected} meetingId={selected} councilId={scope.councilId} onChanged={() => void meetings.reload()} />
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
