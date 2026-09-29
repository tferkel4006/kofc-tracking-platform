'use client';
// Charitable Disbursements Ledger (Sprint 5V-3): the charity checkbook of the council's Financial Secretary and
// Treasurer, or a Super Admin (canDisburseCharity). Every 'Pending' gift proposal is a card. "Pay by check" opens the
// check fields (number, payout date, amount, notes) and the charity to pay: the proposal's own registry entry, another
// entry picked from the Global Charities Registry, or a full record typed in for a charity not yet registered.
// "Confirm & Transmit Disbursement Check" calls charities.hydrateAndDisburse, which registers or links the charity,
// writes the ledger row and marks the proposal 'Approved' in one transaction. A check needs a mailing address
// (charityNeedsHydration), so an entry without one must be completed first. "Reject & Return" requires a reason the
// member sees on their request desk (charities.rejectProposal). Paid and rejected proposals are listed underneath.
import { useEffect, useState } from 'react';
import {
  canDisburseCharity,
  charityDraftFrom,
  charityFromDraft,
  charityNeedsHydration,
  charitySearchFromText,
  CHECK_NUMBER_MAX_LENGTH,
  describeError,
  DISBURSEMENT_NOTES_MAX_LENGTH,
  REJECTION_REASON_MAX_LENGTH,
  toIsoDate,
  type CharityDisbursementResult,
  type CharityDraft,
  type CharityProposalDetail,
  type GlobalCharityRegistry,
} from '@kofc/shared';
import { CharityRecordFields, CharityStatusPill, CharitySummary } from '@/components/CharityParts';
import { CouncilSelect, RequireArea, useCouncilScope } from '@/components/CouncilScope';
import { Button, Empty, Field, Input, Notice, PageTitle, Panel, Pill, Select, Table, Td, Textarea } from '@/components/ui';
import { formatFullDate, formatMoney, formatPersonName, parseNumberField } from '@/lib/format';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

type Message = { tone: 'error' | 'info'; text: string };
/** Which charity the check pays: the proposal's registry entry, another registry entry, or a record typed in. */
type Source = 'proposal' | 'registry' | 'record';

const submitterName = (d: CharityProposalDetail) => formatPersonName(d.submitterFirstName, d.submitterLastName) || `Member ${d.proposal.SubmitterMemberID}`;
const charityName = (d: CharityProposalDetail) => d.charity?.Name ?? d.proposal.ProposedCharityName;

/** The check just issued: its number, amount, date and the charity it paid. */
function IssuedCheck({ result, onDismiss }: { result: CharityDisbursementResult; onDismiss: () => void }) {
  const { disbursement, charity, charityRegistered, proposal } = result;
  return (
    <section aria-label="Charity check issued" className="rounded border-2 border-navy border-l-8 border-l-gold bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide">Charity check issued</p>
          <p className="font-serif text-xl font-bold">
            Check {disbursement.CheckNumber} · {formatMoney(disbursement.Amount)}
          </p>
          <p className="text-sm">
            To {charity.Name} · dated {formatFullDate(disbursement.PayoutDate)} · request #{proposal.id} is now Approved
            {charityRegistered ? ' · the charity was added to the global registry' : ''}
            {disbursement.Notes ? ` · ${disbursement.Notes}` : ''}
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
    </section>
  );
}

/** Search the registry and pick one entry. */
function RegistryPicker({ defaultText, value, onChange }: { defaultText: string; value: GlobalCharityRegistry | null; onChange: (c: GlobalCharityRegistry | null) => void }) {
  const user = useUser();
  const [text, setText] = useState(defaultText);
  const [filters, setFilters] = useState(() => charitySearchFromText(defaultText));
  const results = useLoad(() => db.charities.searchGlobalRegistry(user.memberId, { ...filters, limit: 50 }), [user.memberId, filters]);
  const rows = results.data ?? [];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Search the registry by name or EIN" className="min-w-56 flex-1">
          {(id) => (
            <Input
              id={id}
              type="search"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  setFilters(charitySearchFromText(text));
                }
              }}
            />
          )}
        </Field>
        <Button variant="secondary" onClick={() => setFilters(charitySearchFromText(text))}>
          Search
        </Button>
      </div>
      {results.error ? <Notice tone="error">{results.error}</Notice> : null}
      <Field label="Registry charity">
        {(id) => (
          <Select id={id} value={value ? String(value.id) : ''} onChange={(e) => onChange(rows.find((c) => String(c.id) === e.target.value) ?? null)}>
            <option value="">{rows.length === 0 ? 'No registry charity matches' : `Choose one of ${rows.length}…`}</option>
            {rows.map((c) => (
              <option key={c.id} value={c.id}>
                {c.Name} ({c.State}){c.EIN ? ` · ${c.EIN}` : ''}
              </option>
            ))}
          </Select>
        )}
      </Field>
      {value ? <CharitySummary charity={value} /> : null}
    </div>
  );
}

