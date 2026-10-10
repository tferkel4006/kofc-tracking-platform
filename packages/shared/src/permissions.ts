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
import { budgetWindowOf } from './budget';
import { ALL_FEATURES_ON, withFeatureFlags, type FeatureFlags } from './features';
import { DEFAULT_TENANT_TYPE, withTenantGate, type TenantType } from './tenant';
import { AGENDA_EDITOR_ROLE_NAMES } from './agenda';
import { GRAND_KNIGHT_ROLE, TRUSTEE_ROLE_NAMES } from './elections';
import { FINANCE_LOOKUP_TABLES, FINANCIAL_SECRETARY_ROLE_NAME, holdsExecutiveRole, holdsFinanceRole } from './rules';
import { TREASURER_ROLE_NAME } from './treasurer-desk';
import type { BudgetLineStatus, CharitableRequest, CharitableThreadType, Donation, Event, ExpenseReport, Meeting, Member, MemberType } from './types';

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
  | 'feature-flags'
  | 'council-lookups'
  | 'parishes'
  | 'members'
  | 'activities'
  | 'events'
  | 'meetings'
  | 'meetings/cadence'
  | 'meetings/live'
  | 'elections'
  | 'elections/appointments'
  | 'distribution-lists'
  | 'ledger'
  | 'expenses'
  | 'expenses/queue'
  | 'expenses/audit'
  | 'expenses/authorize'
  | 'expenses/disbursements'
  | 'charities/propose'
  | 'charities/registry'
  | 'charities/queue'
  | 'charities/vetting'
  | 'lessons-registry'
  | 'donations'
  | 'dashboard'
  | 'finance/dashboard'
  | 'finance/ledger'
  | 'finance/balance-sheet'
  | 'finance/audit'
  | 'finance/treasurer-desk'
  | 'supreme-sync'
  | 'financials/budget'
  | 'messages'
  | 'help'
  | 'answers/help'
  | 'governance/bylaws'
  | 'governance/advisor'
  | 'answers/sop'
  | 'resources/bulletins'
  | 'resources/marketing'
  | 'credentials-vault'
  | 'performance/charts'
  | 'history'
  | 'faith-center'
  | 'member-center'
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

/**
 * The council's Meeting Agenda Templates tab, mirroring assertMayManageAgendaTemplates (Sprint 5Y-6; activity status is
 * checked there): the council's Admins and Grand Knight, and any Super Admin.
 */
export const canManageAgendaTemplates = (u: Actor, councilId: number): boolean =>
  canAdministerCouncil(u, councilId) || ((u.roles ?? []).includes(GRAND_KNIGHT_ROLE) && u.councilId === councilId);

/**
 * The council lookups screen: Admins and Super Admins, finance officers for the donation lookups, and the Grand Knight
 * for the agenda templates (Sprint 5Y-6).
 */
/**
 * The Cadence Engine panel (Sprint 5Z-6), mirroring assertMayScheduleCouncilCadence (activity status is checked there):
 * the council's Admins and Grand Knight, and any Super Admin - the same keepers as the agenda templates.
 */
/**
 * The Council Bylaws Data Vault's Edit button (Sprint 6Z), mirroring assertMayEditBylaws (activity status is checked
 * there): the council's meeting keepers, as for the agenda templates.
 */
export const canEditBylaws = (u: Actor, councilId: number): boolean => canManageAgendaTemplates(u, councilId);

export const canManageCouncilCadence = (u: Actor, councilId: number): boolean => canManageAgendaTemplates(u, councilId);

export const canOpenCouncilLookups = (u: Actor): boolean => isAdmin(u) || isFinanceOfficer(u) || (u.roles ?? []).includes(GRAND_KNIGHT_ROLE);

/** The council lookup tables `u` may open for `councilId`, in tab order; a finance officer gets only the donation lookups. */
export function councilLookupTablesFor(u: Actor, councilId: number): CouncilLookupTableName[] {
  const all: CouncilLookupTableName[] = ['Activities', 'DonationType', 'CouncilDonationMethod', 'CouncilBudgetCategory'];
  return all.filter((table) => canManageCouncilLookups(u, councilId, table));
}

/** Holds the Grand Knight or Deputy Grand Knight seat (EXECUTIVE_ROLE_NAMES, Sprint 5Z-2.5). */
export const isExecutiveOfficer = (u: Actor): boolean => holdsExecutiveRole(u.roles);

