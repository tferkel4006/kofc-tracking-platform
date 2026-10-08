// =========================================================================
// ANNUAL BUDGET FORECASTING (Sprint 5Y)
// Pure helpers behind the budget.* service methods: fraternal year labels and
// bounds, line validation, the forecast order, and the pre-population plan
// that turns last year's actual spend into next year's lines. Drivers load
// rows already scoped to one council, call these, then only store. Who may
// act is decided in rules.ts (assertMayViewBudgetForecast, assertMayManageBudgetForecast, assertMayApproveBudget,
// assertMayReviewBudgetPerformance). Sprint 5Y-4 adds the Draft -> Proposed -> Approved lifecycle and the
// budget-versus-actual performance figures behind the dashboard gauges and the historical KPIs. Sprint 6D adds
// quantity x unit_cost estimates and the budget_version snapshots of mid-year amendments (currentBudgetLines).
// =========================================================================
import type {
  BudgetCategoryPerformance,
  BudgetLineAmendment,
  BudgetHistoricalKPIs,
  BudgetLinePerformance,
  BudgetWriteOptions,
  BudgetPriorYearBaselines,
  BudgetYearPerformance,
  NewCustomBudgetLine,
} from './contract';
import { assertMoney, assertText, BusinessRuleError, hasSuperAdminRights, toIsoDate, type MemberWriteActor } from './rules';
import type { BudgetCategoryType, BudgetLineStatus, CouncilBudgetCategory, CouncilBudgetForecast } from './types';
import { nextBudgetLineStatus, nextBudgetVersionStatus } from './workflow';

/** CouncilBudgetForecast.CategoryType values, in the order a forecast lists them. */
export const BUDGET_CATEGORY_TYPES: readonly BudgetCategoryType[] = ['Event', 'Donation', 'Operational'];
/** Longest CouncilBudgetForecast.LineItemName (VARCHAR(255)). */
export const BUDGET_LINE_NAME_MAX_LENGTH = 255;
/** Longest CouncilBudgetForecast.Notes; the column is TEXT, the cap keeps a line readable. */
export const BUDGET_NOTES_MAX_LENGTH = 2000;
/** The Operational line prePopulateNextYear seeds from the expenses of the council's meetings. */
export const BUDGET_MEETINGS_LINE_NAME = 'Council Meetings';

const invalid = (message: string, details: Record<string, unknown> = {}) => new BusinessRuleError('INVALID_INPUT', message, details);

const cents = (value: number | null | undefined) => Math.round((value ?? 0) * 100);
const sumCents = (values: readonly (number | null | undefined)[]) => values.reduce<number>((t, v) => t + cents(v), 0) / 100;

/** LineItemName compared ignoring case and runs of spaces, so 'Office  Supplies' and 'office supplies' are one line. */
const lineKey = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();

// ---- fraternal years ---------------------------------------------------------

/** A fraternal year label, 'YYYY-YYYY' with consecutive years (the Order dates from 1882). */
export function assertFraternalYear(value: unknown, label = 'Fraternal year'): string {
  const m = typeof value === 'string' ? /^(\d{4})-(\d{4})$/.exec(value.trim()) : null;
  if (!m || Number(m[2]) !== Number(m[1]) + 1 || Number(m[1]) < 1882) {
    throw invalid(`${label} must be two consecutive years, as 2027-2028; received ${JSON.stringify(value)}.`, { label, value });
  }
  return `${m[1]}-${m[2]}`;
}

/** The fraternal year before `fraternalYear`: '2027-2028' -> '2026-2027'. */
export function previousFraternalYear(fraternalYear: string): string {
  const start = Number(assertFraternalYear(fraternalYear).slice(0, 4));
  return `${start - 1}-${start}`;
}

/** The first and last day of a fraternal year: July 1 through June 30, as YYYY-MM-DD. */
export function fraternalYearBounds(fraternalYear: string): { fromDate: string; toDate: string } {
  const start = Number(assertFraternalYear(fraternalYear).slice(0, 4));
  return { fromDate: `${start}-07-01`, toDate: `${start + 1}-06-30` };
}

// ---- validation --------------------------------------------------------------

function optionalNotes(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const text = assertText(value, 'Notes', BUDGET_NOTES_MAX_LENGTH, false);
  return text === '' ? null : text;
}

/**
 * The stored fields of a budget.addCustomBudgetLine line, validated. Rejects unknown fields, including
 * ApprovedBudgetAmount: a new line records its figure as proposed (Sprint 5Y-4), and only the council's approval sets
 * the approved figure.
 */
export function cleanCustomBudgetLine(input: NewCustomBudgetLine): Pick<
  CouncilBudgetForecast,
  'FraternalYear' | 'LineItemName' | 'ProposedBudgetAmount'
> & { Notes: string | null; BudgetCategoryID: number | null } {
  if (typeof input !== 'object' || input === null) throw invalid('Budget line details are required.');
  const allowed = ['FraternalYear', 'LineItemName', 'ProposedBudgetAmount', 'Notes', 'BudgetCategoryID'];
  for (const key of Object.keys(input)) {
    if (!allowed.includes(key)) throw invalid(`A custom budget line has no field "${key}"; its fields are ${allowed.join(', ')}.`, { field: key });
  }
  const category = input.BudgetCategoryID;
  if (category != null && !(typeof category === 'number' && Number.isInteger(category) && category > 0)) {
    throw invalid(`Budget category must be a record id; received ${JSON.stringify(category)}.`, { field: 'BudgetCategoryID' });
  }
  return {
    FraternalYear: assertFraternalYear(input.FraternalYear),
    LineItemName: assertText(input.LineItemName, 'Line item name', BUDGET_LINE_NAME_MAX_LENGTH).replace(/\s+/g, ' '),
    ProposedBudgetAmount: input.ProposedBudgetAmount == null ? 0 : assertMoney(input.ProposedBudgetAmount, 'Proposed budget amount'),
    Notes: optionalNotes(input.Notes),
    BudgetCategoryID: category ?? null,
  };
}

