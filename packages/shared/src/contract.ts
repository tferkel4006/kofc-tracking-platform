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
  ChatThread,
  Council,
  CouncilDonationMethod,
  Degree,
  DistributionLists,
  Donation,
  DonationMethod,
  DonationType,
  Event,
  EventSignup,
  EventTime,
  ExpenseDisbursement,
  ExpenseLineItem,
  ExpenseReport,
  LessonsLearned,
  LessonsLearnedCategory,
  Meeting,
  MeetingInvites,
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
  Parish,
  Pastor,
  ReadReceipt,
  Role,
  Shift,
  Skill,
  SkillLevel,
  SystemFeedback,
  WorkingStatus,
} from './types';

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
export type CouncilLookupTableName = 'Activities' | 'DonationType' | 'CouncilDonationMethod';

export interface CouncilLookupRowMap {
  Activities: Activities;
  DonationType: DonationType;
  CouncilDonationMethod: CouncilDonationMethod;
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
export type NewEvent = Omit<Event, 'id' | 'PhotoGalleryURL'>;
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

// 9. COUNCIL-LEVEL MAINTENANCE (Sprint 5G)
/** A council row without its generated id. */
export type NewCouncil = Omit<Council, 'id'>;
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
}

/** A list keeps its council for life; omit `memberIds` to keep the members, pass [] to clear them. */
export interface DistributionListChanges {
  ListName?: string;
  memberIds?: number[];
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
   * (Sprint 5R-1.5). spend = eventSpend + expenses, and net = raised - spend.
   */
  finances: { spend: number; eventSpend: number; expenses: number; cash: number; electronic: number; raised: number; net: number };
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
/** One item on a calendar grid: an event (all-day, possibly spanning days) or a meeting (one day, timed). */
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
      /** The meeting's Date; a meeting starts and ends on the same day. */
      startDate: string;
      endDate: string;
      /** HH:MM:SS */
      startTime: string;
      endTime: string;
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
}

export interface ExpenseDisbursementResult {
  disbursement: ExpenseDisbursement;
  /** The sheets it paid, now 'Reimbursed', in the order their ids were given. */
  reports: ExpenseReportDetail[];
}

// 15. THE SERVICE
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
     */
    signUp(email: string, password: string): Promise<SessionUser>;
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

  distributionLists: {
    /** The council's lists with their members, ordered by name. */
    listByCouncil(councilId: number): Promise<DistributionListSummary[]>;
    /**
     * Creates a list owned by the actor (CreatedBy) with its members, all or nothing. Rejects INVALID_INPUT
     * for a bad name, a name already used in the council (ignoring case), or a member who does not exist or
     * belongs to another council.
     */
    create(actorId: number, list: NewDistributionList): Promise<DistributionListSummary>;
    /** Renames the list and/or replaces its members, all or nothing, validated as in `create`. */
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
   * reads the council's queue and approves or returns sheets (SecurityPrivilegeError ADMIN_REQUIRED,
   * COUNCIL_ACCESS_DENIED). Only the council's Financial Secretary or Treasurer, or an Active Super Admin, records
   * the checks that pay them (FINANCE_OFFICER_REQUIRED, Sprint 5S). Nobody approves or pays a sheet they submitted,
   * whatever their role. An unknown actor rejects MEMBER_NOT_FOUND. Every write is all or nothing: a rejected call
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
     * Moves a 'Submitted' sheet to 'Approved' (council leadership only). Nobody may approve their own sheet, a
     * Super Admin included (SELF_APPROVAL_BLOCKED, no override since Sprint 5S). Rejects RECORD_NOT_FOUND for an unknown sheet
     * and EXPENSE_STATUS_CONFLICT for one in another status.
     */
    approveReport(actorId: number, reportId: number): Promise<ExpenseReportDetail>;
    /**
     * Returns a 'Submitted' sheet to its submitter (council leadership only): Status goes back to 'Draft' and
     * RejectionReason keeps the trimmed `rejectionReason`, so the member can edit and submit again (which clears it).
     * Rejects INVALID_INPUT for a blank reason or one over REJECTION_REASON_MAX_LENGTH characters, RECORD_NOT_FOUND
     * for an unknown sheet and EXPENSE_STATUS_CONFLICT for one in another status.
     */
    rejectReport(actorId: number, reportId: number, rejectionReason: string): Promise<ExpenseReportDetail>;
    /**
     * Records one check paying the listed sheets of `councilId` (the council's Active Financial Secretary or Treasurer,
     * or an Active Super Admin; anyone else rejects FINANCE_OFFICER_REQUIRED or COUNCIL_ACCESS_DENIED): creates the
     * ExpenseDisbursement with TotalAmount set to the sheets' total, then stamps every sheet 'Reimbursed' with its
     * DisbursementID, all in one transaction. Rejects INVALID_INPUT for an empty or repeated id list, a sheet of
     * another council, a blank or over-long check number, or a check number the council already used; INVALID_DATE for a
     * malformed payout date; RECORD_NOT_FOUND for an unknown sheet; EXPENSE_STATUS_CONFLICT for a sheet not 'Approved';
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
     * member is already signed up (ALREADY_SIGNED_UP), or NumberVolunteersSignedUp has reached
     * MinNumberVolunteers, which locks the shift (SHIFT_LOCKED).
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
     * Rejects INVALID_DATE for a malformed date and INVALID_INPUT for an unknown council or an end before the start.
     */
    listCalendarRange(councilId: number, startDate: string, endDate: string): Promise<CalendarEntry[]>;
    /**
     * Appends local photo reference paths to the event's PhotoGalleryURL (comma-separated), skipping paths it
     * already holds, and resolves to the updated event. `actorId` is the signed-in member: the event's Active owner,
     * an Active Admin, Financial Secretary or Treasurer of a council the event is linked to, or any Active Super
     * Admin (ADMIN_REQUIRED, COUNCIL_ACCESS_DENIED). Rejects MEMBER_NOT_FOUND for an unknown actor, EVENT_NOT_FOUND
     * for an unknown event, and INVALID_INPUT for an empty list, a blank path, a path containing a comma, or a
     * gallery that would exceed PHOTO_GALLERY_MAX_LENGTH characters. Nothing is written when it rejects.
     */
    uploadPhotos(actorId: number, eventId: number, photoPaths: readonly string[]): Promise<Event>;
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
     * Meetings on or after `fromDate` (default: today, local time), soonest first.
     * With `memberId`, only meetings that member is invited to.
     */
    listUpcoming(
      councilId: number,
      options?: { memberId?: number; fromDate?: string },
    ): Promise<Meeting[]>;
    /** OwnerID, when given, must name a member (INVALID_INPUT). */
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
