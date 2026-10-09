'use client';
// Semiannual Trustee Audit Desk (Sprint 6N, Form 1295): the Trustees' step-by-step audit of the council's books for one
// half of a fraternal year (July-December or January-June), over finance.getTrusteeAudit.
//   1. Period      pick the half-year; the one in progress is listed first.
//   2. Verify      every line posted to a cash account in the window, oldest first, each with a checkmark the Trustee
//                  clicks once it matches the bank statement (finance.setAuditLineVerified). Transfers between the
//                  council's own accounts are tagged; they move no money in or out.
//   3. Reconcile   cash at the start, receipts, disbursements and cash at the end, with the difference (0 when it ties out).
//   4. Sign        a Trustee's signature (finance.signTrusteeAudit) locks the period once it has ended and every line is
//                  verified; the ledger then refuses postings dated inside it. Other Trustees may add their signatures.
//   5. Print       the Form 1295-layout PDF, compiled on the server with ReportLab (/api/finance/form-1295) and saved as
//                  generated/Form_1295_Audit_Report.pdf.
// Every reader of the books sees the desk (canReadGeneralLedger); checkmarks and signatures are the Trustees' and Super
// Admins' (canVerifyCouncilAudit). The desk is a standard navy-on-white summary card.
import Link from 'next/link';
import { useState } from 'react';
import { auditPeriodOptions, canVerifyCouncilAudit, describeError, type AuditPeriod, type TrusteeAuditLine, type TrusteeAuditWorkspace } from '@kofc/shared';
import { CouncilSelect, RequireArea, useCouncilScope } from '@/components/CouncilScope';
import { SummaryCard } from '@/components/DuesParts';
import { Button, cx, Notice, PageTitle, Select } from '@/components/ui';
import { formatMoney } from '@/lib/format';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';
import { compileForm1295 } from '@/services/form-1295-transport';

const STATUS_LABEL: Record<TrusteeAuditWorkspace['status'], string> = {
  NOT_STARTED: '○ Not started',
  DRAFT: '◐ In progress (draft)',
  LOCKED: '🔒 Signed and locked',
};

/** One step heading of the wizard: its number, title and whether it is done. */
function Step({ n, title, done, children }: { n: number; title: string; done: boolean; children: React.ReactNode }) {
  return (
    <li className="rounded border-2 border-line p-3 sm:p-4">
      <h3 className="flex flex-wrap items-center gap-3 font-serif text-xl">
        <span aria-hidden="true" className={cx('inline-flex h-9 w-9 items-center justify-center rounded-full border-4 text-lg', done ? 'border-green text-green' : 'border-line')}>
          {done ? '✓' : n}
        </span>
        <span>
          Step {n}: {title}
          <span className="sr-only">{done ? ' (done)' : ''}</span>
        </span>
      </h3>
      <div className="mt-3">{children}</div>
    </li>
  );
}