/**
 * budget.updateLineItemBudget's changes: the proposed figure, and the line becomes 'Proposed' (Sprint 5Y-4). `notes`
 * undefined leaves Notes alone; blank or null clears them.
 */
export function cleanBudgetLineUpdate(
  proposedAmount: unknown,
  notes: unknown,
): Pick<CouncilBudgetForecast, 'ProposedBudgetAmount' | 'BudgetStatus'> & { Notes?: string | null } {
  const changes: Pick<CouncilBudgetForecast, 'ProposedBudgetAmount' | 'BudgetStatus'> & { Notes?: string | null } = {
    ProposedBudgetAmount: assertMoney(proposedAmount, 'Proposed budget amount'),
    BudgetStatus: 'Proposed',
  };
  if (notes !== undefined) changes.Notes = optionalNotes(notes);
  return changes;
}

export const budgetLineNotFound = (budgetLineItemId: number) =>
  new BusinessRuleError('RECORD_NOT_FOUND', `No budget line with id ${budgetLineItemId}.`, { budgetLineItemId });

export const budgetLineExists = (line: Pick<CouncilBudgetForecast, 'id' | 'LineItemName' | 'FraternalYear'>) =>
  new BusinessRuleError('BUDGET_LINE_EXISTS', `The ${line.FraternalYear} budget already has a line named "${line.LineItemName}".`, {
    lineId: line.id,
    fraternalYear: line.FraternalYear,
  });

/** The council year's Operational line named `name` (ignoring case and spacing), if any. */
export function findOperationalBudgetLine(
  lines: readonly CouncilBudgetForecast[],
  name: string,
): CouncilBudgetForecast | undefined {
  const key = lineKey(name);
  return lines.find((l) => l.CategoryType === 'Operational' && l.ReferenceSourceID == null && lineKey(l.LineItemName) === key);
}

/** budget.listAnnualForecast order: Event, Donation, Operational; then LineItemName A-Z ignoring case; then id. */
export function sortBudgetLines<T extends Pick<CouncilBudgetForecast, 'CategoryType' | 'LineItemName'> & { id?: number }>(
  lines: readonly T[],
): T[] {
  const rank = (c: BudgetCategoryType) => BUDGET_CATEGORY_TYPES.indexOf(c);
  return [...lines].sort(
    (a, b) =>
      rank(a.CategoryType) - rank(b.CategoryType) ||
      a.LineItemName.localeCompare(b.LineItemName, undefined, { sensitivity: 'base' }) ||
      (a.id ?? 0) - (b.id ?? 0),
  );
}

// ---- pre-population ------------------------------------------------------------

/**
 * The previous fraternal year's actual spend for one council, as the drivers load it. Every list is already limited to
 * the council and the year; "expense lines" are line items of the council's 'Approved' and 'Reimbursed' sheets.
 */
export interface BudgetActuals {
  /** The council's IsAnnual events that started in the year. */
  annualEvents: readonly { id: number; EventName: string }[];
  /** Expense lines on sheets linked to those events. */
  eventExpenses: readonly { EventID: number; Amount: number }[];
  /** The council's checks paid in the year to IsAnnual charities. */
  annualCharityChecks: readonly { CharityID: number; Name: string; Amount: number }[];
  /** How many meetings the council held in the year. */
  meetingCount: number;
  /** Expense lines on sheets linked to those meetings. */
  meetingExpenses: readonly { Amount: number }[];
  /**
   * That year's own forecast lines, in id order: its custom Operational lines are carried forward by name (Sprint
   * 5Y-2) at their ApprovedBudgetAmount (Sprint 5Y-6.5), and every line passes its BudgetCategoryID on to the line that
   * continues it (Sprint 5Y-3).
   */
  priorLines: readonly Pick<CouncilBudgetForecast, 'CategoryType' | 'ReferenceSourceID' | 'LineItemName' | 'BudgetCategoryID' | 'ApprovedBudgetAmount'>[];
}

/** One line prePopulateNextYear wants in the new year. */
export type BudgetSeed = Pick<CouncilBudgetForecast, 'CategoryType' | 'LineItemName' | 'PrePopulatedAmount'> & {
  ReferenceSourceID: number | null;
  /** The category of the previous year's line this one continues, or null. */
  BudgetCategoryID: number | null;
};

/**
 * The previous year's line a seed continues: the same charity for a Donation line (charities keep their id from year
 * to year), otherwise the same category type and name ignoring case (each year's event is a new Event row).
 */
function priorLineOf<T extends BudgetActuals['priorLines'][number]>(
  seed: Pick<BudgetSeed, 'CategoryType' | 'ReferenceSourceID' | 'LineItemName'> | Pick<CouncilBudgetForecast, 'CategoryType' | 'ReferenceSourceID' | 'LineItemName'>,
  priorLines: readonly T[],
): T | undefined {
  if (seed.CategoryType === 'Donation') return priorLines.find((l) => l.CategoryType === 'Donation' && l.ReferenceSourceID === seed.ReferenceSourceID);
  return priorLines.find((l) => l.CategoryType === seed.CategoryType && lineKey(l.LineItemName) === lineKey(seed.LineItemName));
}

/**
 * The lines last year's actuals call for: one per annual event (the sum of its 'Approved' and 'Reimbursed' expense
 * lines - Event.Spend is never read, Sprint 6B), one per annual charity
 * (the sum of its checks), the meetings line when the council met, and each of last year's custom Operational lines
 * again under the same name. Custom lines have no spend to read, so their baseline is last year's approved cap, its
 * ApprovedBudgetAmount (Sprint 5Y-6.5; 0 when last year was never approved). Each keeps the category of the previous
 * year's line it continues. In listAnnualForecast order.
 */
