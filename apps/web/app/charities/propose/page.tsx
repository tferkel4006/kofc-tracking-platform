'use client';
// Propose Charity Grant (Sprint 5Z-Member-Charity): the members-only way an organization's grant request reaches the
// council. The separate Charitable Intake Sheet (Sprint 5Z-2) folded into this page, so there is no other entry path.
// The form is the paper intake document's Sections 1-3 without the request tier (the vetter sets it). The member is
// the request's Knight Shepherd: the data service records the signed-in caller as ShepherdMemberID, so the form
// carries no Shepherd field and nobody can file in another member's name. Saving calls charities.submitCharitableRequest
// (Submitted, in the council's Pooled Vetting Desk) and dispatches the Shepherd's 3-step tracking notice
// (dispatchCharitableTrackingNotice: Vetting -> Presentation -> Disbursement, plus the date the Trustees are prompted
// for a status report). My requests (charities.listMyCharitableRequests) follows each request along that track.
// Sprint 6H: each request's "Request More Info" button opens the private thread its vetting officer started with the
// Shepherd, to read and answer it. The officers' "Request Officer Input" forum is never shown here.
// Sprint 6L Extension 4: the manual Mission area dropdown is gone. The member picks a Local Category, its fixed Supreme
// Mission Area shows as a read-only badge, and the data service files the request under the matching council mission area.
import { useState, type ReactNode } from 'react';
import {
  CHARITABLE_FORM_TEXT_MAX_LENGTH,
  CHARITABLE_TRUSTEE_FOLLOWUP_MONTHS,
  CHARITY_NAME_MAX_LENGTH,
  charitableTrusteeFollowUpDate,
  describeError,
  dispatchCharitableTrackingNotice,
} from '@kofc/shared';
import { RequireArea } from '@/components/CouncilScope';
import { TrackingSteps } from '@/components/IntakeParts';
import { LocalCategoryField } from '@/components/MissionCategoryParts';
import { RequestThreadButtons, RequestThreadDrawer } from '@/components/RequestThreads';
import { Button, Empty, Field, Input, Notice, PageTitle, Panel, Select, Table, Td, Textarea } from '@/components/ui';
import { blankToNull, formatFullDate, formatMoney, parseNumberField } from '@/lib/format';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

interface Draft {
  OrganizationName: string;
  OrgMission: string;
  Website: string;
  MailingAddress: string;
  Is501c3: boolean;
  EIN: string;
  IsRecurring: boolean;
  ContactName: string;
  ContactPhone: string;
  ContactEmail: string;
  RelationshipTypeID: string;
  CategoryID: string;
  AmountRequested: string;
  FundsNeededBy: string;
  SpecificUse: string;
  TargetBeneficiary: string;
  AccountabilityPlan: string;
}

const EMPTY: Draft = {
  OrganizationName: '',
  OrgMission: '',
  Website: '',
  MailingAddress: '',
  Is501c3: false,
  EIN: '',
  IsRecurring: false,
  ContactName: '',
  ContactPhone: '',
  ContactEmail: '',
  RelationshipTypeID: '',
  CategoryID: '',
  AmountRequested: '',
  FundsNeededBy: '',
  SpecificUse: '',
  TargetBeneficiary: '',
  AccountabilityPlan: '',
};

type Message = { tone: 'error' | 'info'; text: string };

/** A numbered section of the paper form: a gold-edged card with the section's number and title. */
function Section({ number, title, children }: { number: number; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`intake-section-${number}`} className="rounded border-2 border-navy border-t-8 border-t-gold bg-white">
      <header className="flex items-baseline gap-3 border-b border-line px-4 py-2">
        <span className="rounded-full bg-navy px-2 py-0.5 text-xs font-bold text-white">Section {number}</span>
        <h2 id={`intake-section-${number}`} className="font-serif text-lg font-bold">
          {title}
        </h2>
      </header>
      <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2">{children}</div>
    </section>
  );
}

