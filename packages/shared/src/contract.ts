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
  Degree,
  Event,
  EventSignup,
  EventTime,
  LessonsLearned,
  LessonsLearnedCategory,
  Meeting,
  MeetingInvites,
  MeetingType,
  Member,
  MemberStatus,
  MemberType,
  Message,
  MessageAttachment,
  NoShowReason,
  ReadReceipt,
  Role,
  Shift,
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

// 6. THE SERVICE
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
     * 3 months in the past (SHIFT_REPORT_TOO_OLD).
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
    /** Points the meeting at its uploaded minutes; `null` removes them. */
    setMinutes(meetingId: number, minutesUrl: string | null): Promise<Meeting>;
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
