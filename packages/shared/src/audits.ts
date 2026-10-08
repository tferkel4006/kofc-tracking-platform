// =========================================================================
// SEMIANNUAL TRUSTEE AUDITS AND THE COUNCIL BALANCE SHEET CARD (Sprints 6M / 6N)
// Pure helpers behind finance.getTrusteeAudit, setAuditLineVerified, signTrusteeAudit, listTrusteeAudits and
// getCouncilNetWorth. Drivers load rows already scoped to one council, call these, then only store.
//
// The Trustees audit the books twice a year (Form 1295): July 1 - December 31 and January 1 - June 30 of a fraternal
// year. On the Semiannual Trustee Audit Desk (/finance/audit) they tick every cash line of the window against the bank
// statements; a Trustee's signature then locks the period, and from then on the general ledger refuses any posting dated
// inside it (assertLedgerPeriodsOpen). Cash means the council's Asset accounts except physical property - its bank
// accounts with the virtual goals set aside inside them - so the window's beginning balance plus receipts less
// disbursements equals its ending balance to the cent.
// =========================================================================
import type { CouncilNetWorth, JournalLineInput, TrusteeAuditLine, TrusteeAuditWorkspace } from './contract';
import { assertFraternalYear } from './budget';
import { TRUSTEE_ROLE_NAMES } from './elections';
import { toTimestamp } from './messaging';
import { BusinessRuleError, describeActor, hasSuperAdminRights, SecurityPrivilegeError, toIsoDate, type MemberWriteActor } from './rules';
import type {
  AuditExecutionStatus,
  AuditPeriod,
  AuditTrusteeSignature,
  AuditVerifiedLine,
  CouncilAssetsInventory,
  CouncilAudit,
  GLAccount,
  JournalEntry,
} from './types';

/** The two halves of a fraternal year, in the order they fall. */
export const AUDIT_PERIODS: readonly AuditPeriod[] = ['JUL-DEC', 'JAN-JUN'];
export const AUDIT_EXECUTION_STATUSES: readonly AuditExecutionStatus[] = ['DRAFT', 'LOCKED'];
/** How screens and the Form 1295 report name each half. */
export const AUDIT_PERIOD_LABELS: Record<AuditPeriod, string> = { 'JUL-DEC': 'July 1 - December 31', 'JAN-JUN': 'January 1 - June 30' };
/**
 * GLAccount has no physical-property flag, so an Asset account named like equipment or property is read as physical
 * property: it is not cash, and the balance sheet card takes equipment from CouncilAssetsInventory instead.
 */
export const PHYSICAL_PROPERTY_ACCOUNT_PATTERN = /\b(physical|property|equipment|fixed assets?|furniture|furnishings|inventory)\b/i;

const invalid = (message: string, details: Record<string, unknown> = {}) => new BusinessRuleError('INVALID_INPUT', message, details);
const cents = (value: number | null | undefined) => Math.round((value ?? 0) * 100);
const dollars = (c: number) => c / 100;

// ---- periods ------------------------------------------------------------------------------------------------

export function assertAuditPeriod(value: unknown): AuditPeriod {
  if (AUDIT_PERIODS.includes(value as AuditPeriod)) return value as AuditPeriod;
  throw invalid(`The audit period must be one of ${AUDIT_PERIODS.join(', ')}; received ${JSON.stringify(value)}.`, { auditPeriod: value });
}

/** The dates a period of a fraternal year covers: JUL-DEC in its first calendar year, JAN-JUN in its second. */
export function auditWindow(fiscalYear: string, period: AuditPeriod): { fromDate: string; throughDate: string; label: string } {
  const year = assertFraternalYear(fiscalYear);
  const [first, second] = year.split('-');
  return period === 'JUL-DEC'
    ? { fromDate: `${first}-07-01`, throughDate: `${first}-12-31`, label: `July-December ${first}` }
    : { fromDate: `${second}-01-01`, throughDate: `${second}-06-30`, label: `January-June ${second}` };
}

/** The period `date` (local calendar) falls in. */
export function auditPeriodOf(date: Date): { fiscalYear: string; period: AuditPeriod } {
  const y = date.getFullYear();
  return date.getMonth() >= 6 ? { fiscalYear: `${y}-${y + 1}`, period: 'JUL-DEC' } : { fiscalYear: `${y - 1}-${y}`, period: 'JAN-JUN' };
}