/** The Grand Knight or Deputy Grand Knight of `councilId`: executive reach inside their own council (Sprint 5Z-2.5). */
const isCouncilExecutive = (u: Actor, councilId: number): boolean => isExecutiveOfficer(u) && u.councilId === councilId;

/**
 * The Executive Summary Dashboard (Sprint 5Z-2.5): the council's Admins, its finance officers, every officer of the
 * council (any Role with Officer = 1: Grand Knight, Deputy Grand Knight, Financial Secretary, Treasurer, Recorder,
 * Trustees and the other seated officers - the same audience as the Pooled Vetting Desk), and any Super Admin. It is
 * read-only; budget approval and Supreme filing stay with their own gates.
 */
export const canViewExecutiveDashboard = (u: Actor, councilId: number): boolean =>
  canManageFinances(u, councilId) || isCouncilExecutive(u, councilId) || (u.isOfficer && u.councilId === councilId);

/**
 * The dashboard's personnel audits (no-shows, shifts awaiting hours), part of the dashboard's full view: every reader of
 * the dashboard (canViewExecutiveDashboard, Sprint 5Z-2.5).
 */
export const canViewExecutiveAudits = (u: Actor, councilId: number): boolean => canViewExecutiveDashboard(u, councilId);

/**
 * The Volunteer Time Quarantine Desk on the dashboard (Sprint 7B), mirroring assertMayReviewQuarantine (activity status is
 * checked there): the council's Admins, Grand Knight and Deputy Grand Knight, and any Super Admin.
 */
export const canReviewVolunteerQuarantine = (u: Actor, councilId: number): boolean =>
  isSuperAdmin(u) || (u.councilId === councilId && (isAdmin(u) || isExecutiveOfficer(u)));

/** Every council's lessons learned are open to Admins and Super Admins; changing one follows canRecordLedger. */
export const canBrowseLessonsRegistry = (u: Actor): boolean => isAdmin(u);

/** Only Super Admins add, change or delete councils (drivers: SUPER_ADMIN_REQUIRED). */
export const canMaintainCouncils = (u: Actor): boolean => isSuperAdmin(u);

/**
 * The Feature Flags Control Center (/feature-flags, Sprint 6R; the panel used to sit on the Councils page): Super Admins
 * only, the same tier councils.setFeatureFlags enforces (SUPER_ADMIN_REQUIRED).
 */
export const canOpenFeatureFlagsControlCenter = (u: Actor): boolean => isSuperAdmin(u);

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

/**
 * Making a distribution list council-wide (Sprint 5Z-10.8), mirroring assertMayCreateDistributionList: the council's Admins
 * and any Super Admin. Everyone else builds private lists only.
 */
export const canPublishDistributionList = (u: Actor, councilId: number): boolean => canMaintainCouncilRecords(u, councilId);

/** Changing a list (Sprint 5Z-10.8): a council-wide list by the council's Admins, a private one by its creator alone. */
export const canEditDistributionList = (u: Actor, list: { CouncilID?: number; CreatedBy?: number | null; IsCouncilWide?: number | null }): boolean =>
  list.IsCouncilWide === 0 ? list.CreatedBy === u.memberId : canMaintainCouncilRecords(u, list.CouncilID ?? 0);

/** Admins, Super Admins and any officer of the council schedule meetings, invite members and upload minutes. */
export const canManageMeetings = (u: Actor, councilId: number): boolean =>
  canAdministerCouncil(u, councilId) || (u.isOfficer && u.councilId === councilId);

/**
 * Running a meeting from the Live Meeting Console (Sprint 5Z-10), mirroring assertMayRunLiveAssembly: the meeting's owner,
 * the council's Admins and officers (the Grand Knight and Recorder among them), and any Super Admin.
 */
export const canRunLiveAssembly = (u: Actor, meeting: Pick<Meeting, 'CouncilID' | 'OwnerID'>): boolean =>
  meeting.OwnerID === u.memberId || canManageMeetings(u, meeting.CouncilID);

/**
 * Sprint 6B, mirroring assertMayEditLiveAgenda: laying out and correcting the live agenda and recording hand-vote tallies
 * belong to the council's Grand Knight and Recorder, its Admins, and any Super Admin.
 */
export const canEditLiveAgenda = (u: Actor, meeting: Pick<Meeting, 'CouncilID'>): boolean =>
  canAdministerCouncil(u, meeting.CouncilID) ||
  (u.councilId === meeting.CouncilID && (u.roles ?? []).some((r) => (AGENDA_EDITOR_ROLE_NAMES as readonly string[]).includes(r)));

