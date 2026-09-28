'use client';
// Charitable Donation Request Desk: every member's self-service gift desk (Sprint 5V). A member names a charity and
// the amount the council should give (charities.proposeDonation, always 'Pending'), then follows each request here:
// Pending, Approved (paid, with its check and the meeting whose minutes record the vote) or Rejected (with
// leadership's reason). The drivers show a member only their own requests (charities.listMyProposals).
import { useState } from 'react';
import { CHARITY_NAME_MAX_LENGTH, describeError } from '@kofc/shared';
import { CharityStatusPill } from '@/components/CharityParts';
import { RequireArea } from '@/components/CouncilScope';
import { Button, Empty, Field, Input, Notice, PageTitle, Panel, Table, Td } from '@/components/ui';
import { formatFullDate, formatMoney, parseNumberField } from '@/lib/format';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

type Message = { tone: 'error' | 'info'; text: string };

function RequestDesk() {
  const user = useUser();
  const mine = useLoad(() => db.charities.listMyProposals(user.memberId), [user.memberId]);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const rows = mine.data ?? [];

  const submit = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const saved = await db.charities.proposeDonation(user.memberId, user.councilId, {
        ProposedCharityName: name,
        ProposedAmount: parseNumberField(amount, 'Amount') ?? 0,
      });
      setMessage({ tone: 'info', text: `Request #${saved.id} for ${formatMoney(saved.ProposedAmount)} to ${saved.ProposedCharityName} is with your council's leadership.` });
      setName('');
      setAmount('');
      await mine.reload();
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageTitle>Charitable Donation Request Desk</PageTitle>
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <Panel title="Propose a charity grant">
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            {message ? (
              <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
                {message.text}
              </Notice>
            ) : null}
            <Field label="Proposed charity name">
              {(id) => (
                <Input id={id} required maxLength={CHARITY_NAME_MAX_LENGTH} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. St. Vincent de Paul Salem" />
              )}
            </Field>
            <Field label="Amount ($)" hint="The gift you propose the council give">
              {(id) => <Input id={id} required inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="250.00" />}
            </Field>
            <Button type="submit" disabled={busy || name.trim() === '' || amount.trim() === ''}>
              {busy ? 'Submitting…' : 'Submit gift initiative'}
            </Button>
            <p className="text-xs text-muted">
              The council votes on requests at its meetings. When it gives, the Financial Secretary or Treasurer issues the check and your request shows as Approved.
            </p>
          </form>
        </Panel>

        <Panel title={`My requests (${rows.length})`}>
          {mine.error ? <Notice tone="error">{mine.error}</Notice> : null}
          {mine.loading && !mine.data ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : rows.length === 0 ? (
            <Empty>You have not proposed a charity grant yet.</Empty>
          ) : (
            <Table caption="Your charity grant requests, newest first" head={['Request', 'Charity', 'Amount', 'Status', 'Meeting minutes', 'Check']}>
              {rows.map(({ proposal, charity, disbursement }) => (
                <tr key={proposal.id} className={proposal.Status === 'Rejected' ? 'border-l-8 border-brand-red' : undefined}>
                  <Td className="font-bold">#{proposal.id}</Td>
                  <Td>
                    {charity?.Name ?? proposal.ProposedCharityName}
                    {charity && charity.Name !== proposal.ProposedCharityName ? <span className="block text-xs text-muted">Proposed as {proposal.ProposedCharityName}</span> : null}
                    {proposal.Status === 'Rejected' && proposal.RejectionReason ? (
                      <span className="block text-xs text-brand-red">Reason: {proposal.RejectionReason}</span>
                    ) : null}
                  </Td>
                  <Td className="whitespace-nowrap text-right font-bold">{formatMoney(proposal.ProposedAmount)}</Td>
                  <Td>
                    <CharityStatusPill proposal={proposal} />
                  </Td>
                  <Td>{proposal.MeetingMinutesID != null ? `Meeting #${proposal.MeetingMinutesID}` : <span className="text-muted">None</span>}</Td>
                  <Td className="whitespace-nowrap">
                    {disbursement ? (
                      <>
                        Check {disbursement.CheckNumber} · {formatMoney(disbursement.Amount)}
                        <span className="block text-xs text-muted">{formatFullDate(disbursement.PayoutDate)}</span>
                      </>
                    ) : (
                      <span className="text-muted">Not issued</span>
                    )}
                  </Td>
                </tr>
              ))}
            </Table>
          )}
        </Panel>
      </div>
    </>
  );
}

export default function CharityProposalPage() {
  return (
    <RequireArea area="charities/propose">
      <RequestDesk />
    </RequireArea>
  );
}
