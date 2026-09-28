// Sprint 5R: expense reporting (expenses.listUserReports, listCouncilQueue, submitReport, approveReport and
// recordDisbursement), its role gates and its tenant isolation. Sprint 5R-1.5: no self-approval, rejectReport, and
// approved expenses in reports.monthlySummary. Sprint 5R-2: no self-payout and the shared expense form helpers.
import { describe, expect, it } from 'vitest';
import {
  assertNoSelfPayout,
  assertNotSelfApproval,
  blankExpenseLine,
  BusinessRuleError,
  canApproveExpenseReport,
  canAuditCouncilExpenses,
  canPayExpenseReport,
  cleanExpenseLineItems,
  expenseDraftTotal,
  expenseLineDraftFrom,
  expenseLinesFromDrafts,
  expenseReferenceChoices,
  expenseReferenceKey,
  expenseReferenceLabel,
  expenseStatusBadge,
  listExpenseReferences,
  mayAuditCouncilExpenses,
  parseExpenseReferenceKey,
  REJECTION_REASON_MAX_LENGTH,
  summarizeMonth,
  SecurityPrivilegeError,
  sumAmounts,
  type DataService,
  type ExpenseLineItemInput,
  type MemberWriteActor,
} from '@kofc/shared';
import { MemoryDataService } from '../apps/web/services/drivers/memory';
import { drivers, expectRule, MEMBER, NOW, type DriverUnderTest } from './helpers';
import { openDatabases } from './shims/expo-sqlite';

// Dev seed: council 1 is 15295 (Super Admin 1, Admin 2 who is also Financial Secretary, Member 3); council 2 exists.
const OWN = 1;
const OTHER = 2;
const CHECK = { CheckNumber: '1042', PayoutDate: '2026-09-20', Notes: 'September reimbursements' };

const receipt = (over: Partial<ExpenseLineItemInput> = {}): ExpenseLineItemInput => ({
  DateOfExpense: '2026-09-12',
  Amount: 42.5,
  VendorName: 'Costco',
  ReceiptPhotoURL: 'receipts/costco-0912.jpg',
  ExpenseDescription: 'Pancake breakfast supplies',
  ...over,
});

async function expectPrivilege(promise: Promise<unknown>, code: 'ADMIN_REQUIRED' | 'COUNCIL_ACCESS_DENIED') {
  expect(await expectRule(promise, code)).toBeInstanceOf(SecurityPrivilegeError);
}

/** Gives a member a Role straight in the backing store; the data service has no role-assignment method. */
function grantRole(d: DriverUnderTest, db: DataService, memberId: number, role: string): void {
  if (d.name === 'memory') {
    const store = (db as MemoryDataService).debugStore;
    store.insert('MemberRoles', { RoleID: store.rows('Role').find((r) => r.Role === role)!.id, MemberID: memberId });
  } else {
    openDatabases.at(-1)!.prepare('INSERT INTO [MemberRoles] ([RoleID], [MemberID]) SELECT [id], ? FROM [Role] WHERE [Role] = ?').run(memberId, role);
  }
}

/** A member of `councilId` of the given type, added by the seeded Super Admin. */
async function addMember(db: DataService, councilId: number, type: 'Admin' | 'Member', email: string, status = 'Active'): Promise<number> {
  const types = await db.lookups.list('MemberType');
  const statuses = await db.lookups.list('MemberStatus');
  const member = await db.members.create(MEMBER.superAdmin, {
    CouncilID: councilId,
    MemberNumber: 7700000 + email.length,
    MemberFirstName: 'Expense',
    MemberLastName: 'Tester',
    Phone: '503-555-0150',
    StreetAddress1: '1 Charity Way',
    City: 'Salem',
    State: 'OR',
    ZipCode: '97301',
    Email: email,
    DateOfBirth: '1970-05-05',
    StatusID: statuses.find((s) => s.Status === status)!.id,
    DegreeID: 3,
    MemberTypeID: types.find((t) => t.Type === type)!.id,
  });
  return member.id;
}

/** Submits a sheet for `memberId` and has the seeded Super Admin approve it; resolves to its id. */
async function approvedReport(db: DataService, memberId: number, items = [receipt()]): Promise<number> {
  const { report } = await db.expenses.submitReport(memberId, { Status: 'Submitted' }, items);
  await db.expenses.approveReport(MEMBER.superAdmin, report.id);
  return report.id;
}

