'use client';
// Pieces shared by the three charity screens (the request desk, the registry and the disbursements ledger): the
// proposal status chip, a registry entry's summary line and the full charity record form.
import {
  CHARITY_ADDRESS_MAX_LENGTH,
  CHARITY_CONTACT_MAX_LENGTH,
  CHARITY_DESCRIPTION_MAX_LENGTH,
  CHARITY_NAME_MAX_LENGTH,
  CHARITY_PHONE_MAX_LENGTH,
  CHARITY_TYPES,
  CHARITY_ZIP_MAX_LENGTH,
  charityProposalStatusBadge,
  US_STATE_CODES,
  type CharityDonationProposal,
  type CharityDraft,
  type GlobalCharityRegistry,
} from '@kofc/shared';
import { Field, Input, Pill, Select, Textarea } from '@/components/ui';

export function CharityStatusPill({ proposal }: { proposal: Pick<CharityDonationProposal, 'Status'> }) {
  const { label, tone } = charityProposalStatusBadge(proposal);
  return <Pill tone={tone}>{label}</Pill>;
}

/** Name in bold, then type, state, EIN and a Catholic chip; the mailing address underneath when there is one. */
export function CharitySummary({ charity }: { charity: GlobalCharityRegistry }) {
  const address = [charity.Address, charity.ZipCode].filter(Boolean).join(' ');
  return (
    <div>
      <p className="font-bold">
        {charity.Name} {charity.IsCatholic ? <Pill tone="gold">Catholic</Pill> : null}
      </p>
      <p className="text-xs text-muted">
        {charity.CharityType} · {charity.State}
        {charity.EIN ? ` · EIN ${charity.EIN}` : ''}
      </p>
      {address ? <p className="text-xs">{address}</p> : <p className="text-xs text-brand-red">No mailing address on file</p>}
    </div>
  );
}

/** Two-letter state picker; `blankLabel` adds an empty first choice. */
export function StateSelect({ id, value, onChange, blankLabel, required }: { id: string; value: string; onChange: (code: string) => void; blankLabel?: string; required?: boolean }) {
  return (
    <Select id={id} value={value} required={required} onChange={(e) => onChange(e.target.value)}>
      {blankLabel !== undefined ? <option value="">{blankLabel}</option> : null}
      {US_STATE_CODES.map((code) => (
        <option key={code} value={code}>
          {code}
        </option>
      ))}
    </Select>
  );
}

/** Every registry field. The drivers validate on save, so this only shapes the input. */
export function CharityRecordFields({ draft, onChange }: { draft: CharityDraft; onChange: (draft: CharityDraft) => void }) {
  const set = <K extends keyof CharityDraft>(key: K, value: CharityDraft[K]) => onChange({ ...draft, [key]: value });
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <Field label="Charity name" className="md:col-span-2">
        {(id) => <Input id={id} required maxLength={CHARITY_NAME_MAX_LENGTH} value={draft.Name} onChange={(e) => set('Name', e.target.value)} />}
      </Field>
      <Field label="Charity type">
        {(id) => (
          <Select id={id} required value={draft.CharityType} onChange={(e) => set('CharityType', e.target.value)}>
            <option value="">Choose a type…</option>
            {CHARITY_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="State">{(id) => <StateSelect id={id} required value={draft.State} onChange={(code) => set('State', code)} blankLabel="Choose…" />}</Field>
      <Field label="Description" className="md:col-span-2">
        {(id) => (
          <Textarea id={id} required maxLength={CHARITY_DESCRIPTION_MAX_LENGTH} value={draft.Description} onChange={(e) => set('Description', e.target.value)} placeholder="What the charity does" />
        )}
      </Field>
      <Field label="EIN (optional)" hint="Nine digits, as NN-NNNNNNN">
        {(id) => <Input id={id} maxLength={20} value={draft.EIN} onChange={(e) => set('EIN', e.target.value)} placeholder="12-3456789" />}
      </Field>
      <Field label="Phone (optional)">
        {(id) => <Input id={id} type="tel" maxLength={CHARITY_PHONE_MAX_LENGTH} value={draft.Phone} onChange={(e) => set('Phone', e.target.value)} />}
      </Field>
      <Field label="Contact name (optional)">
        {(id) => <Input id={id} maxLength={CHARITY_CONTACT_MAX_LENGTH} value={draft.ContactName} onChange={(e) => set('ContactName', e.target.value)} />}
      </Field>
      <Field label="Contact email (optional)">
        {(id) => <Input id={id} type="email" maxLength={CHARITY_CONTACT_MAX_LENGTH} value={draft.ContactEmail} onChange={(e) => set('ContactEmail', e.target.value)} />}
      </Field>
      <Field label="Mailing address" hint="Where the check is sent">
        {(id) => <Input id={id} maxLength={CHARITY_ADDRESS_MAX_LENGTH} value={draft.Address} onChange={(e) => set('Address', e.target.value)} placeholder="Street, city" />}
      </Field>
      <Field label="ZIP code">
        {(id) => <Input id={id} maxLength={CHARITY_ZIP_MAX_LENGTH} value={draft.ZipCode} onChange={(e) => set('ZipCode', e.target.value)} />}
      </Field>
      <label className="flex items-center gap-2 text-sm font-bold md:col-span-2">
        <input type="checkbox" className="size-4" checked={draft.IsCatholic} onChange={(e) => set('IsCatholic', e.target.checked)} />
        Catholic ministry or organization
      </label>
      <label className="flex items-start gap-2 text-sm md:col-span-2">
        <input type="checkbox" className="mt-0.5 size-4" checked={draft.IsAnnual} onChange={(e) => set('IsAnnual', e.target.checked)} />
        <span>
          <span className="font-bold">Is Annual</span>
          <span className="block text-xs text-muted">
            A budgeting tag only: councils give to this charity every year, so next year&apos;s budget (drafted May 1 - June 30) reads what each council paid it.
          </span>
        </span>
      </label>
    </div>
  );
}