/** The desk's period picker: the period in progress on `now`, then the `count - 1` before it, newest first. */
export function auditPeriodOptions(now: Date, count = 4): { fiscalYear: string; period: AuditPeriod; label: string }[] {
  const out = [];
  let { fiscalYear, period } = auditPeriodOf(now);
  for (let i = 0; i < count; i++) {
    out.push({ fiscalYear, period, label: auditWindow(fiscalYear, period).label });
    if (period === 'JAN-JUN') period = 'JUL-DEC';
    else {
      const start = Number(fiscalYear.slice(0, 4)) - 1;
      fiscalYear = `${start}-${start + 1}`;
      period = 'JAN-JUN';
    }
  }
  return out;
}

// ---- access -------------------------------------------------------------------------------------------------

/** The Trustee seat the roles hold (Trustee 1 first), or null. */
export const trusteeSeatOf = (roles: readonly string[] | undefined): string | null =>
  TRUSTEE_ROLE_NAMES.find((seat) => (roles ?? []).includes(seat)) ?? null;

/**
 * finance.setAuditLineVerified and signTrusteeAudit: the audit is the Trustees' - an Active Trustee of the council
 * (Trustee 1, 2 or 3) - or any Active Super Admin (TRUSTEE_REQUIRED, COUNCIL_ACCESS_DENIED). `action` completes "cannot ...".
 */
export function assertMayVerifyCouncilAudit(actor: MemberWriteActor, councilId: number, action: string): void {
  const denial = auditDenial(actor, councilId, action);
  if (denial) throw denial;
}

/** assertMayVerifyCouncilAudit as a yes/no. */
export const mayVerifyCouncilAudit = (actor: MemberWriteActor, councilId: number): boolean => auditDenial(actor, councilId, 'audit the books') === null;

function auditDenial(actor: MemberWriteActor, councilId: number, action: string): SecurityPrivilegeError | null {
  if (hasSuperAdminRights(actor)) return null;
  if (!(actor.active && trusteeSeatOf(actor.roles))) {
    return new SecurityPrivilegeError(
      'TRUSTEE_REQUIRED',
      `Only an active Trustee or Super Admin can ${action}; member ${actor.memberId} is ${describeActor(actor)} without a Trustee seat.`,
      { actorId: actor.memberId },
    );
  }
  if (actor.councilId !== councilId) {
    return new SecurityPrivilegeError('COUNCIL_ACCESS_DENIED', `Member ${actor.memberId} of council ${actor.councilId} cannot ${action} of council ${councilId}.`, {
      actorId: actor.memberId,
      actorCouncilId: actor.councilId,
      councilId,
    });
  }
  return null;
}

// ---- cash ---------------------------------------------------------------------------------------------------

export const isPhysicalPropertyAccount = (account: Pick<GLAccount, 'AccountType' | 'AccountName'>): boolean =>
  account.AccountType === 'Asset' && PHYSICAL_PROPERTY_ACCOUNT_PATTERN.test(account.AccountName);

/** A cash account: an Asset account that is not physical property. Virtual goals count; they are cash set aside. */
export const isCashAccount = (account: Pick<GLAccount, 'AccountType' | 'AccountName'>): boolean =>
  account.AccountType === 'Asset' && !isPhysicalPropertyAccount(account);

/** Newest period first: the order of finance.listTrusteeAudits. */
export const compareAuditsNewestFirst = (a: Pick<CouncilAudit, 'fiscal_year' | 'audit_period' | 'id'>, b: Pick<CouncilAudit, 'fiscal_year' | 'audit_period' | 'id'>): number =>
  auditWindow(b.fiscal_year, b.audit_period).fromDate.localeCompare(auditWindow(a.fiscal_year, a.audit_period).fromDate) || b.id - a.id;

/** The council's cash on the evening of `throughDate` (YYYY-MM-DD), in whole cents: debits less credits on cash accounts. */
function cashCentsThrough(cashIds: ReadonlySet<number>, entries: readonly JournalEntry[], throughDate: string): number {
  let sum = 0;
  for (const e of entries) if (cashIds.has(e.GLAccountID) && e.DateLogged.slice(0, 10) <= throughDate) sum += cents(e.DebitAmount) - cents(e.CreditAmount);
  return sum;
}

/** The day before a YYYY-MM-DD date. */
function dayBefore(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return toIsoDate(new Date(y, m - 1, d - 1));
}

// ---- signatures ---------------------------------------------------------------------------------------------

