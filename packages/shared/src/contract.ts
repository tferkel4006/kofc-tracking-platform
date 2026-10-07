// =========================================================================
// KNIGHTS OF COLUMBUS DATA SERVICE CONTRACT
// The single interface every data driver implements:
//   - apps/mobile  -> SQLite driver (expo-sqlite)
//   - apps/web     -> in-memory mock driver
//   - production   -> a driver that talks to Azure SQL (usually through an API)
// UI code only ever imports `db` from its app's /services/db.ts and codes
// against this interface, so swapping drivers never touches a view.
//
// Type-only module: it has no runtime exports, so consumers must use
// `import type` and nothing here needs to be built or bundled.
// =========================================================================
import type {
  Activities,
  ActivityTime,
  Category,
  CharitableDisbursementLedger,
  CharitableRequest,
  ProposedMotion,
  BallotSelection,
  LiveAttendance,
  AgendaSectionKey,
  MotionHandTally,
  CharityDonationProposal,
  ChatThread,
  Council,
  CouncilBudgetCategory,
  BudgetLineStatus,
  CouncilBudgetForecast,
  CouncilCharityLink,
  CouncilDonationMethod,
  CouncilElectionBallot,
  CouncilLeadershipHistory,
  Degree,
  DistributionLists,
  Donation,
  DonationMethod,
  DonationType,
  Event,
  EventSignup,
  GlobalCharityRegistry,
  EventTime,
  GLAccount,
  GLAccountType,
  EventIntakeSessionStatus,
  JournalEntry,
  ExpenseDisbursement,
  ExpenseLineItem,
  ExpenseReport,
  LessonsLearned,
  LessonsLearnedCategory,
  Meeting,
  MeetingInvites,
  MeetingResponseStatus,
  CouncilMeetingType,
  CouncilAgendaTemplate,
  CouncilCadenceConfig,
  CouncilMissionArea,
  CouncilRelationshipType,
  KOCTrainingClasses,
  MeetingType,
  Member,
  MemberSkill,
  MemberStatus,
  MemberTraining,
  MemberType,
  Message,
  MessageAttachment,
  NoShowReason,
  NotificationLog,
  LeadershipExitReason,
  NotificationPriority,
  OfficerNominations,
  Parish,
  Pastor,
  ReadReceipt,
  Role,
  Shift,
  Skill,
  SkillLevel,
  SupremeFormType,
  SupremeReportingSync,
  SystemFeedback,
  WorkingStatus,
} from './types';
import type { BudgetAlert, BudgetWindowState } from './budget';
import type { CadenceConfigInput } from './meetings';
import type { DistributionGroup } from './messaging';
import type { FeatureFlagChanges, FeatureFlagName } from './features';
import type { EmailGatewayColumn, EmailGatewaySettings } from './email-gateway';

// 1. LOOKUPS
/** The global lookup tables a Super Admin maintains (Blueprint: "System Lookup Manager"). */
export type LookupTableName =
  | 'MemberStatus'
  | 'Degree'
  | 'MemberType'
  | 'Role'
  | 'NoShowReason'
  | 'Category'
  | 'LessonsLearnedCategory'
  | 'MeetingType';

export interface LookupRowMap {
  MemberStatus: MemberStatus;
  Degree: Degree;
  MemberType: MemberType;
  Role: Role;
  NoShowReason: NoShowReason;
  Category: Category;
  LessonsLearnedCategory: LessonsLearnedCategory;
  MeetingType: MeetingType;
}

/** Field values for a lookup row (everything except `id`). Validated per table by LOOKUP_META. */
export type LookupValues = Record<string, string | number>;

/**
 * Lookup tables each council keeps for itself (Sprint 5L); every row carries its CouncilID. Validated per
 * table by COUNCIL_LOOKUP_META.
 */
export type CouncilLookupTableName = 'Activities' | 'DonationType' | 'CouncilDonationMethod' | 'CouncilBudgetCategory';

export interface CouncilLookupRowMap {
  Activities: Activities;
  DonationType: DonationType;
  CouncilDonationMethod: CouncilDonationMethod;
  /** Sprint 5Y-3: the council's budget categories (funds). */
  CouncilBudgetCategory: CouncilBudgetCategory;
}

/**
 * One row for lookups.saveCouncilSpecific: with `id` it replaces that row's fields, without one it adds a row.
 * The council comes from the call; a record may repeat it as CouncilID but never name another council.
 */
export type CouncilLookupRecord<T extends CouncilLookupTableName> = Omit<CouncilLookupRowMap[T], 'id' | 'CouncilID'> & {
  id?: number | null;
  CouncilID?: number;
};

// 2. AUTH
/** What the UI is allowed to know about a signed-in member. Never includes the password. */
export interface SessionUser {
  credentialId: number;
  memberId: number;
  councilId: number;
  username: string;
  firstName: string;
  lastName: string;
  memberType: MemberType['Type'];
  /** Names of every Role the member holds, e.g. ['Grand Knight']. */
  roles: string[];
  /** True when any held Role is an officer role (officers may schedule meetings). */
  isOfficer: boolean;
  /** Member.IsBudgetDirector (Sprint 5Y-3): an Admin delegated the council's budget preparation to this member. */
  isBudgetDirector: boolean;
}

// 3. MEETINGS
/** A meeting row without its generated id or its Google Drive links (set later by meetings.linkGoogleDrive). */
export type NewMeeting = Omit<Meeting, 'id' | 'GoogleDriveMinutesURL' | 'GoogleDriveFlyerURL'>;

/**
 * Who gets an invitation when a meeting is created:
 *  - 'none'       nobody
 *  - 'allActive'  every Active member of the meeting's council
 *  - 'officers'   every Active member of the council holding an officer Role
 *  - { memberIds } exactly these members
 */
export type MeetingInviteMode = 'none' | 'allActive' | 'officers' | { memberIds: number[] };

export interface MessagePageOptions {
  /** Keyset cursor: only messages created strictly before this timestamp. */
  before?: string;
  /** Page size, default 20. */
  limit?: number;
}

// 4. EVENTS, SHIFTS AND THE POST-EVENT LEDGER
/** An event row without its generated id or its photo gallery (appended to by events.uploadPhotos). */
export type NewEvent = Omit<Event, 'id' | 'PhotoGalleryURL' | 'GoogleDriveFlyerFileID'>;
/** Fields to change on an event; `null` clears an optional field. Omitted fields are left alone. */
export type EventChanges = { [K in keyof NewEvent]?: NewEvent[K] | null };
/** A shift without its generated id; NumberVolunteersSignedUp always starts at 0. */
export type NewShift = Omit<Shift, 'id' | 'NumberVolunteersSignedUp'>;
export type ShiftChanges = Partial<Omit<NewShift, 'EventID'>>;

export interface CopyEventOptions {
  /** The copy's first day (YYYY-MM-DD); every shift moves by the same number of days. */
  startDate: string;
  /** Default: the original name. */
  eventName?: string;
  /** Default: the original owner. */
  ownerId?: number;
}

/** A shift the member signed up for, with its event and any hours already logged. */
export interface MemberShift {
  signup: EventSignup;
  shift: Shift;
  event: Event;
  /** Hours recorded in EventTime, or null when none are recorded yet. */
  hoursLogged: number | null;
}

/** One signup on an event's shifts, for the post-event volunteer turnout summary. */
export interface VolunteerTurnout {
  signup: EventSignup;
  shift: Shift;
  MemberFirstName: string;
  MemberLastName: string;
  /** Sprint 6B Patch: Member.DateJoinedCouncil, for the New Member badge on shift rosters. */
  DateJoinedCouncil: string | null;
  /** Hours recorded in EventTime, or null when none are recorded yet. */
  hoursLogged: number | null;
}

/** One row of the shift signup feed. */
export interface ShiftFeedItem {
  shift: Shift;
  event: Event;
  /** Every council the event is linked to. */
  councilIds: number[];
  /** True when the requesting member already holds a seat. */
  isSignedUp: boolean;
}

// 5. MESSAGING
export interface ThreadSummary {
  thread: ChatThread;
  /** Newest sent (non-draft) message, or null when the thread holds only drafts. */
  lastMessage: Message | null;
  lastSenderName: string | null;
  /** Messages addressed to the member that they have not read. */
  unreadCount: number;
  /** The member's own unsent drafts in this thread. */
  draftCount: number;
  participantIds: number[];
  participantNames: string[];
}

/** One message as a given member sees it. */
export interface ThreadMessage {
  message: Message;
  senderName: string;
  attachments: MessageAttachment[];
  /** The member's own receipt for this message, or null when they sent it. `ReadAt: null` means unread. */
  receipt: ReadReceipt | null;
}

export interface SendMessageInput {
  senderId: number;
  text: string;
  /** Reply inside an existing thread. Omit to start a new thread (then `councilId` and `recipientIds` are required). */
  threadId?: number;
  councilId?: number;
  recipientIds?: number[];
  /**
   * Built-in groups of `councilId` (its Active members only) sent to alongside `recipientIds` when starting a
   * new thread; ignored for a reply. Rejects NO_RECIPIENTS when groups were chosen but, with the people picked,
   * reach nobody other than the sender.
   */
  distributionGroups?: DistributionGroup[];
  /** Nests the message under another message of the same thread. */
  parentMessageId?: number | null;
  /** Send this saved draft instead of creating a new message. */
  draftId?: number;
}

export interface SaveDraftInput {
  senderId: number;
  threadId: number;
  text: string;
  parentMessageId?: number | null;
  /** Updates this draft in place instead of creating another. */
  draftId?: number;
}

// 6. MEMBERS, PROFILES AND SKILLS (Phase 2)
/**
 * A member row without its generated id or credentials: members.create provisions a placeholder
 * Credentials row the member claims through auth.signUp.
 */
export type NewMember = Omit<Member, 'id' | 'CredentialID'>;

export interface MemberSkillInput {
  skillId: number;
  skillLevelId: number;
}

export interface MemberTrainingInput {
  trainingClassId: number;
  /** Four-digit year the class was taken; stored in MemberTraining.YearTaken as YYYY-01-01. */
  year: number;
}

/** Choices for the profile screens' pickers. */
export interface ProfileOptions {
  /** Ordered by name. */
  skills: Skill[];
  /** Ordered by id, which runs from least to most proficient. */
  skillLevels: SkillLevel[];
  /** Ordered by name. */
  trainingClasses: KOCTrainingClasses[];
  /** Ordered by id. */
  workingStatuses: WorkingStatus[];
}

/** A member's self-maintained profile extensions, with lookup names resolved for display. */
export interface MemberExtensions {
  workingStatus: WorkingStatus | null;
  skills: { row: MemberSkill; skill: Skill; level: SkillLevel }[];
  training: { row: MemberTraining; trainingClass: KOCTrainingClasses; year: number }[];
}

/** One row of the council skill roster (view_CouncilSkills, plus ids for targeting). */
export interface CouncilSkillEntry {
  memberId: number;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  skill: Skill;
  level: SkillLevel;
}

export interface BulkSkillMessageResult {
  message: Message;
  /** Members the message went to (Active council members holding the skill, excluding the sender). */
  recipientIds: number[];
}

// 7. DONATIONS (Phase 2)
/**
 * Fields for a new donation. DonationDate defaults to today. EventID omitted or null records a
 * standalone donation. For 'Physical Items', DonationAmount is the estimated value. RecordedBy is not
 * supplied: donations.record stamps it with the recording member's id.
 */
export type NewDonation = Omit<Donation, 'id' | 'DonationDate' | 'RecordedBy'> & { DonationDate?: string };

/**
 * Fields to change on a donation; omitted fields keep their stored values and EventID null makes it
 * standalone. A donation keeps its council and its recorder for life.
 */
export type DonationChanges = Partial<Omit<NewDonation, 'CouncilID'>>;

/** Money totals of a set of donations, to the cent. Physical items count only toward `itemValue`. */
export interface DonationTotals {
  count: number;
  cash: number;
  /** Credit card, QR (Venmo, Zelle, Zeffy, Parishsoft) and any other non-cash method. */
  electronic: number;
  /** Estimated value of physical items; never part of the funds raised. */
  itemValue: number;
  /** cash + electronic. */
  raised: number;
}

/** One donation with its lookup names resolved, for the history log. */
export interface DonationHistoryEntry {
  donation: Donation;
  methodName: string;
  kind: DonationMethodKind;
  typeName: string;
  /** "First Last" of RecordedBy, or null for a row recorded before the column existed. */
  recordedByName: string | null;
}

/** An event's donations in total. Counts every council's donations, so it matches the event's synced funds columns. */
export interface EventDonationSummary {
  event: Event;
  totals: DonationTotals;
  /** True while cash or electronic donations exist, so FundsRaised-Cash/-Electronic are read-only rollups. */
  fundsManaged: boolean;
}

export interface DonationHistory {
  /** Without an event: the council's standalone donations. With one: the council's donations to that event. Newest first. */
  entries: DonationHistoryEntry[];
  /** Without an event: every council event that has donations. With one: just that event. Newest StartDate first. */
  events: EventDonationSummary[];
}

/** How the phone UI presents a method: a big button, a QR code to show the donor, or a camera for items. */
export type DonationMethodKind = 'cash' | 'card' | 'qr' | 'item' | 'other';

/** A method the council has enabled, ready for a one-tap picker. */
export interface CouncilDonationOption {
  method: DonationMethod;
  kind: DonationMethodKind;
  link: CouncilDonationMethod;
  /** QR image for Venmo/Zelle/Zeffy/Parishsoft that routes money to the council's account; null when none. */
  qrCodeUrl: string | null;
}

// 8. MEETING HOURS (Phase 2)
export interface MeetingHoursEntry {
  meetingId: number;
  meetingName: string;
  date: string;
  hours: number;
  /** Cumulative hours up to and including this meeting, oldest first. */
  runningTotal: number;
}

export interface MemberMeetingHours {
  memberId: number;
  totalHours: number;
  meetings: MeetingHoursEntry[];
}

/** The mobile Meetings tab (Sprint 5X-Mobile): upcoming council meetings split by the member's invitations. */
export interface MeetingSchedules {
  /** Meetings the member is on the MeetingInvites list for. */
  myInvites: Meeting[];
  /** Every meeting of the council, invited or not, so members can see what leadership has scheduled. */
  allSchedules: Meeting[];
  /** Sprint 5Y-6: the member's RSVP (MeetingInvites.ResponseStatus) to each meeting in myInvites, by meeting id. */
  myResponses: Record<number, MeetingResponseStatus>;
}

// 9. COUNCIL-LEVEL MAINTENANCE (Sprint 5G)
/** A council row without its generated id. */
/**
 * A council row without its generated id, its feature flags (councils.setFeatureFlags, Sprint 6A), its bylaws
 * (councils.setBylaws, Sprint 6Z) or its email gateway (councils.setEmailGateway, Sprint 6Z-Email-Proxy).
 */
export type NewCouncil = Omit<Council, 'id' | FeatureFlagName | 'BylawsMarkdown' | 'BylawsUpdatedAt' | EmailGatewayColumn>;
/** A parish row without its generated id. */
export type NewParish = Omit<Parish, 'id'>;
/** A pastor row without its generated id. */
export type NewPastor = Omit<Pastor, 'id'>;
/** An activity row without its generated id. */
export type NewActivity = Omit<Activities, 'id'>;

/**
 * Fields to change on a maintained row. Omitted fields keep their stored values; `null` or '' clears an
 * optional text field (e.g. Phone).
 */
export type RecordChanges<T> = { [K in keyof T]?: T[K] | null };

/** A new distribution list: its name, its council and the complete member list. */
export interface NewDistributionList {
  ListName: string;
  CouncilID: number;
  /** Members of the list's council; duplicates are ignored. */
  memberIds: number[];
  /** Sprint 5Z-10.8: true for a council-wide list (Admins only); omitted or false makes a private list. */
  IsCouncilWide?: boolean;
}

/** A list keeps its council for life; omit `memberIds` to keep the members, pass [] to clear them. */
export interface DistributionListChanges {
  ListName?: string;
  memberIds?: number[];
  /** Sprint 5Z-10.8: publish a private list (its creator, with Admin rights) or take a council-wide list private (its creator). */
  IsCouncilWide?: boolean;
}

/** One distribution list with its members' ids, ascending. */
export interface DistributionListSummary {
  list: DistributionLists;
  memberIds: number[];
}

// 10. ACTIVITY HISTORY AND MONTHLY REPORTS (Sprint 5K)
/** One ActivityTime row with the name of the member who logged it. */
export interface ActivityTimeEntry {
  row: ActivityTime;
  firstName: string;
  lastName: string;
}

/** Every entry logged against an activity, newest ActivityDate first, and their total. */
export interface ActivityTimeLog {
  activity: Activities;
  entries: ActivityTimeEntry[];
  totalHours: number;
}

/** An activity with its logged time in total. */
export interface ActivitySummary {
  activity: Activities;
  entryCount: number;
  totalHours: number;
  /** Latest ActivityDate logged, or null when nothing is logged. */
  lastLoggedOn: string | null;
  /** True once any time is logged: the activity moves from "Active Initiatives" to "Activity History". */
  archived: boolean;
}

/** A non-blank Highlights entry of an event in the month. */
export interface MonthlyHighlight {
  eventId: number;
  eventName: string;
  startDate: string;
  text: string;
}

/**
 * A council's month at a glance. Events count toward the month of their StartDate, event time toward the
 * month of its shift's ShiftDate, and activity time toward the month of its ActivityDate.
 */
export interface MonthlySummary {
  councilId: number;
  year: number;
  /** 1-12. */
  month: number;
  /** First and last day of the month, YYYY-MM-DD. */
  fromDate: string;
  toDate: string;
  /** EventTime on the council's events plus ActivityTime on the council's activities. */
  laborHours: { events: number; activities: number; total: number };
  /** Distinct MemberIDs across those EventTime and ActivityTime rows. */
  uniqueMembers: number;
  /**
   * The month's ledger. Cash and electronic read the month's events' FundsRaised columns, which are the synced
   * donation rollups wherever donations exist; blank columns count as 0. `eventSpend` sums those events' Spend;
   * `expenses` sums the line items dated in the month on the council's 'Approved' and 'Reimbursed' expense sheets
   * (Sprint 5R-1.5); `charitableGiving` sums the council's CharitableDisbursementLedger checks with a PayoutDate in the
   * month (Sprint 5V). spend = eventSpend + expenses + charitableGiving, and net = raised - spend.
   */
  finances: {
    spend: number;
    eventSpend: number;
    expenses: number;
    charitableGiving: number;
    cash: number;
    electronic: number;
    raised: number;
    net: number;
  };
  /** ActualNumberAttendees summed over the month's events (blank counts as 0), and how many events there were. */
  outreach: { attendees: number; events: number };
  /** Oldest StartDate first. */
  highlights: MonthlyHighlight[];
}

