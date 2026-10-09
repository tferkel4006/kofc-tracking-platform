'use client';
// Feature Flags Control Center (Sprint 6R): every council's optional modules on one dense grid - a row per feature flag
// (features.ts: the five Sprint 6A 'flag_*' switches and the six Sprint 6R 'feature_*' ones), a column per council. Each
// checkbox saves at once (councils.setFeatureFlags); a module switched off disappears from that council's sidebar,
// pages, phone tabs and buttons. Super Admins only (canOpenFeatureFlagsControlCenter), the tier the drivers enforce
// (SUPER_ADMIN_REQUIRED). The panel used to sit on the Councils page.
import { useState } from 'react';
import { councilFeatureFlags, describeError, FEATURE_FLAG_LABELS, FEATURE_FLAG_NAMES, type Council, type FeatureFlagName } from '@kofc/shared';
import { RequireArea } from '@/components/CouncilScope';
import { cx, Notice, PageTitle, Panel } from '@/components/ui';
import { useSession, useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

function FlagGrid({ councils, onSaved }: { councils: Council[]; onSaved: () => Promise<void> }) {
  const user = useUser();
  const { featuresChanged } = useSession();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);

  const toggle = async (council: Council, name: FeatureFlagName, on: boolean) => {
    setBusy(`${council.id}-${name}`);
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

  const flagsOf = new Map(councils.map((c) => [c.id, councilFeatureFlags(c)]));

  return (
    <div className="flex flex-col gap-3">
      {message ? (
        <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
          {message.text}
        </Notice>
      ) : null}
      <div className="overflow-x-auto rounded border border-line">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">Feature flags of every council: a row per module, a column per council</caption>
          <thead>
            <tr className="bg-navy text-left text-xs uppercase tracking-wide text-white">
              <th scope="col" className="sticky left-0 bg-navy px-3 py-2 font-bold">
                Module
              </th>
              {councils.map((c) => {
                const on = FEATURE_FLAG_NAMES.filter((n) => flagsOf.get(c.id)?.[n]).length;
                return (
                  <th key={c.id} scope="col" className="px-2 py-2 text-center font-bold">
                    <span className="block whitespace-nowrap">No. {c.CouncilNumber}</span>
                    <span className="block font-normal normal-case tracking-normal">
                      {on} / {FEATURE_FLAG_NAMES.length} on
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {FEATURE_FLAG_NAMES.map((name, i) => (
              <tr key={name} className={cx('border-t border-line', i % 2 === 1 && 'bg-white')}>
                <th scope="row" className="sticky left-0 bg-inherit px-3 py-1.5 text-left align-top font-normal">
                  <span className="block font-bold">{FEATURE_FLAG_LABELS[name].label}</span>
                  <span className="block text-xs text-muted">
                    <code>{name}</code> · {FEATURE_FLAG_LABELS[name].hint}
                  </span>
                </th>
                {councils.map((c) => (
                  <td key={c.id} className="px-2 py-1.5 text-center align-middle">
                    <input
                      type="checkbox"
                      className="size-5"
                      aria-label={`${FEATURE_FLAG_LABELS[name].label} for council ${c.CouncilNumber}`}
                      checked={flagsOf.get(c.id)?.[name] ?? true}
                      disabled={busy !== null}
                      onChange={(e) => void toggle(c, name, e.target.checked)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ControlCenter() {
  const councils = useLoad(() => db.councils.list(), []);
  return (
    <>
      <PageTitle>Feature Flags Control Center</PageTitle>
      <Panel title="Module switches by council">
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">
            Clear a box to hide that module&apos;s sidebar links, pages, phone app tabs and buttons for every member of the council. The general ledger,
            the budget and the activity hour log always stay on. Nothing is deleted; ticking the box again restores the module.
          </p>
          {councils.error ? <Notice tone="error">{councils.error}</Notice> : null}
          {councils.data ? <FlagGrid councils={councils.data} onSaved={councils.reload} /> : <p className="text-sm text-muted">Loading councils…</p>}
        </div>
      </Panel>
    </>
  );
}

export default function FeatureFlagsPage() {
  return (
    <RequireArea area="feature-flags">
      <ControlCenter />
    </RequireArea>
  );
}
