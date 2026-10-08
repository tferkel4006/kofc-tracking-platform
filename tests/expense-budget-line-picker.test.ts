// Sprint 6G (Phase 5): the 'Assign Ledger Budget Line Item' dropdown on the Financial Secretary Audit Desk and the
// Grand Knight Authorization Desk - which forecast lines it offers (assignableExpenseBudgetLines) and which one an
// event- or meeting-linked voucher starts on (defaultExpenseBudgetLineId). A loose receipt starts blank, which keeps
// the desk's approval button locked until the signer picks a line.
import { describe, expect, it } from 'vitest';
import {
  assignableExpenseBudgetLines,
  attributeBudgetSpend,
  BUDGET_MEETINGS_LINE_NAME,
  defaultExpenseBudgetLineId,
  findEventBudgetLine,
  type CouncilBudgetForecast,
} from '@kofc/shared';

const line = (id: number, over: Partial<CouncilBudgetForecast>): CouncilBudgetForecast => ({
  id,
  CouncilID: 1,
  FraternalYear: '2026-2027',
  CategoryType: 'Operational',
  ReferenceSourceID: null,
  LineItemName: `Line ${id}`,
  PrePopulatedAmount: 0,
  ApprovedBudgetAmount: 100,
  ProposedBudgetAmount: 100,
  BudgetStatus: 'Approved',
  ...over,
});

const fishFry = line(1, { CategoryType: 'Event', ReferenceSourceID: 40, LineItemName: 'Lenten Fish Fry' });
const pancakes = line(2, { CategoryType: 'Event', LineItemName: 'Pancake  Breakfast' });
const meetings = line(3, { LineItemName: BUDGET_MEETINGS_LINE_NAME });
const misc = line(4, { LineItemName: 'Miscellaneous Others' });
const draft = line(5, { LineItemName: 'Draft Idea', BudgetStatus: 'Proposed' });
const LINES = [misc, draft, meetings, pancakes, fishFry];

describe('assignableExpenseBudgetLines', () => {
  it('offers only Approved lines, in forecast order', () => {
    expect(assignableExpenseBudgetLines(LINES).map((l) => l.id)).toEqual([1, 2, 3, 4]);
  });

  it('offers only the latest budget_version of an amended line', () => {
    const amended = { ...meetings, id: 9, budget_version: 2, ApprovedBudgetAmount: 250 };
    const ids = assignableExpenseBudgetLines([...LINES, amended]).map((l) => l.id);
    expect(ids).toContain(9);
    expect(ids).not.toContain(3);
  });

  it('is empty for a year with no approved budget', () => {
    expect(assignableExpenseBudgetLines([draft])).toEqual([]);
  });
});

describe('defaultExpenseBudgetLineId', () => {
  const assignable = assignableExpenseBudgetLines(LINES);

  it('starts an event voucher on the Event line referencing the event', () => {
    expect(defaultExpenseBudgetLineId(assignable, { EventID: 40, EventName: 'Renamed Fry', MeetingID: null })).toBe(1);
  });

  it('starts an event voucher on the Event line of the same name, ignoring case and spacing', () => {
    expect(defaultExpenseBudgetLineId(assignable, { EventID: 77, EventName: 'pancake breakfast', MeetingID: null })).toBe(2);
  });

  it('starts a meeting voucher on the Council Meetings line', () => {
    expect(defaultExpenseBudgetLineId(assignable, { EventID: null, EventName: null, MeetingID: 6 })).toBe(3);
  });

  it('leaves a loose receipt blank, never the Miscellaneous catch-all', () => {
    expect(defaultExpenseBudgetLineId(assignable, { EventID: null, EventName: null, MeetingID: null })).toBeNull();
  });

  it('leaves blank an event with no matching line, or a line that is not approved', () => {
    expect(defaultExpenseBudgetLineId(assignable, { EventID: 88, EventName: 'Golf Outing', MeetingID: null })).toBeNull();
    expect(defaultExpenseBudgetLineId(assignable, { EventID: 89, EventName: 'Draft Idea', MeetingID: null })).toBeNull();
    expect(defaultExpenseBudgetLineId([fishFry], { EventID: null, EventName: null, MeetingID: 6 })).toBeNull();
  });

  it('is the line attributeBudgetSpend charges once the signature saves it (Sprint 6G Extension)', () => {
    const link = { EventID: 77, EventName: 'Pancake Breakfast', MeetingID: null };
    const saved = defaultExpenseBudgetLineId(assignable, link);
    const { byLine } = attributeBudgetSpend(assignable, { expenses: [{ BudgetLineID: saved, Amount: 12.5 }], charityChecks: [] });
    expect(byLine.get(saved!)).toBe(1250);
    expect(findEventBudgetLine(assignable, 77, 'Pancake Breakfast')?.id).toBe(2);
  });
});
