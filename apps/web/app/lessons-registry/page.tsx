'use client';
// Lessons Registry: every council's lessons learned in one searchable list, so councils learn from their peers.
// Open to Admins and Super Admins (lessonsLearned.listGlobalRegistry refuses anyone else with ADMIN_REQUIRED).
// Text and date bounds go to the driver; the three multi-select filters (councils, event categories, lessons
// categories) are applied here, because the registry call takes at most one id per filter. Lessons are changed
// on the post-event ledger; `canModify` only marks the rows of the reader's own council's events.
import { useState } from 'react';
import { councilLabel, sortCouncils, type LessonsRegistryEntry } from '@kofc/shared';
import { RequireArea } from '@/components/CouncilScope';
import { Button, cx, Empty, Field, Input, Notice, PageTitle, Panel, Pill, Table, Td } from '@/components/ui';
import { formatFullDate } from '@/lib/format';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

interface Option {
  value: number;
  label: string;
}

/** A drop-down of checkboxes; nothing ticked means "all". */
function MultiSelect({ label, options, value, onChange }: { label: string; options: Option[]; value: number[]; onChange: (next: number[]) => void }) {
  const chosen = new Set(value);
  const summary = value.length === 0 ? 'All' : value.length === 1 ? (options.find((o) => o.value === value[0])?.label ?? '1 selected') : `${value.length} selected`;
  return (
    <div className="flex w-72 flex-col gap-1">
      <span className="text-xs font-bold uppercase tracking-wide text-navy">{label}</span>
      <details className="relative">
        <summary className="cursor-pointer list-none rounded border border-navy bg-white px-2 py-1.5 text-sm">
          <span className="flex justify-between gap-2">
            <span className="truncate">{summary}</span>
            <span aria-hidden="true">▾</span>
          </span>
        </summary>
        <fieldset className="absolute z-10 mt-1 flex max-h-72 w-full flex-col gap-1 overflow-y-auto rounded border border-navy bg-white p-2">
          <legend className="sr-only">{label}</legend>
          {options.map((o) => (
            <label key={o.value} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={chosen.has(o.value)}
                onChange={(e) => onChange(e.target.checked ? [...value, o.value] : value.filter((v) => v !== o.value))}
              />
              {o.label}
            </label>
          ))}
          {value.length > 0 ? (
            <button type="button" className="mt-1 self-start text-xs font-bold underline" onClick={() => onChange([])}>
              Clear
            </button>
          ) : null}
        </fieldset>
      </details>
    </div>
  );
}