/** One existing meeting's attendance, minutes and details: its owner (OwnerID) and anyone who manages the council's meetings. */
export const canManageMeeting = (u: Actor, meeting: Pick<Meeting, 'CouncilID' | 'OwnerID'>): boolean =>
  meeting.OwnerID === u.memberId || canManageMeetings(u, meeting.CouncilID);

/**
 * Standard members' calendars show only what is still ahead (events.listCalendarRange `hideEnded`, Sprint 5X-Mobile);
 * Admins, Super Admins and officers keep past entries for their records.
 */
export const calendarHidesEnded = (u: Actor): boolean => !isAdmin(u) && !u.isOfficer;

/** Seated officers, Admins and Super Admins see the sidebar's Council Archive Vault link (Sprint 5Z-Demo-Final). */
export const canOpenArchiveVault = (u: Actor): boolean => isAdmin(u) || u.isOfficer;

/**
 * The AI Generative Marketing Factory (Sprint 6C, Phase 4): the council's event planners and officers - Admins, Super
 * Admins and seated officers, the Council Archive Vault's audience. Filing a flyer on an event follows
 * canAttachEventMedia (events.setFlyerFile), and only an Admin's flyer reaches the Drive vault.
 */
export const canOpenMarketingFactory = (u: Actor): boolean => canOpenArchiveVault(u);

/**
 * Sprint 6L Extension: the officer tools an ordinary member's sidebar never shows - the Constitutional Advisor and the
 * Credentials Vault. Seated officers and Super Admins open them; so do the council's Admins, who already keep its email
 * gateway and Drive key. Saving a credential still follows assertMayMaintainCouncilRecords (council Admins, Super Admins).
 */
export const canOpenOfficerTools = (u: Actor): boolean => isSuperAdmin(u) || u.isOfficer || isAdmin(u);
export const canOpenConstitutionalAdvisor = (u: Actor): boolean => canOpenOfficerTools(u);
export const canOpenCredentialsVault = (u: Actor): boolean => canOpenOfficerTools(u);

/**
 * Updating an event's results on the post-event ledger (Sprint 6R): strictly the event's owner, an elected officer
 * (isOfficer: a Role with Officer = 1) of a council the event is linked to, an Admin of such a council, and any Super
 * Admin. Every other member sees neither the event on the ledger nor a link to update it.
 */