describe('expense helpers (pure)', () => {
  it('sums amounts to the cent without floating-point drift', () => {
    expect(sumAmounts([0.1, 0.2])).toBe(0.3);
    expect(sumAmounts([19.99, 5.01, 100])).toBe(125);
    expect(sumAmounts([])).toBe(0);
  });

  it('cleans line items and refuses bad amounts, dates and text', () => {
    const [clean] = cleanExpenseLineItems([receipt({ VendorName: '  Costco  ', ReceiptPhotoURL: '  ' })], 'Submitted', NOW);
    expect(clean.VendorName).toBe('Costco');
    expect(clean.ReceiptPhotoURL).toBeNull();
    expect(cleanExpenseLineItems([], 'Draft', NOW)).toEqual([]);
    expect(() => cleanExpenseLineItems([], 'Submitted', NOW)).toThrow(/at least one line item/);
    expect(() => cleanExpenseLineItems([receipt({ Amount: 0 })], 'Draft', NOW)).toThrow(/more than 0/);
    expect(() => cleanExpenseLineItems([receipt({ Amount: -5 })], 'Draft', NOW)).toThrow(/amount/);
    expect(() => cleanExpenseLineItems([receipt({ Amount: 1.005 })], 'Draft', NOW)).toThrow(/two decimal places/);
    expect(() => cleanExpenseLineItems([receipt({ DateOfExpense: '2026-09-21' })], 'Draft', NOW)).toThrow(/future/);
    expect(() => cleanExpenseLineItems([receipt({ DateOfExpense: '2026-02-30' })], 'Draft', NOW)).toThrow(/calendar date/);
    expect(() => cleanExpenseLineItems([receipt({ VendorName: ' ' })], 'Draft', NOW)).toThrow(/vendor is required/);
    expect(() => cleanExpenseLineItems([receipt({ ExpenseDescription: '' })], 'Draft', NOW)).toThrow(/description is required/);
    expect(() => cleanExpenseLineItems([receipt({ VendorName: 'x'.repeat(256) })], 'Draft', NOW)).toThrow(/at most 255/);
  });

  const actor = (over: Partial<MemberWriteActor> = {}): MemberWriteActor => ({ memberId: 10, councilId: OWN, memberType: 'Member', active: true, ...over });

  it('limits council expense review to its Admins, finance officers and any Super Admin, while active', () => {
    expect(mayAuditCouncilExpenses(actor(), OWN)).toBe(false);
    expect(mayAuditCouncilExpenses(actor({ roles: ['Grand Knight'] }), OWN)).toBe(false);
    expect(mayAuditCouncilExpenses(actor({ memberType: 'Admin' }), OWN)).toBe(true);
    expect(mayAuditCouncilExpenses(actor({ memberType: 'Admin' }), OTHER)).toBe(false);
    expect(mayAuditCouncilExpenses(actor({ memberType: 'Admin', active: false }), OWN)).toBe(false);
    for (const role of ['Treasurer', 'Financial Secretary']) {
      expect(mayAuditCouncilExpenses(actor({ roles: [role] }), OWN)).toBe(true);
      expect(mayAuditCouncilExpenses(actor({ roles: [role] }), OTHER)).toBe(false);
      expect(mayAuditCouncilExpenses(actor({ roles: [role], active: false }), OWN)).toBe(false);
    }
    expect(mayAuditCouncilExpenses(actor({ memberType: 'Super Admin', councilId: 77 }), OTHER)).toBe(true);
  });

  it('mirrors the rule in the UI permission gate', () => {
    const user = (over = {}) => ({ memberId: 10, councilId: OWN, memberType: 'Member' as const, isOfficer: false, ...over });
    expect(canAuditCouncilExpenses(user(), OWN)).toBe(false);
    expect(canAuditCouncilExpenses(user({ isOfficer: true, roles: ['Warden'] }), OWN)).toBe(false);
    expect(canAuditCouncilExpenses(user({ roles: ['Treasurer'] }), OWN)).toBe(true);
    expect(canAuditCouncilExpenses(user({ roles: ['Treasurer'] }), OTHER)).toBe(false);
    expect(canAuditCouncilExpenses(user({ memberType: 'Admin' }), OTHER)).toBe(false);
    expect(canAuditCouncilExpenses(user({ memberType: 'Super Admin' }), OTHER)).toBe(true);
  });
});

