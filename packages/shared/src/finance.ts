// =========================================================================
// DOUBLE-ENTRY GENERAL LEDGER (Sprint 5Z-7)
// Pure helpers behind the finance.* service methods: journal line cleaning and
// the balancing rule, asset transfers, account balances, the chart-of-accounts
// hierarchy, the balance sheet, and bank statement parsing and matching. Every
// sum is taken in whole cents so no floating-point drift builds up. Drivers load
// rows already scoped to one council, call these, then only store. Who may act
// is decided in rules.ts (assertMayReadGeneralLedger, assertMayPostGeneralLedger).
// =========================================================================
import { currentFraternalYear, fraternalYearBounds } from './budget';
import type {
  AccountLedger,
  AccountLedgerRow,
  AssetTransferOptions,
  BalanceSheet,
  BalanceSheetLine,
  BalanceSheetSection,
  BankReconciliationMatch,
  BankReconciliationMiss,
  BankStatementRow,
  ChartOfAccounts,
  ChartOfAccountsNode,
  JournalLineInput,
  LiquidityGauge,
} from './contract';
import { CHECK_NUMBER_MAX_LENGTH } from './expenses';
import { toTimestamp } from './messaging';
import { assertIsoDate, assertMoney, assertText, BusinessRuleError, optionalText } from './rules';
import type { EventIntakeSessionStatus, GLAccount, GLAccountType, JournalEntry, Meeting } from './types';

/** GLAccount.AccountType values, in the order a chart of accounts lists them. */
export const GL_ACCOUNT_TYPES: readonly GLAccountType[] = ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'];
/** Account types whose balance grows with debits; the others grow with credits. */
export const DEBIT_NORMAL_ACCOUNT_TYPES: readonly GLAccountType[] = ['Asset', 'Expense'];
/** Event.IntakeSessionStatus values (Sprint 5Z-7); 'Inactive' is the default. */
export const EVENT_INTAKE_SESSION_STATUSES: readonly EventIntakeSessionStatus[] = ['Inactive', 'Active'];
/** Longest GLAccount.AccountName (VARCHAR(100)). */
export const GL_ACCOUNT_NAME_MAX_LENGTH = 100;
/** Longest JournalEntry.Description; the column is TEXT, the cap keeps the journal readable. */
export const JOURNAL_DESCRIPTION_MAX_LENGTH = 2000;
/** Most lines one finance.logDoubleEntryTransaction may post. */
export const JOURNAL_MAX_LINES = 100;
/** How many days apart a bank statement row and an entry without a check number may be dated and still match. */
export const BANK_MATCH_WINDOW_DAYS = 5;
/** Most data rows one bank statement upload may hold. */
export const BANK_STATEMENT_MAX_ROWS = 5000;

const invalid = (message: string, details: Record<string, unknown> = {}) => new BusinessRuleError('INVALID_INPUT', message, details);

const cents = (value: number | null | undefined) => Math.round((value ?? 0) * 100);
const dollars = (c: number) => c / 100;
const isId = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v > 0;

function optionalId(value: unknown, label: string): number | null {
  if (value === undefined || value === null) return null;
  if (!isId(value)) throw invalid(`${label} must be a record id; received ${JSON.stringify(value)}.`, { label });
  return value;
}

export const isDebitNormal = (type: GLAccountType): boolean => DEBIT_NORMAL_ACCOUNT_TYPES.includes(type);

// ---- journal lines -------------------------------------------------------------

/** A journal line ready to store: every JournalEntry column but id, CouncilID and IsBankReconciled. */
export interface CleanJournalLine {
  GLAccountID: number;
  DebitAmount: number;
  CreditAmount: number;
  Description: string;
  DateLogged: string;
  LinkedEventID: number | null;
  LinkedMeetingID: number | null;
  CheckNumber: string | null;
}

/**
 * JournalEntry.DateLogged: 'YYYY-MM-DD' (stored as midnight) or 'YYYY-MM-DD HH:MM[:SS]' (a 'T' separator is accepted),
 * returned as 'YYYY-MM-DD HH:MM:SS'; `now` stamps it when omitted.
 */