// 11. EXECUTIVE AUDITS AND THE LESSONS REGISTRY (Sprint 5L)
/** One signup flagged NoShow, for the council's trailing no-show audit. */
export interface NoShowAuditEntry {
  signup: EventSignup;
  shift: Shift;
  event: Event;
  memberId: number;
  memberNumber: number;
  firstName: string;
  lastName: string;
  /** The recorded reason, or null when none was recorded (LEFT JOIN, so such no-shows are never hidden). */
  reason: NoShowReason | null;
}

/** A signup on a past shift with no EventTime row for that member and shift. No-shows are not included. */
export interface ShiftAwaitingHours {
  signup: EventSignup;
  shift: Shift;
  event: Event;
  memberId: number;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  /** Whole calendar days from ShiftDate to today. */
  daysSinceShift: number;
  /**
   * True once the shift is past the SHIFT_HISTORY_MONTHS wall: eventTime.logHours refuses it
   * (SHIFT_REPORT_TOO_OLD), so the row is kept for the record but no reminder goes out.
   */
  closed: boolean;
  /** The last day hours for the shift can still be logged (YYYY-MM-DD). */
  loggableThrough: string;
}

/** Narrows lessonsLearned.listGlobalRegistry; every filter is optional and they combine with AND. */
export interface LessonsRegistryFilters {
  /** Only lessons of events linked to this council. */
  councilId?: number;
  lessonsCategoryId?: number;
  /** The event's Category. */
  eventCategoryId?: number;
  /** Case-insensitive text found in the lesson or its event's name. */
  search?: string;
  /** Inclusive bounds on the event's StartDate (YYYY-MM-DD). */
  fromDate?: string;
  toDate?: string;
}

export interface LessonsRegistryEntry {
  lesson: LessonsLearned;
  eventId: number;
  eventName: string;
  eventStartDate: string;
  eventCategory: string;
  lessonsCategory: string;
  /** Every council the event is linked to, ordered by CouncilNumber. */
  councils: Pick<Council, 'id' | 'CouncilNumber' | 'CouncilName'>[];
  /** True when the caller may add or remove this event's lessons (lessonsLearned.add/remove). */
  canModify: boolean;
}

// 12. SYSTEM FEEDBACK (Sprint 5P)
/** One feedback or bug report with its sender, for the Super Admin inbox. */
export interface FeedbackInboxEntry {
  feedback: SystemFeedback;
  firstName: string;
  lastName: string;
  councilNumber: number;
  phone: string;
  email: string;
}

// 13. MEDIA AND THE COUNCIL CALENDAR (Sprint 5Q)
/**
 * One item on a calendar grid: an event (all-day, possibly spanning days) or a meeting (one day and timed, or a
 * multi-day meeting spanning its days all day, with null times; Sprint 5Y-6).
 */
export type CalendarEntry =
  | {
      kind: 'event';
      id: number;
      title: string;
      /** YYYY-MM-DD, inclusive: the event's own dates, which may run past the requested range. */
      startDate: string;
      endDate: string;
      startTime: null;
      endTime: null;
      location: string;
      event: Event;
    }
  | {
      kind: 'meeting';
      id: number;
      title: string;
      /** The meeting's Date, and its last day: the same day, or EndDate for a multi-day meeting. */
      startDate: string;
      endDate: string;
      /** HH:MM:SS; null for a multi-day meeting, which runs all day. */
      startTime: string | null;
      endTime: string | null;
      location: string;
      meeting: Meeting;
    };

// 14. EXPENSE REPORTING (Sprint 5R)
/**
 * An expense sheet for expenses.submitReport. Without `id` it starts a new sheet; with one it replaces that draft's
 * links and line items. `Status` 'Draft' keeps it private to the submitter, 'Submitted' sends it to the council
 * queue. The council is always the submitter's own, so it is never supplied.
 */
export interface ExpenseReportInput {
  id?: number | null;
  Status: 'Draft' | 'Submitted';
  /** An event linked to the submitter's council, or null. */
  LinkedEventID?: number | null;
  /** A meeting of the submitter's council, or null. */
  LinkedMeetingID?: number | null;
}

/** One receipt for expenses.submitReport; its sheet comes from the call. */
export type ExpenseLineItemInput = Omit<ExpenseLineItem, 'id' | 'ExpenseReportID'>;

/** A check payout for expenses.recordDisbursement. TotalAmount is computed from the paid sheets, never supplied. */
export interface DisbursementCheckDetails {
  CheckNumber: string;
  /** YYYY-MM-DD */
  PayoutDate: string;
  Notes?: string | null;
}

/** One expense sheet with its receipts, their total, its submitter and, once paid, the check that paid it. */
export interface ExpenseReportDetail {
  report: ExpenseReport;
  /** Oldest DateOfExpense first, then id. */
  lineItems: ExpenseLineItem[];
  /** Sum of the line items' Amount, to the cent. */
  total: number;
  submitterFirstName: string;
  submitterLastName: string;
  disbursement: ExpenseDisbursement | null;
  /** 'First Last' of the officer who issued the written order (FinancialSecretaryMemberID); '' until then (Sprint 5Z-4). */
  financialSecretaryName: string;
  /** 'First Last' of the officer who counter-signed (GrandKnightMemberID); '' until then (Sprint 5Z-4). */
  grandKnightName: string;
}

export interface ExpenseDisbursementResult {
  disbursement: ExpenseDisbursement;
  /** The sheets it paid, now 'Reimbursed', in the order their ids were given. */
  reports: ExpenseReportDetail[];
}

// 15. PUSH ALERTS AND SUPREME COUNCIL REPORTING (Sprint 5T)
/**
 * Who notifications.dispatchHighPriorityAlert reaches: Active members of the council who hold any of `skillIds`, and
 * every Active member signed up for any of `shiftIds` (shifts of events linked to the council), whatever their own
 * council, so volunteers from affiliated sister councils on a shared event hear about their shift too. At least one
 * id is required.
 */
export interface AlertFilters {
  skillIds?: readonly number[];
  shiftIds?: readonly number[];
}

export interface AlertPayload {
  /** At most ALERT_TITLE_MAX_LENGTH characters. */
  title: string;
  /** At most ALERT_BODY_MAX_LENGTH characters. */
  body: string;
  /** Default 'High'. */
  priority?: NotificationPriority;
}

/** One message of the Expo Push API (https://exp.host/--/api/v2/push/send). */
export interface ExpoPushMessage {
  /** The recipient's ExponentPushToken[...]. */
  to: string;
  title: string;
  body: string;
  priority: 'default' | 'normal' | 'high';
  sound: 'default';
  data: { notificationLogId: number; councilId: number };
}

/** One Expo Push API call, carrying at most EXPO_PUSH_BATCH_SIZE messages. */
export interface ExpoPushRequest {
  method: 'POST';
  url: string;
  headers: Record<string, string>;
  body: ExpoPushMessage[];
}

export interface AlertDispatchResult {
  /** One NotificationLog row per recipient, in recipient id order. */
  logs: NotificationLog[];
  recipientIds: number[];
  /** The Expo requests printed with console.log (the push stub); empty when no recipient has a registered device. */
  pushRequests: ExpoPushRequest[];
  /** Recipients without a registered device: logged, so they see the alert in the app, but not pushed. */
  unreachableMemberIds: number[];
}

/** The dates (YYYY-MM-DD, inclusive) a Supreme form covers, labelled e.g. "2025" or "January-June 2026". */
export interface SupremeReportingPeriod {
  fromDate: string;
  toDate: string;
  label: string;
}

/** The council's compliance figures for one form and period, compiled by supreme.syncAlchemerReport. */
export interface SupremeComplianceSnapshot {
  councilId: number;
  councilNumber: number;
  councilName: string;
  formType: SupremeFormType;
  period: SupremeReportingPeriod;
  /** EventTime on the council's events' shifts dated in the period, and ActivityTime on its activities dated in it. */
  volunteerHours: { events: number; activities: number; total: number };
  /** Those hours by the event's or activity's Category, ordered by category. */
  hoursByCategory: { category: string; hours: number }[];
  /** Distinct members behind those hours. */
  volunteers: number;
  /** The council's events starting in the period. */
  eventsHeld: number;
  /** The council's donations dated in the period. */
  donations: DonationTotals;
  /** Spend of the events starting in the period. */
  eventSpend: number;
  /** Expense checks the council paid in the period (by PayoutDate). */
  expenseChecks: { count: number; total: number };
}

/** An Alchemer REST API v5 "create survey response" call. */
export interface AlchemerRequest {
  method: 'POST';
  /** Carries _method=PUT and the api_token / api_token_secret query parameters. */
  url: string;
  headers: Record<string, string>;
  /** Form-encoded data[<shortname>][value]=... pairs plus status=Complete. */
  body: string;
  /** The Alchemer survey the response is filed to. */
  surveyId: string;
  /** The same answers keyed by question shortname, for display and tests. */
  answers: Record<string, string | number>;
}

/** The part of Alchemer's reply the sync reads. */
export interface AlchemerResponse {
  result_ok: boolean;
  message?: string;
}

/** A reporting period picked on screen: a calendar year and, for CouncilAudit, its half (1 = January-June, 2 = July-December). */
export interface SupremePeriodChoice {
  year: number;
  half?: 1 | 2;
}

/** One past sync attempt with the name of the officer who ran it. */
export interface SupremeSyncHistoryEntry {
  sync: SupremeReportingSync;
  syncedByName: string;
}

export interface SupremeSyncResult {
  /** The SupremeReportingSync row written for this attempt, 'Success' or 'Failed'. */
  sync: SupremeReportingSync;
  snapshot: SupremeComplianceSnapshot;
  request: AlchemerRequest;
  /** Why a 'Failed' sync failed; null on success. */
  error: string | null;
}

// 16. OFFICER ELECTIONS (Sprint 5U)
/** How a council office is filled: by ballot, by the trustee ladder, or by the Grand Knight's appointment. */
export type OfficeKind = 'elected' | 'trustee' | 'appointed';

/** Who holds a seat; `since` is the StartDate of their open CouncilLeadershipHistory row (null if none is recorded). */
export interface SeatHolder {
  memberId: number;
  firstName: string;
  lastName: string;
  since: string | null;
}

/** One council office, as elections.listOfficerSeats reports it. */
export interface OfficerSeat {
  roleId: number;
  roleName: string;
  kind: OfficeKind;
  holder: SeatHolder | null;
  /** Elected seats only (all flags 0 for a seat never opened); null for trustee and appointed seats. */
  ballot: CouncilElectionBallot | null;
}

export interface BallotNominee {
  nomination: OfficerNominations;
  firstName: string;
  lastName: string;
  nominatedByName: string;
}

/** An elected seat open for nomination, as elections.listBallotConfig reports it. */
export interface BallotSeat {
  roleId: number;
  roleName: string;
  ballot: CouncilElectionBallot;
  /** The term the election fills (ballotTermYear). */
  fraternalYear: string;
  /** Whether submitNomination accepts nominations right now (May, or before a mid-year election closes). */
  nominationsOpen: boolean;
  holder: SeatHolder | null;
  /** This term's nominations for the seat, oldest first. */
  nominees: BallotNominee[];
}

export interface NominationResult {
  nomination: OfficerNominations;
  /** False (IsEligible = 0) for a Grand Knight nominee who never served as Deputy Grand Knight or Grand Knight. */
  eligible: boolean;
  /** Nominations for the seat this term, including this one. */
  tally: number;
}

/** An appointed or trustee seat nobody holds, with whoever last left it. */
export interface SeatVacancy {
  roleId: number;
  roleName: string;
  kind: 'appointed' | 'trustee';
  previous: { memberId: number; firstName: string; lastName: string; endDate: string; exitReason: LeadershipExitReason | null } | null;
}

export interface AbdicationResult {
  /** The member's history row for the seat, now closed 'Abdicated'; null when no open term was recorded. */
  history: CouncilLeadershipHistory | null;
  /** Appointed and trustee seats wait for the Grand Knight; elected seats go to a mid-year election. */
  outcome: 'AwaitingAppointment' | 'MidYearElection';
  /** The seat's ballot row after a mid-year election opened; null for appointed and trustee seats. */
  ballot: CouncilElectionBallot | null;
}

/** One seat changing hands when the year concludes; equal ids mean a renewed term. */
export interface SeatChange {
  roleId: number;
  roleName: string;
  previousMemberId: number | null;
  memberId: number | null;
}

export interface FraternalYearConclusion {
  /** True when the trustee chairs rotated (the Grand Knight seat was on the ballot and a new Grand Knight took it). */
  rotated: boolean;
  /** The term new history rows start in. */
  fraternalYear: string;
  changes: SeatChange[];
  /** Ballot rows cleared for the next cycle. */
  ballotsReset: number;
}

// 17. CHARITABLE GIVING AND DISBURSEMENTS (Sprint 5V)
/**
 * charities.searchGlobalRegistry. Every filter is optional and they combine with AND: `name` matches any part of the
 * Name ignoring case, `charityType` the whole CharityType ignoring case, `state` the two-letter State, `ein` the EIN
 * in any punctuation ('123456789' finds '12-3456789'), and `isCatholic` the IsCatholic flag.
 */
export interface CharitySearchFilters {
  name?: string | null;
  charityType?: string | null;
  state?: string | null;
  ein?: string | null;
  isCatholic?: boolean | null;
  /** At most this many rows, 1 to CHARITY_SEARCH_MAX_LIMIT; default CHARITY_SEARCH_DEFAULT_LIMIT. */
  limit?: number | null;
}

/**
 * A registry entry for charities.addGlobalCharity and hydrateAndDisburse. State is folded to upper case and EIN to
 * 'NN-NNNNNNN'; blank optional text is stored as NULL.
 */
export type NewGlobalCharity = Omit<GlobalCharityRegistry, 'id' | 'IsCatholic' | 'IsAnnual'> & { IsCatholic?: boolean; IsAnnual?: boolean };

/**
 * A member's gift proposal for charities.proposeDonation. Name a registry entry with ExistingCharityID, a charity not
 * yet registered with ProposedCharityName, or both (a blank name then takes the registry entry's Name). The council
 * comes from the call and the Status is always 'Pending'.
 */
export interface CharityProposalInput {
  ProposedCharityName?: string | null;
  ProposedAmount: number;
  ExistingCharityID?: number | null;
}

/**
 * The check for charities.hydrateAndDisburse. Amount defaults to the proposal's ProposedAmount (a council may vote a
 * different sum). MeetingMinutesID, when given, is the council meeting whose minutes record the vote and replaces the
 * proposal's.
 */
export interface CharityCheckDetails extends DisbursementCheckDetails {
  Amount?: number | null;
  MeetingMinutesID?: number | null;
  /**
   * A registry entry to pay instead of the proposal's ExistingCharityID ("link an existing charity"). Cannot be
   * combined with hydrateAndDisburse's `globalCharityData`.
   */
  CharityID?: number | null;
}

/** One gift proposal with its submitter, its registry entry (if any) and the check that paid it (if any). */
export interface CharityProposalDetail {
  proposal: CharityDonationProposal;
  submitterFirstName: string;
  submitterLastName: string;
  charity: GlobalCharityRegistry | null;
  disbursement: CharitableDisbursementLedger | null;
  /**
   * True while the proposal cannot be paid as it stands: it names no registry entry, or the entry has no mailing
   * Address or ZipCode (charityNeedsHydration). The officer links an entry or types in the full record.
   */
  needsHydration: boolean;
}

/** One charity the council is connected to, with every check the council paid it. */
export interface CouncilCharityLedgerEntry {
  charity: GlobalCharityRegistry;
  connectedAt: string;
  /** Newest PayoutDate first, then newest id. */
  disbursements: CharitableDisbursementLedger[];
  /** Sum of the checks, to the cent. */
  totalGiven: number;
}

export interface CharityDisbursementResult {
  /** The registry entry that was paid, as stored after any blanks were filled in. */
  charity: GlobalCharityRegistry;
  /** True when this call added the charity to the registry. */
  charityRegistered: boolean;
  /** The council's link to the charity, made by this call if it did not exist. */
  link: CouncilCharityLink;
  /** The proposal, now 'Approved' with ExistingCharityID set. */
  proposal: CharityDonationProposal;
  disbursement: CharitableDisbursementLedger;
}

// 17b. NORMALIZED CHARITABLE INTAKE (Sprint 5Z-1)
/**
 * A Knight Shepherd's intake form for charities.submitCharitableRequest. The council is the Shepherd's own, the
 * Shepherd is the caller, RequestStatus starts 'Submitted' and VoteStatus 'Pending'. Blank optional text is stored as
 * NULL. RelationshipTypeID must be one of the council's CouncilRelationshipType rows and MissionAreaID (Sprint 5Z-2) one
 * of its CouncilMissionArea rows; EIN is folded to 'NN-NNNNNNN'; FundsNeededBy is a YYYY-MM-DD date; RequestTier is 1
 * to CHARITABLE_REQUEST_MAX_TIER (default 1).
 */
export interface NewCharitableRequest {
  OrganizationName: string;
  AmountRequested: number;
  ContactName?: string | null;
  ContactPhone?: string | null;
  ContactEmail?: string | null;
  MailingAddress?: string | null;
  RelationshipTypeID?: number | null;
  MissionAreaID?: number | null;
  Is501c3?: boolean | null;
  EIN?: string | null;
  Website?: string | null;
  OrgMission?: string | null;
  IsRecurring?: boolean | null;
  FundsNeededBy?: string | null;
  SpecificUse?: string | null;
  TargetBeneficiary?: string | null;
  AccountabilityPlan?: string | null;
  RequestTier?: number | null;
}

/**
 * What charities.triageRequestStatus does to a request:
 * - 'claim' takes a 'Submitted' request: it becomes 'Claimed by Trustee' with the caller as its vetter.
 * - 'note' updates the vetting notes (and tier and target budget line) of a claimed request without moving it.
 * - 'advance' sends a claimed request on to the council's vote: 'Advanced', with VettedDate stamped.
 * - 'decline' (Sprint 5Z-2) ends a claimed request's vetting without a vote: 'Declined', with VettedDate stamped.
 */
export type CharitableTriageAction = 'claim' | 'note' | 'advance' | 'decline';

/**
 * The vetting desk's change for charities.triageRequestStatus. VettingNotes, RequestTier and TargetBudgetLineID, when
 * given, replace the stored values (a blank note or a null line clears it); left out, they are kept. TargetBudgetLineID
 * must be a CouncilBudgetForecast line of the request's council.
 */
export interface CharitableTriageInput {
  action: CharitableTriageAction;
  VettingNotes?: string | null;
  RequestTier?: number | null;
  TargetBudgetLineID?: number | null;
}

/** One intake request with the names the vetting desk shows beside it. */
export interface CharitableRequestDetail {
  request: CharitableRequest;
  shepherdFirstName: string;
  shepherdLastName: string;
  /** Null until an officer or Trustee claims the request. */
  vetterFirstName: string | null;
  vetterLastName: string | null;
  /** The CouncilRelationshipType name; null when the form named none. */
  relationshipName: string | null;
  /** The CouncilMissionArea name (Sprint 5Z-2); null when the form named none. */
  missionAreaName: string | null;
  /** The target budget line's LineItemName and FraternalYear (Sprint 5Z-2); null while the vetter has named none. */
  targetBudgetLine: { name: string; fraternalYear: string } | null;
}

