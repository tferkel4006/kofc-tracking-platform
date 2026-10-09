'use client';
// The maintenance screens' shared layout: a dense, searchable grid of rows on the left and, on the right, a form
// that adds a row or edits the selected one, with a two-step delete. Every form value is text; the page turns the
// draft into typed fields and the driver validates them again, so a refusal (bad field, SUPER_ADMIN_REQUIRED,
// COUNCIL_ACCESS_DENIED, RECORD_IN_USE) is reported in the form, never hidden.
import { useEffect, useState, type ReactNode } from 'react';
import { describeError } from '@kofc/shared';
import { Button, cx, Empty, Field, Input, Notice, Panel, Select, Table, Td } from '@/components/ui';

export type Draft = Record<string, string>;

export interface FormField {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'email' | 'tel';
  maxLength?: number;
  optional?: boolean;
  /** A drop-down instead of a text box. */
  options?: readonly { value: string; label: string }[];
  /** Spans the whole form row. */
  wide?: boolean;
  /** A custom control (e.g. a member picker) that reads and writes this field's text; `id` is the label's target. */
  render?: (value: string, set: (value: string) => void, disabled: boolean, id: string) => ReactNode;
}

export interface GridColumn<T> {
  label: string;
  render: (row: T) => ReactNode;
  className?: string;
}

type Message = { tone: 'error' | 'info'; text: string };

/** The grid's selection: a row id, 'new' for the add form, or nothing. */
export type Selection = number | 'new' | null;

export function RecordGrid<T extends { id: number }>({
  noun,
  title,
  rows,
  error,
  columns,
  fields,
  blank,
  toDraft,
  canEdit,
  canEditRow,
  canCreate = canEdit,
  onSave,
  onRemove,
  selected,
  onSelect,
  matches,
  rowLabel,
  aside,
}: {
  /** Singular, lower case: "parish". */
  noun: string;
  title: string;
  rows: T[] | undefined;
  error?: string | null;
  columns: GridColumn<T>[];
  fields: FormField[];
  blank: () => Draft;
  toDraft: (row: T) => Draft;
  /** False shows the rows read-only and hides add, save and delete. */
  canEdit: boolean;
  /** Per-row edit rights, overriding canEdit for an existing row (e.g. a member's own private list). */
  canEditRow?: (row: T) => boolean;
  /** Whether "Add" is offered; default canEdit. */
  canCreate?: boolean;
  /** Creates (`row` null) or updates the row; resolves to the saved row, which becomes the selection. */
  onSave: (draft: Draft, row: T | null) => Promise<T>;
  onRemove: (row: T) => Promise<void>;
  selected: Selection;
  onSelect: (selection: Selection) => void;
  /** Search filter; omit to hide the search box. */
  matches?: (row: T, query: string) => boolean;
  /** The selected row's heading in the form. */
  rowLabel: (row: T) => string;
  /** Shown under the form, e.g. the selected parish's pastors. */
  aside?: ReactNode;
}) {
  const [query, setQuery] = useState('');
  // Lives here, not in the form, because adding or deleting a row remounts the form.
  const [message, setMessage] = useState<Message | null>(null);
  const select = (next: Selection) => {
    setMessage(null);
    onSelect(next);
  };
  const current = typeof selected === 'number' ? (rows?.find((r) => r.id === selected) ?? null) : null;
  const shown = (rows ?? []).filter((r) => !matches || !query.trim() || matches(r, query.trim().toLowerCase()));

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_30rem] items-start gap-4">
      <Panel
        title={`${title} (${shown.length}${query.trim() ? ` of ${rows?.length ?? 0}` : ''})`}
        actions={canCreate ? <Button size="sm" onClick={() => select('new')}>Add {noun}</Button> : null}
      >
        {error ? <Notice tone="error">{error}</Notice> : null}
        {matches ? (
          <Field label="Search" className="mb-3">
            {(id) => <Input id={id} type="search" value={query} onChange={(e) => setQuery(e.target.value)} />}
          </Field>
        ) : null}
        {rows && shown.length === 0 ? (
          <Empty>{rows.length === 0 ? `No ${noun} records yet.${canCreate ? ` Use “Add ${noun}” to create the first.` : ''}` : 'Nothing matches the search.'}</Empty>
        ) : null}
        {shown.length > 0 ? (
          <Table caption={title} head={columns.map((c) => c.label)}>
            {shown.map((row) => {
              const active = selected === row.id;
              return (
                <tr
                  key={row.id}
                  onClick={() => select(row.id)}
                  className={cx('cursor-pointer hover:bg-white', active && 'outline outline-2 -outline-offset-2 outline-gold')}
                >
                  {columns.map((c, i) => (
                    <Td key={c.label} className={c.className}>
                      {i === 0 ? (
                        <button type="button" aria-current={active ? 'true' : undefined} className="text-left font-bold underline">
                          {c.render(row)}
                        </button>
                      ) : (
                        c.render(row)
                      )}
                    </Td>
                  ))}
                </tr>
              );
            })}
          </Table>
        ) : null}
      </Panel>

      <div className="flex flex-col gap-4">
        {message ? (
          <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
            {message.text}
          </Notice>
        ) : null}
        {selected === 'new' || current ? (
          <RecordForm
            key={current ? current.id : 'new'}
            noun={noun}
            row={current}
            heading={current ? rowLabel(current) : `Add ${noun}`}
            fields={fields}
            initial={current ? toDraft(current) : blank()}
            canEdit={current ? (canEditRow ? canEditRow(current) : canEdit) : canCreate}
            report={setMessage}
            onSave={async (draft) => onSelect((await onSave(draft, current)).id)}
            onRemove={
              current
                ? async () => {
                    await onRemove(current);
                    onSelect(null);
                  }
                : null
            }
            onCancel={() => select(null)}
          />
        ) : (
          <Empty>
            Choose a {noun} to view{canCreate ? ` or change it, or add a new one` : ''}.
          </Empty>
        )}
        {current ? aside : null}
      </div>
    </div>
  );
}

