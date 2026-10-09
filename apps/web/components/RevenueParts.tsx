'use client';
// '💰 Log Concluded Event Revenues' (Sprint 6Q): the Treasurer's intake card on the Financial Management Center. The
// Treasurer picks a past event or a running activity, types the total collected, chooses the Revenue account it belongs
// to (and the cash account it went into), and finance.logConcludedRevenue posts it straight into the ledger's actuals:
// a debit to the cash account and a credit to the Revenue account, both linked to the event or activity. Only the
// council's Treasurer or a Super Admin sees the form (canLogConcludedRevenue); the drivers enforce it too.
import { useMemo, useState } from 'react';
import {
  concludedRevenueAccounts,
  describeError,
  eventHasConcluded,
  JOURNAL_DESCRIPTION_MAX_LENGTH,
  LOG_CONCLUDED_REVENUE_TITLE,
  toIsoDate,
  type ChartOfAccounts,
  type ChartOfAccountsNode,
  type GLAccount,
} from '@kofc/shared';
import { Button, Empty, Field, Input, Notice, Panel, Select } from '@/components/ui';
import { formatFullDate, formatMoney, parseNumberField } from '@/lib/format';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

const chartAccounts = (nodes: readonly ChartOfAccountsNode[]): GLAccount[] => nodes.flatMap((n) => [n.account, ...chartAccounts(n.children)]);

/** The source picker's key: 'event:<id>' or 'activity:<id>'. */
const parseSource = (key: string): { LinkedEventID: number | null; LinkedActivityID: number | null } => {
  const m = /^(event|activity):(\d+)$/.exec(key);
  return { LinkedEventID: m?.[1] === 'event' ? Number(m[2]) : null, LinkedActivityID: m?.[1] === 'activity' ? Number(m[2]) : null };
};

export function ConcludedRevenueCard({ councilId, chart, onDone }: { councilId: number; chart: ChartOfAccounts; onDone: () => Promise<void> }) {
  const user = useUser();
  const today = toIsoDate(new Date());
  const sources = useLoad(async () => {
    const [events, activities] = await Promise.all([db.events.listByCouncil(councilId), db.activities.listByCouncil(councilId)]);
    const past = events.filter((e) => eventHasConcluded(e, today)).sort((a, b) => String(b.StartDate).localeCompare(String(a.StartDate)));
    return { events: past, activities };
  }, [councilId, today]);
  const { revenue, deposit } = useMemo(() => concludedRevenueAccounts(chartAccounts(chart.accounts), councilId), [chart, councilId]);
  const [source, setSource] = useState('');
  const [amount, setAmount] = useState('');
  const [revenueId, setRevenueId] = useState('');
  const [depositId, setDepositId] = useState('');
  const [date, setDate] = useState(today);
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const depositValue = depositId || String(deposit[0]?.id ?? '');

  const submit = async () => {
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const value = parseNumberField(amount, 'Funds collected');
      if (value === null) throw new Error('Enter the funds collected.');
      const lines = await db.finance.logConcludedRevenue(user.memberId, councilId, {
        ...parseSource(source),
        Amount: value,
        RevenueAccountID: Number(revenueId),
        DepositAccountID: depositValue ? Number(depositValue) : null,
        DateLogged: date,
        ...(description.trim() ? { Description: description } : {}),
      });
      const account = revenue.find((a) => String(a.id) === revenueId);
      setDone(`Logged ${formatMoney(value)} to ${account?.AccountName ?? 'revenue'} on ${formatFullDate(date)}: "${lines[0]?.Description ?? ''}".`);
      setAmount('');
      setDescription('');
      setSource('');
      await onDone();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  const events = sources.data?.events ?? [];
  const activities = sources.data?.activities ?? [];
  const ready = source !== '' && amount.trim() !== '' && revenueId !== '' && depositValue !== '';

  return (
    <Panel title={LOG_CONCLUDED_REVENUE_TITLE}>
      <p className="mb-3 text-sm">
        After an event is over, or when a running activity brings money in, record the total collected here. It goes straight into the ledger as income.
      </p>
      {sources.error ? <Notice tone="error">{sources.error}</Notice> : null}
      {error ? (
        <Notice tone="error" onDismiss={() => setError(null)}>
          {error}
        </Notice>
      ) : null}
      {done ? (
        <Notice tone="info" onDismiss={() => setDone(null)}>
          {done}
        </Notice>
      ) : null}
      {revenue.length === 0 ? (
        <Empty>The chart of accounts has no revenue accounts yet.</Empty>
      ) : (
        <form
          className="grid grid-cols-1 gap-3 md:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (ready) void submit();
          }}
        >
          <Field label="Event or activity" hint={sources.loading && !sources.data ? 'Loading…' : 'Only events that have ended are listed.'}>
            {(id) => (
              <Select id={id} value={source} required onChange={(e) => setSource(e.target.value)}>
                <option value="">— Choose a past event or an activity —</option>
                {events.length > 0 ? (
                  <optgroup label="Past events">
                    {events.map((e) => (
                      <option key={e.id} value={`event:${e.id}`}>
                        {e.EventName} · {formatFullDate(String(e.StartDate).slice(0, 10))}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
                {activities.length > 0 ? (
                  <optgroup label="Activities">
                    {activities.map((a) => (
                      <option key={a.id} value={`activity:${a.id}`}>
                        {a.ActivityName}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
              </Select>
            )}
          </Field>
          <Field label="Funds collected">
            {(id) => <Input id={id} inputMode="decimal" required value={amount} placeholder="0.00" onChange={(e) => setAmount(e.target.value)} />}
          </Field>
          <Field label="Revenue account">
            {(id) => (
              <Select id={id} value={revenueId} required onChange={(e) => setRevenueId(e.target.value)}>
                <option value="">— Choose where the income belongs —</option>
                {revenue.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.AccountName}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Deposited to">
            {(id) => (
              <Select id={id} value={depositValue} required onChange={(e) => setDepositId(e.target.value)}>
                {deposit.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.AccountName}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Date collected">{(id) => <Input id={id} type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
          <Field label="Description" hint="Optional; defaults to “Revenue collected: …”">
            {(id) => <Input id={id} value={description} maxLength={JOURNAL_DESCRIPTION_MAX_LENGTH} onChange={(e) => setDescription(e.target.value)} />}
          </Field>
          <div className="md:col-span-2">
            <Button type="submit" variant="gold" disabled={busy || !ready}>
              {busy ? 'Saving…' : 'Save to the ledger'}
            </Button>
          </div>
        </form>
      )}
    </Panel>
  );
}