function Checkbox({ checked, onChange, label, hint }: { checked: boolean; onChange: (checked: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <input type="checkbox" className="mt-0.5 size-4" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <span className="font-bold">{label}</span>
        {hint ? <span className="block text-xs text-muted">{hint}</span> : null}
      </span>
    </label>
  );
}

function GrantProposal() {
  const user = useUser();
  const types = useLoad(() => db.charities.listCouncilRelationshipTypes(user.councilId), [user.councilId]);
  const categories = useLoad(() => db.lookups.list('Category'), []);
  const mine = useLoad(() => db.charities.listMyCharitableRequests(user.memberId), [user.memberId]);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const [threadId, setThreadId] = useState<number | null>(null);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const text = (key: keyof Draft) => draft[key] as string;
  const rows = mine.data ?? [];
  const threadRequest = rows.find((d) => d.request.id === threadId)?.request ?? null;

  const submit = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const saved = await db.charities.submitCharitableRequest(user.memberId, {
        OrganizationName: draft.OrganizationName,
        OrgMission: blankToNull(draft.OrgMission),
        Website: blankToNull(draft.Website),
        MailingAddress: blankToNull(draft.MailingAddress),
        Is501c3: draft.Is501c3,
        EIN: draft.Is501c3 ? blankToNull(draft.EIN) : null,
        IsRecurring: draft.IsRecurring,
        ContactName: blankToNull(draft.ContactName),
        ContactPhone: blankToNull(draft.ContactPhone),
        ContactEmail: blankToNull(draft.ContactEmail),
        RelationshipTypeID: draft.RelationshipTypeID ? Number(draft.RelationshipTypeID) : null,
        CategoryID: draft.CategoryID ? Number(draft.CategoryID) : null,
        AmountRequested: parseNumberField(draft.AmountRequested, 'Amount requested') ?? 0,
        FundsNeededBy: blankToNull(draft.FundsNeededBy),
        SpecificUse: blankToNull(draft.SpecificUse),
        TargetBeneficiary: blankToNull(draft.TargetBeneficiary),
        AccountabilityPlan: blankToNull(draft.AccountabilityPlan),
      });
      const notice = dispatchCharitableTrackingNotice(saved);
      setMessage({
        tone: 'info',
        text:
          `Request #${saved.request.id} from ${saved.request.OrganizationName} for ${formatMoney(saved.request.AmountRequested)} is filed. ` +
          `It moves through Vetting, Presentation and Disbursement; follow it under My requests. ` +
          `The Trustees will ask for a status report on ${formatFullDate(notice.trusteeFollowUpDate)}.`,
      });
      setDraft(EMPTY);
      await mine.reload();
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageTitle>Propose Charity Grant</PageTitle>
      <div className="flex max-w-5xl flex-col gap-4">
        <form
          className="flex flex-col gap-4"
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
          {types.error ? <Notice tone="error">{types.error}</Notice> : null}
          {categories.error ? <Notice tone="error">{categories.error}</Notice> : null}

          <Section number={1} title="Organization / Ministry">
            <Field label="Organization or ministry name" className="md:col-span-2">
              {(id) => <Input id={id} required maxLength={CHARITY_NAME_MAX_LENGTH} value={text('OrganizationName')} onChange={(e) => set('OrganizationName', e.target.value)} />}
            </Field>
            <Field label="Mission" hint="What the organization does, in a sentence or two" className="md:col-span-2">
              {(id) => <Textarea id={id} maxLength={CHARITABLE_FORM_TEXT_MAX_LENGTH} value={text('OrgMission')} onChange={(e) => set('OrgMission', e.target.value)} />}
            </Field>
            <Field label="Mailing address" hint="Street, city, state and ZIP, where a check would be mailed" className="md:col-span-2">
              {(id) => (
                <Textarea
                  id={id}
                  rows={3}
                  className="text-base leading-relaxed"
                  maxLength={CHARITABLE_FORM_TEXT_MAX_LENGTH}
                  value={text('MailingAddress')}
                  onChange={(e) => set('MailingAddress', e.target.value)}
                />
              )}
            </Field>
            <Field label="Website">
              {(id) => <Input id={id} type="url" maxLength={255} placeholder="https://" value={text('Website')} onChange={(e) => set('Website', e.target.value)} />}
            </Field>
            <div className="flex flex-col gap-3">
              <Checkbox
                label="Registered 501(c)(3) charity"
                hint="Tick to enter the organization's EIN"
                checked={draft.Is501c3}
                onChange={(checked) => setDraft((d) => ({ ...d, Is501c3: checked, EIN: checked ? d.EIN : '' }))}
              />
              <Checkbox label="Recurring request" hint="The organization expects to ask every year" checked={draft.IsRecurring} onChange={(checked) => set('IsRecurring', checked)} />
            </div>
            {draft.Is501c3 ? (
              <Field label="EIN" hint="Nine digits, as NN-NNNNNNN">
                {(id) => <Input id={id} inputMode="numeric" maxLength={20} placeholder="93-1234567" value={text('EIN')} onChange={(e) => set('EIN', e.target.value)} />}
              </Field>
            ) : null}
          </Section>

          <Section number={2} title="Contact Details">
            <Field label="Contact name">{(id) => <Input id={id} maxLength={255} value={text('ContactName')} onChange={(e) => set('ContactName', e.target.value)} />}</Field>
            <Field label="Contact phone">
              {(id) => <Input id={id} type="tel" maxLength={50} value={text('ContactPhone')} onChange={(e) => set('ContactPhone', e.target.value)} />}
            </Field>
            <Field label="Contact email" className="md:col-span-2">
              {(id) => <Input id={id} type="email" maxLength={255} value={text('ContactEmail')} onChange={(e) => set('ContactEmail', e.target.value)} />}
            </Field>
          </Section>

          <Section number={3} title="The Request">
            <Field label="Relationship to the council">
              {(id) => (
                <Select id={id} value={draft.RelationshipTypeID} onChange={(e) => set('RelationshipTypeID', e.target.value)}>
                  <option value="">Choose a relationship…</option>
                  {(types.data ?? []).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.RelationshipName}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <LocalCategoryField
              className="md:col-span-2"
              categories={categories.data ?? []}
              value={draft.CategoryID ? Number(draft.CategoryID) : null}
              onChange={(id) => set('CategoryID', id === null ? '' : String(id))}
            />
            <Field label="Amount requested ($)">
              {(id) => <Input id={id} required inputMode="decimal" placeholder="500.00" value={text('AmountRequested')} onChange={(e) => set('AmountRequested', e.target.value)} />}
            </Field>
            <Field label="Funds needed by">{(id) => <Input id={id} type="date" value={text('FundsNeededBy')} onChange={(e) => set('FundsNeededBy', e.target.value)} />}</Field>
            <Field label="Specific use" hint="What the money will buy" className="md:col-span-2">
              {(id) => <Textarea id={id} maxLength={CHARITABLE_FORM_TEXT_MAX_LENGTH} value={text('SpecificUse')} onChange={(e) => set('SpecificUse', e.target.value)} />}
            </Field>
            <Field label="Target beneficiaries" hint="Who the gift will help">
              {(id) => <Textarea id={id} rows={2} maxLength={CHARITABLE_FORM_TEXT_MAX_LENGTH} value={text('TargetBeneficiary')} onChange={(e) => set('TargetBeneficiary', e.target.value)} />}
            </Field>
            <Field label="Accountability plan" hint="How the organization will report back">
              {(id) => (
                <Textarea id={id} rows={2} maxLength={CHARITABLE_FORM_TEXT_MAX_LENGTH} value={text('AccountabilityPlan')} onChange={(e) => set('AccountabilityPlan', e.target.value)} />
              )}
            </Field>
          </Section>

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={busy || draft.OrganizationName.trim() === '' || draft.AmountRequested.trim() === ''}>
              {busy ? 'Saving…' : 'Save and submit for vetting'}
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => setDraft(EMPTY)}>
              Clear form
            </Button>
          </div>
        </form>

        <Panel title={`My requests (${rows.length})`}>
          {mine.error ? <Notice tone="error">{mine.error}</Notice> : null}
          {mine.loading && !mine.data ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : rows.length === 0 ? (
            <Empty>You have not proposed a charity grant yet.</Empty>
          ) : (
            <Table caption="Your charity grant requests, newest first" head={['Request', 'Organization / Ministry', 'Amount', 'Tracking', 'Trustee follow-up', 'Vetting messages']}>
              {rows.map(({ request }) => (
                <tr key={request.id}>
                  <Td className="font-bold">#{request.id}</Td>
                  <Td>{request.OrganizationName}</Td>
                  <Td className="whitespace-nowrap text-right font-bold">{formatMoney(request.AmountRequested)}</Td>
                  <Td>
                    <TrackingSteps request={request} />
                  </Td>
                  <Td className="whitespace-nowrap">{formatFullDate(charitableTrusteeFollowUpDate(request))}</Td>
                  <Td>
                    <RequestThreadButtons request={request} types={['MORE_INFO']} onOpen={() => setThreadId(request.id)} />
                  </Td>
                </tr>
              ))}
            </Table>
          )}
          <p className="mt-3 text-xs text-muted">
            An officer or Trustee other than you vets each request, the council votes on it at a Monthly meeting, and the Financial Secretary or Treasurer issues
            the check. The Trustees ask for a status report {CHARITABLE_TRUSTEE_FOLLOWUP_MONTHS} months after you file. If the vetting officer needs more
            information, their questions appear under Request More Info; answer them there.
          </p>
        </Panel>
      </div>
      {threadRequest ? <RequestThreadDrawer key={threadRequest.id} request={threadRequest} threadType="MORE_INFO" onClose={() => setThreadId(null)} /> : null}
    </>
  );
}

export default function CharityProposalPage() {
  return (
    <RequireArea area="charities/propose">
      <GrantProposal />
    </RequireArea>
  );
}
