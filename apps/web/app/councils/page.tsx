'use client';
// Councils: every council in CouncilNumber order, with add, edit and delete. Super Admins only; the drivers
// enforce the same tier on every write (SUPER_ADMIN_REQUIRED). A council that anything still points at
// (members, parishes, events, donations, ...) cannot be deleted, and the message lists what is in use.
// Sprint 6A: the master admin's Module Feature Flags panel switches a council's optional modules on and off
// (councils.setFeatureFlags); a module switched off disappears from that council's sidebar, pages and phone tabs.
import { useState } from 'react';
import {
  canMaintainCouncils,
  councilFeatureFlags,
  councilLabel,
  describeError,
  FEATURE_FLAG_LABELS,
  FEATURE_FLAG_NAMES,
  type Council,
  type FeatureFlagName,
} from '@kofc/shared';
import { RequireArea } from '@/components/CouncilScope';
import { RecordGrid, type Draft, type FormField, type Selection } from '@/components/RecordGrid';
import { Field, Notice, PageTitle, Panel, Select } from '@/components/ui';
import { blankToNull, formatPhone, parseNumberField } from '@/lib/format';
import { useSession, useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

const FIELDS: FormField[] = [
  { key: 'CouncilNumber', label: 'Council number', type: 'number' },
  { key: 'CouncilName', label: 'Council name', maxLength: 100 },
  { key: 'State', label: 'State', maxLength: 50 },
  { key: 'Phone', label: 'Phone', type: 'tel', maxLength: 50, optional: true },
  { key: 'Email', label: 'Email', type: 'email', maxLength: 100, optional: true },
];

const toDraft = (c: Council): Draft => ({
  CouncilNumber: String(c.CouncilNumber),
  CouncilName: c.CouncilName,
  State: c.State,
  Phone: c.Phone ?? '',
  Email: c.Email ?? '',
});

/** One switch per feature flag for the chosen council; each change is saved at once. Super Admins only. */
function FeatureFlagsPanel({ councils, onSaved }: { councils: Council[]; onSaved: () => Promise<void> }) {
  const user = useUser();
  const { featuresChanged } = useSession();
  const [councilId, setCouncilId] = useState(user.councilId);
  const [busy, setBusy] = useState<FeatureFlagName | null>(null);
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);
  const council = councils.find((c) => c.id === councilId) ?? councils[0];
  if (!council) return null;
  const flags = councilFeatureFlags(council);

  const toggle = async (name: FeatureFlagName, on: boolean) => {
    setBusy(name);
    setMessage(null);
    try {
      await db.councils.setFeatureFlags(user.memberId, council.id, { [name]: on });
      await onSaved();
      if (council.id === user.councilId) featuresChanged();
      setMessage({ tone: 'info', text: `${FEATURE_FLAG_LABELS[name].label} is now ${on ? 'on' : 'off'} for council ${council.CouncilNumber}.` });
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Panel title="Module feature flags">
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted">
          Switch off a module to hide its sidebar links, pages, phone app tabs and buttons for every member of the council. The financial engine and the
          activity hour log always stay on. Nothing is deleted; switching a module back on restores it.
        </p>
        {message ? (
          <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
            {message.text}
          </Notice>
        ) : null}
        <Field label="Council">
          {(id) => (
            <Select id={id} value={council.id} onChange={(e) => setCouncilId(Number(e.target.value))}>
              {councils.map((c) => (
                <option key={c.id} value={c.id}>
                  {councilLabel(c)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <ul className="flex flex-col gap-2">
          {FEATURE_FLAG_NAMES.map((name) => (
            <li key={name}>
              <label className="flex items-start gap-3 rounded border-2 border-line p-3">
                <input
                  type="checkbox"
                  className="mt-0.5 size-5"
                  checked={flags[name]}
                  disabled={busy !== null}
                  onChange={(e) => void toggle(name, e.target.checked)}
                />
                <span>
                  <span className="block font-bold">
                    {FEATURE_FLAG_LABELS[name].label} <span className="text-xs font-normal text-muted">({name})</span>
                  </span>
                  <span className="block text-sm text-muted">{FEATURE_FLAG_LABELS[name].hint}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}

function Councils() {
  const user = useUser();
  const councils = useLoad(() => db.councils.list(), []);
  const [selected, setSelected] = useState<Selection>(null);

  const save = async (d: Draft, row: Council | null): Promise<Council> => {
    const values = {
      CouncilNumber: parseNumberField(d.CouncilNumber, 'Council number') ?? Number.NaN,
      CouncilName: d.CouncilName,
      State: d.State,
      Phone: blankToNull(d.Phone),
      Email: blankToNull(d.Email),
    };
    const saved = row
      ? await db.councils.update(user.memberId, row.id, values)
      : await db.councils.create(user.memberId, { ...values, Phone: values.Phone ?? undefined, Email: values.Email ?? undefined });
    await councils.reload();
    return saved;
  };

  return (
    <>
      <PageTitle>Councils</PageTitle>
      <RecordGrid
        noun="council"
        title="Councils"
        rows={councils.data}
        error={councils.error}
        canEdit={canMaintainCouncils(user)}
        columns={[
          { label: 'Council', render: (c) => `${c.CouncilNumber} · ${c.CouncilName}` },
          { label: 'State', render: (c) => c.State },
          { label: 'Phone', render: (c) => formatPhone(c.Phone), className: 'whitespace-nowrap' },
          { label: 'Email', render: (c) => c.Email || '–' },
        ]}
        fields={FIELDS}
        blank={() => ({ CouncilNumber: '', CouncilName: '', State: '', Phone: '', Email: '' })}
        toDraft={toDraft}
        rowLabel={(c) => `Council ${c.CouncilNumber}`}
        matches={(c, q) => `${c.CouncilNumber} ${c.CouncilName} ${c.State}`.toLowerCase().includes(q)}
        onSave={save}
        onRemove={async (c) => {
          await db.councils.remove(user.memberId, c.id);
          await councils.reload();
        }}
        selected={selected}
        onSelect={setSelected}
      />
      {canMaintainCouncils(user) && councils.data ? <FeatureFlagsPanel councils={councils.data} onSaved={councils.reload} /> : null}
    </>
  );
}

export default function CouncilsPage() {
  return (
    <RequireArea area="councils">
      <Councils />
    </RequireArea>
  );
}