describe.each(drivers)('expense reporting ($name driver)', (d) => {
  describe('submitReport and listUserReports', () => {
    it('files a sheet in the submitter’s own council with its line items and total', async () => {
      const db = await d.make();
      const detail = await db.expenses.submitReport(MEMBER.member, { Status: 'Submitted' }, [
        receipt({ DateOfExpense: '2026-09-14', Amount: 19.99 }),
        receipt({ DateOfExpense: '2026-09-02', Amount: 5.01, ReceiptPhotoURL: null }),
      ]);
      expect(detail.report).toMatchObject({ CouncilID: OWN, SubmitterMemberID: MEMBER.member, Status: 'Submitted', DisbursementID: null });
      expect(detail.lineItems.map((li) => li.DateOfExpense)).toEqual(['2026-09-02', '2026-09-14']);
      expect(detail.lineItems[0].ReceiptPhotoURL).toBeNull();
      expect(detail.total).toBe(25);
      expect(detail.submitterLastName).not.toBe('');
      expect(detail.disbursement).toBeNull();
      expect(d.count(db, 'ExpenseLineItem')).toBe(2);
    });

    it('lets a member revise their own draft, replacing its line items, then submit it', async () => {
      const db = await d.make();
      const draft = await db.expenses.submitReport(MEMBER.member, { Status: 'Draft' }, [receipt(), receipt()]);
      const revised = await db.expenses.submitReport(MEMBER.member, { id: draft.report.id, Status: 'Draft' }, [receipt({ Amount: 10 })]);
      expect(revised.report.id).toBe(draft.report.id);
      expect(revised.total).toBe(10);
      expect(d.count(db, 'ExpenseLineItem')).toBe(1);
      const submitted = await db.expenses.submitReport(MEMBER.member, { id: draft.report.id, Status: 'Submitted' }, [receipt({ Amount: 12 })]);
      expect(submitted.report.Status).toBe('Submitted');
      expect(d.count(db, 'ExpenseReport')).toBe(1);
    });

    it('allows an empty draft but not an empty submission', async () => {
      const db = await d.make();
      expect((await db.expenses.submitReport(MEMBER.member, { Status: 'Draft' }, [])).total).toBe(0);
      await expectRule(db.expenses.submitReport(MEMBER.member, { Status: 'Submitted' }, []), 'INVALID_INPUT');
      expect(d.count(db, 'ExpenseReport')).toBe(1);
    });

    it('refuses to edit a sheet once it is submitted, and writes nothing', async () => {
      const db = await d.make();
      const { report } = await db.expenses.submitReport(MEMBER.member, { Status: 'Submitted' }, [receipt()]);
      await expectRule(db.expenses.submitReport(MEMBER.member, { id: report.id, Status: 'Draft' }, [receipt({ Amount: 1 })]), 'EXPENSE_STATUS_CONFLICT');
      const [mine] = await db.expenses.listUserReports(MEMBER.member);
      expect(mine.report.Status).toBe('Submitted');
      expect(mine.total).toBe(42.5);
    });

    it('treats another member’s sheet as missing, even for leadership', async () => {
      const db = await d.make();
      const { report } = await db.expenses.submitReport(MEMBER.member, { Status: 'Draft' }, [receipt()]);
      await expectRule(db.expenses.submitReport(MEMBER.admin, { id: report.id, Status: 'Draft' }, [receipt()]), 'RECORD_NOT_FOUND');
      await expectRule(db.expenses.submitReport(MEMBER.superAdmin, { id: report.id, Status: 'Submitted' }, [receipt()]), 'RECORD_NOT_FOUND');
      expect(d.count(db, 'ExpenseLineItem')).toBe(1);
    });

    it('lists only the member’s own sheets, newest first, drafts included', async () => {
      const db = await d.make();
      const first = await db.expenses.submitReport(MEMBER.member, { Status: 'Draft' }, [receipt()]);
      const second = await db.expenses.submitReport(MEMBER.member, { Status: 'Submitted' }, [receipt()]);
      await db.expenses.submitReport(MEMBER.admin, { Status: 'Submitted' }, [receipt()]);
      const mine = await db.expenses.listUserReports(MEMBER.member);
      expect(mine.map((r) => r.report.id)).toEqual([second.report.id, first.report.id]);
      expect(await db.expenses.listUserReports(MEMBER.newMember)).toEqual([]);
      await expectRule(db.expenses.listUserReports(9999), 'MEMBER_NOT_FOUND');
    });

    it('links an event or meeting of the council, and refuses unknown or foreign ones', async () => {
      const db = await d.make();
      const [event] = await db.events.listByCouncil(OWN);
      const [meeting] = await db.meetings.listUpcoming(OWN);
      const linked = await db.expenses.submitReport(MEMBER.member, { Status: 'Draft', LinkedEventID: event.id, LinkedMeetingID: meeting.id }, [receipt()]);
      expect(linked.report).toMatchObject({ LinkedEventID: event.id, LinkedMeetingID: meeting.id });

      const category = (await db.lookups.list('Category'))[0];
      const foreign = await db.events.create(
        { EventName: 'Other council fish fry', EventDescription: 'Sprint 5R fixture', OwnerID: MEMBER.superAdmin, StartDate: '2026-10-02', EndDate: '2026-10-02', Location: 'Hall', CategoryID: category.id },
        [OTHER],
      );
      const type = (await db.lookups.list('MeetingType'))[0];
      const foreignMeeting = await db.meetings.create({
        OwnerID: null,
        CouncilID: OTHER,
        'Meeting Name': 'Other council business',
        Date: '2026-10-05',
        'Time Start': '19:00:00',
        'Time End': '20:00:00',
        Location: 'Hall',
        MeetingType: type.id,
      });
      await expectRule(db.expenses.submitReport(MEMBER.member, { Status: 'Draft', LinkedEventID: foreign.id }, [receipt()]), 'INVALID_INPUT');
      await expectRule(db.expenses.submitReport(MEMBER.member, { Status: 'Draft', LinkedMeetingID: foreignMeeting.id }, [receipt()]), 'INVALID_INPUT');
      await expectRule(db.expenses.submitReport(MEMBER.member, { Status: 'Draft', LinkedEventID: 9999 }, [receipt()]), 'INVALID_INPUT');
      await expectRule(db.expenses.submitReport(MEMBER.member, { Status: 'Draft', LinkedMeetingID: 9999 }, [receipt()]), 'INVALID_INPUT');
      expect(d.count(db, 'ExpenseReport')).toBe(1);
    });

    it('refuses a status other than Draft or Submitted, a bad line item and an unknown member', async () => {
      const db = await d.make();
      await expectRule(db.expenses.submitReport(MEMBER.member, { Status: 'Approved' as 'Draft' }, [receipt()]), 'INVALID_INPUT');
      await expectRule(db.expenses.submitReport(MEMBER.member, { Status: 'Draft' }, [receipt(), receipt({ Amount: 0 })]), 'INVALID_INPUT');
      await expectRule(db.expenses.submitReport(MEMBER.member, { Status: 'Draft' }, [receipt({ DateOfExpense: '09/12/2026' })]), 'INVALID_DATE');
      await expectRule(db.expenses.submitReport(9999, { Status: 'Draft' }, [receipt()]), 'MEMBER_NOT_FOUND');
      expect(d.count(db, 'ExpenseReport')).toBe(0);
      expect(d.count(db, 'ExpenseLineItem')).toBe(0);
    });
  });

  describe('listCouncilQueue and approveReport', () => {
    it('shows leadership the council’s submitted and approved sheets, oldest first, never drafts or other councils', async () => {
      const db = await d.make();
      const otherMember = await addMember(db, OTHER, 'Member', 'other.expense.member@example.org');
      await db.expenses.submitReport(MEMBER.member, { Status: 'Draft' }, [receipt()]);
      const a = await db.expenses.submitReport(MEMBER.member, { Status: 'Submitted' }, [receipt()]);
      const b = await approvedReport(db, MEMBER.admin);
      await db.expenses.submitReport(otherMember, { Status: 'Submitted' }, [receipt()]);

      const queue = await db.expenses.listCouncilQueue(MEMBER.admin, OWN);
      expect(queue.map((r) => [r.report.id, r.report.Status])).toEqual([
        [a.report.id, 'Submitted'],
        [b, 'Approved'],
      ]);
      expect((await db.expenses.listCouncilQueue(MEMBER.superAdmin, OTHER)).map((r) => r.report.SubmitterMemberID)).toEqual([otherMember]);
    });

    it('opens the queue to the Treasurer and refuses plain members and other councils’ leadership', async () => {
      const db = await d.make();
      await expectPrivilege(db.expenses.listCouncilQueue(MEMBER.member, OWN), 'ADMIN_REQUIRED');
      grantRole(d, db, MEMBER.member, 'Treasurer');
      expect(await db.expenses.listCouncilQueue(MEMBER.member, OWN)).toEqual([]);
      await expectPrivilege(db.expenses.listCouncilQueue(MEMBER.member, OTHER), 'COUNCIL_ACCESS_DENIED');
      const otherAdmin = await addMember(db, OTHER, 'Admin', 'other.expense.admin@example.org');
      await expectPrivilege(db.expenses.listCouncilQueue(otherAdmin, OWN), 'COUNCIL_ACCESS_DENIED');
      await expectRule(db.expenses.listCouncilQueue(MEMBER.superAdmin, 9999), 'INVALID_INPUT');
    });

    it('lets leadership approve a submitted sheet, only once, and only in their council', async () => {
      const db = await d.make();
      const { report } = await db.expenses.submitReport(MEMBER.member, { Status: 'Submitted' }, [receipt()]);
      await expectPrivilege(db.expenses.approveReport(MEMBER.member, report.id), 'ADMIN_REQUIRED');
      const otherAdmin = await addMember(db, OTHER, 'Admin', 'other.expense.admin@example.org');
      await expectPrivilege(db.expenses.approveReport(otherAdmin, report.id), 'COUNCIL_ACCESS_DENIED');
      const approved = await db.expenses.approveReport(MEMBER.admin, report.id);
      expect(approved.report.Status).toBe('Approved');
      await expectRule(db.expenses.approveReport(MEMBER.admin, report.id), 'EXPENSE_STATUS_CONFLICT');
      await expectRule(db.expenses.approveReport(MEMBER.admin, 9999), 'RECORD_NOT_FOUND');
    });

    it('refuses to approve a draft', async () => {
      const db = await d.make();
      const { report } = await db.expenses.submitReport(MEMBER.member, { Status: 'Draft' }, [receipt()]);
      await expectRule(db.expenses.approveReport(MEMBER.superAdmin, report.id), 'EXPENSE_STATUS_CONFLICT');
    });

    it('refuses an inactive Admin', async () => {
      const db = await d.make();
      const { report } = await db.expenses.submitReport(MEMBER.member, { Status: 'Submitted' }, [receipt()]);
      const inactiveAdmin = await addMember(db, OWN, 'Admin', 'inactive.expense.admin@example.org', 'Inactive');
      await expectPrivilege(db.expenses.approveReport(inactiveAdmin, report.id), 'ADMIN_REQUIRED');
    });
  });

  describe('recordDisbursement', () => {
    it('pays approved sheets with one check, totals them and stamps each Reimbursed', async () => {
      const db = await d.make();
      const a = await approvedReport(db, MEMBER.member, [receipt({ Amount: 19.99 }), receipt({ Amount: 0.01 })]);
      const b = await approvedReport(db, MEMBER.superAdmin, [receipt({ Amount: 100.1 })]);
      const result = await db.expenses.recordDisbursement(MEMBER.admin, OWN, [b, a], CHECK);
      expect(result.disbursement).toMatchObject({ CouncilID: OWN, CheckNumber: '1042', PayoutDate: '2026-09-20', TotalAmount: 120.1, Notes: 'September reimbursements' });
      expect(result.reports.map((r) => [r.report.id, r.report.Status, r.report.DisbursementID])).toEqual([
        [b, 'Reimbursed', result.disbursement.id],
        [a, 'Reimbursed', result.disbursement.id],
      ]);
      const [mine] = await db.expenses.listUserReports(MEMBER.member);
      expect(mine.disbursement?.CheckNumber).toBe('1042');
      expect(await db.expenses.listCouncilQueue(MEMBER.admin, OWN)).toEqual([]);
    });

    it('lets the Treasurer record a check', async () => {
      const db = await d.make();
      const a = await approvedReport(db, MEMBER.admin);
      grantRole(d, db, MEMBER.member, 'Treasurer');
      const result = await db.expenses.recordDisbursement(MEMBER.member, OWN, [a], { CheckNumber: 'T-7', PayoutDate: '2026-09-19' });
      expect(result.disbursement.Notes).toBeNull();
    });

    it('is all or nothing: one unpayable sheet refuses the whole check', async () => {
      const db = await d.make();
      const approved = await approvedReport(db, MEMBER.member);
      const { report: submitted } = await db.expenses.submitReport(MEMBER.admin, { Status: 'Submitted' }, [receipt()]);
      await expectRule(db.expenses.recordDisbursement(MEMBER.admin, OWN, [approved, submitted.id], CHECK), 'EXPENSE_STATUS_CONFLICT');
      await expectRule(db.expenses.recordDisbursement(MEMBER.admin, OWN, [approved, 9999], CHECK), 'RECORD_NOT_FOUND');
      expect(d.count(db, 'ExpenseDisbursement')).toBe(0);
      const [mine] = await db.expenses.listUserReports(MEMBER.member);
      expect(mine.report).toMatchObject({ Status: 'Approved', DisbursementID: null });
    });

    it('refuses to pay a sheet twice', async () => {
      const db = await d.make();
      const a = await approvedReport(db, MEMBER.member);
      await db.expenses.recordDisbursement(MEMBER.admin, OWN, [a], CHECK);
      await expectRule(db.expenses.recordDisbursement(MEMBER.admin, OWN, [a], { ...CHECK, CheckNumber: '1043' }), 'EXPENSE_STATUS_CONFLICT');
      expect(d.count(db, 'ExpenseDisbursement')).toBe(1);
    });

    it('keeps each council’s checks and sheets to itself', async () => {
      const db = await d.make();
      const otherMember = await addMember(db, OTHER, 'Member', 'other.expense.member@example.org');
      const foreign = await approvedReport(db, otherMember);
      const own = await approvedReport(db, MEMBER.member);
      await expectPrivilege(db.expenses.recordDisbursement(MEMBER.admin, OTHER, [foreign], CHECK), 'COUNCIL_ACCESS_DENIED');
      await expectRule(db.expenses.recordDisbursement(MEMBER.admin, OWN, [own, foreign], CHECK), 'INVALID_INPUT');
      await expectPrivilege(db.expenses.recordDisbursement(MEMBER.member, OWN, [own], CHECK), 'ADMIN_REQUIRED');
      // The same check number is fine in another council, but not twice in one.
      await db.expenses.recordDisbursement(MEMBER.superAdmin, OTHER, [foreign], CHECK);
      await db.expenses.recordDisbursement(MEMBER.admin, OWN, [own], { ...CHECK, CheckNumber: ' 1042 ' });
      const again = await approvedReport(db, MEMBER.member);
      await expectRule(db.expenses.recordDisbursement(MEMBER.admin, OWN, [again], CHECK), 'INVALID_INPUT');
      expect(d.count(db, 'ExpenseDisbursement')).toBe(2);
    });

    it('refuses an empty or repeated list and bad check details', async () => {
      const db = await d.make();
      const a = await approvedReport(db, MEMBER.member);
      await expectRule(db.expenses.recordDisbursement(MEMBER.admin, OWN, [], CHECK), 'INVALID_INPUT');
      await expectRule(db.expenses.recordDisbursement(MEMBER.admin, OWN, [a, a], CHECK), 'INVALID_INPUT');
      await expectRule(db.expenses.recordDisbursement(MEMBER.admin, OWN, [a], { ...CHECK, CheckNumber: ' ' }), 'INVALID_INPUT');
      await expectRule(db.expenses.recordDisbursement(MEMBER.admin, OWN, [a], { ...CHECK, CheckNumber: '9'.repeat(51) }), 'INVALID_INPUT');
      await expectRule(db.expenses.recordDisbursement(MEMBER.admin, OWN, [a], { ...CHECK, PayoutDate: '2026-13-01' }), 'INVALID_DATE');
      expect(d.count(db, 'ExpenseDisbursement')).toBe(0);
    });
  });

  it('keeps a council with expense records from being deleted', async () => {
    const db = await d.make();
    const council = await db.councils.create(MEMBER.superAdmin, { CouncilNumber: 99001, CouncilName: 'Expense Test', State: 'OR' });
    const member = await addMember(db, council.id, 'Member', 'expense.council.member@example.org');
    await db.expenses.submitReport(member, { Status: 'Draft' }, [receipt()]);
    const err = await expectRule(db.councils.remove(MEMBER.superAdmin, council.id), 'RECORD_IN_USE');
    expect(err.message).toMatch(/1 expense report/);
  });
});

