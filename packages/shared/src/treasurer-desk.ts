// =========================================================================
// THE TREASURER LEDGER AUDIT DESK AND POST-EVENT REVENUE (Sprint 6Q)
// Pure helpers behind expenses.treasurerLedgerAudit / listTreasurerQueue and finance.logConcludedRevenue.
//
// An expense sheet is signed in three lines: the Financial Secretary's written order, the Treasurer's ledger coding
// and the Grand Knight's counter-signature. The Treasurer alone chooses the sheet's budget line and its general ledger
// account, so members and the other signers never meet an account code. The Treasurer also records what a concluded
// event or a running activity raised, straight into the ledger. Drivers load rows, call these, then only store.
// =========================================================================
import type { ConcludedRevenueInput, ExpenseLedgerCoding } from './contract';
import { isPhysicalPropertyAccount } from './audits';
import { cleanJournalDate, compareGLAccounts, isBankAccount, JOURNAL_DESCRIPTION_MAX_LENGTH, type CleanJournalLine } from './finance';
import {
  assertMoney,
  assertText,
  BusinessRuleError,
  describeActor,
  hasAdminRights,
  hasSuperAdminRights,
  SecurityPrivilegeError,
  toIsoDate,
  type MemberWriteActor,
} from './rules';
import type { Activities, Event, ExpenseReport, GLAccount } from './types';

/** The seat that codes expense sheets to the ledger and logs concluded revenue, matched by Role name. */
export const TREASURER_ROLE_NAME = 'Treasurer';

/** The desk's command and card titles. Sprint 7C: the command reads in plain English (was '🧾 Code to Ledger'). */
export const TREASURER_CODE_EXPENSE_LABEL = '🏷️ Categorize & Lock Expense';
export const LOG_CONCLUDED_REVENUE_TITLE = '💰 Log Concluded Event Revenues';

const invalid = (message: string, details: Record<string, unknown> = {}) => new BusinessRuleError('INVALID_INPUT', message, details);

const isId = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v > 0;

const holdsTreasurerSeat = (actor: MemberWriteActor): boolean => actor.active && (actor.roles ?? []).includes(TREASURER_ROLE_NAME);

function treasurerDenial(actor: MemberWriteActor, councilId: number, action: string, readersToo: boolean): SecurityPrivilegeError | null {
  if (hasSuperAdminRights(actor)) return null;
  if (!(holdsTreasurerSeat(actor) || (readersToo && hasAdminRights(actor)))) {
    const who = readersToo ? 'an active Treasurer, Admin or Super Admin' : 'an active Treasurer or Super Admin';
    return new SecurityPrivilegeError('TREASURER_REQUIRED', `Only ${who} can ${action}; member ${actor.memberId} is ${describeActor(actor)}.`, {
      actorId: actor.memberId,
      actorType: actor.memberType ?? null,
      councilId,
    });
  }
  if (actor.councilId === councilId) return null;
  return new SecurityPrivilegeError(
    'COUNCIL_ACCESS_DENIED',
    `Member ${actor.memberId} of council ${actor.councilId} cannot ${action} in council ${councilId}; a council's ledger is coded only by its own Treasurer.`,
    { actorId: actor.memberId, actorCouncilId: actor.councilId, councilId },
  );
}

/**
 * expenses.treasurerLedgerAudit and finance.logConcludedRevenue: only the council's Active Treasurer, or an Active
 * Super Admin for any council (TREASURER_REQUIRED, COUNCIL_ACCESS_DENIED). `action` completes "cannot ...".
 */
export function assertMayCodeExpenseLedger(actor: MemberWriteActor, councilId: number, action: string): void {
  const denial = treasurerDenial(actor, councilId, action, false);
  if (denial) throw denial;
}

/** assertMayCodeExpenseLedger as a yes/no. */
export const mayCodeExpenseLedger = (actor: MemberWriteActor, councilId: number): boolean =>
  treasurerDenial(actor, councilId, 'code expense reports', false) === null;

/**
 * expenses.listTreasurerQueue: the desk is read by the council's Active Treasurer or Admins, or an Active Super Admin.
 * Reading grants no coding; treasurerLedgerAudit still checks the seat.
 */