export function cleanJournalDate(value: unknown, now: Date, label = 'Date logged'): string {
  if (value === undefined || value === null) return toTimestamp(now);
  const m = typeof value === 'string' ? /^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(value.trim()) : null;
  if (m && Number(m[2] ?? 0) < 24 && Number(m[3] ?? 0) < 60 && Number(m[4] ?? 0) < 60) {
    const date = assertIsoDate(m[1], label);
    return `${date} ${m[2] ?? '00'}:${m[3] ?? '00'}:${m[4] ?? '00'}`;
  }
  throw invalid(`${label} must be a date such as 2026-10-01 or 2026-10-01 14:30; received ${JSON.stringify(value)}.`, { label });
}

/**
 * finance.logDoubleEntryTransaction's lines: two to JOURNAL_MAX_LINES, each with exactly one amount above 0 in whole
 * cents, a description, and an optional date, links and check number. The debits must equal the credits to the cent
 * (UNBALANCED_TRANSACTION); the accounts, links and council are checked against the database by the driver.
 */
export function cleanJournalLines(lines: readonly JournalLineInput[], now: Date): CleanJournalLine[] {
  if (!Array.isArray(lines) || lines.length < 2) {
    throw invalid('A double-entry transaction needs at least two lines: one debit and one credit.', { lines: Array.isArray(lines) ? lines.length : null });
  }
  if (lines.length > JOURNAL_MAX_LINES) {
    throw invalid(`A transaction may hold at most ${JOURNAL_MAX_LINES} lines; received ${lines.length}.`, { lines: lines.length, max: JOURNAL_MAX_LINES });
  }
  const clean = lines.map((line, i) => cleanJournalLine(line, now, i + 1));
  assertBalancedLines(clean);
  return clean;
}

function cleanJournalLine(line: JournalLineInput, now: Date, n: number): CleanJournalLine {
  if (typeof line !== 'object' || line === null) throw invalid(`Line ${n} must be a journal line.`, { line: n });
  if (!isId(line.GLAccountID)) throw invalid(`Line ${n}: the account must be a record id; received ${JSON.stringify(line.GLAccountID)}.`, { line: n });
  const debit = assertMoney(line.DebitAmount ?? 0, `Line ${n} debit`);
  const credit = assertMoney(line.CreditAmount ?? 0, `Line ${n} credit`);
  if ((debit > 0) === (credit > 0)) {
    throw invalid(`Line ${n} must carry exactly one amount above 0: a debit or a credit.`, { line: n, debit, credit });
  }
  return {
    GLAccountID: line.GLAccountID,
    DebitAmount: debit,
    CreditAmount: credit,
    Description: assertText(line.Description, `Line ${n} description`, JOURNAL_DESCRIPTION_MAX_LENGTH),
    DateLogged: cleanJournalDate(line.DateLogged, now, `Line ${n} date`),
    LinkedEventID: optionalId(line.LinkedEventID, `Line ${n} event`),
    LinkedMeetingID: optionalId(line.LinkedMeetingID, `Line ${n} meeting`),
    CheckNumber: optionalText(line.CheckNumber, `Line ${n} check number`, CHECK_NUMBER_MAX_LENGTH),
  };
}

/** Rejects UNBALANCED_TRANSACTION unless the lines' debits equal their credits to the cent. */
export function assertBalancedLines(lines: readonly Pick<CleanJournalLine, 'DebitAmount' | 'CreditAmount'>[]): void {
  const debits = lines.reduce((t, l) => t + cents(l.DebitAmount), 0);
  const credits = lines.reduce((t, l) => t + cents(l.CreditAmount), 0);
  if (debits === credits) return;
  throw new BusinessRuleError(
    'UNBALANCED_TRANSACTION',
    `The transaction does not balance: debits ${formatMoney(debits)} and credits ${formatMoney(credits)} differ by ${formatMoney(Math.abs(debits - credits))}.`,
    { debits: dollars(debits), credits: dollars(credits), difference: dollars(debits - credits) },
  );
}

const formatMoney = (c: number) => `$${(c / 100).toFixed(2)}`;

/**
 * The council every line posts to. `accounts` holds the GLAccount rows the lines name that exist; a missing account
 * or accounts of more than one council reject INVALID_INPUT.
 */
