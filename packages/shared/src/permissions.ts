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
import { GRAND_KNIGHT_ROLE } from './elections';
import { FINANCE_LOOKUP_TABLES, FINANCIAL_SECRETARY_ROLE_NAME, holdsExecutiveRole, holdsFinanceRole } from './rules';
import type { BudgetLineStatus, Donation, Event, ExpenseReport, Meeting, Member, MemberType } from './types';

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
  | 'charities/intake'
  | 'charities/vetting'
  | 'lessons-registry'
  | 'donations'
  | 'dashboard'
  | 'finance/dashboard'
  | 'finance/ledger'
  | 'finance/balance-sheet'
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

/**
 * Running a meeting from the Live Meeting Console (Sprint 5Z-10), mirroring assertMayRunLiveAssembly: the meeting's owner,
 * the council's Admins and officers (the Grand Knight and Recorder among them), and any Super Admin.
 */
export const canRunLiveAssembly = (u: Actor, meeting: Pick<Meeting, 'CouncilID' | 'OwnerID'>): boolean =>
  meeting.OwnerID === u.memberId || canManageMeetings(u, meeting.CouncilID);

/** One existing meeting's attendance, minutes and details: its owner (OwnerID) and anyone who manages the council's meetings. */
export const canManageMeeting = (u: Actor, meeting: Pick<Meeting, 'CouncilID' | 'OwnerID'>): boolean =>
  meeting.OwnerID === u.memberId || canManageMeetings(u, meeting.CouncilID);

/**
 * Standard members' calendars show only what is still ahead (events.listCalendarRange `hideEnded`, Sprint 5X-Mobile);
 * Admins, Super Admins and officers keep past entries for their records.
 */
export const calendarHidesEnded = (u: Actor): boolean => !isAdmin(u) && !u.isOfficer;

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

/** Why the signed-in officer may not sign a line on a sheet (Sprint 5Z-4), or null when they may. */
export type ExpenseSignatureBlock = 'seat' | 'own-report' | 'collusion';

/**
 * The '📜 Issue Written Order' control on one sheet, mirroring assertMayIssueExpenseOrder then assertNotSelfApproval
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
 * The '✍️ Counter-Sign Voucher' control on one sheet, mirroring assertMayAuthorizeExpenseOrder, assertNotSelfApproval and
 * assertDistinctExpenseSigners: the council's Grand Knight or any Super Admin, never on their own sheet, and never by
 * the officer who issued its written order ('collusion', the Collusion Guard).
 */
export function expenseCounterSignBlock(
  u: Actor,
  report: Pick<ExpenseReport, 'CouncilID' | 'SubmitterMemberID' | 'FinancialSecretaryMemberID'>,
): ExpenseSignatureBlock | null {
  if (!(isSuperAdmin(u) || (isGrandKnight(u) && u.councilId === report.CouncilID))) return 'seat';
  if (report.SubmitterMemberID === u.memberId) return 'own-report';
  if (report.FinancialSecretaryMemberID === u.memberId) return 'collusion';
  return null;
}

export const canCounterSignExpenseOrder = (u: Actor, report: Pick<ExpenseReport, 'CouncilID' | 'SubmitterMemberID' | 'FinancialSecretaryMemberID'>): boolean =>
  expenseCounterSignBlock(u, report) === null;

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
  areas.push('meetings');
  // Sprint 5Z-6: the Cadence Engine belongs to the agenda-template keepers - Admins, the Grand Knight, Super Admins.
  if (isAdmin(u) || isGrandKnight(u)) areas.push('meetings/cadence');
  // Sprint 5Z-10: the Live Meeting Console is the chair's desk - the council's Admins and officers (canRunLiveAssembly).
  if (isAdmin(u) || u.isOfficer) areas.push('meetings/live');
  // Every member may put a brother Knight up for office (the drivers check they are Active).
  areas.push('elections');
  if (isAdmin(u)) areas.push('distribution-lists');
  if (isAdmin(u) || isFinanceOfficer(u)) areas.push('donations');
  // Every member files their own expense reports; the council's leadership reviews and returns them; the Financial
  // Secretary issues the written order and the Grand Knight counter-signs (Sprint 5Z-4; Admins read both desks); only
  // its finance officers (or a Super Admin) pay them.
  // Every member may propose a charity grant (Sprint 5V).
  // Every member may carry an outside organization's request to the council as its Knight Shepherd (Sprint 5Z-2).
  areas.push('ledger', 'expenses', 'charities/propose', 'charities/intake');
  if (isAdmin(u) || isFinanceOfficer(u)) areas.push('expenses/queue');
  if (isAdmin(u) || isFinancialSecretary(u)) areas.push('expenses/audit');
  if (isAdmin(u) || isGrandKnight(u)) areas.push('expenses/authorize');
  if (isSuperAdmin(u) || isFinanceOfficer(u)) areas.push('expenses/disbursements', 'charities/queue');
  if (canVetCharitableRequests(u, u.councilId)) areas.push('charities/vetting');
  if (canBrowseLessonsRegistry(u)) areas.push('lessons-registry');
  if (canManageCharityRegistry(u)) areas.push('charities/registry');
  // Sprint 5Z-2.5: every officer of the council reads the executive summaries, as on the Pooled Vetting Desk.
  if (isAdmin(u) || canViewExecutiveDashboard(u, u.councilId)) areas.push('dashboard');
  // Sprint 5Z-8: the general ledger screens have the dashboard's audience (canReadGeneralLedger); posting is gated inside.
  if (isAdmin(u) || canReadGeneralLedger(u, u.councilId)) areas.push('finance/dashboard', 'finance/ledger', 'finance/balance-sheet');
  if (isAdmin(u) || isFinanceOfficer(u)) areas.push('supreme-sync');
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
  id: 'self-service' | 'communications' | 'executive' | 'analytics' | 'scheduler' | 'finance' | 'admin';
  label: string;
  /** The Self-Service Hub is always open; the other groups fold. */
  collapsible: boolean;
  /**
   * Sprint 5Z-10: list every link of the group, the ones the viewer may not open shown with a lock badge, so members see
   * which desks exist and who holds them. Other groups list only what the viewer may open.
   */
  showLocked: boolean;
  items: PortalNavItem[];
}

