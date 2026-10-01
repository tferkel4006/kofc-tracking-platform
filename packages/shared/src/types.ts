// =========================================================================
// KNIGHTS OF COLUMBUS SHARED TYPESCRIPT TYPES
// Maps 1:1 to master schema.sql fields for dual Expo / Next.js usage
// =========================================================================

// 1. LOOKUP ENTITIES
export interface Credentials {
  id: number;
  Username: string;
  Password?: string; // Optional on the client side for security transfers
}

export interface MemberStatus {
  id: number;
  Status: 'Active' | 'Inactive' | 'Former' | 'Deceased';
}

export interface Degree {
  id: number;
  Degree: 'First' | 'Second' | 'Third' | 'Fourth';
}

export interface MemberType {
  id: number;
  Type: 'Super Admin' | 'Admin' | 'Member';
}

export interface Role {
  id: number;
  Role: string; // e.g., 'Grand Knight', 'Warden'
  Officer: 1 | 0; // Maps perfectly to the SQL BIT data type
}

export interface NoShowReason {
  id: number;
  NoShowReasonCode: 'A' | 'B' | 'C' | 'D' | 'E';
  NoShowReasonDescription: string;
}

export interface Category {
  id: number;
  Category: string;
  CategoryDescription: string;
}

export interface LessonsLearnedCategory {
  id: number;
  LessonsLearnedCategory: 'Planning' | 'Budgeting' | 'Scheduling' | 'Marketing' | 'Execution';
}


// 2. TENANT ORGANIZATIONAL STRUCTURE
export interface Council {
  id: number;
  CouncilNumber: number;
  CouncilName: string;
  State: string;
  Phone?: string;
  Email?: string;
}

export interface AffiliatedCouncils {
  PrimaryCouncilID: number;
  AffiliatedCouncilID: number;
}

export interface Parish {
  id: number;
  Name: string;
  StreetAddress1: string;
  StreetAddress2?: string;
  City: string;
  State: string;
  Phone?: string;
  CouncilID: number;
}

export interface Pastor {
  id: number;
  FirstName: string;
  LastName: string;
  Phone?: string;
  Email?: string;
  ParishID: number;
}


// 3. CORE MEMBER SYSTEM
export interface Member {
  id: number;
  CouncilID: number;
  MemberNumber: number;
  MemberFirstName: string;
  MemberLastName: string;
  Phone: string;
  StreetAddress1: string;
  StreetAddress2?: string;
  City: string;
  State: string;
  ZipCode: string;
  Email: string;
  DateOfBirth: string; // Transmitted as an ISO Date String (YYYY-MM-DD)
  StatusID: number;
  DegreeID: number;
  MemberTypeID: number;
  CredentialID: number;
  WorkingStatusID?: number | null; // Phase 2: null until the member sets it
  ProfilePhotoURL?: string | null; // Sprint 5S: avatar path (VARCHAR(2000)); a blob or file:// path until there is a file store
  Biography?: string | null; // Sprint 5S: short personal fraternal biography (TEXT, capped at MEMBER_BIOGRAPHY_MAX_LENGTH)
  /** BIT (Sprint 5Y-3): an Admin delegated the council's budget preparation to this member. Default 0. */
  IsBudgetDirector?: number;
}

export interface MemberRoles {
  id: number;
  RoleID: number;
  MemberID: number;
}