export function journalCouncilOf(lines: readonly Pick<CleanJournalLine, 'GLAccountID'>[], accounts: readonly GLAccount[]): number {
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const councils = new Set<number>();
  for (const line of lines) {
    const account = byId.get(line.GLAccountID);
    if (!account) throw invalid(`No general ledger account with id ${line.GLAccountID}.`, { glAccountId: line.GLAccountID });
    councils.add(account.CouncilID);
  }
  if (councils.size !== 1) {
    throw invalid('Every line of a transaction must post to accounts of the same council.', { councilIds: [...councils].sort((a, b) => a - b) });
  }
  return [...councils][0];
}

/**
 * A line may link only an event linked to its council and a meeting of its council. `eventCouncilIds` is null when
 * the event does not exist, `meeting` null when the meeting does not; each is read only when the line links one.
 */
export function assertJournalLinks(
  line: Pick<CleanJournalLine, 'LinkedEventID' | 'LinkedMeetingID'>,
  councilId: number,
  eventCouncilIds: readonly number[] | null,
  meeting: Pick<Meeting, 'CouncilID'> | null,
): void {
  const eventId = line.LinkedEventID;
  if (eventId !== null) {
    if (eventCouncilIds === null) throw invalid(`No event with id ${eventId}.`, { eventId });
    if (!eventCouncilIds.includes(councilId)) {
      throw invalid(`Event ${eventId} is not linked to council ${councilId}, so that council's journal cannot name it.`, { eventId, councilId });
    }
  }
  const meetingId = line.LinkedMeetingID;
  if (meetingId !== null) {
    if (meeting === null) throw invalid(`No meeting with id ${meetingId}.`, { meetingId });
    if (meeting.CouncilID !== councilId) {
      throw invalid(`Meeting ${meetingId} belongs to another council, so council ${councilId}'s journal cannot name it.`, { meetingId, councilId });
    }
  }
}

// ---- transfers -----------------------------------------------------------------

/**
 * finance.transferAssetFunds: a debit to the target and a credit to the source for `amount`, both Asset accounts of
 * one council, never the same one, and never more than the source's own balance (`sourceBalance`; INSUFFICIENT_FUNDS).
 * `source` and `target` are null when the account does not exist.
 */
export function planAssetTransfer(
  source: GLAccount | null,
  target: GLAccount | null,
  amount: unknown,
  sourceBalance: number,
  now: Date,
  options: AssetTransferOptions = {},
): { councilId: number; lines: CleanJournalLine[] } {
  const value = assertMoney(amount, 'Transfer amount');
  if (value <= 0) throw invalid('Transfer amount must be above 0.', { amount: value });
  if (!source) throw invalid('The source account does not exist.');
  if (!target) throw invalid('The target account does not exist.');
  if (source.id === target.id) throw invalid('A transfer needs two different accounts.', { accountId: source.id });
  for (const account of [source, target]) {
    if (account.AccountType !== 'Asset') {
      const article = /^[AEIOU]/.test(account.AccountType) ? 'an' : 'a';
      throw invalid(`${account.AccountName} is ${article} ${account.AccountType} account; only asset accounts transfer funds.`, {
        accountId: account.id,
        accountType: account.AccountType,
      });
    }
  }
  if (source.CouncilID !== target.CouncilID) {
    throw invalid('A transfer moves funds between accounts of the same council.', { sourceCouncilId: source.CouncilID, targetCouncilId: target.CouncilID });
  }
  if (cents(sourceBalance) < cents(value)) {
    throw new BusinessRuleError(
      'INSUFFICIENT_FUNDS',
      `${source.AccountName} holds ${formatMoney(cents(sourceBalance))}, so ${formatMoney(cents(value))} cannot be moved out of it.`,
      { accountId: source.id, balance: sourceBalance, amount: value },
    );
  }
  const description =
    options.description === undefined
      ? `Transfer from ${source.AccountName} to ${target.AccountName}`
      : assertText(options.description, 'Transfer description', JOURNAL_DESCRIPTION_MAX_LENGTH);
  const DateLogged = cleanJournalDate(options.dateLogged, now, 'Transfer date');
  const line = { Description: description, DateLogged, LinkedEventID: null, LinkedMeetingID: null, CheckNumber: null };
  return {
    councilId: source.CouncilID,
    lines: [
      { ...line, GLAccountID: target.id, DebitAmount: value, CreditAmount: 0 },
      { ...line, GLAccountID: source.id, DebitAmount: 0, CreditAmount: value },
    ],
  };
}

