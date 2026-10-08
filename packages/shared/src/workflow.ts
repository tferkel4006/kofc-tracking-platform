// The centralized state machine engine for the platform's multi-step lifecycles (Sprint 6Z-Engine-Upgrade).
//
// Each lifecycle is declared once as a WorkflowDefinition: its states, its starting state and, per action, the states
// the action may start from and the one state it leads to. Drivers never write a status column by hand; they ask the
// workflow for the next state (nextWorkflowState), which throws when the action is not allowed from the current state.
// So a record cannot jump stages (a Draft expense sheet cannot become Reimbursed, a registered member cannot be invited
// again), whatever a screen or a caller sends.
//
// The rule helpers next to each record (assertExpenseStatus, assertExpenseSignatureStage, enrollment-code checks) still
// run first and give the caller their precise reason. The engine is the last gate before the write.
//
//   - Expense vouchers:   Draft -> Submitted -> Approved -> Reimbursed, with Submitted -> Draft when leadership returns it.
//                         Approving a long-term asset sheet converts it into an inventory row (Sprint 6E).
//   - Budget catch-all:   approved spend and charitable gifts with no budget line of their own fall to the year's
//                         'Miscellaneous Others' line (Sprint 6E).
//   - Member onboarding:  Provisioned -> Invited (setup code) -> Registered (password set).
//   - Event tracking:     Upcoming -> In Progress -> Completed by the calendar, with the gate intake opened and closed.
//   - Budget lines:       Draft -> Proposed -> Approved; an approved version is an immutable snapshot, and a mid-year
//                         amendment adds the next version as a new row (Sprint 6D).
//   - Tenant gates:       a council's feature flags and its tenant type decide which operations may run at all
//                         (isFeatureEnabled, isFraternalExtension; Sprint 6Z-Dual-Gate-Model).
import { councilFeatureFlags, FEATURE_FLAG_LABELS, type FeatureFlagName } from './features';
import { BusinessRuleError, toIsoDate, UNREGISTERED_PASSWORD, type BusinessRuleCode } from './rules';
import { councilTenantType, TENANT_TYPES, type TenantType } from './tenant';
import type {
  BudgetLineStatus,
  CharitableRequest,
  Council,
  CouncilAssetsInventory,
  CouncilBudgetForecast,
  Event,
  EventIntakeSessionStatus,
  ExpenseLineItem,
  ExpenseReport,
  ExpenseReportStatus,
} from './types';

/** One action of a workflow: the states it may start from and the state it leads to. */
export interface WorkflowTransition<S extends string> {
  readonly from: readonly S[];
  readonly to: S;
}

export interface WorkflowDefinition<S extends string, A extends string> {
  /** Names the record in error messages, e.g. 'Expense report'. */
  readonly name: string;
  readonly states: readonly S[];
  /** The state a new record starts in. */
  readonly initial: S;
  /** States no action leaves. */
  readonly terminal: readonly S[];
  readonly transitions: Readonly<Record<A, WorkflowTransition<S>>>;
  /** The BusinessRuleCode an illegal move is rejected with. */
  readonly conflictCode: BusinessRuleCode;
}

/**
 * Checks a definition when its module loads, so a mistyped state fails at once rather than on the first write: every
 * state is unique, the initial state and every transition's states are declared, no action leaves a terminal state,
 * and every non-terminal state has an action.
 */
