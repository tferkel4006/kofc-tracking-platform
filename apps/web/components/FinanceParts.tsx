'use client';
// General ledger pieces (Sprint 5Z-8) shared by the Financial Management Center (/finance/dashboard), the General
// Ledger Spreadsheet (/finance/ledger) and the Balance Sheet (/finance/balance-sheet): the balanced-ledger badge, the
// liquidity tank gauges, the two-pan balance scale, the asset transfer drawer, the bank statement uploader and the
// account drill-down drawer. Every figure is navy (or brand-red when negative) on white; gold is only a fill or bar,
// and green only the confirmation fill behind white text.
import { useMemo, useState } from 'react';
import {
  describeError,
  GL_ACCOUNT_TYPE_LABELS,
  isBankAccount,
  JOURNAL_DESCRIPTION_MAX_LENGTH,
  toIsoDate,
  type BalanceSheet,
  type BankReconciliationResult,
  type ChartOfAccounts,
  type ChartOfAccountsNode,
  type GLAccount,
  type LiquidityGauge,
} from '@kofc/shared';
import { Drawer } from '@/components/Drawer';
import { Button, cx, Empty, Field, Input, Notice, Pill, Select, Table, Td } from '@/components/ui';
import { formatFullDate, formatMoney, parseNumberField } from '@/lib/format';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

/** A money figure for the ledger screens: brand-red when below zero, navy otherwise. */
export function Money({ value, className }: { value: number; className?: string }) {
  return <span className={cx('tabular-nums', value < 0 ? 'text-brand-red' : 'text-navy', className)}>{formatMoney(value)}</span>;
}

/** Every account of the chart, depth-first in chart order. */
export function flattenChart(chart: ChartOfAccounts | undefined): ChartOfAccountsNode[] {
  const out: ChartOfAccountsNode[] = [];
  const walk = (n: ChartOfAccountsNode) => {
    out.push(n);
    n.children.forEach(walk);
  };
  chart?.accounts.forEach(walk);
  return out;
}

/** '✓ Ledger Balanced (Zero Leaks)' on a green fill, or the leak on a brand-red fill. */
export function LedgerBalanceBadge({ sheet }: { sheet: Pick<BalanceSheet, 'isBalanced' | 'difference'> }) {
  if (sheet.isBalanced) {
    return (
      <span role="status" className="inline-block rounded-full border-2 border-green bg-green px-3 py-1 text-sm font-bold text-white">
        ✓ Ledger Balanced (Zero Leaks)
      </span>
    );
  }
  return (
    <span role="alert" className="inline-block rounded-full border-2 border-brand-red bg-brand-red px-3 py-1 text-sm font-bold text-white">
      ⚠ Out of balance by {formatMoney(Math.abs(sheet.difference))}
    </span>
  );
}

