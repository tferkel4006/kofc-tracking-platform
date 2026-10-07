'use client';
// Council Lookups: the lookup rows each council keeps for itself (Activities, DonationType, CouncilDonationMethod, and
// CouncilBudgetCategory - the funds its annual budget is grouped under, Sprint 5Y-3),
// read and written through the actor-checked lookups.listCouncilSpecific/saveCouncilSpecific/removeCouncilSpecific.
// Council Admins work on their own council and Super Admins pick any; the council's Financial Secretary and Treasurer
// see only the donation tables and budget categories (councilLookupTablesFor). The drivers apply the same rule (ADMIN_REQUIRED,
// COUNCIL_ACCESS_DENIED), so hiding a tab is not the only gate.
//
// Each grid is edited in place and saved as one batch, all or nothing: a clash anywhere (a duplicate name, an
// unknown method) leaves every row as it was and the drafts stay on screen to fix. Deletes are one row at a time
// and are refused (RECORD_IN_USE) while logged time or donations still point at the row; they never cascade.
//
// Officer Election Parameters (Sprint 5U): the council's Admins and Super Admins tick which elected offices are open
// for nomination this season (elections.toggleRoleBallotStatus, saved per click). Appointed offices and the trustee
// ladder are never on a ballot, so only elected seats are listed.
//
// Meeting Agenda Templates (Sprint 5Y-6): the council's Admins, its Grand Knight and Super Admins pick one of the
// council's own meeting types (CouncilMeetingType) and write its default agenda outline (meetings.saveAgendaTemplate,
// CouncilAgendaTemplate). The Meeting center's schedule form pre-fills its agenda from it.
//
// Outbound Email Gateway (Sprint 6Z-Admin-Email-Perms, moved here from the Super Admin Councils page): the council's
// Admins and Super Admins point its portal email at the council's own SMTP server (components/EmailGatewayPanel).
import { useEffect, useState } from 'react';
import {
  AGENDA_TEMPLATE_MAX_LENGTH,
  canAdministerCouncil,
  canConfigureBallot,
  canManageAgendaTemplates,
  councilLookupTablesFor,
  describeError,
  formatTimestamp,
  type CouncilLookupRecord,
  type CouncilLookupTableName,
} from '@kofc/shared';
import { CouncilSelect, RequireArea, useCouncilScope } from '@/components/CouncilScope';
import { EmailGatewayPanel } from '@/components/EmailGatewayPanel';
import { Button, cx, Empty, Field, Input, Notice, PageTitle, Pill, Select, Table, Tabs, Td, Textarea } from '@/components/ui';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

interface Column {
  key: string;
  label: string;
  maxLength?: number;
  optional?: boolean;
  /** A drop-down of ids; the value is stored as a number. */
  options?: { value: number; label: string }[];
}

type Values = Record<string, string>;
interface DraftRow {
  /** Stable React key: the row id, or a local key for a row not yet saved. */
  key: string;
  id: number | null;
  values: Values;
  /** The stored values, to tell a changed row from an untouched one; null for a new row. */
  saved: Values | null;
}

const TAB_LABELS: Record<CouncilLookupTableName, string> = {
  Activities: 'Activities',
  DonationType: 'Donation types',
  CouncilDonationMethod: 'Enabled donation methods',
  CouncilBudgetCategory: 'Budget categories',
};

const NOUNS: Record<CouncilLookupTableName, string> = {
  Activities: 'activity',
  DonationType: 'donation type',
  CouncilDonationMethod: 'donation method',
  CouncilBudgetCategory: 'budget category',
};

