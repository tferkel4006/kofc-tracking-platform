'use client';
// The Microsoft Co-Pilot prompt box (Sprint 6L Extension 2) on the Marketing Factory: an officer types what they need - a
// flyer headline, a bulletin notice, a social post - and the council's Microsoft Copilot Studio agent writes it from the
// chosen event's facts (/api/marketing/copilot). The answer is checked with the same jargon scan as the flyer copy and
// can be copied.
// Sprint 6R: without a Direct Line secret in the Credentials Vault the Design Advanced Collateral button is disabled, and
// hovering or focusing it opens a tooltip box that says what the co-pilot does and links straight to the vault page.
import Link from 'next/link';
import { useId, useState, type FormEvent } from 'react';
import { COPILOT_PROMPT_LABEL, COPILOT_PROMPT_MAX_LENGTH, describeError, isAdmin, marketingJargonHits, type Event as CouncilEvent } from '@kofc/shared';
import { Button, Field, Notice, Panel, Textarea } from '@/components/ui';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';

const COPILOT_ROUTE = '/api/marketing/copilot';

async function copilotStatus(): Promise<boolean> {
  const res = await fetch(COPILOT_ROUTE, { credentials: 'same-origin' });
  const answer = (await res.json().catch(() => null)) as { connected?: boolean } | null;
  return res.ok && answer?.connected === true;
}

/** What the co-pilot is for, listed in the not-connected tooltip. */
const COPILOT_UTILITIES = [
  'Writes bulletin notices, social media posts and email invitations in the council voice',
  "Uses the chosen event's name, dates, place and description",
  'Checks the draft for marketing jargon before you copy it',
] as const;

/**
 * The disabled Design Advanced Collateral button while no key is saved (Sprint 6R), wrapped so the tooltip opens on hover
 * and on keyboard focus and stays open while the pointer or focus moves into it, so its link can be used.
 */
function NotConnectedButton({ admin }: { admin: boolean }) {
  const tipId = useId();
  return (
    <span className="group relative inline-block" tabIndex={0} aria-describedby={tipId}>
      <Button type="button" disabled aria-disabled="true">
        Design Advanced Collateral
      </Button>
      <span
        id={tipId}
        role="tooltip"
        className="invisible absolute bottom-full left-0 z-20 w-80 pb-2 opacity-0 transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100"
      >
        <span className="block rounded border-2 border-navy border-t-8 border-t-gold bg-white p-3 text-left text-sm font-normal text-navy shadow-lg">
          <span className="block font-bold">The Microsoft Co-Pilot is not connected yet</span>
          <span className="mt-1 block">Once its Direct Line secret is saved in the Credentials Vault, the co-pilot:</span>
          <span className="mt-1 block">
            {COPILOT_UTILITIES.map((u) => (
              <span key={u} className="block">
                • {u}
              </span>
            ))}
          </span>
          <Link href="/credentials-vault" className="mt-2 block font-bold underline">
            Open the Credentials Vault setup page →
          </Link>
          {admin ? null : <span className="mt-1 block text-xs text-muted">A council Admin saves the key there.</span>}
        </span>
      </span>
    </span>
  );
}

export function CopilotPrompt({ event, councilName }: { event: CouncilEvent | undefined; councilName: string }) {
  const user = useUser();
  const status = useLoad(copilotStatus, []);
  const [request, setRequest] = useState('');
  const [reply, setReply] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setCopied(false);
    try {
      const res = await fetch(COPILOT_ROUTE, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request,
          councilName,
          event: event
            ? { EventName: event.EventName, EventDescription: event.EventDescription, StartDate: event.StartDate, EndDate: event.EndDate, Location: event.Location }
            : null,
        }),
      });
      const answer = (await res.json().catch(() => null)) as { reply?: string; message?: string } | null;
      if (!res.ok || typeof answer?.reply !== 'string') throw new Error(answer?.message ?? `The server answered HTTP ${res.status}.`);
      setReply(answer.reply);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!reply) return;
    try {
      await navigator.clipboard.writeText(reply);
      setCopied(true);
    } catch {
      setError('The browser did not allow copying. Select the text and copy it instead.');
    }
  };

  const jargon = reply ? marketingJargonHits(reply) : [];
  const connected = status.data === true;

  return (
    <Panel title="Microsoft Co-Pilot">
      <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-3">
        <Field label={COPILOT_PROMPT_LABEL} hint={event ? `The co-pilot also gets the facts of ${event.EventName}.` : undefined}>
          {(id) => (
            <Textarea
              id={id}
              value={request}
              onChange={(e) => setRequest(e.target.value)}
              placeholder="e.g. Write a half-page bulletin notice and a short social media post inviting parish families."
              maxLength={COPILOT_PROMPT_MAX_LENGTH}
              rows={4}
              disabled={busy}
            />
          )}
        </Field>
        <div className="flex flex-wrap items-center gap-2">
          {status.data === false ? (
            <NotConnectedButton admin={isAdmin(user)} />
          ) : (
            <Button type="submit" disabled={busy || !connected || !request.trim()}>
              {busy ? 'The co-pilot is writing…' : 'Design Advanced Collateral'}
            </Button>
          )}
          <span className="text-sm text-muted">
            {request.length} / {COPILOT_PROMPT_MAX_LENGTH}
          </span>
          {status.data === false ? <span className="text-sm text-muted">Not connected: point at the button to see how to set it up.</span> : null}
        </div>
        {error ? (
          <Notice tone="error" onDismiss={() => setError(null)}>
            {error}
          </Notice>
        ) : null}
        {reply ? (
          <div className="flex flex-col gap-2" aria-live="polite">
            <h3 className="font-serif text-base font-bold">The co-pilot&apos;s draft</h3>
            <div className="whitespace-pre-wrap rounded border-2 border-gold bg-white p-3">{reply}</div>
            {jargon.length > 0 ? <Notice tone="error">{`Rewrite in plain, warm words: ${jargon.join(', ')}.`}</Notice> : null}
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" onClick={() => void copy()}>
                Copy the draft
              </Button>
              {copied ? <span className="text-sm font-bold">Copied.</span> : null}
            </div>
            <p className="text-sm text-muted">The co-pilot is an AI. Check every fact, date and name before the draft goes to print.</p>
          </div>
        ) : null}
      </form>
    </Panel>
  );
}
