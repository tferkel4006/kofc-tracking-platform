// =========================================================================
// PORTAL PERMISSIONS
// Who may open which part of the admin portal (Blueprint: "User Roles & Access Matrix";
// Specifications: the Super Admin / Admin function lists, officers may schedule meetings,
// and the owner of an event may record its post-event results).
//
// These decide what the UI offers. The DataService contract has no caller identity, so until the
// remote driver's API enforces the same rules server-side, they are a usability gate, not security.
// =========================================================================
import type { SessionUser } from './contract';
import type { Event } from './types';

type Actor = Pick<SessionUser, 'memberId' | 'councilId' | 'memberType' | 'isOfficer'>;

export type PortalArea = 'lookups' | 'events' | 'meetings' | 'ledger';

export const isSuperAdmin = (u: Actor): boolean => u.memberType === 'Super Admin';
export const isAdmin = (u: Actor): boolean => u.memberType === 'Admin' || isSuperAdmin(u);

/** Super Admins maintain the global lookup tables. */
export const canMaintainLookups = (u: Actor): boolean => isSuperAdmin(u);

/** Super Admins act on any council; Admins only on their own. */
export const canAdministerCouncil = (u: Actor, councilId: number): boolean =>
  isSuperAdmin(u) || (u.memberType === 'Admin' && u.councilId === councilId);

/** Admins and Super Admins schedule events and shifts. */
export const canPlanEvents = (u: Actor): boolean => isAdmin(u);

/** Admins, Super Admins and any officer of the council schedule meetings, invite members and upload minutes. */
export const canManageMeetings = (u: Actor, councilId: number): boolean =>
  canAdministerCouncil(u, councilId) || (u.isOfficer && u.councilId === councilId);

/** Admins record post-event results for their councils' events, and the event's owner may too. */
export const canRecordLedger = (u: Actor, event: Pick<Event, 'OwnerID'>, eventCouncilIds: readonly number[]): boolean =>
  event.OwnerID === u.memberId || eventCouncilIds.some((id) => canAdministerCouncil(u, id));

/** Sections shown in the portal's navigation. The ledger is open to everyone because event owners use it. */
export function portalAreas(u: Actor): PortalArea[] {
  const areas: PortalArea[] = [];
  if (canMaintainLookups(u)) areas.push('lookups');
  if (canPlanEvents(u)) areas.push('events');
  if (isAdmin(u) || u.isOfficer) areas.push('meetings');
  areas.push('ledger');
  return areas;
}
