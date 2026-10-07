import { describe, expect, it } from 'vitest';
import {
  canAdministerCouncil,
  canAppointOfficers,
  canChangeDonation,
  canConfigureBallot,
  canMaintainCouncilRecords,
  canDispatchCouncilAlerts,
  canManageFinances,
  canManageBudgetForecast,
  canEditBudgetYear,
  canApproveBudget,
  canFinalizeBudgetYear,
  canReviewBudgetPerformance,
  canViewBudgetForecast,
  canDesignateBudgetDirector,
  portalAreaHref,
  canSyncSupremeReports,
  isFinanceOfficer,
  canMaintainCouncils,
  canMaintainLookups,
  canManageMeetings,
  canOpenCouncilLookups,
  canViewExecutiveAudits,
  councilLookupTablesFor,
  canPlanEvents,
  canRecordLedger,
  canConnectCouncilCharity,
  canDisburseCharity,
  canManageCharityRegistry,
  canReviewCharityProposals,
  canOverrideVettingClaim,
  canReviewBudgetPerformance,
  canVetCharitableRequests,
  canViewExecutiveDashboard,
  portalAreas,
  portalNavGroups,
  canEditDistributionList,
  canPublishDistributionList,
  portalSidebar,
  PORTAL_NAV_GROUPS,
  PORTAL_LOCKABLE_DESKS,
} from '@kofc/shared';

const actor = (over: Partial<Parameters<typeof portalAreas>[0]> = {}) => ({
  memberId: 10,
  councilId: 1,
  memberType: 'Member' as const,
  isOfficer: false,
  ...over,
});
const superAdmin = actor({ memberType: 'Super Admin' });
const admin = actor({ memberType: 'Admin' });
const officer = actor({ isOfficer: true });
const member = actor();