/** What meetings.populateAnnualCadence laid down (Sprint 5Z-5). */
export interface CadencePopulationResult {
  /** The recurrence rule that was expanded. */
  config: CouncilCadenceConfig;
  fraternalYear: string;
  /** The meetings created, soonest first. */
  created: Meeting[];
  /** Dates in the year's cadence skipped because the council already had a meeting of that type that day. */
  skippedDates: string[];
}

/** One proposed motion with its floor presenter's name (Sprint 5Z-6), for the meeting's agenda view. */
export interface ProposedMotionDetail {
  motion: ProposedMotion;
  presenterFirstName: string;
  presenterLastName: string;
}

/** Where charities.routeRequestToNextEligibleAgenda put a request (Sprint 5Z-5). */
export interface AgendaRoutingResult {
  /** The new 'Pending' motion carrying the request. */
  motion: ProposedMotion;
  /** The Monthly meeting whose agenda now carries it. */
  meeting: Meeting;
}

/** One mission area's share of a council's fraternal year (Sprint 5Z-2). */
export interface MissionAreaFootprintEntry {
  /** Null for the "Unfiled" bucket: events filed under no mission area. */
  missionAreaId: number | null;
  missionAreaName: string;
  /** Recorded donations (Donation rows) at the area's events, to the cent; physical items are not counted. */
  donations: number;
  /** Volunteer hours logged on the area's event shifts (EventTime). */
  serviceHours: number;
  /** The area's events that started in the year. */
  events: number;
}

/**
 * reports.missionAreaFootprint: the Faith-in-Action footprint of one council's fraternal year. `areas` holds every
 * mission area of the council by name (zero rows included), `unfiled` what no area claims, `totals` both together.
 */
export interface MissionAreaFootprint {
  councilId: number;
  fraternalYear: string;
  fromDate: string;
  toDate: string;
  areas: MissionAreaFootprintEntry[];
  unfiled: MissionAreaFootprintEntry;
  totals: { donations: number; serviceHours: number; events: number };
}

// 18. ANNUAL BUDGET FORECASTING (Sprint 5Y)
/**
 * A council-specific line for budget.addCustomBudgetLine: a running cost that is neither an annual event nor an annual
 * charity (insurance, supplies, dues). It is always CategoryType 'Operational' with no ReferenceSourceID and a
 * PrePopulatedAmount of 0. Sprint 5Y-4: its figure is recorded as ProposedBudgetAmount (default 0) with BudgetStatus
 * 'Proposed'; ApprovedBudgetAmount stays 0 until budget.approveAndFinalizeEntireBudget. Blank Notes are stored as NULL.
 */
export interface NewCustomBudgetLine {
  FraternalYear: string;
  LineItemName: string;
  ProposedBudgetAmount?: number | null;
  Notes?: string | null;
  /** Sprint 5Y-3: one of the council's CouncilBudgetCategory ids; omitted or null leaves the line uncategorized. */
  BudgetCategoryID?: number | null;
}

/**
 * Options of the budget writes (Sprint 5Y-3, window recalibrated in 5Y-3.5). A fraternal year's budget accepts writes
 * only while it is 'Draft', May 1 00:00 through June 30 midnight of its first year (budgetWindowOf): before May 1 they
 * reject BUDGET_WINDOW_NOT_OPEN, from July 1 BUDGET_YEAR_FINALIZED. `superAdminOverride` lifts both, and only for an
 * Active Super Admin (anyone else passing it is still refused).
 */
export interface BudgetWriteOptions {
  superAdminOverride?: boolean;
}

/** budget.updateLineItemBudget's options: also files the line under a category (null: uncategorized; undefined: unchanged). */
export interface BudgetLineUpdateOptions extends BudgetWriteOptions {
  budgetCategoryId?: number | null;
}

/** budget.listAnnualForecast: a council's year with its own budget categories. */
export interface AnnualBudgetForecast {
  councilId: number;
  fraternalYear: string;
  /** Where the year stands today by the data service's clock: 'Not Yet Open', 'Draft' (May 1 - June 30) or 'Finalized' (July 1 on). */
  window: BudgetWindowState;
  /** Sprint 5Y-4: the year's lifecycle (budgetStatusOf): 'Draft', 'Proposed', or 'Approved' once the council voted. */
  status: BudgetLineStatus;
  /** The council's CouncilBudgetCategory rows in id order (the order the council created them). */
  categories: CouncilBudgetCategory[];
  /** Event, then Donation, then Operational lines, each LineItemName A-Z ignoring case, then id. */
  lines: CouncilBudgetForecast[];
}

/** What budget.prePopulateNextYear seeded. */
export interface BudgetPrePopulationResult {
  /** The year the forecast is for, e.g. '2027-2028'. */
  fraternalYear: string;
  /** The year whose actual spend was read, e.g. '2026-2027'. */
  sourceFraternalYear: string;
  /** Lines this call added. */
  created: number;
  /** Lines that already existed and had their PrePopulatedAmount (and a renamed source's name) refreshed. */
  refreshed: number;
  /** The council's whole forecast for the year afterwards, in listAnnualForecast order. */
  lines: CouncilBudgetForecast[];
}

/** One line of budget.getBudgetProgress / getHistoricalKPIs (Sprint 5Y-4): its approved cap against its actual spend. */
export interface BudgetLinePerformance {
  line: CouncilBudgetForecast;
  actual: number;
  /** ApprovedBudgetAmount minus actual: negative when over budget. */
  variance: number;
  /** actual as a percentage of ApprovedBudgetAmount, to one decimal place; null without an approved figure. */
  percentUsed: number | null;
  alert: BudgetAlert;
}

/** One budget category (fund) of a year against its actual spend; categoryId null is the Uncategorized group. */
export interface BudgetCategoryPerformance {
  categoryId: number | null;
  label: string;
  lineCount: number;
  proposed: number;
  approved: number;
  actual: number;
  variance: number;
  percentUsed: number | null;
  alert: BudgetAlert;
}

/**
 * A council's fraternal year, budget against actual spend from July 1 through `throughDate` (buildBudgetYearPerformance).
 * Actual spend counts what reports.monthlySummary counts - events' Spend, line items of 'Approved' and 'Reimbursed'
 * expense sheets, and charity checks - so it is the sum of the period's monthly summaries.
 */
/** One line's dual prior-year baseline (Sprint 5Y-6.5). */
export interface BudgetLineBaseline {
  /** The current year's CouncilBudgetForecast.id. */
  lineId: number;
  /** The previous year's line this one continues, or null. */
  priorLineId: number | null;
  /** That line's ApprovedBudgetAmount - last year's approved cap - or null when there is no such line or last year was never approved. */
  priorApproved: number | null;
  /** Last year's whole-year actual spend charged to this line (0 for a custom Operational line, which has no source to read). */
  priorActual: number;
}

/** budget.getPriorYearBaselines: last year's approved cap and actual spend beside each line of a council year. */
export interface BudgetPriorYearBaselines {
  councilId: number;
  fraternalYear: string;
  priorFraternalYear: string;
  /** The previous year's lifecycle, or null when it has no budget lines. */
  priorStatus: BudgetLineStatus | null;
  /** One entry per line of the year, in listAnnualForecast order. */
  lines: BudgetLineBaseline[];
}

export interface BudgetYearPerformance {
  councilId: number;
  fraternalYear: string;
  status: BudgetLineStatus;
  fromDate: string;
  throughDate: string;
  /** True when the period runs to the year's June 30. */
  complete: boolean;
  proposedTotal: number;
  approvedTotal: number;
  /** Spend counted against a budget line. */
  budgetedActual: number;
  /** Spend no line claims: one-off events, unlinked expenses, charities without a line. */
  unbudgetedActual: number;
  actualTotal: number;
  /** approvedTotal minus actualTotal. */
  variance: number;
  /** actualTotal as a percentage of approvedTotal; null when nothing is approved. */
  utilizationPercent: number | null;
  alert: BudgetAlert;
  linesWithinBudget: number;
  linesOverBudget: number;
  /** listAnnualForecast order. */
  lines: BudgetLinePerformance[];
  /** The council's categories in id order, then Uncategorized when any line has no category. */
  categories: BudgetCategoryPerformance[];
}

/** budget.getHistoricalKPIs: every completed fraternal year the council budgeted, newest first, and its trailing scorecard. */
export interface BudgetHistoricalKPIs {
  councilId: number;
  /** The day the figures were read, YYYY-MM-DD. */
  asOf: string;
  years: BudgetYearPerformance[];
  /** The fiscal efficiency scorecard over the approved years (a year never approved has nothing to measure against). */
  trailing: {
    /** Completed years with a budget. */
    years: number;
    approvedYears: number;
    approvedTotal: number;
    actualTotal: number;
    variance: number;
    /** Actual spend as a percentage of the approved budgets. */
    utilizationPercent: number | null;
    alert: BudgetAlert;
    yearsWithinBudget: number;
    yearsOverBudget: number;
  };
}

// 19. DOUBLE-ENTRY GENERAL LEDGER AND BALANCE SHEET (Sprint 5Z-7)
/**
 * One line of a transaction for finance.logDoubleEntryTransaction: exactly one of DebitAmount and CreditAmount above 0
 * (the other omitted or 0), in whole cents. The lines of one call must balance and belong to one council.
 */
export interface JournalLineInput {
  GLAccountID: number;
  DebitAmount?: number;
  CreditAmount?: number;
  Description: string;
  /** 'YYYY-MM-DD' (stored as midnight) or 'YYYY-MM-DD HH:MM[:SS]'; default now (UTC, as other DATETIME stamps). */
  DateLogged?: string;
  /** An event linked to the account's council (EventCouncils). */
  LinkedEventID?: number | null;
  /** A meeting of the account's council. */
  LinkedMeetingID?: number | null;
  CheckNumber?: string | null;
}

/** finance.transferAssetFunds's optional details. */
export interface AssetTransferOptions {
  /** Default 'Transfer from <source> to <target>'. */
  description?: string;
  /** As JournalLineInput.DateLogged; default now. */
  dateLogged?: string;
}

/** An account of the chart with its own posted balance and its descendants (finance.listChartOfAccounts). */
export interface ChartOfAccountsNode {
  account: GLAccount;
  /** 0 for a top-level account, 1 for its children, and so on. */
  depth: number;
  /** The account's own posted debits and credits, to the cent. */
  debitTotal: number;
  creditTotal: number;
  /**
   * The account's own balance on its normal side: debits minus credits for Asset and Expense accounts, credits minus
   * debits for Liability, Equity and Revenue accounts.
   */
  balance: number;
  /** balance plus every descendant's rolledUpBalance: Operating Checking with its virtual goals is the bank's figure. */
  rolledUpBalance: number;
  children: ChartOfAccountsNode[];
}

/** A council's chart of accounts as a hierarchy: top-level accounts in GL_ACCOUNT_TYPES order, then by id. */
export interface ChartOfAccounts {
  councilId: number;
  accounts: ChartOfAccountsNode[];
}

/** One account's line on the balance sheet. */
export interface BalanceSheetLine {
  accountId: number;
  accountName: string;
  accountType: GLAccountType;
  parentAccountId: number | null;
  isVirtualGoal: boolean;
  balance: number;
}

/** One section of the balance sheet: its accounts and their total. */
export interface BalanceSheetSection {
  lines: BalanceSheetLine[];
  total: number;
}

/**
 * finance.getLatestBalanceSheet: every posted entry of the council, summed in whole cents. The fundamental equation is
 * Assets = Liabilities + Equity, where Equity includes the surplus of Revenue over Expenses not yet closed to an equity
 * account. isBalanced compares the two sides to the penny; difference is assets minus liabilities and equity.
 */
export interface BalanceSheet {
  councilId: number;
  /** When it was read, 'YYYY-MM-DD HH:MM:SS' UTC. */
  asOf: string;
  /** Every Asset account, physical property and virtual goals included. */
  assets: BalanceSheetSection;
  liabilities: BalanceSheetSection;
  equity: BalanceSheetSection;
  revenue: BalanceSheetSection;
  expenses: BalanceSheetSection;
  /** revenue.total - expenses.total. */
  netSurplus: number;
  /** Sprint 5Z-8: the fraternal year (July through June) the year-to-date figure covers, e.g. '2026-2027'. */
  fraternalYear: string;
  /** Sprint 5Z-8: the part of netSurplus from entries dated in the current fraternal year (from its July 1). */
  yearToDateSurplus: number;
  /** Sprint 5Z-8: the rest of netSurplus, from entries dated before that July 1. */
  priorYearsSurplus: number;
  totalAssets: number;
  totalLiabilities: number;
  /** equity.total + netSurplus. */
  totalEquity: number;
  totalLiabilitiesAndEquity: number;
  difference: number;
  isBalanced: boolean;
  entryCount: number;
}

/** finance.uploadBankStatementReconciliation's optional scope. */
export interface BankReconciliationOptions {
  /** The council whose books are reconciled; default the actor's own council. */
  councilId?: number;
  /** Only match entries on this account (a non-virtual Asset account of the council); default every such account. */
  glAccountId?: number;
}

/** One data row of an uploaded bank statement CSV (parseBankStatementCsv). */
export interface BankStatementRow {
  /** The file's line number, counting the header as line 1. */
  line: number;
  /** YYYY-MM-DD. */
  date: string;
  description: string;
  /** Signed, in dollars to the cent: positive for a deposit, negative for a withdrawal or cleared check. */
  amount: number;
  checkNumber: string | null;
}

/** A statement row that reconciled a journal entry. */
export interface BankReconciliationMatch {
  row: BankStatementRow;
  journalEntryId: number;
}

/** A statement row that matched nothing; nothing was flagged for it. */
export interface BankReconciliationMiss {
  row: BankStatementRow;
  reason: string;
}

/** Another line of the same posting, beside an account ledger row (Sprint 5Z-8). */
export interface JournalCounterLine {
  entry: JournalEntry;
  accountName: string;
}

/** One line on an account, with the account's balance after it and the posting it belongs to (Sprint 5Z-8). */
export interface AccountLedgerRow {
  entry: JournalEntry;
  /** The account's normal-side balance once this line is counted, to the cent. */
  runningBalance: number;
  /** Every line of the posting (TransactionID), this one included, in id order. */
  transactionLines: JournalCounterLine[];
  /** Sprint 5Z-9: the linked event's full EventName, shown beside its #ID; null without a linked event. */
  eventName: string | null;
}

/** finance.getAccountLedger (Sprint 5Z-8): every line ever posted to one account, oldest first. */
export interface AccountLedger {
  account: GLAccount;
  balance: number;
  debitTotal: number;
  creditTotal: number;
  rows: AccountLedgerRow[];
}

/** A virtual goal inside a liquidity gauge (Sprint 5Z-8). */
export interface LiquidityGoal {
  account: GLAccount;
  /** What the goal holds now (its rolled-up balance). */
  balance: number;
  target: number;
  /** balance as a share of target, 0-100 to one decimal; null without a target. */
  percentFunded: number | null;
}

/**
 * A bank account with virtual goals carved out of it (buildLiquidityGauges, Sprint 5Z-8): the cash the bank holds,
 * what the goals reserve, and what is truly free to spend.
 */
export interface LiquidityGauge {
  account: GLAccount;
  /** The bank's figure: the account's own balance plus every goal inside it. */
  totalCash: number;
  /** The goals' balances together. */
  reserved: number;
  /** totalCash - reserved: true liquid operating cash. Negative when the goals hold more than the bank. */
  liquid: number;
  goals: LiquidityGoal[];
}

export interface BankReconciliationResult {
  councilId: number;
  /** The account matched against, or null for every non-virtual asset account of the council. */
  glAccountId: number | null;
  statementRows: number;
  matched: BankReconciliationMatch[];
  unmatched: BankReconciliationMiss[];
  /** The journal entries now flagged IsBankReconciled, in id order. */
  reconciledEntryIds: number[];
}

// 20. LIVE MEETING MANAGEMENT AND SMARTPHONE BALLOTING (Sprint 5Z-9)
/** A motion's secret ballot count so far. Every member checked in to the meeting may vote once. */
export interface BallotTally {
  motionId: number;
  approve: number;
  deny: number;
  abstain: number;
  /** Ballots cast. */
  total: number;
  /** Members checked in to the meeting: who may vote. */
  eligible: number;
}

/** The topic on the live console's center bar, counting down from when it was pushed. */
export interface LiveAgendaItem {
  name: string;
  allottedMinutes: number;
  /** 'YYYY-MM-DD HH:MM:SS' UTC. */
  startedAt: string;
  /** Whole seconds left of the allotment at the moment the state was read; 0 once it has run out. */
  secondsRemaining: number;
  /**
   * Sprint 6B Patch: the agenda line on the floor (AgendaLineView.key, Meeting.ActiveAgendaLineKey), which every phone
   * frames on its agenda sheet; null for a topic typed in by hand.
   */
  lineKey: string | null;
}

/** One of the meeting's motions as the console and the phones show it. */
export interface LiveMotionState {
  motion: ProposedMotion;
  /** Its smartphone ballot is open: launched and not yet finalized. */
  ballotOpen: boolean;
  tally: BallotTally;
  /** The reader has cast a ballot on it. */
  viewerHasVoted: boolean;
  /** Sprint 6B: the Recorder's show-of-hands count, when the motion was decided by hand; null otherwise. */
  handTally: MotionHandTally | null;
}

/**
 * meetings.getLiveAssemblyState and the console methods: the meeting as it runs. Phones poll it to follow along, so the
 * center bar, the check-in count and the tallies are always what the console last wrote.
 */
export interface LiveAssemblyState {
  meeting: Meeting;
  isLive: boolean;
  /** The council's Active roster count locked when the console started (quorum base); null before it ever started. */
  rosterCount: number | null;
  checkedInCount: number;
  /** Sprint 5Z-10: who is checked in, ascending, so the console marks them on its roster. Ballots never name voters. */
  checkedInMemberIds: number[];
  activeItem: LiveAgendaItem | null;
  /** The reader is checked in, and so may vote. */
  viewerCheckedIn: boolean;
  motions: LiveMotionState[];
}

/** meetings.finalizeProposedMotionVote's answer. */
export interface MotionVoteFinalization {
  motion: ProposedMotion;
  tally: BallotTally;
  /**
   * For a motion carrying a charitable request: the request with its vote recorded (Passed: VoteStatus 'Approved' and
   * AmountApproved = AmountRequested, now on the Financial Secretary's funding queue; Failed: 'Rejected'; Tabled:
   * unchanged and free to be routed again). Null for a member's own motion.
   */
  charitableRequest: CharitableRequest | null;
}

/**
 * Sprint 6B: which agenda line a correction is for - a stored agenda item, or a line the agenda generates from one of
 * the meeting's motions or one of the council's coming events.
 */
