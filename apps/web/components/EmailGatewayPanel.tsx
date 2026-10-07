'use client';
// Configure Outbound Email Gateway (Sprint 6Z-Email-Proxy; moved to Council Lookups in Sprint 6Z-Admin-Email-Perms): one
// council's own SMTP server for portal email. The council's Active Admins and any Super Admin use it (canAdministerCouncil;
// the drivers and /api/councils/email-gateway apply the same rule). Sprint 6Y: the password goes to the route once and
// stays on the server, sealed in the Centralized Encrypted Credentials Vault; the route answers only its masked
// CredentialStatus, and the page stores just the four Council columns (councils.setEmailGateway). The box shows dots
// for a saved password, and leaving it empty keeps the saved one while the host and username stay the same.
import { useEffect, useState, type FormEvent } from 'react';
import {
  councilEmailGateway,
  councilLabel,
  describeError,
  EMAIL_PROVIDER_PRESETS,
  EMAIL_PROVIDERS,
  REDACTED_SECRET,
  SMTP_PORTS,
  type CredentialStatus,
  type EmailGatewaySettings,
  type EmailProvider,
} from '@kofc/shared';
import { Button, Notice } from '@/components/ui';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

const EMAIL_GATEWAY_ROUTE = '/api/councils/email-gateway';

interface GatewayAnswer {
  settings: EmailGatewaySettings | null;
  /** The saved password's masked status; the password itself never leaves the server. */
  password: CredentialStatus | null;
}

/** Calls the gateway route: a POST saves (sealing the password in the vault) or clears, no body reads. */
async function gatewayOnServer(councilId: number, body?: Record<string, unknown>): Promise<GatewayAnswer> {
  const res = body
    ? await fetch(EMAIL_GATEWAY_ROUTE, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ councilId, ...body }),
      })
    : await fetch(`${EMAIL_GATEWAY_ROUTE}?councilId=${councilId}`, { credentials: 'same-origin' });
  const answer = (await res.json().catch(() => null)) as (Partial<GatewayAnswer> & { message?: string }) | null;
  if (!res.ok || !answer || answer.settings === undefined) throw new Error(answer?.message ?? `The server answered HTTP ${res.status}.`);
  return { settings: answer.settings, password: answer.password ?? null };
}

const gatewayInput = 'w-full rounded border-4 border-hc-gold bg-black px-3 py-2 text-base text-white placeholder:text-white/70';

export function EmailGatewayPanel({ councilId }: { councilId: number }) {
  const user = useUser();
  const council = useLoad(() => db.councils.get(councilId), [councilId]);
  const vaulted = useLoad(() => gatewayOnServer(councilId), [councilId]);
  const saved = councilEmailGateway(council.data) !== null && Boolean(vaulted.data?.password);
  const [provider, setProvider] = useState<EmailProvider>('Custom SMTP');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('587');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);

  // Each fresh load of the council (first open, after a save or clear) fills the form from what is stored.
  useEffect(() => {
    if (council.data === undefined) return;
    const g = councilEmailGateway(council.data);
    setProvider(g?.EmailProvider ?? 'Custom SMTP');
    setHost(g?.SmtpHost ?? '');
    setPort(String(g?.SmtpPort ?? 587));
    setUsername(g?.SmtpUsername ?? '');
    setPassword('');
  }, [council.data]);

  if (council.error) return <Notice tone="error">{council.error}</Notice>;
  if (council.data === undefined) return <p className="text-sm text-muted">Loading…</p>;
  if (council.data === null) return <Notice tone="error">Council {councilId} no longer exists.</Notice>;
  const row = council.data;

  const chooseProvider = (value: EmailProvider) => {
    setProvider(value);
    const preset = EMAIL_PROVIDER_PRESETS[value];
    if (preset) {
      setHost(preset.host);
      setPort(String(preset.port));
    }
  };

  const run = async (save: () => Promise<GatewayAnswer>, done: (s: EmailGatewaySettings | null) => string) => {
    setBusy(true);
    setMessage(null);
    try {
      const { settings } = await save();
      await db.councils.setEmailGateway(user.memberId, row.id, settings);
      await Promise.all([council.reload(), vaulted.reload()]);
      setMessage({ tone: 'info', text: done(settings) });
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setPassword('');
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void run(
      () =>
        gatewayOnServer(row.id, {
          EmailProvider: provider,
          SmtpHost: host,
          SmtpPort: Number(port),
          SmtpUsername: username,
          ...(password ? { password } : {}),
        }),
      (s) => `Council ${row.CouncilNumber} now sends its email through ${s?.SmtpHost ?? host}.`,
    );
  };

  const clear = () =>
    void run(
      () => gatewayOnServer(row.id, { clear: true }),
      () => `Council ${row.CouncilNumber} is back on the default email route.`,
    );

  return (
    <section aria-labelledby="email-gateway-title" data-surface="black" className="max-w-3xl rounded border-4 border-hc-gold bg-black p-4 font-bold text-white sm:p-6">
      <h2 id="email-gateway-title" className="mb-1 border-b-4 border-hc-gold pb-1 font-serif text-xl">
        Configure Outbound Email Gateway - {councilLabel(row)}
      </h2>
      <p className="mb-4 text-sm">
        Restricted to the council&apos;s Admins and Super Admins. Send this council&apos;s portal email (welcome and password-reset notices) through its
        own mail server instead of the portal&apos;s default. The password is sealed on the server before it is saved and is never shown again.
      </p>
      {message ? (
        <div className="mb-3">
          <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
            {message.text}
          </Notice>
        </div>
      ) : null}
      {vaulted.error ? (
        <div className="mb-3">
          <Notice tone="error">The saved password could not be checked on the server: {vaulted.error}</Notice>
        </div>
      ) : null}
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2" autoComplete="off">
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
              Saved password: <span aria-label="hidden">{REDACTED_SECRET}</span> (sealed in the credentials vault {vaulted.data?.password?.updated_at} UTC)
            </span>
          ) : null}
        </label>
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <Button type="submit" variant="gold" disabled={busy || !host.trim() || !username.trim() || (!saved && !password)}>
            {busy ? 'Saving…' : 'Save gateway'}
          </Button>
          {councilEmailGateway(row) || saved ? (
            <Button variant="danger" disabled={busy} onClick={clear}>
              Remove gateway
            </Button>
          ) : null}
        </div>
      </form>
    </section>
  );
}