describe('financial controls (pure, Sprint 5R-1.5)', () => {
  const actor = (over: Partial<MemberWriteActor> = {}): MemberWriteActor => ({ memberId: 10, councilId: OWN, memberType: 'Admin', active: true, ...over });

  it('blocks approving your own sheet unless you are an active Super Admin', () => {
    expect(() => assertNotSelfApproval(actor(), { id: 7, SubmitterMemberID: 10 })).toThrow(
      'For accounting controls, an officer cannot approve their own expense report.',
    );
    expect(() => assertNotSelfApproval(actor({ roles: ['Treasurer'], memberType: 'Member' }), { id: 7, SubmitterMemberID: 10 })).toThrow();
    expect(() => assertNotSelfApproval(actor({ memberType: 'Super Admin', active: false }), { id: 7, SubmitterMemberID: 10 })).toThrow();
    expect(() => assertNotSelfApproval(actor({ memberType: 'Super Admin' }), { id: 7, SubmitterMemberID: 10 })).not.toThrow();
    expect(() => assertNotSelfApproval(actor(), { id: 7, SubmitterMemberID: 11 })).not.toThrow();
  });

  it('mirrors the rule in the approve control', () => {
    const user = (over = {}) => ({ memberId: 10, councilId: OWN, memberType: 'Admin' as const, isOfficer: false, ...over });
    expect(canApproveExpenseReport(user(), { CouncilID: OWN, SubmitterMemberID: 11 })).toBe(true);
    expect(canApproveExpenseReport(user(), { CouncilID: OWN, SubmitterMemberID: 10 })).toBe(false);
    expect(canApproveExpenseReport(user({ memberType: 'Super Admin' }), { CouncilID: OTHER, SubmitterMemberID: 10 })).toBe(true);
    expect(canApproveExpenseReport(user({ memberType: 'Member' }), { CouncilID: OWN, SubmitterMemberID: 11 })).toBe(false);
  });

  it('adds approved expenses to the month’s spend and nets them against funds raised', () => {
    const summary = summarizeMonth(OWN, 2026, 9, {
      events: [{ id: 1, StartDate: '2026-09-03', Spend: 100.1, 'FundsRaised-Cash': 50 } as never],
      eventTime: [],
      activityTime: [],
      expenseItems: [{ Amount: 19.99 }, { Amount: 0.01 }],
    });
    expect(summary.finances).toEqual({ spend: 120.1, eventSpend: 100.1, expenses: 20, cash: 50, electronic: 0, raised: 50, net: -70.1 });
  });
});