export type AgendaLineRef = { kind: 'item'; itemId: number } | { kind: 'motion'; motionId: number } | { kind: 'event'; eventId: number };

/** Who speaks to an agenda line, looked up when the agenda is read. */
export interface AgendaSpeaker {
  /** The member's full name, or the item's printed label for a guest or a vacant seat. */
  name: string;
  /** The seat they speak from ('Treasurer'), when the line names one. */
  roleName: string | null;
  /** Null for a printed label. */
  memberId: number | null;
}

/** One line of the live agenda as the console shows it. */
export interface AgendaLineView {
  /** Stable across reads: 'item:12', 'motion:3' or 'event:5'. */
  key: string;
  ref: AgendaLineRef;
  section: AgendaSectionKey;
  markdown: string;
  speaker: AgendaSpeaker | null;
  /** The motion a legislative line puts to the floor, with its hand tally once recorded. */
  motion: ProposedMotion | null;
  handTally: MotionHandTally | null;
  /** The event an Upcoming Events line announces. */
  event: Pick<Event, 'id' | 'EventName' | 'StartDate' | 'EndDate' | 'Location'> | null;
  /** The last live correction: when, and by whom. */
  lastEditedAt: string | null;
  lastEditedByName: string | null;
}

export interface AgendaSectionView {
  key: AgendaSectionKey;
  title: string;
  lines: AgendaLineView[];
}

/** A seated officer of the meeting's council, for the opening's officer array. */
export interface AgendaOfficerSeat {
  roleId: number;
  roleName: string;
  memberId: number;
  name: string;
}

/** meetings.getMeetingAgenda (Sprint 6B): the St. Mary's agenda, sections in order, every speaker resolved. */
export interface MeetingAgendaView {
  meeting: Meeting;
  sections: AgendaSectionView[];
  /** Every officer seat (Role.Officer = 1) of the council that has a holder, with its current holder, in Role order. */
  officers: AgendaOfficerSeat[];
  /** The meeting has stored agenda items (otherwise only the generated motion and event lines show). */
  hasStructuredAgenda: boolean;
}

/** meetings.recordHandBallotTally's answer. */
export interface HandTallyRecording {
  tally: MotionHandTally;
  /** The motion with its VoteResult now Passed or Failed. */
  motion: ProposedMotion;
  /** As MotionVoteFinalization.charitableRequest. */
  charitableRequest: CharitableRequest | null;
}

/** meetings.addAgendaLine's answer (Sprint 6B Patch): the agenda with the new blank line, and that line. */
export interface AgendaLineAddition {
  agenda: MeetingAgendaView;
  line: AgendaLineView;
}

/**
 * One member of Supreme Headquarters' roster export (Sprint 6B Patch), as supreme.syncSupremeRoster takes it
 * (parseSupremeRosterCsv reads the export). DegreeID is 1-4 (First to Fourth Degree); omitted, the First.
 */
export interface SupremeRosterRow {
  MemberNumber: number;
  MemberFirstName: string;
  MemberLastName: string;
  Email: string;
  Phone: string;
  StreetAddress1: string;
  StreetAddress2?: string | null;
  City: string;
  State: string;
  ZipCode: string;
  DateOfBirth: string;
  DegreeID?: number | null;
  DateJoinedCouncil: string;
}

/** supreme.syncSupremeRoster's answer. */
export interface SupremeRosterSyncResult {
  /** New members, each now with a placeholder login and a welcome email on its way. */
  created: Member[];
  /** Members already on the council's roster (by member number) whose join date was brought in line with Supreme's. */
  updated: Member[];
  /** Roster rows left out, with the reason (a bad field, an email already in use, a duplicate member number). */
  skipped: { memberNumber: number | null; reason: string }[];
}

/** finance.listLedgerTransactions (Sprint 6B): one posting of the general ledger, its lines summed. */
export interface LedgerTransactionSummary {
  transactionId: string;
  dateLogged: string;
  /** The first line's description. */
  description: string;
  /** The posting's debits (equal to its credits), to the cent. */
  amount: number;
  lineCount: number;
  linkedEventId: number | null;
  linkedMeetingId: number | null;
}

// 21. THE SERVICE
export interface DataService {
  /**
   * Idempotent. Opens the store and, on first launch, creates the schema and seeds
   * lookups, Council 15295, the test credentials/members and upcoming dev meetings.
   * Every other method awaits this internally, so calling it early is optional.
   */
  init(): Promise<void>;

  /** DEV ONLY. Wipes all data and re-runs first-launch seeding. */
  reset(): Promise<void>;

  auth: {
    /** Returns the session for valid credentials, otherwise null. Username match is case-insensitive. */
    signIn(username: string, password: string): Promise<SessionUser | null>;
    /**
     * First-time registration. Finds the pre-provisioned Member by email (case-insensitive) and
     * fills in the placeholder Credentials row they already own with a SHA-256 password hash.
     * Resolves to the new session. Rejects with a BusinessRuleError when: the email matches no
     * member (MEMBER_NOT_FOUND), the member already registered (ALREADY_REGISTERED), or the
     * password is under 8 characters (PASSWORD_TOO_SHORT).
     * Sprint 6B Security: `enrollmentCode`, the one-time setup code from the member's welcome email, is mandatory: it
     * must be one of that member's unexpired, unspent codes, or the registration is refused outright
     * (ENROLLMENT_CODE_INVALID, nothing written) - knowing a member's email is no longer enough to claim the account.
     * The code is spent by the registration. An Admin sends a fresh code with members.resendWelcome.
     */
    signUp(email: string, password: string, enrollmentCode: string): Promise<SessionUser>;
    /**
     * Sprint 6B Security: emails a 6-digit reset code (PasswordResetToken, RESET_CODE_LIFETIME_MINUTES) to the member
     * who registered with `email`, as a SendGrid request. It resolves the same way whether or not the email belongs to
     * a registered member, so the form cannot be used to find out who is a member. A new request retires every earlier
     * code; a request within RESET_REQUEST_COOLDOWN_SECONDS of the last sends nothing.
     */
    requestPasswordReset(email: string): Promise<void>;
    /**
     * Checks a reset code before the new-password form opens. Rejects RESET_CODE_INVALID for an unknown email, a wrong,
     * spent or expired code, or a code already guessed wrong RESET_CODE_MAX_ATTEMPTS times; each wrong guess counts
     * against the code. A right code is not spent here.
     */
    verifyPasswordResetCode(email: string, code: string): Promise<void>;
    /**
     * Sets a new password with a valid reset code (as verifyPasswordResetCode), spends the code and resolves to the
     * member's session. Rejects PASSWORD_TOO_SHORT before anything else is checked, and RESET_CODE_INVALID as above.
     */
    resetPassword(email: string, code: string, newPassword: string): Promise<SessionUser>;
  };

  /**
   * Anyone may read the lookups (screens need them for drop-downs). Writes take `actorId`, the signed-in
   * member: only an Active Super Admin may change a lookup table (SecurityPrivilegeError
   * SUPER_ADMIN_REQUIRED, nothing written), and an unknown actor rejects MEMBER_NOT_FOUND.
   */
  lookups: {
    /** All rows of one lookup table, ordered by id. */
    list<T extends LookupTableName>(table: T): Promise<LookupRowMap[T][]>;
    /**
     * Adds a row. Rejects (INVALID_INPUT) when a field is missing, too long or malformed, or when the
     * table's key value (e.g. Role.Role) already exists, compared case-insensitively.
     */
    create<T extends LookupTableName>(actorId: number, table: T, values: LookupValues): Promise<LookupRowMap[T]>;
    /** Changes a row's fields. Protected values the app depends on ('Active', the three member types) cannot be renamed. */
    update<T extends LookupTableName>(actorId: number, table: T, id: number, values: LookupValues): Promise<LookupRowMap[T]>;
    /** Deletes a row nothing references (LOOKUP_IN_USE otherwise) and that is not protected (LOOKUP_PROTECTED). */
    remove(actorId: number, table: LookupTableName, id: number): Promise<void>;
    /**
     * `list` for the System Lookup Manager: the same rows, but only for an Active Super Admin
     * (SUPER_ADMIN_REQUIRED). Drop-downs keep using the open `list`.
     */
    listForMaintenance<T extends LookupTableName>(actorId: number, table: T): Promise<LookupRowMap[T][]>;

    /*
     * Council-specific lookups (Activities, DonationType, CouncilDonationMethod). Reads and writes alike need an
     * Active Admin of the council or any Active Super Admin; the council's Active Financial Secretary and Treasurer
     * may also read and write its donation lookups (DonationType, CouncilDonationMethod). Otherwise
     * SecurityPrivilegeError ADMIN_REQUIRED, or COUNCIL_ACCESS_DENIED for another council's lookups, and nothing
     * is written. An unknown actor rejects MEMBER_NOT_FOUND, an unknown council INVALID_INPUT. The open
     * activities.listByCouncil and donations.listTypes/listMethods stay the member screens' feeds.
     */
    /** The council's rows of `table`, ordered by the table's key field (name, or DonationMethodID), then id. */
    listCouncilSpecific<T extends CouncilLookupTableName>(actorId: number, councilId: number, table: T): Promise<CouncilLookupRowMap[T][]>;
    /**
     * Adds the records without an id and replaces the fields of those with one, all or nothing, and resolves to
     * the council's rows as `listCouncilSpecific` returns them. Rejects INVALID_INPUT for a bad field, an unknown
     * Category or DonationMethod, an id listed twice, a record naming another council, or a key value (activity
     * name, donation type, enabled method) the council would then hold twice; RECORD_NOT_FOUND for an id that
     * is not one of the council's rows. Rows not listed are left alone.
     */
    saveCouncilSpecific<T extends CouncilLookupTableName>(
      actorId: number,
      councilId: number,
      table: T,
      records: CouncilLookupRecord<T>[],
    ): Promise<CouncilLookupRowMap[T][]>;
    /**
     * Deletes one of the council's rows. RECORD_NOT_FOUND when it is not one; RECORD_IN_USE while logged time
     * (Activities) or donations (DonationType) still point at it. Deletes never cascade.
     */
    removeCouncilSpecific(actorId: number, councilId: number, table: CouncilLookupTableName, id: number): Promise<void>;
  };

  councils: {
    /** Ordered by CouncilNumber, then CouncilName (Specifications: council dropdowns). */
    list(): Promise<Council[]>;
    get(id: number): Promise<Council | null>;
    /**
     * Councils linked to `councilId` through AffiliatedCouncils, in either direction, excluding the
     * council itself. Ordered like `list`.
     */
    listAffiliated(councilId: number): Promise<Council[]>;
    /**
     * Adds a council. Only an Active Super Admin maintains councils (SecurityPrivilegeError
     * SUPER_ADMIN_REQUIRED, nothing written); an unknown actor rejects MEMBER_NOT_FOUND. Rejects
     * INVALID_INPUT for a bad field or a CouncilNumber another council already uses.
     */
    create(actorId: number, council: NewCouncil): Promise<Council>;
    /** Changes a council's fields, validated as in `create`. RECORD_NOT_FOUND for an unknown council. */
    update(actorId: number, id: number, changes: RecordChanges<NewCouncil>): Promise<Council>;
    /**
     * Deletes a council nothing points at. Rejects RECORD_IN_USE, naming each table and row count, while any
     * member, parish, event, meeting, activity, list, thread, donation record, expense sheet, expense check or
     * affiliation refers to it.
     */
    remove(actorId: number, id: number): Promise<void>;
    /**
     * Switches the council's feature flags (Sprint 6A, features.ts) and resolves to the updated council. Flags left out
     * keep their stored values. Only an Active Super Admin may (SUPER_ADMIN_REQUIRED, nothing written); RECORD_NOT_FOUND
     * for an unknown council, INVALID_INPUT for an unknown flag or a value that is not a boolean.
     */
    setFeatureFlags(actorId: number, councilId: number, changes: FeatureFlagChanges): Promise<Council>;
    /**
     * Saves the council's bylaws (Sprint 6Z, bylaws.ts) - trimmed; '' clears them - stamps BylawsUpdatedAt, and resolves
     * to the updated council. Only an Active Admin or Grand Knight of the council, or an Active Super Admin, may
     * (ADMIN_REQUIRED or COUNCIL_ACCESS_DENIED, nothing written); RECORD_NOT_FOUND for an unknown council, INVALID_INPUT
     * for text that is not a string or is longer than BYLAWS_MAX_LENGTH.
     */
    setBylaws(actorId: number, councilId: number, markdown: string): Promise<Council>;
    /**
     * Saves the council's outbound email gateway (Sprint 6Z-Email-Proxy, email-gateway.ts) and resolves to the updated
     * council; null clears all five columns. The password arrives already sealed by the server
     * (/api/councils/email-gateway) and is stored as given. Only an Active Super Admin may (SUPER_ADMIN_REQUIRED, nothing
     * written); RECORD_NOT_FOUND for an unknown council, INVALID_INPUT for settings cleanEmailGatewaySettings refuses.
     */
    setEmailGateway(actorId: number, councilId: number, settings: EmailGatewaySettings | null): Promise<Council>;
  };

  /**
   * Council-level maintenance (parishes, pastors, activities, distribution lists) shares one privilege rule:
   * the actor must be an Active Admin or Super Admin (ADMIN_REQUIRED), and an Admin may touch only rows of
   * their own council, both where a row is now and where a change would move it (COUNCIL_ACCESS_DENIED).
   * Nothing is written when a check fails. Unknown actors reject MEMBER_NOT_FOUND and unknown rows
   * RECORD_NOT_FOUND; a delete is refused with RECORD_IN_USE while other rows still point at the row.
   */
  parishes: {
    /** The council's parishes, ordered by name. */
    listByCouncil(councilId: number): Promise<Parish[]>;
    get(id: number): Promise<Parish | null>;
    /** Rejects INVALID_INPUT for a bad field, an unknown council, or a name already used in the council (ignoring case). */
    create(actorId: number, parish: NewParish): Promise<Parish>;
    /** Moving a parish to another council requires rights over both councils. */
    update(actorId: number, id: number, changes: RecordChanges<NewParish>): Promise<Parish>;
    /** Refused (RECORD_IN_USE) while the parish still has pastors. */
    remove(actorId: number, id: number): Promise<void>;
  };

  pastors: {
    /** The parish's pastors, ordered by last name, then first name. */
    listByParish(parishId: number): Promise<Pastor[]>;
    /** Pastors of every parish of the council, ordered like `listByParish`. */
    listByCouncil(councilId: number): Promise<Pastor[]>;
    /** A pastor's council is their parish's. Rejects INVALID_INPUT for a bad field or an unknown parish. */
    create(actorId: number, pastor: NewPastor): Promise<Pastor>;
    /** Moving a pastor to another parish requires rights over both parishes' councils. */
    update(actorId: number, id: number, changes: RecordChanges<NewPastor>): Promise<Pastor>;
    remove(actorId: number, id: number): Promise<void>;
  };

  activities: {
    /** The council's activities, ordered by name. Activities are never shared with affiliated councils. */
    listByCouncil(councilId: number): Promise<Activities[]>;
    get(id: number): Promise<Activities | null>;
    /**
     * Rejects INVALID_INPUT for a bad field, an unknown council or category, or a name already used in the
     * council (ignoring case).
     */
    create(actorId: number, activity: NewActivity): Promise<Activities>;
    update(actorId: number, id: number, changes: RecordChanges<NewActivity>): Promise<Activities>;
    /** Refused (RECORD_IN_USE) once any time has been logged against the activity. */
    remove(actorId: number, id: number): Promise<void>;
    /** The council's activities, ordered like `listByCouncil`, each with its logged time in total and its archive state. */
    listSummaries(councilId: number): Promise<ActivitySummary[]>;
  };

  /**
   * Sprint 5Z-10.8: a list is council-wide (IsCouncilWide 1: public to the council, kept by its Admins and any Super
   * Admin; assertMayMaintainCouncilRecords) or private (one member's own segment: any Active member builds them in their
   * own council, and only the creator sees, changes or deletes one - someone else's private list reads RECORD_NOT_FOUND).
   * See assertMayCreateDistributionList and assertMayChangeDistributionList.
   */
  distributionLists: {
    /** The council's council-wide lists with their members, ordered by name. Private lists are never listed here. */
    listByCouncil(councilId: number): Promise<DistributionListSummary[]>;
    /**
     * Sprint 5Z-10.8: what `actorId` may see in the council - its council-wide lists and the actor's own private ones -
     * ordered by name. Rejects MEMBER_NOT_FOUND for an unknown actor.
     */
    listForMember(actorId: number, councilId: number): Promise<DistributionListSummary[]>;
    /**
     * Creates a list owned by the actor (CreatedBy) with its members, all or nothing; private unless
     * IsCouncilWide is true, which needs Admin rights (ADMIN_REQUIRED, COUNCIL_ACCESS_DENIED). Rejects INVALID_INPUT
     * for a bad name, a name already used (ignoring case) by another council-wide list of the council or, for a
     * private list, by another of the creator's private lists, or a member who does not exist or belongs to another
     * council.
     */
    create(actorId: number, list: NewDistributionList): Promise<DistributionListSummary>;
    /** Renames the list, replaces its members and/or changes its reach, all or nothing, validated as in `create`. */
    update(actorId: number, id: number, changes: DistributionListChanges): Promise<DistributionListSummary>;
    /** Deletes the list and its member entries together. Messages already sent keep their read receipts. */
    remove(actorId: number, id: number): Promise<void>;
  };

  members: {
    get(id: number): Promise<Member | null>;
    /** Email match is case-insensitive. */
    getByEmail(email: string): Promise<Member | null>;
    /** Ordered by last name, then first name. */
    listByCouncil(councilId: number, options?: { activeOnly?: boolean }): Promise<Member[]>;
    listRoles(memberId: number): Promise<Role[]>;
    /**
     * Adds a member together with a placeholder Credentials row (UNREGISTERED_PASSWORD) they claim
     * through auth.signUp. Rejects INVALID_INPUT for a bad field, an unknown council/lookup id, or an
     * email already used by a member or a login (case-insensitive). Once the row is stored, logs the
     * welcome email (what the app is, how to get it, how to sign in, who the council admin is).
     * `actorId` is the signed-in member making the change. Only an Active Admin or Super Admin may add
     * members (SecurityPrivilegeError ADMIN_REQUIRED), an Admin only in their own council
     * (COUNCIL_ACCESS_DENIED), and only an Active Super Admin may create a Super Admin
     * (SUPER_ADMIN_REQUIRED); nothing is written in any of these cases. Rejects MEMBER_NOT_FOUND for an
     * unknown actor.
     */
    create(actorId: number, member: NewMember): Promise<Member>;
    /**
     * Changes a member's fields; omitted fields keep their stored values, and the result is validated as
     * in `create`. An email change also renames the member's login. Privileges (SecurityPrivilegeError,
     * nothing written): a member without Active Admin rights may change only their own contact details
     * (MEMBER_SELF_SERVICE_COLUMNS), otherwise ADMIN_REQUIRED; an Admin may change only members of their
     * own council and may not move one to another council (COUNCIL_ACCESS_DENIED); an Admin may not change
     * a Super Admin's type or status, and only an Active Super Admin may promote to Super Admin (SUPER_ADMIN_REQUIRED).
     * Rejects MEMBER_NOT_FOUND for an unknown actor or member.
     */
    update(actorId: number, id: number, changes: Partial<NewMember>): Promise<Member>;
    /**
     * Sprint 6B Security: sends the member a new welcome email with a fresh one-time setup code - for a pre-provisioned
     * member whose code expired or never arrived. Earlier codes stay valid until they expire. By an Active Admin of the
     * member's council or a Super Admin (ADMIN_REQUIRED, COUNCIL_ACCESS_DENIED). Rejects MEMBER_NOT_FOUND and
     * ALREADY_REGISTERED for a member who has already chosen a password.
     */
    resendWelcome(actorId: number, memberId: number): Promise<void>;
  };