export const canRecordLedger = (u: Actor, event: Pick<Event, 'OwnerID'>, eventCouncilIds: readonly number[]): boolean =>
  event.OwnerID === u.memberId || eventCouncilIds.some((id) => canAdministerCouncil(u, id) || (u.isOfficer && u.councilId === id));

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
 * The council's expense queue and returns, mirroring the drivers' assertMayAuditCouncilExpenses (activity
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

/** Holds the council's Financial Secretary seat (Sprint 5Z-4: the seat that issues expense written orders). */
export const isFinancialSecretary = (u: Actor): boolean => (u.roles ?? []).includes(FINANCIAL_SECRETARY_ROLE_NAME);
/** Holds the council's Treasurer seat (Sprint 6Q: the seat that codes expense sheets to the ledger). */
export const isTreasurer = (u: Actor): boolean => (u.roles ?? []).includes(TREASURER_ROLE_NAME);
/** Holds the council's Grand Knight seat (Sprint 5Z-4: the seat that counter-signs expense orders). */
export const isGrandKnight = (u: Actor): boolean => (u.roles ?? []).includes(GRAND_KNIGHT_ROLE);

/**
 * The Financial Secretary Audit Desk of a council (Sprint 5Z-4): its Financial Secretary, its Admins and any Super Admin
 * may open it. Only the Financial Secretary or a Super Admin signs there (canIssueExpenseOrder); an Admin reads it.
 */
export const canOpenExpenseAuditDesk = (u: Actor, councilId: number): boolean =>
  canAdministerCouncil(u, councilId) || (isFinancialSecretary(u) && u.councilId === councilId);

/**
 * The Grand Knight Authorization Desk of a council (Sprint 5Z-4): its Grand Knight, its Admins and any Super Admin may
 * open it. Only the Grand Knight or a Super Admin counter-signs there (canCounterSignExpenseOrder); an Admin reads it.
 */
export const canOpenExpenseAuthorizeDesk = (u: Actor, councilId: number): boolean =>
  canAdministerCouncil(u, councilId) || (isGrandKnight(u) && u.councilId === councilId);

/**
 * The Treasurer Ledger Audit Desk of a council (Sprint 6Q), mirroring assertMayReadTreasurerDesk: its Treasurer, its
 * Admins and any Super Admin may open it. Only the Treasurer or a Super Admin codes there (expenseLedgerCodeBlock).
 */
export const canOpenTreasurerDesk = (u: Actor, councilId: number): boolean =>
  canAdministerCouncil(u, councilId) || (isTreasurer(u) && u.councilId === councilId);

/**
 * The '💰 Log Concluded Event Revenues' card (Sprint 6Q), mirroring assertMayCodeExpenseLedger: the council's Treasurer
 * or any Super Admin.
 */
export const canLogConcludedRevenue = (u: Actor, councilId: number): boolean => isSuperAdmin(u) || (isTreasurer(u) && u.councilId === councilId);

/** Why the signed-in officer may not sign a line on a sheet (Sprint 5Z-4), or null when they may. */
export type ExpenseSignatureBlock = 'seat' | 'own-report' | 'collusion';

/**
 * The '📜 Approve Expense' control on one sheet, mirroring assertMayIssueExpenseOrder then assertNotSelfApproval
 * (activity status is checked there): the council's Financial Secretary or any Super Admin, never on their own sheet.
 */
export function expenseOrderBlock(u: Actor, report: Pick<ExpenseReport, 'CouncilID' | 'SubmitterMemberID'>): ExpenseSignatureBlock | null {
  if (!(isSuperAdmin(u) || (isFinancialSecretary(u) && u.councilId === report.CouncilID))) return 'seat';
  if (report.SubmitterMemberID === u.memberId) return 'own-report';
  return null;
}

export const canIssueExpenseOrder = (u: Actor, report: Pick<ExpenseReport, 'CouncilID' | 'SubmitterMemberID'>): boolean =>
  expenseOrderBlock(u, report) === null;

/**
 * The '✍️ Countersign Expense' control on one sheet, mirroring assertMayAuthorizeExpenseOrder, assertNotSelfApproval and
 * assertDistinctExpenseSigners: the council's Grand Knight or any Super Admin, never on their own sheet, and never by
 * the officer who issued its written order ('collusion', the Collusion Guard).
 */
export function expenseCounterSignBlock(
  u: Actor,
  report: Pick<ExpenseReport, 'CouncilID' | 'SubmitterMemberID' | 'FinancialSecretaryMemberID'> & Partial<Pick<ExpenseReport, 'TreasurerMemberID'>>,
): ExpenseSignatureBlock | null {
  if (!(isSuperAdmin(u) || (isGrandKnight(u) && u.councilId === report.CouncilID))) return 'seat';
  if (report.SubmitterMemberID === u.memberId) return 'own-report';
  if (report.FinancialSecretaryMemberID === u.memberId) return 'collusion';
  if (report.TreasurerMemberID != null && report.TreasurerMemberID === u.memberId) return 'collusion';
  return null;
}

export const canCounterSignExpenseOrder = (
  u: Actor,
  report: Pick<ExpenseReport, 'CouncilID' | 'SubmitterMemberID' | 'FinancialSecretaryMemberID'> & Partial<Pick<ExpenseReport, 'TreasurerMemberID'>>,
): boolean => expenseCounterSignBlock(u, report) === null;

/**
 * The '🧾 Code to Ledger' control on one sheet (Sprint 6Q), mirroring assertMayCodeExpenseLedger, assertNotSelfApproval
 * and assertDistinctExpenseSigners: the council's Treasurer or any Super Admin, never on their own sheet, and never the
 * officer who issued its written order ('collusion').
 */
export function expenseLedgerCodeBlock(
  u: Actor,
  report: Pick<ExpenseReport, 'CouncilID' | 'SubmitterMemberID' | 'FinancialSecretaryMemberID'>,
): ExpenseSignatureBlock | null {
  if (!canLogConcludedRevenue(u, report.CouncilID)) return 'seat';
  if (report.SubmitterMemberID === u.memberId) return 'own-report';
  if (report.FinancialSecretaryMemberID === u.memberId) return 'collusion';
  return null;
}

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
 * The asset form and the assets inventory (Sprint 6P), mirroring assertMayManageCouncilAssets (activity status is checked
 * there): the council's expense leadership and its Grand Knight, who lands on the form after approving an asset sheet.
 */
export const canManageCouncilAssets = (u: Actor, councilId: number): boolean =>
  canAuditCouncilExpenses(u, councilId) || (isGrandKnight(u) && u.councilId === councilId);

/**
 * The Planning Hours form on an event (Sprint 6P), mirroring assertMayLogPlanningTime: the event's owner, an officer or
 * Admin of a council the event is linked to, and any Super Admin.
 */
export const canLogPlanningTime = (u: Actor, event: Pick<Event, 'OwnerID'>, eventCouncilIds: readonly number[]): boolean =>
  isSuperAdmin(u) || event.OwnerID === u.memberId || ((u.memberType === 'Admin' || u.isOfficer) && eventCouncilIds.includes(u.councilId));

/** A Smart Album's Delete button (Sprint 6P), mirroring assertMayDeleteSmartAlbum: who saved it, its council's Admins, Super Admins. */
export const canDeleteSmartAlbum = (u: Actor, album: { council_id: number; created_by_member_id: number }): boolean =>
  isSuperAdmin(u) || album.created_by_member_id === u.memberId || (u.memberType === 'Admin' && u.councilId === album.council_id);

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
 * The Pooled Vetting Desk (Sprint 5Z-2), mirroring assertMayVetCharitableRequests (activity status is checked there): the
 * council's officers (Trustees included) and Admins, and any Super Admin.
 */
export const canVetCharitableRequests = (u: Actor, councilId: number): boolean =>
  canAdministerCouncil(u, councilId) || isCouncilExecutive(u, councilId) || (u.isOfficer && u.councilId === councilId);

/**
 * The vetting drawer on a request another officer has claimed, mirroring mayOverrideVettingClaim (Sprint 5Z-2.5): the
 * council's Admins, Grand Knight and Deputy Grand Knight, and any Super Admin. The Sponsor Restriction still applies.
 */
export const canOverrideVettingClaim = (u: Actor, councilId: number): boolean => canAdministerCouncil(u, councilId) || isCouncilExecutive(u, councilId);

/**
 * The claim and vetting controls on one intake request (Sprint 5Z-2): vetting authority for its council, and never on a
 * request the viewer carries as its Knight Shepherd (the Four-Eyes Principle, assertIndependentVetter).
 */
export const isSponsorRestricted = (u: Actor, request: { ShepherdMemberID: number }): boolean => request.ShepherdMemberID === u.memberId;

/**
 * The vetting threads on one request (Sprint 6H), mirroring charitableThreadAccess (activity status and the request's
 * stage are checked there). The Knight Shepherd uses only 'MORE_INFO'. 'MORE_INFO' is otherwise for the request's
 * vetting officer - its claiming vetter, or the council's Admins, Grand Knight and Deputy Grand Knight and any Super
 * Admin - and 'OFFICER_INPUT' for everyone with vetting authority for the council.
 */
export function canUseCharitableThread(
  u: Actor,
  request: Pick<CharitableRequest, 'CouncilID' | 'ShepherdMemberID' | 'VetterMemberID'>,
  threadType: CharitableThreadType,
): boolean {
  if (isSponsorRestricted(u, request)) return threadType === 'MORE_INFO';
  if (!canVetCharitableRequests(u, request.CouncilID)) return false;
  return threadType === 'OFFICER_INPUT' || request.VetterMemberID === u.memberId || canOverrideVettingClaim(u, request.CouncilID);
}

/**
 * Edit controls on the annual budget, mirroring assertMayManageBudgetForecast (Sprint 5Y; activity status is checked
 * there): the council's Admins, its Financial Secretary and Treasurer, its Designated Budget Director (Sprint 5Y-3), and
 * any Super Admin.
 */
export const canManageBudgetForecast = (u: Actor, councilId: number): boolean =>
  canManageFinances(u, councilId) || (u.isBudgetDirector === true && u.councilId === councilId);

/**
 * The budget's inputs, rollup and custom-line controls for one year, mirroring the drivers' two write checks
 * (Sprint 5Y-3.5): canManageBudgetForecast, and the drafting window - May 1 00:00 through June 30 midnight local time
 * (budgetWindowOf 'Draft', assertBudgetYearWritable) - unless a Super Admin is overriding it.
 */
export const canEditBudgetYear = (
  u: Actor,
  councilId: number,
  fraternalYear: string,
  today: Date,
  superAdminOverride = false,
  status: BudgetLineStatus = 'Draft',
): boolean =>
  // Sprint 5Y-4: an approved year is frozen for everyone (BUDGET_YEAR_APPROVED); no override reopens it.
  status !== 'Approved' &&
  canManageBudgetForecast(u, councilId) &&
  (budgetWindowOf(fraternalYear, today) === 'Draft' || (superAdminOverride && isSuperAdmin(u)));

/**
 * The "Approve & Finalize Entire Budget" button, mirroring assertMayApproveBudget and assertBudgetYearApprovable
 * (Sprint 5Y-4): the council's Admins, Financial Secretary and Treasurer, or a Super Admin - not the Budget Director -
 * once the year has opened on May 1 (or a Super Admin is overriding), while it is not yet approved and has lines.
 */
export const canApproveBudget = (u: Actor, councilId: number): boolean => canManageFinances(u, councilId);

export const canFinalizeBudgetYear = (
  u: Actor,
  councilId: number,
  fraternalYear: string,
  today: Date,
  status: BudgetLineStatus,
  lineCount: number,
  superAdminOverride = false,
): boolean =>
  canApproveBudget(u, councilId) &&
  status !== 'Approved' &&
  lineCount > 0 &&
  (budgetWindowOf(fraternalYear, today) !== 'Not Yet Open' || (superAdminOverride && isSuperAdmin(u)));

/**
 * The dashboard's budget gauges and the budget page's Historical Performance Review (Sprint 5Y-4), mirroring
 * assertMayReviewBudgetPerformance: the same readers as the executive summaries, every officer of the council included
 * (Sprint 5Z-2.5).
 */
export const canReviewBudgetPerformance = (u: Actor, councilId: number): boolean => canViewExecutiveDashboard(u, councilId);

/**
 * The general ledger screens (Sprint 5Z-8: /finance/dashboard, /finance/ledger, /finance/balance-sheet), mirroring
 * assertMayReadGeneralLedger: the executive dashboard's readers - the council's Admins and seated officers - and any Super
 * Admin.
 */
export const canReadGeneralLedger = (u: Actor, councilId: number): boolean => canViewExecutiveDashboard(u, councilId);

/**
 * Posting to the general ledger, transferring between its accounts and uploading bank statements (Sprint 5Z-8 quick
 * actions), mirroring assertMayPostGeneralLedger: the council's Financial Secretary and Treasurer, and any Super Admin.
 */
export const canPostGeneralLedger = (u: Actor, councilId: number): boolean => isSuperAdmin(u) || (isFinanceOfficer(u) && u.councilId === councilId);

/**
 * The Semiannual Trustee Audit Desk's checkmarks and signature (Sprint 6N), mirroring assertMayVerifyCouncilAudit: an
 * Active Trustee of the council (Trustee 1, 2 or 3) or any Super Admin. Every reader of the books sees the desk.
 */
export const canVerifyCouncilAudit = (u: Actor, councilId: number): boolean =>
  isSuperAdmin(u) || (u.councilId === councilId && (u.roles ?? []).some((r) => (TRUSTEE_ROLE_NAMES as readonly string[]).includes(r)));

/** Reading the annual budget, mirroring assertMayViewBudgetForecast (Sprint 5Y-3): every member of the council, any Super Admin. */
export const canViewBudgetForecast = (u: Actor, councilId: number): boolean => isSuperAdmin(u) || u.councilId === councilId;

/** The roster's "Designated Budget Director" control: the member's council Admins and any Super Admin (members.update). */
export const canDesignateBudgetDirector = (u: Actor, member: Pick<Member, 'CouncilID'>): boolean => canAdministerCouncil(u, member.CouncilID);

/**
 * Sections shown in the portal's navigation. The ledger is open to everyone because event owners use it, and the
 * meeting center because a meeting's owner may be any member (it is read-only for everyone else without rights).
 * Sprint 6A: `flags` are the council's feature flags (features.ts); a module switched off is left out for every role.
 * Sprint 6Z-Dual-Gate-Model: `tenant` is the council's tenant type (tenant.ts); a white-label tenant loses the fraternal
 * areas for every role.
 */
export function portalAreas(u: Actor, flags: FeatureFlags = ALL_FEATURES_ON, tenant: TenantType = DEFAULT_TENANT_TYPE): PortalArea[] {
  // Admins and Super Admins volunteer too, so the member hub leads everyone's navigation, then the shared views.
  const areas: PortalArea[] = ['member-actions', 'calendar', 'gallery'];
  if (canMaintainLookups(u)) areas.push('lookups');
  if (canMaintainCouncils(u)) areas.push('councils');
  if (canOpenFeatureFlagsControlCenter(u)) areas.push('feature-flags');
  if (canOpenCouncilLookups(u)) areas.push('council-lookups');
  if (canAppointOfficers(u)) areas.push('elections/appointments');
  if (isAdmin(u)) areas.push('parishes', 'members', 'activities');
  if (canPlanEvents(u)) areas.push('events');
  areas.push('meetings');
  // Sprint 5Z-6: the Cadence Engine belongs to the agenda-template keepers - Admins, the Grand Knight, Super Admins.
  if (isAdmin(u) || isGrandKnight(u)) areas.push('meetings/cadence');
  // Sprint 5Z-10: the Live Meeting Console is the chair's desk - the council's Admins and officers (canRunLiveAssembly).
  if (isAdmin(u) || u.isOfficer) areas.push('meetings/live');
  // Every member may put a brother Knight up for office (the drivers check they are Active).
  areas.push('elections');
  if (isAdmin(u) || isFinanceOfficer(u)) areas.push('donations');
  // Every member files their own expense reports; the council's leadership reviews and returns them; the Financial
  // Secretary issues the written order and the Grand Knight counter-signs (Sprint 5Z-4; Admins read both desks); only
  // its finance officers (or a Super Admin) pay them.
  // Every member may carry an organization's grant request to the council as its Knight Shepherd from Propose Charity
  // Grant (Sprint 5Z-2; the separate intake sheet folded into it in Sprint 5Z-Member-Charity, so there is no other entry path).
  areas.push('ledger', 'expenses', 'charities/propose');
  if (isAdmin(u) || isFinanceOfficer(u)) areas.push('expenses/queue');
  if (isAdmin(u) || isFinancialSecretary(u)) areas.push('expenses/audit');
  if (isAdmin(u) || isGrandKnight(u)) areas.push('expenses/authorize');
  // Sprint 6Q: the Treasurer codes each ordered sheet to a budget line and a ledger account before the Grand Knight signs.
  if (isAdmin(u) || isTreasurer(u)) areas.push('finance/treasurer-desk');
  if (isSuperAdmin(u) || isFinanceOfficer(u)) areas.push('expenses/disbursements', 'charities/queue');
  if (canVetCharitableRequests(u, u.councilId)) areas.push('charities/vetting');
  if (canBrowseLessonsRegistry(u)) areas.push('lessons-registry');
  if (canManageCharityRegistry(u)) areas.push('charities/registry');
  // Sprint 5Z-2.5: every officer of the council reads the executive summaries, as on the Pooled Vetting Desk.
  if (isAdmin(u) || canViewExecutiveDashboard(u, u.councilId)) areas.push('dashboard');
  // Sprint 5Z-8: the general ledger screens have the dashboard's audience (canReadGeneralLedger); posting is gated inside.
  if (isAdmin(u) || canReadGeneralLedger(u, u.councilId)) areas.push('finance/dashboard', 'finance/ledger', 'finance/balance-sheet', 'finance/audit');
  if (isAdmin(u) || isFinanceOfficer(u)) areas.push('supreme-sync');
  // Every member may read the council's annual budget (Sprint 5Y-3 transparency); canManageBudgetForecast decides editing.
  areas.push('financials/budget');
  // Sprint 5Z-10.8: every member builds their own private distribution lists from the header's Messaging menu; council-wide
  // lists stay with Admins (canPublishDistributionList).
  areas.push('messages', 'distribution-lists', 'profile');
  // Sprint 6Z: the Online Help Center is the Answers pillar's sidebar link, open to every signed-in member; so is the
  // Interactive Help Desk (Sprint 6A, Phase 4) that searches the member user guide's task workflows.
  areas.push('help', 'answers/help');
  // Sprint 6Z: every member reads the council bylaws (canEditBylaws decides editing), the SOP center and the council
  // artifacts board; the growth and hours charts have the executive dashboard's audience. Sprint 6L Extension: the
  // Constitutional Advisor and the Credentials Vault are officer tools (canOpenOfficerTools), never on a member's sidebar.
  areas.push('governance/bylaws', 'answers/sop', 'resources/bulletins');
  if (canOpenConstitutionalAdvisor(u)) areas.push('governance/advisor');
  if (canOpenCredentialsVault(u)) areas.push('credentials-vault');
  if (isAdmin(u) || canViewExecutiveDashboard(u, u.councilId)) areas.push('performance/charts');
  // Sprint 6K: every member reads the council's Team Legacy history and records oral history; the annals' keepers are
  // decided inside (assertMayKeepCouncilAnnals).
  areas.push('history');
  // Sprint 6L Extension 3: every member opens the web Faith Center - the feast day, the daily verse and the Council Prayer
  // Intentions List. A Knights of Columbus extension, so a white-label tenant loses it (FRATERNAL_AREAS).
  areas.push('faith-center');
  if (canOpenMarketingFactory(u)) areas.push('resources/marketing');
  // Sprint 7A Extension: the Shared Member Center - collective, non-financial council figures and the member's own impact
  // card - is every member's. The executive dashboard and the finance screens stay with their own audiences above.
  areas.push('member-center');
  return withTenantGate(withFeatureFlags(areas, flags), tenant);
}

/**
 * A sidebar link: a portal area, except the profile, which the header's member menu opens, and the Communications Hub and
 * the distribution lists, which the header's Messaging menu opens (Sprint 5X; the menu since Sprint 5Z-10.8). The help
 * center is the Answers pillar's link (Sprint 6Z) as well as the header's Help shortcut (Sprint 5W).
 */
export type PortalNavItem = Exclude<PortalArea, 'profile' | 'messages' | 'distribution-lists'>;

export interface PortalNavGroup {
  id: 'governance' | 'faith' | 'finances' | 'performance' | 'resources' | 'answers' | 'setup';
  label: string;
  items: PortalNavItem[];
}

/**
 * The seven sidebar pillars, every link in display order (Sprint 6Z replaced the Sprint 5Z-10 accordion directories).
 * Every pillar is always open. Each PortalArea but 'profile', 'messages' and 'distribution-lists' appears exactly once.
 */
export const PORTAL_NAV_GROUPS: readonly PortalNavGroup[] = [
  { id: 'governance', label: 'Governance', items: ['meetings/live', 'meetings/cadence', 'meetings', 'elections', 'elections/appointments', 'governance/bylaws', 'governance/advisor'] },
  { id: 'faith', label: 'Faith In Action', items: ['activities', 'member-actions', 'events', 'calendar', 'faith-center'] },
  {
    id: 'finances',
    label: 'Finances',
    items: [
      'finance/ledger',
      'finance/balance-sheet',
      'finance/dashboard',
      'finance/audit',
      'finance/treasurer-desk',
      'expenses',
      'expenses/queue',
      'expenses/disbursements',
      'expenses/audit',
      'expenses/authorize',
      'charities/vetting',
      'charities/propose',
      'charities/queue',
      'donations',
      'financials/budget',
    ],
  },
  { id: 'performance', label: 'Performance', items: ['member-center', 'dashboard', 'performance/charts', 'history', 'ledger', 'lessons-registry'] },
  { id: 'resources', label: 'Resources', items: ['gallery', 'resources/bulletins', 'resources/marketing'] },
  { id: 'answers', label: 'Answers', items: ['help', 'answers/help', 'answers/sop'] },
  {
    id: 'setup',
    label: 'Setup',
    items: ['councils', 'feature-flags', 'members', 'supreme-sync', 'council-lookups', 'credentials-vault', 'charities/registry', 'lookups', 'parishes'],
  },
];

/**
 * One sidebar entry: a link the viewer may open. Since the Sprint 6G Extension no entry is drawn locked: the sign-off
 * and meeting desks that Sprint 5Z-10 listed for every member with a lock badge now show, like every other link, only
 * to those who may open them.
 */
export interface PortalNavEntry {
  item: PortalNavItem;
}

export interface PortalSidebarGroup extends Omit<PortalNavGroup, 'items'> {
  entries: PortalNavEntry[];
}

/**
 * The sidebar for `u` as the portal draws it: only the links portalAreas allows (which already leaves out modules the
 * council's feature flags switch off, Sprint 6A, and fraternal areas of a white-label tenant). A link the viewer may
 * not open is removed, never shown locked or greyed out (Sprint 6G Extension). A pillar with no entries is dropped.
 */
export function portalSidebar(u: Actor, flags: FeatureFlags = ALL_FEATURES_ON, tenant: TenantType = DEFAULT_TENANT_TYPE): PortalSidebarGroup[] {
  const allowed = new Set<string>(portalAreas(u, flags, tenant));
  return PORTAL_NAV_GROUPS.map(({ items, ...g }) => ({
    ...g,
    entries: items.filter((item) => allowed.has(item)).map((item) => ({ item })),
  })).filter((g) => g.entries.length > 0);
}

/** The sidebar for `u`: each group holding only the links portalAreas allows; empty groups are dropped. */
export function portalNavGroups(u: Actor, flags: FeatureFlags = ALL_FEATURES_ON, tenant: TenantType = DEFAULT_TENANT_TYPE): PortalNavGroup[] {
  const allowed = new Set<string>(portalAreas(u, flags, tenant));
  return PORTAL_NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((item) => allowed.has(item)) })).filter((g) => g.items.length > 0);
}