describe.each(drivers)('financial controls ($name driver, Sprint 5R-1.5)', (d) => {
  describe('self-approval', () => {
    it('stops an Admin approving their own sheet and leaves it Submitted', async () => {
      const db = await d.make();
      const { report } = await db.expenses.submitReport(MEMBER.admin, { Status: 'Submitted' }, [receipt()]);
      const err = await expectRule(db.expenses.approveReport(MEMBER.admin, report.id), 'SELF_APPROVAL_BLOCKED');
      expect(err.message).toBe('For accounting controls, an officer cannot approve their own expense report.');
      const [mine] = await db.expenses.listUserReports(MEMBER.admin);
      expect(mine.report.Status).toBe('Submitted');
    });

    it('stops a Treasurer approving their own sheet, but not a colleague’s', async () => {
      const db = await d.make();
      grantRole(d, db, MEMBER.member, 'Treasurer');
      const own = await db.expenses.submitReport(MEMBER.member, { Status: 'Submitted' }, [receipt()]);
      const colleague = await db.expenses.submitReport(MEMBER.admin, { Status: 'Submitted' }, [receipt()]);
      await expectRule(db.expenses.approveReport(MEMBER.member, own.report.id), 'SELF_APPROVAL_BLOCKED');
      expect((await db.expenses.approveReport(MEMBER.member, colleague.report.id)).report.Status).toBe('Approved');
    });

    it('lets a Super Admin approve their own sheet as the override', async () => {
      const db = await d.make();
      const { report } = await db.expenses.submitReport(MEMBER.superAdmin, { Status: 'Submitted' }, [receipt()]);
      expect((await db.expenses.approveReport(MEMBER.superAdmin, report.id)).report.Status).toBe('Approved');
    });

    it('still refuses a plain member before looking at who submitted', async () => {
      const db = await d.make();
      const { report } = await db.expenses.submitReport(MEMBER.member, { Status: 'Submitted' }, [receipt()]);
      await expectPrivilege(db.expenses.approveReport(MEMBER.member, report.id), 'ADMIN_REQUIRED');
    });
  });

  describe('rejectReport', () => {
    it('returns a submitted sheet to Draft with the reason, out of the queue, for the member to fix and resubmit', async () => {
      const db = await d.make();
      const { report } = await db.expenses.submitReport(MEMBER.member, { Status: 'Submitted' }, [receipt()]);
      const rejected = await db.expenses.rejectReport(MEMBER.admin, report.id, '  Please attach the Costco receipt.  ');
      expect(rejected.report).toMatchObject({ Status: 'Draft', RejectionReason: 'Please attach the Costco receipt.' });
      expect(await db.expenses.listCouncilQueue(MEMBER.admin, OWN)).toEqual([]);

      const [mine] = await db.expenses.listUserReports(MEMBER.member);
      expect(mine.report.RejectionReason).toBe('Please attach the Costco receipt.');
      // Saving the draft keeps the reason in view; resubmitting clears it.
      const fixed = [receipt({ ReceiptPhotoURL: 'receipts/fixed.jpg' })];
      const edited = await db.expenses.submitReport(MEMBER.member, { id: report.id, Status: 'Draft' }, fixed);
      expect(edited.report.RejectionReason).toBe('Please attach the Costco receipt.');
      const resubmitted = await db.expenses.submitReport(MEMBER.member, { id: report.id, Status: 'Submitted' }, fixed);
      expect(resubmitted.report).toMatchObject({ Status: 'Submitted', RejectionReason: null });
      expect((await db.expenses.approveReport(MEMBER.admin, report.id)).report.Status).toBe('Approved');
    });

    it('is for the council’s leadership only', async () => {
      const db = await d.make();
      const { report } = await db.expenses.submitReport(MEMBER.member, { Status: 'Submitted' }, [receipt()]);
      await expectPrivilege(db.expenses.rejectReport(MEMBER.member, report.id, 'No'), 'ADMIN_REQUIRED');
      const otherAdmin = await addMember(db, OTHER, 'Admin', 'other.expense.admin@example.org');
      await expectPrivilege(db.expenses.rejectReport(otherAdmin, report.id, 'No'), 'COUNCIL_ACCESS_DENIED');
      grantRole(d, db, MEMBER.newMember, 'Financial Secretary');
      expect((await db.expenses.rejectReport(MEMBER.newMember, report.id, 'Wrong month')).report.Status).toBe('Draft');
    });

    it('needs a reason and a Submitted sheet, and writes nothing otherwise', async () => {
      const db = await d.make();
      const { report } = await db.expenses.submitReport(MEMBER.member, { Status: 'Submitted' }, [receipt()]);
      await expectRule(db.expenses.rejectReport(MEMBER.admin, report.id, '   '), 'INVALID_INPUT');
      await expectRule(db.expenses.rejectReport(MEMBER.admin, report.id, 'x'.repeat(REJECTION_REASON_MAX_LENGTH + 1)), 'INVALID_INPUT');
      await expectRule(db.expenses.rejectReport(MEMBER.admin, 9999, 'Missing receipt'), 'RECORD_NOT_FOUND');
      const [mine] = await db.expenses.listUserReports(MEMBER.member);
      expect(mine.report).toMatchObject({ Status: 'Submitted', RejectionReason: null });

      const draft = await db.expenses.submitReport(MEMBER.member, { Status: 'Draft' }, [receipt()]);
      await expectRule(db.expenses.rejectReport(MEMBER.admin, draft.report.id, 'Missing receipt'), 'EXPENSE_STATUS_CONFLICT');
      const approved = await approvedReport(db, MEMBER.member);
      await expectRule(db.expenses.rejectReport(MEMBER.admin, approved, 'Missing receipt'), 'EXPENSE_STATUS_CONFLICT');
    });
  });

  it('counts the council’s approved and reimbursed expenses in the monthly spend, by expense date', async () => {
    const db = await d.make();
    const before = await db.reports.monthlySummary(OWN, 2026, 9);
    const august = await db.reports.monthlySummary(OWN, 2026, 8);

    await approvedReport(db, MEMBER.member, [receipt({ Amount: 20, DateOfExpense: '2026-09-05' }), receipt({ Amount: 7, DateOfExpense: '2026-08-30' })]);
    const paid = await approvedReport(db, MEMBER.admin, [receipt({ Amount: 5.55, DateOfExpense: '2026-09-19' })]);
    await db.expenses.recordDisbursement(MEMBER.superAdmin, OWN, [paid], CHECK);
    // Not counted: pending, draft and returned sheets, and another council's approved sheet.
    await db.expenses.submitReport(MEMBER.member, { Status: 'Submitted' }, [receipt({ Amount: 100 })]);
    await db.expenses.submitReport(MEMBER.member, { Status: 'Draft' }, [receipt({ Amount: 100 })]);
    const returned = await db.expenses.submitReport(MEMBER.admin, { Status: 'Submitted' }, [receipt({ Amount: 100 })]);
    await db.expenses.rejectReport(MEMBER.superAdmin, returned.report.id, 'Duplicate');
    const otherMember = await addMember(db, OTHER, 'Member', 'other.expense.member@example.org');
    await approvedReport(db, otherMember, [receipt({ Amount: 50 })]);

    const september = await db.reports.monthlySummary(OWN, 2026, 9);
    expect(september.finances).toEqual({
      ...before.finances,
      expenses: 25.55,
      spend: Math.round((before.finances.eventSpend + 25.55) * 100) / 100,
      net: Math.round((before.finances.raised - before.finances.eventSpend - 25.55) * 100) / 100,
    });
    expect((await db.reports.monthlySummary(OWN, 2026, 8)).finances.expenses).toBe(august.finances.expenses + 7);
    expect((await db.reports.monthlySummary(OTHER, 2026, 9)).finances.expenses).toBe(50);
  });
});