export function defineWorkflow<S extends string, A extends string>(def: WorkflowDefinition<S, A>): WorkflowDefinition<S, A> {
  const states = new Set<string>(def.states);
  const fail = (why: string) => {
    throw new Error(`Workflow "${def.name}" is malformed: ${why}`);
  };
  if (states.size !== def.states.length) fail('a state is listed twice.');
  if (!states.has(def.initial)) fail(`the initial state "${def.initial}" is not declared.`);
  for (const t of def.terminal) if (!states.has(t)) fail(`the terminal state "${t}" is not declared.`);
  const leaving = new Set<string>();
  for (const [action, t] of Object.entries(def.transitions) as [string, WorkflowTransition<S>][]) {
    if (!states.has(t.to)) fail(`action "${action}" leads to the undeclared state "${t.to}".`);
    if (t.from.length === 0) fail(`action "${action}" starts from no state.`);
    for (const f of t.from) {
      if (!states.has(f)) fail(`action "${action}" starts from the undeclared state "${f}".`);
      if (def.terminal.includes(f)) fail(`action "${action}" leaves the terminal state "${f}".`);
      leaving.add(f);
    }
  }
  for (const s of def.states) if (!def.terminal.includes(s) && !leaving.has(s)) fail(`the state "${s}" has no action.`);
  return Object.freeze({ ...def, transitions: Object.freeze({ ...def.transitions }) });
}

/** The value as one of the workflow's states, or null. */
export const asWorkflowState = <S extends string, A extends string>(wf: WorkflowDefinition<S, A>, value: unknown): S | null =>
  (wf.states as readonly unknown[]).includes(value) ? (value as S) : null;

/** True when `action` may run on a record in `from`. */
export function canTransition<S extends string, A extends string>(wf: WorkflowDefinition<S, A>, from: unknown, action: A): boolean {
  const state = asWorkflowState(wf, from);
  const t = wf.transitions[action];
  return state !== null && t !== undefined && t.from.includes(state);
}

/** The actions open to a record in `state`, in declaration order. */
export function availableActions<S extends string, A extends string>(wf: WorkflowDefinition<S, A>, state: unknown): A[] {
  return (Object.keys(wf.transitions) as A[]).filter((a) => canTransition(wf, state, a));
}

/**
 * The state `action` moves a record in `from` to. Rejects with the workflow's conflictCode when `from` is not one of its
 * states (a corrupt row) or the action does not start there (an illegal jump). `subject` names the record, e.g.
 * 'Expense report 12'.
 */
export function nextWorkflowState<S extends string, A extends string>(wf: WorkflowDefinition<S, A>, from: unknown, action: A, subject?: string): S {
  const who = subject ?? wf.name;
  const state = asWorkflowState(wf, from);
  if (state === null) {
    throw new BusinessRuleError(wf.conflictCode, `${who} is in the unknown state ${JSON.stringify(from)}, so nothing can change it.`, {
      workflow: wf.name,
      state: from,
      action,
    });
  }
  const t = wf.transitions[action];
  if (!t) throw new Error(`Workflow "${wf.name}" has no action "${action}".`);
  if (t.from.includes(state)) return t.to;
  throw new BusinessRuleError(
    wf.conflictCode,
    `${who} is ${state}, so it cannot ${action}; only a record that is ${t.from.join(' or ')} can.`,
    { workflow: wf.name, state, action, allowedFrom: [...t.from] },
  );
}

/** True when some action of the workflow moves a record from `from` straight to `to`. */
export const isLegalTransition = <S extends string, A extends string>(wf: WorkflowDefinition<S, A>, from: unknown, to: unknown): boolean =>
  (Object.values(wf.transitions) as WorkflowTransition<S>[]).some((t) => t.to === to && (t.from as readonly unknown[]).includes(from));

// ---- Expense vouchers ------------------------------------------------------------------------------------------------

export type ExpenseWorkflowAction = 'saveDraft' | 'submit' | 'return' | 'approve' | 'reimburse';

/**
 * ExpenseReport.Status. The member saves and submits; leadership returns a submitted sheet (it goes back to Draft and
 * its signatures are cleared) or the Grand Knight's counter-signature approves it; the disbursement check reimburses
 * it. The Financial Secretary's written order is a signature on a Submitted sheet, not a status change.
 */
