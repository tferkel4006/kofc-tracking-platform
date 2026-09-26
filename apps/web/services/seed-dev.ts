// Dev-only baseline data that Seed.sql cannot express, because "upcoming"
// meetings need dates relative to the day the app is first launched.
// (Kept in step with apps/mobile/services/seed-dev.ts.)
import type { Event, MeetingInviteMode, NewMeeting, Shift } from '@kofc/shared';

/** The test council created by Seed.sql. */
export const DEV_COUNCIL_NUMBER = 15295;

export type DevMeetingTypeName = 'Monthly' | 'Officer' | 'Community';

export interface DevMeeting {
  meeting: NewMeeting;
  invite: MeetingInviteMode;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Local-time YYYY-MM-DD. */
export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function daysFrom(today: Date, days: number): string {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + days);
  return toIsoDate(d);
}

/** Upcoming meetings for the test council, each with its default attendee invitations. */
export function buildDevMeetings(
  councilId: number,
  typeIds: Record<DevMeetingTypeName, number>,
  today: Date = new Date(),
): DevMeeting[] {
  return [
    {
      invite: 'officers',
      meeting: {
        CouncilID: councilId,
        'Meeting Name': 'Officer Planning Meeting',
        'Meeting Description': 'Review upcoming events and shift coverage',
        Date: daysFrom(today, 3),
        'Time Start': '18:00:00',
        'Time End': '19:00:00',
        Location: 'Parish Office Conference Room',
        Agenda: '1. Event calendar review\n2. Volunteer shortfalls\n3. Budget check-in',
        MeetingType: typeIds.Officer,
      },
    },
    {
      invite: 'allActive',
      meeting: {
        CouncilID: councilId,
        'Meeting Name': 'Monthly Business Meeting',
        'Meeting Description': 'Regular monthly council meeting',
        Date: daysFrom(today, 7),
        'Time Start': '19:00:00',
        'Time End': '21:00:00',
        Location: 'St. Jude Parish Hall',
        Agenda: '1. Opening prayer\n2. Minutes and treasurer report\n3. Committee updates\n4. New business',
        MeetingType: typeIds.Monthly,
      },
    },
    {
      invite: 'allActive',
      meeting: {
        CouncilID: councilId,
        'Meeting Name': 'Community Committee Meeting',
        'Meeting Description': 'Plan parish and community outreach',
        Date: daysFrom(today, 14),
        'Time Start': '19:00:00',
        'Time End': '20:00:00',
        Location: 'St. Jude Parish Hall, Room B',
        Agenda: '1. Food drive planning\n2. Volunteer sign-ups',
        MeetingType: typeIds.Community,
      },
    },
    {
      invite: 'allActive',
      meeting: {
        CouncilID: councilId,
        'Meeting Name': 'Monthly Business Meeting',
        'Meeting Description': 'Regular monthly council meeting',
        Date: daysFrom(today, 35),
        'Time Start': '19:00:00',
        'Time End': '21:00:00',
        Location: 'St. Jude Parish Hall',
        Agenda: '1. Opening prayer\n2. Minutes and treasurer report\n3. New business',
        MeetingType: typeIds.Monthly,
      },
    },
  ];
}

// ---- Phase 3 dev fixtures ---------------------------------------------------

/** Dev member who is pre-provisioned but has not chosen a password: exercises auth.signUp. */
export const DEV_UNREGISTERED_MEMBER = {
  MemberNumber: 9900004,
  MemberFirstName: 'Newly',
  MemberLastName: 'Enrolled',
  Phone: '555-888-9999',
  StreetAddress1: '1 Welcome Way',
  City: 'Portland',
  State: 'OR',
  ZipCode: '97212',
  Email: 'testnewmember@kofc.org',
  DateOfBirth: '1995-03-03',
} as const;

