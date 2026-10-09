'use client';
// Credentials Vault (Sprint 6L Extension): the one Setup page for every connection a council keeps a secret for - its
// outbound email account (moved here from the Council Lookups tab) and its Google Drive key (/api/councils/credentials,
// which had no page before). A short status banner leads the page in plain words; no ports or technical flags.
// Audience: seated officers, the council's Admins and Super Admins (canOpenCredentialsVault). Only the council's Admins
// and Super Admins change anything (canAdministerCouncil, the same rule the routes apply); everyone else sees the banner.
import { useState, type FormEvent } from 'react';
import { canAdministerCouncil, councilEmailGateway, councilLabel, describeError, REDACTED_SECRET, type CredentialStatus } from '@kofc/shared';
import { CouncilSelect, RequireArea, useCouncilScope } from '@/components/CouncilScope';
import { EmailGatewayPanel, gatewayOnServer } from '@/components/EmailGatewayPanel';
import { Button, Field, Notice, PageTitle, Panel, Textarea } from '@/components/ui';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

const CREDENTIALS_ROUTE = '/api/councils/credentials';

/** Lists (or, with a body, saves or clears) the council's masked credentials. */
async function credentialsOnServer(councilId: number, body?: Record<string, unknown>): Promise<CredentialStatus[]> {
  const res = body
    ? await fetch(CREDENTIALS_ROUTE, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ councilId, ...body }),
      })
    : await fetch(`${CREDENTIALS_ROUTE}?councilId=${councilId}`, { credentials: 'same-origin' });
  const answer = (await res.json().catch(() => null)) as { credentials?: CredentialStatus[]; message?: string } | null;
  if (!res.ok || !answer?.credentials) throw new Error(answer?.message ?? `The server answered HTTP ${res.status}.`);
  return answer.credentials;
}

interface Connection {
  name: string;
  connected: boolean;
  on: string;
  off: string;
}

/** The low-density connectivity banner: one line per connection, a word and a symbol, never colour alone. */
function StatusBanner({ connections, unknown }: { connections: Connection[]; unknown: boolean }) {
  return (
    <section aria-label="Connection status" className="mb-4 rounded border-2 border-navy bg-white p-4">
      <ul className="flex flex-col gap-2 sm:flex-row sm:gap-8">
        {connections.map((c) => (
          <li key={c.name} className="flex items-center gap-2">
            <span aria-hidden="true" className={c.connected ? 'font-bold text-green' : 'font-bold text-muted'}>
              {c.connected ? '✓' : '○'}
            </span>
            <span>
              <span className="font-bold">{c.name}:</span> {unknown ? 'Checking…' : c.connected ? c.on : c.off}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function DriveKeyPanel({ councilId, saved, onChanged }: { councilId: number; saved: CredentialStatus | undefined; onChanged: () => Promise<void> }) {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);

  const run = async (body: Record<string, unknown>, done: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await credentialsOnServer(councilId, { credentialKey: 'GOOGLE_DRIVE_PRIVATE_KEY', ...body });
      await onChanged();
      setMessage({ tone: 'info', text: done });
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setValue('');
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void run({ value }, 'Saved. The council files now go to its own Google Drive.');
  };

  return (
    <Panel title="Google Drive">
      <form onSubmit={submit} className="flex max-w-2xl flex-col gap-3" autoComplete="off">
        <p className="text-sm">Paste the private key your Google Drive administrator gave the council. It is locked away once saved.</p>
        {message ? (
          <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
            {message.text}
          </Notice>
        ) : null}
        <Field label="Drive key" hint={saved ? 'Saved. Paste a new key only to replace it.' : undefined}>
          {(id) => (
            <Textarea
              id={id}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={saved ? REDACTED_SECRET : '-----BEGIN PRIVATE KEY-----'}
              spellCheck={false}
              maxLength={8000}
              rows={4}
              disabled={busy}
            />
          )}
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={busy || !value.trim()}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
          {saved ? (
            <Button variant="danger" disabled={busy} onClick={() => void run({ clear: true }, 'Removed. Council files use the portal Drive again.')}>
              Remove
            </Button>
          ) : null}
        </div>
      </form>
    </Panel>
  );
}

function CredentialsVault() {
  const user = useUser();
  const scope = useCouncilScope();
  const councilId = scope.councilId;
  const mayEdit = canAdministerCouncil(user, councilId);
  const council = useLoad(() => db.councils.get(councilId), [councilId]);
  // The routes answer only the council's Admins and Super Admins; other officers see the stored settings alone.
  const vault = useLoad(async () => (mayEdit ? { credentials: await credentialsOnServer(councilId), gateway: await gatewayOnServer(councilId) } : null), [councilId, mayEdit]);
  const reload = async () => {
    await Promise.all([council.reload(), vault.reload()]);
  };

  const drive = vault.data?.credentials.find((c) => c.credential_key === 'GOOGLE_DRIVE_PRIVATE_KEY');
  const emailOn = councilEmailGateway(council.data) !== null && (vault.data ? Boolean(vault.data.gateway.password) : true);
  const connections: Connection[] = [
    { name: 'Outbound email', connected: emailOn, on: 'Connected to the council mail account', off: 'Using the portal default' },
    ...(mayEdit ? [{ name: 'Google Drive', connected: Boolean(drive), on: 'Connected to the council Drive', off: 'Using the portal Drive' }] : []),
  ];

  return (
    <>
      <PageTitle actions={<CouncilSelect scope={scope} />}>Credentials Vault</PageTitle>
      <StatusBanner connections={connections} unknown={council.data === undefined || (mayEdit && vault.loading)} />
      {vault.error ? <Notice tone="error">{vault.error}</Notice> : null}
      {mayEdit ? (
        <div className="flex flex-col gap-4">
          <EmailGatewayPanel key={`email-${councilId}`} councilId={councilId} onChanged={reload} />
          <DriveKeyPanel key={`drive-${councilId}`} councilId={councilId} saved={drive} onChanged={reload} />
        </div>
      ) : (
        <p className="text-sm">
          {council.data ? `${councilLabel(council.data)}: ` : ''}only the council&apos;s Admins change these connections.
        </p>
      )}
    </>
  );
}

export default function CredentialsVaultPage() {
  return (
    <RequireArea area="credentials-vault">
      <CredentialsVault />
    </RequireArea>
  );
}
