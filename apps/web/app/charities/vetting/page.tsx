'use client';
// Pooled Vetting Desk (Sprint 5Z-2): the council's shared triage spreadsheet of charitable intake requests
// (charities.listCharitableRequestsQueue), for its officers (Trustees included), Admins and any Super Admin.
//   - Unassigned rows carry a gold "Claim & Audit" button (charities.triageRequestStatus 'claim').
//   - Claimed rows show who is reviewing them; the assigned vetter alone opens the vetting drawer to log notes, name
//     the budget line the gift would come from and advance or decline the request ('note', 'advance', 'decline').
//   - Four-Eyes Principle: on a request the viewer carries as its Knight Shepherd every control is replaced by a
//     padlocked "Sponsor Restriction" (isSponsorRestricted; the data service refuses it too, SELF_VETTING_BLOCKED).
import { useState } from 'react';
import {
  CHARITABLE_REQUEST_MAX_TIER,
  CHARITABLE_REQUEST_STATUSES,
  CHARITABLE_VETTING_NOTES_MAX_LENGTH,
  currentFraternalYear,
  describeError,
  isSponsorRestricted,
  type CharitableRequestDetail,
  type CharitableRequestStatus,
  type CouncilBudgetForecast,
} from '@kofc/shared';
import { CouncilSelect, RequireArea, useCouncilScope } from '@/components/CouncilScope';
import { Drawer } from '@/components/Drawer';
import { RequestStatusPill, RequestSummary, SponsorRestriction } from '@/components/IntakeParts';
import { Button, cx, Empty, Field, Notice, PageTitle, Panel, Select, Table, Td, Textarea } from '@/components/ui';
import { formatFullDate, formatMoney } from '@/lib/format';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

type Message = { tone: 'error' | 'info'; text: string };
type Decision = 'note' | 'advance' | 'decline';

const STAGE_LABEL: Record<CharitableRequestStatus, string> = {
  Submitted: 'Unassigned',
  'Claimed by Trustee': 'Under review',
  Advanced: 'Advanced to vote',
  Declined: 'Declined',
};

