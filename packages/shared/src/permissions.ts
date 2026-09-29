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
import { GRAND_KNIGHT_ROLE } from './elections';
import { FINANCE_LOOKUP_TABLES, holdsFinanceRole } from './rules';
import type { Donation, Event, ExpenseReport, Meeting, Member, MemberType } from './types';

/** `roles` (Role names) matters only to the finance areas; omitted, the member holds none. `isBudgetDirector` only to the budget. */
type Actor = Pick<SessionUser, 'memberId' | 'councilId' | 'memberType' | 'isOfficer'> & { roles?: readonly string[]; isBudgetDirector?: boolean };

/**
 * Each area is also its route: RequireArea links to `/${area}` (so 'expenses/queue' is /expenses/queue), except the
 * areas PORTAL_AREA_ROUTES names (portalAreaHref).
 */
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
  | 'elections'
  | 'elections/appointments'
  | 'distribution-lists'
  | 'ledger'
  | 'expenses'
  | 'expenses/queue'
  | 'expenses/disbursements'
  | 'charities/propose'
  | 'charities/registry'
  | 'charities/queue'
  | 'lessons-registry'
  | 'donations'
  | 'dashboard'
  | 'supreme-sync'
  | 'financials/budget'
  | 'messages'
  | 'profile';

/** Areas served from a route other than `/${area}`: the budget center lives at /budget (Sprint 5Y-2). */
export const PORTAL_AREA_ROUTES: Partial<Record<PortalArea, string>> = { 'financials/budget': '/budget' };

/** The route of a portal area. */
export const portalAreaHref = (area: PortalArea): string => PORTAL_AREA_ROUTES[area] ?? `/${area}`;

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
  const all: CouncilLookupTableName[] = ['Activities', 'DonationType', 'CouncilDonationMethod', 'CouncilBudgetCategory'];
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
 * The council's expense queue, approvals and returns, mirroring the drivers' assertMayAuditCouncilExpenses (activity
 * status is checked there): its Admins, its Financial Secretary and Treasurer, and any Super Admin. Every member
 * files and reads their own expense reports.
 */
export const canAuditCouncilExpenses = (u: Actor, councilId: number): boolean => canManageFinances(u, councilId);

/**
 * The check disbursement ledger of a council, mirroring assertMayDisburseCouncilExpenses (Sprint 5S): its Financial
 * Secretary and Treasurer, and any Super Admin. A council Admin without a finance role audits but does not pay.
 */
export const canDisburseCouncilExpenses = (u: Actor, councilId: number): boolean =>
  isSuperAdmin(u) || (isFinanceOfficer(u) && u.councilId === councilId);

/**
 * The approve control on one expense sheet (drivers: assertMayAuditCouncilExpenses, then assertNotSelfApproval):
 * council leadership, and never on their own sheet, whatever their role.
 */
export const canApproveExpenseReport = (u: Actor, report: Pick<ExpenseReport, 'CouncilID' | 'SubmitterMemberID'>): boolean =>
  canAuditCouncilExpenses(u, report.CouncilID) && report.SubmitterMemberID !== u.memberId;

/**
 * The pay checkbox on one approved expense sheet (drivers: assertMayDisburseCouncilExpenses, then
 * assertNoSelfPayout): the council's finance officers or a Super Admin, and never on their own sheet.
 */
export const canPayExpenseReport = (u: Actor, report: Pick<ExpenseReport, 'CouncilID' | 'SubmitterMemberID'>): boolean =>
  canDisburseCouncilExpenses(u, report.CouncilID) && report.SubmitterMemberID !== u.memberId;

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
 * The Communications Hub's alert dispatch tile, mirroring assertMayDispatchCouncilAlerts (Sprint 5T; activity status is
 * checked there): the council's Admins, Financial Secretary and Treasurer, and any Super Admin.
 */
export const canDispatchCouncilAlerts = (u: Actor, councilId: number): boolean => canManageFinances(u, councilId);

/** The Supreme Compliance Center's preview and transmit controls, mirroring assertMaySyncSupremeReports (Sprint 5T). */
export const canSyncSupremeReports = (u: Actor, councilId: number): boolean => canManageFinances(u, councilId);

/**
 * The Appointed Leadership Matrix, mirroring assertMayAppointOfficers (Sprint 5U; activity status and the seat's council
 * are checked there): the sitting Grand Knight and any Super Admin.
 */
export const canAppointOfficers = (u: Actor): boolean => isSuperAdmin(u) || (u.roles ?? []).includes(GRAND_KNIGHT_ROLE);

/** The Officer Election Parameters tab, mirroring assertMayConfigureBallot: the council's Admins and any Super Admin. */
export const canConfigureBallot = (u: Actor, councilId: number): boolean => canAdministerCouncil(u, councilId);

/**
 * The Global Charities Registry screen and its "add a charity" form, mirroring assertMayAddGlobalCharity (Sprint 5V):
 * Admins and Super Admins. Every member may search the registry from the proposal desk.
 */
export const canManageCharityRegistry = (u: Actor): boolean => isAdmin(u);