// ---- balances, the chart and the balance sheet ----------------------------------

export interface AccountTotals {
  debitCents: number;
  creditCents: number;
}

/** Each account's posted debits and credits in cents, by account id; accounts with no entries are absent. */
export function accountTotals(entries: readonly Pick<JournalEntry, 'GLAccountID' | 'DebitAmount' | 'CreditAmount'>[]): Map<number, AccountTotals> {
  const totals = new Map<number, AccountTotals>();
  for (const e of entries) {
    const t = totals.get(e.GLAccountID) ?? { debitCents: 0, creditCents: 0 };
    t.debitCents += cents(e.DebitAmount);
    t.creditCents += cents(e.CreditAmount);
    totals.set(e.GLAccountID, t);
  }
  return totals;
}

/** An account's balance in cents on its normal side (see ChartOfAccountsNode.balance). */
export function normalBalanceCents(type: GLAccountType, totals: AccountTotals | undefined): number {
  if (!totals) return 0;
  return isDebitNormal(type) ? totals.debitCents - totals.creditCents : totals.creditCents - totals.debitCents;
}

/** An account's balance in dollars from its entries (see normalBalanceCents). */
export const accountBalance = (account: Pick<GLAccount, 'id' | 'AccountType'>, entries: readonly Pick<JournalEntry, 'GLAccountID' | 'DebitAmount' | 'CreditAmount'>[]): number =>
  dollars(normalBalanceCents(account.AccountType, accountTotals(entries.filter((e) => e.GLAccountID === account.id)).get(account.id)));

/** Chart order: GL_ACCOUNT_TYPES, then id (the order the council set its accounts up in). */
export const compareGLAccounts = (a: GLAccount, b: GLAccount): number =>
  GL_ACCOUNT_TYPES.indexOf(a.AccountType) - GL_ACCOUNT_TYPES.indexOf(b.AccountType) || a.id - b.id;

/**
 * finance.listChartOfAccounts: the council's accounts as a tree with their balances. An account whose parent is
 * missing (or would make a cycle) is listed at the top level, so no account is ever hidden.
 */
export function buildChartOfAccounts(councilId: number, accounts: readonly GLAccount[], entries: readonly JournalEntry[]): ChartOfAccounts {
  const totals = accountTotals(entries);
  const ids = new Set(accounts.map((a) => a.id));
  const childrenOf = new Map<number, GLAccount[]>();
  const roots: GLAccount[] = [];
  for (const a of [...accounts].sort(compareGLAccounts)) {
    const parent = a.ParentAccountID ?? null;
    if (parent !== null && parent !== a.id && ids.has(parent)) childrenOf.set(parent, [...(childrenOf.get(parent) ?? []), a]);
    else roots.push(a);
  }
  const placed = new Set<number>();
  const node = (account: GLAccount, depth: number): ChartOfAccountsNode => {
    placed.add(account.id);
    const t = totals.get(account.id);
    const children = (childrenOf.get(account.id) ?? []).filter((c) => !placed.has(c.id)).map((c) => node(c, depth + 1));
    const own = normalBalanceCents(account.AccountType, t);
    return {
      account: { ...account },
      depth,
      debitTotal: dollars(t?.debitCents ?? 0),
      creditTotal: dollars(t?.creditCents ?? 0),
      balance: dollars(own),
      rolledUpBalance: dollars(own + children.reduce((sum, c) => sum + cents(c.rolledUpBalance), 0)),
      children,
    };
  };
  const tree = roots.map((r) => node(r, 0));
  // Accounts caught in a parent cycle never hang from a root; list them at the top so none is hidden.
  for (const a of [...accounts].sort(compareGLAccounts)) if (!placed.has(a.id)) tree.push(node(a, 0));
  return { councilId, accounts: tree };
}

/**
 * finance.getLatestBalanceSheet: the balance of every account, grouped by type and summed in cents. Debits equal
 * credits across every posting, so assets always equal liabilities, equity and the current surplus.
 */