export function assertMayReadTreasurerDesk(actor: MemberWriteActor, councilId: number, action: string): void {
  const denial = treasurerDenial(actor, councilId, action, true);
  if (denial) throw denial;
}

// ---- expense coding --------------------------------------------------------------------------------------------

/** The accounts a sheet may be charged to: the council's Expense accounts, plus physical property for a long-term asset. */
export const isExpenseLedgerAccountFor = (account: GLAccount, report: Pick<ExpenseReport, 'is_long_term_asset'>): boolean =>
  account.AccountType === 'Expense' || (report.is_long_term_asset === 1 && isPhysicalPropertyAccount(account));

/** The desk dropdown's choices for one sheet, in chart order. */
export const expenseLedgerAccountChoices = (accounts: readonly GLAccount[], report: Pick<ExpenseReport, 'CouncilID' | 'is_long_term_asset'>): GLAccount[] =>
  accounts.filter((a) => a.CouncilID === report.CouncilID && isExpenseLedgerAccountFor(a, report)).sort(compareGLAccounts);

/**
 * The general_ledger_account_id the Treasurer saves: a record id naming one of expenseLedgerAccountChoices. Returns the
 * id; INVALID_INPUT otherwise.
 */
export function assertExpenseLedgerAccount(
  accounts: readonly GLAccount[],
  report: Pick<ExpenseReport, 'CouncilID' | 'is_long_term_asset'>,
  accountId: unknown,
): number {
  if (!isId(accountId)) {
    throw invalid(`Choose the ledger account to charge; received ${JSON.stringify(accountId)}.`, { field: 'general_ledger_account_id' });
  }
  const account = accounts.find((a) => a.id === accountId && a.CouncilID === report.CouncilID);
  if (!account) {
    throw invalid(`Ledger account ${accountId} is not an account of council ${report.CouncilID}.`, { field: 'general_ledger_account_id', accountId });
  }
  if (!isExpenseLedgerAccountFor(account, report)) {
    throw invalid(`"${account.AccountName}" is not an expense account, so no expense report can be charged to it.`, {
      field: 'general_ledger_account_id',
      accountId,
    });
  }
  return account.id;
}

/** The coding argument, checked for shape: both ids are required. The driver checks them against the council. */
export function cleanExpenseLedgerCoding(coding: ExpenseLedgerCoding): { budgetLineId: unknown; generalLedgerAccountId: unknown } {
  if (typeof coding !== 'object' || coding === null) throw invalid('Choose a budget line and a ledger account.');
  if (coding.budgetLineId == null) throw invalid('Choose the budget line to charge.', { field: 'budget_line_id' });
  if (coding.generalLedgerAccountId == null) throw invalid('Choose the ledger account to charge.', { field: 'general_ledger_account_id' });
  return { budgetLineId: coding.budgetLineId, generalLedgerAccountId: coding.generalLedgerAccountId };
}

// ---- concluded revenue -----------------------------------------------------------------------------------------

/** A cash account revenue may be deposited to: an Asset account that is neither a virtual goal nor physical property. */
export const isDepositAccount = (account: GLAccount): boolean => isBankAccount(account) && !isPhysicalPropertyAccount(account);

/** The revenue card's two account lists for the council, in chart order. */
export function concludedRevenueAccounts(accounts: readonly GLAccount[], councilId: number): { revenue: GLAccount[]; deposit: GLAccount[] } {
  const own = accounts.filter((a) => a.CouncilID === councilId).sort(compareGLAccounts);
  return { revenue: own.filter((a) => a.AccountType === 'Revenue'), deposit: own.filter(isDepositAccount) };
}

/** An event has concluded once its last day (EndDate) is today or earlier. */
export const eventHasConcluded = (event: Pick<Event, 'EndDate'>, today: string): boolean => String(event.EndDate).slice(0, 10) <= today;

/** What the revenue is for, as the driver found it. `eventCouncilIds` is the councils the event is linked to. */
export type ConcludedRevenueSource =
  | { kind: 'event'; event: Pick<Event, 'id' | 'EventName' | 'EndDate'> | null; eventCouncilIds: readonly number[] }
  | { kind: 'activity'; activity: Pick<Activities, 'id' | 'ActivityName' | 'CouncilID'> | null };

