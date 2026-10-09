'use client';
// Sprint 6L Extension 4: the Local Category picker shared by the event, meeting and grant request forms. Choosing a
// category shows its fixed Supreme Mission Area (Category.SupremeMissionArea) as a bold read-only badge beside the
// picker. The badge is plain text in a status region, never a control: no form offers a way to override the coupling.
import { supremeMissionAreaOf, SUPREME_MISSION_AREA_BADGE_LABEL, type Category } from '@kofc/shared';
import { Field, Select, cx } from '@/components/ui';

/** The read-only Supreme Mission Area badge for one category; a dashed outline when none is chosen or coupled. */
export function SupremeMissionAreaBadge({ category }: { category: Pick<Category, 'SupremeMissionArea'> | null | undefined }) {
  const area = supremeMissionAreaOf(category);
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-1">
      <span className="text-xs font-bold uppercase tracking-wide text-navy">{SUPREME_MISSION_AREA_BADGE_LABEL}</span>
      <span
        className={cx(
          'inline-flex w-fit items-center gap-2 rounded border-2 px-3 py-1 text-sm font-bold uppercase tracking-wide',
          area ? 'border-navy bg-navy text-white' : 'border-dashed border-line bg-white text-muted',
        )}
        title="Set by the local category; it cannot be changed here."
      >
        {area ?? (category ? 'No Supreme coupling' : 'Choose a category')}
      </span>
    </div>
  );
}

/**
 * The Local Category dropdown with its Supreme Mission Area badge. `value` is a Category id, or null while none is
 * chosen; `required` drops the blank choice (events always carry a category).
 */
export function LocalCategoryField({
  categories,
  value,
  onChange,
  required = false,
  className,
}: {
  categories: Category[];
  value: number | null;
  onChange: (categoryId: number | null) => void;
  required?: boolean;
  className?: string;
}) {
  const chosen = categories.find((c) => c.id === value) ?? null;
  return (
    <div className={cx('grid grid-cols-1 items-start gap-3 sm:grid-cols-2', className)}>
      <Field label="Local Category">
        {(id) => (
          <Select id={id} value={value ?? ''} required={required} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}>
            {required ? null : <option value="">Choose a category…</option>}
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.Category}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <SupremeMissionAreaBadge category={chosen} />
    </div>
  );
}