function RecordForm<T>({
  noun,
  row,
  heading,
  fields,
  initial,
  canEdit,
  onSave,
  onRemove,
  onCancel,
  report,
}: {
  noun: string;
  row: T | null;
  heading: string;
  fields: FormField[];
  initial: Draft;
  canEdit: boolean;
  onSave: (draft: Draft) => Promise<void>;
  onRemove: (() => Promise<void>) | null;
  onCancel: () => void;
  report: (message: Message | null) => void;
}) {
  const [draft, setDraft] = useState<Draft>(initial);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  // A reload after saving hands in fresh values for the same row.
  const initialKey = JSON.stringify(initial);
  useEffect(() => setDraft(JSON.parse(initialKey) as Draft), [initialKey]);

  const run = async (action: () => Promise<void>, done: string) => {
    setBusy(true);
    report(null);
    try {
      await action();
      report({ tone: 'info', text: done });
    } catch (err) {
      report({ tone: 'error', text: describeError(err) });
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };
  const set = (key: string) => (value: string) => setDraft((d) => ({ ...d, [key]: value }));

  return (
    <Panel title={heading}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void run(() => onSave(draft), row ? 'Saved.' : `Added the ${noun}.`);
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          {fields.map((f) => (
            <Field key={f.key} label={f.optional ? `${f.label} (optional)` : f.label} className={f.wide ? 'col-span-2' : undefined}>
              {(id) =>
                f.render ? (
                  f.render(draft[f.key] ?? '', set(f.key), !canEdit, id)
                ) : f.options ? (
                  <Select id={id} value={draft[f.key] ?? ''} disabled={!canEdit} required={!f.optional} onChange={(e) => set(f.key)(e.target.value)}>
                    {f.optional ? <option value="">–</option> : null}
                    {f.options.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Input
                    id={id}
                    type={f.type ?? 'text'}
                    value={draft[f.key] ?? ''}
                    maxLength={f.maxLength}
                    required={!f.optional}
                    disabled={!canEdit}
                    onChange={(e) => set(f.key)(e.target.value)}
                  />
                )
              }
            </Field>
          ))}
        </div>
        {canEdit ? (
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy}>
              {busy ? 'Saving…' : row ? 'Save changes' : `Add ${noun}`}
            </Button>
            <Button variant="secondary" onClick={row ? () => setDraft(initial) : onCancel}>
              {row ? 'Undo changes' : 'Cancel'}
            </Button>
            {onRemove ? (
              confirming ? (
                <>
                  <Button variant="danger" disabled={busy} onClick={() => void run(onRemove, `Deleted the ${noun}.`)}>
                    Confirm delete
                  </Button>
                  <Button variant="secondary" onClick={() => setConfirming(false)}>
                    Keep
                  </Button>
                </>
              ) : (
                <Button variant="secondary" className="ml-auto" onClick={() => setConfirming(true)}>
                  Delete…
                </Button>
              )
            ) : null}
          </div>
        ) : (
          <p className="text-xs text-muted">Read only: your role cannot change this {noun}.</p>
        )}
      </form>
    </Panel>
  );
}