  memberProfiles: {
    /** Every Skill, SkillLevel, KOCTrainingClasses and WorkingStatus row, for the profile pickers. */
    listOptions(): Promise<ProfileOptions>;
    /** The member's working status, skills and training, with lookup names resolved. */
    getExtensions(memberId: number): Promise<MemberExtensions>;
    /**
     * Self-service replace of a member's skills, training classes and working status, all or nothing.
     * `skills` and `training` are the complete new lists (an empty array clears them); `workingStatusId`
     * null clears the status. Rejects MEMBER_NOT_FOUND, or INVALID_INPUT for an unknown lookup id, a skill
     * listed twice, the same class twice in one year, or a year outside 1882..this year. `actorId` is the
     * signed-in member; without Active Admin rights they may change only their own (ADMIN_REQUIRED), and
     * an Admin only those of their own council's members (COUNCIL_ACCESS_DENIED).
     */
    updateExtensions(
      actorId: number,
      memberId: number,
      skills: MemberSkillInput[],
      training: MemberTrainingInput[],
      workingStatusId: number | null,
    ): Promise<MemberExtensions>;
  };

  communication: {
    /** Every skill held by a member of the council (view_CouncilSkills), ordered by skill, then member name. */
    listCouncilSkills(councilId: number): Promise<CouncilSkillEntry[]>;
    /**
     * Starts a group thread from `senderId` to every Active member of the council who holds `skillId`
     * (the sender is never a recipient). Rejects INVALID_INPUT for empty text or an unknown skill,
     * and NO_RECIPIENTS when nobody else in the council has the skill.
     */
    sendBulkToSkills(councilId: number, skillId: number, messageText: string, senderId: number): Promise<BulkSkillMessageResult>;
  };

  donations: {
    /** The council's enabled methods in DonationMethod id order, with QR images, for a one-tap picker. */
    listMethods(councilId: number): Promise<CouncilDonationOption[]>;
    /** Every DonationMethod row in id order, enabled or not, for the council lookups' "enable a method" picker. */
    listAllMethods(): Promise<DonationMethod[]>;
    /** The council's own donation types, ordered by name. */
    listTypes(councilId: number): Promise<DonationType[]>;
    /** The council's donations, newest first; with `eventId`, only that event's. */
    list(councilId: number, options?: { eventId?: number }): Promise<Donation[]>;
    /**
     * The donation log (standalone donations or one event's) and per-event totals; see DonationHistory.
     * With `eventId`, rejects EVENT_NOT_FOUND for an unknown event and INVALID_INPUT for one not linked to
     * the council.
     */
    listHistory(councilId: number, eventId?: number): Promise<DonationHistory>;
    /**
     * Records a cash, credit card, QR (Venmo/Zelle/Zeffy/Parishsoft) or physical-item donation, stamping
     * RecordedBy with `actorId`, the signed-in member (MEMBER_NOT_FOUND when unknown).
     * Rejects INVALID_INPUT for a bad field, a future date, an amount of 0, a type from another council,
     * an event not linked to the council, or a physical item without a description; and
     * DONATION_METHOD_NOT_ENABLED when the council has not enabled the method.
     *
     * Event funds rollup, run in the same transaction by record, update and remove: while an event has cash
     * or electronic donations (from any council), its FundsRaised-Cash and FundsRaised-Electronic are
     * overwritten with their sums (physical items excluded). When the last of them goes, both are cleared to
     * null and become hand-editable again. A production driver must run the same rollup.
     */
    record(actorId: number, donation: NewDonation): Promise<Donation>;
    /**
     * Corrects a donation, validated as in `record` against the merged row; moving it to another event
     * re-totals both events. Allowed for an Active member who recorded it or owns its event, an Active
     * Financial Secretary or Treasurer of its council, an Active Admin of its council or any Active Super Admin
     * (ADMIN_REQUIRED, COUNCIL_ACCESS_DENIED); a move needs
     * that right over the donation both before and after. RECORD_NOT_FOUND for an unknown donation.
     */
    update(actorId: number, id: number, changes: DonationChanges): Promise<Donation>;
    /** Deletes one donation, with the same rights as `update`, and re-totals its event. */
    remove(actorId: number, id: number): Promise<void>;
  };

  /**
   * Expense reporting (Sprint 5R). A member files, edits (while a draft) and reads only their own sheets. Council
   * leadership, meaning an Active Admin, Financial Secretary or Treasurer of the council or any Active Super Admin,
   * reads the council's queue and returns sheets (SecurityPrivilegeError ADMIN_REQUIRED, COUNCIL_ACCESS_DENIED). A
   * sheet is approved only by dual approval (Sprint 5Z-3; the single-step approveReport was retired in Sprint 5Z-4):
   * the Financial Secretary's written order, then the Grand Knight's counter-signature. Only the council's Financial
   * Secretary or Treasurer, or an Active Super Admin, records the checks that pay them (FINANCE_OFFICER_REQUIRED,
   * Sprint 5S), and only for sheets carrying both signatures. Nobody signs or pays a sheet they submitted, whatever
   * their role. An unknown actor rejects MEMBER_NOT_FOUND. Every write is all or nothing: a rejected call
   * changes no row.
   */
  expenses: {
    /** The actor's own sheets in every status, newest (highest id) first. */
    listUserReports(actorId: number): Promise<ExpenseReportDetail[]>;
    /**
     * The council's sheets awaiting leadership: 'Submitted' and 'Approved', oldest (lowest id) first. Drafts stay
     * private to their submitters and 'Reimbursed' sheets are history. Rejects INVALID_INPUT for an unknown council.
     */
    listCouncilQueue(actorId: number, councilId: number): Promise<ExpenseReportDetail[]>;
    /**
     * The Grand Knight Authorization Desk (Sprint 5Z-4): the council's 'Submitted' sheets that carry the Financial
     * Secretary's written order and await the counter-signature, oldest (lowest id) first. Read by the council's Active
     * Grand Knight or Admins, or an Active Super Admin (ADMIN_REQUIRED, COUNCIL_ACCESS_DENIED). Rejects INVALID_INPUT for
     * an unknown council.
     */
    listAuthorizationQueue(actorId: number, councilId: number): Promise<ExpenseReportDetail[]>;
    /**
     * Saves a sheet and its complete list of line items in one transaction: without `report.id` it creates a sheet
     * in the actor's council; with one it replaces the links and line items of the actor's own 'Draft' sheet. Saving
     * as 'Submitted' clears any RejectionReason; saving as 'Draft' keeps it.
     * A 'Submitted' sheet needs at least one line item. Rejects RECORD_NOT_FOUND for an id that is not one of the
     * actor's sheets, EXPENSE_STATUS_CONFLICT for a sheet no longer a draft, and INVALID_INPUT for a bad field (an
     * amount of 0 or with fractions of a cent, a future date, a blank vendor or description, a text over its column's
     * length) or a linked event or meeting that is unknown or outside the sheet's council; INVALID_DATE for a
     * malformed date.
     */
    submitReport(actorId: number, report: ExpenseReportInput, lineItems: readonly ExpenseLineItemInput[]): Promise<ExpenseReportDetail>;
    /**
     * Returns a 'Submitted' sheet to its submitter (council leadership only): Status goes back to 'Draft' and
     * RejectionReason keeps the trimmed `rejectionReason`, so the member can edit and submit again (which clears it).
     * Rejects INVALID_INPUT for a blank reason or one over REJECTION_REASON_MAX_LENGTH characters, RECORD_NOT_FOUND
     * for an unknown sheet and EXPENSE_STATUS_CONFLICT for one in another status. Any dual-approval signatures on the
     * sheet are cleared (Sprint 5Z-3), so a resubmitted sheet is signed afresh.
     */
    rejectReport(actorId: number, reportId: number, rejectionReason: string): Promise<ExpenseReportDetail>;
    /**
     * Dual approval, first signature (Sprint 5Z-3): the council's Active Financial Secretary, or an Active Super Admin,
     * audits a 'Submitted' sheet and issues the written order, stamping FinancialSecretaryMemberID and
     * FinancialSecretaryApprovedAt. Status stays 'Submitted' until the Grand Knight counter-signs. Rejects
     * FINANCIAL_SECRETARY_REQUIRED or COUNCIL_ACCESS_DENIED for anyone else, SELF_APPROVAL_BLOCKED for the actor's own
     * sheet (every role), RECORD_NOT_FOUND for an unknown sheet, and EXPENSE_STATUS_CONFLICT for a sheet not
     * 'Submitted' or already carrying the order.
     */
    financialSecretaryAuditOrder(actorId: number, reportId: number): Promise<ExpenseReportDetail>;
    /**
     * Dual approval, second signature (Sprint 5Z-3): the council's Active Grand Knight, or an Active Super Admin,
     * counter-signs a sheet that carries the Financial Secretary's order, stamping GrandKnightMemberID and
     * GrandKnightApprovedAt and moving Status to 'Approved', which releases it to the Treasurer's disbursement desk.
     * Rejects GRAND_KNIGHT_REQUIRED or COUNCIL_ACCESS_DENIED for anyone else, SELF_APPROVAL_BLOCKED for the actor's own
     * sheet, DUAL_SIGNATURE_CONFLICT when the actor issued the order themselves, RECORD_NOT_FOUND for an unknown sheet,
     * and EXPENSE_STATUS_CONFLICT for a sheet not 'Submitted' or still awaiting the order.
     */
    grandKnightAuthorizeOrder(actorId: number, reportId: number): Promise<ExpenseReportDetail>;
    /**
     * Records one check paying the listed sheets of `councilId` (the council's Active Financial Secretary or Treasurer,
     * or an Active Super Admin; anyone else rejects FINANCE_OFFICER_REQUIRED or COUNCIL_ACCESS_DENIED): creates the
     * ExpenseDisbursement with TotalAmount set to the sheets' total, then stamps every sheet 'Reimbursed' with its
     * DisbursementID, all in one transaction. Rejects INVALID_INPUT for an empty or repeated id list, a sheet of
     * another council, a blank or over-long check number, or a check number the council already used; INVALID_DATE for a
     * malformed payout date; RECORD_NOT_FOUND for an unknown sheet; EXPENSE_STATUS_CONFLICT for a sheet not 'Approved' or
     * missing either dual-approval signature (Sprint 5Z-4);
     * SELF_PAYOUT_BLOCKED for a sheet the actor submitted, whatever their role (Sprint 5R-2; no override since 5S).
     */
    recordDisbursement(
      actorId: number,
      councilId: number,
      reportIds: readonly number[],
      checkDetails: DisbursementCheckDetails,
    ): Promise<ExpenseDisbursementResult>;
  };

  events: {
    get(id: number): Promise<Event | null>;
    getShift(id: number): Promise<Shift | null>;
    /** Shifts whose ShiftDate is between the two dates inclusive (YYYY-MM-DD), soonest first. */
    listShiftsBetween(fromDate: string, toDate: string): Promise<Shift[]>;
    listSignups(shiftId: number): Promise<EventSignup[]>;
    /**
     * Registers a volunteer for a shift and increments NumberVolunteersSignedUp, all or nothing.
     * Rejects (BusinessRuleError, nothing written) when the shift or member does not exist, the
     * member is already signed up (ALREADY_SIGNED_UP). A shift that has reached MinNumberVolunteers still takes
     * honorary signups (Sprint 5Z-Final-Polish), so NumberVolunteersSignedUp may exceed it.
     */
    signupForShift(memberId: number, shiftId: number): Promise<EventSignup>;

    /** Every shift the member is signed up for between the dates inclusive (default: all), soonest first. */
    listMemberShifts(memberId: number, range?: { fromDate?: string; toDate?: string }): Promise<MemberShift[]>;
    /**
     * Shifts between the dates inclusive whose event is linked to any of `councilIds`, soonest first.
     * Locked shifts are included so the UI can show them as full.
     */
    listShiftFeed(query: {
      memberId: number;
      councilIds: number[];
      fromDate: string;
      toDate: string;
    }): Promise<ShiftFeedItem[]>;
    /** Signups flagged NoShow for the member on shifts dated on or after `sinceDate` (rolling one-year badge). */
    countNoShows(memberId: number, sinceDate: string): Promise<number>;
    /**
     * Marks a signup as a no-show (`noShow` true: NoShow = 1 with `reasonId`, which must name a NoShowReason) or
     * clears it (NoShow = 0, reason removed; `reasonId` ignored). `actorId` is the signed-in member: a member may
     * mark only their own signup and may not clear one; an Active Admin of a council the shift's event is linked to
     * may mark or clear anyone's; an Active Super Admin anyone's anywhere (ADMIN_REQUIRED, COUNCIL_ACCESS_DENIED).
     * Rejects RECORD_NOT_FOUND for an unknown signup, INVALID_INPUT for a missing or unknown reason, and
     * NO_SHOW_HAS_HOURS while the member has hours logged on the shift. Nothing is written when it rejects.
     */
    setNoShow(actorId: number, signupId: number, noShow: boolean, reasonId?: number | null): Promise<EventSignup>;

    /** Events linked to the council, newest StartDate first. */
    listByCouncil(councilId: number): Promise<Event[]>;
    /**
     * The council's calendar between the dates inclusive (YYYY-MM-DD): every event linked to the council whose
     * StartDate-EndDate overlaps the range, and every meeting of the council dated inside it. Ordered by start
     * date, then all-day events before timed meetings, then start time, title and id (buildCalendarEntries).
     * With `options.hideEnded` (standard members, see calendarHidesEnded), events that ended before today and
     * meetings dated before today are left out.
     * Rejects INVALID_DATE for a malformed date and INVALID_INPUT for an unknown council or an end before the start.
     */
    listCalendarRange(councilId: number, startDate: string, endDate: string, options?: { hideEnded?: boolean }): Promise<CalendarEntry[]>;
    /**
     * Appends local photo reference paths to the event's PhotoGalleryURL (comma-separated), skipping paths it
     * already holds, and resolves to the updated event. `actorId` is the signed-in member: the event's Active owner,
     * an Active Admin, Financial Secretary or Treasurer of a council the event is linked to, or any Active Super
     * Admin (ADMIN_REQUIRED, COUNCIL_ACCESS_DENIED). Rejects MEMBER_NOT_FOUND for an unknown actor, EVENT_NOT_FOUND
     * for an unknown event, and INVALID_INPUT for an empty list, a blank path, a path containing a comma, or a
     * gallery that would exceed PHOTO_GALLERY_MAX_LENGTH characters. Nothing is written when it rejects.
     */
    uploadPhotos(actorId: number, eventId: number, photoPaths: readonly string[]): Promise<Event>;
    /**
     * Sprint 6C: records the Drive file id of the event's flyer from the Marketing Factory in GoogleDriveFlyerFileID
     * (`null` clears it) and resolves to the updated event. The same writers as uploadPhotos (ADMIN_REQUIRED,
     * COUNCIL_ACCESS_DENIED); MEMBER_NOT_FOUND for an unknown actor, EVENT_NOT_FOUND for an unknown event, INVALID_INPUT
     * for a value that is not a bare Drive file id (isDriveFileId). Nothing is written when it rejects.
     */
    setFlyerFile(actorId: number, eventId: number, fileId: string | null): Promise<Event>;
    listShifts(eventId: number): Promise<Shift[]>;
    /**
     * Every signup on the event's shifts with the member's name and any hours logged in EventTime
     * (EventSignup joined to EventTime on ShiftID and MemberID), in shift order, then last and first name.
     */
    listTurnout(eventId: number): Promise<VolunteerTurnout[]>;
    /** Ids of every council the event is linked to. */
    listCouncilIds(eventId: number): Promise<number[]>;
    /** Creates an event linked to `councilIds` (at least one). Rejects INVALID_INPUT on any bad field. */
    create(event: NewEvent, councilIds: number[]): Promise<Event>;
    /**
     * Changes event fields, including the post-event ledger (Spend, funds raised, attendance, Highlights).
     * While the event has cash or electronic donations its funds columns are rollups: a change to either
     * value is refused (FUNDS_MANAGED_BY_DONATIONS, nothing written); resending the current value is allowed.
     */
    update(id: number, changes: EventChanges): Promise<Event>;
    /** Replaces the event's council links (at least one). */
    setCouncils(eventId: number, councilIds: number[]): Promise<void>;
    /**
     * Creates a twin of an event: same details, council links and shifts moved to `options.startDate`.
     * Signups, time and the post-event ledger are not copied.
     */
    copy(eventId: number, options: CopyEventOptions): Promise<Event>;
    /** The shift date must fall within the event's dates; MinNumberVolunteers is at least 1. */
    createShift(shift: NewShift): Promise<Shift>;
    /** Rejects when MinNumberVolunteers would drop below the volunteers already signed up. */
    updateShift(id: number, changes: ShiftChanges): Promise<Shift>;
    /** Rejects with SHIFT_HAS_SIGNUPS while anyone is signed up. */
    deleteShift(id: number): Promise<void>;
    /**
     * Sprint 5Z-10: opens ('Active') or closes ('Inactive') the event's high-speed gate intake (Event.IntakeSessionStatus);
     * while it is Active the phones pinned to the event show the one-tap cash and card targets. Any Active member of a
     * council linked to the event, or an Active Super Admin (assertMayRunEventIntake; COUNCIL_ACCESS_DENIED). Rejects
     * MEMBER_NOT_FOUND, EVENT_NOT_FOUND and INVALID_INPUT for another status. Resolves to the event.
     */
    setIntakeSessionStatus(actorId: number, eventId: number, status: EventIntakeSessionStatus): Promise<Event>;
  };