function Registry() {
  const user = useUser();
  const options = useLoad(async () => {
    const [councils, eventCategories, lessonCategories] = await Promise.all([
      db.councils.list(),
      db.lookups.list('Category'),
      db.lookups.list('LessonsLearnedCategory'),
    ]);
    return {
      councils: sortCouncils(councils).map((c) => ({ value: c.id, label: councilLabel(c) })),
      eventCategories: eventCategories.map((c) => ({ value: c.id, label: c.Category })),
      lessonCategories: lessonCategories.map((c) => ({ value: c.id, label: c.LessonsLearnedCategory })),
    };
  }, []);

  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [councilIds, setCouncilIds] = useState<number[]>([]);
  const [eventCategoryIds, setEventCategoryIds] = useState<number[]>([]);
  const [lessonCategoryIds, setLessonCategoryIds] = useState<number[]>([]);

  const registry = useLoad(
    () =>
      db.lessonsLearned.listGlobalRegistry(user.memberId, {
        search: search.trim() || undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      }),
    [user.memberId, search, fromDate, toDate],
  );

  const eventCategoryNames = new Set(
    (options.data?.eventCategories ?? []).filter((c) => eventCategoryIds.includes(c.value)).map((c) => c.label),
  );
  const shown = (registry.data ?? []).filter(
    (e: LessonsRegistryEntry) =>
      (councilIds.length === 0 || e.councils.some((c) => councilIds.includes(c.id))) &&
      (eventCategoryIds.length === 0 || eventCategoryNames.has(e.eventCategory)) &&
      (lessonCategoryIds.length === 0 || lessonCategoryIds.includes(e.lesson.LeassonsLearnedCategoryID)),
  );
  const byCategory = new Map<string, number>();
  for (const e of shown) byCategory.set(e.lessonsCategory, (byCategory.get(e.lessonsCategory) ?? 0) + 1);
  const filtered = search || fromDate || toDate || councilIds.length || eventCategoryIds.length || lessonCategoryIds.length;

  const clear = () => {
    setSearch('');
    setFromDate('');
    setToDate('');
    setCouncilIds([]);
    setEventCategoryIds([]);
    setLessonCategoryIds([]);
  };

  return (
    <>
      <PageTitle>Lessons learned registry</PageTitle>
      <Panel title="Search the network" className="mb-4">
        <div className="flex flex-wrap items-end gap-4">
          <Field label="Text in the lesson or event name" className="w-72">
            {(id) => <Input id={id} type="search" value={search} onChange={(e) => setSearch(e.target.value)} />}
          </Field>
          <Field label="Events from" className="w-44">
            {(id) => <Input id={id} type="date" value={fromDate} max={toDate || undefined} onChange={(e) => setFromDate(e.target.value)} />}
          </Field>
          <Field label="Events to" className="w-44">
            {(id) => <Input id={id} type="date" value={toDate} min={fromDate || undefined} onChange={(e) => setToDate(e.target.value)} />}
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-4">
          <MultiSelect label="Councils" options={options.data?.councils ?? []} value={councilIds} onChange={setCouncilIds} />
          <MultiSelect label="Event categories" options={options.data?.eventCategories ?? []} value={eventCategoryIds} onChange={setEventCategoryIds} />
          <MultiSelect label="Lessons categories" options={options.data?.lessonCategories ?? []} value={lessonCategoryIds} onChange={setLessonCategoryIds} />
          <Button variant="secondary" disabled={!filtered} onClick={clear}>
            Clear filters
          </Button>
        </div>
      </Panel>

      {registry.error || options.error ? <Notice tone="error">{registry.error ?? options.error}</Notice> : null}

      <Panel
        title={`Lessons (${shown.length}${filtered ? ` of ${registry.data?.length ?? 0}` : ''})`}
        actions={
          <div className="flex flex-wrap gap-2">
            {[...byCategory].map(([name, count]) => (
              <Pill key={name} tone="outline">
                {name}: {count}
              </Pill>
            ))}
          </div>
        }
      >
        {registry.data && shown.length === 0 ? <Empty>{filtered ? 'No lesson matches these filters.' : 'No council has recorded lessons learned yet.'}</Empty> : null}
        {shown.length > 0 ? (
          <Table caption="Lessons learned across councils" head={['Event', 'Councils', 'Event category', 'Lessons category', 'Lesson']}>
            {shown.map((e) => (
              <tr key={e.lesson.id} className={cx(e.canModify && 'border-l-8 border-gold')}>
                <Td>
                  <span className="font-bold">{e.eventName}</span>
                  <span className="block text-xs text-muted">{formatFullDate(e.eventStartDate)}</span>
                  {e.canModify ? <span className="text-xs font-bold">Your council</span> : null}
                </Td>
                <Td>{e.councils.map((c) => c.CouncilNumber).join(', ')}</Td>
                <Td>{e.eventCategory}</Td>
                <Td>
                  <Pill tone="navy">{e.lessonsCategory}</Pill>
                </Td>
                <Td className="whitespace-pre-wrap">{e.lesson.LessonsLearnedDescription}</Td>
              </tr>
            ))}
          </Table>
        ) : null}
        <p className="mt-2 text-xs text-muted">Newest events first. Lessons of your own council&apos;s events are marked in gold and are changed on the post-event ledger.</p>
      </Panel>
    </>
  );
}

export default function LessonsRegistryPage() {
  return (
    <RequireArea area="lessons-registry">
      <Registry />
    </RequireArea>
  );
}
