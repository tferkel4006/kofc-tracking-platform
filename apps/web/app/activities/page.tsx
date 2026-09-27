'use client';
// Activities catalog: the council's standing activities (members log time against these from the phone app),
// grouped by category through a filter. Admins work on their own council, Super Admins pick any. The drivers
// enforce the same rules (ADMIN_REQUIRED, COUNCIL_ACCESS_DENIED), and an activity with logged time cannot be
// deleted (RECORD_IN_USE), so its hours stay on record.
import { useState } from 'react';
import { canMaintainCouncilRecords, type Activities } from '@kofc/shared';
import { CouncilSelect, RequireArea, useCouncilScope } from '@/components/CouncilScope';
import { RecordGrid, type Draft, type Selection } from '@/components/RecordGrid';
import { Field, PageTitle, Pill, Select } from '@/components/ui';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

function ActivityCatalog() {
  const user = useUser();
  const scope = useCouncilScope();
  const categories = useLoad(() => db.lookups.list('Category'), []);
  const activities = useLoad(() => db.activities.listByCouncil(scope.councilId), [scope.councilId]);
  const [selected, setSelected] = useState<Selection>(null);
  const [categoryFilter, setCategoryFilter] = useState<number | 'all'>('all');
  const canEdit = canMaintainCouncilRecords(user, scope.councilId);
  const categoryName = new Map((categories.data ?? []).map((c) => [c.id, c.Category]));
  const rows = activities.data?.filter((a) => categoryFilter === 'all' || a.CategoryID === categoryFilter);

  const save = async (d: Draft, row: Activities | null): Promise<Activities> => {
    const values = { ActivityName: d.ActivityName, ActivityDescription: d.ActivityDescription, CategoryID: Number(d.CategoryID) };
    const saved = row
      ? await db.activities.update(user.memberId, row.id, values)
      : await db.activities.create(user.memberId, { ...values, CouncilID: scope.councilId });
    await activities.reload();
    return saved;
  };

  return (
    <>
      <PageTitle
        actions={
          <div className="flex items-end gap-3">
            <Field label="Category" className="w-48">
              {(id) => (
                <Select id={id} value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
                  <option value="all">All categories</option>
                  {(categories.data ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.Category}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <CouncilSelect scope={scope} />
          </div>
        }
      >
        Activities catalog
      </PageTitle>
      <RecordGrid
        key={scope.councilId}
        noun="activity"
        title="Activities"
        rows={rows}
        error={activities.error ?? categories.error}
        canEdit={canEdit}
        columns={[
          { label: 'Activity', render: (a) => a.ActivityName },
          { label: 'Category', render: (a) => <Pill tone="outline">{categoryName.get(a.CategoryID) ?? '–'}</Pill> },
          { label: 'Description', render: (a) => a.ActivityDescription, className: 'text-xs' },
        ]}
        fields={[
          { key: 'ActivityName', label: 'Activity name', maxLength: 100, wide: true },
          {
            key: 'CategoryID',
            label: 'Category',
            options: (categories.data ?? []).map((c) => ({ value: String(c.id), label: c.Category })),
            wide: true,
          },
          { key: 'ActivityDescription', label: 'Description', maxLength: 255, wide: true },
        ]}
        blank={() => ({
          ActivityName: '',
          ActivityDescription: '',
          CategoryID: String(categoryFilter === 'all' ? (categories.data?.[0]?.id ?? '') : categoryFilter),
        })}
        toDraft={(a) => ({ ActivityName: a.ActivityName, ActivityDescription: a.ActivityDescription, CategoryID: String(a.CategoryID) })}
        rowLabel={(a) => a.ActivityName}
        matches={(a, q) => `${a.ActivityName} ${a.ActivityDescription}`.toLowerCase().includes(q)}
        onSave={save}
        onRemove={async (a) => {
          await db.activities.remove(user.memberId, a.id);
          await activities.reload();
        }}
        selected={selected}
        onSelect={setSelected}
      />
    </>
  );
}

export default function ActivitiesPage() {
  return (
    <RequireArea area="activities">
      <ActivityCatalog />
    </RequireArea>
  );
}