function useColumns(table: CouncilLookupTableName): { columns: Column[] | null; error: string | null } {
  const options = useLoad(async () => {
    if (table === 'Activities') return (await db.lookups.list('Category')).map((c) => ({ value: c.id, label: c.Category }));
    if (table === 'CouncilDonationMethod') return (await db.donations.listAllMethods()).map((m) => ({ value: m.id, label: m.DonationMethod }));
    return [];
  }, [table]);
  if (!options.data) return { columns: null, error: options.error };
  const columns: Record<CouncilLookupTableName, Column[]> = {
    Activities: [
      { key: 'ActivityName', label: 'Activity name', maxLength: 100 },
      { key: 'ActivityDescription', label: 'Description', maxLength: 255 },
      { key: 'CategoryID', label: 'Category', options: options.data },
    ],
    DonationType: [{ key: 'DonationType', label: 'Donation type', maxLength: 100 }],
    CouncilDonationMethod: [
      { key: 'DonationMethodID', label: 'Method', options: options.data },
      { key: 'DonationMethodURL', label: 'QR code image URL', maxLength: 255, optional: true },
    ],
    CouncilBudgetCategory: [{ key: 'CategoryName', label: 'Budget category (fund)', maxLength: 255 }],
  };
  return { columns: columns[table], error: options.error };
}

const toValues = (row: Record<string, unknown>, columns: Column[]): Values =>
  Object.fromEntries(columns.map((c) => [c.key, row[c.key] == null ? '' : String(row[c.key])]));

const isChanged = (row: DraftRow) => row.saved === null || Object.keys(row.values).some((k) => row.values[k] !== row.saved![k]);

function toRecord(row: DraftRow, columns: Column[]): Record<string, unknown> {
  const out: Record<string, unknown> = row.id === null ? {} : { id: row.id };
  for (const c of columns) {
    const text = row.values[c.key] ?? '';
    out[c.key] = c.options ? (text === '' ? null : Number(text)) : c.optional && text.trim() === '' ? null : text;
  }
  return out;
}

let nextLocalKey = 0;

