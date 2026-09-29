// =========================================================================
// ANNUAL BUDGET FORECASTING (Sprint 5Y)
// Pure helpers behind the budget.* service methods: fraternal year labels and
// bounds, line validation, the forecast order, and the pre-population plan
// that turns last year's actual spend into next year's lines. Drivers load
// rows already scoped to one council, call these, then only store. Who may
// act is decided in rules.ts (assertMayManageBudgetForecast).
// =========================================================================
import type { NewCustomBudgetLine } from './contract';
import { assertMoney, assertText, BusinessRuleError } from './rules';
import type { BudgetCategoryType, CouncilBudgetForecast } from './types';

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
> & { Notes: string | null } {
  if (typeof input !== 'object' || input === null) throw invalid('Budget line details are required.');
  const allowed = ['FraternalYear', 'LineItemName', 'ApprovedBudgetAmount', 'Notes'];
  for (const key of Object.keys(input)) {
    if (!allowed.includes(key)) throw invalid(`A custom budget line has no field "${key}"; its fields are ${allowed.join(', ')}.`, { field: key });
  }
  return {
    FraternalYear: assertFraternalYear(input.FraternalYear),
    LineItemName: assertText(input.LineItemName, 'Line item name', BUDGET_LINE_NAME_MAX_LENGTH).replace(/\s+/g, ' '),
    ApprovedBudgetAmount: input.ApprovedBudgetAmount == null ? 0 : assertMoney(input.ApprovedBudgetAmount, 'Approved budget amount'),
    Notes: optionalNotes(input.Notes),
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
  /** The council's unsourced Operational lines of that year's own forecast, carried forward by name (Sprint 5Y-2). */
  priorCustomLines: readonly Pick<CouncilBudgetForecast, 'LineItemName'>[];
}

/** One line prePopulateNextYear wants in the new year. */
export type BudgetSeed = Pick<CouncilBudgetForecast, 'CategoryType' | 'LineItemName' | 'PrePopulatedAmount'> & {
  ReferenceSourceID: number | null;
};

/**
 * The lines last year's actuals call for: one per annual event (its Spend plus its expenses), one per annual charity
 * (the sum of its checks), the meetings line when the council met, and each of last year's custom Operational lines
 * again under the same name with a baseline of 0 (custom lines have no spend to read). In listAnnualForecast order.
 */
export function planBudgetPrePopulation(actuals: BudgetActuals): BudgetSeed[] {
  const seeds: BudgetSeed[] = actuals.annualEvents.map((e) => ({
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
  for (const { LineItemName } of actuals.priorCustomLines) {
    if (carried.has(lineKey(LineItemName))) continue;
    carried.add(lineKey(LineItemName));
    seeds.push({ CategoryType: 'Operational', ReferenceSourceID: null, LineItemName, PrePopulatedAmount: 0 });
  }
  return sortBudgetLines(seeds);
}

/** A line prePopulateNextYear refreshes in place. */
export type BudgetLineRefresh = Pick<CouncilBudgetForecast, 'id' | 'LineItemName' | 'PrePopulatedAmount'>;

/**
 * How `seeds` land on the council year's `existing` lines: a seed matching a line (same category and source, or for an
 * unsourced line the same name ignoring case) refreshes that line's PrePopulatedAmount and LineItemName; the others are
 * inserted. ApprovedBudgetAmount and Notes are never part of the plan, and no line is removed.
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

// ---- the June drafting window (Sprint 5Y-2) -----------------------------------------

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

// ---- council funds ------------------------------------------------------------------

/** The council's funds, in the order the budget presents them. */
export const BUDGET_FUNDS = [
  'Father George Wolf Memorial Fund',
  'Sister Rita Rose Vistica Parish Community Fund',
  'Cathedral School & Student Support',
  'Other Donations & Projects',
  'Council Maintenance & State/Supreme Programs',
  'Blessed Michael McGivney Fraternal Activities Fund',
] as const;
export type BudgetFund = (typeof BUDGET_FUNDS)[number];

/** What budgetFundOf knows about a line's source: the charity's CharityType, or the event's category name. */
export interface BudgetLineSource {
  charityType?: string | null;
  eventCategory?: string | null;
}

/**
 * The fund a line is budgeted under. CouncilBudgetForecast has no fund column, so the fund follows from the line:
 * 1. a name that names a fund or its purpose ('Wolf', 'Vistica', 'McGivney', school, student, scholarship);
 * 2. Operational lines - Council Maintenance & State/Supreme Programs;
 * 3. Donation lines - the Parish Community fund for a 'Parish' charity, else Other Donations & Projects;
 * 4. Event lines - the Parish Community fund for a 'Parish Community' event, else the McGivney Fraternal Activities Fund.
 */
export function budgetFundOf(line: Pick<CouncilBudgetForecast, 'CategoryType' | 'LineItemName'>, source: BudgetLineSource = {}): BudgetFund {
  const name = line.LineItemName.toLowerCase();
  if (name.includes('wolf')) return 'Father George Wolf Memorial Fund';
  if (name.includes('vistica')) return 'Sister Rita Rose Vistica Parish Community Fund';
  if (name.includes('mcgivney')) return 'Blessed Michael McGivney Fraternal Activities Fund';
  if (/\b(school|student|students|scholarship|scholarships)\b/.test(name)) return 'Cathedral School & Student Support';
  if (line.CategoryType === 'Operational') return 'Council Maintenance & State/Supreme Programs';
  if (line.CategoryType === 'Donation') {
    return source.charityType?.toLowerCase() === 'parish' ? 'Sister Rita Rose Vistica Parish Community Fund' : 'Other Donations & Projects';
  }
  return source.eventCategory?.toLowerCase() === 'parish community'
    ? 'Sister Rita Rose Vistica Parish Community Fund'
    : 'Blessed Michael McGivney Fraternal Activities Fund';
}

/** One fund's lines with their subtotals, to the cent. */
export interface BudgetFundGroup<T extends CouncilBudgetForecast = CouncilBudgetForecast> {
  fund: BudgetFund;
  lines: T[];
  prePopulatedTotal: number;
  approvedTotal: number;
}

/** Every fund in BUDGET_FUNDS order (empty funds included), each holding its lines in listAnnualForecast order. */
export function groupBudgetByFund<T extends CouncilBudgetForecast>(lines: readonly T[], sourceOf: (line: T) => BudgetLineSource): BudgetFundGroup<T>[] {
  return BUDGET_FUNDS.map((fund) => {
    const mine = sortBudgetLines(lines.filter((l) => budgetFundOf(l, sourceOf(l)) === fund));
    return {
      fund,
      lines: mine,
      prePopulatedTotal: sumCents(mine.map((l) => l.PrePopulatedAmount)),
      approvedTotal: sumCents(mine.map((l) => l.ApprovedBudgetAmount)),
    };
  });
}

/** Adds budget amounts to the cent. */
export const sumBudgetAmounts = (amounts: readonly number[]): number => sumCents(amounts);