export const EXPENSE_WORKFLOW = defineWorkflow<ExpenseReportStatus, ExpenseWorkflowAction>({
  name: 'Expense report',
  states: ['Draft', 'Submitted', 'Approved', 'Reimbursed'],
  initial: 'Draft',
  terminal: ['Reimbursed'],
  transitions: {
    saveDraft: { from: ['Draft'], to: 'Draft' },
    submit: { from: ['Draft'], to: 'Submitted' },
    return: { from: ['Submitted'], to: 'Draft' },
    approve: { from: ['Submitted'], to: 'Approved' },
    reimburse: { from: ['Approved'], to: 'Reimbursed' },
  },
  conflictCode: 'EXPENSE_STATUS_CONFLICT',
});

/** The Status an expense sheet takes after `action`; a new sheet (`current` null) starts as Draft. */
export const nextExpenseStatus = (current: unknown, action: ExpenseWorkflowAction, reportId?: number | null): ExpenseReportStatus =>
  nextWorkflowState(EXPENSE_WORKFLOW, current ?? EXPENSE_WORKFLOW.initial, action, reportId == null ? 'The expense report' : `Expense report ${reportId}`);

// ---- Expense-to-asset conversion (Sprint 6E) -------------------------------------------------------------------------

/** Longest CouncilAssetsInventory.asset_name (VARCHAR(255)). */
export const ASSET_NAME_MAX_LENGTH = 255;
/** CouncilAssetsInventory.current_status values; a converted asset starts ACTIVE. */
export const COUNCIL_ASSET_STATUSES = ['ACTIVE', 'DISPOSED', 'LOST'] as const;
/** The Status values a long-term asset sheet is converted on entering. */
export const EXPENSE_ASSET_CONVERSION_STATUSES: readonly ExpenseReportStatus[] = ['Approved', 'Reimbursed'];

/** A CouncilAssetsInventory row before the driver gives it an id. */
export type NewCouncilAsset = Omit<CouncilAssetsInventory, 'id'>;

/** True when the sheet carries the "This item is a long-term Council Asset" checkbox. */
export const isLongTermAssetExpense = (report: Pick<ExpenseReport, 'is_long_term_asset'>): boolean => Number(report.is_long_term_asset ?? 0) === 1;

/**
 * The conversion hook on an expense sheet's status change. A sheet marked is_long_term_asset that legally moves from
 * `from` to 'Approved' (the Grand Knight's counter-signature) becomes one inventory row, written by the driver in the
 * same transaction as the Status: asset_name from the receipts' descriptions, cost_basis their sum in exact cents,
 * purchase_date the earliest DateOfExpense, original_expense_id the sheet. A sheet reaching 'Reimbursed' without a row
 * (approved before schema 43) is converted then. Returns null when nothing is to be written: the sheet is not an asset,
 * the move is not into a conversion status or not legal, `alreadyConverted` (original_expense_id is unique), or the
 * sheet has no receipts.
 */
export function planExpenseAssetConversion(input: {
  from: unknown;
  to: ExpenseReportStatus;
  report: Pick<ExpenseReport, 'id' | 'CouncilID' | 'is_long_term_asset'>;
  lineItems: readonly Pick<ExpenseLineItem, 'DateOfExpense' | 'Amount' | 'VendorName' | 'ExpenseDescription'>[];
  alreadyConverted: boolean;
}): NewCouncilAsset | null {
  const { from, to, report, lineItems, alreadyConverted } = input;
  if (!isLongTermAssetExpense(report) || alreadyConverted || lineItems.length === 0) return null;
  if (!EXPENSE_ASSET_CONVERSION_STATUSES.includes(to) || !isLegalTransition(EXPENSE_WORKFLOW, from, to)) return null;
  const items = [...lineItems].sort((a, b) => String(a.DateOfExpense).localeCompare(String(b.DateOfExpense)));
  const descriptions = [...new Set(items.map((i) => String(i.ExpenseDescription).trim().replace(/\s+/g, ' ')).filter(Boolean))];
  const joined = descriptions.join('; ') || `Expense report ${report.id} asset`;
  const vendors = [...new Set(items.map((i) => String(i.VendorName).trim()).filter(Boolean))];
  return {
    council_id: report.CouncilID,
    asset_name: joined.length > ASSET_NAME_MAX_LENGTH ? `${joined.slice(0, ASSET_NAME_MAX_LENGTH - 1).trimEnd()}\u2026` : joined,
    purchase_date: `${String(items[0].DateOfExpense).slice(0, 10)} 00:00:00`,
    cost_basis: items.reduce((t, i) => t + Math.round(i.Amount * 100), 0) / 100,
    original_expense_id: report.id,
    current_status: 'ACTIVE',
    notes: `Converted from expense report ${report.id} when it became ${to}.${vendors.length ? ` Vendor: ${vendors.join(', ')}.` : ''}`,
  };
}

