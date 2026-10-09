// Sprint 5R: expense reporting (expenses.listUserReports, listCouncilQueue, submitReport and recordDisbursement), its role gates and its tenant isolation. Sprint 5R-1.5: no self-approval, rejectReport, and
// approved expenses in reports.monthlySummary. Sprint 5R-2: no self-payout and the shared expense form helpers.
// Sprint 5S: no Super Admin override on either control, and only finance officers (or a Super Admin) issue checks.
// Sprint 5Z-3: dual approval, the Financial Secretary written order then the Grand Knight counter-signature.
// Sprint 5Z-4: approveReport retired, the Grand Knight Authorization Desk read, the dual-signed checkbook vault and the
// desk permission gates.
import { describe, expect, it } from 'vitest';
import {
  assertMayDisburseCouncilExpenses,
  assertNoSelfPayout,
  assertNotSelfApproval,
  blankExpenseLine,
  BusinessRuleError,
  awaitsCounterSignature,
  awaitsTreasurerCoding,
  awaitsWrittenOrder,
  canAuditCouncilExpenses,
  canCounterSignExpenseOrder,
  canDisburseCouncilExpenses,
  canIssueExpenseOrder,
  canOpenExpenseAuditDesk,
  canOpenExpenseAuthorizeDesk,
  canPayExpenseReport,
  expenseCounterSignBlock,
  expenseOrderBlock,
  isPayableExpenseReport,
  portalAreas,
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
  mayDisburseCouncilExpenses,
  mayAuthorizeExpenseOrder,
  mayIssueExpenseOrder,
  parseExpenseReferenceKey,
  REJECTION_REASON_MAX_LENGTH,
  summarizeMonth,
  SecurityPrivilegeError,
  sumAmounts,
  toTimestamp,
  type DataService,
  type ExpenseLineItemInput,
  type MemberWriteActor,
} from '@kofc/shared';
import { MemoryDataService } from '../apps/web/services/drivers/memory';
import { drivers, expectRule, ledgerCoder, MEMBER, NOW, testBudgetLine, testExpenseAccount, treasurerCode, type DriverUnderTest } from './helpers';
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