// 4. LOGISTICS & TRANSACTIONS (EVENTS / SHIFTS)
export interface Event {
  id: number;
  EventName: string;
  EventDescription: string;
  OwnerID: number;
  StartDate: string; 
  EndDate: string;   
  Location: string;
  CategoryID: number;
  Budget?: number;
  Spend?: number;
  "FundsRaised-Cash"?: number;       // Added to match database columns
  "FundsRaised-Electronic"?: number; // Added to match database columns
  Highlights?: string;
  PlannedNumberAttendees?: number;
  ActualNumberAttendees?: number;
  /** Comma-separated local photo reference paths (VARCHAR(2000)); written only by events.uploadPhotos. */
  PhotoGalleryURL?: string | null;
  /** BIT: the event recurs every fraternal year, so budget.prePopulateNextYear forecasts it (Sprint 5Y). Default 0. */
  IsAnnual?: number;
  /** BIT (Sprint 5Y-5): the event spans more than one day. Default 0. */
  IsMultiDay?: number;
  /** The council mission area (CouncilMissionArea, Sprint 5Z-1) the event is filed under; null while unfiled. */
  MissionAreaID?: number | null;
  /**
   * VARCHAR(50) (Sprint 5Z-7): whether the phone's high-speed intake screens are open for the event; see
   * EVENT_INTAKE_SESSION_STATUSES. Default 'Inactive'.
   */
  IntakeSessionStatus?: EventIntakeSessionStatus;
}

/** Event.IntakeSessionStatus values (Sprint 5Z-7). */
export type EventIntakeSessionStatus = 'Inactive' | 'Active';


export interface EventCouncils {
  id: number;
  EventID: number;
  CouncilID: number;
}

export interface Shift {
  id: number;
  ShiftName: string;
  ShiftDescription: string;
  ShiftDate: string; // YYYY-MM-DD
  StartTime: string; // HH:MM:SS
  EndTime: string;   // HH:MM:SS
  EventID: number;
  MinNumberVolunteers: number;
  NumberVolunteersSignedUp: number;
}

export interface EventSignup {
  id: number;
  ShiftID: number;
  MemberID: number;
  NoShow: 1 | 0; // SQL BIT flag
  NoShowReasonID?: number | null; // Nullable if NoShow is 0
  SignupNotes?: string;
}

export interface EventTime {
  id: number;
  ShiftID: number;
  MemberID: number;
  Hours: number; // Decimal constraints map to JS number
  ShiftNotes?: string;
}

export interface LessonsLearned {
  id: number;
  EventID: number;
  LeassonsLearnedCategoryID: number;
  LessonsLearnedDescription: string;
}


// 5. INDEPENDENT COUNCIL ACTIVITIES
export interface Activities {
  id: number;
  ActivityName: string;
  ActivityDescription: string;
  CategoryID: number;
  CouncilID: number;
}

export interface ActivityTime {
  id: number;
  MemberID: number;
  ActivityID: number;
  ActivityDate: string; // YYYY-MM-DD
  Hours: number;        // Restricted on the client frontend to 15-minute intervals (e.g. 1.25, 1.5, 1.75)
  ActivityNotes?: string;
}


// 6. ASYNCHRONOUS CHAT INTERFACES
export interface DistributionLists {
  id: number;
  ListName?: string;
  CouncilID?: number;
  CreatedBy?: number;
  CreatedAt?: string;
}

export interface DistributionListMembers {
  ListID: number;
  MemberID: number;
}

export interface ChatThread {
  id: number;
  CouncilID?: number;
  IsGroupChat: 1 | 0;
  CreatedAt?: string;
}

export interface Message {
  id: number;
  ThreadID?: number;
  SenderID?: number;
  ParentMessageID?: number | null; // Points to another Message ID if it's a nested reply thread
  MessageText?: string;
  IsDraft: 1 | 0;
  CreatedAt?: string;
}

export interface MessageAttachment {
  id: number;
  MessageID: number;
  Filename: string;
  FileType: string; // e.g. 'application/pdf', 'image/png', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  StorageURL: string;
  UploadedAt?: string;
}

export interface ReadReceipt {
  id: number;
  MessageID?: number;
  MemberID?: number;
  ReadAt?: string | null; // null represents message being marked as "Unread"
  IsFlagged: 1 | 0; // Flags for late administrative follow-up tracking
}

export interface MeetingType {
  id: number;
  Type: 'Monthly' | 'Officer' | 'Community';
  Description?: string;
}