// ---- Miscellaneous budget catch-all (Sprint 6E) -----------------------------------------------------------------------

/** The Operational budget line that takes approved spend no other line claims. */
export const BUDGET_MISCELLANEOUS_LINE_NAME = 'Miscellaneous Others';

/**
 * The year's 'Miscellaneous Others' line among `lines` (an Operational line with no ReferenceSourceID, matched ignoring
 * case and spacing; the highest budget_version when several are passed), or undefined when the council has none.
 */
export function findMiscellaneousBudgetLine<T extends Pick<CouncilBudgetForecast, 'CategoryType' | 'ReferenceSourceID' | 'LineItemName' | 'budget_version'>>(
  lines: readonly T[],
): T | undefined {
  const key = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();
  return lines
    .filter((l) => l.CategoryType === 'Operational' && l.ReferenceSourceID == null && key(l.LineItemName) === key(BUDGET_MISCELLANEOUS_LINE_NAME))
    .sort((a, b) => (b.budget_version ?? 1) - (a.budget_version ?? 1))[0];
}

/**
 * The catch-all hook on a charitable request's vote. A request the council approves (VoteStatus 'Approved') with no
 * TargetBudgetLineID is tagged with the 'Miscellaneous Others' line of `yearLines` (the council's lines for the
 * fraternal year of the vote), so its check debits that line. Returns the change to store, or null when the request
 * already names a line, is not approved, or the year has no such line.
 */
export function planCharitableBudgetFallback(
  request: Pick<CharitableRequest, 'VoteStatus' | 'TargetBudgetLineID'>,
  yearLines: readonly CouncilBudgetForecast[],
): Pick<CharitableRequest, 'TargetBudgetLineID'> | null {
  if (request.VoteStatus !== 'Approved' || request.TargetBudgetLineID != null) return null;
  const line = findMiscellaneousBudgetLine(yearLines);
  return line ? { TargetBudgetLineID: line.id } : null;
}

// ---- Member onboarding -----------------------------------------------------------------------------------------------

/** Provisioned: on the roster, no password, no live setup code. Invited: a live setup code. Registered: a password. */
export type OnboardingState = 'Provisioned' | 'Invited' | 'Registered';
export type OnboardingAction = 'issueSetupCode' | 'register' | 'resetPassword';

/**
 * A member's account. Admins (or Supreme's roster sync) issue a setup code to a member who has not registered; a fresh
 * code replaces an older one. Spending the code registers the member. A registered member only ever resets the password.
 */
export const ONBOARDING_WORKFLOW = defineWorkflow<OnboardingState, OnboardingAction>({
  name: 'Member account',
  states: ['Provisioned', 'Invited', 'Registered'],
  initial: 'Provisioned',
  terminal: [],
  transitions: {
    issueSetupCode: { from: ['Provisioned', 'Invited'], to: 'Invited' },
    register: { from: ['Invited'], to: 'Registered' },
    resetPassword: { from: ['Registered'], to: 'Registered' },
  },
  conflictCode: 'ILLEGAL_STATE_TRANSITION',
});

/**
 * Where a member's account stands, read from its Credentials password and whether it holds a usable setup code
 * (isEnrollmentTokenUsable). A stored password means Registered whatever codes remain.
 */
