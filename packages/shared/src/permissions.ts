// =========================================================================
// PORTAL PERMISSIONS
// Who may open which part of the admin portal (Blueprint: "User Roles & Access Matrix";
// Specifications: the Super Admin / Admin function lists, officers may schedule meetings,
// and the owner of an event may record its post-event results).
//
// These decide what the UI offers. Member writes (members.create/update, memberProfiles.updateExtensions)
// lookup writes (lookups.create/update/remove) and council, parish, pastor, activity and distribution-list
// writes take the caller's id and the drivers enforce the same rules (rules.ts); the other areas have no caller
// identity yet, so until the remote driver's API enforces them server-side they are a usability gate.
// =========================================================================
import type { CouncilLookupTableName, SessionUser } from './contract';
import { FINANCE_LOOKUP_TABLES, holdsFinanceRole } from './rules';
import type { Donation, Event, Meeting, Member, MemberType } from './types';

/** `roles` (Role names) matters only to the finance areas; omitted, the member holds none. */
type Actor = Pick<SessionUser, 'memberId' | 'councilId' | 'memberType' | 'isOfficer'> & { roles?: readonly string[] };

/** Each area is also its route: RequireArea links to `/${area}`. */
export type PortalArea =
  | 'member-actions'
  | 'calendar'
  | 'gallery'
  | 'lookups'
  | 'councils'
  | 'council-lookups'
  | 'parishes'
  | 'members'
  | 'activities'
  | 'events'
  | 'meetings'
  | 'distribution-lists'
  | 'ledger'
  | 'lessons-registry'
  | 'donations'
  | 'dashboard'
  | 'messages'
  | 'profile';

export const isSuperAdmin = (u: Actor): boolean => u.memberType === 'Super Admin';
export const isAdmin = (u: Actor): boolean => u.memberType === 'Admin' || isSuperAdmin(u);

/** Super Admins maintain the global lookup tables. */
export const canMaintainLookups = (u: Actor): boolean => isSuperAdmin(u);

/**
 * A council's own lookups (activities, donation types, enabled donation methods): its Admins and any Super Admin,
 * and for the donation lookups its Financial Secretary and Treasurer (drivers: assertMayManageCouncilLookups).
 */
export const canManageCouncilLookups = (u: Actor, councilId: number, table: CouncilLookupTableName): boolean =>
  canAdministerCouncil(u, councilId) || (FINANCE_LOOKUP_TABLES.includes(table) && isFinanceOfficer(u) && u.councilId === councilId);

/** The council lookups screen: Admins and Super Admins, and finance officers for the donation lookups. */
export const canOpenCouncilLookups = (u: Actor): boolean => isAdmin(u) || isFinanceOfficer(u);

/** The council lookup tables `u` may open for `councilId`, in tab order; a finance officer gets only the donation lookups. */
export function councilLookupTablesFor(u: Actor, councilId: number): CouncilLookupTableName[] {
  const all: CouncilLookupTableName[] = ['Activities', 'DonationType', 'CouncilDonationMethod'];
  return all.filter((table) => canManageCouncilLookups(u, councilId, table));
}

/**
 * The dashboard's personnel audits (no-shows, shifts awaiting hours) name members and their reasons, so they are
 * for the council's Admins and any Super Admin; finance officers see only the monthly summary.
 */
export const canViewExecutiveAudits = (u: Actor, councilId: number): boolean => canAdministerCouncil(u, councilId);

/** Every council's lessons learned are open to Admins and Super Admins; changing one follows canRecordLedger. */
export const canBrowseLessonsRegistry = (u: Actor): boolean => isAdmin(u);

/** Only Super Admins add, change or delete councils (drivers: SUPER_ADMIN_REQUIRED). */
export const canMaintainCouncils = (u: Actor): boolean => isSuperAdmin(u);

/** Super Admins act on any council; Admins only on their own. */
export const canAdministerCouncil = (u: Actor, councilId: number): boolean =>
  isSuperAdmin(u) || (u.memberType === 'Admin' && u.councilId === councilId);

/**
 * Parishes, pastors, activities and distribution lists of a council: its Admins and any Super Admin
 * (drivers: ADMIN_REQUIRED, COUNCIL_ACCESS_DENIED).
 */
export const canMaintainCouncilRecords = (u: Actor, councilId: number): boolean => canAdministerCouncil(u, councilId);

/** Admins and Super Admins schedule events and shifts. */
export const canPlanEvents = (u: Actor): boolean => isAdmin(u);

/** Admins, Super Admins and any officer of the council schedule meetings, invite members and upload minutes. */
export const canManageMeetings = (u: Actor, councilId: number): boolean =>
  canAdministerCouncil(u, councilId) || (u.isOfficer && u.councilId === councilId);

/** One existing meeting's attendance, minutes and details: its owner (OwnerID) and anyone who manages the council's meetings. */
export const canManageMeeting = (u: Actor, meeting: Pick<Meeting, 'CouncilID' | 'OwnerID'>): boolean =>
  meeting.OwnerID === u.memberId || canManageMeetings(u, meeting.CouncilID);