export function buildBalanceSheet(councilId: number, accounts: readonly GLAccount[], entries: readonly JournalEntry[], now: Date): BalanceSheet {
  const totals = accountTotals(entries);
  const section = (type: GLAccountType): BalanceSheetSection & { cents: number } => {
    const lines: BalanceSheetLine[] = [];
    let sum = 0;
    for (const a of accounts.filter((x) => x.AccountType === type).sort(compareGLAccounts)) {
      const balance = normalBalanceCents(type, totals.get(a.id));
      sum += balance;
      lines.push({
        accountId: a.id,
        accountName: a.AccountName,
        accountType: a.AccountType,
        parentAccountId: a.ParentAccountID ?? null,
        isVirtualGoal: a.IsVirtualGoal === 1,
        balance: dollars(balance),
      });
    }
    return { lines, total: dollars(sum), cents: sum };
  };
  const [assets, liabilities, equity, revenue, expenses] = GL_ACCOUNT_TYPES.map(section);
  const surplus = revenue.cents - expenses.cents;
  const equityTotal = equity.cents + surplus;
  const right = liabilities.cents + equityTotal;
  const strip = ({ lines, total }: BalanceSheetSection) => ({ lines, total });
  // The year-to-date surplus: revenue less expenses posted since the current fraternal year's July 1 (local calendar).
  const fraternalYear = currentFraternalYear(now);
  const yearOpens = fraternalYearBounds(fraternalYear).fromDate;
  const typeOf = new Map(accounts.map((a) => [a.id, a.AccountType]));
  let ytd = 0;
  for (const e of entries) {
    const type = typeOf.get(e.GLAccountID);
    if (e.DateLogged.slice(0, 10) < yearOpens || (type !== 'Revenue' && type !== 'Expense')) continue;
    // Credits raise revenue and debits raise expenses, so credits less debits is the surplus either way.
    ytd += cents(e.CreditAmount) - cents(e.DebitAmount);
  }
  return {
    councilId,
    asOf: toTimestamp(now),
    assets: strip(assets),
    liabilities: strip(liabilities),
    equity: strip(equity),
    revenue: strip(revenue),
    expenses: strip(expenses),
    netSurplus: dollars(surplus),
    fraternalYear,
    yearToDateSurplus: dollars(ytd),
    priorYearsSurplus: dollars(surplus - ytd),
    totalAssets: assets.total,
    totalLiabilities: liabilities.total,
    totalEquity: dollars(equityTotal),
    totalLiabilitiesAndEquity: dollars(right),
    difference: dollars(assets.cents - right),
    isBalanced: assets.cents === right,
    entryCount: entries.length,
  };
}

/** Ledger order: DateLogged, then id. */
const compareEntries = (a: JournalEntry, b: JournalEntry): number => a.DateLogged.localeCompare(b.DateLogged) || a.id - b.id;

/**
 * finance.getAccountLedger: every line on `account`, oldest first, with the running normal-side balance and every line
 * of the posting it belongs to. `accounts` and `entries` are the account's whole council, so the other lines of each
 * posting can be named; `eventNames` names the events the lines link (Sprint 5Z-9), by Event id.
 */
export function buildAccountLedger(
  account: GLAccount,
  accounts: readonly GLAccount[],
  entries: readonly JournalEntry[],
  eventNames: ReadonlyMap<number, string> = new Map(),
): AccountLedger {
  const names = new Map(accounts.map((a) => [a.id, a.AccountName]));
  const byTransaction = new Map<string, JournalEntry[]>();
  for (const e of [...entries].sort((a, b) => a.id - b.id)) byTransaction.set(e.TransactionID, [...(byTransaction.get(e.TransactionID) ?? []), e]);
  const debitNormal = isDebitNormal(account.AccountType);
  let running = 0;
  let debits = 0;
  let credits = 0;
  const rows: AccountLedgerRow[] = [];
  for (const e of entries.filter((x) => x.GLAccountID === account.id).sort(compareEntries)) {
    debits += cents(e.DebitAmount);
    credits += cents(e.CreditAmount);
    running += debitNormal ? cents(e.DebitAmount) - cents(e.CreditAmount) : cents(e.CreditAmount) - cents(e.DebitAmount);
    rows.push({
      entry: { ...e },
      runningBalance: dollars(running),
      transactionLines: (byTransaction.get(e.TransactionID) ?? [e]).map((line) => ({
        entry: { ...line },
        accountName: names.get(line.GLAccountID) ?? `Account ${line.GLAccountID}`,
      })),
      eventName: e.LinkedEventID != null ? (eventNames.get(e.LinkedEventID) ?? null) : null,
    });
  }
  return { account: { ...account }, balance: dollars(running), debitTotal: dollars(debits), creditTotal: dollars(credits), rows };
}