  lessonsLearned: {
    list(eventId: number): Promise<LessonsLearned[]>;
    /**
     * `actorId` is the signed-in member: the event's Active owner, an Active Admin of a council the event is
     * linked to, or any Active Super Admin (ADMIN_REQUIRED, COUNCIL_ACCESS_DENIED; nothing written).
     * Rejects MEMBER_NOT_FOUND for an unknown actor, EVENT_NOT_FOUND for an unknown event and INVALID_INPUT for
     * empty text or an unknown category.
     */
    add(actorId: number, eventId: number, categoryId: number, description: string): Promise<LessonsLearned>;
    /** Deletes a lesson, with the same rights as `add` over its event. INVALID_INPUT for an unknown lesson. */
    remove(actorId: number, id: number): Promise<void>;
    /**
     * Lessons from every council, so units learn from their peers: open to any Active Admin or Super Admin
     * (ADMIN_REQUIRED otherwise). Each entry says whether the caller may change it: an Admin only lessons of
     * events linked to their own council (or events they own). Newest event StartDate first, then lesson id.
     * Rejects INVALID_DATE for a malformed date filter and INVALID_INPUT for a bad id filter.
     */
    listGlobalRegistry(actorId: number, filters?: LessonsRegistryFilters): Promise<LessonsRegistryEntry[]>;
  };

  eventTime: {
    /**
     * Records hours worked on a shift. Requires an existing EventSignup for the member and shift
     * (NOT_SIGNED_UP). One row per member and shift: logging again replaces the hours and notes.
     * Rejects when `hours` is not a multiple of 0.25 in (0, 24], or the shift date is more than
     * 3 months in the past (SHIFT_REPORT_TOO_OLD). Hours may exceed the shift's scheduled
     * StartTime-EndTime length (set-up and clean-up often run over); see SHIFT_DURATION_IS_A_CEILING.
     */
    logHours(memberId: number, shiftId: number, hours: number, notes?: string): Promise<EventTime>;
  };

  activityTime: {
    /**
     * Records hours against a council activity on `date` (YYYY-MM-DD). Each call adds an entry.
     * Rejects when `hours` is not a multiple of 0.25 in (0, 24], or `date` is more than
     * 6 months in the past (ACTIVITY_DATE_TOO_OLD).
     */
    logHours(memberId: number, activityId: number, hours: number, date: string, notes?: string): Promise<ActivityTime>;
    /**
     * The phone's rapid-tap tracker (Sprint 6A): adds 15 minutes (HOURS_STEP) to the member's entry for the activity on
     * `date`, in one transaction, creating a 0.25-hour entry when there is none yet. Repeated taps grow the same entry,
     * so the day keeps one row per activity. Rejects like logHours, and HOURS_OUT_OF_RANGE once the entry is at 24 hours.
     */
    addQuarterHour(memberId: number, activityId: number, date: string): Promise<ActivityTime>;
    /**
     * Every entry logged against the activity (ActivityTime joined to Member), newest ActivityDate first,
     * with the total hours. Rejects ACTIVITY_NOT_FOUND for an unknown activity.
     */
    listByActivity(activityId: number): Promise<ActivityTimeLog>;
  };

  reports: {
    /**
     * The council's month in totals: labor hours, unique members, the events' ledger, attendance and
     * highlights (see MonthlySummary). Rejects INVALID_INPUT for an unknown council, a year before 1882 or
     * after 9999, or a month outside 1-12.
     */
    monthlySummary(councilId: number, year: number, month: number): Promise<MonthlySummary>;
    /**
     * The Faith-in-Action footprint of the council's fraternal year (Sprint 5Z-2): recorded donations (by DonationDate,
     * physical items excluded) and volunteer hours (by ShiftDate) at the council's events, grouped by the events'
     * mission areas (Event.MissionAreaID), with an Unfiled bucket. For the executive summaries' readers, as for
     * budget.getBudgetProgress (ADMIN_REQUIRED, COUNCIL_ACCESS_DENIED). Rejects INVALID_INPUT for an unknown council or
     * a fraternal year that is not 'YYYY-YYYY' with consecutive years.
     */
    missionAreaFootprint(actorId: number, councilId: number, fraternalYear: string): Promise<MissionAreaFootprint>;
    /**
     * Signups flagged NoShow by members of the council on shifts dated on or after `dateThreshold` (default:
     * NO_SHOW_AUDIT_MONTHS before today), with or without a recorded reason. Newest ShiftDate first, then last
     * and first name. Rejects INVALID_INPUT for an unknown council and INVALID_DATE for a malformed threshold.
     */
    listNoShowsAudit(councilId: number, dateThreshold?: string): Promise<NoShowAuditEntry[]>;
    /**
     * Signups (not no-shows) on shifts dated before today, of events linked to the council, with no EventTime row
     * for that member and shift. Rows past the 3-month logging wall are included with `closed: true`. Newest
     * ShiftDate first, then last and first name. Rejects INVALID_INPUT for an unknown council.
     */
    listShiftsAwaitingHours(councilId: number): Promise<ShiftAwaitingHours[]>;
  };

  meetings: {
    get(id: number): Promise<Meeting | null>;
    /**
     * Meetings still running on or after `fromDate` (default: today, local time; a multi-day meeting counts through its
     * EndDate), soonest first.
     * With `memberId`, only meetings that member is invited to whose invitations are released (Sprint 5Z-6:
     * isInvitationReleased; a drip-release meeting stays off a member's list until its InviteReleaseDate).
     */
    listUpcoming(
      councilId: number,
      options?: { memberId?: number; fromDate?: string },
    ): Promise<Meeting[]>;
    /**
     * The council's meetings on or after `fromDate` (default: today), soonest first, split into the ones `memberId`
     * is invited to and all of them. Invitations not yet released (Sprint 5Z-6, InviteReleaseDate after today) count
     * as no invitation. Rejects MEMBER_NOT_FOUND for an unknown member.
     */
    listSchedules(councilId: number, memberId: number, options?: { fromDate?: string }): Promise<MeetingSchedules>;
    /**
     * OwnerID, when given, must name a member, and MeetingTypeID one of the council's own CouncilMeetingType rows
     * (INVALID_INPUT). A multi-day meeting (IsMultiDay 1) needs an EndDate after its Date and is stored with no clock
     * times (cleanMeetingSpan); a one-day meeting may not carry an EndDate (INVALID_INPUT).
     */
    create(meeting: NewMeeting, invite?: MeetingInviteMode): Promise<Meeting>;
    listInvites(meetingId: number): Promise<MeetingInvites[]>;
    /** Adds invitations, skipping members already invited. Resolves to the number newly invited. */
    invite(meetingId: number, memberIds: number[]): Promise<number>;
    /** Rejects if the member was never invited to the meeting. */
    setAttended(meetingId: number, memberId: number, attended: boolean): Promise<void>;
    /** Points the meeting at its uploaded minutes; `null` removes them (stored as '', since the column is NOT NULL). */
    setMinutes(meetingId: number, minutesUrl: string | null): Promise<Meeting>;
    /**
     * Saves the meeting's shared Google Drive links: `minutesUrl` to GoogleDriveMinutesURL and `flyerUrl` to
     * GoogleDriveFlyerURL; `null` clears one. Each must be an https link on drive.google.com or docs.google.com of
     * at most GOOGLE_DRIVE_URL_MAX_LENGTH characters (INVALID_INPUT). `actorId` is the signed-in member: an Active
     * Admin, Financial Secretary or Treasurer of the meeting's council, the meeting's Active owner (OwnerID), or any
     * Active Super Admin (ADMIN_REQUIRED, COUNCIL_ACCESS_DENIED). Rejects MEMBER_NOT_FOUND for an unknown actor and MEETING_NOT_FOUND for an unknown
     * meeting. Nothing is written when it rejects.
     */
    linkGoogleDrive(actorId: number, meetingId: number, minutesUrl: string | null, flyerUrl: string | null): Promise<Meeting>;
    /**
     * Meeting hours for a member: every invitation marked Attended = 1, each worth its meeting's
     * Time End - Time Start, oldest first with a running total. Optional inclusive date range.
     */
    memberHours(memberId: number, range?: { fromDate?: string; toDate?: string }): Promise<MemberMeetingHours>;
    /**
     * The meeting types the council defines for itself (CouncilMeetingType, Sprint 5Y-5), by TypeName then id.
     * Another council's types never appear. Rejects INVALID_INPUT for an unknown council.
     */
    listCouncilMeetingTypes(councilId: number): Promise<CouncilMeetingType[]>;
    /**
     * Records the signed-in member's own RSVP to a meeting in one call: sets their MeetingInvites.ResponseStatus to
     * `status` ('NoResponse', 'Accepted' or 'Declined'; see MEETING_RESPONSE_STATUSES) and resolves to the updated
     * invitation. Resending the current status is allowed. Rejects INVALID_INPUT for any other status,
     * MEMBER_NOT_FOUND for an unknown member, MEETING_NOT_FOUND for an unknown meeting and NOT_INVITED when the
     * member has no invitation to it, or one not released yet (Sprint 5Z-6). Nothing is written when it rejects.
     */
    rsvpToInvite(actorId: number, meetingId: number, status: MeetingResponseStatus): Promise<MeetingInvites>;
    /**
     * The council's agenda outline for one of its meeting types (CouncilAgendaTemplate), or null when the council
     * has none for that type, including a type belonging to another council.
     */
    getAgendaTemplate(councilId: number, meetingTypeId: number): Promise<CouncilAgendaTemplate | null>;
    /**
     * Sets the council's agenda outline for one of its meeting types (Sprint 5Y-6), creating or replacing its
     * CouncilAgendaTemplate row, and resolves to it; blank text removes the template and resolves to null. `actorId` is
     * the signed-in member: an Active Admin or Grand Knight of the council, or any Active Super Admin (ADMIN_REQUIRED,
     * COUNCIL_ACCESS_DENIED). Rejects MEMBER_NOT_FOUND for an unknown actor, INVALID_INPUT for a meeting type that is
     * not the council's own and for text over AGENDA_TEMPLATE_MAX_LENGTH characters. Nothing is written when it rejects.
     */
    saveAgendaTemplate(actorId: number, councilId: number, meetingTypeId: number, templateText: string): Promise<CouncilAgendaTemplate | null>;
    /**
     * Lays down a fraternal year of meetings from one of the council's standing cadences (CouncilCadenceConfig,
     * Sprint 5Z-5), server side and all or nothing: one meeting per month, July of the year's first calendar year
     * through June of its second, on the day CadencePattern names ('First Tuesday', 'Last Thursday'), from
     * DefaultStartTime for CADENCE_MEETING_MINUTES at DefaultLocation. Each meeting is filed under the config's
     * MeetingTypeID (and the global MeetingType of the same name), named cadenceMeetingName(TypeName), has no owner,
     * and starts from the council's agenda template for the type ('' when it has none). Sprint 5Z-6 drip release: each
     * meeting invites the config's DefaultRecipientGroup (cadenceInviteMode) at once, but carries InviteReleaseDate =
     * Date - CADENCE_INVITE_LEAD_DAYS, and members' feeds ignore those invitations until that day. A date on which the
     * council already has a meeting of that type is skipped and listed in skippedDates, so running it again creates
     * only what is missing. `actorId` is the signed-in member: an Active Admin or Grand Knight of the council, or any
     * Active Super Admin (ADMIN_REQUIRED, COUNCIL_ACCESS_DENIED). Rejects MEMBER_NOT_FOUND for an unknown actor,
     * INVALID_INPUT for an unknown council, a fraternal year that is not 'YYYY-YYYY' with consecutive years, or a stored
     * pattern or start time that cannot be read, and RECORD_NOT_FOUND for a config that is not the council's.
     */
    populateAnnualCadence(actorId: number, councilId: number, configId: number, fraternalYear: string): Promise<CadencePopulationResult>;
    /**
     * The council's standing meeting cadences (CouncilCadenceConfig, Sprint 5Z-6), by id. Another council's never
     * appear. Rejects INVALID_INPUT for an unknown council.
     */
    listCadenceConfigs(councilId: number): Promise<CouncilCadenceConfig[]>;
    /**
     * Creates or replaces the council's cadence for one of its meeting types (Sprint 5Z-6; one per council and type)
     * and resolves to it. The input is cleaned by cleanCadenceConfigInput: the pattern stored as 'First Tuesday', the
     * start time as 'HH:MM', a location of at most CADENCE_LOCATION_MAX_LENGTH characters and a recipient group of
     * CADENCE_RECIPIENT_GROUPS (default 'all_members'). Meetings already laid down are not changed. Same keepers as
     * populateAnnualCadence (ADMIN_REQUIRED, COUNCIL_ACCESS_DENIED). Rejects MEMBER_NOT_FOUND for an unknown actor and
     * INVALID_INPUT for a bad field or a meeting type that is not the council's own. Nothing is written when it rejects.
     */
    saveCadenceConfig(actorId: number, councilId: number, input: CadenceConfigInput): Promise<CouncilCadenceConfig>;
    /**
     * Removes one of the council's cadences (Sprint 5Z-6). The meetings it laid down stay on the calendar. Same keepers
     * as populateAnnualCadence. Rejects RECORD_NOT_FOUND for a config that is not the council's.
     */
    removeCadenceConfig(actorId: number, councilId: number, configId: number): Promise<void>;
    /**
     * The motions queued for a meeting's floor (ProposedMotion, Sprint 5Z-6) with their presenters' names, in the order
     * they were added (id). Readable by every member, like the meeting itself. Rejects MEETING_NOT_FOUND for an
     * unknown meeting.
     */
    listProposedMotions(meetingId: number): Promise<ProposedMotionDetail[]>;
    /**
     * Sprint 5Z-9 live assembly. The console is run by the meeting's chair: its Active owner, an Active Admin or officer
     * of its council, or an Active Super Admin (assertMayRunLiveAssembly; ADMIN_REQUIRED, COUNCIL_ACCESS_DENIED). Every
     * method rejects MEMBER_NOT_FOUND for an unknown actor and MEETING_NOT_FOUND for an unknown meeting.
     *
     * Starts the live console: IsLiveInProgress becomes 1 and the council's Active roster count is locked into
     * LiveQuorumRosterCount, the base for the quorum check. Calling it on a meeting already live changes nothing and
     * keeps the locked count. Resolves to the state the console boots with.
     */
    startLiveAssemblyConsole(actorId: number, meetingId: number): Promise<LiveAssemblyState>;
    /**
     * Pushes a new topic to the center bar: ActiveAgendaItemName, the allotted minutes (ActiveAgendaItemTimeRemaining)
     * and ActiveAgendaItemStartedAt now, which every phone following getLiveAssemblyState counts down from. Rejects
     * LIVE_ASSEMBLY_CONFLICT unless the meeting is live, and INVALID_INPUT for a blank name or one over
     * LIVE_AGENDA_ITEM_NAME_MAX_LENGTH characters, or minutes that are not a whole number from 1 to
     * LIVE_AGENDA_ITEM_MAX_MINUTES.
     */
    advanceActiveAgendaItem(
      actorId: number,
      meetingId: number,
      itemName: string,
      allottedMinutes: number,
      /**
       * Sprint 6B Patch: options.lineKey names the agenda line being put on the floor (an AgendaLineView.key of the
       * meeting's agenda, stored in Meeting.ActiveAgendaLineKey); omitted or null for a typed-in topic. Rejects
       * INVALID_INPUT for a key that is not 'item:N', 'motion:N' or 'event:N'.
       */
      options?: { lineKey?: string | null },
    ): Promise<LiveAssemblyState>;
    /**
     * Checks `memberId` in to the live meeting (LiveAttendance), whatever they answered to the invitation: a member taps
     * 'Broadcast Active Assembly Feed' to check themselves in (actorId = memberId), or the chair checks someone in. The
     * member's invitation is marked Attended and Accepted, created if they had none, so the meeting counts toward their
     * hours. Checking in twice returns the first check-in. The member must be Active and of the meeting's council
     * (NOT_ACTIVE_COUNCIL_MEMBER); anyone else checking a member in must run the console. Rejects LIVE_ASSEMBLY_CONFLICT
     * unless the meeting is live.
     */
    logLiveAttendanceOverride(actorId: number, meetingId: number, memberId: number): Promise<LiveAttendance>;
    /**
     * Opens the motion's secret smartphone ballot (BallotOpenedAt now): every member checked in sees it on
     * getLiveAssemblyState and may vote. Rejects RECORD_NOT_FOUND for an unknown motion, MOTION_STATUS_CONFLICT unless
     * its VoteResult is 'Pending', LIVE_ASSEMBLY_CONFLICT unless its meeting is live, and BALLOT_STATE_CONFLICT when its
     * ballot is already open or another motion of the meeting has a ballot open.
     */
    launchSecretSmartphoneBallot(actorId: number, proposedMotionId: number): Promise<LiveAssemblyState>;
    /**
     * Casts `actorId`'s secret ballot and resolves to the new tally. The stored row never names the voter (see
     * BallotVote). `actorId` is required although the ballot is anonymous: only a member checked in to the meeting may
     * vote (NOT_CHECKED_IN), once per motion (BALLOT_ALREADY_CAST), and must be Active. Rejects RECORD_NOT_FOUND for a
     * motion that is not `councilId`'s, BALLOT_STATE_CONFLICT unless its ballot is open, and INVALID_INPUT for a
     * selection other than BALLOT_SELECTIONS.
     */
    castAnonymousMobileVote(actorId: number, councilId: number, motionId: number, selection: BallotSelection): Promise<BallotTally>;
    /**
     * Records the council's decision on a 'Pending' motion - Passed, Failed or Tabled - and closes its ballot, in one
     * transaction. When a smartphone ballot was held the decision must match it (VOTE_TALLY_CONFLICT): Passed needs more
     * Approve than Deny ballots, Failed no more; Tabled is always allowed. A motion carrying a charitable request records
     * the vote on the request (see MotionVoteFinalization), and a passed one joins the Financial Secretary's funding
     * queue (charities.listApprovedFundingQueue). Rejects RECORD_NOT_FOUND, MOTION_STATUS_CONFLICT unless the motion is
     * 'Pending', and INVALID_INPUT for another result.
     */
    finalizeProposedMotionVote(actorId: number, motionId: number, resultStatus: 'Passed' | 'Failed' | 'Tabled'): Promise<MotionVoteFinalization>;
    /**
     * The meeting as it runs (LiveAssemblyState) for `actorId`: any Active member of the meeting's council, or an Active
     * Super Admin (COUNCIL_ACCESS_DENIED otherwise). Phones and the console poll it.
     */
    getLiveAssemblyState(actorId: number, meetingId: number): Promise<LiveAssemblyState>;
    /**
     * Ends the live console: IsLiveInProgress 0 and the center bar cleared. The locked roster count and the check-ins
     * stay as the meeting's record. Rejects BALLOT_STATE_CONFLICT while a ballot is open (finalize it first); a meeting
     * that is not live is returned unchanged.
     */
    closeLiveAssemblyConsole(actorId: number, meetingId: number): Promise<LiveAssemblyState>;
    /**
     * Sprint 6B: the meeting's St. Mary's agenda (MeetingAgendaView), readable like the live state by any Active member
     * of its council or an Active Super Admin (COUNCIL_ACCESS_DENIED). Speakers are resolved now: a named member, else
     * the most recently seated Active holder of the item's seat in the meeting's council, else the item's label. New
     * Business also lists every motion of the meeting no item carries (in id order); Upcoming Events lists the
     * council's events ending on or after the meeting's date (buildMeetingAgendaView), each replaced by its stored
     * correction when there is one. Rejects MEETING_NOT_FOUND.
     */
    getMeetingAgenda(actorId: number, meetingId: number): Promise<MeetingAgendaView>;
    /**
     * Lays the St. Mary's blueprint (AGENDA_BLUEPRINT) onto a meeting that has no agenda items yet, each seat looked up
     * by role name. For the agenda's editors only: the council's Grand Knight or Recorder, its Admins, or a Super Admin
     * (assertMayEditLiveAgenda; AGENDA_EDITOR_REQUIRED, COUNCIL_ACCESS_DENIED). Rejects AGENDA_CONFLICT when the meeting
     * already has items. Resolves to the new agenda.
     */
    applyAgendaBlueprint(actorId: number, meetingId: number): Promise<MeetingAgendaView>;
    /**
     * A live correction to one agenda line (the agenda's editors, as applyAgendaBlueprint): the line's markdown is
     * replaced and stamped with the editor and the time. A generated motion or event line is stored as an item of its
     * section carrying the motion or event, so the correction replaces the generated text from then on. Rejects
     * INVALID_INPUT for blank text or text over AGENDA_LINE_MAX_LENGTH, and RECORD_NOT_FOUND for an item, motion or event
     * that is not this meeting's (an event must be the council's). Resolves to the new agenda.
     */
    editAgendaLine(actorId: number, meetingId: number, line: AgendaLineRef, markdown: string): Promise<MeetingAgendaView>;
    /**
     * Sprint 6B Patch: a last-minute agenda line - a blank item at the end of `section` (after any generated motion lines
     * of New Business), for the agenda's editors (assertMayEditLiveAgenda) to fill in with editAgendaLine. Every screen
     * polling the agenda shows it on its next read. Rejects INVALID_INPUT for an unknown section and MEETING_NOT_FOUND.
     */
    addAgendaLine(actorId: number, meetingId: number, section: AgendaSectionKey): Promise<AgendaLineAddition>;
    /**
     * The Recorder's hand-vote console: records a show-of-hands count on a 'Pending' motion (MotionHandTally) and decides
     * it in one transaction - more Approved than Denied is Passed, otherwise Failed (handTallyResult) - with the same
     * charitable effect as finalizeProposedMotionVote. options.transactionId links a passed motion to the general-ledger
     * posting that released its capital (a JournalEntry.TransactionID of the council). For the agenda's editors
     * (assertMayEditLiveAgenda). Rejects RECORD_NOT_FOUND for an unknown motion or posting, MOTION_STATUS_CONFLICT
     * unless the motion is 'Pending', BALLOT_STATE_CONFLICT when it went to a smartphone ballot (decide that by the
     * ballot), and INVALID_INPUT for counts that are not whole numbers from 0 to HAND_TALLY_MAX_COUNT, a count of no
     * hands at all, or a posting on a motion that failed.
     */
    recordHandBallotTally(
      actorId: number,
      motionId: number,
      approvedCount: number,
      deniedCount: number,
      options?: { transactionId?: string | null },
    ): Promise<HandTallyRecording>;
    /**
     * Links (or, with null, unlinks) the ledger posting that released a passed motion's capital, after its hand tally was
     * recorded: by the agenda's editors or the council's finance officers (assertMayPostGeneralLedger). Rejects
     * RECORD_NOT_FOUND for a motion with no hand tally or an unknown posting, and MOTION_STATUS_CONFLICT unless the
     * motion Passed.
     */
    linkHandTallyTransaction(actorId: number, motionId: number, transactionId: string | null): Promise<MotionHandTally>;
  };