export interface Meeting {
  id: number;
  CouncilID: number;
  "Meeting Name": string;
  "Meeting Description"?: string;
  Date: string;      // YYYY-MM-DD
  "Time Start": string; // HH:MM:SS
  "Time End": string;   // HH:MM:SS
  Location: string;
  Agenda?: string;     // NOT NULL in Schema.sql: drivers store '' when there is none
  MinutesURL?: string; // Links directly to cloud PDF assets; '' until minutes are uploaded (NOT NULL in Schema.sql)
  MeetingType: number;
  /** Shared Google Drive links (VARCHAR(2000)); written only by meetings.linkGoogleDrive. */
  GoogleDriveMinutesURL?: string | null;
  GoogleDriveFlyerURL?: string | null;
  /** The member who runs the meeting (Sprint 5Q); null when none is designated. Manages it alongside Admins. */
  OwnerID?: number | null;
  /** BIT (Sprint 5Y-5): the meeting spans more than one day. Default 0. */
  IsMultiDay?: number;
  /** The council's own meeting type (CouncilMeetingType, Sprint 5Y-5); null while unfiled. */
  MeetingTypeID?: number | null;
  /** DATE (Sprint 5Y-6): the last day of a multi-day meeting (IsMultiDay = 1); null for a one-day meeting. */
  EndDate?: string | null;
  /** The council mission area (CouncilMissionArea, Sprint 5Z-1) the meeting is filed under; null while unfiled. */
  MissionAreaID?: number | null;
  /**
   * DATE (Sprint 5Z-6): the day the meeting's invitations reach members' own feeds (drip release); null when released
   * at once. populateAnnualCadence sets it CADENCE_INVITE_LEAD_DAYS before Date.
   */
  InviteReleaseDate?: string | null;
}

/** An invitee's RSVP (Sprint 5Y-5); see MEETING_RESPONSE_STATUSES. */
export type MeetingResponseStatus = 'NoResponse' | 'Accepted' | 'Declined';

export interface MeetingInvites {
  id: number;
  MeetingID: number;
  MemberID: number;
  Attended: 1 | 0; // SQL BIT flag tracker
  /** Default 'NoResponse'; written by meetings.rsvpToInvite. */
  ResponseStatus: MeetingResponseStatus;
}

/** A meeting type a council defines for itself (Sprint 5Y-5); TypeName is unique within the council. */
export interface CouncilMeetingType {
  id: number;
  CouncilID: number;
  TypeName: string;
}

/** A council's agenda outline for one of its meeting types (Sprint 5Y-5); one per council and type. */
export interface CouncilAgendaTemplate {
  id: number;
  CouncilID: number;
  MeetingTypeID: number;
  TemplateText: string;
}

/**
 * A council's standing recurrence rule for one of its meeting types (Sprint 5Z-5); one per council and type.
 * meetings.populateAnnualCadence expands it into a fraternal year's twelve meetings.
 */
export interface CouncilCadenceConfig {
  id: number;
  CouncilID: number;
  MeetingTypeID: number; // CouncilMeetingType of the same council
  CadencePattern: string; // VARCHAR(100): 'First Tuesday' ... 'Fourth Saturday', or 'Last Thursday'
  DefaultStartTime: string; // VARCHAR(50): 24-hour 'HH:MM' or 'HH:MM:SS'
  DefaultLocation: string; // TEXT
  DefaultRecipientGroup: CadenceRecipientGroup; // Sprint 5Z-6: who the cadence meetings invite; default 'all_members'
}

/** Who a cadence's meetings invite (Sprint 5Z-6): a built-in distribution group, or nobody; see CADENCE_RECIPIENT_GROUPS. */
export type CadenceRecipientGroup = 'all_members' | 'active_officers' | 'none';

/** Where a proposed motion came from; see PROPOSED_MOTION_SOURCE_TYPES. */
export type ProposedMotionSourceType = 'CharitableRequest' | 'GeneralMember';

/** The council's vote on a proposed motion; 'Pending' until the vote is recorded. */
export type ProposedMotionVoteResult = 'Pending' | 'Passed' | 'Failed' | 'Tabled';

