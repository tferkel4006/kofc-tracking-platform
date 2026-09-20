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
  Category,
  Council,
  Degree,
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