  /** Shift helpers behind the automatic hour-reporting defaults (Sprint 5Y-5). */
  shifts: {
    /**
     * The shift's length in hours, StartTime to EndTime (an overnight shift runs past midnight), rounded to the
     * nearest 0.25 so it is always a valid hours entry (shiftDefaultLengthHours). The default a member's time
     * report starts from; it does not cap what they may log. Rejects SHIFT_NOT_FOUND for an unknown shift.
     */
    getShiftDefaultLength(shiftId: number): Promise<number>;
  };

  /**
   * Smartphone push alerts (Sprint 5T). Every member may register their own device and read their own alerts. Only
   * council leadership sends alerts: an Active Admin, Financial Secretary or Treasurer of the council, or any Active
   * Super Admin (SecurityPrivilegeError ADMIN_REQUIRED, COUNCIL_ACCESS_DENIED; nothing written). An unknown actor
   * rejects MEMBER_NOT_FOUND.
   */
  notifications: {
    /**
     * Saves the actor's Expo push token (ExponentPushToken[...], at most EXPO_PUSH_TOKEN_MAX_LENGTH characters) to
     * Member.ExpoPushToken; `null` or blank unregisters the device. A token another member holds is cleared from them
     * in the same transaction, so a shared phone receives only its current member's alerts. Rejects INVALID_INPUT for
     * a malformed token. Member reads never return the token.
     */
    registerDeviceToken(actorId: number, pushToken: string | null): Promise<void>;
    /** The alerts sent to the actor in the trailing ALERT_HISTORY_MONTHS (6) months, newest first. */
    listMemberAlerts(actorId: number): Promise<NotificationLog[]>;
    /**
     * Sets IsRead = 1 on one of the actor's own alerts and resolves to it; marking a read alert again changes nothing.
     * Another member's alert rejects RECORD_NOT_FOUND like an unknown id, so ids reveal nothing.
     */
    markAsRead(actorId: number, alertId: number): Promise<NotificationLog>;
    /**
     * Logs one NotificationLog row per recipient (see AlertFilters) in one transaction, then builds the Expo Push API
     * requests for recipients with a registered device and prints them with console.log (no push credentials exist
     * yet). Rejects INVALID_INPUT for an unknown council, no filter, an unknown skill, a shift that is unknown or not
     * on an event linked to the council, a blank or over-long title or body, or an unknown priority; NO_RECIPIENTS
     * when the filters match nobody.
     */
    dispatchHighPriorityAlert(actorId: number, councilId: number, filters: AlertFilters, payload: AlertPayload): Promise<AlertDispatchResult>;
  };

  /**
   * Supreme Council reporting (Sprint 5T), with the same leadership rule as notifications.dispatchHighPriorityAlert.
   * `period` picks a completed period (resolveSupremePeriod); omitted, the form's last completed one
   * (supremeReportingPeriod). A period that has not ended rejects INVALID_INPUT.
   */
  supreme: {
    /**
     * The compliance snapshot syncAlchemerReport would file, compiled the same way but neither posted nor recorded,
     * so officers can audit it first. Rejects INVALID_INPUT for an unknown council, form type or period.
     */
    previewReport(actorId: number, councilId: number, formType: SupremeFormType, period?: SupremePeriodChoice): Promise<SupremeComplianceSnapshot>;
    /**
     * Compiles the council's compliance snapshot for the period from one consistent read of its logged hours, events,
     * donations and expense checks; files it to Alchemer survey `surveyId` as an API v5 survey response (through the
     * driver's transport: a logging stub by default, the server route on the web); and records the attempt in
     * SupremeReportingSync: 'Success', or 'Failed' with `error` when the post fails. Rejects INVALID_INPUT for an
     * unknown council, form type or period, or a survey id that is not a number.
     */
    syncAlchemerReport(
      actorId: number,
      councilId: number,
      formType: SupremeFormType,
      surveyId: string,
      period?: SupremePeriodChoice,
    ): Promise<SupremeSyncResult>;
    /** The council's sync attempts, newest SyncDate first, with who ran each. Rejects INVALID_INPUT for an unknown council. */
    listSyncHistory(actorId: number, councilId: number): Promise<SupremeSyncHistoryEntry[]>;
    /**
     * Sprint 6B Patch: brings Supreme Headquarters' roster into the council's Member table. A row whose MemberNumber is
     * not yet on the council's roster becomes a new Active member (MemberType 'Member') with a placeholder login, and the
     * moment the batch is stored each new member is sent the welcome email with the app download steps and a one-time
     * setup code (MemberEnrollmentToken). A row already on the roster only has its DateJoinedCouncil brought in line;
     * the council keeps its own contact details. Invalid rows, emails already in use and member numbers repeated in
     * the batch are skipped with their reason; the rest are stored together. For the council's Active Admins and any
     * Active Super Admin (assertMayImportSupremeRoster: ADMIN_REQUIRED, COUNCIL_ACCESS_DENIED).
     */
    syncSupremeRoster(actorId: number, councilId: number, rows: readonly SupremeRosterRow[]): Promise<SupremeRosterSyncResult>;
  };

  /**
   * Officer elections (Sprint 5U). Offices are matched by Role name (elections.ts): ELECTED_ROLE_NAMES go on the
   * ballot; the trustee ladder (Trustee 1-3) rotates when the year concludes; APPOINTED_ROLE_NAMES (Financial
   * Secretary, Chaplain, Lecturer and the four directors) and vacant trustee seats are filled by the Grand Knight. A
   * seat's holder is whoever holds the role in MemberRoles, so access follows every change at once, and every change
   * is recorded in CouncilLeadershipHistory. Before each write the council's Active office holders without an open
   * history row get one (planHistoryBackfill). Writes are all or nothing; an unknown actor rejects MEMBER_NOT_FOUND,
   * an unknown council or role INVALID_INPUT.
   */
  elections: {
    /** Every council office in OFFICE_ROLE_NAMES order with its holder and, for elected seats, its ballot state. */
    listOfficerSeats(councilId: number): Promise<OfficerSeat[]>;
    /** The council's elected seats open for nomination (IsUpForElection = 1) with this term's nominees. Appointed seats never appear. */
    listBallotConfig(councilId: number): Promise<BallotSeat[]>;
    /** Appointed and trustee seats in the council that nobody holds, with whoever last left each. */
    listVacancies(councilId: number): Promise<SeatVacancy[]>;
    /**
     * Opens (`isOpen` true) or closes an elected seat for nomination and resolves to its ballot row. Closing also
     * ends a mid-year election. An Active Admin of the council or an Active Super Admin (ADMIN_REQUIRED,
     * COUNCIL_ACCESS_DENIED). Rejects ROLE_NOT_ELECTED for an appointed, trustee or non-office role.
     */
    toggleRoleBallotStatus(actorId: number, councilId: number, roleId: number, isOpen: boolean): Promise<CouncilElectionBallot>;
    /**
     * Records a nomination for the seat's current term (ballotTermYear). The actor must be an Active member of the
     * council or an Active Super Admin (COUNCIL_ACCESS_DENIED). Rejects ROLE_NOT_ELECTED for a seat that is never
     * elected, ROLE_NOT_ON_BALLOT when the seat is not open this cycle, NOMINATIONS_WINDOW_CLOSED outside May 1-31
     * and outside an open mid-year window, NOT_ACTIVE_COUNCIL_MEMBER for a nominee who is not an Active member of the
     * council, and ALREADY_NOMINATED for a repeat nomination. A Grand Knight nominee with no Deputy Grand Knight or
     * Grand Knight history row (current or past) is stored with IsEligible = 0; the nomination still counts.
     */
    submitNomination(actorId: number, councilId: number, roleId: number, nomineeMemberId: number): Promise<NominationResult>;
    /**
     * A member steps down mid-term: closes their open history row for the seat as 'Abdicated' today and takes the
     * role from them. Appointed and trustee seats stay vacant for the Grand Knight (listVacancies); an elected seat
     * goes to a mid-year election (IsUpForElection = 1, IsMidYearElection = 1, NominationsCloseAt two weeks out).
     * An Active Super Admin, an Active Admin of the council, or the member resigning their own seat (ADMIN_REQUIRED,
     * COUNCIL_ACCESS_DENIED). Rejects INVALID_INPUT for a role that is not a council office and ROLE_NOT_HELD when
     * the member does not hold it in the council.
     */
    recordOfficerAbdication(actorId: number, councilId: number, memberId: number, roleId: number): Promise<AbdicationResult>;
    /**
     * Fills a vacant appointed office or trustee seat: gives `targetMemberId` the role and opens their history row
     * with AppointedByID = actorId. Only the council's sitting Grand Knight or an Active Super Admin
     * (GRAND_KNIGHT_REQUIRED). Rejects ROLE_NOT_APPOINTED for an elected or non-office role, ROLE_OCCUPIED while
     * someone holds the seat (record their abdication first), and NOT_ACTIVE_COUNCIL_MEMBER for an appointee who is
     * not an Active member of the council.
     */
    assignAppointedRole(actorId: number, councilId: number, roleId: number, targetMemberId: number): Promise<CouncilLeadershipHistory>;
    /**
     * Ends the fraternal year (planFraternalYearConclusion). With the Grand Knight seat on the ballot the chairs rotate
     * (outgoing Grand Knight to Trustee 1, Trustee 1 to 2, 2 to 3, Trustee 3 off the board, `newGrandKnightId` to
     * Grand Knight), each departure closed 'TermConcluded' and each arrival opening a row in the new term. Off the
     * ballot every chair stays put, and a different `newGrandKnightId` rejects GRAND_KNIGHT_TERM_CONTINUES. Either way
     * the council's ballot rows are reset for the next cycle. An Active Super Admin, an Active Admin of the council or
     * its sitting Grand Knight (ADMIN_REQUIRED, COUNCIL_ACCESS_DENIED). Rejects NOT_ACTIVE_COUNCIL_MEMBER when the
     * incoming Grand Knight is not an Active member of the council.
     */
    concludeFraternalYear(actorId: number, councilId: number, newGrandKnightId: number): Promise<FraternalYearConclusion>;
  };

  /**
   * Charitable giving (Sprint 5V). GlobalCharityRegistry is shared by every council; a council connects to entries
   * through CouncilCharityLink. Members propose gifts, and a finance officer settles a proposal by paying it into
   * CharitableDisbursementLedger, which reports.monthlySummary counts as spend. A charity is a duplicate of an entry
   * with the same EIN or, when either EIN is missing, the same Name and State ignoring case (findRegisteredCharity).
   * Writes are all or nothing; an unknown actor rejects MEMBER_NOT_FOUND, an unknown council INVALID_INPUT.
   */
  charities: {
    /**
     * Registry entries matching every given filter, Name A-Z (ignoring case), then State and id. Open to every member.
     * Rejects INVALID_INPUT for a state that is not two letters, an EIN that is not nine digits, or a bad limit.
     */
    searchGlobalRegistry(actorId: number, filters?: CharitySearchFilters): Promise<GlobalCharityRegistry[]>;
    /**
     * Registry entries in `stateCode` the council is not yet connected to: Catholic charities first, then Name A-Z.
     * The council's own members or an Active Super Admin (COUNCIL_ACCESS_DENIED). Rejects INVALID_INPUT for a state
     * code that is not two letters.
     */
    listSuggestedLocal(actorId: number, councilId: number, stateCode: string): Promise<GlobalCharityRegistry[]>;
    /**
     * Connects the council to a registry entry and resolves to the link. Idempotent: an existing link is returned
     * unchanged. Council leadership: an Active Admin, Financial Secretary or Treasurer of the council, or an Active
     * Super Admin (ADMIN_REQUIRED, COUNCIL_ACCESS_DENIED). Rejects RECORD_NOT_FOUND for an unknown charity.
     */
    connectCouncilToCharity(actorId: number, councilId: number, charityId: number): Promise<CouncilCharityLink>;
    /**
     * Records a 'Pending' gift proposal from the actor. Any Active member of the council, or an Active Super Admin
     * (COUNCIL_ACCESS_DENIED). Rejects INVALID_INPUT for an amount of 0 or with fractions of a cent, a name over 255
     * characters, or neither a name nor a charity; RECORD_NOT_FOUND for an unknown ExistingCharityID.
     */
    proposeDonation(actorId: number, councilId: number, data: CharityProposalInput): Promise<CharityDonationProposal>;
    /**
     * Adds a charity to the global registry. An Active Admin or Super Admin (ADMIN_REQUIRED). Rejects
     * CHARITY_ALREADY_REGISTERED (details.charityId names the entry) for a duplicate, and INVALID_INPUT for a bad field.
     */
    addGlobalCharity(actorId: number, globalCharityData: NewGlobalCharity): Promise<GlobalCharityRegistry>;
    /**
     * Pays a 'Pending' proposal in one transaction: resolves the charity (from `globalCharityData` when given - an
     * existing duplicate is reused with its blank fields filled in, otherwise the entry is registered - else from the
     * checkDetails.CharityID, else the proposal's ExistingCharityID), connects the council to it, writes the ledger row
     * with DisbursedByID = actorId and ProposalID = proposalId,
     * and marks the proposal 'Approved' with ExistingCharityID set. The council's Active Financial Secretary or
     * Treasurer, or an Active Super Admin (FINANCE_OFFICER_REQUIRED, COUNCIL_ACCESS_DENIED). Rejects RECORD_NOT_FOUND for
     * a proposal outside the council or an unknown CharityID, PROPOSAL_STATUS_CONFLICT for one no longer 'Pending',
     * INVALID_INPUT when no charity can be resolved, for both CharityID and `globalCharityData`, for a bad field, a meeting outside the council, or a check number the council already
     * used on any check (charity or expense); INVALID_DATE for a malformed payout date.
     */
    hydrateAndDisburse(
      actorId: number,
      councilId: number,
      proposalId: number,
      checkDetails: CharityCheckDetails,
      globalCharityData?: NewGlobalCharity,
    ): Promise<CharityDisbursementResult>;
    /** The actor's own proposals in every status, newest (highest id) first. Open to every member. */
    listMyProposals(actorId: number): Promise<CharityProposalDetail[]>;
    /**
     * The council's proposals in every status: 'Pending' first (oldest first, the payout queue), then the rest newest
     * first. Council leadership: an Active Admin, Financial Secretary or Treasurer of the council, or an Active Super
     * Admin (ADMIN_REQUIRED, COUNCIL_ACCESS_DENIED).
     */
    listCouncilProposals(actorId: number, councilId: number): Promise<CharityProposalDetail[]>;
    /** The charities the council is connected to, Name A-Z, each with its checks. Council leadership, as above. */
    listCouncilLedger(actorId: number, councilId: number): Promise<CouncilCharityLedgerEntry[]>;
    /**
     * Rejects a 'Pending' proposal: Status 'Rejected' and RejectionReason the trimmed `reason`. Council leadership of
     * the proposal's council, as above. Rejects INVALID_INPUT for a blank reason or one over
     * REJECTION_REASON_MAX_LENGTH characters, RECORD_NOT_FOUND for an unknown proposal, PROPOSAL_STATUS_CONFLICT for one
     * no longer 'Pending'.
     */
    rejectProposal(actorId: number, proposalId: number, reason: string): Promise<CharityProposalDetail>;
    // ---- normalized charitable intake and the shared vetting desk (Sprint 5Z-1) ----
    /**
     * The relationship types the council defines for itself (CouncilRelationshipType), by RelationshipName then id.
     * Rejects INVALID_INPUT for an unknown council.
     */
    listCouncilRelationshipTypes(councilId: number): Promise<CouncilRelationshipType[]>;
    /**
     * The council's mission areas (CouncilMissionArea), by MissionAreaName then id. Rejects INVALID_INPUT for an
     * unknown council.
     */
    listCouncilMissionAreas(councilId: number): Promise<CouncilMissionArea[]>;
    /**
     * The council's shared vetting queue: every intake request in pipeline order - 'Submitted', then 'Claimed by
     * Trustee', then 'Advanced' - oldest SubmittedAt first within each stage, then id. For anyone with vetting
     * authority: an Active officer (a Role with Officer = 1, Trustees included) or Admin of the council, or an Active
     * Super Admin (VETTING_AUTHORITY_REQUIRED, COUNCIL_ACCESS_DENIED).
     */
    listCharitableRequestsQueue(actorId: number, councilId: number): Promise<CharitableRequestDetail[]>;
    /**
     * A Knight Shepherd files a completed intake form into the shared queue of their own council: RequestStatus
     * 'Submitted', ShepherdMemberID = actorId, VoteStatus 'Pending', AmountApproved 0.00, SubmittedAt now. Any Active
     * member (COUNCIL_ACCESS_DENIED). Rejects INVALID_INPUT for a missing organization name, an amount of 0 or with
     * fractions of a cent, a bad EIN, email or tier, an unknown field or a RelationshipTypeID or MissionAreaID outside
     * the council;
     * INVALID_DATE for a malformed FundsNeededBy.
     */
    submitCharitableRequest(actorId: number, requestData: NewCharitableRequest): Promise<CharitableRequestDetail>;
    /**
     * Sprint 5Z-Member-Charity: the intake requests the actor shepherds (ShepherdMemberID = actorId) in every status,
     * newest (highest id) first, for the Propose Charity Grant page's tracking table. Open to every member; rejects
     * MEMBER_NOT_FOUND for an unknown actor.
     */
    listMyCharitableRequests(actorId: number): Promise<CharitableRequestDetail[]>;
    /**
     * Claims, annotates, advances or declines (Sprint 5Z-2) a request (CharitableTriageInput). Vetting authority of the request's council, as
     * for listCharitableRequestsQueue, and independent of the request: its Shepherd may never vet it
     * (SELF_VETTING_BLOCKED, Super Admins included). Only the claiming vetter, or an Active Admin of the council or
     * Super Admin, may annotate or advance a claimed request. Rejects RECORD_NOT_FOUND for an unknown request,
     * REQUEST_STATUS_CONFLICT when the action does not fit the request's stage or another officer holds the claim,
     * INVALID_INPUT for an unknown action, notes over CHARITABLE_VETTING_NOTES_MAX_LENGTH characters, a bad tier or a
     * TargetBudgetLineID that is not a budget line of the request's council.
     */
    triageRequestStatus(actorId: number, requestId: number, vettingData: CharitableTriageInput): Promise<CharitableRequestDetail>;
    /**
     * Sprint 5Z-9: the council's charitable requests the council voted to fund (VoteStatus 'Approved', through
     * meetings.finalizeProposedMotionVote) that no check has paid yet (PaymentOrderId null), in request order - the
     * Financial Secretary's funding queue. Read by the council's leadership as on the expense audit desk
     * (assertMayAuditCouncilExpenses: its Admins, Financial Secretary and Treasurer, any Active Super Admin).
     */
    listApprovedFundingQueue(actorId: number, councilId: number): Promise<CharitableRequest[]>;
    /**
     * Puts a vetted request on the council floor (Sprint 5Z-5): finds the request council's soonest Monthly meeting
     * (a Meeting whose MeetingTypeID is the council's CouncilMeetingType named MONTHLY_MEETING_TYPE_NAME) dated at
     * least AGENDA_NOTICE_DAYS days after today - the 10-day rule - and adds a ProposedMotion to it: SourceType
     * 'CharitableRequest', SourceRecordID = requestId, MotionText charitableMotionText(request), presented by the
     * request's Knight Shepherd, AllocatedMinutes PROPOSED_MOTION_DEFAULT_MINUTES, VoteResult 'Pending'. Vetting
     * authority of the request's council, as for listCharitableRequestsQueue, and independent of the request
     * (SELF_VETTING_BLOCKED for its Shepherd). Rejects MEMBER_NOT_FOUND for an unknown actor, RECORD_NOT_FOUND for an
     * unknown request, REQUEST_STATUS_CONFLICT unless the request is 'Advanced' with VoteStatus 'Pending' or when a
     * 'Pending' motion already carries it, and NO_ELIGIBLE_MEETING when no Monthly meeting satisfies the 10-day rule.
     * Nothing is written when it rejects.
     */
    routeRequestToNextEligibleAgenda(actorId: number, requestId: number): Promise<AgendaRoutingResult>;
  };

