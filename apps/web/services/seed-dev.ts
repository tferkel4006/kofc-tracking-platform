// Dev-only baseline data that Seed.sql cannot express, because "upcoming"
// meetings need dates relative to the day the app is first launched.
// (Kept in step with apps/mobile/services/seed-dev.ts.)
import type { MeetingInviteMode, NewMeeting } from '@kofc/shared';

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