/** CouncilAudits.verified_by_trustees read back; anything unreadable reads as no signatures. */
export function parseAuditSignatures(text: string | null | undefined): AuditTrusteeSignature[] {
  if (!text) return [];
  try {
    const parsed: unknown = JSON.parse(text);
    return Array.isArray(parsed)
      ? parsed.filter((s): s is AuditTrusteeSignature => !!s && typeof s === 'object' && typeof (s as AuditTrusteeSignature).memberId === 'number')
      : [];
  } catch {
    return [];
  }
}

// ---- the desk -----------------------------------------------------------------------------------------------

/**
 * finance.getTrusteeAudit: one period's desk - every line posted to a cash account inside the window, oldest first, with
 * who ticked it, the window's cash figures, and the signatures. A locked audit shows the balances frozen when it was
 * signed; any other shows them live from the ledger.
 */
export function buildTrusteeAuditWorkspace(input: {
  councilId: number;
  fiscalYear: string;
  period: AuditPeriod;
  accounts: readonly GLAccount[];
  entries: readonly JournalEntry[];
  audit: CouncilAudit | null;
  verified: readonly AuditVerifiedLine[];
  memberNames: ReadonlyMap<number, string>;
  now: Date;
}): TrusteeAuditWorkspace {
  const { councilId, fiscalYear, period, audit } = input;
  const window = auditWindow(fiscalYear, period);
  const cash = input.accounts.filter(isCashAccount);
  const cashIds = new Set(cash.map((a) => a.id));
  const names = new Map(input.accounts.map((a) => [a.id, a.AccountName]));
  const byTransaction = new Map<string, JournalEntry[]>();
  for (const e of input.entries) byTransaction.set(e.TransactionID, [...(byTransaction.get(e.TransactionID) ?? []), e]);
  const ticks = new Map(input.verified.map((v) => [v.journal_entry_id, v]));

  let receipts = 0;
  let disbursements = 0;
  const lines: TrusteeAuditLine[] = input.entries
    .filter((e) => cashIds.has(e.GLAccountID) && e.DateLogged.slice(0, 10) >= window.fromDate && e.DateLogged.slice(0, 10) <= window.throughDate)
    .sort((a, b) => a.DateLogged.localeCompare(b.DateLogged) || a.id - b.id)
    .map((entry) => {
      // A posting that never leaves the cash accounts (a transfer, a goal set-aside) moves no money in or out.
      const transfer = (byTransaction.get(entry.TransactionID) ?? [entry]).every((l) => cashIds.has(l.GLAccountID));
      if (!transfer) {
        receipts += cents(entry.DebitAmount);
        disbursements += cents(entry.CreditAmount);
      }
      const tick = ticks.get(entry.id);
      return {
        entry: { ...entry },
        accountName: names.get(entry.GLAccountID) ?? `Account ${entry.GLAccountID}`,
        transfer,
        verified: !!tick,
        verifiedByMemberId: tick?.verified_by_member_id ?? null,
        verifiedByName: tick ? (input.memberNames.get(tick.verified_by_member_id) ?? `Member ${tick.verified_by_member_id}`) : null,
        verifiedAt: tick?.verified_at ?? null,
      };
    });

  const locked = audit?.execution_status === 'LOCKED';
  const beginning = locked ? cents(audit.cash_balance_beginning) : cashCentsThrough(cashIds, input.entries, dayBefore(window.fromDate));
  const ending = locked ? cents(audit.cash_balance_ending) : cashCentsThrough(cashIds, input.entries, window.throughDate);
  const verifiedCount = lines.filter((l) => l.verified).length;
  const periodEnded = window.throughDate < toIsoDate(input.now);
  return {
    councilId,
    fiscalYear,
    period,
    periodLabel: window.label,
    fromDate: window.fromDate,
    throughDate: window.throughDate,
    periodEnded,
    status: audit ? audit.execution_status : 'NOT_STARTED',
    audit: audit ? { ...audit } : null,
    signatures: parseAuditSignatures(audit?.verified_by_trustees),
    cashAccounts: cash.map((a) => ({ accountId: a.id, accountName: a.AccountName, isVirtualGoal: a.IsVirtualGoal === 1 })),
    cashBalanceBeginning: dollars(beginning),
    receipts: dollars(receipts),
    disbursements: dollars(disbursements),
    cashBalanceEnding: dollars(ending),
    difference: dollars(beginning + receipts - disbursements - ending),
    lines,
    verifiedCount,
    lineCount: lines.length,
    readyToSign: !locked && periodEnded && verifiedCount === lines.length,
  };
}