/** Connect controls on the registry's suggestions, mirroring assertMayConnectCouncilCharity: the council's leadership. */
export const canConnectCouncilCharity = (u: Actor, councilId: number): boolean => canManageFinances(u, councilId);

/** The council's charity proposals, ledger and reject control, mirroring assertMayReviewCharityProposals. */
export const canReviewCharityProposals = (u: Actor, councilId: number): boolean => canManageFinances(u, councilId);

/**
 * The Charitable Disbursements Ledger, mirroring assertMayDisburseCharity (Sprint 5V): the council's Financial Secretary
 * and Treasurer, and any Super Admin. Charity checks come out of the same checkbook as expense checks.
 */
export const canDisburseCharity = (u: Actor, councilId: number): boolean => canDisburseCouncilExpenses(u, councilId);

/**
 * Edit controls on the annual budget, mirroring assertMayManageBudgetForecast (Sprint 5Y; activity status is checked
 * there): the council's Admins, its Financial Secretary and Treasurer, its Designated Budget Director (Sprint 5Y-3), and
 * any Super Admin.
 */
export const canManageBudgetForecast = (u: Actor, councilId: number): boolean =>
  canManageFinances(u, councilId) || (u.isBudgetDirector === true && u.councilId === councilId);

/** Reading the annual budget, mirroring assertMayViewBudgetForecast (Sprint 5Y-3): every member of the council, any Super Admin. */
export const canViewBudgetForecast = (u: Actor, councilId: number): boolean => isSuperAdmin(u) || u.councilId === councilId;

/** The roster's "Designated Budget Director" control: the member's council Admins and any Super Admin (members.update). */
export const canDesignateBudgetDirector = (u: Actor, member: Pick<Member, 'CouncilID'>): boolean => canAdministerCouncil(u, member.CouncilID);

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
  if (canAppointOfficers(u)) areas.push('elections/appointments');
  if (isAdmin(u)) areas.push('parishes', 'members', 'activities');
  if (canPlanEvents(u)) areas.push('events');
  // Every member may put a brother Knight up for office (the drivers check they are Active).
  areas.push('meetings', 'elections');
  if (isAdmin(u)) areas.push('distribution-lists');
  if (isAdmin(u) || isFinanceOfficer(u)) areas.push('donations');
  // Every member files their own expense reports; the council's leadership audits them; only its finance officers
  // (or a Super Admin) pay them.
  // Every member may propose a charity grant (Sprint 5V).
  areas.push('ledger', 'expenses', 'charities/propose');
  if (isAdmin(u) || isFinanceOfficer(u)) areas.push('expenses/queue');
  if (isSuperAdmin(u) || isFinanceOfficer(u)) areas.push('expenses/disbursements', 'charities/queue');
  if (canBrowseLessonsRegistry(u)) areas.push('lessons-registry');
  if (canManageCharityRegistry(u)) areas.push('charities/registry');
  if (isAdmin(u) || isFinanceOfficer(u)) areas.push('dashboard', 'supreme-sync');
  // Every member may read the council's annual budget (Sprint 5Y-3 transparency); canManageBudgetForecast decides editing.
  areas.push('financials/budget');
  areas.push('messages', 'profile');
  return areas;
}

/**
 * A sidebar link: a portal area, except the profile, which the header's member menu opens, and the Communications Hub,
 * which the header's Messaging shortcut opens (Sprint 5X). The help center is the header's Help shortcut, not a sidebar
 * link (Sprint 5W).
 */
export type PortalNavItem = Exclude<PortalArea, 'profile' | 'messages'>;

export interface PortalNavGroup {
  id: 'self-service' | 'volunteer' | 'finance' | 'admin';
  label: string;
  /** The Self-Service Hub is always open; the other groups fold. */
  collapsible: boolean;
  items: PortalNavItem[];
}

/** Every sidebar link in its group, in display order (Sprint 5S). Each PortalArea but 'profile' and 'messages' appears exactly once. */
export const PORTAL_NAV_GROUPS: readonly PortalNavGroup[] = [
  { id: 'self-service', label: 'Self-Service Hub', collapsible: false, items: ['member-actions', 'charities/propose'] },
  {
    id: 'volunteer',
    label: 'Volunteer Operations',
    collapsible: true,
    items: ['calendar', 'activities', 'members', 'events', 'meetings', 'elections', 'gallery', 'ledger', 'lessons-registry', 'distribution-lists'],
  },
  { id: 'finance', label: 'Financial Ledgers', collapsible: true, items: ['dashboard', 'donations', 'expenses', 'expenses/queue', 'expenses/disbursements', 'charities/queue', 'financials/budget'] },
  { id: 'admin', label: 'Administrative Lookups', collapsible: true, items: ['council-lookups', 'charities/registry', 'elections/appointments', 'supreme-sync', 'lookups', 'parishes', 'councils'] },
];

/** The sidebar for `u`: each group holding only the links portalAreas allows; empty groups are dropped. */
export function portalNavGroups(u: Actor): PortalNavGroup[] {
  const allowed = new Set<string>(portalAreas(u));
  return PORTAL_NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((item) => allowed.has(item)) })).filter((g) => g.items.length > 0);
}