export function planBudgetPrePopulation(actuals: BudgetActuals): BudgetSeed[] {
  const seeds: Omit<BudgetSeed, 'BudgetCategoryID'>[] = actuals.annualEvents.map((e) => ({
    CategoryType: 'Event',
    ReferenceSourceID: e.id,
    LineItemName: e.EventName,
    PrePopulatedAmount: sumCents(actuals.eventExpenses.filter((x) => x.EventID === e.id).map((x) => x.Amount)),
  }));
  const charities = new Map<number, { name: string; amounts: number[] }>();
  for (const check of actuals.annualCharityChecks) {
    const entry = charities.get(check.CharityID) ?? { name: check.Name, amounts: [] };
    entry.amounts.push(check.Amount);
    charities.set(check.CharityID, entry);
  }
  for (const [charityId, { name, amounts }] of charities) {
    seeds.push({ CategoryType: 'Donation', ReferenceSourceID: charityId, LineItemName: name, PrePopulatedAmount: sumCents(amounts) });
  }
  if (actuals.meetingCount > 0) {
    seeds.push({
      CategoryType: 'Operational',
      ReferenceSourceID: null,
      LineItemName: BUDGET_MEETINGS_LINE_NAME,
      PrePopulatedAmount: sumCents(actuals.meetingExpenses.map((x) => x.Amount)),
    });
  }
  // The meetings line is re-read from actuals above, so only the officers' own lines are carried, once per name.
  const carried = new Set([lineKey(BUDGET_MEETINGS_LINE_NAME)]);
  for (const { CategoryType, ReferenceSourceID, LineItemName, ApprovedBudgetAmount } of actuals.priorLines) {
    if (CategoryType !== 'Operational' || ReferenceSourceID != null || carried.has(lineKey(LineItemName))) continue;
    carried.add(lineKey(LineItemName));
    seeds.push({ CategoryType: 'Operational', ReferenceSourceID: null, LineItemName, PrePopulatedAmount: sumCents([ApprovedBudgetAmount]) });
  }
  return sortBudgetLines(seeds.map((seed) => ({ ...seed, BudgetCategoryID: priorLineOf(seed, actuals.priorLines)?.BudgetCategoryID ?? null })));
}

/** A line prePopulateNextYear refreshes in place. */
export type BudgetLineRefresh = Pick<CouncilBudgetForecast, 'id' | 'LineItemName' | 'PrePopulatedAmount'>;

/**
 * How `seeds` land on the council year's `existing` lines: a seed matching a line (same category and source, or for an
 * unsourced line the same name ignoring case) refreshes that line's PrePopulatedAmount and LineItemName; the others are
 * inserted. The proposed and approved figures, BudgetStatus, Notes and BudgetCategoryID of existing lines are never part
 * of the plan, and no line is removed.
 */
export function mergeBudgetSeeds(
  existing: readonly CouncilBudgetForecast[],
  seeds: readonly BudgetSeed[],
): { inserts: BudgetSeed[]; updates: BudgetLineRefresh[] } {
  const inserts: BudgetSeed[] = [];
  const updates: BudgetLineRefresh[] = [];
  for (const seed of seeds) {
    const match =
      seed.ReferenceSourceID === null
        ? existing.find((l) => l.CategoryType === seed.CategoryType && l.ReferenceSourceID == null && lineKey(l.LineItemName) === lineKey(seed.LineItemName))
        : existing.find((l) => l.CategoryType === seed.CategoryType && l.ReferenceSourceID === seed.ReferenceSourceID);
    if (!match) {
      inserts.push(seed);
      continue;
    }
    // A sourced line follows its event's or charity's current name; an unsourced line keeps the name it was given.
    const LineItemName = seed.ReferenceSourceID === null ? match.LineItemName : seed.LineItemName;
    updates.push({ id: match.id, LineItemName, PrePopulatedAmount: seed.PrePopulatedAmount });
  }
  return { inserts, updates };
}

// ---- the May-June drafting window and the July 1 lock (Sprint 5Y-2, 5Y-3, 5Y-3.5) ----------

/**
 * Where a fraternal year's budget stands on a given day: prepared from May 1 through June 30 before the year starts
 * ('Draft'), locked as 'Finalized' from July 1 when the year begins, and 'Not Yet Open' before May 1.
 */
export type BudgetWindowState = 'Not Yet Open' | 'Draft' | 'Finalized';

/** The month (0-based: May) the drafting window opens, on its 1st at 00:00 local time (Sprint 5Y-3.5). */
export const BUDGET_DRAFT_OPENS_MONTH = 4;
/** The month (0-based: July) the budget locks as Finalized, on its 1st at 00:00 local time: the window ends at midnight June 30. */
export const BUDGET_FINALIZED_MONTH = 6;

/** budgetWindowOf for `fraternalYear` on `today`: Draft May 1 - June 30 of its first year, Finalized from July 1. */
export function budgetWindowOf(fraternalYear: string, today: Date): BudgetWindowState {
  const start = Number(assertFraternalYear(fraternalYear).slice(0, 4));
  const opens = new Date(start, BUDGET_DRAFT_OPENS_MONTH, 1);
  const locks = new Date(start, BUDGET_FINALIZED_MONTH, 1);
  if (today >= locks) return 'Finalized';
  return today >= opens ? 'Draft' : 'Not Yet Open';
}

/** The fraternal year whose budget is prepared next: the one starting this July 1, or next year's once July has come. */
export function upcomingFraternalYear(today: Date): string {
  const start = today.getMonth() >= BUDGET_FINALIZED_MONTH ? today.getFullYear() + 1 : today.getFullYear();
  return `${start}-${start + 1}`;
}