/**
 * Every sidebar link in its group, in display order (Sprint 5S; regrouped into high-intent directories in Sprint 5Z-10).
 * Each PortalArea but 'profile' and 'messages' appears exactly once. Sprint 5Z-10.7: the Communications Hub group (under a
 * gold envelope) holds the Distribution List Builder; the messages themselves stay the header's Messaging shortcut.
 */
export const PORTAL_NAV_GROUPS: readonly PortalNavGroup[] = [
  { id: 'self-service', label: 'Self-Service Hub', collapsible: false, showLocked: false, items: ['member-actions', 'expenses', 'charities/propose', 'charities/intake'] },
  { id: 'communications', label: 'Communications Hub', collapsible: true, showLocked: false, items: ['distribution-lists'] },
  {
    id: 'executive',
    label: 'Executive Action Desks',
    collapsible: true,
    showLocked: true,
    items: ['expenses/audit', 'expenses/authorize', 'charities/vetting', 'meetings/cadence', 'meetings/live'],
  },
  {
    id: 'analytics',
    label: 'Fraternal Analytics Hub',
    collapsible: true,
    showLocked: false,
    items: ['dashboard', 'finance/dashboard', 'finance/ledger', 'finance/balance-sheet'],
  },
  {
    id: 'scheduler',
    label: 'Fraternal Scheduler',
    collapsible: true,
    showLocked: false,
    items: ['calendar', 'events', 'meetings', 'activities', 'ledger', 'elections', 'gallery', 'lessons-registry'],
  },
  {
    id: 'finance',
    label: 'Financial Ledgers',
    collapsible: true,
    showLocked: false,
    items: ['donations', 'expenses/queue', 'expenses/disbursements', 'charities/queue', 'financials/budget'],
  },
  {
    id: 'admin',
    label: 'Administrative Lookups',
    collapsible: true,
    showLocked: false,
    items: ['members', 'council-lookups', 'charities/registry', 'elections/appointments', 'supreme-sync', 'lookups', 'parishes', 'councils'],
  },
];

/** One sidebar entry (Sprint 5Z-10): the link, and whether the viewer may open it. */
export interface PortalNavEntry {
  item: PortalNavItem;
  locked: boolean;
}

export interface PortalSidebarGroup extends Omit<PortalNavGroup, 'items'> {
  entries: PortalNavEntry[];
}

/**
 * The sidebar for `u` as the portal draws it (Sprint 5Z-10): the links portalAreas allows, plus - in groups that show
 * locked links - every other link of the group with `locked` set. A group with no entries is dropped.
 */
export function portalSidebar(u: Actor): PortalSidebarGroup[] {
  const allowed = new Set<string>(portalAreas(u));
  return PORTAL_NAV_GROUPS.map(({ items, ...g }) => ({
    ...g,
    entries: items.filter((item) => g.showLocked || allowed.has(item)).map((item) => ({ item, locked: !allowed.has(item) })),
  })).filter((g) => g.entries.length > 0);
}

/** The sidebar for `u`: each group holding only the links portalAreas allows; empty groups are dropped. */
export function portalNavGroups(u: Actor): PortalNavGroup[] {
  const allowed = new Set<string>(portalAreas(u));
  return PORTAL_NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((item) => allowed.has(item)) })).filter((g) => g.items.length > 0);
}
