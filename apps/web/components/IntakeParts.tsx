'use client';
// Charitable intake pieces shared by Propose Charity Grant and the Pooled Vetting Desk (Sprint 5Z-2): the request's
// pipeline chip, the Shepherd's 3-step track, the Four-Eyes "Sponsor Restriction" lock, and the read-only summary of a filed intake form.
import type { ReactNode } from 'react';
import { CHARITABLE_TRACKING_STEPS, charitableTrackingPosition, type CharitableRequestDetail } from '@kofc/shared';
import { Pill } from '@/components/ui';
import { formatFullDate, formatMoney, formatPhone } from '@/lib/format';

/** Pipeline chip: Submitted outlined, Claimed in gold ("Reviewing by ..."), Advanced in navy, Declined outlined in red. */
export function RequestStatusPill({ detail }: { detail: CharitableRequestDetail }) {
  const { request } = detail;
  switch (request.RequestStatus) {
    case 'Submitted':
      return <Pill tone="outline">Unassigned</Pill>;
    case 'Claimed by Trustee':
      return <Pill tone="gold">Reviewing by {[detail.vetterFirstName, detail.vetterLastName].filter(Boolean).join(' ') || 'a vetter'}</Pill>;
    case 'Advanced':
      return <Pill tone="navy">Advanced to vote</Pill>;
    case 'Declined':
      return <Pill tone="redOutline">Declined</Pill>;
  }
}

/**
 * The Shepherd's 3-step track (Sprint 5Z-Member-Charity): Vetting, Presentation, Disbursement. Finished steps are navy,
 * the current one gold, one the request stopped in (declined or voted down) outlined in red, later steps outlined.
 */
export function TrackingSteps({ request }: { request: CharitableRequestDetail['request'] }) {
  const { stepIndex, stopped } = charitableTrackingPosition(request);
  return (
    <ol className="flex flex-wrap items-center gap-1" aria-label="Tracking steps">
      {CHARITABLE_TRACKING_STEPS.map((step, i) => {
        const tone = i < stepIndex ? 'navy' : i > stepIndex ? 'outline' : stopped ? 'redOutline' : 'gold';
        const state = i < stepIndex ? 'done' : i > stepIndex ? 'not started' : stopped ? 'stopped here' : 'current step';
        return (
          <li key={step} title={`${step}: ${state}`}>
            <Pill tone={tone}>
              {i + 1}. {step}
            </Pill>
            <span className="sr-only">({state})</span>
          </li>
        );
      })}
    </ol>
  );
}

/** Padlock drawn in currentColor. */
function PadlockIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

/**
 * The locked control a Knight Shepherd sees on their own request: vetting must come from another set of eyes
 * (the Four-Eyes Principle), so every claim and vetting control on the row is replaced by this.
 */
export function SponsorRestriction() {
  return (
    <span
      title="Four-Eyes Principle: you are this request's Knight Shepherd, so another officer or Trustee must vet it."
      className="inline-flex items-center gap-1.5 rounded border-2 border-line bg-white px-2 py-1 text-xs font-bold uppercase tracking-wide text-muted"
    >
      <PadlockIcon />
      Sponsor Restriction
    </span>
  );
}

/** One label and value of the summary; blank values show an en dash. */
function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-wide">{label}</dt>
      <dd className="whitespace-pre-wrap text-sm">{children === null || children === undefined || children === '' ? '–' : children}</dd>
    </div>
  );
}

/** The filed intake form, section by section, as the vetting drawer shows it. */
export function RequestSummary({ detail }: { detail: CharitableRequestDetail }) {
  const r = detail.request;
  return (
    <div className="flex flex-col gap-4">
      <section aria-label="Organization">
        <h3 className="mb-2 border-b border-line font-serif text-base font-bold">1 · Organization / Ministry</h3>
        <dl className="grid grid-cols-2 gap-3">
          <Item label="Organization">{r.OrganizationName}</Item>
          <Item label="501(c)(3)">{r.Is501c3 ? `Yes${r.EIN ? ` · EIN ${r.EIN}` : ''}` : 'No'}</Item>
          <Item label="Website">{r.Website}</Item>
          <Item label="Recurring request">{r.IsRecurring ? 'Yes, every year' : 'No'}</Item>
          <Item label="Mailing address">{r.MailingAddress}</Item>
          <Item label="Mission">{r.OrgMission}</Item>
        </dl>
      </section>
      <section aria-label="Contact">
        <h3 className="mb-2 border-b border-line font-serif text-base font-bold">2 · Contact Details</h3>
        <dl className="grid grid-cols-2 gap-3">
          <Item label="Contact">{r.ContactName}</Item>
          <Item label="Phone">{r.ContactPhone ? formatPhone(r.ContactPhone) : null}</Item>
          <Item label="Email">{r.ContactEmail}</Item>
          <Item label="Knight Shepherd">{`${detail.shepherdFirstName} ${detail.shepherdLastName}`.trim()}</Item>
        </dl>
      </section>
      <section aria-label="Request">
        <h3 className="mb-2 border-b border-line font-serif text-base font-bold">3 · The Request</h3>
        <dl className="grid grid-cols-2 gap-3">
          <Item label="Amount requested">{formatMoney(r.AmountRequested)}</Item>
          <Item label="Funds needed by">{r.FundsNeededBy ? formatFullDate(r.FundsNeededBy) : null}</Item>
          <Item label="Relationship">{detail.relationshipName}</Item>
          <Item label="Mission area">{detail.missionAreaName}</Item>
          <Item label="Specific use">{r.SpecificUse}</Item>
          <Item label="Beneficiaries">{r.TargetBeneficiary}</Item>
          <Item label="Accountability plan">{r.AccountabilityPlan}</Item>
          <Item label="Tier">{`Tier ${r.RequestTier}`}</Item>
        </dl>
      </section>
    </div>
  );
}
