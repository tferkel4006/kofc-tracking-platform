'use client';
// Council Lookups: the lookup rows each council keeps for itself (Activities, DonationType, CouncilDonationMethod),
// read and written through the actor-checked lookups.listCouncilSpecific/saveCouncilSpecific/removeCouncilSpecific.
// Council Admins work on their own council and Super Admins pick any; the council's Financial Secretary and Treasurer
// see only the two donation tables (councilLookupTablesFor). The drivers apply the same rule (ADMIN_REQUIRED,
// COUNCIL_ACCESS_DENIED), so hiding a tab is not the only gate.
//
// Each grid is edited in place and saved as one batch, all or nothing: a clash anywhere (a duplicate name, an
// unknown method) leaves every row as it was and the drafts stay on screen to fix. Deletes are one row at a time
// and are refused (RECORD_IN_USE) while logged time or donations still point at the row; they never cascade.
import { useEffect, useState } from 'react';
import {
  councilLookupTablesFor,
  describeError,
  type CouncilLookupRecord,
  type CouncilLookupTableName,
} from '@kofc/shared';
import { CouncilSelect, RequireArea, useCouncilScope } from '@/components/CouncilScope';
import { Button, cx, Empty, Input, Notice, PageTitle, Pill, Select, Table, Tabs, Td } from '@/components/ui';
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
};

const NOUNS: Record<CouncilLookupTableName, string> = {
  Activities: 'activity',
  DonationType: 'donation type',
  CouncilDonationMethod: 'donation method',
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

function CouncilLookups() {
  const user = useUser();
  const scope = useCouncilScope();
  const tables = councilLookupTablesFor(user, scope.councilId);
  const [chosen, setChosen] = useState<CouncilLookupTableName | null>(null);
  const table = chosen && tables.includes(chosen) ? chosen : tables[0];

  return (
    <>
      <PageTitle actions={<CouncilSelect scope={scope} />}>Council lookups</PageTitle>
      {tables.length < 3 ? (
        <p className="mb-3 text-sm text-muted">As your council&apos;s finance officer you maintain its donation types and enabled donation methods.</p>
      ) : null}
      {table ? (
        <>
          <Tabs tabs={tables.map((t) => ({ id: t, label: TAB_LABELS[t] }))} value={table} onChange={setChosen} label="Council lookup tables" idPrefix="council-lookup" />
          <div id="council-lookup-panel" role="tabpanel" aria-labelledby={`council-lookup-tab-${table}`} className="pt-4">
            <LookupEditor key={`${scope.councilId}-${table}`} councilId={scope.councilId} table={table} />
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