/**
 * finance.setAuditLineVerified: refuses INVALID_INPUT for a `verified` that is not a boolean, AUDIT_PERIOD_LOCKED on a
 * locked audit, and INVALID_INPUT for a journal line that is not one of the desk's lines (another council's, a non-cash account, or dated outside the window).
 */
export function assertAuditLineToggle(workspace: TrusteeAuditWorkspace, journalEntryId: number, verified: unknown): void {
  if (typeof verified !== 'boolean') throw invalid(`Verified must be true or false; received ${JSON.stringify(verified)}.`, { verified });
  if (workspace.status === 'LOCKED') throw lockedError(workspace);
  if (!workspace.lines.some((l) => l.entry.id === journalEntryId)) {
    throw invalid(`Journal line ${journalEntryId} is not a cash line of council ${workspace.councilId}'s ${workspace.periodLabel} audit.`, {
      journalEntryId,
      councilId: workspace.councilId,
      fiscalYear: workspace.fiscalYear,
      auditPeriod: workspace.period,
    });
  }
}

/**
 * finance.signTrusteeAudit: the signature to add. The first one locks the period and freezes its cash balances; it needs
 * the period ended (AUDIT_PERIOD_OPEN) and every line ticked (AUDIT_INCOMPLETE). Later Trustees add theirs to the locked
 * audit; nobody signs twice (INVALID_INPUT).
 */
export function planAuditSignature(
  workspace: TrusteeAuditWorkspace,
  signer: { memberId: number; name: string; role: string },
  now: Date,
): { signatures: AuditTrusteeSignature[]; lock: boolean } {
  if (workspace.signatures.some((s) => s.memberId === signer.memberId)) {
    throw invalid(`Member ${signer.memberId} already signed the ${workspace.periodLabel} audit.`, { memberId: signer.memberId });
  }
  const lock = workspace.status !== 'LOCKED';
  if (lock && !workspace.periodEnded) {
    throw new BusinessRuleError('AUDIT_PERIOD_OPEN', `The ${workspace.periodLabel} period ends on ${workspace.throughDate}; the Trustees sign its audit after it closes.`, {
      throughDate: workspace.throughDate,
    });
  }
  if (lock && workspace.verifiedCount < workspace.lineCount) {
    throw new BusinessRuleError(
      'AUDIT_INCOMPLETE',
      `${workspace.lineCount - workspace.verifiedCount} of the ${workspace.lineCount} cash lines are not yet verified against the bank statements.`,
      { verified: workspace.verifiedCount, lines: workspace.lineCount },
    );
  }
  return { signatures: [...workspace.signatures, { ...signer, signedAt: toTimestamp(now) }], lock };
}

const lockedError = (w: Pick<TrusteeAuditWorkspace, 'periodLabel' | 'fromDate' | 'throughDate'>) =>
  new BusinessRuleError('AUDIT_PERIOD_LOCKED', `The Trustees signed and locked the ${w.periodLabel} audit; its ledger lines can no longer change.`, {
    fromDate: w.fromDate,
    throughDate: w.throughDate,
  });

/**
 * finance.logDoubleEntryTransaction and transferAssetFunds: refuses AUDIT_PERIOD_LOCKED when any line is dated inside a
 * period whose audit the Trustees signed.
 */
export function assertLedgerPeriodsOpen(lines: readonly Pick<JournalLineInput, 'DateLogged'>[], audits: readonly CouncilAudit[]): void {
  for (const audit of audits) {
    if (audit.execution_status !== 'LOCKED') continue;
    const window = auditWindow(audit.fiscal_year, audit.audit_period);
    const hit = lines.find((l) => {
      const day = String(l.DateLogged ?? '').slice(0, 10);
      return day >= window.fromDate && day <= window.throughDate;
    });
    if (hit) throw lockedError({ periodLabel: window.label, ...window });
  }
}

// ---- the balance sheet card ---------------------------------------------------------------------------------

/**
 * finance.getCouncilNetWorth: the council's liquid cash (every cash account, virtual goals rolled into the bank account
 * that holds them), plus the cost basis of its ACTIVE equipment in CouncilAssetsInventory, less the expense sheets it
 * approved but has not yet paid - its true net worth. Physical property accounts of the ledger are left out so
 * equipment is never counted twice.
 */
