'use client';
// Base Dues Rate (Sprint 6B): the council's yearly dues per member, Council.base_dues_rate, which the Financial Management
// Center multiplies by its Active and Inactive members (buildDuesForecast). Everyone who opens Council Lookups for the
// council sees the stored rate; only its Grand Knight or Financial Secretary may change it (canEditDuesRate). The
// drivers apply the same rule (councils.setDuesRate, assertMayEditDuesRate), with no Admin or Super Admin bypass.
import { useEffect, useState, type FormEvent } from 'react';
import { canEditDuesRate, councilLabel, describeError, duesRateOf, DUES_RATE_MAX } from '@kofc/shared';
import { Button, Field, Input, Notice, Pill } from '@/components/ui';
import { useUser } from '@/lib/session';
import { formatMoney } from '@/lib/format';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

export function DuesRatePanel({ councilId }: { councilId: number }) {
  const user = useUser();
  const council = useLoad(() => db.councils.get(councilId), [councilId]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);
  const mayEdit = canEditDuesRate(user, councilId);

  useEffect(() => {
    if (council.data) setText(duesRateOf(council.data).toFixed(2));
  }, [council.data]);

  if (council.error) return <Notice tone="error">{council.error}</Notice>;
  if (council.data === undefined) return <p className="text-sm text-muted">Loading…</p>;
  if (council.data === null) return <Notice tone="error">Council {councilId} no longer exists.</Notice>;
  const row = council.data;
  const stored = duesRateOf(row);
  const parsed = text.trim() === '' ? NaN : Number(text);
  const dirty = Number.isFinite(parsed) ? Math.round(parsed * 100) !== Math.round(stored * 100) : text.trim() !== '';

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const updated = await db.councils.setDuesRate(user.memberId, councilId, parsed);
      setMessage({ tone: 'info', text: `Saved the base dues rate of ${councilLabel(updated)}: ${formatMoney(duesRateOf(updated))} per member.` });
      await council.reload();
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="flex max-w-md flex-col gap-3" onSubmit={(e) => void save(e)}>
      {message ? (
        <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
          {message.text}
        </Notice>
      ) : null}
      <p className="text-xs text-muted">
        The yearly dues each Active and Inactive member owes. The Financial Management Center multiplies this rate by the roster to forecast the
        council&apos;s dues income. Only the council&apos;s Grand Knight or Financial Secretary can change it.
      </p>
      <Field label="Base Dues Rate ($)" hint={mayEdit ? 'A dollar amount in whole cents, for example 40.00.' : 'Read only: your seat cannot change the rate.'}>
        {(id) => (
          <Input
            id={id}
            type="number"
            inputMode="decimal"
            min={0}
            max={DUES_RATE_MAX}
            step="0.01"
            value={text}
            disabled={!mayEdit || busy}
            onChange={(e) => setText(e.target.value)}
          />
        )}
      </Field>
      <div className="flex flex-wrap items-center gap-2">
        {mayEdit ? (
          <Button type="submit" disabled={busy || !dirty || !Number.isFinite(parsed)}>
            {busy ? 'Saving…' : 'Save dues rate'}
          </Button>
        ) : null}
        <Pill tone="navy">Stored: {formatMoney(stored)}</Pill>
        {dirty ? <Pill tone="gold">Unsaved changes</Pill> : null}
      </div>
    </form>
  );
}