/** A motion queued for a meeting's floor (Sprint 5Z-5). */
export interface ProposedMotion {
  id: number;
  CouncilID: number;
  TargetMeetingID: number; // a Meeting of the same council
  SourceType: ProposedMotionSourceType;
  SourceRecordID?: number | null; // the CharitableRequest id for 'CharitableRequest'; null for a member's own motion
  MotionText: string;
  PresenterMemberID: number;
  AllocatedMinutes: number; // default 5
  VoteResult: ProposedMotionVoteResult; // default 'Pending'
}



// 7. PHASE 2 EXTENSIONS: DONATIONS, SKILLS, TRAINING, WORKING STATUS
export interface WorkingStatus {
  id: number;
  WorkingStatus: string; // e.g. 'Student', 'Full Time', 'Retired'
}

export interface DonationMethod {
  id: number;
  DonationMethod: string; // e.g. 'Cash', 'Venmo', 'Physical Items'
}

/** Council-specific donation categories (maintained by council admins). */
export interface DonationType {
  id: number;
  CouncilID: number;
  DonationType: string;
}

/** A donation method a council has enabled, with the QR image that routes digital payments to its account. */
export interface CouncilDonationMethod {
  id: number;
  CouncilID: number;
  DonationMethodID: number;
  DonationMethodURL?: string | null;
}

export interface Donation {
  id: number;
  CouncilID: number;
  DonationDate: string; // YYYY-MM-DD
  DonationMethodID: number;
  DonationTypeID: number;
  Donor?: string | null;
  DonationDesciption?: string | null; // sic: the schema's spelling
  EventID?: number | null;            // null for a standalone donation
  DonationAmount: number;             // for physical items, the estimated value
  DonationPhotoURL?: string | null;
  RecordedBy?: number | null;         // the member who recorded it; stamped by donations.record, never changed
}

export interface Skill {
  id: number;
  SkillName: string;
}

export interface SkillLevel {
  id: number;
  SkillLevel: string; // e.g. 'Novice' ... 'Expert'
}

export interface MemberSkill {
  id: number;
  SkillID: number;
  SkillLevelID: number;
  MemberID: number;
}

export interface KOCTrainingClasses {
  id: number;
  ClassName: string;
}

export interface MemberTraining {
  id: number;
  MemberID: number;
  TrainingClassID: number;
  YearTaken: string; // DATE column; the year is what matters, stored as YYYY-01-01
}

export interface SystemFeedback {
  id: number;
  MemberID: number;
  SubmittedAt: string; // DATETIME, 'YYYY-MM-DD HH:MM:SS' UTC
  FeedbackText: string;
}

// 8. EXPENSE REPORTING (Sprint 5R)
/** An expense sheet's life cycle: the member drafts and submits it, leadership approves it, then pays it by check. */
export type ExpenseReportStatus = 'Draft' | 'Submitted' | 'Approved' | 'Reimbursed';

/** One check that pays one or more approved expense sheets of a council. */
export interface ExpenseDisbursement {
  id: number;
  CouncilID: number;
  CheckNumber: string;
  PayoutDate: string; // YYYY-MM-DD
  TotalAmount: number; // DECIMAL(18,2): the paid sheets' line items in total
  Notes?: string | null;
}

/** A member's expense sheet. CouncilID is always the submitter's own council. */
export interface ExpenseReport {
  id: number;
  CouncilID: number;
  SubmitterMemberID: number;
  Status: ExpenseReportStatus;
  LinkedEventID?: number | null;
  LinkedMeetingID?: number | null;
  DisbursementID?: number | null; // set once the sheet is paid (Status 'Reimbursed')
  RejectionReason?: string | null; // why leadership returned it to 'Draft' (expenses.rejectReport); cleared on resubmission
  // Sprint 5Z-3 dual approval: the Financial Secretary's written order, then the Grand Knight's counter-signature
  // (which moves Status to 'Approved'). All four are cleared when leadership returns the sheet to 'Draft'.
  FinancialSecretaryMemberID?: number | null;
  FinancialSecretaryApprovedAt?: string | null;
  GrandKnightMemberID?: number | null;
  GrandKnightApprovedAt?: string | null;
}

