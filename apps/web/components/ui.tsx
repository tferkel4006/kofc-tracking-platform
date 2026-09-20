'use client';
// Portal primitives. Colours are only the theme tokens declared in app/globals.css (navy, brand-red,
// gold, white, muted, line); the default Tailwind palette is switched off, so nothing else compiles.
import {
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

export const cx = (...parts: (string | false | null | undefined)[]): string => parts.filter(Boolean).join(' ');

const control =
  'w-full rounded border border-navy bg-white px-2 py-1.5 text-sm text-navy placeholder:text-muted disabled:border-line disabled:text-muted';

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={cx(control, className)} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...rest} className={cx(control, className)}>
      {children}
    </select>
  );
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...rest} className={cx(control, 'min-h-20', className)} />;
}

/** A labelled control. The label is wired to the control through a generated id. */
export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: (id: string) => ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cx('flex flex-col gap-1', className)}>
      <label htmlFor={id} className="text-xs font-bold uppercase tracking-wide text-navy">
        {label}
      </label>
      {children(id)}
      {hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </div>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'danger';

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: 'sm' | 'md' }) {
  const look: Record<ButtonVariant, string> = {
    primary: 'border-navy bg-navy text-white',
    secondary: 'border-navy bg-white text-navy',
    danger: 'border-brand-red bg-brand-red text-white',
  };
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        'rounded border-2 font-bold disabled:cursor-not-allowed disabled:opacity-45',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-4 py-1.5 text-sm',
        look[variant],
        className,
      )}
    />
  );
}

type PillTone = 'navy' | 'red' | 'redOutline' | 'gold' | 'outline';

/** Status chip. Gold is a fill carrying navy text (6.4:1), never gold text on white. */
export function Pill({ tone = 'navy', children }: { tone?: PillTone; children: ReactNode }) {
  const look: Record<PillTone, string> = {
    navy: 'border-navy bg-navy text-white',
    red: 'border-brand-red bg-brand-red text-white',
    redOutline: 'border-brand-red bg-white text-brand-red',
    gold: 'border-gold bg-gold text-navy',
    outline: 'border-navy bg-white text-navy',
  };
  return (
    <span className={cx('inline-block rounded-full border px-2 py-0.5 text-xs font-bold uppercase tracking-wide', look[tone])}>
      {children}
    </span>
  );
}

export function Notice({ tone, children, onDismiss }: { tone: 'error' | 'info'; children: ReactNode; onDismiss?: () => void }) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cx(
        'flex items-start gap-3 rounded border-2 bg-white px-3 py-2 text-sm',
        tone === 'error' ? 'border-brand-red text-brand-red' : 'border-navy text-navy',
      )}
    >
      <div className="flex-1">{children}</div>
      {onDismiss ? (
        <button type="button" aria-label="Dismiss" onClick={onDismiss} className="font-bold">
          ×
        </button>
      ) : null}
    </div>
  );
}

export function Panel({ title, actions, children, className }: { title: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx('rounded border border-line bg-white', className)}>
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-2">
        <h2 className="font-serif text-lg font-bold">{title}</h2>
        {actions}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function PageTitle({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-4">
      <h1 className="font-serif text-2xl font-bold">{children}</h1>
      {actions}
    </div>
  );
}

/**
 * Tab strip with arrow-key, Home and End navigation; the selected tab carries a gold bar.
 * Panels are rendered by the caller with role="tabpanel" and aria-labelledby={`${idPrefix}-tab-${id}`}.
 */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
  idPrefix,
}: {
  tabs: readonly { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
  label: string;
  idPrefix: string;
}) {
  const refs = useRef(new Map<T, HTMLButtonElement>());
  const move = (event: KeyboardEvent, index: number) => {
    const last = tabs.length - 1;
    const next = event.key === 'ArrowRight' ? (index === last ? 0 : index + 1) : event.key === 'ArrowLeft' ? (index === 0 ? last : index - 1) : event.key === 'Home' ? 0 : event.key === 'End' ? last : -1;
    if (next < 0) return;
    event.preventDefault();
    onChange(tabs[next].id);
    refs.current.get(tabs[next].id)?.focus();
  };
  return (
    <div role="tablist" aria-label={label} className="flex flex-wrap border-b-2 border-navy">
      {tabs.map((tab, i) => {
        const selected = tab.id === value;
        return (
          <button
            key={tab.id}
            ref={(el) => {
              if (el) refs.current.set(tab.id, el);
            }}
            id={`${idPrefix}-tab-${tab.id}`}
            role="tab"
            type="button"
            aria-selected={selected}
            aria-controls={`${idPrefix}-panel`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(e) => move(e, i)}
            className={cx(
              'border-b-4 px-4 py-2 text-sm font-bold',
              selected ? 'border-gold bg-white text-navy' : 'border-transparent bg-white text-muted hover:text-navy',
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

/** Dense data table with a navy header row. */
export function Table({ head, children, caption }: { head: readonly ReactNode[]; children: ReactNode; caption: string }) {
  return (
    <div className="overflow-x-auto rounded border border-line">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="bg-navy text-left text-xs uppercase tracking-wide text-white">
            {head.map((h, i) => (
              <th key={i} scope="col" className="px-3 py-2 font-bold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export const Td = ({ children, className }: { children?: ReactNode; className?: string }) => (
  <td className={cx('border-t border-line px-3 py-1.5 align-middle', className)}>{children}</td>
);

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded border border-dashed border-line p-4 text-center text-sm text-muted">{children}</p>;
}
