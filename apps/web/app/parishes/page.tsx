'use client';
// Parishes & pastors: the council's parishes on top; choosing one opens its pastors underneath, where a pastor
// can also be moved to another of the council's parishes. Admins work on their own council, Super Admins pick
// any. The drivers enforce the same rules (ADMIN_REQUIRED, COUNCIL_ACCESS_DENIED), and a parish that still
// has pastors cannot be deleted (RECORD_IN_USE).
import { useState } from 'react';
import { canMaintainCouncilRecords, type Parish, type Pastor } from '@kofc/shared';
import { CouncilSelect, RequireArea, useCouncilScope } from '@/components/CouncilScope';
import { RecordGrid, type Draft, type FormField, type Selection } from '@/components/RecordGrid';
import { PageTitle } from '@/components/ui';
import { blankToNull, formatAddress, formatPersonName, formatPhone } from '@/lib/format';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

const PARISH_FIELDS: FormField[] = [
  { key: 'Name', label: 'Parish name', maxLength: 100, wide: true },
  { key: 'StreetAddress1', label: 'Street address', maxLength: 255, wide: true },
  { key: 'StreetAddress2', label: 'Street address line 2', maxLength: 255, optional: true, wide: true },
  { key: 'City', label: 'City', maxLength: 50 },
  { key: 'State', label: 'State', maxLength: 50 },
  { key: 'Phone', label: 'Phone', type: 'tel', maxLength: 50, optional: true },
];

const parishDraft = (p: Parish): Draft => ({
  Name: p.Name,
  StreetAddress1: p.StreetAddress1,
  StreetAddress2: p.StreetAddress2 ?? '',
  City: p.City,
  State: p.State,
  Phone: p.Phone ?? '',
});

const pastorDraft = (p: Pastor): Draft => ({
  FirstName: p.FirstName,
  LastName: p.LastName,
  Phone: p.Phone ?? '',
  Email: p.Email ?? '',
  ParishID: String(p.ParishID),
});

function Pastors({ parish, parishes, canEdit }: { parish: Parish; parishes: Parish[]; canEdit: boolean }) {
  const user = useUser();
  const pastors = useLoad(() => db.pastors.listByParish(parish.id), [parish.id]);
  const [selected, setSelected] = useState<Selection>(null);

  const fields: FormField[] = [
    { key: 'FirstName', label: 'First name', maxLength: 50 },
    { key: 'LastName', label: 'Last name', maxLength: 50 },
    { key: 'Phone', label: 'Phone', type: 'tel', maxLength: 50, optional: true },
    { key: 'Email', label: 'Email', type: 'email', maxLength: 50, optional: true },
    { key: 'ParishID', label: 'Parish', options: parishes.map((p) => ({ value: String(p.id), label: p.Name })), wide: true },
  ];

  const save = async (d: Draft, row: Pastor | null): Promise<Pastor> => {
    const values = { FirstName: d.FirstName, LastName: d.LastName, Phone: blankToNull(d.Phone), Email: blankToNull(d.Email), ParishID: Number(d.ParishID) };
    const saved = row
      ? await db.pastors.update(user.memberId, row.id, values)
      : await db.pastors.create(user.memberId, { ...values, Phone: values.Phone ?? undefined, Email: values.Email ?? undefined });
    await pastors.reload();
    return saved;
  };

  return (
    <RecordGrid
      noun="pastor"
      title={`Pastors of ${parish.Name}`}
      rows={pastors.data}
      error={pastors.error}
      canEdit={canEdit}
      columns={[
        { label: 'Pastor', render: (p) => formatPersonName(p.FirstName, p.LastName) },
        { label: 'Phone', render: (p) => formatPhone(p.Phone), className: 'whitespace-nowrap' },
        { label: 'Email', render: (p) => p.Email || '–' },
      ]}
      fields={fields}
      blank={() => ({ FirstName: '', LastName: '', Phone: '', Email: '', ParishID: String(parish.id) })}
      toDraft={pastorDraft}
      rowLabel={(p) => `${p.FirstName} ${p.LastName}`}
      onSave={save}
      onRemove={async (p) => {
        await db.pastors.remove(user.memberId, p.id);
        await pastors.reload();
      }}
      selected={selected}
      onSelect={setSelected}
    />
  );
}

function Parishes() {
  const user = useUser();
  const scope = useCouncilScope();
  const parishes = useLoad(() => db.parishes.listByCouncil(scope.councilId), [scope.councilId]);
  const [selected, setSelected] = useState<Selection>(null);
  const canEdit = canMaintainCouncilRecords(user, scope.councilId);
  const current = typeof selected === 'number' ? parishes.data?.find((p) => p.id === selected) : undefined;

  const save = async (d: Draft, row: Parish | null): Promise<Parish> => {
    const values = {
      Name: d.Name,
      StreetAddress1: d.StreetAddress1,
      StreetAddress2: blankToNull(d.StreetAddress2),
      City: d.City,
      State: d.State,
      Phone: blankToNull(d.Phone),
    };
    const saved = row
      ? await db.parishes.update(user.memberId, row.id, values)
      : await db.parishes.create(user.memberId, {
          ...values,
          StreetAddress2: values.StreetAddress2 ?? undefined,
          Phone: values.Phone ?? undefined,
          CouncilID: scope.councilId,
        });
    await parishes.reload();
    return saved;
  };

  return (
    <>
      <PageTitle actions={<CouncilSelect scope={scope} />}>Parishes &amp; pastors</PageTitle>
      <div className="flex flex-col gap-6">
        <RecordGrid
          key={scope.councilId}
          noun="parish"
          title="Parishes"
          rows={parishes.data}
          error={parishes.error}
          canEdit={canEdit}
          columns={[
            { label: 'Parish', render: (p) => p.Name },
            { label: 'Address', render: (p) => formatAddress(p) },
            { label: 'Phone', render: (p) => formatPhone(p.Phone), className: 'whitespace-nowrap' },
          ]}
          fields={PARISH_FIELDS}
          blank={() => ({ Name: '', StreetAddress1: '', StreetAddress2: '', City: '', State: '', Phone: '' })}
          toDraft={parishDraft}
          rowLabel={(p) => p.Name}
          matches={(p, q) => `${p.Name} ${p.City}`.toLowerCase().includes(q)}
          onSave={save}
          onRemove={async (p) => {
            await db.parishes.remove(user.memberId, p.id);
            await parishes.reload();
          }}
          selected={selected}
          onSelect={setSelected}
        />
        {current && parishes.data ? <Pastors key={current.id} parish={current} parishes={parishes.data} canEdit={canEdit} /> : null}
      </div>
    </>
  );
}

export default function ParishesPage() {
  return (
    <RequireArea area="parishes">
      <Parishes />
    </RequireArea>
  );
}
