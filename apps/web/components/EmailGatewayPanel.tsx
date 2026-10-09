'use client';
// Outbound email card of the Credentials Vault page (Sprint 6Z-Email-Proxy; on /credentials-vault since the Sprint 6L
// Extension). One council's own mail server for portal email. The council's Active Admins and any Super Admin save it
// (canAdministerCouncil; the drivers and /api/councils/email-gateway apply the same rule); other officers who open the
// page see only the status banner above it. The password goes to the route once and stays on the server, sealed in the
// credentials vault; the route answers only its masked CredentialStatus, and the page stores just the four Council
// columns (councils.setEmailGateway). Sprint 6L Extension: no port field - the provider preset sets it, and a custom
// server keeps its saved port or uses 587 (submission with STARTTLS).
import { useEffect, useState, type FormEvent } from 'react';
import {
  councilEmailGateway,
  describeError,
  EMAIL_PROVIDER_PRESETS,
  EMAIL_PROVIDERS,
  REDACTED_SECRET,
  type CredentialStatus,
  type EmailGatewaySettings,
  type EmailProvider,
} from '@kofc/shared';
import { Button, Field, Input, Notice, Panel, Select } from '@/components/ui';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

const EMAIL_GATEWAY_ROUTE = '/api/councils/email-gateway';

/** The port a custom mail server uses when the council has none saved: authenticated submission with STARTTLS. */
const DEFAULT_SMTP_PORT = 587;

export interface GatewayAnswer {
  settings: EmailGatewaySettings | null;
  /** The saved password's masked status; the password itself never leaves the server. */
  password: CredentialStatus | null;
}

/** Calls the gateway route: a POST saves (sealing the password in the vault) or clears, no body reads. */
export async function gatewayOnServer(councilId: number, body?: Record<string, unknown>): Promise<GatewayAnswer> {
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

export function EmailGatewayPanel({ councilId, onChanged }: { councilId: number; onChanged?: () => Promise<void> }) {
  const user = useUser();
  const council = useLoad(() => db.councils.get(councilId), [councilId]);
  const vaulted = useLoad(() => gatewayOnServer(councilId), [councilId]);
  const saved = councilEmailGateway(council.data) !== null && Boolean(vaulted.data?.password);
  const [provider, setProvider] = useState<EmailProvider>('Custom SMTP');
  const [host, setHost] = useState('');
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
    setUsername(g?.SmtpUsername ?? '');
    setPassword('');
  }, [council.data]);

  if (council.error) return <Notice tone="error">{council.error}</Notice>;
  if (council.data === undefined) return <p className="text-sm text-muted">Loading…</p>;
  if (council.data === null) return <Notice tone="error">Council {councilId} no longer exists.</Notice>;
  const row = council.data;
  const port = EMAIL_PROVIDER_PRESETS[provider]?.port ?? councilEmailGateway(row)?.SmtpPort ?? DEFAULT_SMTP_PORT;

  const chooseProvider = (value: EmailProvider) => {
    setProvider(value);
    const preset = EMAIL_PROVIDER_PRESETS[value];
    if (preset) setHost(preset.host);
  };

  const run = async (save: () => Promise<GatewayAnswer>, done: () => string) => {
    setBusy(true);
    setMessage(null);
    try {
      const { settings } = await save();
      await db.councils.setEmailGateway(user.memberId, row.id, settings);
      await Promise.all([council.reload(), vaulted.reload(), onChanged?.()]);
      setMessage({ tone: 'info', text: done() });
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
      () => gatewayOnServer(row.id, { EmailProvider: provider, SmtpHost: host, SmtpPort: port, SmtpUsername: username, ...(password ? { password } : {}) }),
      () => 'Saved. Council email now goes out through your own mail account.',
    );
  };

  const clear = () =>
    void run(
      () => gatewayOnServer(row.id, { clear: true }),
      () => 'Removed. Council email goes out through the portal again.',
    );

  return (
    <Panel title="Outbound email">
      <form onSubmit={submit} className="flex max-w-2xl flex-col gap-3" autoComplete="off">
        <p className="text-sm">Send welcome and password-reset notices from the council&apos;s own mail account. The password is locked away once saved.</p>
        {message ? (
          <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
            {message.text}
          </Notice>
        ) : null}
        {vaulted.error ? <Notice tone="error">The saved password could not be checked: {vaulted.error}</Notice> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Email service">
            {(id) => (
              <Select id={id} value={provider} onChange={(e) => chooseProvider(e.target.value as EmailProvider)} disabled={busy}>
                {EMAIL_PROVIDERS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Mail server">
            {(id) => <Input id={id} value={host} onChange={(e) => setHost(e.target.value)} placeholder="smtp.example.org" maxLength={253} required disabled={busy} />}
          </Field>
          <Field label="Sign-in email">
            {(id) => <Input id={id} value={username} onChange={(e) => setUsername(e.target.value)} placeholder="council@example.org" maxLength={255} required disabled={busy} />}
          </Field>
          <Field label="Password" hint={saved ? 'Saved. Leave empty to keep it.' : undefined}>
            {(id) => (
              <Input
                id={id}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={saved ? REDACTED_SECRET : 'App password'}
                autoComplete="new-password"
                spellCheck={false}
                maxLength={1000}
                required={!saved}
                disabled={busy}
              />
            )}
          </Field>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={busy || !host.trim() || !username.trim() || (!saved && !password)}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
          {councilEmailGateway(row) || saved ? (
            <Button variant="danger" disabled={busy} onClick={clear}>
              Remove
            </Button>
          ) : null}
        </div>
      </form>
    </Panel>
  );
}
