'use client';
// Member roster: a split screen. The council's members are on the left, filterable by name and status; the
// selected member (or a blank "add member" form) opens on the right. The Skills drawer lists every skill held
// in the council and messages everyone with one; "Skills & training" opens the selected member's skills and
// training classes for editing. Admins work on their own council, Super Admins pick any.
// The member type choices come from grantableMemberTypes, and the drivers enforce the same tiers
// (ADMIN_REQUIRED, SUPER_ADMIN_REQUIRED, COUNCIL_ACCESS_DENIED), so a refusal is reported, never hidden.
import { useEffect, useState } from 'react';
import {
  canCreateMembers,
  canEditMember,
  describeError,
  grantableMemberTypes,
  type Degree,
  type Member,
  type MemberStatus,
  type MemberType,
  type NewMember,
} from '@kofc/shared';
import { CouncilSelect, RequireArea, useCouncilScope } from '@/components/CouncilScope';
import { Drawer } from '@/components/Drawer';
import { ProfileExtensionsEditor } from '@/components/ProfileExtensionsEditor';
import { SkillFilterDrawer } from '@/components/SkillFilterDrawer';
import { Button, cx, Empty, Field, Input, Notice, PageTitle, Panel, Pill, Select, Table, Td } from '@/components/ui';
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

interface Lookups {
  statuses: MemberStatus[];
  degrees: Degree[];
  types: MemberType[];
}

// ---- add / edit form ---------------------------------------------------------

/** Every form field is text; numbers and ids are converted on save and validated again by the driver. */
type Draft = Record<Exclude<keyof NewMember, 'WorkingStatusID'>, string>;

const TEXT_FIELDS: { key: keyof Draft; label: string; type?: string; maxLength: number; optional?: boolean; wide?: boolean }[] = [
  { key: 'MemberFirstName', label: 'First name', maxLength: 100 },
  { key: 'MemberLastName', label: 'Last name', maxLength: 100 },
  { key: 'MemberNumber', label: 'Member number', type: 'number', maxLength: 10 },
  { key: 'Email', label: 'Email (also the login)', type: 'email', maxLength: 50 },
  { key: 'Phone', label: 'Phone', type: 'tel', maxLength: 50 },
  { key: 'DateOfBirth', label: 'Date of birth', type: 'date', maxLength: 10 },
  { key: 'StreetAddress1', label: 'Street address', maxLength: 255, wide: true },
  { key: 'StreetAddress2', label: 'Street address line 2', maxLength: 255, optional: true, wide: true },
  { key: 'City', label: 'City', maxLength: 50 },
  { key: 'State', label: 'State', maxLength: 20 },
  { key: 'ZipCode', label: 'ZIP code', maxLength: 15 },
];

const idOf = (row: { id: number } | undefined): string => (row ? String(row.id) : '');

function draftFrom(member: Member | null, councilId: number, lookups: Lookups): Draft {
  if (!member) {
    return {
      CouncilID: String(councilId),
      MemberNumber: '',
      MemberFirstName: '',
      MemberLastName: '',
      Phone: '',
      StreetAddress1: '',
      StreetAddress2: '',
      City: '',
      State: '',
      ZipCode: '',
      Email: '',
      DateOfBirth: '',
      StatusID: idOf(lookups.statuses.find((s) => s.Status === 'Active') ?? lookups.statuses[0]),
      DegreeID: idOf(lookups.degrees[0]),
      MemberTypeID: idOf(lookups.types.find((t) => t.Type === 'Member') ?? lookups.types[0]),
    };
  }
  const text = (v: string | number | null | undefined) => (v == null ? '' : String(v));
  return {
    CouncilID: text(member.CouncilID),
    MemberNumber: text(member.MemberNumber),
    MemberFirstName: member.MemberFirstName,
    MemberLastName: member.MemberLastName,
    Phone: member.Phone,
    StreetAddress1: member.StreetAddress1,
    StreetAddress2: text(member.StreetAddress2),
    City: member.City,
    State: member.State,
    ZipCode: member.ZipCode,
    Email: member.Email,
    DateOfBirth: member.DateOfBirth,
    StatusID: text(member.StatusID),
    DegreeID: text(member.DegreeID),
    MemberTypeID: text(member.MemberTypeID),
  };
}

