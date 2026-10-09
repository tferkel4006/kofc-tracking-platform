// =========================================================================
// CHARITABLE GIVING AND DISBURSEMENTS (Sprint 5V)
// Pure helpers behind the charities.* service methods: field validation for
// the global registry, EIN and state normalization, duplicate detection, the
// registry search and local suggestions, proposal and check cleaning. Drivers
// load rows, call these, then only store. Who may act is decided in rules.ts
// (assertMayAddGlobalCharity, assertMayConnectCouncilCharity,
// assertMayProposeCharityGift, assertMayDisburseCharity).
// =========================================================================
import type {
  CharitableRequestDetail,
  CharitableRequestThreadDetail,
  CharitableRequestThreads,
  LinkableCharitableRequest,
  CharitableTriageAction,
  CharitableTriageInput,
  CharityCheckDetails,
  CharityProposalDetail,
  CharityProposalInput,
  CharitySearchFilters,
  CouncilCharityLedgerEntry,
  MissionAreaFootprint,
  MissionAreaFootprintEntry,
  NewCharitableRequest,
  NewGlobalCharity,
} from './contract';
import { cleanDisbursementCheck, sumAmounts } from './expenses';
import { fraternalYearBounds } from './budget';
import { addDays } from './planning';
import { toTimestamp } from './messaging';
import {
  assertIsoDate,
  assertMoney,
  assertText,
  BusinessRuleError,
  donationMethodKind,
  mayOverrideVettingClaim,
  mayVetCharitableRequests,
  optionalText,
  SecurityPrivilegeError,
  type MemberWriteActor,
} from './rules';
import type {
  CharitableDisbursementLedger,
  CharitableRequest,
  CharitableRequestThread,
  CharitableRequestThreadMessage,
  CharitableThreadType,
  CharitableRequestStatus,
  CharitableRequestVoteStatus,
  CharityDonationProposal,
  CharityProposalStatus,
  CouncilBudgetForecast,
  CouncilCharityLink,
  CouncilMissionArea,
  CouncilRelationshipType,
  Donation,
  Event,
  EventTime,
  GlobalCharityRegistry,
  Meeting,
  Member,
} from './types';

/** Longest GlobalCharityRegistry.Name and CharityDonationProposal.ProposedCharityName (VARCHAR(255)). */
export const CHARITY_NAME_MAX_LENGTH = 255;
/** Longest GlobalCharityRegistry.Description; the column is TEXT, the cap keeps an entry readable. */
export const CHARITY_DESCRIPTION_MAX_LENGTH = 2000;
/** Longest GlobalCharityRegistry.CharityType (VARCHAR(100)). */
export const CHARITY_TYPE_MAX_LENGTH = 100;
/** Longest GlobalCharityRegistry.Phone (VARCHAR(50)). */
export const CHARITY_PHONE_MAX_LENGTH = 50;
/** Longest GlobalCharityRegistry.ContactName and ContactEmail (VARCHAR(255)). */
export const CHARITY_CONTACT_MAX_LENGTH = 255;
/** Longest GlobalCharityRegistry.Address (VARCHAR(512)). */
export const CHARITY_ADDRESS_MAX_LENGTH = 512;
/** Longest GlobalCharityRegistry.ZipCode (VARCHAR(20)). */
export const CHARITY_ZIP_MAX_LENGTH = 20;
/** charities.searchGlobalRegistry returns this many rows unless asked for fewer or more. */
export const CHARITY_SEARCH_DEFAULT_LIMIT = 100;
export const CHARITY_SEARCH_MAX_LIMIT = 500;

export const CHARITY_PROPOSAL_STATUSES: readonly CharityProposalStatus[] = ['Pending', 'Approved', 'Rejected'];

/** The core causes a registry entry is filed under (Sprint 5V-2); CharityType must be one of them. */
export const CHARITY_TYPES = ['Food Security', 'Women and Children', 'Faith', 'Protecting Life', 'Homelessness', 'Parish'] as const;
export type CharityType = (typeof CHARITY_TYPES)[number];

/** One of CHARITY_TYPES, matched ignoring case and surrounding spaces, in its canonical spelling. */
export function assertCharityType(value: unknown): CharityType {
  const text = assertText(value, 'Charity type', CHARITY_TYPE_MAX_LENGTH).toLowerCase();
  const found = CHARITY_TYPES.find((type) => type.toLowerCase() === text);
  if (!found) throw invalid(`Charity type must be one of ${CHARITY_TYPES.join(', ')}; received ${JSON.stringify(value)}.`, { value });
  return found;
}

/** Columns a registry write stores, besides its id; the only ones a driver may interpolate into SQL. */
export const CHARITY_COLUMNS = [
  'Name',
  'Description',
  'EIN',
  'State',
  'Phone',
  'ContactName',
  'ContactEmail',
  'Address',
  'ZipCode',
  'IsCatholic',
  'CharityType',
  'IsAnnual',
] as const satisfies readonly (keyof GlobalCharityRegistry)[];

/** The optional registry columns hydrateAndDisburse may fill in on an existing entry, never overwrite. */
export const CHARITY_FILLABLE_COLUMNS = ['EIN', 'Phone', 'ContactName', 'ContactEmail', 'Address', 'ZipCode'] as const satisfies readonly (keyof GlobalCharityRegistry)[];

export type CleanGlobalCharity = Omit<GlobalCharityRegistry, 'id'>;

const invalid = (message: string, details: Record<string, unknown> = {}) => new BusinessRuleError('INVALID_INPUT', message, details);

const isId = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v > 0;

function optionalId(value: unknown, label: string): number | null {
  if (value === undefined || value === null) return null;
  if (!isId(value)) throw invalid(`${label} must be a record id; received ${JSON.stringify(value)}.`, { label });
  return value;
}

