import { describe, expect, it } from 'vitest';
import {
  canAdministerCouncil,
  canMaintainLookups,
  canManageMeetings,
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
    expect(portalAreas(superAdmin)).toEqual(['lookups', 'events', 'meetings', 'ledger']);
    expect(portalAreas(admin)).toEqual(['events', 'meetings', 'ledger']);
    expect(portalAreas(officer)).toEqual(['meetings', 'ledger']);
    expect(portalAreas(member)).toEqual(['ledger']);
  });
});