/**
 * The dashboard's liquidity gauges (Sprint 5Z-8): one per bank account (a non-virtual Asset account) that has virtual
 * goals inside it, in chart order. Goals nest under their bank account in the chart, so this reads the tree
 * listChartOfAccounts returns; no account name is assumed.
 */
export function buildLiquidityGauges(chart: ChartOfAccounts): LiquidityGauge[] {
  const gauges: LiquidityGauge[] = [];
  const visit = (node: ChartOfAccountsNode) => {
    const goals = node.children.filter((c) => c.account.IsVirtualGoal === 1);
    if (isBankAccount(node.account) && goals.length) {
      const reserved = goals.reduce((sum, g) => sum + cents(g.rolledUpBalance), 0);
      gauges.push({
        account: { ...node.account },
        totalCash: node.rolledUpBalance,
        reserved: dollars(reserved),
        liquid: dollars(cents(node.rolledUpBalance) - reserved),
        goals: goals.map((g) => ({
          account: { ...g.account },
          balance: g.rolledUpBalance,
          target: g.account.TargetGoalAmount,
          percentFunded: cents(g.account.TargetGoalAmount) > 0 ? Math.round((cents(g.rolledUpBalance) / cents(g.account.TargetGoalAmount)) * 1000) / 10 : null,
        })),
      });
    }
    node.children.forEach(visit);
  };
  chart.accounts.forEach(visit);
  return gauges;
}

/**
 * A fresh TransactionID (Sprint 5Z-8): an RFC 4122 version 4 UUID from 16 random bytes. Each driver supplies the bytes
 * from its platform's secure generator (Web Crypto in the browser, expo-crypto on the phone).
 */