/** Check fields and the charity to pay for one pending proposal. */
function PayForm({ detail, councilId, onPaid, onCancel }: { detail: CharityProposalDetail; councilId: number; onPaid: (result: CharityDisbursementResult) => Promise<void>; onCancel: () => void }) {
  const user = useUser();
  const { proposal, charity } = detail;
  const [source, setSource] = useState<Source>(charity && !detail.needsHydration ? 'proposal' : charity ? 'record' : 'registry');
  const [picked, setPicked] = useState<GlobalCharityRegistry | null>(null);
  const [draft, setDraft] = useState<CharityDraft>(() => charityDraftFrom(charity, { Name: proposal.ProposedCharityName }));
  const [checkNumber, setCheckNumber] = useState('');
  const [payoutDate, setPayoutDate] = useState(() => toIsoDate(new Date()));
  const [amount, setAmount] = useState(String(proposal.ProposedAmount));
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A check is mailed, so the entry it pays must carry an address; a typed record is checked by the drivers.
  const blocked =
    source === 'proposal' ? charityNeedsHydration(charity) : source === 'registry' ? !picked || charityNeedsHydration(picked) : draft.Address.trim() === '' || draft.ZipCode.trim() === '';

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await db.charities.hydrateAndDisburse(
        user.memberId,
        councilId,
        proposal.id,
        {
          CheckNumber: checkNumber,
          PayoutDate: payoutDate,
          Notes: notes.trim() || null,
          Amount: parseNumberField(amount, 'Check amount'),
          CharityID: source === 'registry' ? (picked?.id ?? null) : null,
        },
        source === 'record' ? charityFromDraft(draft) : undefined,
      );
      await onPaid(result);
    } catch (err) {
      setError(describeError(err));
      setBusy(false);
    }
  };

  const sourceChoice = (value: Source, label: string, disabled = false) => (
    <label className={`flex items-center gap-2 text-sm ${disabled ? 'text-muted' : ''}`}>
      <input type="radio" name={`source-${proposal.id}`} className="size-4" checked={source === value} disabled={disabled} onChange={() => setSource(value)} />
      {label}
    </label>
  );

  return (
    <form
      className="flex flex-col gap-3 border-t border-line pt-3"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      {error ? (
        <Notice tone="error" onDismiss={() => setError(null)}>
          {error}
        </Notice>
      ) : null}
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-xs font-bold uppercase tracking-wide">Charity to pay</legend>
        {sourceChoice('proposal', charity ? `The requested charity: ${charity.Name}` : 'The requested charity (not in the registry yet)', !charity)}
        {sourceChoice('registry', 'Link an existing charity from the Global Charities Registry')}
        {sourceChoice('record', charity ? 'Complete or correct the charity record' : 'Enter the full record of a charity not yet registered')}
      </fieldset>

      {source === 'proposal' && charity ? (
        <div className="rounded border border-line p-3">
          <CharitySummary charity={charity} />
          {detail.needsHydration ? <p className="mt-1 text-xs text-brand-red">Add its mailing address before a check can be sent: choose &quot;Complete or correct the charity record&quot;.</p> : null}
        </div>
      ) : source === 'registry' ? (
        <div className="rounded border border-line p-3">
          <RegistryPicker defaultText={proposal.ProposedCharityName} value={picked} onChange={setPicked} />
          {picked && charityNeedsHydration(picked) ? (
            <p className="mt-1 text-xs text-brand-red">This entry has no mailing address. Choose &quot;Enter the full record&quot; with its name and state to fill it in.</p>
          ) : null}
        </div>
      ) : source === 'record' ? (
        <div className="rounded border border-line p-3">
          <CharityRecordFields draft={draft} onChange={setDraft} />
          <p className="mt-2 text-xs text-muted">A charity already in the registry (same EIN, or same name and state) is reused, with its blank fields filled in from this record.</p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Field label="Check number">
          {(id) => <Input id={id} required maxLength={CHECK_NUMBER_MAX_LENGTH} value={checkNumber} onChange={(e) => setCheckNumber(e.target.value)} placeholder="e.g. 1043" />}
        </Field>
        <Field label="Payout date">{(id) => <Input id={id} type="date" required value={payoutDate} onChange={(e) => setPayoutDate(e.target.value)} />}</Field>
        <Field label="Check amount ($)" hint={`Requested ${formatMoney(proposal.ProposedAmount)}`}>
          {(id) => <Input id={id} required inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />}
        </Field>
      </div>
      <Field label="Notes (optional)">
        {(id) => <Textarea id={id} maxLength={DISBURSEMENT_NOTES_MAX_LENGTH} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Voted at the October business meeting" />}
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy || blocked || checkNumber.trim() === '' || payoutDate === '' || amount.trim() === ''}>
          {busy ? 'Recording the check…' : 'Confirm & Transmit Disbursement Check'}
        </Button>
        <Button variant="secondary" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/** The reason form behind Reject & Return. */
function RejectForm({ detail, onRejected, onCancel }: { detail: CharityProposalDetail; onRejected: () => Promise<void>; onCancel: () => void }) {
  const user = useUser();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const who = submitterName(detail);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await db.charities.rejectProposal(user.memberId, detail.proposal.id, reason);
      await onRejected();
    } catch (err) {
      setError(describeError(err));
      setBusy(false);
    }
  };

  return (
    <form
      className="flex flex-col gap-2 border-t border-line pt-3"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      {error ? (
        <Notice tone="error" onDismiss={() => setError(null)}>
          {error}
        </Notice>
      ) : null}
      <Field label="Reason for returning (required)" hint={`${who} sees this on their request desk. ${reason.trim().length}/${REJECTION_REASON_MAX_LENGTH} characters.`}>
        {(id) => (
          <Textarea
            id={id}
            required
            autoFocus
            maxLength={REJECTION_REASON_MAX_LENGTH}
            placeholder="e.g. The council voted to give to this ministry next quarter instead."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        )}
      </Field>
      <div className="flex gap-2">
        <Button type="submit" variant="danger" disabled={busy || reason.trim() === ''}>
          {busy ? 'Returning…' : 'Return to member'}
        </Button>
        <Button variant="secondary" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/** One pending proposal: its request, then the pay or reject form when opened. */
function ProposalCard({
  detail,
  councilId,
  onPaid,
  onRejected,
}: {
  detail: CharityProposalDetail;
  councilId: number;
  onPaid: (result: CharityDisbursementResult) => Promise<void>;
  onRejected: (detail: CharityProposalDetail) => Promise<void>;
}) {
  const [mode, setMode] = useState<'idle' | 'pay' | 'reject'>('idle');
  const { proposal } = detail;
  return (
    <li className="flex flex-col gap-3 rounded border border-line border-l-4 border-l-gold bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-serif text-lg font-bold">
            #{proposal.id} · {charityName(detail)} · {formatMoney(proposal.ProposedAmount)}
          </p>
          <p className="text-sm">
            Requested by {submitterName(detail)}
            {detail.charity && detail.charity.Name !== proposal.ProposedCharityName ? ` · proposed as ${proposal.ProposedCharityName}` : ''}
            {proposal.MeetingMinutesID != null ? ` · Meeting #${proposal.MeetingMinutesID}` : ''}
          </p>
          <div className="mt-1 flex flex-wrap gap-2">
            <CharityStatusPill proposal={proposal} />
            {!detail.charity ? <Pill tone="redOutline">Not in the registry</Pill> : detail.needsHydration ? <Pill tone="redOutline">No mailing address</Pill> : null}
          </div>
        </div>
        {mode === 'idle' ? (
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setMode('pay')}>Pay by check</Button>
            <Button variant="danger" onClick={() => setMode('reject')}>
              Reject &amp; Return
            </Button>
          </div>
        ) : null}
      </div>
      {mode === 'pay' ? <PayForm detail={detail} councilId={councilId} onPaid={onPaid} onCancel={() => setMode('idle')} /> : null}
      {mode === 'reject' ? <RejectForm detail={detail} onRejected={() => onRejected(detail)} onCancel={() => setMode('idle')} /> : null}
    </li>
  );
}

function CharityQueue() {
  const user = useUser();
  const scope = useCouncilScope();
  const councilId = scope.councilId;
  const canDisburse = canDisburseCharity(user, councilId);
  const proposals = useLoad(
    () => (canDisburse ? db.charities.listCouncilProposals(user.memberId, councilId) : Promise.resolve([])),
    [user.memberId, councilId, canDisburse],
  );
  const [issued, setIssued] = useState<CharityDisbursementResult | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  useEffect(() => {
    setIssued(null);
    setMessage(null);
  }, [councilId]);

  const rows = proposals.data ?? [];
  const pending = rows.filter((d) => d.proposal.Status === 'Pending');
  const settled = rows.filter((d) => d.proposal.Status !== 'Pending');

  const paid = async (result: CharityDisbursementResult) => {
    setMessage(null);
    setIssued(result);
    await proposals.reload();
  };
  const rejected = async (d: CharityProposalDetail) => {
    setIssued(null);
    setMessage({ tone: 'info', text: `Returned request #${d.proposal.id} to ${submitterName(d)} with your reason.` });
    await proposals.reload();
  };

  return (
    <>
      <PageTitle actions={<CouncilSelect scope={scope} />}>Charitable Disbursements Ledger</PageTitle>
      {!canDisburse ? (
        <Notice tone="error">Only this council&apos;s Financial Secretary or Treasurer, or a Super Admin, issues charity checks.</Notice>
      ) : (
        <div className="flex flex-col gap-4">
          {proposals.error ? <Notice tone="error">{proposals.error}</Notice> : null}
          {issued ? <IssuedCheck result={issued} onDismiss={() => setIssued(null)} /> : null}
          {message ? (
            <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
              {message.text}
            </Notice>
          ) : null}

          <Panel title={`Pending gift requests (${pending.length})`}>
            {proposals.loading && !proposals.data ? (
              <p className="text-sm text-muted">Loading…</p>
            ) : pending.length === 0 ? (
              <Empty>No charity gift requests are waiting for a check.</Empty>
            ) : (
              <ul className="flex flex-col gap-3" aria-label="Pending charity gift requests, oldest first">
                {pending.map((d) => (
                  <ProposalCard key={d.proposal.id} detail={d} councilId={councilId} onPaid={paid} onRejected={rejected} />
                ))}
              </ul>
            )}
          </Panel>

          <Panel title={`Paid and returned requests (${settled.length})`}>
            {settled.length === 0 ? (
              <Empty>No charity request has been paid or returned yet.</Empty>
            ) : (
              <Table caption="Charity requests already paid or returned, newest first" head={['Request', 'Charity', 'Requested by', 'Status', 'Check', 'Amount']}>
                {settled.map((d) => (
                  <tr key={d.proposal.id} className={d.proposal.Status === 'Rejected' ? 'border-l-8 border-brand-red' : undefined}>
                    <Td className="font-bold">#{d.proposal.id}</Td>
                    <Td>
                      {charityName(d)}
                      {d.proposal.Status === 'Rejected' && d.proposal.RejectionReason ? (
                        <span className="block text-xs text-brand-red">Reason: {d.proposal.RejectionReason}</span>
                      ) : null}
                    </Td>
                    <Td>{submitterName(d)}</Td>
                    <Td>
                      <CharityStatusPill proposal={d.proposal} />
                    </Td>
                    <Td className="whitespace-nowrap">
                      {d.disbursement ? (
                        <>
                          Check {d.disbursement.CheckNumber}
                          <span className="block text-xs text-muted">{formatFullDate(d.disbursement.PayoutDate)}</span>
                        </>
                      ) : (
                        <span className="text-muted">None</span>
                      )}
                    </Td>
                    <Td className="whitespace-nowrap text-right font-bold">{formatMoney(d.disbursement?.Amount ?? d.proposal.ProposedAmount)}</Td>
                  </tr>
                ))}
              </Table>
            )}
          </Panel>
        </div>
      )}
    </>
  );
}

export default function CharityQueuePage() {
  return (
    <RequireArea area="charities/queue">
      <CharityQueue />
    </RequireArea>
  );
}