/** One receipt on an expense sheet. */
export interface ExpenseLineItem {
  id: number;
  ExpenseReportID: number;
  DateOfExpense: string; // YYYY-MM-DD
  Amount: number; // DECIMAL(18,2), more than 0
  VendorName: string;
  ReceiptPhotoURL?: string | null;
  ExpenseDescription: string;
}

// 9. PUSH NOTIFICATIONS AND SUPREME COUNCIL REPORTING (Sprint 5T)
/** How urgent an alert is; drives the Expo push priority (High -> 'high', Medium -> 'default', Low -> 'normal'). */
export type NotificationPriority = 'Low' | 'Medium' | 'High';

/** One alert as sent to one member. Member.ExpoPushToken is deliberately not on Member: it is a device credential. */
export interface NotificationLog {
  id: number;
  CouncilID: number;
  TargetMemberID: number;
  Title: string;
  MessageBody: string;
  Priority: NotificationPriority;
  SentAt: string; // DATETIME, 'YYYY-MM-DD HH:MM:SS' UTC
  IsRead: number; // BIT
}

/** The Supreme Council forms synced to Alchemer: Form 1728 (AnnualSurvey) and Form 1295 (CouncilAudit). */
export type SupremeFormType = 'AnnualSurvey' | 'CouncilAudit';
export type SupremeSyncStatus = 'Success' | 'Failed';

/** One push of a council's compliance answers to an Alchemer survey. */
export interface SupremeReportingSync {
  id: number;
  CouncilID: number;
  FormType: SupremeFormType;
  SyncDate: string; // DATETIME, 'YYYY-MM-DD HH:MM:SS' UTC
  SyncedByID: number;
  AlchemerSurveyID: string;
  Status: SupremeSyncStatus;
}

// 10. OFFICER ELECTIONS AND LEADERSHIP HISTORY (Sprint 5U)
/** Why a member left a seat: the fraternal year ended, or they stepped down mid-term. */
export type LeadershipExitReason = 'TermConcluded' | 'Abdicated';

/** Whether one of a council's elected seats is open for nomination; one row per council and role. */
export interface CouncilElectionBallot {
  CouncilID: number;
  RoleID: number;
  IsUpForElection: number; // BIT
  IsMidYearElection: number; // BIT: opened by an abdication, nominations run until NominationsCloseAt
  NominationsCloseAt?: string | null; // DATETIME, 'YYYY-MM-DD HH:MM:SS' UTC; mid-year elections only
}

/** One member put up for one seat in one term. */
export interface OfficerNominations {
  id: number;
  CouncilID: number;
  OfficeRoleID: number;
  NomineeMemberID: number;
  NominatedByMemberID: number;
  NominatedAt: string; // DATETIME, 'YYYY-MM-DD HH:MM:SS' UTC
  FraternalYear: string; // the term the election fills, e.g. '2027-2028'
  IsEligible: number; // BIT: 0 for a Grand Knight nominee who has never served as Deputy Grand Knight or Grand Knight
}

/** One member's time in one seat; EndDate NULL means they hold it now. */
export interface CouncilLeadershipHistory {
  id: number;
  CouncilID: number;
  MemberID: number;
  RoleID: number;
  FraternalYear: string; // e.g. '2026-2027' (July 1 - June 30)
  StartDate: string; // YYYY-MM-DD
  EndDate?: string | null; // YYYY-MM-DD
  ExitReason?: LeadershipExitReason | null;
  AppointedByID?: number | null; // the Grand Knight or Super Admin who appointed them
}

// 11. CHARITABLE GIVING AND DISBURSEMENTS (Sprint 5V)
/** One charity in the registry every council shares. */
export interface GlobalCharityRegistry {
  id: number;
  Name: string;
  Description: string;
  EIN?: string | null; // 'NN-NNNNNNN'; unique when present
  State: string; // two-letter postal code, upper case
  Phone?: string | null;
  ContactName?: string | null;
  ContactEmail?: string | null;
  Address?: string | null;
  ZipCode?: string | null;
  IsCatholic: number; // BIT
  CharityType: string;
  IsAnnual: number; // BIT (Sprint 5Y): councils give every fraternal year, so budget.prePopulateNextYear forecasts it
}