/** Admins record post-event results for their councils' events, and the event's owner may too. */
export const canRecordLedger = (u: Actor, event: Pick<Event, 'OwnerID'>, eventCouncilIds: readonly number[]): boolean =>
  event.OwnerID === u.memberId || eventCouncilIds.some((id) => canAdministerCouncil(u, id));

/** "Add member" / "Create profile" controls for a council: its Admins and Super Admins (drivers: ADMIN_REQUIRED, COUNCIL_ACCESS_DENIED). */
export const canCreateMembers = (u: Actor, councilId: number): boolean => canAdministerCouncil(u, councilId);

/** Edit controls on a member's profile: their council's Admins and Super Admins, or the member themselves (contact details and skills). */
export const canEditMember = (u: Actor, member: Pick<Member, 'id' | 'CouncilID'>): boolean =>
  u.memberId === member.id || canAdministerCouncil(u, member.CouncilID);

/**
 * Member types the user may pick for a member now of `currentType` (omit when adding one). Empty means
 * hide the type and promotion controls: Members never change types, and Admins cannot touch a Super Admin's.
 */
export function grantableMemberTypes(u: Actor, currentType?: MemberType['Type']): MemberType['Type'][] {
  if (isSuperAdmin(u)) return ['Super Admin', 'Admin', 'Member'];
  if (!isAdmin(u) || currentType === 'Super Admin') return [];
  return ['Admin', 'Member'];
}

/** Holds the Financial Secretary or Treasurer role (FINANCE_ROLE_NAMES). */
export const isFinanceOfficer = (u: Actor): boolean => holdsFinanceRole(u.roles);

/**
 * The council's donation log, its donation form and its monthly summaries: its Admins, its Financial
 * Secretary and Treasurer, and any Super Admin.
 */
export const canManageFinances = (u: Actor, councilId: number): boolean =>
  canAdministerCouncil(u, councilId) || (isFinanceOfficer(u) && u.councilId === councilId);

/**
 * Edit and delete controls on a donation, mirroring the drivers' assertMayChangeDonation (activity status is
 * checked there): its recorder, its event's owner, the council's finance officers and Admins, any Super Admin.
 */
export const canChangeDonation = (u: Actor, donation: Pick<Donation, 'CouncilID' | 'RecordedBy'>, eventOwnerId: number | null): boolean =>
  donation.RecordedBy === u.memberId || eventOwnerId === u.memberId || canManageFinances(u, donation.CouncilID);

/**
 * The council's expense queue, approvals and check disbursements, mirroring the drivers' assertMayAuditCouncilExpenses
 * (activity status is checked there): its Admins, its Financial Secretary and Treasurer, and any Super Admin. Every
 * member files and reads their own expense reports.
 */
export const canAuditCouncilExpenses = (u: Actor, councilId: number): boolean => canManageFinances(u, councilId);

/**
 * Photo upload controls on an event, mirroring the drivers' assertMayAttachEventMedia (activity status is checked
 * there): its owner, an Admin or finance officer of a council it is linked to, any Super Admin.
 */
export const canAttachEventMedia = (u: Actor, event: Pick<Event, 'OwnerID'>, eventCouncilIds: readonly number[]): boolean =>
  event.OwnerID === u.memberId || eventCouncilIds.some((id) => canManageFinances(u, id));

/** Google Drive link controls on a meeting (assertMayLinkMeetingDrive): its owner, the council's Admins and finance officers, any Super Admin. */
export const canLinkMeetingDrive = (u: Actor, meeting: Pick<Meeting, 'CouncilID' | 'OwnerID'>): boolean =>
  meeting.OwnerID === u.memberId || canManageFinances(u, meeting.CouncilID);

/**
 * Sections shown in the portal's navigation. The ledger is open to everyone because event owners use it, and the
 * meeting center because a meeting's owner may be any member (it is read-only for everyone else without rights).
 */
export function portalAreas(u: Actor): PortalArea[] {
  // Admins and Super Admins volunteer too, so the member hub leads everyone's navigation, then the shared views.
  const areas: PortalArea[] = ['member-actions', 'calendar', 'gallery'];
  if (canMaintainLookups(u)) areas.push('lookups');
  if (canMaintainCouncils(u)) areas.push('councils');
  if (canOpenCouncilLookups(u)) areas.push('council-lookups');
  if (isAdmin(u)) areas.push('parishes', 'members', 'activities');
  if (canPlanEvents(u)) areas.push('events');
  areas.push('meetings');
  if (isAdmin(u)) areas.push('distribution-lists');
  if (isAdmin(u) || isFinanceOfficer(u)) areas.push('donations');
  areas.push('ledger');
  if (canBrowseLessonsRegistry(u)) areas.push('lessons-registry');
  if (isAdmin(u) || isFinanceOfficer(u)) areas.push('dashboard');
  areas.push('messages', 'profile');
  return areas;
}