function LookupEditor({ councilId, table }: { councilId: number; table: CouncilLookupTableName }) {
  const user = useUser();
  const { columns, error: columnsError } = useColumns(table);
  const rows = useLoad(
    async () => (await db.lookups.listCouncilSpecific(user.memberId, councilId, table)) as unknown as Record<string, unknown>[],
    [user.memberId, councilId, table],
  );
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);

  // A fresh load (first open, after a save or delete) replaces the drafts with the stored rows.
  useEffect(() => {
    if (!rows.data || !columns) return;
    setDrafts(rows.data.map((r) => ({ key: String(r.id), id: r.id as number, values: toValues(r, columns), saved: toValues(r, columns) })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.data, columns === null]);

  if (!columns) return columnsError ? <Notice tone="error">{columnsError}</Notice> : <p className="text-sm text-muted">Loading…</p>;

  const noun = NOUNS[table];
  const pending = drafts.filter(isChanged);
  const set = (key: string, field: string, value: string) =>
    setDrafts((ds) => ds.map((d) => (d.key === key ? { ...d, values: { ...d.values, [field]: value } } : d)));
  const addRow = () =>
    setDrafts((ds) => [
      ...ds,
      { key: `new-${nextLocalKey++}`, id: null, saved: null, values: Object.fromEntries(columns.map((c) => [c.key, c.options?.[0] ? String(c.options[0].value) : ''])) },
    ]);

  const act = async (action: () => Promise<void>, done: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      setMessage({ tone: 'info', text: done });
      await rows.reload();
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setBusy(false);
      setConfirmId(null);
    }
  };

  const save = () =>
    void act(async () => {
      const records = pending.map((d) => toRecord(d, columns)) as CouncilLookupRecord<typeof table>[];
      await db.lookups.saveCouncilSpecific(user.memberId, councilId, table, records);
    }, `Saved ${pending.length} ${noun} row${pending.length === 1 ? '' : 's'}.`);

  return (
    <div className="flex flex-col gap-3">
      {message ? (
        <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
          {message.text}
        </Notice>
      ) : null}
      {rows.error ? <Notice tone="error">{rows.error}</Notice> : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={addRow}>
          Add {noun}
        </Button>
        <Button disabled={busy || pending.length === 0} onClick={save}>
          {busy ? 'Saving…' : `Save changes${pending.length ? ` (${pending.length})` : ''}`}
        </Button>
        {pending.length > 0 ? (
          <Button variant="secondary" disabled={busy} onClick={() => void rows.reload()}>
            Discard changes
          </Button>
        ) : null}
        <p className="text-xs text-muted">Changes are saved together: if one row is refused, none are written.</p>
      </div>

      <Table caption={`${TAB_LABELS[table]} for the council`} head={['ID', ...columns.map((c) => (c.optional ? `${c.label} (optional)` : c.label)), 'Status', 'Actions']}>
        {drafts.map((d) => {
          const changed = isChanged(d);
          return (
            <tr key={d.key} className={cx(changed && 'outline outline-2 -outline-offset-2 outline-gold')}>
              <Td className="text-muted">{d.id ?? 'new'}</Td>
              {columns.map((c) => (
                <Td key={c.key}>
                  {c.options ? (
                    <Select aria-label={c.label} value={d.values[c.key]} onChange={(e) => set(d.key, c.key, e.target.value)}>
                      {c.options.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <Input aria-label={c.label} value={d.values[c.key]} maxLength={c.maxLength} onChange={(e) => set(d.key, c.key, e.target.value)} />
                  )}
                </Td>
              ))}
              <Td>{d.id === null ? <Pill tone="gold">New</Pill> : changed ? <Pill tone="gold">Edited</Pill> : null}</Td>
              <Td>
                {d.id === null ? (
                  <Button size="sm" variant="secondary" onClick={() => setDrafts((ds) => ds.filter((x) => x.key !== d.key))}>
                    Remove
                  </Button>
                ) : confirmId === d.id ? (
                  <div className="flex gap-2">
                    <Button size="sm" variant="danger" disabled={busy} onClick={() => void act(() => db.lookups.removeCouncilSpecific(user.memberId, councilId, table, d.id!), `Deleted the ${noun}.`)}>
                      Confirm delete
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setConfirmId(null)}>
                      Keep
                    </Button>
                  </div>
                ) : (
                  <Button size="sm" variant="secondary" disabled={changed} title={changed ? 'Save or discard the edit first' : undefined} onClick={() => setConfirmId(d.id)}>
                    Delete…
                  </Button>
                )}
              </Td>
            </tr>
          );
        })}
      </Table>
      {rows.data && drafts.length === 0 ? <Empty>No {noun} rows yet. Use “Add {noun}” to create the first.</Empty> : null}
    </div>
  );
}

function ElectionParameters({ councilId }: { councilId: number }) {
  const user = useUser();
  const seats = useLoad(async () => (await db.elections.listOfficerSeats(councilId)).filter((s) => s.kind === 'elected'), [councilId]);
  const [busyRoleId, setBusyRoleId] = useState<number | null>(null);
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);

  const toggle = async (roleId: number, roleName: string, isOpen: boolean) => {
    setBusyRoleId(roleId);
    setMessage(null);
    try {
      await db.elections.toggleRoleBallotStatus(user.memberId, councilId, roleId, isOpen);
      setMessage({ tone: 'info', text: `${roleName} is ${isOpen ? 'now open for nomination' : 'off the ballot'} this season.` });
      await seats.reload();
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setBusyRoleId(null);
    }
  };

  if (seats.error) return <Notice tone="error">{seats.error}</Notice>;
  if (!seats.data) return <p className="text-sm text-muted">Loading…</p>;
  const openCount = seats.data.filter((s) => s.ballot?.IsUpForElection === 1).length;

  return (
    <div className="flex flex-col gap-3">
      {message ? (
        <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
          {message.text}
        </Notice>
      ) : null}
      <p className="text-xs text-muted">
        Tick each elected office open for nomination this season ({openCount} of {seats.data.length} open). Leave the Grand Knight unticked in the
        second year of a two-year term: the Grand Knight and trustees then keep their chairs when the year concludes. Each change saves at once.
      </p>
      <Table caption="Elected offices and their ballot status" head={['Office', 'Sitting officer', 'Status', 'Open for nomination']}>
        {seats.data.map((seat) => {
          const open = seat.ballot?.IsUpForElection === 1;
          const midYear = seat.ballot?.IsMidYearElection === 1;
          return (
            <tr key={seat.roleId} className={cx(open && 'outline outline-2 -outline-offset-2 outline-gold')}>
              <Td className="font-bold">{seat.roleName}</Td>
              <Td>{seat.holder ? `${seat.holder.firstName} ${seat.holder.lastName}` : <span className="text-muted">Vacant</span>}</Td>
              <Td>
                {midYear ? (
                  <Pill tone="red">Mid-year · closes {formatTimestamp(seat.ballot?.NominationsCloseAt)}</Pill>
                ) : open ? (
                  <Pill tone="navy">On ballot</Pill>
                ) : (
                  <Pill tone="outline">Not on ballot</Pill>
                )}
              </Td>
              <Td>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={open}
                    disabled={busyRoleId !== null}
                    onChange={(e) => void toggle(seat.roleId, seat.roleName, e.target.checked)}
                  />
                  <span className="sr-only">Open {seat.roleName} for nomination</span>
                  <span aria-hidden="true">{busyRoleId === seat.roleId ? 'Saving…' : open ? 'Open' : 'Closed'}</span>
                </label>
              </Td>
            </tr>
          );
        })}
      </Table>
    </div>
  );
}