export const memberOnboardingState = (password: string | null | undefined, hasUsableSetupCode: boolean): OnboardingState =>
  password != null && password !== UNREGISTERED_PASSWORD ? 'Registered' : hasUsableSetupCode ? 'Invited' : 'Provisioned';

/** The account state after `action`, or ILLEGAL_STATE_TRANSITION. */
export const nextOnboardingState = (current: OnboardingState, action: OnboardingAction, memberId?: number): OnboardingState =>
  nextWorkflowState(ONBOARDING_WORKFLOW, current, action, memberId === undefined ? 'The member account' : `Member ${memberId}'s account`);

// ---- Event tracking --------------------------------------------------------------------------------------------------

/** Where an event stands on the calendar: before its first day, during its days, or after its last day. */
export type EventPhase = 'Upcoming' | 'In Progress' | 'Completed';

/** The calendar moves an event along; nothing moves it back. */
export const EVENT_PHASE_WORKFLOW = defineWorkflow<EventPhase, 'begin' | 'finish'>({
  name: 'Event',
  states: ['Upcoming', 'In Progress', 'Completed'],
  initial: 'Upcoming',
  terminal: ['Completed'],
  transitions: {
    begin: { from: ['Upcoming'], to: 'In Progress' },
    finish: { from: ['Upcoming', 'In Progress'], to: 'Completed' },
  },
  conflictCode: 'ILLEGAL_STATE_TRANSITION',
});

/** The event's phase on `now`'s local date, compared with its StartDate and EndDate days. */
export function eventPhase(event: Pick<Event, 'StartDate' | 'EndDate'>, now: Date): EventPhase {
  const today = toIsoDate(now);
  const start = String(event.StartDate).slice(0, 10);
  const end = String(event.EndDate ?? event.StartDate).slice(0, 10);
  if (today < start) return 'Upcoming';
  return today > end ? 'Completed' : 'In Progress';
}

export type IntakeSessionAction = 'open' | 'close';

/**
 * Event.IntakeSessionStatus, the phone's gate intake. Opening an open session or closing a closed one is a harmless
 * repeat (two volunteers tapping at once), so each action also starts from its own end state.
 */
export const INTAKE_SESSION_WORKFLOW = defineWorkflow<EventIntakeSessionStatus, IntakeSessionAction>({
  name: 'Gate intake',
  states: ['Inactive', 'Active'],
  initial: 'Inactive',
  terminal: [],
  transitions: {
    open: { from: ['Inactive', 'Active'], to: 'Active' },
    close: { from: ['Active', 'Inactive'], to: 'Inactive' },
  },
  conflictCode: 'ILLEGAL_STATE_TRANSITION',
});

/** The IntakeSessionStatus to store when `requested` is asked for; a missing column reads as the initial Inactive. */
export const nextIntakeSessionStatus = (current: unknown, requested: EventIntakeSessionStatus, eventId?: number): EventIntakeSessionStatus =>
  nextWorkflowState(
    INTAKE_SESSION_WORKFLOW,
    current ?? INTAKE_SESSION_WORKFLOW.initial,
    requested === 'Active' ? 'open' : 'close',
    eventId === undefined ? "The event's gate intake" : `Event ${eventId}'s gate intake`,
  );

// ---- Budget line versions (Sprint 6D) ---------------------------------------------------------------------------------

export type BudgetLineAction = 'propose' | 'approve' | 'amend';

/**
 * CouncilBudgetForecast.BudgetStatus of one budget_version row. Leadership drafts a figure (propose) until the council's
 * vote approves the year (approve). An approved row is a read-only snapshot: no action rewrites it. 'amend' is the
 * council's mid-year amendment resolution: it starts from an Approved version and leads to an Approved version, but the
 * drivers store that version as a NEW row with the next budget_version (planBudgetAmendment), leaving the earlier one
 * untouched as the audit trail. assertBudgetVersionWritable is the gate every in-place write passes.
 */