export function buildCouncilNetWorth(input: {
  councilId: number;
  accounts: readonly GLAccount[];
  entries: readonly JournalEntry[];
  assets: readonly CouncilAssetsInventory[];
  /** The council's 'Approved' (not yet 'Reimbursed') expense sheets with the sum of their receipts. */
  unpaidReports: readonly { reportId: number; amount: number; approvedAt: string | null }[];
  now: Date;
}): CouncilNetWorth {
  const cash = input.accounts.filter(isCashAccount);
  const cashIds = new Set(cash.map((a) => a.id));
  const ownCents = new Map<number, number>();
  for (const e of input.entries) {
    if (cashIds.has(e.GLAccountID)) ownCents.set(e.GLAccountID, (ownCents.get(e.GLAccountID) ?? 0) + cents(e.DebitAmount) - cents(e.CreditAmount));
  }
  // A virtual goal is money inside its parent bank account: roll it up there.
  const holderOf = (a: GLAccount) => (a.IsVirtualGoal === 1 && a.ParentAccountID != null && cashIds.has(a.ParentAccountID) ? a.ParentAccountID : a.id);
  const rolled = new Map<number, number>();
  for (const a of cash) rolled.set(holderOf(a), (rolled.get(holderOf(a)) ?? 0) + (ownCents.get(a.id) ?? 0));
  const cashAccounts = cash
    .filter((a) => rolled.has(a.id))
    .sort((a, b) => a.id - b.id)
    .map((a) => ({ accountId: a.id, accountName: a.AccountName, balance: dollars(rolled.get(a.id)!) }));
  const liquid = [...rolled.values()].reduce((s, c) => s + c, 0);

  const equipment = input.assets
    .filter((a) => a.council_id === input.councilId && a.current_status === 'ACTIVE')
    .sort((a, b) => b.purchase_date.localeCompare(a.purchase_date) || b.id - a.id)
    .map((a) => ({ assetId: a.id, assetName: a.asset_name, purchaseDate: a.purchase_date.slice(0, 10), costBasis: dollars(cents(a.cost_basis)) }));
  const equipmentCents = equipment.reduce((s, a) => s + cents(a.costBasis), 0);
  const unpaid = [...input.unpaidReports].sort((a, b) => a.reportId - b.reportId).map((r) => ({ ...r, amount: dollars(cents(r.amount)) }));
  const unpaidCents = unpaid.reduce((s, r) => s + cents(r.amount), 0);
  return {
    councilId: input.councilId,
    asOf: toTimestamp(input.now),
    cashAccounts,
    liquidCash: dollars(liquid),
    equipment,
    equipmentValue: dollars(equipmentCents),
    unpaidReports: unpaid,
    unpaidApprovedExpenses: dollars(unpaidCents),
    netWorth: dollars(liquid + equipmentCents - unpaidCents),
  };
}

// ---- the Form 1295 report -----------------------------------------------------------------------------------

/** The most lines the Form 1295 report route accepts in one desk. */
export const FORM_1295_MAX_LINES = 5000;

/** What the portal posts to /api/finance/form-1295: the council's name and number and one audit desk. */
export interface Form1295Payload {
  council: { id: number; number: number; name: string };
  workspace: TrusteeAuditWorkspace;
}

/**
 * The Form 1295 report route's checked body. The PDF is compiled from the desk the portal read through the data service,
 * so this only refuses (INVALID_INPUT) a body that is not shaped like one: a missing council, an unknown period, a
 * workspace without its lines, or more than FORM_1295_MAX_LINES lines.
 */
export function cleanForm1295Payload(body: unknown): Form1295Payload {
  const b = (body ?? {}) as Partial<Form1295Payload>;
  const council = b.council;
  const ws = b.workspace;
  if (!council || typeof council.id !== 'number' || typeof council.number !== 'number' || typeof council.name !== 'string') {
    throw invalid('The report needs the council (id, number and name).');
  }
  if (!ws || typeof ws !== 'object' || !Array.isArray(ws.lines) || !Array.isArray(ws.signatures)) throw invalid('The report needs the audit desk with its lines.');
  assertAuditPeriod(ws.period);
  assertFraternalYear(ws.fiscalYear);
  if (ws.councilId !== council.id) throw invalid(`The audit desk belongs to council ${String(ws.councilId)}, not council ${council.id}.`);
  if (ws.lines.length > FORM_1295_MAX_LINES) throw invalid(`The report takes at most ${FORM_1295_MAX_LINES} lines; the desk has ${ws.lines.length}.`);
  return { council: { id: council.id, number: council.number, name: council.name.slice(0, 200) }, workspace: ws };
}