describe('portal permissions', () => {
  it('only Super Admins maintain lookups', () => {
    expect([superAdmin, admin, officer, member].map(canMaintainLookups)).toEqual([true, false, false, false]);
  });

  it('Admins act on their own council only; Super Admins on any', () => {
    expect(canAdministerCouncil(admin, 1)).toBe(true);
    expect(canAdministerCouncil(admin, 2)).toBe(false);
    expect(canAdministerCouncil(superAdmin, 2)).toBe(true);
    expect(canAdministerCouncil(officer, 1)).toBe(false);
  });

  it('only Super Admins maintain councils', () => {
    expect([superAdmin, admin, officer, member].map(canMaintainCouncils)).toEqual([true, false, false, false]);
  });

  it('council records (parishes, pastors, activities, lists) belong to that council\'s Admins and any Super Admin', () => {
    expect(canMaintainCouncilRecords(admin, 1)).toBe(true);
    expect(canMaintainCouncilRecords(admin, 2)).toBe(false);
    expect(canMaintainCouncilRecords(superAdmin, 2)).toBe(true);
    expect(canMaintainCouncilRecords(officer, 1)).toBe(false);
    expect(canMaintainCouncilRecords(member, 1)).toBe(false);
  });

  it('Admins and Super Admins plan events; officers and members do not', () => {
    expect([superAdmin, admin, officer, member].map(canPlanEvents)).toEqual([true, true, false, false]);
  });

  it('officers may schedule meetings for their own council only', () => {
    expect(canManageMeetings(officer, 1)).toBe(true);
    expect(canManageMeetings(officer, 2)).toBe(false);
    expect(canManageMeetings(admin, 1)).toBe(true);
    expect(canManageMeetings(admin, 2)).toBe(false);
    expect(canManageMeetings(superAdmin, 2)).toBe(true);
    expect(canManageMeetings(member, 1)).toBe(false);
  });

  it('an event owner may record results even as a plain member', () => {
    expect(canRecordLedger(member, { OwnerID: 10 }, [2])).toBe(true);
    expect(canRecordLedger(member, { OwnerID: 11 }, [1])).toBe(false);
    expect(canRecordLedger(admin, { OwnerID: 11 }, [1, 2])).toBe(true);
    expect(canRecordLedger(admin, { OwnerID: 11 }, [2])).toBe(false);
  });

  it('shows each role only the areas it can use', () => {
    expect(portalAreas(superAdmin)).toEqual([
      'member-actions',
      'calendar',
      'gallery',
      'lookups',
      'councils',
      'council-lookups',
      'elections/appointments',
      'parishes',
      'members',
      'activities',
      'events',
      'meetings',
      'meetings/cadence',
      'meetings/live',
      'elections',
      'donations',
      'ledger',
      'expenses',
      'charities/propose',
      'expenses/queue',
      'expenses/audit',
      'expenses/authorize',
      'expenses/disbursements',
      'charities/queue',
      'charities/vetting',
      'lessons-registry',
      'charities/registry',
      'dashboard',
      'finance/dashboard',
      'finance/ledger',
      'finance/balance-sheet',
      'supreme-sync',
      'financials/budget',
      'messages',
      'distribution-lists',
      'profile',
      'help',
    ]);
    expect(portalAreas(admin)).toEqual([
      'member-actions',
      'calendar',
      'gallery',
      'council-lookups',
      'parishes',
      'members',
      'activities',
      'events',
      'meetings',
      'meetings/cadence',
      'meetings/live',
      'elections',
      'donations',
      'ledger',
      'expenses',
      'charities/propose',
      'expenses/queue',
      'expenses/audit',
      'expenses/authorize',
      'charities/vetting',
      'lessons-registry',
      'charities/registry',
      'dashboard',
      'finance/dashboard',
      'finance/ledger',
      'finance/balance-sheet',
      'supreme-sync',
      'financials/budget',
      'messages',
      'distribution-lists',
      'profile',
      'help',
    ]);
    expect(portalAreas(officer)).toEqual(['member-actions', 'calendar', 'gallery', 'meetings', 'meetings/live', 'elections', 'ledger', 'expenses', 'charities/propose', 'charities/vetting', 'dashboard', 'finance/dashboard', 'finance/ledger', 'finance/balance-sheet', 'financials/budget', 'messages', 'distribution-lists', 'profile', 'help']);
    expect(portalAreas(member)).toEqual(['member-actions', 'calendar', 'gallery', 'meetings', 'elections', 'ledger', 'expenses', 'charities/propose', 'financials/budget', 'messages', 'distribution-lists', 'profile', 'help']);
  });

  it('gives every member their own expense reports, leadership the audit queue, and only finance officers and Super Admins the check ledger', () => {
    const financeOfficers = [actor({ isOfficer: true, roles: ['Treasurer'] }), actor({ isOfficer: true, roles: ['Financial Secretary'] })];
    const leadership = [superAdmin, admin, ...financeOfficers];
    for (const u of [...leadership, officer, member]) expect(portalAreas(u)).toContain('expenses');
    for (const u of leadership) expect(portalAreas(u)).toContain('expenses/queue');
    for (const u of [superAdmin, ...financeOfficers, actor({ memberType: 'Admin', roles: ['Treasurer'] })]) expect(portalAreas(u)).toContain('expenses/disbursements');
    // Sprint 5S: a council Admin without a finance role audits but does not pay.
    expect(portalAreas(admin)).not.toContain('expenses/disbursements');
    for (const u of [officer, member]) {
      expect(portalAreas(u).filter((a) => a.startsWith('expenses/'))).toEqual([]);
    }
    // Sprint 5Z-4: the Grand Knight counter-signs on the authorization desk, and sees no other expense desk.
    expect(portalAreas(actor({ isOfficer: true, roles: ['Grand Knight'] })).filter((a) => a.startsWith('expenses/'))).toEqual(['expenses/authorize']);
  });

  describe('sidebar pillars (Sprint 5S, election desks Sprint 5U, lockable desks Sprint 5Z-10, seven pillars Sprint 6Z)', () => {
    const shape = (u: Parameters<typeof portalSidebar>[0]) =>
      portalSidebar(u).map((g) => [g.label, g.entries.filter((e) => !e.locked).map((e) => e.item)]);
    const FIN_READ = ['finance/ledger', 'finance/balance-sheet', 'finance/dashboard'];

    it('files every area but the profile and the Messaging menu into exactly one of the seven pillars; messaging (5X, 5Z-10.8) lives in the header', () => {
      const filed = PORTAL_NAV_GROUPS.flatMap((g) => g.items);
      expect(new Set(filed).size).toBe(filed.length);
      expect(filed as string[]).not.toContain('messages');
      expect(filed as string[]).not.toContain('distribution-lists');
      const everyArea = portalAreas(superAdmin).filter((a) => a !== 'profile' && a !== 'messages' && a !== 'distribution-lists');
      expect([...everyArea].sort()).toEqual([...filed].sort());
      expect(PORTAL_NAV_GROUPS.map((g) => g.label)).toEqual(['Governance', 'Faith In Action', 'Finances', 'Performance', 'Resources', 'Answers', 'Setup']);
      for (const desk of PORTAL_LOCKABLE_DESKS) expect(filed).toContain(desk);
    });

    it('opens the help center to every member from the Answers pillar (Sprint 6Z)', () => {
      for (const u of [superAdmin, admin, officer, member]) {
        expect(portalAreas(u)).toContain('help');
        expect(portalSidebar(u).find((g) => g.id === 'answers')?.entries).toEqual([{ item: 'help', locked: false }]);
      }
    });

    it('leaves the profile out of the sidebar for every role; the header menu opens it', () => {
      for (const u of [superAdmin, admin, officer, member]) {
        expect(portalAreas(u)).toContain('profile');
        expect(portalNavGroups(u).flatMap((g) => g.items as string[])).not.toContain('profile');
      }
    });

    it("opens the distribution lists to every member from the header's Messaging menu, never the sidebar (Sprint 5Z-10.8)", () => {
      for (const u of [superAdmin, admin, officer, member]) {
        expect(portalAreas(u)).toContain('distribution-lists');
        expect(portalNavGroups(u).flatMap((g) => g.items as string[])).not.toContain('distribution-lists');
      }
    });

    it('keeps the council-wide switch with the council Admins and Super Admins (Sprint 5Z-10.8)', () => {
      expect([superAdmin, admin, officer, member].map((u) => canPublishDistributionList(u, 1))).toEqual([true, true, false, false]);
      expect(canPublishDistributionList(admin, 2)).toBe(false);
      const privateList = { CouncilID: 1, CreatedBy: 10, IsCouncilWide: 0 };
      const councilWide = { CouncilID: 1, CreatedBy: 77, IsCouncilWide: 1 };
      expect(canEditDistributionList(member, privateList)).toBe(true);
      expect(canEditDistributionList(actor({ memberId: 11, memberType: 'Admin' }), privateList)).toBe(false);
      expect(canEditDistributionList(member, councilWide)).toBe(false);
      expect(canEditDistributionList(admin, councilWide)).toBe(true);
    });

    it("keeps the messages out of the sidebar for every role; the header's Messaging shortcut opens them (Sprint 5X, 5Z-10.6)", () => {
      for (const u of [superAdmin, admin, officer, member]) {
        expect(portalAreas(u)).toContain('messages');
        expect(portalNavGroups(u).flatMap((g) => g.items as string[])).not.toContain('messages');
      }
    });

    it('shows a Super Admin every pillar in full', () => {
      expect(shape(superAdmin)).toEqual(PORTAL_NAV_GROUPS.map((g) => [g.label, g.items]));
      expect(portalNavGroups(superAdmin)).toEqual(PORTAL_NAV_GROUPS);
    });

    it('shows a council Admin everything but the global tables, councils, appointments and the check ledgers', () => {
      expect(shape(admin)).toEqual([
        ['Governance', ['meetings/live', 'meetings/cadence', 'meetings', 'elections']],
        ['Faith In Action', ['activities', 'member-actions', 'events', 'calendar']],
        [
          'Finances',
          [...FIN_READ, 'expenses', 'expenses/queue', 'expenses/audit', 'expenses/authorize', 'charities/vetting', 'charities/propose', 'donations', 'financials/budget'],
        ],
        ['Performance', ['dashboard', 'ledger', 'lessons-registry']],
        ['Resources', ['gallery']],
        ['Answers', ['help']],
        ['Setup', ['members', 'supreme-sync', 'council-lookups', 'charities/registry', 'parishes']],
      ]);
    });

    it('shows a Treasurer the full finances and the donation lookups', () => {
      expect(shape(actor({ isOfficer: true, roles: ['Treasurer'] }))).toEqual([
        ['Governance', ['meetings/live', 'meetings', 'elections']],
        ['Faith In Action', ['member-actions', 'calendar']],
        [
          'Finances',
          [...FIN_READ, 'expenses', 'expenses/queue', 'expenses/disbursements', 'charities/vetting', 'charities/propose', 'charities/queue', 'donations', 'financials/budget'],
        ],
        ['Performance', ['dashboard', 'ledger']],
        ['Resources', ['gallery']],
        ['Answers', ['help']],
        ['Setup', ['supreme-sync', 'council-lookups']],
      ]);
    });

    it('files the Council Lookups (agenda templates, Sprint 5Y-6) under Setup and the Appointed Leadership Matrix under Governance for a Grand Knight who is a plain Member', () => {
      expect(shape(actor({ isOfficer: true, roles: ['Grand Knight'] }))).toEqual([
        ['Governance', ['meetings/live', 'meetings/cadence', 'meetings', 'elections', 'elections/appointments']],
        ['Faith In Action', ['member-actions', 'calendar']],
        ['Finances', [...FIN_READ, 'expenses', 'expenses/authorize', 'charities/vetting', 'charities/propose', 'financials/budget']],
        ['Performance', ['dashboard', 'ledger']],
        ['Resources', ['gallery']],
        ['Answers', ['help']],
        ['Setup', ['council-lookups']],
      ]);
    });

    it('drops the Setup pillar for plain members and other officers', () => {
      expect(shape(officer)).toEqual([
        // Sprint 5Z-10: officers run the live console.
        ['Governance', ['meetings/live', 'meetings', 'elections']],
        ['Faith In Action', ['member-actions', 'calendar']],
        // Sprint 5Z-2: officers (Trustees included) vet charitable requests; Sprint 5Z-8: they read the general ledger.
        ['Finances', [...FIN_READ, 'expenses', 'charities/vetting', 'charities/propose', 'financials/budget']],
        // Sprint 5Z-2.5: officers read the executive dashboard.
        ['Performance', ['dashboard', 'ledger']],
        ['Resources', ['gallery']],
        ['Answers', ['help']],
      ]);
      expect(shape(member)).toEqual([
        ['Governance', ['meetings', 'elections']],
        ['Faith In Action', ['member-actions', 'calendar']],
        ['Finances', ['expenses', 'charities/propose', 'financials/budget']],
        ['Performance', ['ledger']],
        ['Resources', ['gallery']],
        ['Answers', ['help']],
      ]);
    });

    it('never folds a pillar: the sidebar has no accordion state (Sprint 6Z)', () => {
      for (const g of portalSidebar(superAdmin)) expect(Object.keys(g).sort()).toEqual(['entries', 'id', 'label']);
    });

    it('lists every sign-off and meeting desk in its pillar, locking the ones the viewer may not open (Sprint 5Z-10)', () => {
      const desks = (u: Parameters<typeof portalSidebar>[0]) =>
        portalSidebar(u)
          .flatMap((g) => g.entries)
          .filter((e) => (PORTAL_LOCKABLE_DESKS as readonly string[]).includes(e.item))
          .map((e) => [e.item, e.locked]);
      expect(desks(member)).toEqual([
        ['meetings/live', true],
        ['meetings/cadence', true],
        ['expenses/audit', true],
        ['expenses/authorize', true],
        ['charities/vetting', true],
      ]);
      expect(desks(actor({ isOfficer: true, roles: ['Grand Knight'] }))).toEqual([
        ['meetings/live', false],
        ['meetings/cadence', false],
        ['expenses/audit', true],
        ['expenses/authorize', false],
        ['charities/vetting', false],
      ]);
      expect(desks(admin).every(([, locked]) => !locked)).toBe(true);
      // Every other link shows only to those who may open it.
      for (const e of portalSidebar(member).flatMap((g) => g.entries)) {
        if (e.locked) expect(PORTAL_LOCKABLE_DESKS).toContain(e.item);
      }
      expect(portalSidebar(member).map((g) => g.label)).toEqual(['Governance', 'Faith In Action', 'Finances', 'Performance', 'Resources', 'Answers']);
    });
  });

  it('opens nominations to every member, appointments to the Grand Knight and Super Admins, and the ballot switches to council Admins (Sprint 5U)', () => {
    const grandKnight = actor({ isOfficer: true, roles: ['Grand Knight'] });
    for (const u of [superAdmin, admin, officer, member, grandKnight]) expect(portalAreas(u)).toContain('elections');
    expect([superAdmin, grandKnight, admin, officer, member, actor({ isOfficer: true, roles: ['Deputy Grand Knight'] })].map(canAppointOfficers)).toEqual([
      true,
      true,
      false,
      false,
      false,
      false,
    ]);
    expect(portalAreas(grandKnight)).toContain('elections/appointments');
    expect(portalAreas(admin)).not.toContain('elections/appointments');
    expect(canConfigureBallot(admin, 1)).toBe(true);
    expect(canConfigureBallot(admin, 2)).toBe(false);
    expect(canConfigureBallot(superAdmin, 2)).toBe(true);
    expect(canConfigureBallot(grandKnight, 1)).toBe(false);
    expect(canConfigureBallot(actor({ isOfficer: true, roles: ['Treasurer'] }), 1)).toBe(false);
  });

  it('opens the proposal desk to every member, the registry to Admins and the charity checkbook to finance officers (Sprint 5V)', () => {
    const treasurer = actor({ isOfficer: true, roles: ['Treasurer'] });
    const secretary = actor({ isOfficer: true, roles: ['Financial Secretary'] });
    for (const u of [superAdmin, admin, treasurer, officer, member]) expect(portalAreas(u)).toContain('charities/propose');
    expect([superAdmin, admin, treasurer, officer, member].map(canManageCharityRegistry)).toEqual([true, true, false, false, false]);
    for (const u of [superAdmin, treasurer, secretary]) expect(portalAreas(u)).toContain('charities/queue');
    for (const u of [admin, officer, member]) expect(portalAreas(u)).not.toContain('charities/queue');
    expect(canDisburseCharity(treasurer, 1)).toBe(true);
    expect(canDisburseCharity(treasurer, 2)).toBe(false);
    expect(canDisburseCharity(superAdmin, 2)).toBe(true);
    expect(canDisburseCharity(admin, 1)).toBe(false);
    expect([superAdmin, admin, treasurer, member].map((u) => canReviewCharityProposals(u, 1))).toEqual([true, true, true, false]);
    expect(canReviewCharityProposals(admin, 2)).toBe(false);
    expect([superAdmin, admin, treasurer, member].map((u) => canConnectCouncilCharity(u, 1))).toEqual([true, true, true, false]);
  });

  it('opens the Annual Budget Projections to every member to read, and to leadership and the Budget Director to edit, served from /budget (Sprint 5Y-3)', () => {
    const treasurer = actor({ isOfficer: true, roles: ['Treasurer'] });
    const secretary = actor({ isOfficer: true, roles: ['Financial Secretary'] });
    const director = actor({ isBudgetDirector: true });
    for (const u of [superAdmin, admin, treasurer, secretary, officer, member, director]) expect(portalAreas(u)).toContain('financials/budget');
    expect([superAdmin, admin, treasurer, member, actor({ councilId: 2 })].map((u) => canViewBudgetForecast(u, 1))).toEqual([true, true, true, true, false]);
    expect([superAdmin, admin, treasurer, secretary, director, officer, member].map((u) => canManageBudgetForecast(u, 1))).toEqual([true, true, true, true, true, false, false]);
    expect([superAdmin, admin, treasurer, director].map((u) => canManageBudgetForecast(u, 2))).toEqual([true, false, false, false]);
    expect([superAdmin, admin, treasurer, member].map((u) => canDesignateBudgetDirector(u, { CouncilID: 1 }))).toEqual([true, true, false, false]);
    expect(canDesignateBudgetDirector(admin, { CouncilID: 2 })).toBe(false);
    // Sprint 5Y-3.5: the controls open only May 1 00:00 - June 30 midnight, unless a Super Admin overrides the window.
    expect(canEditBudgetYear(treasurer, 1, '2027-2028', new Date(2027, 3, 30, 23, 59))).toBe(false);
    expect(canEditBudgetYear(treasurer, 1, '2027-2028', new Date(2027, 4, 1))).toBe(true);
    expect(canEditBudgetYear(director, 1, '2027-2028', new Date(2027, 5, 30, 23, 59))).toBe(true);
    expect(canEditBudgetYear(treasurer, 1, '2027-2028', new Date(2027, 6, 1))).toBe(false);
    expect(canEditBudgetYear(treasurer, 1, '2027-2028', new Date(2027, 6, 1), true)).toBe(false);
    expect(canEditBudgetYear(superAdmin, 1, '2027-2028', new Date(2027, 6, 1), true)).toBe(true);
    expect(canEditBudgetYear(member, 1, '2027-2028', new Date(2027, 4, 15))).toBe(false);
    expect(portalAreaHref('financials/budget')).toBe('/budget');
    expect(portalAreaHref('expenses/queue')).toBe('/expenses/queue');
  });

  it('freezes an approved year, lets leadership (not the Budget Director) finalize it, and opens budget performance to the executive summary readers (Sprint 5Y-4)', () => {
    const treasurer = actor({ isOfficer: true, roles: ['Treasurer'] });
    const director = actor({ isBudgetDirector: true });
    const june = new Date(2027, 5, 15);
    const july = new Date(2027, 6, 15);
    const april = new Date(2027, 3, 15);
    // An approved year is read-only for everyone, even a Super Admin overriding the window.
    expect(canEditBudgetYear(treasurer, 1, '2027-2028', june, false, 'Proposed')).toBe(true);
    expect(canEditBudgetYear(treasurer, 1, '2027-2028', june, false, 'Approved')).toBe(false);
    expect(canEditBudgetYear(superAdmin, 1, '2027-2028', july, true, 'Approved')).toBe(false);
    expect([superAdmin, admin, treasurer, director, officer, member].map((u) => canApproveBudget(u, 1))).toEqual([true, true, true, false, false, false]);
    expect([superAdmin, admin, treasurer].map((u) => canApproveBudget(u, 2))).toEqual([true, false, false]);
    // The vote may be recorded from May 1 on, including after the July 1 lock, while the year has lines and is not yet approved.
    expect(canFinalizeBudgetYear(treasurer, 1, '2027-2028', june, 'Proposed', 3)).toBe(true);
    expect(canFinalizeBudgetYear(treasurer, 1, '2027-2028', july, 'Draft', 3)).toBe(true);
    expect(canFinalizeBudgetYear(treasurer, 1, '2027-2028', july, 'Approved', 3)).toBe(false);
    expect(canFinalizeBudgetYear(treasurer, 1, '2027-2028', july, 'Proposed', 0)).toBe(false);
    expect(canFinalizeBudgetYear(treasurer, 1, '2027-2028', april, 'Proposed', 3)).toBe(false);
    expect(canFinalizeBudgetYear(treasurer, 1, '2027-2028', april, 'Proposed', 3, true)).toBe(false);
    expect(canFinalizeBudgetYear(superAdmin, 1, '2027-2028', april, 'Proposed', 3, true)).toBe(true);
    expect(canFinalizeBudgetYear(director, 1, '2027-2028', june, 'Proposed', 3)).toBe(false);
    // Sprint 5Z-2.5: every seated officer reads it with the executive summaries.
    expect([superAdmin, admin, treasurer, director, officer, member].map((u) => canReviewBudgetPerformance(u, 1))).toEqual([true, true, true, false, true, false]);
    expect([superAdmin, admin, treasurer].map((u) => canReviewBudgetPerformance(u, 2))).toEqual([true, false, false]);
  });

  it('leads every role, Admins included, with the Member Actions hub', () => {
    for (const u of [superAdmin, admin, officer, member, actor({ roles: ['Treasurer'] })]) expect(portalAreas(u)[0]).toBe('member-actions');
  });

  it('opens council lookups to Admins, Super Admins and finance officers, with finance officers on the donation tables only', () => {
    const treasurer = actor({ isOfficer: true, roles: ['Treasurer'] });
    expect([superAdmin, admin, treasurer, officer, member].map(canOpenCouncilLookups)).toEqual([true, true, true, false, false]);
    expect(councilLookupTablesFor(admin, 1)).toEqual(['Activities', 'DonationType', 'CouncilDonationMethod', 'CouncilBudgetCategory']);
    expect(councilLookupTablesFor(admin, 2)).toEqual([]);
    expect(councilLookupTablesFor(superAdmin, 2)).toEqual(['Activities', 'DonationType', 'CouncilDonationMethod', 'CouncilBudgetCategory']);
    expect(councilLookupTablesFor(treasurer, 1)).toEqual(['DonationType', 'CouncilDonationMethod', 'CouncilBudgetCategory']);
    expect(councilLookupTablesFor(treasurer, 2)).toEqual([]);
    expect(councilLookupTablesFor(officer, 1)).toEqual([]);
  });

  it("keeps the personnel audits to the dashboard's readers: Admins, Super Admins and, since Sprint 5Z-2.5, the council's officers", () => {
    expect(canViewExecutiveAudits(admin, 1)).toBe(true);
    expect(canViewExecutiveAudits(admin, 2)).toBe(false);
    expect(canViewExecutiveAudits(superAdmin, 2)).toBe(true);
    expect(canViewExecutiveAudits(actor({ isOfficer: true, roles: ['Financial Secretary'] }), 1)).toBe(true);
    expect(canViewExecutiveAudits(actor({ isOfficer: true, roles: ['Financial Secretary'] }), 2)).toBe(false);
    expect(canViewExecutiveAudits(member, 1)).toBe(false);
  });

  it('opens donations and the executive summaries to the Treasurer and Financial Secretary', () => {
    for (const role of ['Treasurer', 'Financial Secretary']) {
      expect(portalAreas(actor({ isOfficer: true, roles: [role] }))).toEqual([
        'member-actions',
        'calendar',
        'gallery',
        'council-lookups',
        'meetings',
        'meetings/live',
        'elections',
        'donations',
        'ledger',
        'expenses',
        'charities/propose',
          'expenses/queue',
        // Sprint 5Z-4: the Financial Secretary alone issues written orders on the audit desk.
        ...(role === 'Financial Secretary' ? ['expenses/audit'] : []),
        'expenses/disbursements',
        'charities/queue',
        'charities/vetting',
        'dashboard',
        'finance/dashboard',
        'finance/ledger',
        'finance/balance-sheet',
        'supreme-sync',
        'financials/budget',
        'messages',
        'distribution-lists',
        'profile',
        'help',
      ]);
    }
    expect(portalAreas(actor({ isOfficer: true, roles: ['Recorder'] }))).toEqual(['member-actions', 'calendar', 'gallery', 'meetings', 'meetings/live', 'elections', 'ledger', 'expenses', 'charities/propose', 'charities/vetting', 'dashboard', 'finance/dashboard', 'finance/ledger', 'finance/balance-sheet', 'financials/budget', 'messages', 'distribution-lists', 'profile', 'help']);
  });

  it('gives council leadership the Supreme sync and the alert dispatch, each for their own council (Sprint 5T)', () => {
    const treasurer = actor({ isOfficer: true, roles: ['Treasurer'] });
    const secretary = actor({ isOfficer: true, roles: ['Financial Secretary'] });
    for (const u of [superAdmin, admin, treasurer, secretary]) expect(portalAreas(u)).toContain('supreme-sync');
    for (const u of [officer, member, actor({ isOfficer: true, roles: ['Grand Knight'] })]) expect(portalAreas(u)).not.toContain('supreme-sync');
    for (const check of [canDispatchCouncilAlerts, canSyncSupremeReports]) {
      expect([superAdmin, admin, treasurer, secretary, officer, member].map((u) => check(u, 1))).toEqual([true, true, true, true, false, false]);
      expect([superAdmin, admin, treasurer].map((u) => check(u, 2))).toEqual([true, false, false]);
    }
  });

  it('lets finance officers manage only their own council’s finances', () => {
    const treasurer = actor({ isOfficer: true, roles: ['Treasurer'] });
    expect(isFinanceOfficer(treasurer)).toBe(true);
    expect(isFinanceOfficer(officer)).toBe(false);
    expect([canManageFinances(treasurer, 1), canManageFinances(treasurer, 2)]).toEqual([true, false]);
    expect([canManageFinances(admin, 1), canManageFinances(admin, 2), canManageFinances(superAdmin, 2)]).toEqual([true, false, true]);
    expect(canManageFinances(member, 1)).toBe(false);
  });

  it('offers donation corrections to the recorder, the event owner, finance officers and admins', () => {
    const donation = { CouncilID: 1, RecordedBy: 42 };
    expect(canChangeDonation(actor({ memberId: 42 }), donation, null)).toBe(true);
    expect(canChangeDonation(actor({ memberId: 7 }), donation, 7)).toBe(true);
    expect(canChangeDonation(actor({ roles: ['Financial Secretary'] }), donation, null)).toBe(true);
    expect(canChangeDonation(actor({ roles: ['Treasurer'], councilId: 2 }), donation, null)).toBe(false);
    expect(canChangeDonation(admin, donation, null)).toBe(true);
    expect(canChangeDonation(member, donation, 11)).toBe(false);
  });
});

