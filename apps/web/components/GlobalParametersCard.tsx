'use client';
// Global Council Parameters Dashboard (Sprint 6I): the Super Admin's navy-on-white card on Global System Parameters
// (System Lookups until the Sprint 7C Extension). For any council it sets the tenant type (KOFC, or GENERIC for a
// white-labelled community organization; tenant.ts) and the base dues rate (dues.ts), through
// councils.setGlobalParameters, which only an Active Super Admin may call. Saving the signed-in council reloads its
// gates at once (featuresChanged), so the sidebar and labels switch tenant live.
import { useState } from 'react';
import { BusinessRuleError, councilLabel, councilTenantType, describeError, TENANT_TYPES, TENANT_VOCABULARY, type Council, type TenantType } from '@kofc/shared';
import { Button, Input, Notice, Select } from '@/components/ui';
import { formatMoney, parseNumberField } from '@/lib/format';
import { useSession, useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

const TENANT_HINT: Record<TenantType, string> = {
  KOFC: 'Knights of Columbus council: every fraternal extension is on.',
  GENERIC: `White-labelled ${TENANT_VOCABULARY.GENERIC.organizationName}: fraternal extensions hidden, ${TENANT_VOCABULARY.GENERIC.unit} vocabulary.`,
};

/** The edit form for one council; keyed by council id so it resets when the council changes. */
function ParametersForm({ council, onSaved }: { council: Council; onSaved: (saved: Council) => Promise<void> }) {
  const user = useUser();
  const { featuresChanged } = useSession();
  const [tenant, setTenant] = useState<TenantType>(councilTenantType(council));
  const [rate, setRate] = useState(String(council.base_dues_rate ?? ''));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);

  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const baseDuesRate = parseNumberField(rate, 'Base dues rate');
      if (baseDuesRate === null) throw new BusinessRuleError('INVALID_INPUT', 'Enter a base dues rate.');
      const saved = await db.councils.setGlobalParameters(user.memberId, council.id, { tenant_type: tenant, base_dues_rate: baseDuesRate });
      await onSaved(saved);
      if (saved.id === user.councilId) featuresChanged();
      setMessage({ tone: 'info', text: `Council ${saved.CouncilNumber} is now ${councilTenantType(saved)} with base dues of ${formatMoney(saved.base_dues_rate ?? 0)}.` });
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
        <label className="flex flex-col gap-1">
          <span className="text-sm uppercase tracking-wide text-muted">Tenant type (tenant_type)</span>
          <Select value={tenant} onChange={(e) => setTenant(e.target.value as TenantType)}>
            {TENANT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
          <span className="text-sm font-normal">{TENANT_HINT[tenant]}</span>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm uppercase tracking-wide text-muted">Base dues rate (base_dues_rate, $)</span>
          <Input inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="40.00" />
          <span className="text-sm font-normal">Yearly dues per Active or Inactive member, in whole cents.</span>
        </label>
      </div>
      {message ? (
        <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
          {message.text}
        </Notice>
      ) : null}
      <div>
        <Button type="submit" variant="gold" disabled={busy}>
          {busy ? 'Saving…' : 'Save council parameters'}
        </Button>
      </div>
    </form>
  );
}

/** The card itself. Rendered only on the Super-Admin-only Global System Parameters page; the data service enforces the tier too. */
export function GlobalParametersCard() {
  const user = useUser();
  const councils = useLoad(() => db.councils.list(), []);
  const [councilId, setCouncilId] = useState(user.councilId);
  const list = councils.data ?? [];
  const council = list.find((c) => c.id === councilId) ?? list[0];

  return (
    <section aria-labelledby="global-parameters" className="mb-6 rounded border-2 border-navy bg-white p-4 text-navy sm:p-6">
      <h2 id="global-parameters" className="font-serif text-2xl">
        Global Council Parameters Dashboard
      </h2>
      <p className="mt-1 text-base">Super Admins only. Changes take effect for the council at once.</p>
      <div className="mt-4 flex flex-col gap-4">
        {councils.error ? <Notice tone="error">{councils.error}</Notice> : null}
        {councils.loading && !councils.data ? (
          <p className="text-sm">Loading councils…</p>
        ) : council ? (
          <>
            <label className="flex max-w-xl flex-col gap-1">
              <span className="text-sm uppercase tracking-wide text-muted">Council</span>
              <Select value={council.id} onChange={(e) => setCouncilId(Number(e.target.value))}>
                {list.map((c) => (
                  <option key={c.id} value={c.id}>
                    {councilLabel(c)}
                  </option>
                ))}
              </Select>
            </label>
            <ParametersForm key={council.id} council={council} onSaved={() => councils.reload()} />
          </>
        ) : (
          <p className="text-sm">No councils yet.</p>
        )}
      </div>
    </section>
  );
}