/**
 * The data layer's drafting window (Sprint 5Y-3, recalibrated in 5Y-3.5): budget writes are accepted only while the year
 * is 'Draft' - May 1 00:00 through June 30 midnight, local time. Before May 1 a write rejects BUDGET_WINDOW_NOT_OPEN,
 * from July 1 BUDGET_YEAR_FINALIZED, unless an Active Super Admin passes superAdminOverride (anyone else's is ignored).
 */
export function assertBudgetYearWritable(fraternalYear: string, today: Date, actor: MemberWriteActor, options: BudgetWriteOptions = {}): void {
  const state = budgetWindowOf(fraternalYear, today);
  if (state === 'Draft') return;
  if (options.superAdminOverride === true && hasSuperAdminRights(actor)) return;
  const start = fraternalYear.slice(0, 4);
  if (state === 'Finalized') {
    throw new BusinessRuleError(
      'BUDGET_YEAR_FINALIZED',
      `The ${fraternalYear} budget was locked as Finalized on July 1, ${start}; it can no longer be changed.`,
      { fraternalYear },
    );
  }
  throw new BusinessRuleError(
    'BUDGET_WINDOW_NOT_OPEN',
    `The ${fraternalYear} budget opens for drafting on May 1, ${start}; it cannot be changed before then.`,
    { fraternalYear },
  );
}

// ---- council budget categories (Sprint 5Y-3) ----------------------------------------

/** Longest CouncilBudgetCategory.CategoryName (VARCHAR(255)). */
export const BUDGET_CATEGORY_NAME_MAX_LENGTH = 255;

/** A council lookup record of CouncilBudgetCategory, validated. */
export function cleanBudgetCategory(input: { CategoryName?: unknown }): { CategoryName: string } {
  for (const key of Object.keys(input)) {
    if (key !== 'CategoryName') throw invalid(`A budget category has no field "${key}"; its field is CategoryName.`, { field: key });
  }
  return { CategoryName: assertText(input.CategoryName ?? '', 'Budget category', BUDGET_CATEGORY_NAME_MAX_LENGTH).replace(/\s+/g, ' ') };
}

/**
 * A BudgetCategoryID a write names: undefined (leave it) and null (uncategorized) pass through; an id must be one of
 * `categories`, the council's own.
 */
export function assertCouncilBudgetCategory(
  categoryId: unknown,
  categories: readonly Pick<CouncilBudgetCategory, 'id'>[],
  councilId: number,
): number | null | undefined {
  if (categoryId === undefined || categoryId === null) return categoryId;
  if (typeof categoryId === 'number' && categories.some((c) => c.id === categoryId)) return categoryId;
  throw invalid(`Budget category ${JSON.stringify(categoryId)} is not one of council ${councilId}'s budget categories.`, { categoryId, councilId });
}

/** One category's lines with their subtotals, to the cent; `category` null holds the uncategorized lines. */
export interface BudgetCategoryGroup<T extends CouncilBudgetForecast = CouncilBudgetForecast> {
  category: CouncilBudgetCategory | null;
  label: string;
  lines: T[];
  prePopulatedTotal: number;
  /** Sprint 5Y-4. */
  proposedTotal: number;
  approvedTotal: number;
}

/** The heading of the group for lines no category claims. */
export const UNCATEGORIZED_BUDGET_LABEL = 'Uncategorized';

/**
 * Every one of the council's categories in the order given (empty ones included), each holding its lines in
 * listAnnualForecast order, then an 'Uncategorized' group when any line has no category (or one not in `categories`).
 */
export function groupBudgetByCategory<T extends CouncilBudgetForecast>(
  lines: readonly T[],
  categories: readonly CouncilBudgetCategory[],
): BudgetCategoryGroup<T>[] {
  const group = (category: CouncilBudgetCategory | null, label: string, mine: readonly T[]): BudgetCategoryGroup<T> => ({
    category,
    label,
    lines: sortBudgetLines(mine),
    prePopulatedTotal: sumCents(mine.map((l) => l.PrePopulatedAmount)),
    proposedTotal: sumCents(mine.map((l) => l.ProposedBudgetAmount)),
    approvedTotal: sumCents(mine.map((l) => l.ApprovedBudgetAmount)),
  });
  const known = new Set(categories.map((c) => c.id));
  const groups = categories.map((c) => group(c, c.CategoryName, lines.filter((l) => l.BudgetCategoryID === c.id)));
  const loose = lines.filter((l) => l.BudgetCategoryID == null || !known.has(l.BudgetCategoryID));
  if (loose.length > 0) groups.push(group(null, UNCATEGORIZED_BUDGET_LABEL, loose));
  return groups;
}

/** Adds budget amounts to the cent. */
export const sumBudgetAmounts = (amounts: readonly number[]): number => sumCents(amounts);

// ---- the budget lifecycle: Draft -> Proposed -> Approved (Sprint 5Y-4) ------------------------------

/** CouncilBudgetForecast.BudgetStatus values, in lifecycle order. */
export const BUDGET_LINE_STATUSES: readonly BudgetLineStatus[] = ['Draft', 'Proposed', 'Approved'];

/**
 * Where a council's year stands in the lifecycle: 'Approved' once the council's vote finalized it (every line is
 * approved together, and no line can be added afterwards), 'Proposed' once any figure has been drafted, otherwise
 * 'Draft' (including a year with no lines).
 */
export function budgetStatusOf(lines: readonly Pick<CouncilBudgetForecast, 'BudgetStatus'>[]): BudgetLineStatus {
  if (lines.some((l) => l.BudgetStatus === 'Approved')) return 'Approved';
  return lines.some((l) => l.BudgetStatus === 'Proposed') ? 'Proposed' : 'Draft';
}

/**
 * An approved year is frozen: every budget write to it rejects BUDGET_YEAR_APPROVED, and no override lifts this - not
 * even a Super Admin's. `lines` are the council's lines for the year.
 */
