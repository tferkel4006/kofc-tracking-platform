// =========================================================================
// ANNUAL BUDGET FORECASTING (Sprint 5Y)
// Pure helpers behind the budget.* service methods: fraternal year labels and
// bounds, line validation, the forecast order, and the pre-population plan
// that turns last year's actual spend into next year's lines. Drivers load
// rows already scoped to one council, call these, then only store. Who may
// act is decided in rules.ts (assertMayViewBudgetForecast, assertMayManageBudgetForecast, assertMayApproveBudget,
// assertMayReviewBudgetPerformance). Sprint 5Y-4 adds the Draft -> Proposed -> Approved lifecycle and the
// budget-versus-actual performance figures behind the dashboard gauges and the historical KPIs.
// =========================================================================
import type {
  BudgetCategoryPerformance,
  BudgetHistoricalKPIs,
  BudgetLinePerformance,
  BudgetWriteOptions,
  BudgetYearPerformance,
  NewCustomBudgetLine,
} from './contract';
import { assertMoney, assertText, BusinessRuleError, hasSuperAdminRights, toIsoDate, type MemberWriteActor } from './rules';
import type { BudgetCategoryType, BudgetLineStatus, CouncilBudgetCategory, CouncilBudgetForecast } from './types';

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
  annualEvents: readonly { id: number; EventName: string; Spend?: number | null }[];
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
   * 5Y-2), and every line passes its BudgetCategoryID on to the line that continues it (Sprint 5Y-3).
   */
  priorLines: readonly Pick<CouncilBudgetForecast, 'CategoryType' | 'ReferenceSourceID' | 'LineItemName' | 'BudgetCategoryID'>[];
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
function priorLineOf(seed: Omit<BudgetSeed, 'BudgetCategoryID'>, priorLines: BudgetActuals['priorLines']) {
  if (seed.CategoryType === 'Donation') return priorLines.find((l) => l.CategoryType === 'Donation' && l.ReferenceSourceID === seed.ReferenceSourceID);
  return priorLines.find((l) => l.CategoryType === seed.CategoryType && lineKey(l.LineItemName) === lineKey(seed.LineItemName));
}

/**
 * The lines last year's actuals call for: one per annual event (its Spend plus its expenses), one per annual charity
 * (the sum of its checks), the meetings line when the council met, and each of last year's custom Operational lines
 * again under the same name with a baseline of 0 (custom lines have no spend to read). Each keeps the category of the
 * previous year's line it continues. In listAnnualForecast order.
 */
export function planBudgetPrePopulation(actuals: BudgetActuals): BudgetSeed[] {
  const seeds: Omit<BudgetSeed, 'BudgetCategoryID'>[] = actuals.annualEvents.map((e) => ({
    CategoryType: 'Event',
    ReferenceSourceID: e.id,
    LineItemName: e.EventName,
    PrePopulatedAmount: sumCents([e.Spend, ...actuals.eventExpenses.filter((x) => x.EventID === e.id).map((x) => x.Amount)]),
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
  for (const { CategoryType, ReferenceSourceID, LineItemName } of actuals.priorLines) {
    if (CategoryType !== 'Operational' || ReferenceSourceID != null || carried.has(lineKey(LineItemName))) continue;
    carried.add(lineKey(LineItemName));
    seeds.push({ CategoryType: 'Operational', ReferenceSourceID: null, LineItemName, PrePopulatedAmount: 0 });
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
  lines: readonly Pick<CouncilBudgetForecast, 'id' | 'ProposedBudgetAmount'>[],
): Pick<CouncilBudgetForecast, 'id' | 'ApprovedBudgetAmount' | 'BudgetStatus'>[] {
  return lines.map((l) => ({ id: l.id, ApprovedBudgetAmount: cents(l.ProposedBudgetAmount) / 100, BudgetStatus: 'Approved' }));
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
 * One council's spend over a period, as the drivers load it; it counts exactly what reports.monthlySummary counts, so
 * a year's actual total is the sum of its monthly summaries.
 */
export interface BudgetYearSpend {
  /** The council's events that start in the period, with their own Spend. */
  events: readonly { id: number; EventName: string; Spend?: number | null }[];
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
 * - an event's Spend, and expenses linked to it, go to the year's Event line of the same name ignoring case (or whose
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
  for (const e of spend.events) charge(eventLine(e.id, e.EventName), e.Spend);
  for (const x of spend.expenses) {
    if (x.EventID !== null) charge(eventLine(x.EventID, x.EventName), x.Amount);
    else if (x.MeetingID !== null) charge(meetingsLine, x.Amount);
    else charge(undefined, x.Amount);
  }
  for (const c of spend.charityChecks) charge(lines.find((l) => l.CategoryType === 'Donation' && l.ReferenceSourceID === c.CharityID), c.Amount);
  return { byLine, unbudgetedCents };
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
