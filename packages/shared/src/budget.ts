// =========================================================================
// ANNUAL BUDGET FORECASTING (Sprint 5Y)
// Pure helpers behind the budget.* service methods: fraternal year labels and
// bounds, line validation, the forecast order, and the pre-population plan
// that turns last year's actual spend into next year's lines. Drivers load
// rows already scoped to one council, call these, then only store. Who may
// act is decided in rules.ts (assertMayViewBudgetForecast, assertMayManageBudgetForecast).
// =========================================================================
import type { BudgetWriteOptions, NewCustomBudgetLine } from './contract';
import { assertMoney, assertText, BusinessRuleError, hasSuperAdminRights, type MemberWriteActor } from './rules';
import type { BudgetCategoryType, CouncilBudgetCategory, CouncilBudgetForecast } from './types';

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

/** The stored fields of a budget.addCustomBudgetLine line, validated. Rejects unknown fields. */
export function cleanCustomBudgetLine(input: NewCustomBudgetLine): Pick<
  CouncilBudgetForecast,
  'FraternalYear' | 'LineItemName' | 'ApprovedBudgetAmount'
> & { Notes: string | null; BudgetCategoryID: number | null } {
  if (typeof input !== 'object' || input === null) throw invalid('Budget line details are required.');
  const allowed = ['FraternalYear', 'LineItemName', 'ApprovedBudgetAmount', 'Notes', 'BudgetCategoryID'];
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
    ApprovedBudgetAmount: input.ApprovedBudgetAmount == null ? 0 : assertMoney(input.ApprovedBudgetAmount, 'Approved budget amount'),
    Notes: optionalNotes(input.Notes),
    BudgetCategoryID: category ?? null,
  };
}

/** budget.updateLineItemBudget's changes. `notes` undefined leaves Notes alone; blank or null clears them. */
export function cleanBudgetLineUpdate(
  approvedAmount: unknown,
  notes: unknown,
): Pick<CouncilBudgetForecast, 'ApprovedBudgetAmount'> & { Notes?: string | null } {
  const changes: Pick<CouncilBudgetForecast, 'ApprovedBudgetAmount'> & { Notes?: string | null } = {
    ApprovedBudgetAmount: assertMoney(approvedAmount, 'Approved budget amount'),
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
 * inserted. ApprovedBudgetAmount, Notes and BudgetCategoryID of existing lines are never part of the plan, and no line
 * is removed.
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

// ---- the June drafting window (Sprint 5Y-2) and the July 1 lock (Sprint 5Y-3) ----------

/**
 * Where a fraternal year's budget stands on a given day: prepared in the June before the year starts ('Draft'), locked
 * as 'Finalized' from July 1 when the year begins, and 'Not Yet Open' before that June.
 */
export type BudgetWindowState = 'Not Yet Open' | 'Draft' | 'Finalized';

/** The month (0-based: June) in which the next fraternal year's budget is drafted. */
export const BUDGET_DRAFT_MONTH = 5;

/** budgetWindowOf for `fraternalYear` on `today`: Draft through June 1-30 of its first year, Finalized from July 1. */
export function budgetWindowOf(fraternalYear: string, today: Date): BudgetWindowState {
  const start = Number(assertFraternalYear(fraternalYear).slice(0, 4));
  const opens = new Date(start, BUDGET_DRAFT_MONTH, 1);
  const locks = new Date(start, BUDGET_DRAFT_MONTH + 1, 1);
  if (today >= locks) return 'Finalized';
  return today >= opens ? 'Draft' : 'Not Yet Open';
}

/** The fraternal year whose budget is prepared next: the one starting this July 1, or next year's once July has come. */
export function upcomingFraternalYear(today: Date): string {
  const start = today.getMonth() > BUDGET_DRAFT_MONTH ? today.getFullYear() + 1 : today.getFullYear();
  return `${start}-${start + 1}`;
}

/**
 * The data layer's July 1 lock (Sprint 5Y-3): a write to a Finalized year rejects BUDGET_YEAR_FINALIZED unless an Active
 * Super Admin passes superAdminOverride. Anyone else's override is ignored.
 */
export function assertBudgetYearWritable(fraternalYear: string, today: Date, actor: MemberWriteActor, options: BudgetWriteOptions = {}): void {
  if (budgetWindowOf(fraternalYear, today) !== 'Finalized') return;
  if (options.superAdminOverride === true && hasSuperAdminRights(actor)) return;
  const start = fraternalYear.slice(0, 4);
  throw new BusinessRuleError(
    'BUDGET_YEAR_FINALIZED',
    `The ${fraternalYear} budget was locked as Finalized on July 1, ${start}; it can no longer be changed.`,
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
