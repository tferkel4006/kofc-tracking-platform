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
//   - Member onboarding:  Provisioned -> Invited (setup code) -> Registered (password set).
//   - Event tracking:     Upcoming -> In Progress -> Completed by the calendar, with the gate intake opened and closed.
import { BusinessRuleError, toIsoDate, UNREGISTERED_PASSWORD, type BusinessRuleCode } from './rules';
import type { Event, EventIntakeSessionStatus, ExpenseReportStatus } from './types';

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
