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
}


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
  Agenda?: string;
  MinutesURL?: string; // Links directly to cloud PDF assets
  MeetingType: number;
}

export interface MeetingInvites {
  id: number;
  MeetingID: number;
  MemberID: number;
  Attended: 1 | 0; // SQL BIT flag tracker
}