function toNewMember(d: Draft): NewMember {
  return {
    CouncilID: Number(d.CouncilID),
    MemberNumber: Number(d.MemberNumber),
    MemberFirstName: d.MemberFirstName,
    MemberLastName: d.MemberLastName,
    Phone: d.Phone,
    StreetAddress1: d.StreetAddress1,
    StreetAddress2: d.StreetAddress2.trim() === '' ? undefined : d.StreetAddress2,
    City: d.City,
    State: d.State,
    ZipCode: d.ZipCode,
    Email: d.Email,
    DateOfBirth: d.DateOfBirth,
    StatusID: Number(d.StatusID),
    DegreeID: Number(d.DegreeID),
    MemberTypeID: Number(d.MemberTypeID),
  };
}

function MemberForm({
  member,
  councilId,
  lookups,
  onSaved,
}: {
  /** null adds a member to `councilId`. */
  member: Member | null;
  councilId: number;
  lookups: Lookups;
  onSaved: (id: number) => void;
}) {
  const user = useUser();
  const [draft, setDraft] = useState<Draft>(() => draftFrom(member, councilId, lookups));
  const [busy, setBusy] = useState(false);
  const { message, setMessage, run } = useAction();
  useEffect(() => setDraft(draftFrom(member, councilId, lookups)), [member, councilId, lookups]);

  const typeName = (id: number) => lookups.types.find((t) => t.id === id)?.Type;
  const currentType = member ? typeName(member.MemberTypeID) : undefined;
  const grantable = grantableMemberTypes(user, currentType);
  const typeOptions = lookups.types.filter((t) => grantable.includes(t.Type));
  const editable = member ? canEditMember(user, member) : canCreateMembers(user, councilId);
  // An Admin may not change a Super Admin's type or status (SUPER_ADMIN_REQUIRED), so both are shown read-only.
  const clearanceLocked = typeOptions.length === 0;

  const set = (key: keyof Draft) => (value: string) => setDraft((d) => ({ ...d, [key]: value }));

  const save = async () => {
    setBusy(true);
    const ok = await run(async () => {
      const values = toNewMember(draft);
      if (member) {
        const saved = await db.members.update(user.memberId, member.id, values);
        onSaved(saved.id);
      } else {
        const saved = await db.members.create(user.memberId, values);
        onSaved(saved.id);
      }
    }, member ? 'Member saved.' : `Added ${draft.MemberFirstName} ${draft.MemberLastName}. A welcome email with sign-in instructions was queued.`);
    setBusy(false);
    if (ok && !member) setDraft(draftFrom(null, councilId, lookups));
  };

  const lookupSelect = (key: 'StatusID' | 'DegreeID', label: string, rows: { id: number; name: string }[], locked = false) => (
    <Field label={label}>
      {(id) => (
        <Select id={id} value={draft[key]} disabled={!editable || locked} onChange={(e) => set(key)(e.target.value)}>
          {rows.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </Select>
      )}
    </Field>
  );

  return (
    <Panel title={member ? `${member.MemberFirstName} ${member.MemberLastName}` : 'Add a member'}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Banner message={message} onDismiss={() => setMessage(null)} />
        {!editable ? <Notice tone="info">You can view this member, but only their council&apos;s admins can change the record.</Notice> : null}
        <div className="grid grid-cols-3 gap-3">
          {TEXT_FIELDS.map((f) => (
            <Field key={f.key} label={f.optional ? `${f.label} (optional)` : f.label} className={f.wide ? 'col-span-3' : undefined}>
              {(id) => (
                <Input
                  id={id}
                  type={f.type ?? 'text'}
                  value={draft[f.key]}
                  maxLength={f.maxLength}
                  required={!f.optional}
                  disabled={!editable}
                  onChange={(e) => set(f.key)(e.target.value)}
                />
              )}
            </Field>
          ))}
          {lookupSelect('StatusID', 'Status', lookups.statuses.map((s) => ({ id: s.id, name: s.Status })), clearanceLocked && !!member)}
          {lookupSelect('DegreeID', 'Degree', lookups.degrees.map((d) => ({ id: d.id, name: d.Degree })))}
          <Field label="Member type" hint={clearanceLocked ? 'Only a Super Admin can change this member’s type or status.' : undefined}>
            {(id) =>
              clearanceLocked ? (
                <Input id={id} value={currentType ?? ''} disabled readOnly />
              ) : (
                <Select id={id} value={draft.MemberTypeID} disabled={!editable} onChange={(e) => set('MemberTypeID')(e.target.value)}>
                  {typeOptions.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.Type}
                    </option>
                  ))}
                </Select>
              )
            }
          </Field>
        </div>
        {editable ? (
          <div className="flex gap-2">
            <Button type="submit" disabled={busy}>
              {busy ? 'Saving…' : member ? 'Save member' : 'Add member'}
            </Button>
            {member ? (
              <Button variant="secondary" onClick={() => setDraft(draftFrom(member, councilId, lookups))}>
                Undo changes
              </Button>
            ) : null}
          </div>
        ) : null}
      </form>
    </Panel>
  );
}

