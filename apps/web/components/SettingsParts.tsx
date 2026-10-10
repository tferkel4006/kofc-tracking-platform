'use client';
// Sprint 7C: the number forms behind the Council Wide Settings page (/setup/council-settings) and the Super Admin's
// Platform Limits card on Global System Parameters (/system-settings/global-settings; on /lookups until the Sprint 7C
// Extension). Each field shows its plain-English label, its range and what it does; saving sends only the fields that
// changed. The rules (labels, ranges, quarter-hour steps) come from council-settings.ts, which the
// data service applies again on save.
import { useState } from 'react';
import { BusinessRuleError, describeError, PLATFORM_SETTING_NAMES, PLATFORM_SETTING_RULES, type PlatformSettings } from '@kofc/shared';
import { Button, Input, Notice } from '@/components/ui';
import { parseNumberField } from '@/lib/format';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

export interface NumberSettingRule {
  label: string;
  hint: string;
  min: number;
  max: number;
  quarterHours?: boolean;
  unit: string;
}

/** A form of number settings; `onSave` receives only the changed values. Keyed by its owner so it resets on reload. */
export function NumberSettingsForm<K extends string>({
  names,
  rules,
  values,
  submitLabel,
  onSave,
}: {
  names: readonly K[];
  rules: Record<K, NumberSettingRule>;
  values: Record<K, number>;
  submitLabel: string;
  onSave: (changed: Partial<Record<K, number>>) => Promise<string>;
}) {
  const [text, setText] = useState<Record<K, string>>(() => Object.fromEntries(names.map((n) => [n, String(values[n])])) as Record<K, string>);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);

  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const changed: Partial<Record<K, number>> = {};
      for (const n of names) {
        const v = parseNumberField(text[n], rules[n].label);
        if (v === null) throw new BusinessRuleError('INVALID_INPUT', `Enter a value for "${rules[n].label}".`);
        if (v !== values[n]) changed[n] = v;
      }
      if (Object.keys(changed).length === 0) {
        setMessage({ tone: 'info', text: 'Nothing changed.' });
        return;
      }
      setMessage({ tone: 'info', text: await onSave(changed) });
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {names.map((n) => {
          const r = rules[n];
          return (
            <label key={n} className="flex flex-col gap-1">
              <span className="text-sm font-bold">{r.label}</span>
              <span className="flex items-center gap-2">
                <Input
                  inputMode={r.quarterHours ? 'decimal' : 'numeric'}
                  type="number"
                  min={r.min}
                  max={r.max}
                  step={r.quarterHours ? 0.25 : 1}
                  className="w-32"
                  value={text[n]}
                  onChange={(e) => setText({ ...text, [n]: e.target.value })}
                />
                <span className="text-sm text-muted">{r.unit}</span>
              </span>
              <span className="text-sm font-normal">
                {r.hint} Allowed: {r.min} to {r.max.toLocaleString('en-US')}
                {r.quarterHours ? ', in quarter hours' : ''}.
              </span>
            </label>
          );
        })}
      </div>
      {message ? (
        <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
          {message.text}
        </Notice>
      ) : null}
      <div>
        <Button type="submit" variant="gold" disabled={busy}>
          {busy ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </form>
  );
}

/** The universal limits every council shares, as the recorder and text boxes read them (defaults until loaded). */
export function usePlatformSettings(): PlatformSettings | undefined {
  return useLoad(() => db.councils.getPlatformSettings(), []).data;
}

/**
 * Platform Limits on Global System Parameters (System Lookups until the Sprint 7C Extension): Super Admins only (the page
 * is theirs; the data service enforces the tier too).
 */
export function PlatformSettingsCard() {
  const user = useUser();
  const settings = useLoad(() => db.councils.getPlatformSettings(), []);
  const data = settings.data;
  return (
    <section aria-labelledby="platform-limits" className="mb-6 rounded border-2 border-navy bg-white p-4 text-navy sm:p-6">
      <h2 id="platform-limits" className="font-serif text-2xl">
        Platform Limits
      </h2>
      <p className="mt-1 text-base">Super Admins only. These limits apply to every council at once.</p>
      <div className="mt-4">
        {settings.error ? <Notice tone="error">{settings.error}</Notice> : null}
        {data ? (
          <NumberSettingsForm
            key={JSON.stringify(data)}
            names={PLATFORM_SETTING_NAMES}
            rules={PLATFORM_SETTING_RULES}
            values={data}
            submitLabel="Save platform limits"
            onSave={async (changed) => {
              await db.councils.setPlatformSettings(user.memberId, changed);
              await settings.reload();
              return 'Platform limits saved. They apply to every council now.';
            }}
          />
        ) : (
          <p className="text-sm">Loading platform limits…</p>
        )}
      </div>
    </section>
  );
}
