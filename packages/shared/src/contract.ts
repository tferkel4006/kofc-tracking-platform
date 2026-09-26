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
  Donation,
  DonationMethod,
  DonationType,
  Event,
  EventSignup,
  EventTime,
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
  ReadReceipt,
  Role,
  Shift,
  Skill,
  SkillLevel,
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
/** A meeting row without its generated id. */
export type NewMeeting = Omit<Meeting, 'id'>;

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
/** An event row without its generated id. */
export type NewEvent = Omit<Event, 'id'>;
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
 * standalone donation. For 'Physical Items', DonationAmount is the estimated value.
 */
export type NewDonation = Omit<Donation, 'id' | 'DonationDate'> & { DonationDate?: string };

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

// 9. THE SERVICE
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

  lookups: {
    /** All rows of one lookup table, ordered by id. */
    list<T extends LookupTableName>(table: T): Promise<LookupRowMap[T][]>;
    /**
     * Adds a row. Rejects (INVALID_INPUT) when a field is missing, too long or malformed, or when the
     * table's key value (e.g. Role.Role) already exists, compared case-insensitively.
     */
    create<T extends LookupTableName>(table: T, values: LookupValues): Promise<LookupRowMap[T]>;
    /** Changes a row's fields. Protected values the app depends on ('Active', the three member types) cannot be renamed. */
    update<T extends LookupTableName>(table: T, id: number, values: LookupValues): Promise<LookupRowMap[T]>;
    /** Deletes a row nothing references (LOOKUP_IN_USE otherwise) and that is not protected (LOOKUP_PROTECTED). */
    remove(table: LookupTableName, id: number): Promise<void>;
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
  };

  activities: {
    /** The council's activities, ordered by name. Activities are never shared with affiliated councils. */
    listByCouncil(councilId: number): Promise<Activities[]>;
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
     */
    create(member: NewMember): Promise<Member>;
  };

  memberProfiles: {
    /** The member's working status, skills and training, with lookup names resolved. */
    getExtensions(memberId: number): Promise<MemberExtensions>;
    /**
     * Self-service replace of a member's skills, training classes and working status, all or nothing.
     * `skills` and `training` are the complete new lists (an empty array clears them); `workingStatusId`
     * null clears the status. Rejects MEMBER_NOT_FOUND, or INVALID_INPUT for an unknown lookup id, a skill
     * listed twice, the same class twice in one year, or a year outside 1882..this year.
     */
    updateExtensions(
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
    /** The council's own donation types, ordered by name. */
    listTypes(councilId: number): Promise<DonationType[]>;
    /** The council's donations, newest first; with `eventId`, only that event's. */
    list(councilId: number, options?: { eventId?: number }): Promise<Donation[]>;
    /**
     * Records a cash, credit card, QR (Venmo/Zelle/Zeffy/Parishsoft) or physical-item donation.
     * Rejects INVALID_INPUT for a bad field, a future date, an amount of 0, a type from another council,
     * an event not linked to the council, or a physical item without a description; and
     * DONATION_METHOD_NOT_ENABLED when the council has not enabled the method.
     */
    record(donation: NewDonation): Promise<Donation>;
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

    /** Events linked to the council, newest StartDate first. */
    listByCouncil(councilId: number): Promise<Event[]>;
    listShifts(eventId: number): Promise<Shift[]>;
    /** Ids of every council the event is linked to. */
    listCouncilIds(eventId: number): Promise<number[]>;
    /** Creates an event linked to `councilIds` (at least one). Rejects INVALID_INPUT on any bad field. */
    create(event: NewEvent, councilIds: number[]): Promise<Event>;
    /** Changes event fields, including the post-event ledger (Spend, funds raised, attendance, Highlights). */
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
    add(eventId: number, categoryId: number, description: string): Promise<LessonsLearned>;
    remove(id: number): Promise<void>;
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
    create(meeting: NewMeeting, invite?: MeetingInviteMode): Promise<Meeting>;
    listInvites(meetingId: number): Promise<MeetingInvites[]>;
    /** Adds invitations, skipping members already invited. Resolves to the number newly invited. */
    invite(meetingId: number, memberIds: number[]): Promise<number>;
    /** Rejects if the member was never invited to the meeting. */
    setAttended(meetingId: number, memberId: number, attended: boolean): Promise<void>;
    /** Points the meeting at its uploaded minutes; `null` removes them (stored as '', since the column is NOT NULL). */
    setMinutes(meetingId: number, minutesUrl: string | null): Promise<Meeting>;
    /**
     * Meeting hours for a member: every invitation marked Attended = 1, each worth its meeting's
     * Time End - Time Start, oldest first with a running total. Optional inclusive date range.
     */
    memberHours(memberId: number, range?: { fromDate?: string; toDate?: string }): Promise<MemberMeetingHours>;
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
