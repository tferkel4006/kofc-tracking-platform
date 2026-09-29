import { describe, expect, it } from 'vitest';
import {
  canAdministerCouncil,
  canAppointOfficers,
  canChangeDonation,
  canConfigureBallot,
  canMaintainCouncilRecords,
  canDispatchCouncilAlerts,
  canManageFinances,
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
  portalAreas,
  portalNavGroups,
  PORTAL_NAV_GROUPS,
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
      'elections',
      'distribution-lists',
      'donations',
      'ledger',
      'expenses',
      'charities/propose',
      'expenses/queue',
      'expenses/disbursements',
      'charities/queue',
      'lessons-registry',
      'charities/registry',
      'dashboard',
      'supreme-sync',
      'messages',
      'profile',
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
      'elections',
      'distribution-lists',
      'donations',
      'ledger',
      'expenses',
      'charities/propose',
      'expenses/queue',
      'lessons-registry',
      'charities/registry',
      'dashboard',
      'supreme-sync',
      'messages',
      'profile',
    ]);
    expect(portalAreas(officer)).toEqual(['member-actions', 'calendar', 'gallery', 'meetings', 'elections', 'ledger', 'expenses', 'charities/propose', 'messages', 'profile']);
    expect(portalAreas(member)).toEqual(['member-actions', 'calendar', 'gallery', 'meetings', 'elections', 'ledger', 'expenses', 'charities/propose', 'messages', 'profile']);
  });

  it('gives every member their own expense reports, leadership the audit queue, and only finance officers and Super Admins the check ledger', () => {
    const financeOfficers = [actor({ isOfficer: true, roles: ['Treasurer'] }), actor({ isOfficer: true, roles: ['Financial Secretary'] })];
    const leadership = [superAdmin, admin, ...financeOfficers];
    for (const u of [...leadership, officer, member]) expect(portalAreas(u)).toContain('expenses');
    for (const u of leadership) expect(portalAreas(u)).toContain('expenses/queue');
    for (const u of [superAdmin, ...financeOfficers, actor({ memberType: 'Admin', roles: ['Treasurer'] })]) expect(portalAreas(u)).toContain('expenses/disbursements');
    // Sprint 5S: a council Admin without a finance role audits but does not pay.
    expect(portalAreas(admin)).not.toContain('expenses/disbursements');
    for (const u of [officer, member, actor({ isOfficer: true, roles: ['Grand Knight'] })]) {
      expect(portalAreas(u).filter((a) => a.startsWith('expenses/'))).toEqual([]);
    }
  });

  describe('sidebar accordion groups (Sprint 5S, election desks Sprint 5U)', () => {
    const shape = (u: Parameters<typeof portalNavGroups>[0]) => portalNavGroups(u).map((g) => [g.label, g.items]);

    it('files every area but the profile into exactly one group; the help center moved to the header (Sprint 5W)', () => {
      const filed = PORTAL_NAV_GROUPS.flatMap((g) => g.items);
      expect(new Set(filed).size).toBe(filed.length);
      expect(filed as string[]).not.toContain('help');
      const everyArea = portalAreas(superAdmin).filter((a) => a !== 'profile');
      expect([...everyArea].sort()).toEqual([...filed].sort());
      expect(PORTAL_NAV_GROUPS.map((g) => [g.label, g.collapsible])).toEqual([
        ['Self-Service Hub', false],
        ['Volunteer Operations', true],
        ['Financial Ledgers', true],
        ['Administrative Lookups', true],
      ]);
    });

    it('leaves the profile out of the sidebar for every role; the header menu opens it', () => {
      for (const u of [superAdmin, admin, officer, member]) {
        expect(portalAreas(u)).toContain('profile');
        expect(portalNavGroups(u).flatMap((g) => g.items as string[])).not.toContain('profile');
      }
    });

    it('shows a Super Admin every group in full', () => {
      expect(shape(superAdmin)).toEqual([
        ['Self-Service Hub', ['member-actions', 'charities/propose', 'messages']],
        ['Volunteer Operations', ['calendar', 'activities', 'members', 'events', 'meetings', 'elections', 'gallery', 'ledger', 'lessons-registry', 'distribution-lists']],
        ['Financial Ledgers', ['dashboard', 'donations', 'expenses', 'expenses/queue', 'expenses/disbursements', 'charities/queue']],
        ['Administrative Lookups', ['council-lookups', 'charities/registry', 'elections/appointments', 'supreme-sync', 'lookups', 'parishes', 'councils']],
      ]);
    });

    it('shows a council Admin everything but the global tables, councils and the check ledger', () => {
      expect(shape(admin)).toEqual([
        ['Self-Service Hub', ['member-actions', 'charities/propose', 'messages']],
        ['Volunteer Operations', ['calendar', 'activities', 'members', 'events', 'meetings', 'elections', 'gallery', 'ledger', 'lessons-registry', 'distribution-lists']],
        ['Financial Ledgers', ['dashboard', 'donations', 'expenses', 'expenses/queue']],
        ['Administrative Lookups', ['council-lookups', 'charities/registry', 'supreme-sync', 'parishes']],
      ]);
    });

    it('shows a Treasurer the full financial ledgers and the donation lookups', () => {
      expect(shape(actor({ isOfficer: true, roles: ['Treasurer'] }))).toEqual([
        ['Self-Service Hub', ['member-actions', 'charities/propose', 'messages']],
        ['Volunteer Operations', ['calendar', 'meetings', 'elections', 'gallery', 'ledger']],
        ['Financial Ledgers', ['dashboard', 'donations', 'expenses', 'expenses/queue', 'expenses/disbursements', 'charities/queue']],
        ['Administrative Lookups', ['council-lookups', 'supreme-sync']],
      ]);
    });

    it('files the Appointed Leadership Matrix under Administrative Lookups for a Grand Knight who is a plain Member', () => {
      expect(shape(actor({ isOfficer: true, roles: ['Grand Knight'] }))).toEqual([
        ['Self-Service Hub', ['member-actions', 'charities/propose', 'messages']],
        ['Volunteer Operations', ['calendar', 'meetings', 'elections', 'gallery', 'ledger']],
        ['Financial Ledgers', ['expenses']],
        ['Administrative Lookups', ['elections/appointments']],
      ]);
    });

    it('drops the Administrative Lookups group for plain members and other officers', () => {
      for (const u of [member, officer]) {
        expect(shape(u)).toEqual([
          ['Self-Service Hub', ['member-actions', 'charities/propose', 'messages']],
          ['Volunteer Operations', ['calendar', 'meetings', 'elections', 'gallery', 'ledger']],
          ['Financial Ledgers', ['expenses']],
        ]);
      }
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

  it('leads every role, Admins included, with the Member Actions hub', () => {
    for (const u of [superAdmin, admin, officer, member, actor({ roles: ['Treasurer'] })]) expect(portalAreas(u)[0]).toBe('member-actions');
  });

  it('opens council lookups to Admins, Super Admins and finance officers, with finance officers on the donation tables only', () => {
    const treasurer = actor({ isOfficer: true, roles: ['Treasurer'] });
    expect([superAdmin, admin, treasurer, officer, member].map(canOpenCouncilLookups)).toEqual([true, true, true, false, false]);
    expect(councilLookupTablesFor(admin, 1)).toEqual(['Activities', 'DonationType', 'CouncilDonationMethod']);
    expect(councilLookupTablesFor(admin, 2)).toEqual([]);
    expect(councilLookupTablesFor(superAdmin, 2)).toEqual(['Activities', 'DonationType', 'CouncilDonationMethod']);
    expect(councilLookupTablesFor(treasurer, 1)).toEqual(['DonationType', 'CouncilDonationMethod']);
    expect(councilLookupTablesFor(treasurer, 2)).toEqual([]);
    expect(councilLookupTablesFor(officer, 1)).toEqual([]);
  });

  it('keeps the personnel audits to the council Admins and Super Admins', () => {
    expect(canViewExecutiveAudits(admin, 1)).toBe(true);
    expect(canViewExecutiveAudits(admin, 2)).toBe(false);
    expect(canViewExecutiveAudits(superAdmin, 2)).toBe(true);
    expect(canViewExecutiveAudits(actor({ isOfficer: true, roles: ['Financial Secretary'] }), 1)).toBe(false);
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
        'elections',
        'donations',
        'ledger',
        'expenses',
        'charities/propose',
        'expenses/queue',
        'expenses/disbursements',
        'charities/queue',
        'dashboard',
        'supreme-sync',
        'messages',
        'profile',
      ]);
    }
    expect(portalAreas(actor({ isOfficer: true, roles: ['Recorder'] }))).toEqual(['member-actions', 'calendar', 'gallery', 'meetings', 'elections', 'ledger', 'expenses', 'charities/propose', 'messages', 'profile']);
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