describe('self-payout and the expense forms (pure, Sprint 5R-2)', () => {
  const actor = (over: Partial<MemberWriteActor> = {}): MemberWriteActor => ({ memberId: 10, councilId: OWN, memberType: 'Admin', active: true, ...over });
  const user = (over = {}) => ({ memberId: 10, councilId: OWN, memberType: 'Admin' as const, isOfficer: false, ...over });

  it('blocks paying your own sheet unless you are an active Super Admin', () => {
    let err: unknown;
    try {
      assertNoSelfPayout(actor(), { id: 7, SubmitterMemberID: 10 });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(BusinessRuleError);
    expect(err).toMatchObject({ code: 'SELF_PAYOUT_BLOCKED', message: 'For accounting controls, an officer cannot issue a check that pays their own expense report.' });
    expect(() => assertNoSelfPayout(actor({ roles: ['Financial Secretary'], memberType: 'Member' }), { id: 7, SubmitterMemberID: 10 })).toThrow();
    expect(() => assertNoSelfPayout(actor({ memberType: 'Super Admin', active: false }), { id: 7, SubmitterMemberID: 10 })).toThrow();
    expect(() => assertNoSelfPayout(actor({ memberType: 'Super Admin' }), { id: 7, SubmitterMemberID: 10 })).not.toThrow();
    expect(() => assertNoSelfPayout(actor(), { id: 7, SubmitterMemberID: 11 })).not.toThrow();
  });

  it('mirrors the rule in the pay checkbox', () => {
    expect(canPayExpenseReport(user(), { CouncilID: OWN, SubmitterMemberID: 11 })).toBe(true);
    expect(canPayExpenseReport(user(), { CouncilID: OWN, SubmitterMemberID: 10 })).toBe(false);
    expect(canPayExpenseReport(user(), { CouncilID: OTHER, SubmitterMemberID: 11 })).toBe(false);
    expect(canPayExpenseReport(user({ memberType: 'Member', roles: ['Treasurer'] }), { CouncilID: OWN, SubmitterMemberID: 11 })).toBe(true);
    expect(canPayExpenseReport(user({ memberType: 'Member', roles: ['Treasurer'] }), { CouncilID: OWN, SubmitterMemberID: 10 })).toBe(false);
    expect(canPayExpenseReport(user({ memberType: 'Super Admin' }), { CouncilID: OTHER, SubmitterMemberID: 10 })).toBe(true);
    expect(canPayExpenseReport(user({ memberType: 'Member' }), { CouncilID: OWN, SubmitterMemberID: 11 })).toBe(false);
  });

  it('round-trips the single Event-or-Meeting picker key', () => {
    expect(expenseReferenceKey({ LinkedEventID: 12, LinkedMeetingID: null })).toBe('event:12');
    expect(expenseReferenceKey({ LinkedEventID: null, LinkedMeetingID: 3 })).toBe('meeting:3');
    expect(expenseReferenceKey({})).toBe('');
    expect(expenseReferenceKey({ LinkedEventID: 12, LinkedMeetingID: 3 })).toBe('event:12');
    expect(parseExpenseReferenceKey('event:12')).toEqual({ LinkedEventID: 12, LinkedMeetingID: null });
    expect(parseExpenseReferenceKey('meeting:3')).toEqual({ LinkedEventID: null, LinkedMeetingID: 3 });
    expect(parseExpenseReferenceKey('')).toEqual({ LinkedEventID: null, LinkedMeetingID: null });
    expect(parseExpenseReferenceKey('council:1')).toEqual({ LinkedEventID: null, LinkedMeetingID: null });
  });

  it('labels the picker choices and a sheet’s reference', () => {
    const refs = {
      events: [{ id: 12, EventName: 'Pancake Breakfast', StartDate: '2026-09-12' } as never],
      meetings: [{ id: 3, 'Meeting Name': 'Business Meeting', Date: '2025-12-02' } as never],
    };
    expect(expenseReferenceChoices(refs)).toEqual([
      { group: 'Events', key: 'event:12', label: 'Pancake Breakfast · Sat, Sep 12, 2026' },
      { group: 'Meetings', key: 'meeting:3', label: 'Business Meeting · Tue, Dec 2, 2025' },
    ]);
    expect(expenseReferenceLabel({ LinkedEventID: 12 }, refs)).toBe('Event: Pancake Breakfast');
    expect(expenseReferenceLabel({ LinkedMeetingID: 3 }, refs)).toBe('Meeting: Business Meeting');
    expect(expenseReferenceLabel({ LinkedEventID: 99 }, refs)).toBe('Event: #99');
    expect(expenseReferenceLabel({}, refs)).toBe('General council expense');
  });

  it('marks a returned draft in red and each status in its brand tone', () => {
    expect(expenseStatusBadge({ Status: 'Draft', RejectionReason: 'Missing receipt' })).toEqual({ label: 'Returned', tone: 'redOutline' });
    expect(expenseStatusBadge({ Status: 'Draft', RejectionReason: null })).toEqual({ label: 'Draft', tone: 'outline' });
    expect(expenseStatusBadge({ Status: 'Submitted' })).toEqual({ label: 'Submitted', tone: 'gold' });
    expect(expenseStatusBadge({ Status: 'Approved' })).toEqual({ label: 'Approved', tone: 'navy' });
    expect(expenseStatusBadge({ Status: 'Reimbursed' })).toEqual({ label: 'Reimbursed', tone: 'navy' });
  });

  it('turns form rows into line items, dropping untouched rows and naming a bad amount', () => {
    const today = '2026-09-28';
    const filled = { ...blankExpenseLine(today), VendorName: 'Costco', ExpenseDescription: 'Pancake mix', Amount: '$1,042.50 ', ReceiptPhotoURL: ' file:///media/receipt-1.jpg ' };
    expect(expenseLinesFromDrafts([filled, blankExpenseLine(today)])).toEqual([
      { DateOfExpense: today, Amount: 1042.5, VendorName: 'Costco', ExpenseDescription: 'Pancake mix', ReceiptPhotoURL: 'file:///media/receipt-1.jpg' },
    ]);
    expect(expenseLinesFromDrafts([{ ...filled, ReceiptPhotoURL: '' }])[0].ReceiptPhotoURL).toBeNull();
    expect(() => expenseLinesFromDrafts([filled, { ...filled, Amount: '' }])).toThrow('Line item 2 needs an amount.');
    expect(() => expenseLinesFromDrafts([{ ...filled, Amount: 'twelve' }])).toThrow('Line item 1 amount must be a dollar amount such as 42.50; received "twelve".');
    // A row holding only a scanned receipt is kept, so the missing amount is reported rather than the photo lost.
    expect(() => expenseLinesFromDrafts([{ ...blankExpenseLine(today), ReceiptPhotoURL: 'file:///media/r.jpg' }])).toThrow('Line item 1 needs an amount.');
    expect(expenseLinesFromDrafts([blankExpenseLine(today)])).toEqual([]);
    expect(expenseLineDraftFrom({ DateOfExpense: today, Amount: 42.5, VendorName: 'Costco', ExpenseDescription: 'Mix', ReceiptPhotoURL: null })).toEqual({
      DateOfExpense: today,
      Amount: '42.5',
      VendorName: 'Costco',
      ExpenseDescription: 'Mix',
      ReceiptPhotoURL: '',
    });
  });

  it('keeps a running total to the cent, skipping amounts not yet typed as numbers', () => {
    const line = (Amount: string) => ({ ...blankExpenseLine('2026-09-28'), Amount });
    expect(expenseDraftTotal([line('19.99'), line('0.01'), line(''), line('abc'), line('$1,000')])).toBe(1020);
  });
});

describe.each(drivers)('self-payout ($name driver, Sprint 5R-2)', (d) => {
  it('stops an Admin paying their own sheet and writes nothing, even alongside a colleague’s', async () => {
    const db = await d.make();
    const own = await approvedReport(db, MEMBER.admin);
    const colleague = await approvedReport(db, MEMBER.member);
    const err = await expectRule(db.expenses.recordDisbursement(MEMBER.admin, OWN, [colleague, own], CHECK), 'SELF_PAYOUT_BLOCKED');
    expect(err.message).toBe('For accounting controls, an officer cannot issue a check that pays their own expense report.');
    await expectRule(db.expenses.recordDisbursement(MEMBER.admin, OWN, [own], CHECK), 'SELF_PAYOUT_BLOCKED');
    expect(d.count(db, 'ExpenseDisbursement')).toBe(0);
    expect((await db.expenses.listCouncilQueue(MEMBER.admin, OWN)).map((q) => q.report.Status)).toEqual(['Approved', 'Approved']);
  });

  it('stops a Treasurer paying their own sheet, but not a colleague’s', async () => {
    const db = await d.make();
    grantRole(d, db, MEMBER.member, 'Treasurer');
    const own = await approvedReport(db, MEMBER.member);
    const colleague = await approvedReport(db, MEMBER.admin);
    await expectRule(db.expenses.recordDisbursement(MEMBER.member, OWN, [own], CHECK), 'SELF_PAYOUT_BLOCKED');
    const paid = await db.expenses.recordDisbursement(MEMBER.member, OWN, [colleague], CHECK);
    expect(paid.reports.map((r) => r.report.Status)).toEqual(['Reimbursed']);
    // Another officer then pays the Treasurer's own sheet.
    await db.expenses.recordDisbursement(MEMBER.admin, OWN, [own], { ...CHECK, CheckNumber: '1043' });
    expect(d.count(db, 'ExpenseDisbursement')).toBe(2);
  });

  it('lets a Super Admin pay their own sheet as the override', async () => {
    const db = await d.make();
    const own = await approvedReport(db, MEMBER.superAdmin);
    const result = await db.expenses.recordDisbursement(MEMBER.superAdmin, OWN, [own], CHECK);
    expect(result.reports[0].report).toMatchObject({ Status: 'Reimbursed', DisbursementID: result.disbursement.id });
  });

  it('checks leadership before looking at who submitted', async () => {
    const db = await d.make();
    const own = await approvedReport(db, MEMBER.member);
    await expectPrivilege(db.expenses.recordDisbursement(MEMBER.member, OWN, [own], CHECK), 'ADMIN_REQUIRED');
  });

  it('lists the council’s events and meetings, newest first, for the Event-or-Meeting picker', async () => {
    const db = await d.make();
    const refs = await listExpenseReferences(db, OWN);
    expect(refs.events).toEqual(await db.events.listByCouncil(OWN));
    expect(refs.meetings.length).toBeGreaterThan(0);
    expect(refs.meetings.every((m) => m.CouncilID === OWN)).toBe(true);
    const dates = refs.meetings.map((m) => m.Date);
    expect(dates).toEqual([...dates].sort().reverse());
  });
});