const AGENDA_PLACEHOLDER = ['1. Opening prayer', '2. Roll call of officers', '3. Reading of the minutes', '4. Reports', '5. Old business', '6. New business', '7. Closing prayer'].join('\n');

function AgendaTemplates({ councilId }: { councilId: number }) {
  const user = useUser();
  const types = useLoad(() => db.meetings.listCouncilMeetingTypes(councilId), [councilId]);
  const [picked, setPicked] = useState<number | null>(null);
  const typeId = picked !== null && types.data?.some((t) => t.id === picked) ? picked : (types.data?.[0]?.id ?? null);
  // Tagged with its type so a slower answer for a type no longer shown is never put in the editor.
  const saved = useLoad(
    async () => ({ typeId, text: typeId === null ? '' : ((await db.meetings.getAgendaTemplate(councilId, typeId))?.TemplateText ?? '') }),
    [councilId, typeId],
  );
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);
  const current = saved.data?.typeId === typeId ? saved.data : undefined;

  useEffect(() => {
    if (current) setText(current.text);
  }, [current]);

  if (types.error) return <Notice tone="error">{types.error}</Notice>;
  if (!types.data) return <p className="text-sm text-muted">Loading…</p>;
  if (types.data.length === 0) return <Empty>This council has no meeting types yet, so there is nothing to write an agenda template for.</Empty>;

  const typeName = types.data.find((t) => t.id === typeId)?.TypeName ?? '';
  const dirty = current !== undefined && text.trim() !== current.text;

  const save = async (value: string) => {
    if (typeId === null) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await db.meetings.saveAgendaTemplate(user.memberId, councilId, typeId, value);
      setMessage({ tone: 'info', text: result ? `Saved the ${typeName} agenda template.` : `Removed the ${typeName} agenda template.` });
      await saved.reload();
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex max-w-3xl flex-col gap-3">
      {message ? (
        <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
          {message.text}
        </Notice>
      ) : null}
      {saved.error ? <Notice tone="error">{saved.error}</Notice> : null}
      <p className="text-xs text-muted">
        Pick one of the council&apos;s meeting types and write the outline its agendas start from. When anyone schedules a meeting of that type in the
        Meeting center, the agenda box fills with this outline, and they can still edit it for that meeting.
      </p>
      <Field label="Meeting type">
        {(id) => (
          <Select
            id={id}
            value={typeId ?? ''}
            disabled={busy}
            onChange={(e) => {
              setPicked(Number(e.target.value));
              setMessage(null);
            }}
          >
            {types.data!.map((t) => (
              <option key={t.id} value={t.id}>
                {t.TypeName}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Default agenda outline" hint={`Up to ${AGENDA_TEMPLATE_MAX_LENGTH.toLocaleString()} characters. Leave it empty and save to remove the template.`}>
        {(id) => (
          <Textarea
            id={id}
            rows={14}
            className="text-sm"
            value={text}
            maxLength={AGENDA_TEMPLATE_MAX_LENGTH}
            disabled={!current || busy}
            placeholder={AGENDA_PLACEHOLDER}
            onChange={(e) => setText(e.target.value)}
          />
        )}
      </Field>
      <div className="flex flex-wrap items-center gap-2">
        <Button disabled={busy || !dirty} onClick={() => void save(text)}>
          {busy ? 'Saving…' : 'Save template'}
        </Button>
        {dirty ? (
          <Button variant="secondary" disabled={busy} onClick={() => setText(current?.text ?? '')}>
            Discard changes
          </Button>
        ) : null}
        {current && current.text !== '' ? <Pill tone="navy">Template saved</Pill> : <Pill tone="outline">No template yet</Pill>}
        {dirty ? <Pill tone="gold">Unsaved changes</Pill> : null}
      </div>
    </div>
  );
}

type LookupTab = CouncilLookupTableName | 'elections' | 'agenda' | 'email';

function CouncilLookups() {
  const user = useUser();
  const scope = useCouncilScope();
  const tables = councilLookupTablesFor(user, scope.councilId);
  const tabs: { id: LookupTab; label: string }[] = [
    ...tables.map((t) => ({ id: t, label: TAB_LABELS[t] })),
    ...(canConfigureBallot(user, scope.councilId) ? [{ id: 'elections' as const, label: 'Officer Election Parameters' }] : []),
    ...(canManageAgendaTemplates(user, scope.councilId) ? [{ id: 'agenda' as const, label: 'Meeting Agenda Templates' }] : []),
    ...(canAdministerCouncil(user, scope.councilId) ? [{ id: 'email' as const, label: 'Outbound Email Gateway' }] : []),
  ];
  const [chosen, setChosen] = useState<LookupTab | null>(null);
  const table = chosen && tabs.some((t) => t.id === chosen) ? chosen : tabs[0]?.id;

  return (
    <>
      <PageTitle actions={<CouncilSelect scope={scope} />}>Council lookups</PageTitle>
      {tables.length > 0 && tables.length < 3 ? (
        <p className="mb-3 text-sm text-muted">As your council&apos;s finance officer you maintain its donation types and enabled donation methods.</p>
      ) : null}
      {table ? (
        <>
          <Tabs tabs={tabs} value={table} onChange={setChosen} label="Council lookup tables" idPrefix="council-lookup" />
          <div id="council-lookup-panel" role="tabpanel" aria-labelledby={`council-lookup-tab-${table}`} className="pt-4">
            {table === 'elections' ? (
              <ElectionParameters key={scope.councilId} councilId={scope.councilId} />
            ) : table === 'agenda' ? (
              <AgendaTemplates key={scope.councilId} councilId={scope.councilId} />
            ) : table === 'email' ? (
              <EmailGatewayPanel key={scope.councilId} councilId={scope.councilId} />
            ) : (
              <LookupEditor key={`${scope.councilId}-${table}`} councilId={scope.councilId} table={table} />
            )}
          </div>
        </>
      ) : (
        <Notice tone="error">Your role cannot maintain this council&apos;s lookups.</Notice>
      )}
    </>
  );
}

export default function CouncilLookupsPage() {
  return (
    <RequireArea area="council-lookups">
      <CouncilLookups />
    </RequireArea>
  );
}