/** The assigned vetter's drawer: the filed form, then notes, target budget line, tier and the decision. */
function VettingDrawer({
  detail,
  lines,
  onClose,
  onSaved,
}: {
  detail: CharitableRequestDetail;
  lines: CouncilBudgetForecast[];
  onClose: () => void;
  onSaved: (text: string) => Promise<void>;
}) {
  const user = useUser();
  const r = detail.request;
  const [notes, setNotes] = useState(r.VettingNotes ?? '');
  const [lineId, setLineId] = useState(r.TargetBudgetLineID != null ? String(r.TargetBudgetLineID) : '');
  const [tier, setTier] = useState(String(r.RequestTier));
  const [decision, setDecision] = useState<Decision>('note');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const saved = await db.charities.triageRequestStatus(user.memberId, r.id, {
        action: decision,
        VettingNotes: notes,
        RequestTier: Number(tier),
        TargetBudgetLineID: lineId ? Number(lineId) : null,
      });
      const outcome =
        decision === 'advance' ? 'advanced to the council vote' : decision === 'decline' ? 'declined' : 'updated; it stays under your review';
      await onSaved(`Request #${saved.request.id} from ${saved.request.OrganizationName} was ${outcome}.`);
    } catch (err) {
      setError(describeError(err));
      setBusy(false);
    }
  };

  const choices: { id: Decision; label: string; hint: string }[] = [
    { id: 'note', label: 'Keep reviewing', hint: 'Save the notes, tier and budget line; the request stays claimed by you' },
    { id: 'advance', label: 'Advance', hint: 'Vetting is complete: send the request to the council vote' },
    { id: 'decline', label: 'Decline', hint: 'Vetting is complete: the council will not take this request up' },
  ];

  return (
    <Drawer title={`Vet request #${r.id}: ${r.OrganizationName}`} onClose={onClose} wide>
      <RequestSummary detail={detail} />
      <form
        className="flex flex-col gap-3 border-t-4 border-gold pt-3"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <h3 className="font-serif text-base font-bold">Vetting record</h3>
        {error ? <Notice tone="error">{error}</Notice> : null}
        <Field label="Vetting notes" hint="Calls made, documents checked, your recommendation">
          {(id) => <Textarea id={id} rows={4} maxLength={CHARITABLE_VETTING_NOTES_MAX_LENGTH} value={notes} onChange={(e) => setNotes(e.target.value)} />}
        </Field>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_8rem]">
          <Field label="Target budget line" hint={lines.length === 0 ? 'The council has no budget lines for this fraternal year yet' : 'Where the gift would be paid from'}>
            {(id) => (
              <Select id={id} value={lineId} onChange={(e) => setLineId(e.target.value)}>
                <option value="">No budget line</option>
                {lines.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.LineItemName} · {formatMoney(l.ApprovedBudgetAmount || l.ProposedBudgetAmount)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Tier">
            {(id) => (
              <Select id={id} value={tier} onChange={(e) => setTier(e.target.value)}>
                {Array.from({ length: CHARITABLE_REQUEST_MAX_TIER }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    Tier {i + 1}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-xs font-bold uppercase tracking-wide">Decision</legend>
          {choices.map((c) => (
            <label key={c.id} className={cx('flex items-start gap-2 rounded border-2 px-3 py-2 text-sm', decision === c.id ? 'border-navy' : 'border-line')}>
              <input type="radio" name="decision" className="mt-0.5 size-4" checked={decision === c.id} onChange={() => setDecision(c.id)} />
              <span>
                <span className="font-bold">{c.label}</span>
                <span className="block text-xs text-muted">{c.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <div className="flex gap-3">
          <Button type="submit" variant={decision === 'decline' ? 'danger' : 'primary'} disabled={busy}>
            {busy ? 'Saving…' : decision === 'advance' ? 'Advance to vote' : decision === 'decline' ? 'Decline request' : 'Save vetting notes'}
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
        </div>
      </form>
    </Drawer>
  );
}

/** The row's action cell, by stage and by who is looking. */
function RowAction({
  detail,
  busy,
  onClaim,
  onOpen,
}: {
  detail: CharitableRequestDetail;
  busy: boolean;
  onClaim: () => void;
  onOpen: () => void;
}) {
  const user = useUser();
  const r = detail.request;
  if (isSponsorRestricted(user, r)) return <SponsorRestriction />;
  if (r.RequestStatus === 'Submitted') {
    return (
      <Button onClick={onClaim} disabled={busy} className="whitespace-nowrap border-gold bg-gold text-navy">
        🔎 Claim &amp; Audit
      </Button>
    );
  }
  if (r.RequestStatus === 'Claimed by Trustee') {
    return r.VetterMemberID === user.memberId ? (
      <Button size="sm" onClick={onOpen}>
        Open vetting drawer
      </Button>
    ) : (
      <span className="text-xs text-muted">Held by its vetter</span>
    );
  }
  return <span className="text-xs text-muted">{r.VettedDate ? `Vetted ${formatFullDate(r.VettedDate)}` : 'Vetted'}</span>;
}

function VettingDesk() {
  const user = useUser();
  const scope = useCouncilScope();
  const fraternalYear = currentFraternalYear(new Date());
  const queue = useLoad(() => db.charities.listCharitableRequestsQueue(user.memberId, scope.councilId), [user.memberId, scope.councilId]);
  const budget = useLoad(() => db.budget.listAnnualForecast(user.memberId, scope.councilId, fraternalYear), [user.memberId, scope.councilId, fraternalYear]);
  const [openId, setOpenId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const rows = queue.data ?? [];
  const open = rows.find((d) => d.request.id === openId) ?? null;

  const claim = async (detail: CharitableRequestDetail) => {
    setBusyId(detail.request.id);
    setMessage(null);
    try {
      await db.charities.triageRequestStatus(user.memberId, detail.request.id, { action: 'claim' });
      await queue.reload();
      setOpenId(detail.request.id);
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <PageTitle actions={<CouncilSelect scope={scope} />}>Pooled Vetting Desk</PageTitle>
      <div className="flex flex-col gap-4">
        <ul className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Requests by stage">
          {CHARITABLE_REQUEST_STATUSES.map((status) => {
            const inStage = rows.filter((d) => d.request.RequestStatus === status);
            return (
              <li key={status} className={cx('rounded border-2 border-navy bg-white px-4 py-2', status === 'Submitted' && 'border-t-8 border-t-gold')}>
                <p className="text-sm font-bold">{STAGE_LABEL[status]}</p>
                <p className="text-3xl font-bold leading-tight">{inStage.length}</p>
                <p className="text-xs text-muted">{formatMoney(inStage.reduce((sum, d) => sum + d.request.AmountRequested, 0))} requested</p>
              </li>
            );
          })}
        </ul>

        {message ? (
          <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
            {message.text}
          </Notice>
        ) : null}
        {queue.error ? <Notice tone="error">{queue.error}</Notice> : null}

        <Panel title={`Triage queue (${rows.length})`}>
          {queue.loading && !queue.data ? (
            <p className="text-sm text-muted">Loading the queue…</p>
          ) : rows.length === 0 ? (
            <Empty>No intake requests yet. Members file them from the Charitable Intake Sheet.</Empty>
          ) : (
            <Table
              caption="Charitable intake requests in pipeline order: unassigned, under review, advanced, declined"
              head={['#', 'Organization', 'Knight Shepherd', 'Amount', 'Needed by', 'Tier', 'Status', 'Action']}
            >
              {rows.map((d) => {
                const r = d.request;
                const restricted = isSponsorRestricted(user, r);
                return (
                  <tr key={r.id} className={cx(restricted && 'bg-line/40 text-muted', r.RequestStatus === 'Declined' && 'border-l-8 border-brand-red')}>
                    <Td className="font-bold">#{r.id}</Td>
                    <Td>
                      <span className="font-bold">{r.OrganizationName}</span>
                      <span className="block text-xs text-muted">
                        {[d.relationshipName, d.missionAreaName].filter(Boolean).join(' · ') || 'No relationship or mission area given'}
                      </span>
                      {d.targetBudgetLine ? <span className="block text-xs">Budget line: {d.targetBudgetLine.name}</span> : null}
                    </Td>
                    <Td>
                      {d.shepherdFirstName} {d.shepherdLastName}
                      <span className="block text-xs text-muted">Filed {formatFullDate(r.SubmittedAt)}</span>
                    </Td>
                    <Td className="whitespace-nowrap text-right font-bold">{formatMoney(r.AmountRequested)}</Td>
                    <Td className="whitespace-nowrap">{r.FundsNeededBy ? formatFullDate(r.FundsNeededBy) : '–'}</Td>
                    <Td>{r.RequestTier}</Td>
                    <Td>
                      <RequestStatusPill detail={d} />
                    </Td>
                    <Td>
                      <RowAction detail={d} busy={busyId === r.id} onClaim={() => void claim(d)} onOpen={() => setOpenId(r.id)} />
                    </Td>
                  </tr>
                );
              })}
            </Table>
          )}
          <p className="mt-2 text-xs text-muted">
            Four-Eyes Principle: a Knight Shepherd never vets their own request, so those rows are locked for you. Only the claiming vetter opens a claimed
            request&apos;s drawer.
          </p>
        </Panel>
      </div>

      {open && !isSponsorRestricted(user, open.request) && open.request.RequestStatus === 'Claimed by Trustee' && open.request.VetterMemberID === user.memberId ? (
        <VettingDrawer
          key={open.request.id}
          detail={open}
          lines={budget.data?.lines ?? []}
          onClose={() => setOpenId(null)}
          onSaved={async (text) => {
            setOpenId(null);
            setMessage({ tone: 'info', text });
            await queue.reload();
          }}
        />
      ) : null}
    </>
  );
}

export default function CharitableVettingPage() {
  return (
    <RequireArea area="charities/vetting">
      <VettingDesk />
    </RequireArea>
  );
}