export const BUDGET_LINE_WORKFLOW = defineWorkflow<BudgetLineStatus, BudgetLineAction>({
  name: 'Budget line',
  states: ['Draft', 'Proposed', 'Approved'],
  initial: 'Draft',
  terminal: [],
  transitions: {
    propose: { from: ['Draft', 'Proposed'], to: 'Proposed' },
    approve: { from: ['Draft', 'Proposed'], to: 'Approved' },
    amend: { from: ['Approved'], to: 'Approved' },
  },
  conflictCode: 'ILLEGAL_STATE_TRANSITION',
});

/** The actions that change a stored row in place; 'amend' never does (it inserts the next version). */
const IN_PLACE_BUDGET_ACTIONS: readonly BudgetLineAction[] = ['propose', 'approve'];

const budgetLineSubject = (line: Pick<CouncilBudgetForecast, 'id' | 'budget_version'>) =>
  `Budget line ${line.id} (version ${line.budget_version ?? 1})`;

/**
 * The BudgetStatus a row takes when `action` rewrites it in place. An Approved version is immutable, so 'propose' and
 * 'approve' on it reject ILLEGAL_STATE_TRANSITION (the drivers' assertBudgetYearNotApproved runs first and gives callers
 * BUDGET_YEAR_APPROVED). 'amend' is refused here: an amendment is a new row (nextBudgetVersionStatus).
 */
export function nextBudgetLineStatus(line: Pick<CouncilBudgetForecast, 'id' | 'BudgetStatus' | 'budget_version'>, action: BudgetLineAction): BudgetLineStatus {
  if (!IN_PLACE_BUDGET_ACTIONS.includes(action)) throw new Error(`Budget line action "${action}" never rewrites a row; it adds a version.`);
  return nextWorkflowState(BUDGET_LINE_WORKFLOW, line.BudgetStatus, action, budgetLineSubject(line));
}

/** The status of the version an amendment adds on top of `line`; rejects ILLEGAL_STATE_TRANSITION unless it is Approved. */
export const nextBudgetVersionStatus = (line: Pick<CouncilBudgetForecast, 'id' | 'BudgetStatus' | 'budget_version'>): BudgetLineStatus =>
  nextWorkflowState(BUDGET_LINE_WORKFLOW, line.BudgetStatus, 'amend', budgetLineSubject(line));

/** True while the row may still be changed in place: it is not yet an approved snapshot. */
export const isBudgetVersionWritable = (line: Pick<CouncilBudgetForecast, 'BudgetStatus'>): boolean =>
  canTransition(BUDGET_LINE_WORKFLOW, line.BudgetStatus, 'propose');

// ---- Tenant gates (Sprint 6Z-Dual-Gate-Model) ------------------------------------------------------------------------
//
// Two gates stand in front of every module. The feature gate is a council's on/off switch for one module (features.ts);
// the tenant gate is its tenant type (tenant.ts), which keeps the fraternal extensions to Knights of Columbus councils.
// Each is declared as a workflow, so the guards ask canTransition whether the operation may run from the council's
// current state, exactly as a record's status is checked before a write.

/** A council row as the gates read it: its id, its tenant type and its feature flags. Missing columns read as defaults. */
export type GateCouncil = Partial<Pick<Council, 'tenant_type' | FeatureFlagName>> & { id: number };

/** A module behind its feature flag: in use while On; a Super Admin switches it between On and Off. */
export type FeatureGateState = 'On' | 'Off';
export const FEATURE_GATE_WORKFLOW = defineWorkflow<FeatureGateState, 'use' | 'switchOn' | 'switchOff'>({
  name: 'Feature',
  states: ['On', 'Off'],
  initial: 'On',
  terminal: [],
  transitions: {
    use: { from: ['On'], to: 'On' },
    switchOn: { from: ['Off', 'On'], to: 'On' },
    switchOff: { from: ['On', 'Off'], to: 'Off' },
  },
  conflictCode: 'FEATURE_DISABLED',
});

/**
 * The council's tenant: a fraternal operation runs only for a Knights of Columbus council. A council is white-labelled
 * or restored by changing its tenant_type; core operations are open to both and pass no tenant gate.
 */