function LineRow({ line, editable, busy, onToggle }: { line: TrusteeAuditLine; editable: boolean; busy: boolean; onToggle: (verified: boolean) => void }) {
  const e = line.entry;
  const label = `${e.DateLogged.slice(0, 10)} ${line.accountName}: ${e.Description}, ${e.DebitAmount > 0 ? `receipt ${formatMoney(e.DebitAmount)}` : `disbursement ${formatMoney(e.CreditAmount)}`}`;
  return (
    <tr className="border-t-2 border-line align-top">
      <td className="p-2">
        <input
          type="checkbox"
          className="h-7 w-7 cursor-pointer accent-[var(--color-navy)] disabled:cursor-not-allowed"
          checked={line.verified}
          disabled={!editable || busy}
          aria-label={`Verified against the bank statement: ${label}`}
          onChange={(ev) => onToggle(ev.target.checked)}
        />
      </td>
      <td className="whitespace-nowrap p-2 tabular-nums">{e.DateLogged.slice(0, 10)}</td>
      <td className="p-2">{line.accountName}</td>
      <td className="p-2">
        {e.Description}
        {line.transfer ? <span className="ml-2 inline-block rounded border-2 border-line px-1.5 text-sm uppercase">⇄ Transfer</span> : null}
        {e.CheckNumber ? <span className="block text-sm">Check #{e.CheckNumber}</span> : null}
      </td>
      <td className="p-2 text-right tabular-nums">{e.DebitAmount > 0 ? formatMoney(e.DebitAmount) : ''}</td>
      <td className="p-2 text-right tabular-nums">{e.CreditAmount > 0 ? formatMoney(e.CreditAmount) : ''}</td>
      <td className="p-2 text-sm">{line.verified ? `✓ ${line.verifiedByName ?? ''}` : <span className="text-navy">Not verified</span>}</td>
    </tr>
  );
}

function AuditDesk() {
  const user = useUser();
  const scope = useCouncilScope();
  const councilId = scope.councilId;
  const options = auditPeriodOptions(new Date());
  const [choice, setChoice] = useState(`${options[0].fiscalYear}|${options[0].period}`);
  const [fiscalYear, period] = choice.split('|') as [string, AuditPeriod];
  const desk = useLoad(() => db.finance.getTrusteeAudit(user.memberId, councilId, fiscalYear, period), [user.memberId, councilId, fiscalYear, period]);
  const council = useLoad(() => db.councils.get(councilId), [councilId]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);
  const canVerify = canVerifyCouncilAudit(user, councilId);
  const ws = desk.data;
  const locked = ws?.status === 'LOCKED';

  async function act(run: () => Promise<unknown>, done?: string) {
    setBusy(true);
    setMessage(null);
    try {
      await run();
      await desk.reload();
      if (done) setMessage({ tone: 'info', text: done });
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setBusy(false);
    }
  }

  async function printReport() {
    if (!ws || !council.data) return;
    setBusy(true);
    setMessage(null);
    try {
      const pdf = await compileForm1295({ council: { id: councilId, number: council.data.CouncilNumber, name: council.data.CouncilName }, workspace: ws });
      const url = URL.createObjectURL(pdf);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Form_1295_Audit_Report.pdf';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setMessage({ tone: 'info', text: 'The Form 1295 report is downloading. A copy is saved on the server as generated/Form_1295_Audit_Report.pdf.' });
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setBusy(false);
    }
  }

  const alreadySigned = !!ws?.signatures.some((s) => s.memberId === user.memberId);
  const signBlock = !ws
    ? null
    : !canVerify
      ? "Signing belongs to the council's Trustees (and Super Admins)."
      : alreadySigned
        ? 'You have signed this audit.'
        : !locked && !ws.periodEnded
          ? `The period ends on ${ws.throughDate}. Verify lines now; sign after it closes.`
          : !locked && ws.verifiedCount < ws.lineCount
            ? `Verify the ${ws.lineCount - ws.verifiedCount} remaining line${ws.lineCount - ws.verifiedCount === 1 ? '' : 's'} first.`
            : null;

  return (
    <div className="flex flex-col gap-6">
      <PageTitle
        actions={
          <div className="flex flex-wrap items-end gap-3">
            <CouncilSelect scope={scope} />
            <Link href="/finance/dashboard" className="text-sm font-bold underline">
              Financial dashboard
            </Link>
            <Link href="/finance/ledger" className="text-sm font-bold underline">
              General ledger
            </Link>
          </div>
        }
      >
        Trustee Audit Desk
      </PageTitle>
      {desk.error ? <Notice tone="error">{desk.error}</Notice> : null}
      {message ? (
        <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
          {message.text}
        </Notice>
      ) : null}

      <SummaryCard
        id="trustee-audit-title"
        title="🔎 Semiannual Trustee Audit Desk (Form 1295)"
        subtitle="Check every cash line against the bank statements, then sign to lock the period."
      >
        <ol className="flex flex-col gap-4">
          <Step n={1} title="Choose the audit period" done={!!ws}>
            <div className="flex flex-col gap-1 sm:max-w-sm">
              <label htmlFor="audit-period" className="text-sm uppercase tracking-wide text-muted">
                Audit period
              </label>
              <Select id="audit-period" value={choice} onChange={(e) => setChoice(e.target.value)} className="!border-2 !border-gold !text-lg !font-bold">
                {options.map((o) => (
                  <option key={`${o.fiscalYear}|${o.period}`} value={`${o.fiscalYear}|${o.period}`}>
                    {o.label} (fraternal year {o.fiscalYear})
                  </option>
                ))}
              </Select>
            </div>
            {ws ? (
              <p className="mt-2 text-lg" role="status">
                {ws.fromDate} to {ws.throughDate} · {STATUS_LABEL[ws.status]}
                {!ws.periodEnded ? ' · period still open' : ''}
              </p>
            ) : desk.loading ? (
              <p className="mt-2 text-base">Loading…</p>
            ) : null}
          </Step>

          {ws ? (
            <>
              <Step n={2} title="Verify the ledger lines against the bank statements" done={ws.lineCount > 0 && ws.verifiedCount === ws.lineCount}>
                <p className="text-lg" aria-live="polite">
                  {ws.verifiedCount} of {ws.lineCount} line{ws.lineCount === 1 ? '' : 's'} verified
                </p>
                <div className="mt-2 h-4 w-full overflow-hidden rounded border-2 border-line bg-white" role="img" aria-label={`${ws.verifiedCount} of ${ws.lineCount} lines verified`}>
                  <div className="h-full bg-gold" style={{ width: `${ws.lineCount ? (ws.verifiedCount / ws.lineCount) * 100 : 0}%` }} />
                </div>
                {!canVerify ? <p className="mt-2 text-base">Only the council&apos;s Trustees (and Super Admins) tick lines. You can read every line.</p> : null}
                {locked ? <p className="mt-2 text-base">🔒 The audit is locked: its checkmarks can no longer change.</p> : null}
                {ws.lines.length === 0 ? (
                  <p className="mt-3 text-base">No cash lines were posted in this period.</p>
                ) : (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full min-w-[44rem] border-collapse text-base">
                      <caption className="sr-only">Cash ledger lines for {ws.periodLabel}</caption>
                      <thead>
                        <tr className="text-left text-sm uppercase tracking-wide text-muted">
                          <th scope="col" className="p-2">
                            ✓
                          </th>
                          <th scope="col" className="p-2">
                            Date
                          </th>
                          <th scope="col" className="p-2">
                            Account
                          </th>
                          <th scope="col" className="p-2">
                            Description
                          </th>
                          <th scope="col" className="p-2 text-right">
                            Receipt
                          </th>
                          <th scope="col" className="p-2 text-right">
                            Disbursement
                          </th>
                          <th scope="col" className="p-2">
                            Verified by
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {ws.lines.map((line) => (
                          <LineRow
                            key={line.entry.id}
                            line={line}
                            editable={canVerify && !locked}
                            busy={busy}
                            onToggle={(verified) => void act(() => db.finance.setAuditLineVerified(user.memberId, councilId, fiscalYear, period, line.entry.id, verified))}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Step>

              <Step n={3} title="Reconcile cash on hand" done={ws.difference === 0 && ws.verifiedCount === ws.lineCount}>
                <dl className="grid grid-cols-1 gap-3 text-lg sm:grid-cols-2 lg:grid-cols-4">
                  {(
                    [
                      ['Cash at start', ws.cashBalanceBeginning],
                      ['+ Receipts', ws.receipts],
                      ['− Disbursements', ws.disbursements],
                      ['= Cash at end', ws.cashBalanceEnding],
                    ] as const
                  ).map(([label, value]) => (
                    <div key={label} className="rounded border-2 border-line p-3">
                      <dt className="text-sm uppercase tracking-wide text-muted">{label}</dt>
                      <dd className="text-2xl tabular-nums">{formatMoney(value)}</dd>
                    </div>
                  ))}
                </dl>
                <p className={cx('mt-2 text-lg', ws.difference !== 0 && 'text-brand-red')}>
                  {ws.difference === 0 ? '✓ The period ties out to the penny.' : `✖ Off by ${formatMoney(ws.difference)}: check the ledger before signing.`}
                </p>
                <p className="mt-1 text-sm">
                  Cash accounts: {ws.cashAccounts.map((a) => a.accountName + (a.isVirtualGoal ? ' (goal fund)' : '')).join(', ') || 'none'}.{' '}
                  {locked ? 'Balances frozen when the audit was signed.' : 'Balances are live from the ledger until the audit is signed.'}
                </p>
              </Step>

              <Step n={4} title="Sign and lock the period" done={locked}>
                {ws.signatures.length > 0 ? (
                  <ul className="mb-3 flex flex-col gap-1 text-lg">
                    {ws.signatures.map((s) => (
                      <li key={s.memberId}>
                        ✍ {s.name} ({s.role}), {s.signedAt} UTC
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mb-3 text-base">No Trustee has signed yet.</p>
                )}
                {signBlock ? <p className="mb-2 text-base">{signBlock}</p> : null}
                <Button
                  variant="gold"
                  className="text-base"
                  disabled={busy || !!signBlock}
                  onClick={() =>
                    void act(
                      () => db.finance.signTrusteeAudit(user.memberId, councilId, fiscalYear, period),
                      locked ? 'Your signature is added to the audit.' : `The ${ws.periodLabel} audit is signed and locked. The ledger no longer accepts postings dated in it.`,
                    )
                  }
                >
                  {locked ? '✍ Add my signature' : '✍ Sign and lock the period'}
                </Button>
                {!locked ? <p className="mt-2 text-sm">Signing is final: no one can change postings dated in this period afterwards.</p> : null}
              </Step>

              <Step n={5} title="Print the Form 1295 report" done={false}>
                <p className="mb-2 text-base">
                  A print-ready PDF in the layout of Form 1295, with the reconciliation, every line and the signatures.{' '}
                  {locked ? '' : 'Until the audit is signed it prints as a DRAFT.'} Copy its figures onto the official form.
                </p>
                <Button variant="secondary" disabled={busy || !council.data} onClick={() => void printReport()}>
                  📄 Download Form 1295 report (PDF)
                </Button>
              </Step>
            </>
          ) : null}
        </ol>
      </SummaryCard>
    </div>
  );
}

export default function TrusteeAuditPage() {
  return (
    <RequireArea area="finance/audit">
      <AuditDesk />
    </RequireArea>
  );
}