export function formatTransactionId(bytes: Uint8Array): string {
  if (bytes.length < 16) throw new Error(`A transaction id needs 16 random bytes; received ${bytes.length}.`);
  const b = Array.from(bytes.slice(0, 16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = b.map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Each account type's heading on the ledger spreadsheet and the balance sheet. */
export const GL_ACCOUNT_TYPE_LABELS: Record<GLAccountType, string> = {
  Asset: 'Assets',
  Liability: 'Liabilities',
  Equity: 'Equity',
  Revenue: 'Revenue',
  Expense: 'Expenses',
};

// ---- bank statement reconciliation --------------------------------------------------

/** Accounts a bank statement can reconcile: the council's Asset accounts that are not virtual goals. */
export const isBankAccount = (account: Pick<GLAccount, 'AccountType' | 'IsVirtualGoal'>): boolean =>
  account.AccountType === 'Asset' && account.IsVirtualGoal !== 1;

/**
 * The accounts finance.uploadBankStatementReconciliation matches against among the council's `accounts`: just
 * `glAccountId` when given (it must be one of the council's bank accounts, else INVALID_INPUT), otherwise every bank
 * account of the council.
 */
export function reconcilableAccountIds(accounts: readonly GLAccount[], glAccountId: number | undefined): Set<number> {
  if (glAccountId === undefined) return new Set(accounts.filter(isBankAccount).map((a) => a.id));
  const account = accounts.find((a) => a.id === glAccountId);
  if (!account || !isBankAccount(account)) {
    throw invalid(`Account ${JSON.stringify(glAccountId)} is not a bank account of the council: reconcile an asset account that is not a virtual goal.`, {
      glAccountId,
    });
  }
  return new Set([account.id]);
}

/** Header names a statement column is recognised by, compared ignoring case, spaces and punctuation. */
const BANK_COLUMN_ALIASES = {
  date: ['date', 'posteddate', 'postingdate', 'transactiondate', 'transdate'],
  description: ['description', 'memo', 'payee', 'details', 'name'],
  amount: ['amount', 'transactionamount'],
  withdrawal: ['withdrawal', 'withdrawals', 'debit', 'debits'],
  deposit: ['deposit', 'deposits', 'credit', 'credits'],
  checkNumber: ['checknumber', 'check', 'checkno', 'checknum', 'serialnumber'],
} as const;

const headerKey = (h: string) => h.toLowerCase().replace(/[^a-z]/g, '');

/**
 * Splits CSV text into records of fields: quoted fields may hold commas, doubled quotes and line breaks. `source` names
 * the file in the unclosed-quote error (Sprint 6B Patch: the Supreme roster import reads its export with it too).
 */
export function csvRecords(text: string, source = 'The bank statement'): { line: number; fields: string[] }[] {
  const records: { line: number; fields: string[] }[] = [];
  let fields: string[] = [];
  let field = '';
  let quoted = false;
  let line = 1;
  let start = 1;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else {
        if (c === '\n') line++;
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ',') {
      fields.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      fields.push(field);
      records.push({ line: start, fields });
      fields = [];
      field = '';
      line++;
      start = line;
    } else {
      field += c;
    }
  }
  if (quoted) throw invalid(`${source} has an unclosed quote starting on line ${start}.`, { line: start });
  if (field !== '' || fields.length) {
    fields.push(field);
    records.push({ line: start, fields });
  }
  return records.filter((r) => r.fields.some((f) => f.trim() !== ''));
}

/** 'YYYY-MM-DD' or 'M/D/YYYY' as YYYY-MM-DD. */
function statementDate(value: string, line: number): string {
  const text = value.trim();
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  const iso = us ? `${us[3]}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}` : text;
  try {
    return assertIsoDate(iso, `Line ${line} date`);
  } catch {
    throw invalid(`Line ${line}: the date must be YYYY-MM-DD or MM/DD/YYYY; received ${JSON.stringify(value)}.`, { line });
  }
}

/** An amount such as 1,234.56, -$20.00 or ($20.00), in cents; blank is null. */
function statementCents(value: string | undefined, line: number): number | null {
  const text = (value ?? '').trim();
  if (text === '') return null;
  const m = /^(\()?\s*(-)?\s*\$?\s*(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?\s*(\))?$/.exec(text);
  if (!m || Boolean(m[1]) !== Boolean(m[5])) throw invalid(`Line ${line}: ${JSON.stringify(value)} is not an amount in dollars and cents.`, { line });
  const c = Number(m[3].replace(/,/g, '')) * 100 + Number((m[4] ?? '').padEnd(2, '0'));
  return m[1] || m[2] ? -c : c;
}

/**
 * Reads a bank statement CSV: a header row, then one row per transaction. It needs a Date column and either a signed
 * Amount column or Withdrawal and/or Deposit columns; Description and Check Number columns are optional (see
 * BANK_COLUMN_ALIASES). Blank lines are skipped, and a row with no amount or an amount of 0 is ignored (a balance
 * line). Anything malformed rejects INVALID_INPUT naming its line.
 */
export function parseBankStatementCsv(csv: unknown): BankStatementRow[] {
  if (typeof csv !== 'string' || csv.trim() === '') throw invalid('The bank statement file is empty.');
  const [header, ...data] = csvRecords(csv);
  const keys = header.fields.map(headerKey);
  const col = (names: readonly string[]) => keys.findIndex((k) => names.includes(k));
  const at = {
    date: col(BANK_COLUMN_ALIASES.date),
    description: col(BANK_COLUMN_ALIASES.description),
    amount: col(BANK_COLUMN_ALIASES.amount),
    withdrawal: col(BANK_COLUMN_ALIASES.withdrawal),
    deposit: col(BANK_COLUMN_ALIASES.deposit),
    checkNumber: col(BANK_COLUMN_ALIASES.checkNumber),
  };
  if (at.date < 0 || (at.amount < 0 && at.withdrawal < 0 && at.deposit < 0)) {
    throw invalid('The bank statement needs a header row with a Date column and an Amount (or Withdrawal and Deposit) column.', {
      header: header.fields,
    });
  }
  if (data.length > BANK_STATEMENT_MAX_ROWS) {
    throw invalid(`A bank statement may hold at most ${BANK_STATEMENT_MAX_ROWS} rows; received ${data.length}.`, { rows: data.length });
  }
  const rows: BankStatementRow[] = [];
  for (const { line, fields } of data) {
    const field = (i: number) => (i < 0 ? '' : (fields[i] ?? ''));
    let amount: number | null;
    if (at.amount >= 0) {
      amount = statementCents(field(at.amount), line);
    } else {
      const out = statementCents(field(at.withdrawal), line);
      const inn = statementCents(field(at.deposit), line);
      amount = out === null && inn === null ? null : (inn ?? 0) - Math.abs(out ?? 0);
    }
    if (amount === null || amount === 0) continue;
    const check = field(at.checkNumber).trim();
    rows.push({
      line,
      date: statementDate(field(at.date), line),
      description: field(at.description).trim(),
      amount: dollars(amount),
      checkNumber: check === '' ? null : check.slice(0, CHECK_NUMBER_MAX_LENGTH),
    });
  }
  if (!rows.length) throw invalid('The bank statement holds no transactions.');
  return rows;
}

const dayNumber = (isoDate: string) => Date.UTC(Number(isoDate.slice(0, 4)), Number(isoDate.slice(5, 7)) - 1, Number(isoDate.slice(8, 10))) / 86_400_000;
const checkKey = (n: string | null | undefined) => (n ?? '').trim().toLowerCase();

/**
 * Pairs statement rows with unreconciled journal entries (`candidates`, already limited to the accounts being
 * reconciled). A deposit matches a debit of the same amount, a withdrawal a credit. A row with a check number matches
 * only an entry with that check number, whatever its date; any other row matches the entry dated closest to it
 * within BANK_MATCH_WINDOW_DAYS, the lower id on a tie. Rows with check numbers are paired first, so a plain row never
 * takes a check's entry; each entry is matched once.
 */
export function matchBankStatement(
  rows: readonly BankStatementRow[],
  candidates: readonly JournalEntry[],
): { matched: BankReconciliationMatch[]; unmatched: BankReconciliationMiss[] } {
  const open = [...candidates].filter((e) => e.IsBankReconciled !== 1).sort((a, b) => a.id - b.id);
  const taken = new Set<number>();
  const found = new Map<BankStatementRow, number>();
  const misses = new Map<BankStatementRow, string>();
  const sameAmount = (row: BankStatementRow, e: JournalEntry) =>
    row.amount > 0 ? cents(e.DebitAmount) === cents(row.amount) : cents(e.CreditAmount) === -cents(row.amount);
  const direction = (row: BankStatementRow) => (row.amount > 0 ? 'deposit' : 'withdrawal');
  const money = (row: BankStatementRow) => formatMoney(Math.abs(cents(row.amount)));

  for (const row of rows.filter((r) => r.checkNumber !== null)) {
    const entry = open.find((e) => !taken.has(e.id) && sameAmount(row, e) && checkKey(e.CheckNumber) === checkKey(row.checkNumber));
    if (entry) {
      taken.add(entry.id);
      found.set(row, entry.id);
    } else {
      misses.set(row, `No unreconciled ${money(row)} ${direction(row)} with check number ${row.checkNumber}.`);
    }
  }
  for (const row of rows.filter((r) => r.checkNumber === null)) {
    const day = dayNumber(row.date);
    let best: { entry: JournalEntry; gap: number } | null = null;
    for (const e of open) {
      if (taken.has(e.id) || !sameAmount(row, e)) continue;
      const gap = Math.abs(dayNumber(e.DateLogged.slice(0, 10)) - day);
      if (gap <= BANK_MATCH_WINDOW_DAYS && (!best || gap < best.gap)) best = { entry: e, gap };
    }
    if (best) {
      taken.add(best.entry.id);
      found.set(row, best.entry.id);
    } else {
      misses.set(row, `No unreconciled ${money(row)} ${direction(row)} within ${BANK_MATCH_WINDOW_DAYS} days of ${row.date}.`);
    }
  }
  return {
    matched: rows.filter((r) => found.has(r)).map((row) => ({ row, journalEntryId: found.get(row)! })),
    unmatched: rows.filter((r) => misses.has(r)).map((row) => ({ row, reason: misses.get(row)! })),
  };
}

export const glAccountNotFound = (accountId: number): BusinessRuleError =>
  new BusinessRuleError('RECORD_NOT_FOUND', `General ledger account ${accountId} does not exist.`, { table: 'GLAccount', id: accountId });