/** The one link the input names: exactly one of LinkedEventID and LinkedActivityID (INVALID_INPUT otherwise). */
export function concludedRevenueLink(input: ConcludedRevenueInput): { kind: 'event' | 'activity'; id: number } {
  if (typeof input !== 'object' || input === null) throw invalid('The revenue details are required.');
  const eventId = input.LinkedEventID ?? null;
  const activityId = input.LinkedActivityID ?? null;
  if ((eventId === null) === (activityId === null)) throw invalid('Choose one past event or one activity the money was raised for.');
  const id = eventId ?? activityId;
  if (!isId(id)) throw invalid(`The event or activity must be a record id; received ${JSON.stringify(id)}.`);
  return { kind: eventId !== null ? 'event' : 'activity', id };
}

/**
 * finance.logConcludedRevenue: the two journal lines (a debit to the deposit account, a credit to the Revenue account),
 * both linked to the event or activity. `accounts` are the council's GLAccount rows.
 */
export function planConcludedRevenue(
  councilId: number,
  input: ConcludedRevenueInput,
  source: ConcludedRevenueSource,
  accounts: readonly GLAccount[],
  now: Date,
): CleanJournalLine[] {
  const link = concludedRevenueLink(input);
  const today = toIsoDate(now);
  let name: string;
  if (source.kind === 'event') {
    if (!source.event) throw invalid(`No event with id ${link.id}.`, { eventId: link.id });
    if (!source.eventCouncilIds.includes(councilId)) {
      throw invalid(`Event ${link.id} is not linked to council ${councilId}, so that council cannot log its revenue.`, { eventId: link.id, councilId });
    }
    if (!eventHasConcluded(source.event, today)) {
      throw invalid(`"${source.event.EventName}" has not ended yet; log its revenue once it is over.`, { eventId: link.id, endDate: source.event.EndDate });
    }
    name = source.event.EventName;
  } else {
    if (!source.activity) throw invalid(`No activity with id ${link.id}.`, { activityId: link.id });
    if (source.activity.CouncilID !== councilId) {
      throw invalid(`Activity ${link.id} belongs to another council, so council ${councilId} cannot log its revenue.`, { activityId: link.id, councilId });
    }
    name = source.activity.ActivityName;
  }
  const amount = assertMoney(input.Amount, 'Funds collected');
  if (amount <= 0) throw invalid('Enter the funds collected: an amount above $0.00.', { amount });
  const { revenue, deposit } = concludedRevenueAccounts(accounts, councilId);
  const revenueAccount = revenue.find((a) => a.id === input.RevenueAccountID);
  if (!revenueAccount) {
    throw invalid(`Account ${JSON.stringify(input.RevenueAccountID)} is not a revenue account of council ${councilId}.`, { field: 'RevenueAccountID' });
  }
  const depositId = input.DepositAccountID ?? deposit[0]?.id ?? null;
  const depositAccount = deposit.find((a) => a.id === depositId);
  if (!depositAccount) {
    throw invalid(
      depositId === null
        ? `Council ${councilId} has no cash account to deposit the revenue to.`
        : `Account ${JSON.stringify(depositId)} is not a cash account of council ${councilId}.`,
      { field: 'DepositAccountID' },
    );
  }
  const dateLogged = cleanJournalDate(input.DateLogged, now, 'Date collected');
  if (dateLogged.slice(0, 10) > today) throw invalid('The date collected cannot be in the future.', { dateLogged });
  const description =
    input.Description === undefined || input.Description === null || String(input.Description).trim() === ''
      ? `Revenue collected: ${name}`
      : assertText(input.Description, 'Description', JOURNAL_DESCRIPTION_MAX_LENGTH);
  const base = {
    Description: description,
    DateLogged: dateLogged,
    LinkedEventID: link.kind === 'event' ? link.id : null,
    LinkedMeetingID: null,
    LinkedActivityID: link.kind === 'activity' ? link.id : null,
    CheckNumber: null,
  };
  return [
    { ...base, GLAccountID: depositAccount.id, DebitAmount: amount, CreditAmount: 0 },
    { ...base, GLAccountID: revenueAccount.id, DebitAmount: 0, CreditAmount: amount },
  ];
}