// ---- the page ----------------------------------------------------------------

function Roster() {
  const user = useUser();
  const scope = useCouncilScope();
  const [selected, setSelected] = useState<number | 'new' | null>(null);
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<number | 'all'>('all');
  const [skillsOpen, setSkillsOpen] = useState(false);
  const [extensionsOpen, setExtensionsOpen] = useState(false);

  const lookups = useLoad(async (): Promise<Lookups> => {
    const [statuses, degrees, types] = await Promise.all([db.lookups.list('MemberStatus'), db.lookups.list('Degree'), db.lookups.list('MemberType')]);
    return { statuses, degrees, types };
  }, []);
  const members = useLoad(async () => {
    const list = await db.members.listByCouncil(scope.councilId);
    const roles = await Promise.all(list.map((m) => db.members.listRoles(m.id)));
    return list.map((member, i) => ({ member, roles: roles[i] }));
  }, [scope.councilId]);

  useEffect(() => setSelected(null), [scope.councilId]);
  useEffect(() => setExtensionsOpen(false), [selected]);

  const statusName = new Map((lookups.data?.statuses ?? []).map((s) => [s.id, s.Status]));
  const typeName = new Map((lookups.data?.types ?? []).map((t) => [t.id, t.Type]));
  const degreeName = new Map((lookups.data?.degrees ?? []).map((d) => [d.id, d.Degree]));
  const needle = filter.trim().toLowerCase();
  const rows = (members.data ?? []).filter(
    ({ member: m }) =>
      (statusFilter === 'all' || m.StatusID === statusFilter) &&
      (needle === '' || `${m.MemberFirstName} ${m.MemberLastName} ${m.Email} ${m.MemberNumber}`.toLowerCase().includes(needle)),
  );
  const current = typeof selected === 'number' ? members.data?.find((r) => r.member.id === selected)?.member ?? null : null;
  const failure = lookups.error ?? members.error;

  return (
    <>
      <PageTitle
        actions={
          <div className="flex items-end gap-3">
            <CouncilSelect scope={scope} />
            <Button variant="secondary" onClick={() => setSkillsOpen(true)} aria-expanded={skillsOpen}>
              Skills
            </Button>
            {canCreateMembers(user, scope.councilId) ? <Button onClick={() => setSelected('new')}>Add member</Button> : null}
          </div>
        }
      >
        Member roster
      </PageTitle>
      {failure ? <Notice tone="error">{failure}</Notice> : null}

      <div className="mt-4 grid grid-cols-[minmax(0,1fr)_34rem] items-start gap-4">
        <Panel title={`Members (${rows.length} of ${members.data?.length ?? 0})`}>
          <div className="mb-3 flex gap-3">
            <Field label="Search" className="flex-1">
              {(id) => <Input id={id} type="search" placeholder="Name, email or member number" value={filter} onChange={(e) => setFilter(e.target.value)} />}
            </Field>
            <Field label="Status" className="w-40">
              {(id) => (
                <Select id={id} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
                  <option value="all">All</option>
                  {(lookups.data?.statuses ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.Status}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
          {members.data && rows.length === 0 ? <Empty>No members match. Clear the search or status filter.</Empty> : null}
          {rows.length > 0 ? (
            <Table caption="Council members" head={['Member', 'No.', 'Degree', 'Type', 'Status', 'Roles']}>
              {rows.map(({ member: m, roles }) => {
                const active = selected === m.id;
                return (
                  <tr key={m.id} className={cx(active && 'outline outline-2 -outline-offset-2 outline-gold')}>
                    <Td>
                      <button type="button" aria-current={active ? 'true' : undefined} onClick={() => setSelected(m.id)} className="text-left font-bold underline">
                        {m.MemberLastName}, {m.MemberFirstName}
                      </button>
                    </Td>
                    <Td>{m.MemberNumber}</Td>
                    <Td>{degreeName.get(m.DegreeID) ?? ''}</Td>
                    <Td>{typeName.get(m.MemberTypeID) === 'Member' ? 'Member' : <Pill tone="navy">{typeName.get(m.MemberTypeID) ?? ''}</Pill>}</Td>
                    <Td>{statusName.get(m.StatusID) === 'Active' ? 'Active' : <Pill tone="outline">{statusName.get(m.StatusID) ?? ''}</Pill>}</Td>
                    <Td className="text-xs">
                      {roles.map((r) => (r.Officer === 1 ? <Pill key={r.id} tone="gold">{r.Role}</Pill> : <span key={r.id}>{r.Role} </span>))}
                    </Td>
                  </tr>
                );
              })}
            </Table>
          ) : null}
        </Panel>

        <div>
          {!lookups.data ? null : selected === 'new' ? (
            <MemberForm
              member={null}
              councilId={scope.councilId}
              lookups={lookups.data}
              onSaved={(id) => void members.reload().then(() => setSelected(id))}
            />
          ) : current ? (
            <div className="flex flex-col gap-3">
              {canEditMember(user, current) ? (
                <div className="flex justify-end">
                  <Button variant="secondary" onClick={() => setExtensionsOpen(true)} aria-expanded={extensionsOpen}>
                    Skills &amp; training
                  </Button>
                </div>
              ) : null}
              <MemberForm member={current} councilId={scope.councilId} lookups={lookups.data} onSaved={() => void members.reload()} />
            </div>
          ) : (
            <Empty>Choose a member to view or change their record{canCreateMembers(user, scope.councilId) ? ', or add a new one' : ''}.</Empty>
          )}
        </div>
      </div>

      {skillsOpen ? <SkillFilterDrawer councilId={scope.councilId} onClose={() => setSkillsOpen(false)} /> : null}
      {extensionsOpen && current ? (
        <Drawer title={`Skills & training: ${current.MemberFirstName} ${current.MemberLastName}`} onClose={() => setExtensionsOpen(false)} wide>
          <ProfileExtensionsEditor memberId={current.id} showWorkingStatus={false} />
        </Drawer>
      ) : null}
    </>
  );
}

export default function MembersPage() {
  return (
    <RequireArea area="members">
      <Roster />
    </RequireArea>
  );
}
