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