  /**
   * Annual budget forecasting (Sprint 5Y): one CouncilBudgetForecast row per budget line of a council's fraternal year
   * ('YYYY-YYYY', July 1 - June 30). Every Active member of the council may read it (Sprint 5Y-3 transparency;
   * assertMayViewBudgetForecast: COUNCIL_ACCESS_DENIED). Writes are for council leadership - an Active Admin, Financial
   * Secretary or Treasurer of the council, or its Active Designated Budget Director (Member.IsBudgetDirector) - or an
   * Active Super Admin for any council (assertMayManageBudgetForecast: ADMIN_REQUIRED, COUNCIL_ACCESS_DENIED). Writes are
   * accepted only from May 1 through June 30 before the year starts (assertBudgetYearWritable): earlier they reject
   * BUDGET_WINDOW_NOT_OPEN, from July 1 BUDGET_YEAR_FINALIZED, unless an Active Super Admin passes superAdminOverride.
   * Rows are always read and written for one council; nothing crosses councils. Writes are all or nothing; an unknown
   * actor rejects MEMBER_NOT_FOUND, an unknown council INVALID_INPUT, a fraternal year that is not 'YYYY-YYYY' with
   * consecutive years INVALID_INPUT, a BudgetCategoryID that is not one of the council's categories INVALID_INPUT.
   */
  budget: {
    /**
     * The council's year: its budget categories and its lines (AnnualBudgetForecast). The lines are empty before the
     * year is pre-populated or given custom lines. Any Active member of the council, or an Active Super Admin.
     */
    listAnnualForecast(actorId: number, councilId: number, fraternalYear: string): Promise<AnnualBudgetForecast>;
    /**
     * Sets a line's ProposedBudgetAmount (Sprint 5Y-4; BudgetStatus becomes 'Proposed') and, unless `notes` is
     * undefined, its Notes (blank or null clears them), and with options.budgetCategoryId its category; resolves to the
     * stored line. ApprovedBudgetAmount is never set here. Writers of the line's council. Rejects RECORD_NOT_FOUND for an
     * unknown line, BUDGET_YEAR_APPROVED once the year is approved, BUDGET_WINDOW_NOT_OPEN / BUDGET_YEAR_FINALIZED
     * outside the drafting window, and INVALID_INPUT for a negative amount, one with fractions of a cent, notes over
     * BUDGET_NOTES_MAX_LENGTH characters or another council's category.
     */
    updateLineItemBudget(
      actorId: number,
      budgetLineItemId: number,
      proposedAmount: number,
      notes?: string | null,
      options?: BudgetLineUpdateOptions,
    ): Promise<CouncilBudgetForecast>;
    /**
     * Adds a council-specific 'Operational' line (NewCustomBudgetLine) and resolves to it. Rejects BUDGET_LINE_EXISTS
     * (details.lineId names it) when the council's year already has an Operational line of that name ignoring case and
     * spacing, BUDGET_YEAR_APPROVED once the year is approved, BUDGET_WINDOW_NOT_OPEN / BUDGET_YEAR_FINALIZED outside
     * the drafting window, and INVALID_INPUT for a bad field (including ApprovedBudgetAmount, which only approval sets).
     */
    addCustomBudgetLine(actorId: number, councilId: number, data: NewCustomBudgetLine, options?: BudgetWriteOptions): Promise<CouncilBudgetForecast>;
    /**
     * Seeds the council's forecast for `targetFraternalYear` from the previous fraternal year's actual spend, in one
     * transaction (planBudgetPrePopulation). Spend counts as in reports.monthlySummary: an event's Spend plus the line
     * items of the council's 'Approved' and 'Reimbursed' expense sheets, and the council's charity checks.
     * - Event: one line per IsAnnual event linked to the council that started in the previous year - its Spend plus
     *   the council's expenses linked to it. ReferenceSourceID is the event.
     * - Donation: one line per IsAnnual charity the council paid in the previous year (by PayoutDate) - the sum of those
     *   checks. ReferenceSourceID is the charity.
     * - Operational: one 'Council Meetings' line (BUDGET_MEETINGS_LINE_NAME) when the council met in the previous
     *   year - the council's expenses linked to those meetings.
     * - Operational: each custom line of the previous year's own forecast (Sprint 5Y-2), carried forward under the same
     *   name with a PrePopulatedAmount of that line's ApprovedBudgetAmount - last year's approved cap (Sprint 5Y-6.5; 0
     *   when last year was never approved) - so the council's own running costs keep their funding level.
     * Re-running is safe: a line that already exists keeps its figures, BudgetStatus and Notes and only has its
     * PrePopulatedAmount (and a renamed source's LineItemName) refreshed. New lines start 'Draft' with proposed and
     * approved amounts of 0 for review. Nothing is deleted. A new line takes the BudgetCategoryID of the previous year's line it continues (same
     * source, or for an unsourced line the same name), so the council files each line once. Rejects BUDGET_YEAR_APPROVED
     * once the target year is approved, and BUDGET_WINDOW_NOT_OPEN or BUDGET_YEAR_FINALIZED when it is outside its
     * drafting window.
     */
    prePopulateNextYear(actorId: number, councilId: number, targetFraternalYear: string, options?: BudgetWriteOptions): Promise<BudgetPrePopulationResult>;
    /**
     * The dual prior-year baseline beside each line of the council's year (Sprint 5Y-6.5; buildPriorYearBaselines): the
     * previous year's approved cap for the line it continues and the previous year's whole-year actual spend charged to
     * the line. Read by whoever may read the budget (assertMayViewBudgetForecast: every Active member of the council, any
     * Active Super Admin; COUNCIL_ACCESS_DENIED otherwise). Rejects MEMBER_NOT_FOUND for an unknown actor and
     * INVALID_INPUT for a malformed year or an unknown council.
     */
    getPriorYearBaselines(actorId: number, councilId: number, fraternalYear: string): Promise<BudgetPriorYearBaselines>;
    /**
     * Records the council's vote (Sprint 5Y-4), usually at its July meeting: in one transaction every line of the
     * council's year gets ApprovedBudgetAmount = ProposedBudgetAmount and BudgetStatus 'Approved', and resolves to the
     * year as listAnnualForecast returns it. From then on the year is frozen - every write rejects BUDGET_YEAR_APPROVED,
     * with no override. Council leadership only - an Active Admin, Financial Secretary or Treasurer of the council, or an
     * Active Super Admin (assertMayApproveBudget: ADMIN_REQUIRED, COUNCIL_ACCESS_DENIED); the Budget Director prepares
     * but does not approve. Allowed from the year's May 1 opening on, including after the July 1 lock. Rejects
     * BUDGET_YEAR_APPROVED for an approved year, INVALID_INPUT for a year with no lines, and BUDGET_WINDOW_NOT_OPEN before
     * May 1 unless an Active Super Admin passes superAdminOverride.
     */
    approveAndFinalizeEntireBudget(actorId: number, councilId: number, fraternalYear: string, options?: BudgetWriteOptions): Promise<AnnualBudgetForecast>;
    /**
     * The council's year against its actual spend so far (BudgetYearPerformance), through today or the year's June 30
     * once it has ended; before July 1 of the year nothing has been spent. Behind the dashboard's budget gauges.
     * Council leadership, as on the executive summaries (assertMayReviewBudgetPerformance).
     */
    getBudgetProgress(actorId: number, councilId: number, fraternalYear: string): Promise<BudgetYearPerformance>;
    /**
     * Every completed fraternal year (ended before today) the council has budget lines for, newest first, each with its
     * final allocations against its full-year actual spend, and the trailing fiscal efficiency scorecard over the
     * approved years (summarizeBudgetHistory). Council leadership, as getBudgetProgress.
     */
    getHistoricalKPIs(actorId: number, councilId: number): Promise<BudgetHistoricalKPIs>;
  };

  /**
   * The council's double-entry general ledger (Sprint 5Z-7): its chart of accounts (GLAccount) and the journal lines
   * posted against it (JournalEntry). Every posting balances - its debits equal its credits to the cent - so the
   * balance sheet always balances. Reads belong to the executive dashboard's audience (assertMayReadGeneralLedger: the
   * council's Active Admins and officers, any Active Super Admin); postings and reconciliation to its finance officers
   * (assertMayPostGeneralLedger: an Active Financial Secretary or Treasurer of the council, or an Active Super Admin;
   * FINANCE_OFFICER_REQUIRED). Nothing crosses councils. Writes are all or nothing; an unknown actor rejects
   * MEMBER_NOT_FOUND, an unknown council INVALID_INPUT.
   */
  finance: {
    /**
     * The council's chart of accounts as a hierarchy (ChartOfAccounts): asset accounts with their virtual goals and the
     * physical property account, liabilities, equity, revenue and expense accounts, each with its posted balance.
     */
    listChartOfAccounts(actorId: number, councilId: number): Promise<ChartOfAccounts>;
    /**
     * Posts one balanced transaction atomically and resolves to its stored lines, in the order given (cleanJournalLines).
     * Since Sprint 5Z-8 every line carries the same freshly generated TransactionID (a UUID), as do a transfer's two.
     * Rejects INVALID_INPUT for fewer than two lines or more than JOURNAL_MAX_LINES, a line with both or neither amount,
     * an amount below 0 or with fractions of a cent, a blank or over-long description or check number, a malformed
     * date, an unknown account, accounts of more than one council, or a linked event or meeting outside that council;
     * and UNBALANCED_TRANSACTION (details: debits, credits, difference) when the debits do not equal the credits.
     */
    logDoubleEntryTransaction(actorId: number, linesData: readonly JournalLineInput[]): Promise<JournalEntry[]>;
    /**
     * Moves `amount` between two Asset accounts of one council as a balanced pair of lines: a debit to the target and a
     * credit to the source (planAssetTransfer). Funding or releasing a virtual goal is a transfer with its parent
     * account. Rejects INVALID_INPUT for the same account twice, an account that is not an Asset or belongs to another
     * council, or an amount that is not above 0 in whole cents, and INSUFFICIENT_FUNDS when the source's own balance is
     * below `amount` (a transfer never overdraws an account).
     */
    transferAssetFunds(
      actorId: number,
      sourceAccountId: number,
      targetAccountId: number,
      amount: number,
      options?: AssetTransferOptions,
    ): Promise<JournalEntry[]>;
    /**
     * The council's balance sheet from every posted entry (BalanceSheet): total assets, physical property included,
     * against liabilities plus equity and the current surplus, compared to the penny.
     */
    getLatestBalanceSheet(actorId: number, councilId: number): Promise<BalanceSheet>;
    /**
     * Sprint 5Z-8: every line posted to one account, oldest first (by DateLogged, then id), each with the account's
     * running balance and every line of its posting (buildAccountLedger) - the ledger spreadsheet's drill-down. Read by
     * whoever reads the account's council books (assertMayReadGeneralLedger). Rejects RECORD_NOT_FOUND for an unknown
     * account.
     */
    getAccountLedger(actorId: number, glAccountId: number): Promise<AccountLedger>;
    /**
     * Sprint 6B: the council's postings, newest first (by DateLogged, then TransactionID), each summed
     * (LedgerTransactionSummary), at most options.limit (default 50) - the hand-vote console's capital-release picker.
     * Read by whoever reads the council's books (assertMayReadGeneralLedger).
     */
    listLedgerTransactions(actorId: number, councilId: number, options?: { limit?: number }): Promise<LedgerTransactionSummary[]>;
    /**
     * Reads a bank statement CSV (parseBankStatementCsv) and flags each journal entry it matches IsBankReconciled, in
     * one transaction (matchBankStatement). A deposit matches a debit of the same amount and a withdrawal a credit,
     * among the council's unreconciled entries on its non-virtual Asset accounts (or on options.glAccountId alone). A
     * row with a check number matches only an entry with that check number; any other row matches the entry dated
     * closest to it within BANK_MATCH_WINDOW_DAYS. Each entry is matched once. Rows that match nothing are returned,
     * not rejected. Rejects INVALID_INPUT for a file without a Date column and an Amount (or Withdrawal and Deposit)
     * column, a malformed date or amount, no data rows, more than BANK_STATEMENT_MAX_ROWS rows, or an
     * options.glAccountId that is not a non-virtual Asset account of the council.
     */
    uploadBankStatementReconciliation(
      actorId: number,
      csvFileData: string,
      options?: BankReconciliationOptions,
    ): Promise<BankReconciliationResult>;
  };

  feedback: {
    /**
     * Saves a feedback or bug report from `memberId`, stamped SubmittedAt now. Rejects MEMBER_NOT_FOUND for an
     * unknown member and INVALID_INPUT for empty text or text over FEEDBACK_MAX_LENGTH characters.
     */
    submit(memberId: number, text: string): Promise<SystemFeedback>;
    /** Every report, newest first, with its sender. Only an Active Super Admin may read it (SUPER_ADMIN_REQUIRED). */
    listInbox(actorId: number): Promise<FeedbackInboxEntry[]>;
  };

  messages: {
    /** Newest first. Keyset pagination on CreatedAt (Schema.sql reference query "messages.getPage"). */
    getPage(threadId: number, options?: MessagePageOptions): Promise<Message[]>;
    /** Creates one unread ReadReceipt per distribution-list member. Resolves to the number created. */
    createReadReceiptStubs(messageId: number, listId: number): Promise<number>;

    /**
     * Threads the member sent to or received from, most recent activity first. Threads have no
     * participant table: a member takes part when they sent a message or hold a read receipt.
     */
    listThreads(memberId: number): Promise<ThreadSummary[]>;
    /** Every message of the thread the member may see, oldest first: sent messages plus the member's own drafts. */
    listThread(threadId: number, memberId: number): Promise<ThreadMessage[]>;
    /**
     * Sends a message (or a saved draft) and creates an unread receipt for every other participant, or for
     * `recipientIds` when it starts a new thread. Rejects INVALID_INPUT for empty text.
     */
    send(input: SendMessageInput): Promise<Message>;
    /** Creates or updates the member's unsent draft. */
    saveDraft(input: SaveDraftInput): Promise<Message>;
    deleteDraft(messageId: number, memberId: number): Promise<void>;
    /** Marks a message read (`ReadAt` set) or unread (`ReadAt: null`) for the member. */
    setRead(messageId: number, memberId: number, read: boolean): Promise<ReadReceipt>;
  };
}