async function expectPrivilege(promise: Promise<unknown>, code: 'ADMIN_REQUIRED' | 'COUNCIL_ACCESS_DENIED' | 'FINANCE_OFFICER_REQUIRED') {
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

/** A second Active Super Admin per service, created on first use, for sheets the seeded signers may not both sign. */
const extraSuperAdmins = new WeakMap<DataService, number>();
async function secondSuperAdmin(db: DataService): Promise<number> {
  const known = extraSuperAdmins.get(db);
  if (known !== undefined) return known;
  const types = await db.lookups.list('MemberType');
  const statuses = await db.lookups.list('MemberStatus');
  const member = await db.members.create(MEMBER.superAdmin, {
    CouncilID: OWN,
    MemberNumber: 7799999,
    MemberFirstName: 'Second',
    MemberLastName: 'Signer',
    Phone: '503-555-0199',
    StreetAddress1: '2 Charity Way',
    City: 'Salem',
    State: 'OR',
    ZipCode: '97301',
    Email: 'second.signer@example.org',
    DateOfBirth: '1968-03-03',
    StatusID: statuses.find((s) => s.Status === 'Active')!.id,
    DegreeID: 3,
    MemberTypeID: types.find((t) => t.Type === 'Super Admin')!.id,
  });
  extraSuperAdmins.set(db, member.id);
  return member.id;
}

/**
 * Signs a submitted sheet through dual approval (Sprint 5Z-3), choosing two different officers who may sign it: the
 * seeded Financial Secretary (Admin 2) or Super Admin for the order, the seeded Grand Knight (Super Admin 1) or a second
 * Super Admin for the counter-signature. Approval has no other path since Sprint 5Z-4.
 */
async function dualApprove(db: DataService, report: { id: number; CouncilID: number; SubmitterMemberID: number }): Promise<void> {
  const orderSigners = report.CouncilID === OWN ? [MEMBER.admin, MEMBER.superAdmin] : [MEMBER.superAdmin];
  const fs = orderSigners.find((id) => id !== report.SubmitterMemberID) ?? (await secondSuperAdmin(db));
  const gk = [MEMBER.superAdmin].find((id) => id !== report.SubmitterMemberID && id !== fs) ?? (await secondSuperAdmin(db));
  await db.expenses.financialSecretaryAuditOrder(fs, report.id);
  await treasurerCode(db, report.id);
  await db.expenses.grandKnightAuthorizeOrder(gk, report.id);
}

/** Submits a sheet for `memberId` and signs it through dual approval; resolves to its id. */
async function approvedReport(db: DataService, memberId: number, items = [receipt()]): Promise<number> {
  const { report } = await db.expenses.submitReport(memberId, { Status: 'Submitted' }, items);
  await dualApprove(db, report);
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

  describe('listCouncilQueue', () => {
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

    it('offers no single-step approval: a sheet is approved only by its two signatures (Sprint 5Z-4)', async () => {
      const db = await d.make();
      expect('approveReport' in db.expenses).toBe(false);
      const { report } = await db.expenses.submitReport(MEMBER.member, { Status: 'Submitted' }, [receipt()]);
      expect((await db.expenses.financialSecretaryAuditOrder(MEMBER.admin, report.id)).report.Status).toBe('Submitted');
      await treasurerCode(db, report.id);
      expect((await db.expenses.grandKnightAuthorizeOrder(MEMBER.superAdmin, report.id)).report.Status).toBe('Approved');
    });
  });

  describe('recordDisbursement', () => {
    it('pays approved sheets with one check, totals them and stamps each Reimbursed', async () => {
      const db = await d.make();
      const a = await approvedReport(db, MEMBER.member, [receipt({ Amount: 19.99 }), receipt({ Amount: 0.01 })]);
      const b = await approvedReport(db, MEMBER.newMember, [receipt({ Amount: 100.1 })]);
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
      await expectPrivilege(db.expenses.recordDisbursement(MEMBER.member, OWN, [own], CHECK), 'FINANCE_OFFICER_REQUIRED');
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

  it('blocks approving your own sheet for every role, Super Admins included (Sprint 5S)', () => {
    expect(() => assertNotSelfApproval(actor(), { id: 7, SubmitterMemberID: 10 })).toThrow(
      'For accounting controls, an officer cannot approve their own expense report.',
    );
    expect(() => assertNotSelfApproval(actor({ roles: ['Treasurer'], memberType: 'Member' }), { id: 7, SubmitterMemberID: 10 })).toThrow();
    expect(() => assertNotSelfApproval(actor({ memberType: 'Super Admin', active: false }), { id: 7, SubmitterMemberID: 10 })).toThrow();
    expect(() => assertNotSelfApproval(actor({ memberType: 'Super Admin' }), { id: 7, SubmitterMemberID: 10 })).toThrow('cannot approve their own');
    expect(() => assertNotSelfApproval(actor(), { id: 7, SubmitterMemberID: 11 })).not.toThrow();
  });


  it('adds approved expenses to the month’s spend and nets them against funds raised', () => {
    const summary = summarizeMonth(OWN, 2026, 9, {
      events: [{ id: 1, StartDate: '2026-09-03', 'FundsRaised-Cash': 50 } as never],
      eventTime: [],
      activityTime: [],
      expenseItems: [{ Amount: 19.99 }, { Amount: 0.01 }],
      charitableGifts: [],
    });
    // Sprint 6I: spend is expense lines and charity checks only (Event.Spend was dropped in schema 47).
    expect(summary.finances).toEqual({ spend: 20, expenses: 20, charitableGiving: 0, cash: 50, electronic: 0, raised: 50, net: 30 });
  });
});

describe.each(drivers)('financial controls ($name driver, Sprint 5R-1.5)', (d) => {
  describe('self-approval', () => {
    it('stops the Financial Secretary ordering their own sheet and leaves it unsigned', async () => {
      const db = await d.make();
      const { report } = await db.expenses.submitReport(MEMBER.admin, { Status: 'Submitted' }, [receipt()]);
      const err = await expectRule(db.expenses.financialSecretaryAuditOrder(MEMBER.admin, report.id), 'SELF_APPROVAL_BLOCKED');
      expect(err.message).toBe('For accounting controls, an officer cannot approve their own expense report.');
      const [mine] = await db.expenses.listUserReports(MEMBER.admin);
      expect(mine.report).toMatchObject({ Status: 'Submitted', FinancialSecretaryMemberID: null });
    });

    it('stops a Super Admin signing either line of their own sheet too: there is no override (Sprint 5S)', async () => {
      const db = await d.make();
      const { report } = await db.expenses.submitReport(MEMBER.superAdmin, { Status: 'Submitted' }, [receipt()]);
      await expectRule(db.expenses.financialSecretaryAuditOrder(MEMBER.superAdmin, report.id), 'SELF_APPROVAL_BLOCKED');
      await db.expenses.financialSecretaryAuditOrder(MEMBER.admin, report.id);
      await expectRule(db.expenses.grandKnightAuthorizeOrder(MEMBER.superAdmin, report.id), 'SELF_APPROVAL_BLOCKED');
      const [mine] = await db.expenses.listUserReports(MEMBER.superAdmin);
      expect(mine.report.Status).toBe('Submitted');
      // Another officer counter-signs it.
      await treasurerCode(db, report.id);
      await db.expenses.grandKnightAuthorizeOrder(await secondSuperAdmin(db), report.id);
      expect((await db.expenses.listUserReports(MEMBER.superAdmin))[0].report.Status).toBe('Approved');
    });

    it('still refuses a plain member before looking at who submitted', async () => {
      const db = await d.make();
      const { report } = await db.expenses.submitReport(MEMBER.member, { Status: 'Submitted' }, [receipt()]);
      await expectRule(db.expenses.financialSecretaryAuditOrder(MEMBER.member, report.id), 'FINANCIAL_SECRETARY_REQUIRED');
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
      await dualApprove(db, resubmitted.report);
      expect((await db.expenses.listUserReports(MEMBER.member))[0].report.Status).toBe('Approved');
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
      spend: Math.round((before.finances.spend - before.finances.expenses + 25.55) * 100) / 100,
      net: Math.round((before.finances.net + before.finances.expenses - 25.55) * 100) / 100,
    });
    expect((await db.reports.monthlySummary(OWN, 2026, 8)).finances.expenses).toBe(august.finances.expenses + 7);
    expect((await db.reports.monthlySummary(OTHER, 2026, 9)).finances.expenses).toBe(50);
  });
});

describe('self-payout and the expense forms (pure, Sprint 5R-2)', () => {
  const actor = (over: Partial<MemberWriteActor> = {}): MemberWriteActor => ({ memberId: 10, councilId: OWN, memberType: 'Admin', active: true, ...over });
  const user = (over = {}) => ({ memberId: 10, councilId: OWN, memberType: 'Admin' as const, isOfficer: false, ...over });

  it('blocks paying your own sheet for every role, Super Admins included (Sprint 5S)', () => {
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
    expect(() => assertNoSelfPayout(actor({ memberType: 'Super Admin' }), { id: 7, SubmitterMemberID: 10 })).toThrow('pays their own expense report');
    expect(() => assertNoSelfPayout(actor(), { id: 7, SubmitterMemberID: 11 })).not.toThrow();
  });

  it('mirrors the rules in the pay checkbox: finance officers or a Super Admin, never on their own sheet', () => {
    const treasurer = (over = {}) => user({ memberType: 'Member', roles: ['Treasurer'], ...over });
    expect(canPayExpenseReport(treasurer(), { CouncilID: OWN, SubmitterMemberID: 11 })).toBe(true);
    expect(canPayExpenseReport(treasurer(), { CouncilID: OWN, SubmitterMemberID: 10 })).toBe(false);
    expect(canPayExpenseReport(treasurer(), { CouncilID: OTHER, SubmitterMemberID: 11 })).toBe(false);
    expect(canPayExpenseReport(user({ roles: ['Financial Secretary'] }), { CouncilID: OWN, SubmitterMemberID: 11 })).toBe(true);
    // A council Admin without a finance role audits the queue but does not pay it.
    expect(canPayExpenseReport(user(), { CouncilID: OWN, SubmitterMemberID: 11 })).toBe(false);
    expect(canPayExpenseReport(user({ memberType: 'Super Admin' }), { CouncilID: OTHER, SubmitterMemberID: 11 })).toBe(true);
    expect(canPayExpenseReport(user({ memberType: 'Super Admin' }), { CouncilID: OTHER, SubmitterMemberID: 10 })).toBe(false);
    expect(canPayExpenseReport(user({ memberType: 'Member' }), { CouncilID: OWN, SubmitterMemberID: 11 })).toBe(false);
  });

  it('opens the check ledger only to a council’s finance officers and Super Admins (Sprint 5S)', () => {
    expect(canDisburseCouncilExpenses(user({ memberType: 'Member', roles: ['Treasurer'] }), OWN)).toBe(true);
    expect(canDisburseCouncilExpenses(user({ memberType: 'Member', roles: ['Financial Secretary'] }), OWN)).toBe(true);
    expect(canDisburseCouncilExpenses(user({ memberType: 'Member', roles: ['Treasurer'] }), OTHER)).toBe(false);
    expect(canDisburseCouncilExpenses(user(), OWN)).toBe(false);
    expect(canDisburseCouncilExpenses(user({ roles: ['Grand Knight'] }), OWN)).toBe(false);
    expect(canDisburseCouncilExpenses(user({ memberType: 'Super Admin' }), OTHER)).toBe(true);

    const deny = (a: MemberWriteActor, councilId = OWN) => {
      try {
        assertMayDisburseCouncilExpenses(a, councilId, 'record expense checks');
        return null;
      } catch (e) {
        return (e as SecurityPrivilegeError).code;
      }
    };
    expect(deny(actor())).toBe('FINANCE_OFFICER_REQUIRED');
    expect(deny(actor({ roles: ['Treasurer'], memberType: 'Member', active: false }))).toBe('FINANCE_OFFICER_REQUIRED');
    expect(deny(actor({ roles: ['Treasurer'], memberType: 'Member' }))).toBeNull();
    expect(deny(actor({ roles: ['Financial Secretary'] }), OTHER)).toBe('COUNCIL_ACCESS_DENIED');
    expect(deny(actor({ memberType: 'Super Admin' }), OTHER)).toBeNull();
    expect(deny(actor({ memberType: 'Super Admin', active: false }))).toBe('FINANCE_OFFICER_REQUIRED');
    expect(mayDisburseCouncilExpenses(actor({ roles: ['Treasurer'] }), OWN)).toBe(true);
  });

  it('round-trips the single Event, Meeting or Activity picker key', () => {
    const none = { LinkedEventID: null, LinkedMeetingID: null, LinkedActivityID: null };
    expect(expenseReferenceKey({ LinkedEventID: 12, LinkedMeetingID: null })).toBe('event:12');
    expect(expenseReferenceKey({ LinkedEventID: null, LinkedMeetingID: 3 })).toBe('meeting:3');
    expect(expenseReferenceKey({ LinkedActivityID: 5 })).toBe('activity:5');
    expect(expenseReferenceKey({})).toBe('');
    expect(expenseReferenceKey({ LinkedEventID: 12, LinkedMeetingID: 3 })).toBe('event:12');
    expect(parseExpenseReferenceKey('event:12')).toEqual({ ...none, LinkedEventID: 12 });
    expect(parseExpenseReferenceKey('meeting:3')).toEqual({ ...none, LinkedMeetingID: 3 });
    expect(parseExpenseReferenceKey('activity:5')).toEqual({ ...none, LinkedActivityID: 5 });
    expect(parseExpenseReferenceKey('')).toEqual(none);
    expect(parseExpenseReferenceKey('council:1')).toEqual(none);
  });

  it('labels the picker choices and a sheet’s reference', () => {
    const refs = {
      events: [{ id: 12, EventName: 'Pancake Breakfast', StartDate: '2026-09-12' } as never],
      meetings: [{ id: 3, 'Meeting Name': 'Business Meeting', Date: '2025-12-02' } as never],
      activities: [{ id: 5, ActivityName: 'Ultrasound', CouncilID: OWN } as never],
    };
    expect(expenseReferenceChoices(refs)).toEqual([
      { group: 'Events', key: 'event:12', label: 'Pancake Breakfast · Sat, Sep 12, 2026' },
      { group: 'Meetings', key: 'meeting:3', label: 'Business Meeting · Tue, Dec 2, 2025' },
      { group: 'Activities', key: 'activity:5', label: 'Ultrasound · ongoing' },
    ]);
    expect(expenseReferenceLabel({ LinkedActivityID: 5 }, refs)).toBe('Activity: Ultrasound');
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

  it('stops a Super Admin paying their own sheet too: there is no override (Sprint 5S)', async () => {
    const db = await d.make();
    const { report } = await db.expenses.submitReport(MEMBER.superAdmin, { Status: 'Submitted' }, [receipt()]);
    await dualApprove(db, report);
    await expectRule(db.expenses.recordDisbursement(MEMBER.superAdmin, OWN, [report.id], CHECK), 'SELF_PAYOUT_BLOCKED');
    expect(d.count(db, 'ExpenseDisbursement')).toBe(0);
    // The council's Financial Secretary (the seeded Admin) pays it instead.
    const result = await db.expenses.recordDisbursement(MEMBER.admin, OWN, [report.id], CHECK);
    expect(result.reports[0].report).toMatchObject({ Status: 'Reimbursed', DisbursementID: result.disbursement.id });
  });

  it('checks the finance role before looking at who submitted', async () => {
    const db = await d.make();
    const own = await approvedReport(db, MEMBER.member);
    await expectPrivilege(db.expenses.recordDisbursement(MEMBER.member, OWN, [own], CHECK), 'FINANCE_OFFICER_REQUIRED');
  });
});

describe.each(drivers)('finance-officer disbursements ($name driver, Sprint 5S)', (d) => {
  it('lets a council Admin without a finance role audit the queue but not issue checks', async () => {
    const db = await d.make();
    const plainAdmin = await addMember(db, OWN, 'Admin', 'plain.expense.admin@example.org');
    const { report } = await db.expenses.submitReport(MEMBER.member, { Status: 'Submitted' }, [receipt()]);
    expect((await db.expenses.listCouncilQueue(plainAdmin, OWN)).map((q) => q.report.id)).toEqual([report.id]);
    await dualApprove(db, report);
    const err = await expectRule(db.expenses.recordDisbursement(plainAdmin, OWN, [report.id], CHECK), 'FINANCE_OFFICER_REQUIRED');
    expect(err).toBeInstanceOf(SecurityPrivilegeError);
    expect(d.count(db, 'ExpenseDisbursement')).toBe(0);
    // Given the Treasurer role, the same Admin may pay it.
    grantRole(d, db, plainAdmin, 'Treasurer');
    expect((await db.expenses.recordDisbursement(plainAdmin, OWN, [report.id], CHECK)).reports[0].report.Status).toBe('Reimbursed');
  });

  it('keeps a finance officer to their own council, while a Super Admin pays any council', async () => {
    const db = await d.make();
    const otherMember = await addMember(db, OTHER, 'Member', 'other.payee@example.org');
    const foreign = await approvedReport(db, otherMember);
    grantRole(d, db, MEMBER.member, 'Treasurer');
    await expectPrivilege(db.expenses.recordDisbursement(MEMBER.member, OTHER, [foreign], CHECK), 'COUNCIL_ACCESS_DENIED');
    expect((await db.expenses.recordDisbursement(MEMBER.superAdmin, OTHER, [foreign], CHECK)).reports[0].report.Status).toBe('Reimbursed');
  });

  it('refuses an inactive Treasurer', async () => {
    const db = await d.make();
    const inactive = await addMember(db, OWN, 'Member', 'inactive.treasurer@example.org', 'Inactive');
    grantRole(d, db, inactive, 'Treasurer');
    const report = await approvedReport(db, MEMBER.member);
    await expectPrivilege(db.expenses.recordDisbursement(inactive, OWN, [report], CHECK), 'FINANCE_OFFICER_REQUIRED');
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

describe('dual approval (pure, Sprint 5Z-3)', () => {
  const actor = (over: Partial<MemberWriteActor> = {}): MemberWriteActor => ({ memberId: 10, councilId: OWN, memberType: 'Member', active: true, ...over });

  it('gives the written order to the Financial Secretary and the counter-signature to the Grand Knight', () => {
    expect(mayIssueExpenseOrder(actor({ roles: ['Financial Secretary'] }), OWN)).toBe(true);
    expect(mayIssueExpenseOrder(actor({ roles: ['Financial Secretary'] }), OTHER)).toBe(false);
    expect(mayIssueExpenseOrder(actor({ roles: ['Financial Secretary'], active: false }), OWN)).toBe(false);
    expect(mayIssueExpenseOrder(actor({ roles: ['Treasurer'] }), OWN)).toBe(false);
    expect(mayIssueExpenseOrder(actor({ roles: ['Grand Knight'] }), OWN)).toBe(false);
    expect(mayIssueExpenseOrder(actor({ memberType: 'Admin' }), OWN)).toBe(false);
    expect(mayAuthorizeExpenseOrder(actor({ roles: ['Grand Knight'] }), OWN)).toBe(true);
    expect(mayAuthorizeExpenseOrder(actor({ roles: ['Grand Knight'] }), OTHER)).toBe(false);
    expect(mayAuthorizeExpenseOrder(actor({ roles: ['Deputy Grand Knight'] }), OWN)).toBe(false);
    expect(mayAuthorizeExpenseOrder(actor({ roles: ['Financial Secretary'] }), OWN)).toBe(false);
    for (const may of [mayIssueExpenseOrder, mayAuthorizeExpenseOrder]) {
      expect(may(actor({ memberType: 'Super Admin', councilId: 77 }), OTHER)).toBe(true);
      expect(may(actor({ memberType: 'Super Admin', active: false }), OWN)).toBe(false);
    }
  });
});

describe.each(drivers)('dual approval ($name driver, Sprint 5Z-3)', (d) => {
  const FS = MEMBER.admin; // seeded Financial Secretary of council 1
  const GK = MEMBER.superAdmin; // seeded Grand Knight of council 1 (also a Super Admin)
  const submitted = async (db: DataService, memberId: number = MEMBER.member) =>
    (await db.expenses.submitReport(memberId, { Status: 'Submitted' }, [receipt()])).report.id;

  it('takes a sheet from the written order to the counter-signature and on to the Treasurer', async () => {
    const db = await d.make();
    const id = await submitted(db);
    const ordered = (await db.expenses.financialSecretaryAuditOrder(FS, id)).report;
    expect(ordered).toMatchObject({ Status: 'Submitted', FinancialSecretaryMemberID: FS, FinancialSecretaryApprovedAt: toTimestamp(NOW) });
    expect(ordered.GrandKnightMemberID ?? null).toBeNull();
    await treasurerCode(db, id);
    const signed = (await db.expenses.grandKnightAuthorizeOrder(GK, id)).report;
    expect(signed).toMatchObject({
      Status: 'Approved',
      FinancialSecretaryMemberID: FS,
      GrandKnightMemberID: GK,
      GrandKnightApprovedAt: toTimestamp(NOW),
    });
    expect((await db.expenses.recordDisbursement(FS, OWN, [id], CHECK)).reports[0].report.Status).toBe('Reimbursed');
  });

  it('signs in order, once each', async () => {
    const db = await d.make();
    const id = await submitted(db);
    await expectRule(db.expenses.grandKnightAuthorizeOrder(GK, id), 'EXPENSE_STATUS_CONFLICT');
    await db.expenses.financialSecretaryAuditOrder(FS, id);
    await expectRule(db.expenses.financialSecretaryAuditOrder(FS, id), 'EXPENSE_STATUS_CONFLICT');
    await treasurerCode(db, id);
    await db.expenses.grandKnightAuthorizeOrder(GK, id);
    await expectRule(db.expenses.grandKnightAuthorizeOrder(GK, id), 'EXPENSE_STATUS_CONFLICT');
    const draft = (await db.expenses.submitReport(MEMBER.member, { Status: 'Draft' }, [])).report.id;
    await expectRule(db.expenses.financialSecretaryAuditOrder(FS, draft), 'EXPENSE_STATUS_CONFLICT');
    await expectRule(db.expenses.financialSecretaryAuditOrder(FS, 9999), 'RECORD_NOT_FOUND');
  });

  it('refuses anyone without the seat, another council’s officers and inactive officers', async () => {
    const db = await d.make();
    const id = await submitted(db);
    const plainAdmin = await addMember(db, OWN, 'Admin', 'plain.signer.admin@example.org');
    const treasurer = await addMember(db, OWN, 'Member', 'dual.treasurer@example.org');
    grantRole(d, db, treasurer, 'Treasurer');
    const dgk = await addMember(db, OWN, 'Member', 'dual.dgk@example.org');
    grantRole(d, db, dgk, 'Deputy Grand Knight');
    for (const actorId of [MEMBER.member, plainAdmin, treasurer, dgk]) {
      const err = await expectRule(db.expenses.financialSecretaryAuditOrder(actorId, id), 'FINANCIAL_SECRETARY_REQUIRED');
      expect(err).toBeInstanceOf(SecurityPrivilegeError);
    }
    const foreignFs = await addMember(db, OTHER, 'Member', 'foreign.fs@example.org');
    grantRole(d, db, foreignFs, 'Financial Secretary');
    await expectRule(db.expenses.financialSecretaryAuditOrder(foreignFs, id), 'COUNCIL_ACCESS_DENIED');
    const inactiveFs = await addMember(db, OWN, 'Member', 'inactive.fs@example.org', 'Inactive');
    grantRole(d, db, inactiveFs, 'Financial Secretary');
    await expectRule(db.expenses.financialSecretaryAuditOrder(inactiveFs, id), 'FINANCIAL_SECRETARY_REQUIRED');

    await db.expenses.financialSecretaryAuditOrder(FS, id);
    for (const actorId of [MEMBER.member, plainAdmin, treasurer, dgk]) {
      const err = await expectRule(db.expenses.grandKnightAuthorizeOrder(actorId, id), 'GRAND_KNIGHT_REQUIRED');
      expect(err).toBeInstanceOf(SecurityPrivilegeError);
    }
    const foreignGk = await addMember(db, OTHER, 'Member', 'foreign.gk@example.org');
    grantRole(d, db, foreignGk, 'Grand Knight');
    await expectRule(db.expenses.grandKnightAuthorizeOrder(foreignGk, id), 'COUNCIL_ACCESS_DENIED');
    // The refused calls wrote nothing.
    const queued = (await db.expenses.listCouncilQueue(FS, OWN)).find((q) => q.report.id === id)!.report;
    expect(queued).toMatchObject({ Status: 'Submitted', FinancialSecretaryMemberID: FS });
    expect(queued.GrandKnightMemberID ?? null).toBeNull();
  });

  it('never lets an officer sign their own sheet, nor one person sign both lines', async () => {
    const db = await d.make();
    await expectRule(db.expenses.financialSecretaryAuditOrder(FS, await submitted(db, FS)), 'SELF_APPROVAL_BLOCKED');
    const gkOwn = await submitted(db, GK);
    await db.expenses.financialSecretaryAuditOrder(FS, gkOwn);
    await expectRule(db.expenses.grandKnightAuthorizeOrder(GK, gkOwn), 'SELF_APPROVAL_BLOCKED');
    // The Super Admin may issue the order for any council, but then cannot also counter-sign it.
    const id = await submitted(db);
    await db.expenses.financialSecretaryAuditOrder(GK, id);
    // Sprint 6Q: the order's issuer may not code the sheet either, nor may the Treasurer who coded it counter-sign.
    await expectRule(db.expenses.treasurerLedgerAudit(GK, id, { budgetLineId: testBudgetLine(db, OWN), generalLedgerAccountId: testExpenseAccount(db, OWN) }), 'DUAL_SIGNATURE_CONFLICT');
    await treasurerCode(db, id);
    await expectRule(db.expenses.grandKnightAuthorizeOrder(GK, id), 'DUAL_SIGNATURE_CONFLICT');
    await expectRule(db.expenses.grandKnightAuthorizeOrder(await ledgerCoder(db), id), 'DUAL_SIGNATURE_CONFLICT');
    const secondGk = await addMember(db, OWN, 'Member', 'second.gk@example.org');
    grantRole(d, db, secondGk, 'Grand Knight');
    expect((await db.expenses.grandKnightAuthorizeOrder(secondGk, id)).report.Status).toBe('Approved');
  });

  it('clears both signatures when leadership returns the sheet, so it is signed afresh', async () => {
    const db = await d.make();
    const id = await submitted(db);
    await db.expenses.financialSecretaryAuditOrder(FS, id);
    const returned = (await db.expenses.rejectReport(FS, id, 'Missing the Costco receipt')).report;
    expect(returned).toMatchObject({ Status: 'Draft', FinancialSecretaryMemberID: null, FinancialSecretaryApprovedAt: null });
    await db.expenses.submitReport(MEMBER.member, { id, Status: 'Submitted' }, [receipt()]);
    await expectRule(db.expenses.grandKnightAuthorizeOrder(GK, id), 'EXPENSE_STATUS_CONFLICT');
    await db.expenses.financialSecretaryAuditOrder(FS, id);
    await treasurerCode(db, id);
    expect((await db.expenses.grandKnightAuthorizeOrder(GK, id)).report.Status).toBe('Approved');
  });
});

describe('dual-approval desks and vault (pure, Sprint 5Z-4)', () => {
  const report = (over = {}) => ({ Status: 'Submitted' as const, FinancialSecretaryMemberID: null, TreasurerMemberID: null, GrandKnightMemberID: null, ...over });

  it('sorts a sheet onto its desk, and only a dual-signed approved sheet into the vault', () => {
    expect(awaitsWrittenOrder(report())).toBe(true);
    expect(awaitsCounterSignature(report())).toBe(false);
    expect(awaitsWrittenOrder(report({ FinancialSecretaryMemberID: 2 }))).toBe(false);
    // Sprint 6Q: an ordered sheet waits for the Treasurer's coding before it reaches the Grand Knight.
    expect(awaitsTreasurerCoding(report({ FinancialSecretaryMemberID: 2 }))).toBe(true);
    expect(awaitsCounterSignature(report({ FinancialSecretaryMemberID: 2 }))).toBe(false);
    expect(awaitsTreasurerCoding(report({ FinancialSecretaryMemberID: 2, TreasurerMemberID: 7 }))).toBe(false);
    expect(awaitsCounterSignature(report({ FinancialSecretaryMemberID: 2, TreasurerMemberID: 7 }))).toBe(true);
    expect(expenseStatusBadge({ Status: 'Submitted', RejectionReason: null, FinancialSecretaryMemberID: 2, TreasurerMemberID: 7 })).toEqual({
      label: 'Ledger Coded',
      tone: 'gold',
    });
    expect(awaitsWrittenOrder(report({ Status: 'Draft' }))).toBe(false);
    expect(isPayableExpenseReport(report({ Status: 'Approved', FinancialSecretaryMemberID: 2, GrandKnightMemberID: 1 }))).toBe(true);
    // A sheet approved without both signatures (such as one approved before Sprint 5Z-3) never reaches the checkbook.
    expect(isPayableExpenseReport(report({ Status: 'Approved' }))).toBe(false);
    expect(isPayableExpenseReport(report({ Status: 'Approved', FinancialSecretaryMemberID: 2 }))).toBe(false);
    expect(isPayableExpenseReport(report({ Status: 'Reimbursed', FinancialSecretaryMemberID: 2, GrandKnightMemberID: 1 }))).toBe(false);
    expect(expenseStatusBadge({ Status: 'Submitted', RejectionReason: null, FinancialSecretaryMemberID: 2 })).toEqual({ label: 'Order Issued', tone: 'gold' });
    expect(expenseStatusBadge({ Status: 'Submitted', RejectionReason: null })).toEqual({ label: 'Submitted', tone: 'gold' });
  });

  const user = (over = {}) => ({ memberId: 10, councilId: OWN, memberType: 'Member' as const, isOfficer: true, roles: [] as string[], ...over });
  const sheet = (over = {}) => ({ CouncilID: OWN, SubmitterMemberID: 11, FinancialSecretaryMemberID: 12, ...over });

  it('opens the audit desk to the Financial Secretary, Admins and Super Admins', () => {
    expect(canOpenExpenseAuditDesk(user({ roles: ['Financial Secretary'] }), OWN)).toBe(true);
    expect(canOpenExpenseAuditDesk(user({ roles: ['Financial Secretary'] }), OTHER)).toBe(false);
    expect(canOpenExpenseAuditDesk(user({ memberType: 'Admin' }), OWN)).toBe(true);
    expect(canOpenExpenseAuditDesk(user({ memberType: 'Super Admin' }), OTHER)).toBe(true);
    expect(canOpenExpenseAuditDesk(user({ roles: ['Treasurer'] }), OWN)).toBe(false);
    expect(canOpenExpenseAuditDesk(user({ roles: ['Grand Knight'] }), OWN)).toBe(false);
  });

  it('opens the authorization desk to the Grand Knight, Admins and Super Admins', () => {
    expect(canOpenExpenseAuthorizeDesk(user({ roles: ['Grand Knight'] }), OWN)).toBe(true);
    expect(canOpenExpenseAuthorizeDesk(user({ roles: ['Grand Knight'] }), OTHER)).toBe(false);
    expect(canOpenExpenseAuthorizeDesk(user({ memberType: 'Admin' }), OWN)).toBe(true);
    expect(canOpenExpenseAuthorizeDesk(user({ memberType: 'Super Admin' }), OTHER)).toBe(true);
    expect(canOpenExpenseAuthorizeDesk(user({ roles: ['Deputy Grand Knight'] }), OWN)).toBe(false);
    expect(canOpenExpenseAuthorizeDesk(user({ roles: ['Financial Secretary'] }), OWN)).toBe(false);
  });

  it('lets only the seat or a Super Admin sign, never their own sheet, and locks the order-giver with the Collusion Guard', () => {
    expect(expenseOrderBlock(user({ roles: ['Financial Secretary'] }), sheet())).toBeNull();
    expect(canIssueExpenseOrder(user({ memberType: 'Super Admin' }), sheet({ CouncilID: OTHER }))).toBe(true);
    expect(expenseOrderBlock(user({ memberType: 'Admin' }), sheet())).toBe('seat');
    expect(expenseOrderBlock(user({ roles: ['Financial Secretary'] }), sheet({ CouncilID: OTHER }))).toBe('seat');
    expect(expenseOrderBlock(user({ roles: ['Financial Secretary'] }), sheet({ SubmitterMemberID: 10 }))).toBe('own-report');

    expect(expenseCounterSignBlock(user({ roles: ['Grand Knight'] }), sheet())).toBeNull();
    expect(canCounterSignExpenseOrder(user({ memberType: 'Super Admin' }), sheet({ CouncilID: OTHER }))).toBe(true);
    expect(expenseCounterSignBlock(user({ memberType: 'Admin' }), sheet())).toBe('seat');
    expect(expenseCounterSignBlock(user({ roles: ['Grand Knight'] }), sheet({ SubmitterMemberID: 10 }))).toBe('own-report');
    expect(expenseCounterSignBlock(user({ memberType: 'Super Admin' }), sheet({ FinancialSecretaryMemberID: 10 }))).toBe('collusion');
  });

  it('puts each desk in the navigation of those who open it', () => {
    const areas = (over = {}) => portalAreas(user(over));
    expect(areas({ roles: ['Financial Secretary'] })).toEqual(expect.arrayContaining(['expenses/audit']));
    expect(areas({ roles: ['Financial Secretary'] })).not.toContain('expenses/authorize');
    expect(areas({ roles: ['Grand Knight'] })).toEqual(expect.arrayContaining(['expenses/authorize']));
    expect(areas({ roles: ['Grand Knight'] })).not.toContain('expenses/audit');
    expect(areas({ memberType: 'Admin' })).toEqual(expect.arrayContaining(['expenses/audit', 'expenses/authorize']));
    expect(areas({ roles: ['Treasurer'] })).not.toContain('expenses/audit');
    expect(areas()).not.toContain('expenses/audit');
  });
});

describe.each(drivers)('dual-approval desks and vault ($name driver, Sprint 5Z-4)', (d) => {
  const submitted = async (db: DataService, memberId: number = MEMBER.member) =>
    (await db.expenses.submitReport(memberId, { Status: 'Submitted' }, [receipt()])).report;

  it('lists only ordered, uncountersigned sheets on the authorization desk, with the signer named', async () => {
    const db = await d.make();
    const waiting = await submitted(db);
    const ordered = await submitted(db);
    const done = await submitted(db);
    await db.expenses.financialSecretaryAuditOrder(MEMBER.admin, ordered.id);
    await dualApprove(db, done);
    // Sprint 6Q: the ordered sheet waits on the Treasurer desk first, then moves to the Grand Knight's.
    expect((await db.expenses.listTreasurerQueue(MEMBER.superAdmin, OWN)).map((q) => q.report.id)).toEqual([ordered.id]);
    expect(await db.expenses.listAuthorizationQueue(MEMBER.superAdmin, OWN)).toEqual([]);
    await treasurerCode(db, ordered.id);
    expect(await db.expenses.listTreasurerQueue(MEMBER.superAdmin, OWN)).toEqual([]);
    const desk = await db.expenses.listAuthorizationQueue(MEMBER.superAdmin, OWN);
    expect(desk.map((q) => q.report.id)).toEqual([ordered.id]);
    expect(desk[0]).toMatchObject({ financialSecretaryName: 'Council Admin', treasurerName: 'Ledger Coder', grandKnightName: '' });
    expect(desk.map((q) => q.report.id)).not.toContain(waiting.id);
    const [paid] = (await db.expenses.listCouncilQueue(MEMBER.admin, OWN)).filter((q) => q.report.id === done.id);
    expect(paid.grandKnightName).not.toBe('');
  });

  it('opens the authorization desk to the Grand Knight and Admins of the council only', async () => {
    const db = await d.make();
    const gk = await addMember(db, OWN, 'Member', 'desk.gk@example.org');
    grantRole(d, db, gk, 'Grand Knight');
    expect(await db.expenses.listAuthorizationQueue(gk, OWN)).toEqual([]);
    expect(await db.expenses.listAuthorizationQueue(MEMBER.admin, OWN)).toEqual([]);
    await expectPrivilege(db.expenses.listAuthorizationQueue(MEMBER.member, OWN), 'ADMIN_REQUIRED');
    const dgk = await addMember(db, OWN, 'Member', 'desk.dgk@example.org');
    grantRole(d, db, dgk, 'Deputy Grand Knight');
    await expectPrivilege(db.expenses.listAuthorizationQueue(dgk, OWN), 'ADMIN_REQUIRED');
    await expectPrivilege(db.expenses.listAuthorizationQueue(gk, OTHER), 'COUNCIL_ACCESS_DENIED');
    await expectRule(db.expenses.listAuthorizationQueue(MEMBER.superAdmin, 9999), 'INVALID_INPUT');
  });

  it('refuses to pay an approved sheet missing either signature, and writes nothing', async () => {
    const db = await d.make();
    const legacy = await submitted(db);
    // An 'Approved' sheet without signatures, as approveReport left them before Sprint 5Z-4.
    if (d.name === 'memory') {
      (db as MemoryDataService).debugStore.rows('ExpenseReport').find((r) => r.id === legacy.id)!.Status = 'Approved';
    } else {
      openDatabases.at(-1)!.prepare("UPDATE [ExpenseReport] SET [Status] = 'Approved' WHERE [id] = ?").run(legacy.id);
    }
    const signed = await approvedReport(db, MEMBER.member);
    await expectRule(db.expenses.recordDisbursement(MEMBER.admin, OWN, [signed, legacy.id], CHECK), 'EXPENSE_STATUS_CONFLICT');
    expect(d.count(db, 'ExpenseDisbursement')).toBe(0);
    const queue = await db.expenses.listCouncilQueue(MEMBER.admin, OWN);
    expect(queue.filter((q) => isPayableExpenseReport(q.report)).map((q) => q.report.id)).toEqual([signed]);
    expect((await db.expenses.recordDisbursement(MEMBER.admin, OWN, [signed], CHECK)).reports[0].report.Status).toBe('Reimbursed');
  });
});
