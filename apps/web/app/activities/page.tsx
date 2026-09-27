'use client';
// Activities: the council's standing activities (members log time against these from the phone app), split into
// two tabs. "Active Initiatives" holds activities nobody has logged time against yet; they can be added, edited
// and deleted. The moment any time is logged the activity moves to "Activity History" (activities.listSummaries),
// where choosing it lists every entry with the member, hours and notes and a running total. Admins work on their
// own council, Super Admins pick any. The drivers enforce the same rules (ADMIN_REQUIRED, COUNCIL_ACCESS_DENIED),
// and an activity with logged time cannot be deleted (RECORD_IN_USE), so its hours stay on record.
import { useEffect, useState } from 'react';
import { canMaintainCouncilRecords, formatHours, type Activities, type ActivitySummary } from '@kofc/shared';
import { CouncilSelect, RequireArea, useCouncilScope } from '@/components/CouncilScope';
import { RecordGrid, type Draft, type Selection } from '@/components/RecordGrid';
import { cx, Empty, Field, Notice, PageTitle, Panel, Pill, Select, Table, Tabs, Td } from '@/components/ui';
import { formatDecimalHours, formatFullDate, formatPersonName } from '@/lib/format';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

type Tab = 'active' | 'history';

/** Every entry logged against one activity, newest first, with the total in a gold-edged box. */
function ActivityLog({ activity }: { activity: Activities }) {
  const log = useLoad(() => db.activityTime.listByActivity(activity.id), [activity.id]);
  if (log.error) return <Notice tone="error">{log.error}</Notice>;
  if (!log.data) return <p className="text-sm text-muted">Loading the time log…</p>;
  return (
    <Panel title={activity.ActivityName}>
      <div className="mb-4 flex items-stretch gap-4">
        <div className="rounded border-l-8 border-gold bg-white px-4 py-3 ring-1 ring-line">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">Total hours reported</p>
          <p className="text-3xl font-bold">{formatDecimalHours(log.data.totalHours)}</p>
          <p className="text-xs text-muted">
            {log.data.entries.length} entr{log.data.entries.length === 1 ? 'y' : 'ies'} from{' '}
            {new Set(log.data.entries.map((e) => e.row.MemberID)).size} member{new Set(log.data.entries.map((e) => e.row.MemberID)).size === 1 ? '' : 's'}
          </p>
        </div>
        <p className="self-center text-sm text-muted">{activity.ActivityDescription}</p>
      </div>
      {log.data.entries.length === 0 ? (
        <Empty>No time has been logged against this activity.</Empty>
      ) : (
        <Table caption={`Time logged against ${activity.ActivityName}`} head={['Date', 'Member', 'Hours', 'Notes']}>
          {log.data.entries.map((e) => (
            <tr key={e.row.id}>
              <Td className="whitespace-nowrap">{formatFullDate(e.row.ActivityDate)}</Td>
              <Td>{formatPersonName(e.firstName, e.lastName)}</Td>
              <Td className="whitespace-nowrap">{formatHours(e.row.Hours)}</Td>
              <Td className="text-xs">{e.row.ActivityNotes || '–'}</Td>
            </tr>
          ))}
          <tr className="font-bold">
            <Td colSpan={2} className="text-right">
              Total
            </Td>
            <Td className="whitespace-nowrap">{formatHours(log.data.totalHours)}</Td>
            <Td />
          </tr>
        </Table>
      )}
    </Panel>
  );
}

function ActivityHistory({ summaries, categoryName }: { summaries: ActivitySummary[]; categoryName: Map<number, string> }) {
  const [chosen, setChosen] = useState<number | null>(null);
  useEffect(() => {
    if (chosen !== null && !summaries.some((s) => s.activity.id === chosen)) setChosen(null);
  }, [summaries, chosen]);
  const current = summaries.find((s) => s.activity.id === chosen)?.activity;

  if (summaries.length === 0) {
    return <Empty>No activity has logged time yet. An activity moves here as soon as a member logs hours against it.</Empty>;
  }
  return (
    <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <Table caption="Activities with logged time" head={['Activity', 'Category', 'Entries', 'Hours', 'Last logged']}>
        {summaries.map((s) => {
          const active = s.activity.id === chosen;
          return (
            <tr key={s.activity.id} className={cx(active && 'outline outline-2 -outline-offset-2 outline-gold')}>
              <Td>
                <button type="button" aria-current={active ? 'true' : undefined} onClick={() => setChosen(s.activity.id)} className="text-left font-bold underline">
                  {s.activity.ActivityName}
                </button>
              </Td>
              <Td>
                <Pill tone="outline">{categoryName.get(s.activity.CategoryID) ?? '–'}</Pill>
              </Td>
              <Td>{s.entryCount}</Td>
              <Td>{formatDecimalHours(s.totalHours)}</Td>
              <Td className="whitespace-nowrap">{formatFullDate(s.lastLoggedOn)}</Td>
            </tr>
          );
        })}
      </Table>
      {current ? <ActivityLog key={current.id} activity={current} /> : <Empty>Choose an activity to see who logged time against it.</Empty>}
    </div>
  );
}

function ActivityCatalog() {
  const user = useUser();
  const scope = useCouncilScope();
  const categories = useLoad(() => db.lookups.list('Category'), []);
  const summaries = useLoad(() => db.activities.listSummaries(scope.councilId), [scope.councilId]);
  const [tab, setTab] = useState<Tab>('active');
  const [selected, setSelected] = useState<Selection>(null);
  const [categoryFilter, setCategoryFilter] = useState<number | 'all'>('all');
  const canEdit = canMaintainCouncilRecords(user, scope.councilId);
  const categoryName = new Map((categories.data ?? []).map((c) => [c.id, c.Category]));
  const inCategory = (s: ActivitySummary) => categoryFilter === 'all' || s.activity.CategoryID === categoryFilter;
  const active = summaries.data?.filter((s) => !s.archived && inCategory(s)).map((s) => s.activity);
  const history = (summaries.data ?? []).filter((s) => s.archived && inCategory(s));
  const archivedCount = (summaries.data ?? []).filter((s) => s.archived).length;
  const activeCount = (summaries.data?.length ?? 0) - archivedCount;

  const save = async (d: Draft, row: Activities | null): Promise<Activities> => {
    const values = { ActivityName: d.ActivityName, ActivityDescription: d.ActivityDescription, CategoryID: Number(d.CategoryID) };
    const saved = row
      ? await db.activities.update(user.memberId, row.id, values)
      : await db.activities.create(user.memberId, { ...values, CouncilID: scope.councilId });
    await summaries.reload();
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
        Activities
      </PageTitle>
      <Tabs
        label="Activity lists"
        idPrefix="activities"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'active', label: `Active Initiatives (${activeCount})` },
          { id: 'history', label: `Activity History (${archivedCount})` },
        ]}
      />
      <div id="activities-panel" role="tabpanel" aria-labelledby={`activities-tab-${tab}`} className="mt-4">
        {summaries.error || categories.error ? <Notice tone="error">{summaries.error ?? categories.error}</Notice> : null}
        {tab === 'active' ? (
          <RecordGrid
            key={scope.councilId}
            noun="activity"
            title="Active initiatives"
            rows={active}
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
              await summaries.reload();
            }}
            selected={selected}
            onSelect={setSelected}
          />
        ) : summaries.data ? (
          <ActivityHistory summaries={history} categoryName={categoryName} />
        ) : null}
      </div>
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