export function assertBudgetYearNotApproved(fraternalYear: string, lines: readonly Pick<CouncilBudgetForecast, 'BudgetStatus'>[]): void {
  if (budgetStatusOf(lines) !== 'Approved') return;
  throw new BusinessRuleError(
    'BUDGET_YEAR_APPROVED',
    `The ${fraternalYear} budget was approved and finalized by the council; its figures are frozen.`,
    { fraternalYear },
  );
}

/**
 * budget.approveAndFinalizeEntireBudget's checks on the year: it must not already be approved (BUDGET_YEAR_APPROVED),
 * must have lines to approve (INVALID_INPUT), and must have opened for drafting on May 1 (BUDGET_WINDOW_NOT_OPEN,
 * lifted by an Active Super Admin's override as elsewhere). The vote may be recorded during the drafting window or
 * after the July 1 lock - usually at the council's July meeting.
 */
export function assertBudgetYearApprovable(
  fraternalYear: string,
  lines: readonly Pick<CouncilBudgetForecast, 'BudgetStatus'>[],
  today: Date,
  actor: MemberWriteActor,
  options: BudgetWriteOptions = {},
): void {
  assertBudgetYearNotApproved(fraternalYear, lines);
  if (lines.length === 0) throw invalid(`The ${fraternalYear} budget has no lines to approve.`, { fraternalYear });
  if (budgetWindowOf(fraternalYear, today) !== 'Not Yet Open') return;
  if (options.superAdminOverride === true && hasSuperAdminRights(actor)) return;
  throw new BusinessRuleError(
    'BUDGET_WINDOW_NOT_OPEN',
    `The ${fraternalYear} budget opens for drafting on May 1, ${fraternalYear.slice(0, 4)}; it cannot be approved before then.`,
    { fraternalYear },
  );
}

/** What approval stores on each line: its proposed figure becomes the approved figure, and the line is 'Approved'. */
export function planBudgetApproval(
  lines: readonly (Pick<CouncilBudgetForecast, 'id' | 'ProposedBudgetAmount'> & Partial<Pick<CouncilBudgetForecast, 'BudgetStatus' | 'budget_version'>>)[],
): Pick<CouncilBudgetForecast, 'id' | 'ApprovedBudgetAmount' | 'BudgetStatus'>[] {
  // Sprint 6D: a stored row moves through BUDGET_LINE_WORKFLOW, so an approved snapshot can never be approved again.
  return lines.map((l) => ({
    id: l.id,
    ApprovedBudgetAmount: cents(l.ProposedBudgetAmount) / 100,
    BudgetStatus: l.BudgetStatus === undefined ? 'Approved' : nextBudgetLineStatus({ id: l.id, BudgetStatus: l.BudgetStatus, budget_version: l.budget_version }, 'approve'),
  }));
}

// ---- quantity x unit cost estimates and approved versions (Sprint 6D) -----------------------------------------------

/** The most occurrences one line may pay for. */
export const BUDGET_QUANTITY_MAX = 999;

/** A line's quantity (a missing or bad value reads as 1), unit cost (0) and version (1), as the columns' defaults. */
export const budgetLineQuantity = (line: Pick<CouncilBudgetForecast, 'quantity'>): number =>
  Number.isInteger(line.quantity) && (line.quantity as number) >= 1 ? (line.quantity as number) : 1;
export const budgetLineUnitCost = (line: Pick<CouncilBudgetForecast, 'unit_cost'>): number =>
  line.unit_cost != null && Number.isFinite(line.unit_cost) && line.unit_cost > 0 ? cents(line.unit_cost) / 100 : 0;
export const budgetLineVersion = (line: Pick<CouncilBudgetForecast, 'budget_version'>): number =>
  Number.isInteger(line.budget_version) && (line.budget_version as number) >= 1 ? (line.budget_version as number) : 1;

/** A line's count of occurrences: a whole number from 1 to BUDGET_QUANTITY_MAX. Rejects INVALID_INPUT otherwise. */
export function assertBudgetQuantity(value: unknown): number {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= BUDGET_QUANTITY_MAX) return value;
  throw invalid(`Quantity must be a whole number from 1 to ${BUDGET_QUANTITY_MAX}; received ${String(value)}.`, { field: 'quantity', value });
}

/** quantity x unit cost in whole cents. */
export const budgetLineEstimate = (quantity: number, unitCost: number): number => (quantity * cents(unitCost)) / 100;

/**
 * budget.setLineQuantityAndUnitCost's changes: the quantity, the unit cost, and the proposed figure they make
 * (quantity x unit cost). A unit cost of 0 is allowed and proposes 0.
 */
export function cleanLineQuantityAndUnitCost(
  quantity: unknown,
  unitCost: unknown,
): Required<Pick<CouncilBudgetForecast, 'quantity' | 'unit_cost'>> & Pick<CouncilBudgetForecast, 'ProposedBudgetAmount'> {
  const q = assertBudgetQuantity(quantity);
  const unit = assertMoney(unitCost, 'Unit cost');
  return { quantity: q, unit_cost: unit, ProposedBudgetAmount: budgetLineEstimate(q, unit) };
}

/**
 * The unit_cost a lump-sum update (budget.updateLineItemBudget) leaves on the line: kept while quantity x unit cost still
 * equals the new figure, otherwise cleared to 0 so the figure is split evenly over the quantity instead.
 */
export const unitCostAfterLumpSum = (line: Pick<CouncilBudgetForecast, 'quantity' | 'unit_cost'>, amount: number): number => {
  const unit = budgetLineUnitCost(line);
  return unit > 0 && cents(budgetLineEstimate(budgetLineQuantity(line), unit)) === cents(amount) ? unit : 0;
};

/** One line's identity across its versions: council, year, category type, source and name (ignoring case and spacing). */
export const budgetLineIdentity = (
  line: Pick<CouncilBudgetForecast, 'CouncilID' | 'FraternalYear' | 'CategoryType' | 'ReferenceSourceID' | 'LineItemName'>,
): string => [line.CouncilID, line.FraternalYear, line.CategoryType, line.ReferenceSourceID ?? '', lineKey(line.LineItemName)].join('|');

