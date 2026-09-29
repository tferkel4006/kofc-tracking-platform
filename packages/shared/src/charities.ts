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
  CharityCheckDetails,
  CharityProposalDetail,
  CharityProposalInput,
  CharitySearchFilters,
  CouncilCharityLedgerEntry,
  NewGlobalCharity,
} from './contract';
import { cleanDisbursementCheck, sumAmounts } from './expenses';
import { assertMoney, assertText, BusinessRuleError, optionalText } from './rules';
import type {
  CharitableDisbursementLedger,
  CharityDonationProposal,
  CharityProposalStatus,
  CouncilCharityLink,
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