/** One vertical tank: an outlined vessel whose fill rises to `level` (0-1), labelled under it. */
function Tank({ label, amount, level, fill }: { label: string; amount: number; level: number; fill: string }) {
  const height = Math.max(0, Math.min(1, level)) * 100;
  return (
    <figure className="flex flex-col items-center gap-2">
      <div
        role="meter"
        aria-label={`${label}: ${formatMoney(amount)}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(height)}
        className="relative flex h-44 w-24 items-end overflow-hidden rounded-b-xl rounded-t border-4 border-navy bg-white"
      >
        {/* Baffles: hairlines every quarter of the tank. */}
        {[25, 50, 75].map((mark) => (
          <div key={mark} aria-hidden="true" className="absolute inset-x-0 border-t border-dashed border-line" style={{ bottom: `${mark}%` }} />
        ))}
        <div className={cx('w-full transition-all', fill)} style={{ height: `${height}%` }} />
      </div>
      <figcaption className="text-center">
        <span className="block text-xs font-bold uppercase tracking-wide">{label}</span>
        <Money value={amount} className="text-lg font-bold" />
      </figcaption>
    </figure>
  );
}

/**
 * The cash flow liquidity baffle gauge for one bank account (buildLiquidityGauges): the bank's cash, the part the
 * virtual goals reserve, and the true liquid operating cash left, as three tanks on one scale, with each goal's
 * progress toward its target under them.
 */
export function LiquidityGaugeCard({ gauge }: { gauge: LiquidityGauge }) {
  const scale = Math.max(gauge.totalCash, gauge.reserved, gauge.liquid, 0.01);
  return (
    <section aria-label={`Liquidity of ${gauge.account.AccountName}`} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-center gap-6">
        <Tank label={`${gauge.account.AccountName} (bank)`} amount={gauge.totalCash} level={gauge.totalCash / scale} fill="bg-navy" />
        <span aria-hidden="true" className="pb-16 text-3xl font-bold">−</span>
        <Tank label="Reserved for goals" amount={gauge.reserved} level={gauge.reserved / scale} fill="bg-gold" />
        <span aria-hidden="true" className="pb-16 text-3xl font-bold">=</span>
        <Tank label="True liquid operating cash" amount={gauge.liquid} level={gauge.liquid / scale} fill={gauge.liquid < 0 ? 'bg-brand-red' : 'bg-navy'} />
      </div>
      {gauge.liquid < 0 ? (
        <Notice tone="error">The goals reserve more than {gauge.account.AccountName} holds; release a goal or move cash in before spending.</Notice>
      ) : null}
      <ul className="flex flex-col gap-3">
        {gauge.goals.map((g) => {
          const width = g.percentFunded === null ? 0 : Math.min(g.percentFunded, 100);
          return (
            <li key={g.account.id} className="flex flex-col gap-1">
              <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <span className="font-bold">{g.account.AccountName}</span>
                <span>
                  <Money value={g.balance} className="font-bold" /> of {g.target > 0 ? formatMoney(g.target) : 'no target'}
                  {g.percentFunded !== null ? ` · ${g.percentFunded.toLocaleString('en-US', { maximumFractionDigits: 1 })}% funded` : ''}
                </span>
              </div>
              <div
                role="meter"
                aria-label={`${g.account.AccountName} funding`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(width)}
                className="h-3 overflow-hidden rounded border-2 border-navy bg-white"
              >
                <div className="h-full bg-gold" style={{ width: `${width}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** The two pans of the balance scale: assets against liabilities and equity, the beam level when they balance. */
export function BalanceScale({ sheet }: { sheet: BalanceSheet }) {
  const tilt = sheet.isBalanced ? 0 : sheet.difference > 0 ? -4 : 4;
  const pan = (title: string, total: number, rows: { label: string; value: number }[]) => (
    <div className="flex flex-col gap-2 rounded border-2 border-navy p-3">
      <h3 className="font-serif text-lg font-bold">{title}</h3>
      <dl className="flex flex-col gap-1 text-sm">
        {rows.map((r) => (
          <div key={r.label} className="flex justify-between gap-3">
            <dt>{r.label}</dt>
            <dd>
              <Money value={r.value} />
            </dd>
          </div>
        ))}
      </dl>
      <p className="flex justify-between gap-3 border-t-2 border-navy pt-2 text-base font-bold">
        <span>Total</span>
        <Money value={total} />
      </p>
    </div>
  );
  return (
    <div className="flex flex-col gap-3">
      <div aria-hidden="true" className="flex flex-col items-center">
        <div className="h-1.5 w-3/4 rounded bg-navy transition-transform" style={{ transform: `rotate(${tilt}deg)` }} />
        <div className="h-6 w-1.5 bg-navy" />
        <div className="h-2 w-16 rounded-t bg-gold" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {pan('Assets', sheet.totalAssets, [
          ...sheet.assets.lines.filter((l) => !l.isVirtualGoal).map((l) => ({ label: l.accountName, value: l.balance })),
          ...(sheet.assets.lines.some((l) => l.isVirtualGoal)
            ? [{ label: 'Virtual goals (inside their bank account)', value: sheet.assets.lines.filter((l) => l.isVirtualGoal).reduce((s, l) => s + Math.round(l.balance * 100), 0) / 100 }]
            : []),
        ])}
        {pan('Liabilities & Equity', sheet.totalLiabilitiesAndEquity, [
          { label: 'Liabilities', value: sheet.totalLiabilities },
          ...sheet.equity.lines.map((l) => ({ label: l.accountName, value: l.balance })),
          { label: 'Surplus (revenue less expenses)', value: sheet.netSurplus },
        ])}
      </div>
      <div className="flex justify-center">
        <LedgerBalanceBadge sheet={sheet} />
      </div>
    </div>
  );
}

/**
 * Moves money between two asset accounts of the council (finance.transferAssetFunds): funding or releasing a virtual
 * goal, sweeping cash to savings, or recording a purchase of physical property. Finance officers only.
 */
export function TransferDrawer({ councilId, chart, onClose, onDone }: { councilId: number; chart: ChartOfAccounts; onClose: () => void; onDone: () => Promise<void> }) {
  const user = useUser();
  const assets = useMemo(() => flattenChart(chart).filter((n) => n.account.AccountType === 'Asset'), [chart]);
  const [source, setSource] = useState(String(assets[0]?.account.id ?? ''));
  const [target, setTarget] = useState(String(assets[1]?.account.id ?? ''));
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(toIsoDate(new Date()));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const from = assets.find((n) => String(n.account.id) === source);

  const submit = async () => {
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const value = parseNumberField(amount, 'Amount');
      if (value === null) throw new Error('Enter the amount to transfer.');
      const lines = await db.finance.transferAssetFunds(user.memberId, Number(source), Number(target), value, {
        dateLogged: date,
        ...(description.trim() ? { description } : {}),
      });
      setDone(`Posted ${formatMoney(value)} as transaction ${lines[0]?.TransactionID ?? ''}.`);
      setAmount('');
      setDescription('');
      await onDone();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  const option = (n: ChartOfAccountsNode) => (
    <option key={n.account.id} value={n.account.id}>
      {'— '.repeat(n.depth)}
      {n.account.AccountName} ({formatMoney(n.balance)})
    </option>
  );

  return (
    <Drawer title="Transfer between asset accounts" onClose={onClose}>
      <p className="text-sm">
        Posts a balanced pair of journal lines for council {councilId}: a debit to the account receiving the money and a credit to the account it leaves. A
        transfer never overdraws the source.
      </p>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {done ? <Notice tone="info">{done}</Notice> : null}
      <Field label="From (credit)" hint={from ? `Holds ${formatMoney(from.balance)} of its own` : undefined}>
        {(id) => (
          <Select id={id} value={source} onChange={(e) => setSource(e.target.value)}>
            {assets.map(option)}
          </Select>
        )}
      </Field>
      <Field label="To (debit)">
        {(id) => (
          <Select id={id} value={target} onChange={(e) => setTarget(e.target.value)}>
            {assets.map(option)}
          </Select>
        )}
      </Field>
      <Field label="Amount">{(id) => <Input id={id} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />}</Field>
      <Field label="Date">{(id) => <Input id={id} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
      <Field label="Description" hint="Optional; defaults to “Transfer from … to …”">
        {(id) => <Input id={id} value={description} maxLength={JOURNAL_DESCRIPTION_MAX_LENGTH} onChange={(e) => setDescription(e.target.value)} />}
      </Field>
      <div className="flex gap-2">
        <Button onClick={() => void submit()} disabled={busy || !source || !target || source === target || amount.trim() === ''}>
          {busy ? 'Posting…' : 'Post transfer'}
        </Button>
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
    </Drawer>
  );
}

/**
 * Electronic CSV bank audit (finance.uploadBankStatementReconciliation): pick a statement file, optionally narrow it to
 * one bank account, and flag the journal lines it matches as reconciled. Finance officers only.
 */
export function BankStatementUploader({ councilId, chart, onDone }: { councilId: number; chart: ChartOfAccounts; onDone: () => Promise<void> }) {
  const user = useUser();
  const banks = useMemo(() => flattenChart(chart).filter((n) => isBankAccount(n.account)), [chart]);
  const [file, setFile] = useState<File | null>(null);
  const [account, setAccount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BankReconciliationResult | null>(null);
  const [dragging, setDragging] = useState(false);

  const run = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const text = await file.text();
      const found = await db.finance.uploadBankStatementReconciliation(user.memberId, text, {
        councilId,
        ...(account ? { glAccountId: Number(account) } : {}),
      });
      setResult(found);
      await onDone();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          setFile(e.dataTransfer.files[0] ?? null);
        }}
        className={cx(
          'flex cursor-pointer flex-col items-center gap-1 rounded border-2 border-dashed p-4 text-center text-sm',
          dragging ? 'border-gold bg-white' : 'border-navy bg-white',
        )}
      >
        <span className="font-bold">{file ? file.name : 'Drop a bank statement CSV here, or choose a file'}</span>
        <span className="text-xs text-muted">Needs Date and Amount (or Withdrawal / Deposit) columns; Description and Check # are optional.</span>
        <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </label>
      <Field label="Bank account">
        {(id) => (
          <Select id={id} value={account} onChange={(e) => setAccount(e.target.value)}>
            <option value="">Every bank account of the council</option>
            {banks.map((n) => (
              <option key={n.account.id} value={n.account.id}>
                {n.account.AccountName}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <div>
        <Button variant="gold" onClick={() => void run()} disabled={!file || busy}>
          {busy ? 'Reconciling…' : 'Run electronic audit'}
        </Button>
      </div>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {result ? (
        <section aria-label="Reconciliation result" className="flex flex-col gap-2 rounded border-2 border-navy border-l-8 border-l-gold p-3 text-sm">
          <p className="font-bold">
            {result.matched.length} of {result.statementRows} statement rows reconciled · {result.unmatched.length} unmatched
          </p>
          {result.unmatched.length ? (
            <ul className="flex flex-col gap-1">
              {result.unmatched.map((m) => (
                <li key={m.row.line}>
                  <span className="font-bold">Line {m.row.line}</span> ({formatFullDate(m.row.date)}, <Money value={m.row.amount} />
                  {m.row.description ? `, ${m.row.description}` : ''}): {m.reason}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

/** A journal row's posting: every line of its TransactionID, so a multi-line entry reads as one balanced whole. */
function PostingLines({ lines }: { lines: { entry: { id: number; DebitAmount: number; CreditAmount: number }; accountName: string }[] }) {
  return (
    <ul className="mt-1 flex flex-col gap-0.5 border-l-4 border-gold pl-2 text-xs">
      {lines.map((l) => (
        <li key={l.entry.id} className="flex justify-between gap-3">
          <span>{l.accountName}</span>
          <span className="tabular-nums">{l.entry.DebitAmount > 0 ? `Dr ${formatMoney(l.entry.DebitAmount)}` : `Cr ${formatMoney(l.entry.CreditAmount)}`}</span>
        </li>
      ))}
    </ul>
  );
}

/** The drill-down: every line ever posted to one account (finance.getAccountLedger), oldest first, with its posting. */
export function AccountLedgerDrawer({ account, onClose }: { account: GLAccount; onClose: () => void }) {
  const user = useUser();
  const ledger = useLoad(() => db.finance.getAccountLedger(user.memberId, account.id), [user.memberId, account.id]);
  const [open, setOpen] = useState<Set<number>>(new Set());
  const toggle = (id: number) =>
    setOpen((now) => {
      const next = new Set(now);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const data = ledger.data;
  return (
    <Drawer title={`${account.AccountName} ledger`} onClose={onClose} wide>
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone="outline">{GL_ACCOUNT_TYPE_LABELS[account.AccountType]}</Pill>
        {account.IsVirtualGoal === 1 ? <Pill tone="gold">Virtual goal · target {formatMoney(account.TargetGoalAmount)}</Pill> : null}
      </div>
      {ledger.error ? <Notice tone="error">{ledger.error}</Notice> : null}
      {data ? (
        <>
          <dl className="grid grid-cols-3 gap-2 text-sm">
            {[
              ['Debits', data.debitTotal],
              ['Credits', data.creditTotal],
              ['Balance', data.balance],
            ].map(([label, value]) => (
              <div key={label as string} className="rounded border-2 border-navy p-2">
                <dt className="text-xs font-bold uppercase tracking-wide">{label}</dt>
                <dd className="text-lg font-bold">
                  <Money value={value as number} />
                </dd>
              </div>
            ))}
          </dl>
          {data.rows.length === 0 ? (
            <Empty>Nothing has been posted to this account yet.</Empty>
          ) : (
            <Table caption={`Journal lines on ${account.AccountName}`} head={['Date', 'Description', 'Check #', 'Event', 'Debit', 'Credit', 'Balance']}>
              {data.rows.map((r) => (
                <tr key={r.entry.id} className="align-top">
                  <Td className="whitespace-nowrap">{formatFullDate(r.entry.DateLogged)}</Td>
                  <Td>
                    <button type="button" onClick={() => toggle(r.entry.id)} aria-expanded={open.has(r.entry.id)} className="text-left font-bold underline">
                      {r.entry.Description}
                    </button>
                    {r.entry.IsBankReconciled === 1 ? (
                      <span className="ml-2 align-middle">
                        <Pill tone="navy">Reconciled</Pill>
                      </span>
                    ) : null}
                    {open.has(r.entry.id) ? <PostingLines lines={r.transactionLines} /> : null}
                  </Td>
                  <Td>{r.entry.CheckNumber ?? '–'}</Td>
                  <Td>{r.entry.LinkedEventID != null ? `#${r.entry.LinkedEventID}${r.eventName ? ` · ${r.eventName}` : ''}` : '–'}</Td>
                  <Td className="text-right">{r.entry.DebitAmount > 0 ? <Money value={r.entry.DebitAmount} /> : ''}</Td>
                  <Td className="text-right">{r.entry.CreditAmount > 0 ? <Money value={r.entry.CreditAmount} /> : ''}</Td>
                  <Td className="text-right font-bold">
                    <Money value={r.runningBalance} />
                  </Td>
                </tr>
              ))}
            </Table>
          )}
          <p className="text-xs text-muted">Select a description to see every line of its posting.</p>
        </>
      ) : ledger.loading ? (
        <p className="text-sm">Loading…</p>
      ) : null}
    </Drawer>
  );
}