/** Dev council activity for logging unscheduled time (Specifications: "garbage collection"). */
export const DEV_ACTIVITY = {
  ActivityName: 'Highway Cleanup',
  ActivityDescription: 'Adopt-a-highway litter pickup',
} as const;

export interface DevShift {
  shift: Omit<Shift, 'id' | 'EventID' | 'NumberVolunteersSignedUp'>;
  /** Emails of members already signed up; NumberVolunteersSignedUp is set to this count. */
  signedUp: string[];
}

export interface DevEvent {
  event: Omit<Event, 'id' | 'OwnerID' | 'CategoryID'>;
  shifts: DevShift[];
}

/**
 * Events with shifts in every state the Phase 3 rules care about, relative to `today`:
 * open, one seat from locked, already locked, recently past and too old to report.
 */
export function buildDevEvents(today: Date = new Date()): DevEvent[] {
  return [
    {
      event: {
        EventName: 'Parish Food Drive',
        EventDescription: 'Collect, sort and deliver food for the parish pantry',
        StartDate: daysFrom(today, 2),
        EndDate: daysFrom(today, 6),
        Location: 'St. Jude Parish Hall',
      },
      shifts: [
        {
          signedUp: [],
          shift: {
            ShiftName: 'Sorting Shift',
            ShiftDescription: 'Sort donated food by type',
            ShiftDate: daysFrom(today, 2),
            StartTime: '09:00:00',
            EndTime: '12:00:00',
            MinNumberVolunteers: 3,
          },
        },
        {
          signedUp: ['testsuperadmin@kofc.org'],
          shift: {
            ShiftName: 'Packing Shift',
            ShiftDescription: 'Pack sorted food into family boxes',
            ShiftDate: daysFrom(today, 4),
            StartTime: '13:00:00',
            EndTime: '16:00:00',
            MinNumberVolunteers: 2,
          },
        },
        {
          signedUp: ['testsuperadmin@kofc.org'],
          shift: {
            ShiftName: 'Delivery Shift',
            ShiftDescription: 'Deliver boxes to pantry clients',
            ShiftDate: daysFrom(today, 6),
            StartTime: '10:00:00',
            EndTime: '12:00:00',
            MinNumberVolunteers: 1,
          },
        },
      ],
    },
    {
      event: {
        EventName: 'Fall Grounds Cleanup',
        EventDescription: 'Rake and bag leaves around the parish',
        StartDate: daysFrom(today, -10),
        EndDate: daysFrom(today, -10),
        Location: 'St. Jude Parish Grounds',
      },
      shifts: [
        {
          signedUp: ['testmember@kofc.org'],
          shift: {
            ShiftName: 'Leaf Raking',
            ShiftDescription: 'Rake and bag leaves',
            ShiftDate: daysFrom(today, -10),
            StartTime: '08:00:00',
            EndTime: '11:00:00',
            MinNumberVolunteers: 5,
          },
        },
      ],
    },
    {
      event: {
        EventName: 'Spring Retreat Setup',
        EventDescription: 'Set up the hall for the spring retreat',
        StartDate: daysFrom(today, -120),
        EndDate: daysFrom(today, -120),
        Location: 'St. Jude Parish Hall',
      },
      shifts: [
        {
          signedUp: ['testmember@kofc.org'],
          shift: {
            ShiftName: 'Hall Setup',
            ShiftDescription: 'Arrange tables and chairs',
            ShiftDate: daysFrom(today, -120),
            StartTime: '15:00:00',
            EndTime: '18:00:00',
            MinNumberVolunteers: 6,
          },
        },
      ],
    },
  ];
}

// ---- Phase 4 dev fixtures ---------------------------------------------------
// Give the mobile and admin screens something to show: an affiliated council, an
// unaffiliated one (which must never appear), no-show history around the
// rolling one-year boundary, and message threads with nested replies.

export const DEV_AFFILIATED_COUNCIL = {
  CouncilNumber: 1024,
  CouncilName: 'Our Lady of Peace Council',
  State: 'OR',
  Phone: '503-555-0142',
} as const;