describe('executive access for the Grand Knight and Deputy Grand Knight (Sprint 5Z-2.5)', () => {
  const gk = actor({ isOfficer: true, roles: ['Grand Knight'] });
  const dgk = actor({ isOfficer: true, roles: ['Deputy Grand Knight'] });

  it('opens the executive dashboard, its audits and budget gauges, and the vetting desk, in their own council only', () => {
    for (const u of [gk, dgk]) {
      expect(portalAreas(u)).toContain('dashboard');
      expect(portalAreas(u)).toContain('charities/vetting');
      expect(portalAreas(u)).not.toContain('supreme-sync');
      expect(canViewExecutiveAudits(u, 1)).toBe(true);
      expect(canReviewBudgetPerformance(u, 1)).toBe(true);
      expect(canVetCharitableRequests(u, 1)).toBe(true);
      expect(canOverrideVettingClaim(u, 1)).toBe(true);
      for (const check of [canViewExecutiveAudits, canReviewBudgetPerformance, canVetCharitableRequests, canOverrideVettingClaim]) expect(check(u, 2)).toBe(false);
    }
    // Without the officer flag the seat still grants it: the role name, not an Admin member type, carries the access.
    expect(portalAreas(actor({ roles: ['Deputy Grand Knight'] }))).toEqual(expect.arrayContaining(['dashboard', 'charities/vetting']));
  });

  it('opens the dashboard to every officer, as on the vetting desk, but keeps the claim override with Admins and executives', () => {
    for (const role of ['Recorder', 'Trustee 1', 'Warden', 'Treasurer', 'Financial Secretary']) {
      const o = actor({ isOfficer: true, roles: [role] });
      expect(portalAreas(o)).toContain('dashboard');
      expect(canViewExecutiveDashboard(o, 1)).toBe(true);
      expect(canViewExecutiveAudits(o, 1)).toBe(true);
      expect(canReviewBudgetPerformance(o, 1)).toBe(true);
      expect(canViewExecutiveDashboard(o, 2)).toBe(false);
      expect(canVetCharitableRequests(o, 1)).toBe(canViewExecutiveDashboard(o, 1));
    }
    expect(canOverrideVettingClaim(actor({ isOfficer: true, roles: ['Recorder'] }), 1)).toBe(false);
    expect(canOverrideVettingClaim(admin, 1)).toBe(true);
    // A director or Lecturer holds no officer seat (Role.Officer = 0): neither screen.
    const director = actor({ roles: ['Program Director'] });
    expect(portalAreas(director)).not.toContain('dashboard');
    expect(portalAreas(director)).not.toContain('charities/vetting');
  });
});