/**
 * Each line's highest budget_version, in the order given: what every budget reader counts. Earlier versions of an
 * amended line are its audit trail (budget.listLineVersions) and never enter a figure.
 */
export function currentBudgetLines<T extends CouncilBudgetForecast>(lines: readonly T[]): T[] {
  const latest = new Map<string, T>();
  for (const l of lines) {
    const key = budgetLineIdentity(l);
    const held = latest.get(key);
    if (!held || budgetLineVersion(l) > budgetLineVersion(held)) latest.set(key, l);
  }
  const keep = new Set(latest.values());
  return lines.filter((l) => keep.has(l));
}

/** Every version of `line` among `lines`, oldest first. */
export const budgetLineVersions = <T extends CouncilBudgetForecast>(lines: readonly T[], line: CouncilBudgetForecast): T[] =>
  lines
    .filter((l) => budgetLineIdentity(l) === budgetLineIdentity(line))
    .sort((a, b) => budgetLineVersion(a) - budgetLineVersion(b) || a.id - b.id);

/**
 * budget.amendApprovedLine's checks on the version being amended and its year:
 * - it must be the line's latest version (BUDGET_VERSION_SUPERSEDED; details.currentLineId names the latest);
 * - it must be an approved snapshot (BUDGET_LINE_WORKFLOW 'amend': ILLEGAL_STATE_TRANSITION otherwise; a year still in
 *   drafting is changed with updateLineItemBudget);
 * - its fraternal year must not have ended (BUDGET_YEAR_CLOSED), unless an Active Super Admin passes superAdminOverride.
 * An amendment is mid-year by nature, so it is allowed from the approval until the year's June 30.
 */
export function assertBudgetLineAmendable(
  line: CouncilBudgetForecast,
  versions: readonly CouncilBudgetForecast[],
  today: Date,
  actor: MemberWriteActor,
  options: BudgetWriteOptions = {},
): void {
  const latest = versions.reduce<CouncilBudgetForecast | null>((top, v) => (!top || budgetLineVersion(v) > budgetLineVersion(top) ? v : top), null);
  if (latest && latest.id !== line.id) {
    throw new BusinessRuleError(
      'BUDGET_VERSION_SUPERSEDED',
      `Budget line ${line.id} is version ${budgetLineVersion(line)} of "${line.LineItemName}"; version ${budgetLineVersion(latest)} (line ${latest.id}) replaced it, so amend that one.`,
      { lineId: line.id, currentLineId: latest.id, currentVersion: budgetLineVersion(latest) },
    );
  }
  nextBudgetVersionStatus(line);
  if (fraternalYearBounds(line.FraternalYear).toDate >= toIsoDate(today)) return;
  if (options.superAdminOverride === true && hasSuperAdminRights(actor)) return;
  throw new BusinessRuleError('BUDGET_YEAR_CLOSED', `The ${line.FraternalYear} fraternal year has ended; its approved budget can no longer be amended.`, {
    fraternalYear: line.FraternalYear,
    lineId: line.id,
  });
}

/**
 * The row a mid-year amendment resolution inserts: a copy of the approved version `line` with the next budget_version,
 * the amended quantity and unit cost, and the amended approved figure (also recorded as the proposed figure, since the
 * resolution carried it). The earlier row is never touched.
 * - With a unit cost above 0, the figure is quantity x unit cost; an approvedAmount that differs rejects INVALID_INPUT.
 * - With a unit cost of 0, the figure is approvedAmount, or the line's current figure when it is omitted (a lump sum
 *   split evenly over the quantity).
 * - notes undefined keeps the line's Notes; blank or null clears them.
 * Rejects INVALID_INPUT for an unknown field or an amendment that changes nothing.
 */
export function planBudgetAmendment(
  line: CouncilBudgetForecast,
  amendment: BudgetLineAmendment,
): Omit<CouncilBudgetForecast, 'id'> & Required<Pick<CouncilBudgetForecast, 'quantity' | 'unit_cost' | 'budget_version'>> {
  if (typeof amendment !== 'object' || amendment === null) throw invalid('Amendment details are required.');
  const allowed = ['quantity', 'unitCost', 'approvedAmount', 'notes'];
  for (const key of Object.keys(amendment)) {
    if (!allowed.includes(key)) throw invalid(`A budget amendment has no field "${key}"; its fields are ${allowed.join(', ')}.`, { field: key });
  }
  const quantity = amendment.quantity === undefined ? budgetLineQuantity(line) : assertBudgetQuantity(amendment.quantity);
  const unitCost = amendment.unitCost === undefined ? budgetLineUnitCost(line) : assertMoney(amendment.unitCost, 'Unit cost');
  const requested = amendment.approvedAmount === undefined ? undefined : assertMoney(amendment.approvedAmount, 'Approved budget amount');
  let approved: number;
  if (unitCost > 0) {
    approved = budgetLineEstimate(quantity, unitCost);
    if (requested !== undefined && cents(requested) !== cents(approved)) {
      throw invalid(`${quantity} x ${unitCost.toFixed(2)} is ${approved.toFixed(2)}; the approved amount cannot be ${requested.toFixed(2)}.`, {
        field: 'approvedAmount',
        quantity,
        unitCost,
      });
    }
  } else {
    approved = requested ?? cents(line.ApprovedBudgetAmount) / 100;
  }
  const notes = amendment.notes === undefined ? (line.Notes ?? null) : optionalNotes(amendment.notes);
  const unchanged =
    quantity === budgetLineQuantity(line) &&
    cents(unitCost) === cents(budgetLineUnitCost(line)) &&
    cents(approved) === cents(line.ApprovedBudgetAmount) &&
    notes === (line.Notes ?? null);
  if (unchanged) throw invalid(`The amendment does not change budget line ${line.id}.`, { lineId: line.id });
  const { id: _id, ...rest } = line;
  return {
    ...rest,
    quantity,
    unit_cost: unitCost,
    ApprovedBudgetAmount: approved,
    ProposedBudgetAmount: approved,
    Notes: notes,
    BudgetStatus: nextBudgetVersionStatus(line),
    budget_version: budgetLineVersion(line) + 1,
  };
}

