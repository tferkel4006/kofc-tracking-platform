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
  ActivityTime,
  Category,
  Council,
  Degree,
  Event,
  EventSignup,
  EventTime,
  LessonsLearnedCategory,
  Meeting,
  MeetingInvites,
  MeetingType,
  Member,
  MemberStatus,
  MemberType,
  Message,
  NoShowReason,
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

// 4. THE SERVICE
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
  };

  councils: {
    /** Ordered by CouncilNumber, then CouncilName (Specifications: council dropdowns). */
    list(): Promise<Council[]>;
    get(id: number): Promise<Council | null>;
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
  };

  messages: {
    /** Newest first. Keyset pagination on CreatedAt (Schema.sql reference query "messages.getPage"). */
    getPage(threadId: number, options?: MessagePageOptions): Promise<Message[]>;
    /** Creates one unread ReadReceipt per distribution-list member. Resolves to the number created. */
    createReadReceiptStubs(messageId: number, listId: number): Promise<number>;
  };
}