export const TENANT_GATE_WORKFLOW = defineWorkflow<TenantType, 'runFraternal' | 'whiteLabel' | 'restoreFraternal'>({
  name: 'Tenant',
  states: TENANT_TYPES,
  initial: 'KOFC',
  terminal: [],
  transitions: {
    runFraternal: { from: ['KOFC'], to: 'KOFC' },
    whiteLabel: { from: ['KOFC', 'GENERIC'], to: 'GENERIC' },
    restoreFraternal: { from: ['GENERIC', 'KOFC'], to: 'KOFC' },
  },
  conflictCode: 'FRATERNAL_EXTENSION_REQUIRED',
});

/**
 * The council rows the clients have loaded, by id, so a guard can be asked about a council id alone. The web session and
 * the phone app register the signed-in member's council when it loads (registerCouncilGates); drivers, which read the
 * row themselves, pass it to the guard instead.
 */
const gateRegistry = new Map<number, GateCouncil>();

/** Records (or refreshes) a loaded council row for the id-only guards. Ignores a missing row. */
export function registerCouncilGates(council: GateCouncil | null | undefined): void {
  if (council && Number.isInteger(council.id)) gateRegistry.set(council.id, { ...council });
}

/** Forgets every registered council (sign-out, tests). */
export function clearCouncilGates(): void {
  gateRegistry.clear();
}

/** The row a guard reads: the one passed in, else the registered one, else null (every default applies). */
const gateCouncil = (councilId: number, council: GateCouncil | null | undefined): GateCouncil | null =>
  council ?? gateRegistry.get(councilId) ?? null;

/** The feature gate's state for one flag of the council. */
export const featureGateState = (councilId: number, flagName: FeatureFlagName, council?: GateCouncil | null): FeatureGateState =>
  councilFeatureFlags(gateCouncil(councilId, council))[flagName] ? 'On' : 'Off';

/**
 * Whether the council's `flagName` module is switched on. A council that is neither passed nor registered reads as
 * every module on, as councilFeatureFlags reads a missing column, so an unloaded council never locks the apps.
 */
export const isFeatureEnabled = (councilId: number, flagName: FeatureFlagName, council?: GateCouncil | null): boolean =>
  canTransition(FEATURE_GATE_WORKFLOW, featureGateState(councilId, flagName, council), 'use');

/** Rejects FEATURE_DISABLED when the council has switched the `flagName` module off. */
export function assertFeatureEnabled(councilId: number, flagName: FeatureFlagName, council?: GateCouncil | null): void {
  if (isFeatureEnabled(councilId, flagName, council)) return;
  const { label } = FEATURE_FLAG_LABELS[flagName];
  throw new BusinessRuleError('FEATURE_DISABLED', `Council ${councilId} has switched ${label} off, so it cannot be used.`, {
    councilId,
    flag: flagName,
  });
}

/**
 * Whether the council is a Knights of Columbus council (tenant_type 'KOFC'), the only tenant whose fraternal extensions
 * run. A council that is neither passed nor registered reads as 'KOFC', the column's default.
 */
export const isFraternalExtension = (councilId: number, council?: GateCouncil | null): boolean =>
  canTransition(TENANT_GATE_WORKFLOW, councilTenantType(gateCouncil(councilId, council)), 'runFraternal');

/**
 * Rejects FRATERNAL_EXTENSION_REQUIRED when the council is a white-label tenant. `operation` names what was attempted,
 * e.g. 'file a Supreme Council report'.
 */
export function assertFraternalExtension(councilId: number, operation: string, council?: GateCouncil | null): void {
  if (isFraternalExtension(councilId, council)) return;
  const tenant = councilTenantType(gateCouncil(councilId, council));
  throw new BusinessRuleError(
    'FRATERNAL_EXTENSION_REQUIRED',
    `Council ${councilId} is not a Knights of Columbus council, so it cannot ${operation}.`,
    { councilId, tenantType: tenant, operation },
  );
}