/** A council's connection to a registry charity; one row per council and charity. */
export interface CouncilCharityLink {
  CouncilID: number;
  CharityID: number;
  ConnectedAt: string; // DATETIME, 'YYYY-MM-DD HH:MM:SS' UTC
}

/** Where a gift proposal stands: 'Approved' once a finance officer has paid it. */
export type CharityProposalStatus = 'Pending' | 'Approved' | 'Rejected';

/** A member's proposal that the council give to a charity. */
export interface CharityDonationProposal {
  id: number;
  CouncilID: number;
  SubmitterMemberID: number;
  ProposedCharityName: string;
  ProposedAmount: number; // DECIMAL(18,2), more than 0
  ExistingCharityID?: number | null; // the registry entry, once known
  Status: CharityProposalStatus;
  MeetingMinutesID?: number | null; // the council meeting whose minutes record the vote
  RejectionReason?: string | null; // why leadership rejected it (charities.rejectProposal)
}

/** One check a council paid to a charity. */
export interface CharitableDisbursementLedger {
  id: number;
  CouncilID: number;
  CharityID: number;
  Amount: number; // DECIMAL(18,2), more than 0
  CheckNumber: string;
  DisbursedByID: number;
  PayoutDate: string; // YYYY-MM-DD
  Notes?: string | null;
  ProposalID?: number | null; // the proposal the check paid
}

// 12. ANNUAL BUDGET FORECASTING (Sprint 5Y)
/** What a budget line forecasts: an annual event, gifts to an annual charity, or the council's running costs. */
export type BudgetCategoryType = 'Event' | 'Donation' | 'Operational';

/** One line of a council's budget for one fraternal year. */
export interface CouncilBudgetForecast {
  id: number;
  CouncilID: number;
  FraternalYear: string; // 'YYYY-YYYY', July 1 - June 30
  CategoryType: BudgetCategoryType;
  ReferenceSourceID?: number | null; // Event.id (Event), GlobalCharityRegistry.id (Donation); NULL for Operational
  LineItemName: string;
  PrePopulatedAmount: number; // DECIMAL(18,2): the previous fraternal year's actual spend
  ApprovedBudgetAmount: number; // DECIMAL(18,2): the voted figure; 0 until budget.approveAndFinalizeEntireBudget (Sprint 5Y-4)
  Notes?: string | null;
  BudgetCategoryID?: number | null; // Sprint 5Y-3: the council budget category it is filed under; NULL while uncategorized
  ProposedBudgetAmount: number; // DECIMAL(18,2) (Sprint 5Y-4): the figure leadership drafts May 1 - June 30
  BudgetStatus: BudgetLineStatus; // Sprint 5Y-4
}

/**
 * CouncilBudgetForecast.BudgetStatus (Sprint 5Y-4): 'Draft' when seeded with no figure proposed yet, 'Proposed' once
 * leadership or the Budget Director drafts a figure, 'Approved' once the council's vote finalizes the whole year.
 */
export type BudgetLineStatus = 'Draft' | 'Proposed' | 'Approved';

/** One of a council's own budget categories (funds), kept as a council lookup table (Sprint 5Y-3). */
export interface CouncilBudgetCategory {
  id: number;
  CouncilID: number;
  CategoryName: string;
}

// 13. NORMALIZED CHARITABLE INTAKE (Sprint 5Z-1)
/** How an organization asking for money is connected to the council; a council lookup, unique by name per council. */
export interface CouncilRelationshipType {
  id: number;
  CouncilID: number;
  RelationshipName: string;
}

/** One of a council's mission pillars (Faith, Family, Community, Life); events and meetings are filed under one. */
export interface CouncilMissionArea {
  id: number;
  CouncilID: number;
  MissionAreaName: string;
}

