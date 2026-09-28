import { describe, expect, it } from 'vitest';
import {
  canAdministerCouncil,
  canChangeDonation,
  canMaintainCouncilRecords,
  canManageFinances,
  isFinanceOfficer,
  canMaintainCouncils,
  canMaintainLookups,
  canManageMeetings,
  canOpenCouncilLookups,
  canViewExecutiveAudits,
  councilLookupTablesFor,
  canPlanEvents,
  canRecordLedger,
  portalAreas,
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
      'parishes',
      'members',
      'activities',
      'events',
      'meetings',
      'distribution-lists',
      'donations',
      'ledger',
      'lessons-registry',
      'dashboard',
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
      'distribution-lists',
      'donations',
      'ledger',
      'lessons-registry',
      'dashboard',
      'messages',
      'profile',
    ]);
    expect(portalAreas(officer)).toEqual(['member-actions', 'calendar', 'gallery', 'meetings', 'ledger', 'messages', 'profile']);
    expect(portalAreas(member)).toEqual(['member-actions', 'calendar', 'gallery', 'meetings', 'ledger', 'messages', 'profile']);
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
        'donations',
        'ledger',
        'dashboard',
        'messages',
        'profile',
      ]);
    }
    expect(portalAreas(actor({ isOfficer: true, roles: ['Grand Knight', 'Recorder'] }))).toEqual(['member-actions', 'calendar', 'gallery', 'meetings', 'ledger', 'messages', 'profile']);
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