/** An amount of more than 0 with at most two decimal places. */
function positiveAmount(value: unknown, label: string): number {
  const amount = assertMoney(value, label);
  if (amount === 0) throw invalid(`${label} must be more than 0.`, { label });
  return amount;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---- normalization -----------------------------------------------------------

/** An IRS EIN in any punctuation ('123456789', '12 3456789'), as 'NN-NNNNNNN'. Rejects anything but nine digits. */
export function normalizeEin(value: unknown, label = 'EIN'): string {
  const digits = typeof value === 'string' ? value.replace(/[\s-]/g, '') : '';
  if (!/^\d{9}$/.test(digits)) throw invalid(`${label} must be nine digits, as NN-NNNNNNN; received ${JSON.stringify(value)}.`, { label });
  return `${digits.slice(0, 2)}-${digits.slice(2)}`;
}

/** A two-letter postal code, upper case. */
export function normalizeStateCode(value: unknown, label = 'State'): string {
  const code = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (!/^[A-Z]{2}$/.test(code)) throw invalid(`${label} must be a two-letter state code; received ${JSON.stringify(value)}.`, { label });
  return code;
}

/** Name compared ignoring case and runs of spaces, so 'St. Vincent  de Paul' and 'st. vincent de paul' match. */
const nameKey = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();

// ---- the registry ------------------------------------------------------------

/** A registry entry for addGlobalCharity and hydrateAndDisburse, validated and normalized. */
export function cleanGlobalCharity(input: NewGlobalCharity): CleanGlobalCharity {
  if (typeof input !== 'object' || input === null) throw invalid('Charity details are required.');
  for (const key of Object.keys(input)) {
    if (!(CHARITY_COLUMNS as readonly string[]).includes(key)) {
      throw invalid(`A charity has no field "${key}"; its fields are ${CHARITY_COLUMNS.join(', ')}.`, { field: key });
    }
  }
  const ein = optionalText(input.EIN, 'EIN', 20);
  const email = optionalText(input.ContactEmail, 'Contact email', CHARITY_CONTACT_MAX_LENGTH);
  if (email !== null && !EMAIL.test(email)) throw invalid(`Contact email must be an email address; received ${JSON.stringify(email)}.`);
  if (input.IsCatholic !== undefined && input.IsCatholic !== null && typeof input.IsCatholic !== 'boolean') {
    throw invalid(`IsCatholic must be true or false; received ${JSON.stringify(input.IsCatholic)}.`);
  }
  if (input.IsAnnual !== undefined && input.IsAnnual !== null && typeof input.IsAnnual !== 'boolean') {
    throw invalid(`IsAnnual must be true or false; received ${JSON.stringify(input.IsAnnual)}.`);
  }
  return {
    Name: assertText(input.Name, 'Charity name', CHARITY_NAME_MAX_LENGTH),
    Description: assertText(input.Description, 'Description', CHARITY_DESCRIPTION_MAX_LENGTH),
    EIN: ein === null ? null : normalizeEin(ein),
    State: normalizeStateCode(input.State),
    Phone: optionalText(input.Phone, 'Phone', CHARITY_PHONE_MAX_LENGTH),
    ContactName: optionalText(input.ContactName, 'Contact name', CHARITY_CONTACT_MAX_LENGTH),
    ContactEmail: email,
    Address: optionalText(input.Address, 'Address', CHARITY_ADDRESS_MAX_LENGTH),
    ZipCode: optionalText(input.ZipCode, 'Zip code', CHARITY_ZIP_MAX_LENGTH),
    IsCatholic: input.IsCatholic ? 1 : 0,
    CharityType: assertCharityType(input.CharityType),
    IsAnnual: input.IsAnnual ? 1 : 0,
  };
}

/**
 * The registry entry `charity` duplicates, if any: the one with the same EIN or, when either EIN is missing, the same
 * Name (ignoring case and spacing) in the same State. Two entries with different EINs are different charities even
 * under one name.
 */
export function findRegisteredCharity(
  registry: readonly GlobalCharityRegistry[],
  charity: Pick<GlobalCharityRegistry, 'Name' | 'State' | 'EIN'>,
): GlobalCharityRegistry | undefined {
  const byEin = charity.EIN ? registry.find((r) => r.EIN === charity.EIN) : undefined;
  if (byEin) return byEin;
  const key = nameKey(charity.Name);
  return registry.find((r) => r.State === charity.State && nameKey(r.Name) === key && (!charity.EIN || !r.EIN));
}

export const charityAlreadyRegistered = (existing: Pick<GlobalCharityRegistry, 'id' | 'Name' | 'State'>): BusinessRuleError =>
  new BusinessRuleError(
    'CHARITY_ALREADY_REGISTERED',
    `${existing.Name} (${existing.State}) is already in the charity registry as entry ${existing.id}; connect your council to it instead.`,
    { charityId: existing.id },
  );

/** The blank optional columns of `existing` that `incoming` supplies; empty when there is nothing to fill in. */
export function charityBlankFills(existing: GlobalCharityRegistry, incoming: CleanGlobalCharity): Partial<CleanGlobalCharity> {
  const fills: Partial<CleanGlobalCharity> = {};
  for (const column of CHARITY_FILLABLE_COLUMNS) {
    const current = existing[column];
    if ((current === null || current === undefined || current === '') && incoming[column] != null) fills[column] = incoming[column];
  }
  return fills;
}

export const charityNotFound = (charityId: number): BusinessRuleError =>
  new BusinessRuleError('RECORD_NOT_FOUND', `Charity ${charityId} is not in the registry.`, { table: 'GlobalCharityRegistry', id: charityId });

// ---- search and suggestions --------------------------------------------------

export interface CleanCharitySearch {
  name: string | null;
  charityType: string | null;
  state: string | null;
  ein: string | null;
  isCatholic: boolean | null;
  limit: number;
}

export function cleanCharitySearchFilters(filters: CharitySearchFilters | undefined): CleanCharitySearch {
  const f = filters ?? {};
  if (typeof f !== 'object' || f === null) throw invalid('Search filters must be an object.');
  const state = optionalText(f.state, 'State', 20);
  const ein = optionalText(f.ein, 'EIN', 20);
  if (f.isCatholic !== undefined && f.isCatholic !== null && typeof f.isCatholic !== 'boolean') {
    throw invalid(`isCatholic must be true or false; received ${JSON.stringify(f.isCatholic)}.`);
  }
  const limit = f.limit ?? CHARITY_SEARCH_DEFAULT_LIMIT;
  if (!isId(limit) || limit > CHARITY_SEARCH_MAX_LIMIT) {
    throw invalid(`Limit must be a whole number from 1 to ${CHARITY_SEARCH_MAX_LIMIT}; received ${JSON.stringify(f.limit)}.`);
  }
  return {
    name: optionalText(f.name, 'Name', CHARITY_NAME_MAX_LENGTH),
    charityType: optionalText(f.charityType, 'Charity type', CHARITY_TYPE_MAX_LENGTH),
    state: state === null ? null : normalizeStateCode(state),
    ein: ein === null ? null : normalizeEin(ein),
    isCatholic: f.isCatholic ?? null,
    limit,
  };
}

/** Name A-Z ignoring case, then State, then id. */
const compareCharities = (a: GlobalCharityRegistry, b: GlobalCharityRegistry) =>
  a.Name.localeCompare(b.Name, 'en', { sensitivity: 'base' }) || a.State.localeCompare(b.State) || a.id - b.id;

/** charities.searchGlobalRegistry over the registry rows (a driver may pre-filter by state or EIN). */
export function searchCharityRegistry(rows: readonly GlobalCharityRegistry[], search: CleanCharitySearch): GlobalCharityRegistry[] {
  const name = search.name?.toLowerCase() ?? null;
  const type = search.charityType?.toLowerCase() ?? null;
  return rows
    .filter(
      (r) =>
        (name === null || r.Name.toLowerCase().includes(name)) &&
        (type === null || r.CharityType.trim().toLowerCase() === type) &&
        (search.state === null || r.State === search.state) &&
        (search.ein === null || r.EIN === search.ein) &&
        (search.isCatholic === null || r.IsCatholic === (search.isCatholic ? 1 : 0)),
    )
    .sort(compareCharities)
    .slice(0, search.limit);
}

/** charities.listSuggestedLocal: entries in `stateCode` outside `linkedCharityIds`, Catholic charities first. */
export function suggestLocalCharities(
  rows: readonly GlobalCharityRegistry[],
  stateCode: string,
  linkedCharityIds: readonly number[],
): GlobalCharityRegistry[] {
  const linked = new Set(linkedCharityIds);
  return rows
    .filter((r) => r.State === stateCode && !linked.has(r.id))
    .sort((a, b) => b.IsCatholic - a.IsCatholic || compareCharities(a, b));
}

// ---- proposals and checks ----------------------------------------------------

export interface CleanCharityProposal {
  ProposedCharityName: string | null;
  ProposedAmount: number;
  ExistingCharityID: number | null;
}

export function cleanCharityProposal(input: CharityProposalInput): CleanCharityProposal {
  if (typeof input !== 'object' || input === null) throw invalid('Proposal details are required.');
  const clean = {
    ProposedCharityName: optionalText(input.ProposedCharityName, 'Charity name', CHARITY_NAME_MAX_LENGTH),
    ProposedAmount: positiveAmount(input.ProposedAmount, 'Proposed amount'),
    ExistingCharityID: optionalId(input.ExistingCharityID, 'Existing charity'),
  };
  if (clean.ProposedCharityName === null && clean.ExistingCharityID === null) {
    throw invalid('A proposal needs the charity\'s name or a charity from the registry.');
  }
  return clean;
}

export interface CleanCharityCheck {
  CheckNumber: string;
  PayoutDate: string;
  Notes: string | null;
  /** null: pay the proposal's ProposedAmount. */
  Amount: number | null;
  /** null: keep the proposal's MeetingMinutesID. */
  MeetingMinutesID: number | null;
  /** null: no registry entry chosen on the check itself. */
  CharityID: number | null;
}

export function cleanCharityCheck(details: CharityCheckDetails): CleanCharityCheck {
  const base = cleanDisbursementCheck(details);
  return {
    ...base,
    Amount: details.Amount === undefined || details.Amount === null ? null : positiveAmount(details.Amount, 'Check amount'),
    MeetingMinutesID: optionalId(details.MeetingMinutesID, 'Meeting'),
    CharityID: optionalId(details.CharityID, 'Charity'),
  };
}

export const charityProposalNotFound = (proposalId: number): BusinessRuleError =>
  new BusinessRuleError('RECORD_NOT_FOUND', `Charity proposal ${proposalId} does not exist.`, { table: 'CharityDonationProposal', id: proposalId });

/** Rejects PROPOSAL_STATUS_CONFLICT unless the proposal is still 'Pending'. `action` completes "cannot ...". */
export function assertProposalPending(proposal: Pick<CharityDonationProposal, 'id' | 'Status'>, action: string): void {
  if (proposal.Status === 'Pending') return;
  throw new BusinessRuleError(
    'PROPOSAL_STATUS_CONFLICT',
    `Charity proposal ${proposal.id} is ${proposal.Status}, so it cannot ${action}; only a Pending proposal can.`,
    { proposalId: proposal.id, status: proposal.Status },
  );
}

/** The meeting whose minutes record the vote must belong to the council. */
export function assertMinutesMeetingInCouncil(meeting: Pick<Meeting, 'id' | 'CouncilID'> | null | undefined, meetingId: number, councilId: number): void {
  if (meeting && meeting.CouncilID === councilId) return;
  throw invalid(`Meeting ${meetingId} is not a meeting of council ${councilId}.`, { meetingId, councilId });
}

/** hydrateAndDisburse was given no charity details for a proposal that names no registry entry. */
export const noCharityToPay = (proposalId: number): BusinessRuleError =>
  invalid(`Charity proposal ${proposalId} names no registered charity; supply the charity's details to register it.`, { proposalId });

/** hydrateAndDisburse may be told which entry to pay by a CharityID or by full charity details, not both. */
export function assertOneCharitySource(check: Pick<CleanCharityCheck, 'CharityID'>, hasCharityData: boolean): void {
  if (check.CharityID !== null && hasCharityData) {
    throw invalid('Pay either the linked registry charity or the charity details typed in, not both.', { charityId: check.CharityID });
  }
}

// ---- proposal and ledger views (Sprint 5V-2) ----------------------------------

/** A check needs a registry entry with a mailing address; without one the officer must hydrate the record first. */
export const charityNeedsHydration = (charity: Pick<GlobalCharityRegistry, 'Address' | 'ZipCode'> | null | undefined): boolean =>
  !charity || !charity.Address || !charity.ZipCode;

/** 'Pending' first, oldest first (the payout queue); then every other status newest first. */
const compareProposals = (a: CharityDonationProposal, b: CharityDonationProposal) => {
  const pa = a.Status === 'Pending' ? 0 : 1;
  const pb = b.Status === 'Pending' ? 0 : 1;
  return pa - pb || (pa === 0 ? a.id - b.id : b.id - a.id);
};

/**
 * Joins proposals with their submitters, registry entries and the checks that paid them (by ProposalID). `order`
 * 'queue' sorts Pending first; 'newest' sorts by id, newest first.
 */
export function buildCharityProposalDetails(
  proposals: readonly CharityDonationProposal[],
  members: readonly Pick<Member, 'id' | 'MemberFirstName' | 'MemberLastName'>[],
  charities: readonly GlobalCharityRegistry[],
  ledger: readonly CharitableDisbursementLedger[],
  order: 'queue' | 'newest',
): CharityProposalDetail[] {
  const sorted = [...proposals].sort(order === 'queue' ? compareProposals : (a, b) => b.id - a.id);
  return sorted.map((proposal) => {
    const member = members.find((m) => m.id === proposal.SubmitterMemberID);
    const charity = charities.find((c) => c.id === proposal.ExistingCharityID) ?? null;
    return {
      proposal,
      submitterFirstName: member?.MemberFirstName ?? '',
      submitterLastName: member?.MemberLastName ?? '',
      charity,
      disbursement: ledger.find((d) => d.ProposalID === proposal.id) ?? null,
      needsHydration: proposal.Status === 'Pending' && charityNeedsHydration(charity),
    };
  });
}

/** charities.listCouncilLedger from the council's links, the registry entries they name and the council's checks. */
export function buildCouncilCharityLedger(
  links: readonly CouncilCharityLink[],
  charities: readonly GlobalCharityRegistry[],
  ledger: readonly CharitableDisbursementLedger[],
): CouncilCharityLedgerEntry[] {
  const entries: CouncilCharityLedgerEntry[] = [];
  for (const link of links) {
    const charity = charities.find((c) => c.id === link.CharityID);
    if (!charity) continue;
    const disbursements = ledger
      .filter((d) => d.CouncilID === link.CouncilID && d.CharityID === charity.id)
      .sort((a, b) => b.PayoutDate.localeCompare(a.PayoutDate) || b.id - a.id);
    entries.push({ charity, connectedAt: link.ConnectedAt, disbursements, totalGiven: sumAmounts(disbursements.map((d) => d.Amount)) });
  }
  return entries.sort((a, b) => compareCharities(a.charity, b.charity));
}

// ---- screen helpers (Sprint 5V-2) ---------------------------------------------

/** Two-letter codes for the 50 states and DC, for the registry's state pickers. */
export const US_STATE_CODES = [
  'AK', 'AL', 'AR', 'AZ', 'CA', 'CO', 'CT', 'DC', 'DE', 'FL', 'GA', 'HI', 'IA', 'ID', 'IL', 'IN', 'KS', 'KY', 'LA', 'MA', 'MD', 'ME', 'MI', 'MN', 'MO', 'MS',
  'MT', 'NC', 'ND', 'NE', 'NH', 'NJ', 'NM', 'NV', 'NY', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VA', 'VT', 'WA', 'WI', 'WV', 'WY',
] as const;

/** The status chip of a proposal: Pending in gold, Approved (paid) in navy, Rejected outlined in red. */
export function charityProposalStatusBadge(proposal: Pick<CharityDonationProposal, 'Status'>): {
  label: string;
  tone: 'gold' | 'navy' | 'redOutline';
} {
  const tone = { Pending: 'gold', Approved: 'navy', Rejected: 'redOutline' } as const;
  return { label: proposal.Status, tone: tone[proposal.Status] };
}

/** A registry entry as the forms hold it: text exactly as typed. */
export interface CharityDraft {
  Name: string;
  Description: string;
  EIN: string;
  State: string;
  Phone: string;
  ContactName: string;
  ContactEmail: string;
  Address: string;
  ZipCode: string;
  IsCatholic: boolean;
  CharityType: string;
  /** Sprint 5Y: a budgeting tag only - the council gives every fraternal year. */
  IsAnnual: boolean;
}

/** An empty form, or one started from what is known (a registry entry, a proposed name, a state). */
export function charityDraftFrom(
  charity: Partial<Pick<GlobalCharityRegistry, keyof CharityDraft | 'IsCatholic' | 'IsAnnual'>> | null,
  defaults: { Name?: string; State?: string } = {},
): CharityDraft {
  const text = (v: string | null | undefined) => v ?? '';
  return {
    Name: text(charity?.Name ?? defaults.Name),
    Description: text(charity?.Description),
    EIN: text(charity?.EIN),
    State: text(charity?.State ?? defaults.State),
    Phone: text(charity?.Phone),
    ContactName: text(charity?.ContactName),
    ContactEmail: text(charity?.ContactEmail),
    Address: text(charity?.Address),
    ZipCode: text(charity?.ZipCode),
    IsCatholic: charity?.IsCatholic === 1,
    CharityType: text(charity?.CharityType),
    IsAnnual: charity?.IsAnnual === 1,
  };
}

/** The form's text as a NewGlobalCharity; the drivers validate it (cleanGlobalCharity), so nothing is refused here. */
export const charityFromDraft = (draft: CharityDraft): NewGlobalCharity => ({
  ...draft,
  EIN: draft.EIN.trim() || null,
  Phone: draft.Phone.trim() || null,
  ContactName: draft.ContactName.trim() || null,
  ContactEmail: draft.ContactEmail.trim() || null,
  Address: draft.Address.trim() || null,
  ZipCode: draft.ZipCode.trim() || null,
});

/** A search box's text as filters: nine digits (in any punctuation) search the EIN, anything else the name. */
export function charitySearchFromText(text: string): Pick<CharitySearchFilters, 'name' | 'ein'> {
  const trimmed = text.trim();
  if (trimmed === '') return {};
  return /^\d{2}[\s-]?\d{7}$/.test(trimmed) ? { ein: trimmed } : { name: trimmed };
}

// ---- normalized charitable intake and the vetting desk (Sprint 5Z-1) -----------

/** The vetting pipeline in order; the queue lists requests stage by stage. */
export const CHARITABLE_REQUEST_STATUSES: readonly CharitableRequestStatus[] = ['Submitted', 'Claimed by Trustee', 'Advanced', 'Declined'];
export const CHARITABLE_VOTE_STATUSES: readonly CharitableRequestVoteStatus[] = ['Pending', 'Approved', 'Rejected'];
export const CHARITABLE_TRIAGE_ACTIONS: readonly CharitableTriageAction[] = ['claim', 'note', 'advance', 'decline'];
/** Highest CharitableRequest.RequestTier; tiers run 1 (small, routine) to this. */
export const CHARITABLE_REQUEST_MAX_TIER = 3;
/** Longest CharitableRequest.VettingNotes; the column is TEXT, the cap keeps notes readable. */
export const CHARITABLE_VETTING_NOTES_MAX_LENGTH = 2000;
/** Longest free-text answer on the intake form (the TEXT columns). */
export const CHARITABLE_FORM_TEXT_MAX_LENGTH = 2000;

/** The intake form's fields; the only CharitableRequest columns submitCharitableRequest writes from the caller. */
export const CHARITABLE_REQUEST_FORM_COLUMNS = [
  'OrganizationName',
  'AmountRequested',
  'ContactName',
  'ContactPhone',
  'ContactEmail',
  'MailingAddress',
  'RelationshipTypeID',
  'MissionAreaID',
  'CategoryID',
  'Is501c3',
  'EIN',
  'Website',
  'OrgMission',
  'IsRecurring',
  'FundsNeededBy',
  'SpecificUse',
  'TargetBeneficiary',
  'AccountabilityPlan',
  'RequestTier',
] as const satisfies readonly (keyof NewCharitableRequest & keyof CharitableRequest)[];

export type CleanCharitableRequest = Pick<CharitableRequest, (typeof CHARITABLE_REQUEST_FORM_COLUMNS)[number]>;

function assertRequestTier(value: unknown): number {
  if (!isId(value) || value > CHARITABLE_REQUEST_MAX_TIER) {
    throw invalid(`Request tier must be a whole number from 1 to ${CHARITABLE_REQUEST_MAX_TIER}; received ${JSON.stringify(value)}.`, { value });
  }
  return value;
}

function optionalFlag(value: unknown, label: string): number {
  if (value === undefined || value === null) return 0;
  if (typeof value !== 'boolean') throw invalid(`${label} must be true or false; received ${JSON.stringify(value)}.`, { label });
  return value ? 1 : 0;
}

/** A Knight Shepherd's intake form, validated and normalized; the driver checks RelationshipTypeID against the council. */
export function cleanCharitableRequest(input: NewCharitableRequest): CleanCharitableRequest {
  if (typeof input !== 'object' || input === null) throw invalid('Request details are required.');
  for (const key of Object.keys(input)) {
    if (!(CHARITABLE_REQUEST_FORM_COLUMNS as readonly string[]).includes(key)) {
      throw invalid(`A charitable request has no field "${key}"; its fields are ${CHARITABLE_REQUEST_FORM_COLUMNS.join(', ')}.`, { field: key });
    }
  }
  const email = optionalText(input.ContactEmail, 'Contact email', CHARITY_CONTACT_MAX_LENGTH);
  if (email !== null && !EMAIL.test(email)) throw invalid(`Contact email must be an email address; received ${JSON.stringify(email)}.`);
  const ein = optionalText(input.EIN, 'EIN', 50);
  const neededBy = optionalText(input.FundsNeededBy, 'Funds needed by', 10);
  const text = (value: unknown, label: string) => optionalText(value, label, CHARITABLE_FORM_TEXT_MAX_LENGTH);
  return {
    OrganizationName: assertText(input.OrganizationName, 'Organization name', CHARITY_NAME_MAX_LENGTH),
    AmountRequested: positiveAmount(input.AmountRequested, 'Amount requested'),
    ContactName: optionalText(input.ContactName, 'Contact name', CHARITY_CONTACT_MAX_LENGTH),
    ContactPhone: optionalText(input.ContactPhone, 'Contact phone', CHARITY_PHONE_MAX_LENGTH),
    ContactEmail: email,
    MailingAddress: text(input.MailingAddress, 'Mailing address'),
    RelationshipTypeID: optionalId(input.RelationshipTypeID, 'Relationship type'),
    MissionAreaID: optionalId(input.MissionAreaID, 'Mission area'),
    CategoryID: optionalId(input.CategoryID, 'Local category'),
    Is501c3: optionalFlag(input.Is501c3, 'Is501c3'),
    EIN: ein === null ? null : normalizeEin(ein),
    Website: optionalText(input.Website, 'Website', 255),
    OrgMission: text(input.OrgMission, 'Organization mission'),
    IsRecurring: optionalFlag(input.IsRecurring, 'IsRecurring'),
    FundsNeededBy: neededBy === null ? null : `${assertIsoDate(neededBy, 'Funds needed by')} 00:00:00`,
    SpecificUse: text(input.SpecificUse, 'Specific use'),
    TargetBeneficiary: text(input.TargetBeneficiary, 'Target beneficiary'),
    AccountabilityPlan: text(input.AccountabilityPlan, 'Accountability plan'),
    RequestTier: input.RequestTier === undefined || input.RequestTier === null ? 1 : assertRequestTier(input.RequestTier),
  };
}

/** The form's RelationshipTypeID must be one of the council's own relationship types. */
export function assertCouncilRelationshipType(
  relationshipTypeId: number | null | undefined,
  types: readonly Pick<CouncilRelationshipType, 'id' | 'CouncilID'>[],
  councilId: number,
): void {
  if (relationshipTypeId == null || types.some((t) => t.id === relationshipTypeId && t.CouncilID === councilId)) return;
  throw invalid(`Relationship type ${relationshipTypeId} is not one of council ${councilId}'s relationship types.`, { relationshipTypeId, councilId });
}

/** The form's MissionAreaID must be one of the council's own mission areas (Sprint 5Z-2). */
export function assertCouncilMissionArea(
  missionAreaId: number | null | undefined,
  areas: readonly Pick<CouncilMissionArea, 'id' | 'CouncilID'>[],
  councilId: number,
): void {
  if (missionAreaId == null || areas.some((a) => a.id === missionAreaId && a.CouncilID === councilId)) return;
  throw invalid(`Mission area ${missionAreaId} is not one of council ${councilId}'s mission areas.`, { missionAreaId, councilId });
}

/** The vetter's TargetBudgetLineID must be a budget line of the request's council (Sprint 5Z-2). */
export function assertCouncilBudgetLine(
  budgetLineId: number | null | undefined,
  line: Pick<CouncilBudgetForecast, 'id' | 'CouncilID'> | null | undefined,
  councilId: number,
): void {
  if (budgetLineId == null || (line && line.id === budgetLineId && line.CouncilID === councilId)) return;
  throw invalid(`Budget line ${budgetLineId} is not a budget line of council ${councilId}.`, { budgetLineId, councilId });
}

export const charitableRequestNotFound = (requestId: number): BusinessRuleError =>
  new BusinessRuleError('RECORD_NOT_FOUND', `Charitable request ${requestId} does not exist.`, { table: 'CharitableRequest', id: requestId });

/** The columns triageRequestStatus changes; the only ones a driver may interpolate into its UPDATE. */
export const CHARITABLE_TRIAGE_COLUMNS = ['RequestStatus', 'VetterMemberID', 'VettingNotes', 'RequestTier', 'VettedDate', 'TargetBudgetLineID'] as const satisfies readonly (keyof CharitableRequest)[];

export type CharitableTriageChanges = Partial<Pick<CharitableRequest, (typeof CHARITABLE_TRIAGE_COLUMNS)[number]>>;

const statusConflict = (request: Pick<CharitableRequest, 'id' | 'RequestStatus'>, message: string, details: Record<string, unknown> = {}) =>
  new BusinessRuleError('REQUEST_STATUS_CONFLICT', message, { requestId: request.id, status: request.RequestStatus, ...details });

/**
 * What charities.triageRequestStatus writes, once the driver has checked vetting authority and independence. 'claim'
 * takes a 'Submitted' request; 'note', 'advance' and 'decline' need a claimed one held by the caller, unless
 * `overridesClaim` (an Admin of the council or a Super Admin). `now` stamps VettedDate on 'advance' and 'decline'.
 */
export function planCharitableTriage(
  request: Pick<CharitableRequest, 'id' | 'RequestStatus' | 'VetterMemberID'>,
  actorId: number,
  overridesClaim: boolean,
  input: CharitableTriageInput,
  now: Date,
): CharitableTriageChanges {
  if (typeof input !== 'object' || input === null) throw invalid('Vetting details are required.');
  if (!(CHARITABLE_TRIAGE_ACTIONS as readonly unknown[]).includes(input.action)) {
    throw invalid(`Action must be one of ${CHARITABLE_TRIAGE_ACTIONS.join(', ')}; received ${JSON.stringify(input.action)}.`, { action: input.action });
  }
  const changes: CharitableTriageChanges = {};
  if (input.VettingNotes !== undefined) changes.VettingNotes = optionalText(input.VettingNotes, 'Vetting notes', CHARITABLE_VETTING_NOTES_MAX_LENGTH);
  if (input.RequestTier !== undefined && input.RequestTier !== null) changes.RequestTier = assertRequestTier(input.RequestTier);
  if (input.TargetBudgetLineID !== undefined) changes.TargetBudgetLineID = optionalId(input.TargetBudgetLineID, 'Target budget line');

  if (input.action === 'claim') {
    if (request.RequestStatus !== 'Submitted') {
      throw statusConflict(request, `Charitable request ${request.id} is ${request.RequestStatus}, so it cannot be claimed; only a Submitted request can.`);
    }
    return { ...changes, RequestStatus: 'Claimed by Trustee', VetterMemberID: actorId };
  }
  if (request.RequestStatus !== 'Claimed by Trustee') {
    const why =
      request.RequestStatus === 'Submitted' ? 'claim it first' : request.RequestStatus === 'Declined' ? 'it has already been declined' : 'it has already been advanced to the vote';
    throw statusConflict(request, `Charitable request ${request.id} is ${request.RequestStatus}; ${why}.`);
  }
  if (request.VetterMemberID !== actorId && !overridesClaim) {
    throw statusConflict(
      request,
      `Charitable request ${request.id} is claimed by member ${request.VetterMemberID}; only its vetter, an Admin or a Super Admin can change it.`,
      { vetterMemberId: request.VetterMemberID ?? null },
    );
  }
  if (input.action === 'note') return changes;
  return { ...changes, RequestStatus: input.action === 'advance' ? 'Advanced' : 'Declined', VettedDate: toTimestamp(now) };
}

/** Pipeline stage, then oldest SubmittedAt, then id. */
const compareCharitableRequests = (a: CharitableRequest, b: CharitableRequest) =>
  CHARITABLE_REQUEST_STATUSES.indexOf(a.RequestStatus) - CHARITABLE_REQUEST_STATUSES.indexOf(b.RequestStatus) ||
  a.SubmittedAt.localeCompare(b.SubmittedAt) ||
  a.id - b.id;

/** Joins requests with their Shepherds, vetters, relationship types, mission areas and budget lines, in queue order. */
export function buildCharitableRequestDetails(
  requests: readonly CharitableRequest[],
  members: readonly Pick<Member, 'id' | 'MemberFirstName' | 'MemberLastName'>[],
  relationshipTypes: readonly CouncilRelationshipType[],
  missionAreas: readonly CouncilMissionArea[] = [],
  budgetLines: readonly Pick<CouncilBudgetForecast, 'id' | 'LineItemName' | 'FraternalYear'>[] = [],
): CharitableRequestDetail[] {
  return [...requests].sort(compareCharitableRequests).map((request) => {
    const shepherd = members.find((m) => m.id === request.ShepherdMemberID);
    const vetter = request.VetterMemberID == null ? undefined : members.find((m) => m.id === request.VetterMemberID);
    return {
      request,
      shepherdFirstName: shepherd?.MemberFirstName ?? '',
      shepherdLastName: shepherd?.MemberLastName ?? '',
      vetterFirstName: vetter?.MemberFirstName ?? null,
      vetterLastName: vetter?.MemberLastName ?? null,
      relationshipName: relationshipTypes.find((t) => t.id === request.RelationshipTypeID)?.RelationshipName ?? null,
      missionAreaName: missionAreas.find((a) => a.id === request.MissionAreaID)?.MissionAreaName ?? null,
      targetBudgetLine: ((line) => (line ? { name: line.LineItemName, fraternalYear: line.FraternalYear } : null))(
        request.TargetBudgetLineID == null ? undefined : budgetLines.find((l) => l.id === request.TargetBudgetLineID),
      ),
    };
  });
}

// ---- the Shepherd's 3-step tracking notice and Trustee follow-up (Sprint 5Z-Member-Charity) ----

/** The three steps a filed request moves through, as the Shepherd's tracking notice and My requests table name them. */
export const CHARITABLE_TRACKING_STEPS = ['Vetting', 'Presentation', 'Disbursement'] as const;
export type CharitableTrackingStep = (typeof CHARITABLE_TRACKING_STEPS)[number];
/** Months after SubmittedAt when the council's Trustees are prompted for the request's status report. */
export const CHARITABLE_TRUSTEE_FOLLOWUP_MONTHS = 6;

/**
 * Where a request stands on the 3-step track. `stepIndex` is the CHARITABLE_TRACKING_STEPS index the request is in, or
 * CHARITABLE_TRACKING_STEPS.length once its check is paid. `stopped` marks a request that ended in that step: declined
 * at Vetting or voted down at Presentation.
 */
export function charitableTrackingPosition(
  request: Pick<CharitableRequest, 'RequestStatus' | 'VoteStatus' | 'PaymentOrderId'>,
): { stepIndex: number; stopped: boolean } {
  if (request.RequestStatus === 'Declined') return { stepIndex: 0, stopped: true };
  if (request.RequestStatus !== 'Advanced') return { stepIndex: 0, stopped: false };
  if (request.VoteStatus === 'Rejected') return { stepIndex: 1, stopped: true };
  if (request.VoteStatus !== 'Approved') return { stepIndex: 1, stopped: false };
  return { stepIndex: request.PaymentOrderId == null ? 2 : CHARITABLE_TRACKING_STEPS.length, stopped: false };
}

/** The YYYY-MM-DD date `months` calendar months after `date` (YYYY-MM-DD...), clamped to the last day of a short month. */
export function addCalendarMonths(date: string, months: number): string {
  const [y, m, d] = assertIsoDate(date.slice(0, 10), 'Date').split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

/** The day the Trustees are prompted for a request's status report: CHARITABLE_TRUSTEE_FOLLOWUP_MONTHS after SubmittedAt. */
export const charitableTrusteeFollowUpDate = (request: Pick<CharitableRequest, 'SubmittedAt'>): string =>
  addCalendarMonths(request.SubmittedAt, CHARITABLE_TRUSTEE_FOLLOWUP_MONTHS);

/** The tracking message a Shepherd's profile log receives the moment their intake form is saved. */
export interface CharitableTrackingNotice {
  kind: 'charitable-tracking';
  /** Stable dedupe key, e.g. "charitable:request:12:filed". */
  key: string;
  /** The Shepherd: the signed-in member who saved the form. */
  memberId: number;
  requestId: number;
  steps: readonly CharitableTrackingStep[];
  /** When the Trustees are prompted for a status report (YYYY-MM-DD). */
  trusteeFollowUpDate: string;
  text: string;
}

export function buildCharitableTrackingNotice(detail: Pick<CharitableRequestDetail, 'request' | 'shepherdFirstName'>): CharitableTrackingNotice {
  const { request } = detail;
  const followUp = charitableTrusteeFollowUpDate(request);
  return {
    kind: 'charitable-tracking',
    key: `charitable:request:${request.id}:filed`,
    memberId: request.ShepherdMemberID,
    requestId: request.id,
    steps: CHARITABLE_TRACKING_STEPS,
    trusteeFollowUpDate: followUp,
    text:
      `KofC: Thank you, ${detail.shepherdFirstName}. Request #${request.id} for ${request.OrganizationName} ($${request.AmountRequested.toFixed(2)}) is filed. ` +
      `Step 1, Vetting: an officer or Trustee other than you audits it. ` +
      `Step 2, Presentation: it goes on a Monthly meeting agenda for the council's vote. ` +
      `Step 3, Disbursement: the Financial Secretary or Treasurer issues the check. ` +
      `The Trustees will ask for a status report on ${followUp}.`,
  };
}

/**
 * Builds the tracking notice for a request that was just saved and logs it. No SMS gateway or profile-log table exists
 * yet, so, like the hours reminders, the packet goes to `log` (console.log by default). Returns the packet.
 */
export function dispatchCharitableTrackingNotice(
  detail: Pick<CharitableRequestDetail, 'request' | 'shepherdFirstName'>,
  log: (...args: unknown[]) => void = console.log,
): CharitableTrackingNotice {
  const notice = buildCharitableTrackingNotice(detail);
  log('[charitable-tracking]', JSON.stringify(notice, null, 2));
  return notice;
}

// ---- Faith-in-Action mission footprint (Sprint 5Z-2) -------------------------

const sumCents = (values: readonly number[]): number => values.reduce((total, v) => total + Math.round(v * 100), 0) / 100;

/**
 * reports.missionAreaFootprint from rows the driver loaded for the council: its mission areas, the events linked to it,
 * its donations (with their method names; physical items are not money and are left out) and the EventTime rows of its
 * events' shifts (with each shift's EventID and ShiftDate). Only rows inside the fraternal year count: events by
 * StartDate, donations by DonationDate, hours by ShiftDate.
 */
export function buildMissionAreaFootprint(
  councilId: number,
  fraternalYear: string,
  areas: readonly CouncilMissionArea[],
  events: readonly Pick<Event, 'id' | 'StartDate' | 'MissionAreaID'>[],
  donations: readonly (Pick<Donation, 'EventID' | 'DonationDate' | 'DonationAmount'> & { methodName: string })[],
  eventTimes: readonly (Pick<EventTime, 'Hours'> & { eventId: number; shiftDate: string })[],
): MissionAreaFootprint {
  const { fromDate, toDate } = fraternalYearBounds(fraternalYear);
  const inYear = (date: string) => date >= fromDate && date <= toDate;
  const areaOf = new Map(events.map((e) => [e.id, e.MissionAreaID ?? null]));
  const bucket = (missionAreaId: number | null, missionAreaName: string): MissionAreaFootprintEntry => ({
    missionAreaId,
    missionAreaName,
    donations: sumCents(
      donations
        .filter((d) => d.EventID != null && areaOf.has(d.EventID) && areaOf.get(d.EventID) === missionAreaId)
        .filter((d) => inYear(d.DonationDate) && donationMethodKind(d.methodName) !== 'item')
        .map((d) => d.DonationAmount),
    ),
    serviceHours: sumCents(eventTimes.filter((t) => areaOf.get(t.eventId) === missionAreaId && inYear(t.shiftDate)).map((t) => t.Hours)),
    events: events.filter((e) => (e.MissionAreaID ?? null) === missionAreaId && inYear(e.StartDate)).length,
  });
  const sorted = [...areas]
    .filter((a) => a.CouncilID === councilId)
    .sort((a, b) => (a.MissionAreaName < b.MissionAreaName ? -1 : a.MissionAreaName > b.MissionAreaName ? 1 : a.id - b.id));
  const filed = sorted.map((a) => bucket(a.id, a.MissionAreaName));
  const unfiled = bucket(null, 'Unfiled');
  const all = [...filed, unfiled];
  return {
    councilId,
    fraternalYear,
    fromDate,
    toDate,
    areas: filed,
    unfiled,
    totals: {
      donations: sumCents(all.map((b) => b.donations)),
      serviceHours: sumCents(all.map((b) => b.serviceHours)),
      events: all.reduce((n, b) => n + b.events, 0),
    },
  };
}

// ---- routing an advanced request to the council floor (Sprint 5Z-5) -------------
//
// charities.routeRequestToNextEligibleAgenda puts a vetted request ('Advanced', vote still 'Pending') on the agenda of
// the council's soonest Monthly meeting that honors the 10-day rule: the meeting must fall at least
// AGENDA_NOTICE_DAYS calendar days after today, so the membership has notice of the motion before it is moved.

/** Calendar days of notice a motion needs before the meeting that hears it (the 10-day rule). */
export const AGENDA_NOTICE_DAYS = 10;

/** The council meeting type (CouncilMeetingType.TypeName, ignoring case) whose meetings hear charitable motions. */
export const MONTHLY_MEETING_TYPE_NAME = 'Monthly';

/** True for the council's Monthly meeting type. */
export const isMonthlyCouncilMeetingType = (typeName: string): boolean =>
  typeName.trim().toLowerCase() === MONTHLY_MEETING_TYPE_NAME.toLowerCase();

/** The first day a meeting can hear a motion routed `today` (YYYY-MM-DD): AGENDA_NOTICE_DAYS days later. */
export const earliestAgendaDate = (today: string): string => addDays(today, AGENDA_NOTICE_DAYS);

/**
 * The soonest of `monthlyMeetings` (already limited to the council's Monthly meetings) dated on or after
 * earliestAgendaDate(today), by Date, then Time Start, then id; null when none qualifies.
 */
export function nextEligibleAgendaMeeting<M extends Pick<Meeting, 'id' | 'Date' | 'Time Start'>>(monthlyMeetings: readonly M[], today: string): M | null {
  const earliest = earliestAgendaDate(today);
  const eligible = monthlyMeetings
    .filter((m) => String(m.Date).slice(0, 10) >= earliest)
    .sort((a, b) => (a.Date < b.Date ? -1 : a.Date > b.Date ? 1 : a['Time Start'] < b['Time Start'] ? -1 : a['Time Start'] > b['Time Start'] ? 1 : a.id - b.id));
  return eligible[0] ?? null;
}

export const noEligibleAgendaMeeting = (requestId: number, councilId: number, today: string): BusinessRuleError =>
  new BusinessRuleError(
    'NO_ELIGIBLE_MEETING',
    `Council ${councilId} has no ${MONTHLY_MEETING_TYPE_NAME} meeting on or after ${earliestAgendaDate(today)} (${AGENDA_NOTICE_DAYS} days' notice) to hear request ${requestId}; populate the year's meeting cadence first.`,
    { requestId, councilId, earliestDate: earliestAgendaDate(today) },
  );

/**
 * Only a vetted request still awaiting its vote may be routed - RequestStatus 'Advanced', VoteStatus 'Pending' - and only
 * once: `alreadyRouted` is true when a 'Pending' ProposedMotion already carries it. Rejects REQUEST_STATUS_CONFLICT.
 */
export function assertRoutableRequest(request: Pick<CharitableRequest, 'id' | 'RequestStatus' | 'VoteStatus'>, alreadyRouted: boolean): void {
  if (request.RequestStatus !== 'Advanced' || request.VoteStatus !== 'Pending') {
    throw new BusinessRuleError(
      'REQUEST_STATUS_CONFLICT',
      `Charitable request ${request.id} is '${request.RequestStatus}' with vote '${request.VoteStatus}'; only an advanced request awaiting its vote can be put on an agenda.`,
      { requestId: request.id, requestStatus: request.RequestStatus, voteStatus: request.VoteStatus },
    );
  }
  if (alreadyRouted) {
    throw new BusinessRuleError('REQUEST_STATUS_CONFLICT', `Charitable request ${request.id} is already on a meeting agenda awaiting its vote.`, {
      requestId: request.id,
    });
  }
}

/** The motion read to the floor for a routed request: 'That the council donate $500.00 to St. Mary's Food Pantry (charitable request #7).' */
export const charitableMotionText = (request: Pick<CharitableRequest, 'id' | 'OrganizationName' | 'AmountRequested'>): string =>
  `That the council donate $${Number(request.AmountRequested).toFixed(2)} to ${request.OrganizationName} (charitable request #${request.id}).`;

// ---- request threads and the expense link (Sprint 6H) ----

/** CharitableRequestThread.thread_type values, in the order the screens list them. */
export const CHARITABLE_THREAD_TYPES: readonly CharitableThreadType[] = ['MORE_INFO', 'OFFICER_INPUT'];

/** The vetting desk's buttons that start each thread. */
export const CHARITABLE_THREAD_BUTTON_LABELS: Record<CharitableThreadType, string> = {
  MORE_INFO: '💬 Request More Info',
  OFFICER_INPUT: '📣 Request Officer Input',
};

/** Thread headings on the vetting desk and the Shepherd's page. */
export const CHARITABLE_THREAD_TITLES: Record<CharitableThreadType, string> = {
  MORE_INFO: 'Request for More Information',
  OFFICER_INPUT: 'Request for Officer Input',
};

/** Longest CharitableRequestThreadMessage.message_body. */
export const CHARITABLE_THREAD_MESSAGE_MAX_LENGTH = 2000;

/**
 * A request an expense sheet may be linked to from the expense forms (Sprint 6H): vetting is finished (RequestStatus
 * 'Advanced') and the council has not voted it down.
 */
export const isLinkableCharitableRequest = (request: Pick<CharitableRequest, 'RequestStatus' | 'VoteStatus'>): boolean =>
  request.RequestStatus === 'Advanced' && request.VoteStatus !== 'Rejected';

/** The council's linkable requests for the expense forms' 'Link to Vetted Charity Request' dropdown, by name then id. */
export function linkableCharitableRequests(requests: readonly CharitableRequest[], councilId: number): LinkableCharitableRequest[] {
  return requests
    .filter((r) => r.CouncilID === councilId && isLinkableCharitableRequest(r))
    .sort((a, b) => a.OrganizationName.localeCompare(b.OrganizationName) || a.id - b.id)
    .map((r) => ({ id: r.id, OrganizationName: r.OrganizationName, AmountRequested: r.AmountRequested, RequestStatus: r.RequestStatus, VoteStatus: r.VoteStatus }));
}

/** What one caller may do with one thread type on one request. */
export interface CharitableThreadAccess {
  read: boolean;
  /** Start the thread (its first post). */
  open: boolean;
  /** Add a post to the thread once it exists. */
  post: boolean;
}

/** Requests whose threads still take posts: not declined, and not yet voted on. */
export const charitableThreadsOpen = (request: Pick<CharitableRequest, 'RequestStatus' | 'VoteStatus'>): boolean =>
  request.RequestStatus !== 'Declined' && request.VoteStatus === 'Pending';

type ThreadRequest = Pick<CharitableRequest, 'id' | 'CouncilID' | 'ShepherdMemberID' | 'VetterMemberID' | 'RequestStatus' | 'VoteStatus'>;

/**
 * Who reads and writes a request's threads (Sprint 6H). The Knight Shepherd sees only 'MORE_INFO' and only answers it.
 * 'MORE_INFO' is otherwise private to the request's vetting officer: its claiming vetter, or anyone who may override a
 * claim (the council's Admins, Grand Knight and Deputy Grand Knight, any Super Admin). 'OFFICER_INPUT' is open to
 * everyone with vetting authority for the council (its Active officers and Admins, any Super Admin) except the
 * Shepherd, under the Four-Eyes Principle. Nobody writes once the request is declined or voted on.
 */
export function charitableThreadAccess(actor: MemberWriteActor, request: ThreadRequest, threadType: CharitableThreadType): CharitableThreadAccess {
  const writable = charitableThreadsOpen(request);
  if (request.ShepherdMemberID === actor.memberId) {
    const read = actor.active && threadType === 'MORE_INFO';
    return { read, open: false, post: read && writable };
  }
  const vetter = mayVetCharitableRequests(actor, request.CouncilID);
  const read =
    threadType === 'OFFICER_INPUT' ? vetter : vetter && (request.VetterMemberID === actor.memberId || mayOverrideVettingClaim(actor, request.CouncilID));
  return { read, open: read && writable, post: read && writable };
}

/** Rejects a caller charitableThreadAccess does not allow `need` on the thread type, naming the reason. */
export function assertCharitableThreadAccess(actor: MemberWriteActor, request: ThreadRequest, threadType: CharitableThreadType, need: keyof CharitableThreadAccess): void {
  const access = charitableThreadAccess(actor, request, threadType);
  if (access[need]) return;
  const title = CHARITABLE_THREAD_TITLES[threadType];
  const details = { actorId: actor.memberId, requestId: request.id, threadType };
  if (access.read && !charitableThreadsOpen(request)) {
    throw new BusinessRuleError(
      'REQUEST_STATUS_CONFLICT',
      `Charitable request ${request.id} is ${request.RequestStatus === 'Declined' ? 'declined' : `voted ${request.VoteStatus}`}, so its ${title} thread is closed.`,
      { ...details, requestStatus: request.RequestStatus, voteStatus: request.VoteStatus },
    );
  }
  if (request.ShepherdMemberID === actor.memberId) {
    throw new BusinessRuleError(
      'SELF_VETTING_BLOCKED',
      threadType === 'OFFICER_INPUT'
        ? `The Knight Shepherd of charitable request ${request.id} cannot see the officers' ${title} thread.`
        : `The Knight Shepherd of charitable request ${request.id} answers the ${title} thread once the vetting officer starts it.`,
      details,
    );
  }
  if (mayVetCharitableRequests(actor, request.CouncilID)) {
    throw new SecurityPrivilegeError(
      'VETTING_AUTHORITY_REQUIRED',
      `The ${title} thread on charitable request ${request.id} is private to its Knight Shepherd and its vetting officer (the claiming vetter, an Admin, the Grand Knight or the Deputy Grand Knight).`,
      details,
    );
  }
  const otherCouncilOfficer = actor.active && actor.councilId !== request.CouncilID && (actor.officer === true || actor.memberType === 'Admin');
  throw new SecurityPrivilegeError(
    otherCouncilOfficer ? 'COUNCIL_ACCESS_DENIED' : 'VETTING_AUTHORITY_REQUIRED',
    `Only the council's officers and Admins (and the request's Knight Shepherd, on the ${CHARITABLE_THREAD_TITLES.MORE_INFO} thread) can use the threads on charitable request ${request.id}.`,
    details,
  );
}

/** A thread type the data service accepts, else INVALID_INPUT. */
export function assertCharitableThreadType(value: unknown): CharitableThreadType {
  if ((CHARITABLE_THREAD_TYPES as readonly unknown[]).includes(value)) return value as CharitableThreadType;
  throw invalid(`Thread type must be one of ${CHARITABLE_THREAD_TYPES.join(', ')}; received ${JSON.stringify(value)}.`, { threadType: value });
}

/** A trimmed post of 1 to CHARITABLE_THREAD_MESSAGE_MAX_LENGTH characters, else INVALID_INPUT. */
export const cleanCharitableThreadMessage = (value: unknown): string => assertText(value, 'Message', CHARITABLE_THREAD_MESSAGE_MAX_LENGTH);

export const charitableThreadNotFound = (threadId: number): BusinessRuleError =>
  new BusinessRuleError('THREAD_NOT_FOUND', `Charitable request thread ${threadId} does not exist.`, { table: 'CharitableRequestThread', id: threadId });

/** Joins one thread with its opener, its posts (oldest first) and their authors. */
export function buildCharitableThreadDetail(
  thread: CharitableRequestThread,
  messages: readonly CharitableRequestThreadMessage[],
  members: readonly Pick<Member, 'id' | 'MemberFirstName' | 'MemberLastName'>[],
  canPost: boolean,
): CharitableRequestThreadDetail {
  const member = (id: number) => members.find((m) => m.id === id);
  const opener = member(thread.opened_by_member_id);
  return {
    thread,
    openedByFirstName: opener?.MemberFirstName ?? '',
    openedByLastName: opener?.MemberLastName ?? '',
    messages: messages
      .filter((m) => m.thread_id === thread.id)
      .sort((a, b) => a.posted_at.localeCompare(b.posted_at) || a.id - b.id)
      .map((message) => {
        const author = member(message.author_member_id);
        return { message, authorFirstName: author?.MemberFirstName ?? '', authorLastName: author?.MemberLastName ?? '' };
      }),
    canPost,
  };
}

/**
 * charities.listRequestThreads: the request's threads the caller may read, MORE_INFO first, and the types the caller
 * may still start. Rejects (assertCharitableThreadAccess) when the caller may read neither type.
 */
export function buildCharitableRequestThreads(
  actor: MemberWriteActor,
  request: ThreadRequest,
  threads: readonly CharitableRequestThread[],
  messages: readonly CharitableRequestThreadMessage[],
  members: readonly Pick<Member, 'id' | 'MemberFirstName' | 'MemberLastName'>[],
): CharitableRequestThreads {
  const readable = CHARITABLE_THREAD_TYPES.filter((t) => charitableThreadAccess(actor, request, t).read);
  if (readable.length === 0) assertCharitableThreadAccess(actor, request, 'MORE_INFO', 'read');
  const own = threads.filter((t) => t.request_id === request.id);
  return {
    requestId: request.id,
    threads: readable.flatMap((type) => {
      const thread = own.find((t) => t.thread_type === type);
      return thread ? [buildCharitableThreadDetail(thread, messages, members, charitableThreadAccess(actor, request, type).post)] : [];
    }),
    canOpen: readable.filter((type) => !own.some((t) => t.thread_type === type) && charitableThreadAccess(actor, request, type).open),
  };
}
