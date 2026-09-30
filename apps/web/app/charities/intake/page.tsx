'use client';
// Charitable Intake Sheet (Sprint 5Z-2): the paper intake document's Sections 1-3 as a web form for every signed-in
// member. The member is the request's Knight Shepherd: the data service records the caller as ShepherdMemberID, so
// nobody can file a request in another member's name. Relationship types and mission areas are the council's own
// (charities.listCouncilRelationshipTypes, listCouncilMissionAreas). The EIN box appears only while "registered
// 501(c)(3)" is ticked, and unticking it clears the EIN. Submitting calls charities.submitCharitableRequest, which drops
// the request into the council's Pooled Vetting Desk as Submitted.
import { useState, type ReactNode } from 'react';
import { CHARITABLE_FORM_TEXT_MAX_LENGTH, CHARITABLE_REQUEST_MAX_TIER, CHARITY_NAME_MAX_LENGTH, describeError } from '@kofc/shared';
import { RequireArea } from '@/components/CouncilScope';
import { Button, Field, Input, Notice, PageTitle, Select, Textarea } from '@/components/ui';
import { blankToNull, formatMoney, parseNumberField } from '@/lib/format';
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
  MissionAreaID: string;
  AmountRequested: string;
  FundsNeededBy: string;
  SpecificUse: string;
  TargetBeneficiary: string;
  AccountabilityPlan: string;
  RequestTier: string;
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
  MissionAreaID: '',
  AmountRequested: '',
  FundsNeededBy: '',
  SpecificUse: '',
  TargetBeneficiary: '',
  AccountabilityPlan: '',
  RequestTier: '1',
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

function IntakeSheet() {
  const user = useUser();
  const types = useLoad(() => db.charities.listCouncilRelationshipTypes(user.councilId), [user.councilId]);
  const areas = useLoad(() => db.charities.listCouncilMissionAreas(user.councilId), [user.councilId]);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const text = (key: keyof Draft) => (draft[key] as string);

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
        MissionAreaID: draft.MissionAreaID ? Number(draft.MissionAreaID) : null,
        AmountRequested: parseNumberField(draft.AmountRequested, 'Amount requested') ?? 0,
        FundsNeededBy: blankToNull(draft.FundsNeededBy),
        SpecificUse: blankToNull(draft.SpecificUse),
        TargetBeneficiary: blankToNull(draft.TargetBeneficiary),
        AccountabilityPlan: blankToNull(draft.AccountabilityPlan),
        RequestTier: Number(draft.RequestTier),
      });
      setMessage({
        tone: 'info',
        text: `Request #${saved.request.id} from ${saved.request.OrganizationName} for ${formatMoney(saved.request.AmountRequested)} is in the council's vetting queue. An officer or Trustee other than you will claim and audit it.`,
      });
      setDraft(EMPTY);
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageTitle>Charitable Intake Sheet</PageTitle>
      <form
        className="flex max-w-5xl flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 rounded border-2 border-navy bg-white px-4 py-3">
          <p className="text-sm">
            <span className="text-xs font-bold uppercase tracking-wide">Knight Shepherd</span>
            <span className="block font-serif text-lg font-bold">
              {user.firstName} {user.lastName}
            </span>
          </p>
          <p className="max-w-xl text-xs text-muted">
            You carry this request to the council. It is filed under your member profile automatically, and you will not be able to vet it yourself.
          </p>
        </div>

        {message ? (
          <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
            {message.text}
          </Notice>
        ) : null}
        {types.error ? <Notice tone="error">{types.error}</Notice> : null}
        {areas.error ? <Notice tone="error">{areas.error}</Notice> : null}

        <Section number={1} title="Organization / Ministry">
          <Field label="Organization or ministry name" className="md:col-span-2">
            {(id) => <Input id={id} required maxLength={CHARITY_NAME_MAX_LENGTH} value={text('OrganizationName')} onChange={(e) => set('OrganizationName', e.target.value)} />}
          </Field>
          <Field label="Mission" hint="What the organization does, in a sentence or two" className="md:col-span-2">
            {(id) => <Textarea id={id} maxLength={CHARITABLE_FORM_TEXT_MAX_LENGTH} value={text('OrgMission')} onChange={(e) => set('OrgMission', e.target.value)} />}
          </Field>
          <Field label="Website">
            {(id) => <Input id={id} type="url" maxLength={255} placeholder="https://" value={text('Website')} onChange={(e) => set('Website', e.target.value)} />}
          </Field>
          <Field label="Mailing address" hint="Where a check would be mailed">
            {(id) => <Textarea id={id} rows={2} maxLength={CHARITABLE_FORM_TEXT_MAX_LENGTH} value={text('MailingAddress')} onChange={(e) => set('MailingAddress', e.target.value)} />}
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
          <Field label="Mission area" hint="Faith in Action pillar the gift serves">
            {(id) => (
              <Select id={id} value={draft.MissionAreaID} onChange={(e) => set('MissionAreaID', e.target.value)}>
                <option value="">Choose a mission area…</option>
                {(areas.data ?? []).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.MissionAreaName}
                  </option>
                ))}
              </Select>
            )}
          </Field>
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
          <Field label="Request tier" hint="1 is a small, routine gift">
            {(id) => (
              <Select id={id} value={draft.RequestTier} onChange={(e) => set('RequestTier', e.target.value)}>
                {Array.from({ length: CHARITABLE_REQUEST_MAX_TIER }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    Tier {i + 1}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </Section>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={busy || draft.OrganizationName.trim() === '' || draft.AmountRequested.trim() === ''}>
            {busy ? 'Submitting…' : 'Submit to the vetting queue'}
          </Button>
          <Button variant="secondary" disabled={busy} onClick={() => setDraft(EMPTY)}>
            Clear form
          </Button>
        </div>
      </form>
    </>
  );
}

export default function CharitableIntakePage() {
  return (
    <RequireArea area="charities/intake">
      <IntakeSheet />
    </RequireArea>
  );
}