export const DEV_UNAFFILIATED_COUNCIL = {
  CouncilNumber: 3311,
  CouncilName: 'St. Anthony Council',
  State: 'WA',
  Phone: '360-555-0177',
} as const;

export interface DevExtraShift extends DevShift {
  /** email -> NoShowReasonCode for signed-up members who did not show. */
  noShows?: Record<string, string>;
}

export interface DevExtraEvent {
  event: DevEvent['event'];
  /** Which councils the event is linked to. */
  councils: ('own' | 'affiliated' | 'unaffiliated')[];
  shifts: DevExtraShift[];
}

/** Events for the extra councils, a shared event, one past the 6-month horizon and the no-show history. */
export function buildDevExtraEvents(today: Date = new Date()): DevExtraEvent[] {
  const shift = (name: string, date: string, start: string, end: string, min: number) => ({
    ShiftName: name,
    ShiftDescription: name,
    ShiftDate: date,
    StartTime: start,
    EndTime: end,
    MinNumberVolunteers: min,
  });
  const one = (
    name: string,
    days: number,
    councils: DevExtraEvent['councils'],
    shifts: DevExtraShift[],
  ): DevExtraEvent => ({
    councils,
    shifts,
    event: {
      EventName: name,
      EventDescription: `${name} (dev sample)`,
      StartDate: daysFrom(today, days),
      EndDate: daysFrom(today, days),
      Location: 'Parish Hall',
    },
  });
  return [
    one('Neighborhood Blood Drive', 9, ['affiliated'], [
      { signedUp: ['testadmin@kofc.org'], shift: shift('Check-in Desk', daysFrom(today, 9), '08:00:00', '12:00:00', 4) },
      { signedUp: [], shift: shift('Canteen', daysFrom(today, 9), '09:00:00', '13:00:00', 3) },
    ]),
    one('Coat Collection', 30, ['affiliated'], [
      {
        signedUp: ['testadmin@kofc.org', 'testmember@kofc.org'],
        shift: shift('Coat Sorting', daysFrom(today, 30), '10:00:00', '14:00:00', 2), // full: locked
      },
    ]),
    one('Joint Pancake Breakfast', 12, ['own', 'affiliated'], [
      { signedUp: ['testmember@kofc.org'], shift: shift('Griddle Crew', daysFrom(today, 12), '07:00:00', '10:00:00', 3) },
      { signedUp: [], shift: shift('Serving Line', daysFrom(today, 12), '08:00:00', '11:00:00', 4) },
    ]),
    one('Unaffiliated Fish Fry', 5, ['unaffiliated'], [
      { signedUp: [], shift: shift('Fry Cook', daysFrom(today, 5), '16:00:00', '19:00:00', 3) },
    ]),
    one('Christmas Toy Drive', 200, ['own'], [
      { signedUp: [], shift: shift('Toy Sorting', daysFrom(today, 200), '09:00:00', '12:00:00', 5) },
    ]),
    // No-show history: two inside the rolling year, one just outside it.
    one('Winter Coat Sort', -20, ['own'], [
      {
        signedUp: ['testmember@kofc.org'],
        noShows: { 'testmember@kofc.org': 'A' },
        shift: shift('Coat Sort', daysFrom(today, -20), '10:00:00', '12:00:00', 4),
      },
    ]),
    one('Old Book Drive', -200, ['own'], [
      {
        signedUp: ['testmember@kofc.org'],
        noShows: { 'testmember@kofc.org': 'E' },
        shift: shift('Book Boxing', daysFrom(today, -200), '10:00:00', '12:00:00', 4),
      },
    ]),
    one('Ancient Bake Sale', -400, ['own'], [
      {
        signedUp: ['testmember@kofc.org'],
        noShows: { 'testmember@kofc.org': 'C' },
        shift: shift('Bake Table', daysFrom(today, -400), '10:00:00', '12:00:00', 4),
      },
    ]),
  ];
}

