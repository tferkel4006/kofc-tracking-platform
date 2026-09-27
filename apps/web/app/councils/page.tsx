'use client';
// Councils: every council in CouncilNumber order, with add, edit and delete. Super Admins only; the drivers
// enforce the same tier on every write (SUPER_ADMIN_REQUIRED). A council that anything still points at
// (members, parishes, events, donations, ...) cannot be deleted, and the message lists what is in use.
import { useState } from 'react';
import { canMaintainCouncils, type Council } from '@kofc/shared';
import { RequireArea } from '@/components/CouncilScope';
import { RecordGrid, type Draft, type FormField, type Selection } from '@/components/RecordGrid';
import { PageTitle } from '@/components/ui';
import { blankToNull, formatPhone, parseNumberField } from '@/lib/format';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

const FIELDS: FormField[] = [
  { key: 'CouncilNumber', label: 'Council number', type: 'number' },
  { key: 'CouncilName', label: 'Council name', maxLength: 100 },
  { key: 'State', label: 'State', maxLength: 50 },
  { key: 'Phone', label: 'Phone', type: 'tel', maxLength: 50, optional: true },
];

const toDraft = (c: Council): Draft => ({
  CouncilNumber: String(c.CouncilNumber),
  CouncilName: c.CouncilName,
  State: c.State,
  Phone: c.Phone ?? '',
});

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
    };
    const saved = row
      ? await db.councils.update(user.memberId, row.id, values)
      : await db.councils.create(user.memberId, { ...values, Phone: values.Phone ?? undefined });
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
        ]}
        fields={FIELDS}
        blank={() => ({ CouncilNumber: '', CouncilName: '', State: '', Phone: '' })}
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
