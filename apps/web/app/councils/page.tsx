'use client';
// Councils: every council in CouncilNumber order, with add, edit and delete. Super Admins only; the drivers
// enforce the same tier on every write (SUPER_ADMIN_REQUIRED). A council that anything still points at
// (members, parishes, events, donations, ...) cannot be deleted, and the message lists what is in use.
// Sprint 6A: the master admin's Module Feature Flags panel switches a council's optional modules on and off
// (councils.setFeatureFlags); a module switched off disappears from that council's sidebar, pages and phone tabs.
// Sprint 6Z-Email-Proxy: the Configure Outbound Email Gateway card saves a council's own SMTP server. The password goes
// to /api/councils/email-gateway once, comes back sealed, and only the sealed value is stored (councils.setEmailGateway).
import { useState, type FormEvent } from 'react';
import {
  canMaintainCouncils,
  councilEmailGateway,
  councilFeatureFlags,
  councilLabel,
  describeError,
  EMAIL_PROVIDER_PRESETS,
  EMAIL_PROVIDERS,
  FEATURE_FLAG_LABELS,
  FEATURE_FLAG_NAMES,
  REDACTED_SECRET,
  SMTP_PORTS,
  type Council,
  type EmailGatewaySettings,
  type EmailProvider,
  type FeatureFlagName,
} from '@kofc/shared';
import { RequireArea } from '@/components/CouncilScope';
import { RecordGrid, type Draft, type FormField, type Selection } from '@/components/RecordGrid';
import { Button, Field, Notice, PageTitle, Panel, Select } from '@/components/ui';
import { blankToNull, formatPhone, parseNumberField } from '@/lib/format';
import { useSession, useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

const FIELDS: FormField[] = [
  { key: 'CouncilNumber', label: 'Council number', type: 'number' },
  { key: 'CouncilName', label: 'Council name', maxLength: 100 },
  { key: 'State', label: 'State', maxLength: 50 },
  { key: 'Phone', label: 'Phone', type: 'tel', maxLength: 50, optional: true },
  { key: 'Email', label: 'Email', type: 'email', maxLength: 100, optional: true },
];

const toDraft = (c: Council): Draft => ({
  CouncilNumber: String(c.CouncilNumber),
  CouncilName: c.CouncilName,
  State: c.State,
  Phone: c.Phone ?? '',
  Email: c.Email ?? '',
});

/** One switch per feature flag for the chosen council; each change is saved at once. Super Admins only. */
function FeatureFlagsPanel({ councils, onSaved }: { councils: Council[]; onSaved: () => Promise<void> }) {
  const user = useUser();
  const { featuresChanged } = useSession();
  const [councilId, setCouncilId] = useState(user.councilId);
  const [busy, setBusy] = useState<FeatureFlagName | null>(null);
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);
  const council = councils.find((c) => c.id === councilId) ?? councils[0];
  if (!council) return null;
  const flags = councilFeatureFlags(council);

  const toggle = async (name: FeatureFlagName, on: boolean) => {
    setBusy(name);
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

  return (
    <Panel title="Module feature flags">
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted">
          Switch off a module to hide its sidebar links, pages, phone app tabs and buttons for every member of the council. The financial engine and the
          activity hour log always stay on. Nothing is deleted; switching a module back on restores it.
        </p>
        {message ? (
          <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
            {message.text}
          </Notice>
        ) : null}
        <Field label="Council">
          {(id) => (
            <Select id={id} value={council.id} onChange={(e) => setCouncilId(Number(e.target.value))}>
              {councils.map((c) => (
                <option key={c.id} value={c.id}>
                  {councilLabel(c)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <ul className="flex flex-col gap-2">
          {FEATURE_FLAG_NAMES.map((name) => (
            <li key={name}>
              <label className="flex items-start gap-3 rounded border-2 border-line p-3">
                <input
                  type="checkbox"
                  className="mt-0.5 size-5"
                  checked={flags[name]}
                  disabled={busy !== null}
                  onChange={(e) => void toggle(name, e.target.checked)}
                />
                <span>
                  <span className="block font-bold">
                    {FEATURE_FLAG_LABELS[name].label} <span className="text-xs font-normal text-muted">({name})</span>
                  </span>
                  <span className="block text-sm text-muted">{FEATURE_FLAG_LABELS[name].hint}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}

const EMAIL_GATEWAY_ROUTE = '/api/councils/email-gateway';

/** Posts to the gateway route, which seals the password; resolves to the settings to store, or null after a clear. */
async function saveGatewayOnServer(body: Record<string, unknown>): Promise<EmailGatewaySettings | null> {
  const res = await fetch(EMAIL_GATEWAY_ROUTE, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const answer = (await res.json().catch(() => null)) as { settings?: EmailGatewaySettings | null; message?: string } | null;
  if (!res.ok || !answer || answer.settings === undefined) throw new Error(answer?.message ?? `The server answered HTTP ${res.status}.`);
  return answer.settings;
}

const gatewayInput = 'w-full rounded border-4 border-hc-gold bg-black px-3 py-2 text-base text-white placeholder:text-white/70';

/**
 * Configure Outbound Email Gateway (Sprint 6Z-Email-Proxy): one council's SMTP server for portal email. Super Admins
 * only, like the rest of the page. A saved password is never shown or sent back: the box shows dots, and leaving it
 * empty keeps the saved one while the host and username stay the same.
 */
function EmailGatewayPanel({ councils, onSaved }: { councils: Council[]; onSaved: () => Promise<void> }) {
  const user = useUser();
  const [councilId, setCouncilId] = useState(user.councilId);
  const council = councils.find((c) => c.id === councilId) ?? councils[0];
  const saved = councilEmailGateway(council);
  const [provider, setProvider] = useState<EmailProvider>(saved?.EmailProvider ?? 'Custom SMTP');
  const [host, setHost] = useState(saved?.SmtpHost ?? '');
  const [port, setPort] = useState(String(saved?.SmtpPort ?? 587));
  const [username, setUsername] = useState(saved?.SmtpUsername ?? '');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);
  if (!council) return null;

  const pick = (id: number) => {
    const next = councilEmailGateway(councils.find((c) => c.id === id));
    setCouncilId(id);
    setProvider(next?.EmailProvider ?? 'Custom SMTP');
    setHost(next?.SmtpHost ?? '');
    setPort(String(next?.SmtpPort ?? 587));
    setUsername(next?.SmtpUsername ?? '');
    setPassword('');
    setMessage(null);
  };

  const chooseProvider = (value: EmailProvider) => {
    setProvider(value);
    const preset = EMAIL_PROVIDER_PRESETS[value];
    if (preset) {
      setHost(preset.host);
      setPort(String(preset.port));
    }
  };

  const store = async (settings: EmailGatewaySettings | null, done: string) => {
    await db.councils.setEmailGateway(user.memberId, council.id, settings);
    await onSaved();
    setMessage({ tone: 'info', text: done });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const settings = await saveGatewayOnServer({
        councilId: council.id,
        EmailProvider: provider,
        SmtpHost: host,
        SmtpPort: Number(port),
        SmtpUsername: username,
        ...(password ? { password } : {}),
      });
      await store(settings, `Council ${council.CouncilNumber} now sends its email through ${settings?.SmtpHost ?? host}.`);
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setPassword('');
      setBusy(false);
    }
  };

  const clear = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await saveGatewayOnServer({ councilId: council.id, clear: true });
      await store(null, `Council ${council.CouncilNumber} is back on the default email route.`);
      setProvider('Custom SMTP');
      setHost('');
      setPort('587');
      setUsername('');
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="email-gateway-title" data-surface="black" className="mt-4 rounded border-4 border-hc-gold bg-black p-4 font-bold text-white sm:p-6">
      <h2 id="email-gateway-title" className="mb-1 border-b-4 border-hc-gold pb-1 font-serif text-xl">
        Configure Outbound Email Gateway
      </h2>
      <p className="mb-4 text-sm">
        Restricted to Super Admins. Send this council&apos;s portal email (welcome and password-reset notices) through its own mail server instead of
        the portal&apos;s default. The password is sealed on the server before it is saved and is never shown again.
      </p>
      {message ? (
        <div className="mb-3">
          <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
            {message.text}
          </Notice>
        </div>
      ) : null}
      <form onSubmit={(e) => void submit(e)} className="grid gap-3 sm:grid-cols-2" autoComplete="off">
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-xs uppercase tracking-wide text-hc-gold">Council</span>
          <select value={council.id} onChange={(e) => pick(Number(e.target.value))} className={gatewayInput} disabled={busy}>
            {councils.map((c) => (
              <option key={c.id} value={c.id}>
                {councilLabel(c)}
                {councilEmailGateway(c) ? ' (gateway on)' : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-hc-gold">Provider</span>
          <select value={provider} onChange={(e) => chooseProvider(e.target.value as EmailProvider)} className={gatewayInput} disabled={busy}>
            {EMAIL_PROVIDERS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-hc-gold">Host</span>
          <input value={host} onChange={(e) => setHost(e.target.value)} placeholder="smtp.example.org" maxLength={253} required className={gatewayInput} disabled={busy} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-hc-gold">Port</span>
          <select value={port} onChange={(e) => setPort(e.target.value)} className={gatewayInput} disabled={busy}>
            {SMTP_PORTS.map((p) => (
              <option key={p} value={p}>
                {p}
                {p === 465 ? ' (TLS)' : p === 587 ? ' (STARTTLS)' : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-hc-gold">Username</span>
          <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="council@example.org" maxLength={255} required className={gatewayInput} disabled={busy} />
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-xs uppercase tracking-wide text-hc-gold">Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={saved ? `${REDACTED_SECRET} (saved - leave empty to keep it)` : 'App password or SMTP password'}
            autoComplete="new-password"
            spellCheck={false}
            maxLength={1000}
            required={!saved}
            className={gatewayInput}
            disabled={busy}
          />
          {saved ? (
            <span className="text-sm">
              Saved password: <span aria-label="hidden">{REDACTED_SECRET}</span>
            </span>
          ) : null}
        </label>
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <Button type="submit" variant="gold" disabled={busy || !host.trim() || !username.trim() || (!saved && !password)}>
            {busy ? 'Saving…' : 'Save gateway'}
          </Button>
          {saved ? (
            <Button variant="danger" disabled={busy} onClick={() => void clear()}>
              Remove gateway
            </Button>
          ) : null}
        </div>
      </form>
    </section>
  );
}

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
      Email: blankToNull(d.Email),
    };
    const saved = row
      ? await db.councils.update(user.memberId, row.id, values)
      : await db.councils.create(user.memberId, { ...values, Phone: values.Phone ?? undefined, Email: values.Email ?? undefined });
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
          { label: 'Email', render: (c) => c.Email || '–' },
        ]}
        fields={FIELDS}
        blank={() => ({ CouncilNumber: '', CouncilName: '', State: '', Phone: '', Email: '' })}
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
      {canMaintainCouncils(user) && councils.data ? <FeatureFlagsPanel councils={councils.data} onSaved={councils.reload} /> : null}
      {canMaintainCouncils(user) && councils.data ? <EmailGatewayPanel councils={councils.data} onSaved={councils.reload} /> : null}
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