export interface DevThread {
  key: string;
  isGroup: boolean;
  /** Member emails taking part. */
  participants: string[];
}

export interface DevMessage {
  key: string;
  thread: string;
  sender: string;
  text: string;
  /** Key of the message this one replies to. */
  parent?: string;
  hoursAgo: number;
  draft?: boolean;
  /** Emails among the recipients who have already read it; the rest have an unread receipt. */
  readBy?: string[];
  attachments?: { Filename: string; FileType: string }[];
}

const SUPER = 'testsuperadmin@kofc.org';
const ADMIN = 'testadmin@kofc.org';
const MEMBER = 'testmember@kofc.org';

/** Threads with nested replies, unread messages, attachments and a draft, from the test member's point of view. */
export function buildDevMessaging(): { threads: DevThread[]; messages: DevMessage[] } {
  return {
    threads: [
      { key: 'food', isGroup: true, participants: [SUPER, ADMIN, MEMBER] },
      { key: 'hours', isGroup: false, participants: [ADMIN, MEMBER] },
      { key: 'officers', isGroup: true, participants: [SUPER, ADMIN] },
    ],
    messages: [
      { key: 'f1', thread: 'food', sender: ADMIN, hoursAgo: 50, readBy: [SUPER, MEMBER], text: 'The food drive is coming up. Please confirm your shifts by Friday.' },
      { key: 'f2', thread: 'food', sender: MEMBER, parent: 'f1', hoursAgo: 47, readBy: [ADMIN, SUPER], text: 'I am on the Packing Shift Thursday afternoon.' },
      { key: 'f3', thread: 'food', sender: ADMIN, parent: 'f2', hoursAgo: 30, text: 'Great, thanks! Can you bring the pallet jack?' },
      {
        key: 'f4', thread: 'food', sender: SUPER, parent: 'f1', hoursAgo: 26, readBy: [ADMIN],
        text: 'I can bring extra boxes. Checklist attached.',
        attachments: [{ Filename: 'Food Drive Checklist.pdf', FileType: 'application/pdf' }],
      },
      {
        key: 'f5', thread: 'food', sender: SUPER, parent: 'f4', hoursAgo: 20,
        text: 'Also attaching the pantry map.',
        attachments: [{ Filename: 'Pantry Map.png', FileType: 'image/png' }],
      },
      { key: 'f6', thread: 'food', sender: MEMBER, parent: 'f3', hoursAgo: 2, draft: true, text: 'Yes, I will bring it. See you Thursday!' },
      {
        key: 'h1', thread: 'hours', sender: ADMIN, hoursAgo: 8,
        text: 'Please log your hours for Leaf Raking when you get a chance.',
        attachments: [{ Filename: 'Hours Guide.xlsx', FileType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }],
      },
      {
        key: 'o1', thread: 'officers', sender: SUPER, hoursAgo: 5,
        text: 'Budget review agenda attached for the officer meeting.',
        attachments: [{ Filename: 'Budget Agenda.docx', FileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }],
      },
    ],
  };
}

// ---- Phase 2 dev fixtures ---------------------------------------------------

/**
 * Donation methods enabled for the test council. The digital methods carry a placeholder QR image
 * until real ones are uploaded to Azure Blob storage.
 */
export const DEV_COUNCIL_DONATION_METHODS: readonly { method: string; qrUrl: string | null }[] = [
  { method: 'Cash', qrUrl: null },
  { method: 'Credit Card', qrUrl: null },
  { method: 'Venmo', qrUrl: 'placeholder://qr/venmo.png' },
  { method: 'Zelle', qrUrl: 'placeholder://qr/zelle.png' },
  { method: 'Zeffy', qrUrl: 'placeholder://qr/zeffy.png' },
  { method: 'Parishsoft', qrUrl: 'placeholder://qr/parishsoft.png' },
  { method: 'Physical Items', qrUrl: null },
];