// ---- budget versus actual spend (Sprint 5Y-4) ------------------------------------------------------

/** The fraternal year `today` falls in: July 1 through June 30. */
export function currentFraternalYear(today: Date): string {
  const start = today.getMonth() >= BUDGET_FINALIZED_MONTH ? today.getFullYear() : today.getFullYear() - 1;
  return `${start}-${start + 1}`;
}

/** A gauge turns to a warning once spend reaches this share of the approved cap. */
export const BUDGET_WARNING_THRESHOLD_PERCENT = 85;

/**
 * How spend stands against a cap: 'None' (no cap and no spend), 'Unbudgeted' (spend with no approved cap), 'Over Budget'
 * (past 100%), 'Warning' (BUDGET_WARNING_THRESHOLD_PERCENT or more) or 'On Track'.
 */
export type BudgetAlert = 'None' | 'On Track' | 'Warning' | 'Over Budget' | 'Unbudgeted';

/** Spend as a percentage of the cap, to one decimal place; null without a cap. */
export function budgetPercentUsed(cap: number, actual: number): number | null {
  if (cents(cap) <= 0) return null;
  return Math.round((cents(actual) / cents(cap)) * 1000) / 10;
}

/** Compared in exact cents, not the rounded percentage, so 84.99% of a cap stays 'On Track'. */
export function budgetAlertOf(cap: number, actual: number): BudgetAlert {
  const capCents = cents(cap);
  const spentCents = cents(actual);
  if (capCents <= 0) return spentCents > 0 ? 'Unbudgeted' : 'None';
  if (spentCents > capCents) return 'Over Budget';
  return spentCents * 100 >= capCents * BUDGET_WARNING_THRESHOLD_PERCENT ? 'Warning' : 'On Track';
}

/**
 * One council's spend over a period, as the drivers load it. Since Sprint 6B an event's actual spend is rolled up only
 * from the expense sheets the workflow has moved to 'Approved' or 'Reimbursed'; the manual Event.Spend field is never
 * read (reports.monthlySummary still adds it, so the two can differ).
 */
export interface BudgetYearSpend {
  /**
   * Line items dated in the period on the council's 'Approved' and 'Reimbursed' expense sheets, with the event (id and
   * name) or meeting the sheet is linked to.
   */
  expenses: readonly { EventID: number | null; EventName: string | null; MeetingID: number | null; Amount: number }[];
  /** The council's charity checks paid in the period. */
  charityChecks: readonly { CharityID: number; Amount: number }[];
}

/**
 * Which budget line each piece of spend counts against, in cents by line id, plus what no line claims:
 * - expenses linked to an event go to the year's Event line of the same name ignoring case (or whose
 *   ReferenceSourceID is the event) - each year's event is a new Event row, so the name carries it;
 * - charity checks go to the Donation line of that charity;
 * - expenses linked to a meeting go to the 'Council Meetings' line (BUDGET_MEETINGS_LINE_NAME);
 * - everything else - a one-off event, an unlinked expense, a charity with no line - is unbudgeted.
 * Custom Operational lines have no source to read, so their actual is 0.
 */
export function attributeBudgetSpend(
  lines: readonly CouncilBudgetForecast[],
  spend: BudgetYearSpend,
): { byLine: Map<number, number>; unbudgetedCents: number } {
  const byLine = new Map<number, number>(lines.map((l) => [l.id, 0]));
  let unbudgetedCents = 0;
  const charge = (line: CouncilBudgetForecast | undefined, amount: number | null | undefined) => {
    if (line) byLine.set(line.id, byLine.get(line.id)! + cents(amount));
    else unbudgetedCents += cents(amount);
  };
  const eventLine = (id: number | null, name: string | null) =>
    lines.find(
      (l) => l.CategoryType === 'Event' && ((id !== null && l.ReferenceSourceID === id) || (name !== null && lineKey(l.LineItemName) === lineKey(name))),
    );
  const meetingsLine = findOperationalBudgetLine(lines, BUDGET_MEETINGS_LINE_NAME);
  for (const x of spend.expenses) {
    if (x.EventID !== null) charge(eventLine(x.EventID, x.EventName), x.Amount);
    else if (x.MeetingID !== null) charge(meetingsLine, x.Amount);
    else charge(undefined, x.Amount);
  }
  for (const c of spend.charityChecks) charge(lines.find((l) => l.CategoryType === 'Donation' && l.ReferenceSourceID === c.CharityID), c.Amount);
  return { byLine, unbudgetedCents };
}

/**
 * The dual prior-year baseline beside each line of a council year (Sprint 5Y-6.5): the previous year's approved cap for
 * the line it continues (matched as prePopulateNextYear matches: a Donation line by charity, others by category type and
 * name; null when there is no such line or that year was never approved) and the previous year's whole-year actual
 * spend charged to the line, counted as attributeBudgetSpend counts it (custom Operational lines have no source to
 * read, so theirs is 0). In listAnnualForecast order.
 */