/** Where an intake request stands in the vetting pipeline; see CHARITABLE_REQUEST_STATUSES. */
export type CharitableRequestStatus = 'Submitted' | 'Claimed by Trustee' | 'Advanced' | 'Declined';

/** The council's vote on an advanced request; 'Pending' until the vote is recorded. */
export type CharitableRequestVoteStatus = 'Pending' | 'Approved' | 'Rejected';

/**
 * A Knight Shepherd's intake form for an outside organization asking the council for money (Sprint 5Z-1). The Shepherd
 * submits it into the council's shared vetting queue; an independent officer or Trustee claims it, vets it and
 * advances it to the council's vote.
 */
export interface CharitableRequest {
  id: number;
  CouncilID: number;
  OrganizationName: string;
  ContactName?: string | null;
  ContactPhone?: string | null;
  ContactEmail?: string | null;
  AmountRequested: number; // DECIMAL(18,2), more than 0
  RequestStatus: CharitableRequestStatus;
  SubmittedAt: string; // DATETIME, 'YYYY-MM-DD HH:MM:SS' UTC
  ShepherdMemberID: number; // the member who carries the request to the council
  MailingAddress?: string | null;
  RelationshipTypeID?: number | null; // CouncilRelationshipType of the same council
  Is501c3: number; // BIT
  EIN?: string | null; // 'NN-NNNNNNN' when given
  Website?: string | null;
  OrgMission?: string | null;
  IsRecurring: number; // BIT: the organization expects to ask every year
  FundsNeededBy?: string | null; // DATETIME, 'YYYY-MM-DD 00:00:00'
  SpecificUse?: string | null;
  TargetBeneficiary?: string | null;
  AccountabilityPlan?: string | null;
  RequestTier: number; // 1 to CHARITABLE_REQUEST_MAX_TIER; default 1
  VetterMemberID?: number | null; // the officer or Trustee who claimed the request
  VettingNotes?: string | null;
  VettedDate?: string | null; // DATETIME, set when the request is advanced
  MoverMemberID?: number | null; // who moved the gift at the council's vote
  SeconderMemberID?: number | null; // who seconded it
  VoteStatus: CharitableRequestVoteStatus;
  AmountApproved: number; // DECIMAL(18,2); 0.00 until the council votes
  PaymentOrderId?: number | null; // the CharitableDisbursementLedger check that paid it
  MissionAreaID?: number | null; // Sprint 5Z-2: CouncilMissionArea of the same council, chosen on the intake form
  TargetBudgetLineID?: number | null; // Sprint 5Z-2: the CouncilBudgetForecast line the vetter would pay it from
}

/** GLAccount.AccountType (Sprint 5Z-7); see GL_ACCOUNT_TYPES. */
export type GLAccountType = 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense';

/**
 * One account of a council's chart of accounts (Sprint 5Z-7). A virtual goal is an earmark inside its parent asset
 * account, saving toward TargetGoalAmount.
 */
export interface GLAccount {
  id: number;
  CouncilID: number;
  AccountName: string; // VARCHAR(100), unique per council
  AccountType: GLAccountType;
  ParentAccountID?: number | null; // another GLAccount of the same council
  IsVirtualGoal: number; // BIT, default 0
  TargetGoalAmount: number; // DECIMAL(18,2), default 0.00
}

/**
 * One line of a posted double-entry transaction (Sprint 5Z-7): exactly one of DebitAmount and CreditAmount is above
 * zero, and the lines posted together balance to the cent.
 */
export interface JournalEntry {
  id: number;
  CouncilID: number;
  GLAccountID: number;
  DateLogged: string; // DATETIME, 'YYYY-MM-DD HH:MM:SS'
  Description: string; // TEXT
  DebitAmount: number; // DECIMAL(18,2), default 0.00
  CreditAmount: number; // DECIMAL(18,2), default 0.00
  LinkedEventID?: number | null;
  LinkedMeetingID?: number | null;
  IsBankReconciled: number; // BIT, default 0; set by finance.uploadBankStatementReconciliation
  CheckNumber?: string | null; // VARCHAR(50)
}