export function buildPriorYearBaselines(input: {
  councilId: number;
  fraternalYear: string;
  lines: readonly CouncilBudgetForecast[];
  priorLines: readonly CouncilBudgetForecast[];
  priorSpend: BudgetYearSpend;
}): BudgetPriorYearBaselines {
  const { councilId, fraternalYear, priorLines, priorSpend } = input;
  const lines = sortBudgetLines(input.lines);
  const priorStatus = priorLines.length > 0 ? budgetStatusOf(priorLines) : null;
  const { byLine } = attributeBudgetSpend(lines, priorSpend);
  return {
    councilId,
    fraternalYear,
    priorFraternalYear: previousFraternalYear(fraternalYear),
    priorStatus,
    lines: lines.map((line) => {
      const prior = priorLineOf(line, priorLines) as CouncilBudgetForecast | undefined;
      return {
        lineId: line.id,
        priorLineId: prior?.id ?? null,
        priorApproved: prior && priorStatus === 'Approved' ? prior.ApprovedBudgetAmount : null,
        priorActual: (byLine.get(line.id) ?? 0) / 100,
      };
    }),
  };
}

/**
 * A council year's budget against its actual spend from July 1 through `throughDate`: every line and category with its
 * approved cap, actual, variance (cap minus actual), percentage used and alert, and the year's totals. The cap is
 * ApprovedBudgetAmount, so a year the council has not approved has no caps. `complete` says the period covers the whole
 * fraternal year.
 */
export function buildBudgetYearPerformance(input: {
  councilId: number;
  fraternalYear: string;
  lines: readonly CouncilBudgetForecast[];
  categories: readonly CouncilBudgetCategory[];
  spend: BudgetYearSpend;
  throughDate: string;
}): BudgetYearPerformance {
  const { councilId, fraternalYear, categories, spend, throughDate } = input;
  const { fromDate, toDate } = fraternalYearBounds(fraternalYear);
  const lines = sortBudgetLines(input.lines);
  const { byLine, unbudgetedCents } = attributeBudgetSpend(lines, spend);
  const actualOf = (l: CouncilBudgetForecast) => (byLine.get(l.id) ?? 0) / 100;
  const linePerformance: BudgetLinePerformance[] = lines.map((line) => {
    const actual = actualOf(line);
    return {
      line: { ...line },
      actual,
      variance: sumCents([line.ApprovedBudgetAmount, -actual]),
      percentUsed: budgetPercentUsed(line.ApprovedBudgetAmount, actual),
      alert: budgetAlertOf(line.ApprovedBudgetAmount, actual),
    };
  });
  const categoryPerformance: BudgetCategoryPerformance[] = groupBudgetByCategory(lines, categories).map((g) => {
    const actual = sumCents(g.lines.map(actualOf));
    return {
      categoryId: g.category?.id ?? null,
      label: g.label,
      lineCount: g.lines.length,
      proposed: g.proposedTotal,
      approved: g.approvedTotal,
      actual,
      variance: sumCents([g.approvedTotal, -actual]),
      percentUsed: budgetPercentUsed(g.approvedTotal, actual),
      alert: budgetAlertOf(g.approvedTotal, actual),
    };
  });
  const approvedTotal = sumCents(lines.map((l) => l.ApprovedBudgetAmount));
  const budgetedActual = sumCents(lines.map(actualOf));
  const unbudgetedActual = unbudgetedCents / 100;
  const actualTotal = sumCents([budgetedActual, unbudgetedActual]);
  return {
    councilId,
    fraternalYear,
    status: budgetStatusOf(lines),
    fromDate,
    throughDate,
    complete: throughDate >= toDate,
    proposedTotal: sumCents(lines.map((l) => l.ProposedBudgetAmount)),
    approvedTotal,
    budgetedActual,
    unbudgetedActual,
    actualTotal,
    variance: sumCents([approvedTotal, -actualTotal]),
    utilizationPercent: budgetPercentUsed(approvedTotal, actualTotal),
    alert: budgetAlertOf(approvedTotal, actualTotal),
    linesWithinBudget: linePerformance.filter((l) => l.alert === 'On Track' || l.alert === 'Warning').length,
    linesOverBudget: linePerformance.filter((l) => l.alert === 'Over Budget').length,
    lines: linePerformance,
    categories: categoryPerformance,
  };
}

/** The last day budget.getBudgetProgress counts for a year on `today`: today, or the year's June 30 once it has ended. */
export function budgetProgressThrough(fraternalYear: string, today: Date): string {
  const { toDate } = fraternalYearBounds(fraternalYear);
  const iso = toIsoDate(today);
  return iso < toDate ? iso : toDate;
}

/** The fraternal years among `years` that ended before `today`, newest first, without repeats. */
export function completedFraternalYears(years: readonly string[], today: Date): string[] {
  const iso = toIsoDate(today);
  return [...new Set(years)].filter((y) => fraternalYearBounds(y).toDate < iso).sort((a, b) => b.localeCompare(a));
}

/**
 * budget.getHistoricalKPIs from each completed year's performance. The trailing scorecard adds up the approved years
 * only - a year the council never approved has no budget to measure against - and rates the council's fiscal
 * efficiency as its actual spend over its approved budgets.
 */
export function summarizeBudgetHistory(councilId: number, years: readonly BudgetYearPerformance[], today: Date): BudgetHistoricalKPIs {
  const approved = years.filter((y) => y.status === 'Approved');
  const approvedTotal = sumCents(approved.map((y) => y.approvedTotal));
  const actualTotal = sumCents(approved.map((y) => y.actualTotal));
  return {
    councilId,
    asOf: toIsoDate(today),
    years: [...years].sort((a, b) => b.fraternalYear.localeCompare(a.fraternalYear)),
    trailing: {
      years: years.length,
      approvedYears: approved.length,
      approvedTotal,
      actualTotal,
      variance: sumCents([approvedTotal, -actualTotal]),
      utilizationPercent: budgetPercentUsed(approvedTotal, actualTotal),
      alert: budgetAlertOf(approvedTotal, actualTotal),
      yearsWithinBudget: approved.filter((y) => y.alert === 'On Track' || y.alert === 'Warning').length,
      yearsOverBudget: approved.filter((y) => y.alert === 'Over Budget').length,
    },
  };
}
