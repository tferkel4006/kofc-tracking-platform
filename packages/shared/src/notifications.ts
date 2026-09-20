// =========================================================================
// PRE-SHIFT & MEETING NOTIFICATION SKELETON
// When a volunteer shift or an invited meeting is 24 hours away, compile an
// email payload carrying an iCalendar (.ics) block and print it with
// console.log. No mail server exists yet, so nothing is sent or written.
//
// Shared by mobile and web: it talks only to the DataService contract.
// Times in the schema carry no time zone, so the .ics uses "floating" local
// times (no trailing Z), which calendar apps read as the attendee's local time.
// =========================================================================
import type { DataService } from './contract';
import { toIsoDate } from './rules';
import type { Meeting, Member, Shift, Event as CouncilEvent } from './types';

/** How far ahead of the start a reminder goes out. */
export const NOTICE_LEAD_MS = 24 * 60 * 60 * 1000;
/**
 * A sweep reminds about items starting in [now + 24h, now + 24h + window).
 * "Exactly 24 hours" needs a window because sweeps run on a timer; with the
 * window equal to the sweep interval, every item falls in exactly one sweep.
 */
export const NOTICE_WINDOW_MS = 15 * 60 * 1000;
export const NOTIFICATION_SENDER = 'no-reply@kofc-tracking-platform.local';

// ---- iCalendar -----------------------------------------------------------

export interface CalendarEvent {
  /** Globally unique and stable, so re-sent invites update rather than duplicate. */
  uid: string;
  summary: string;
  description?: string;
  location?: string;
  /** Local wall-clock times (built with `new Date(y, m, d, h, mi)`). */
  start: Date;
  end: Date;
}

const p2 = (n: number) => String(n).padStart(2, '0');

const formatLocal = (d: Date) =>
  `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}T${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}`;

const formatUtc = (d: Date) => d.toISOString().replace(/[-:]|\.\d{3}/g, '');

/** RFC 5545 TEXT escaping. */
export function escapeIcsText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r\n|\r|\n/g, '\\n');
}

const utf8Bytes = (ch: string) => {
  const cp = ch.codePointAt(0) as number;
  return cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
};

/** RFC 5545 line folding: no line longer than 75 octets, continuation lines start with one space. */
export function foldIcsLine(line: string): string {
  const parts: string[] = [];
  let current = '';
  let bytes = 0;
  for (const ch of line) {
    const size = utf8Bytes(ch);
    // Continuation lines spend one octet on their leading space.
    const limit = parts.length === 0 ? 75 : 74;
    if (bytes + size > limit) {
      parts.push(current);
      current = '';
      bytes = 0;
    }
    current += ch;
    bytes += size;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

/** Builds a complete VCALENDAR with one VEVENT. Lines end in CRLF, as the RFC requires. */
export function buildIcs(event: CalendarEvent, now: Date = new Date()): string {
  // An end at or before the start means the event runs past midnight.
  const end = event.end > event.start ? event.end : new Date(event.end.getTime() + 24 * 60 * 60 * 1000);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Knights of Columbus//Tracking Platform//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.uid}`,
    `DTSTAMP:${formatUtc(now)}`,
    `DTSTART:${formatLocal(event.start)}`,
    `DTEND:${formatLocal(end)}`,
    `SUMMARY:${escapeIcsText(event.summary)}`,
    ...(event.description ? [`DESCRIPTION:${escapeIcsText(event.description)}`] : []),
    ...(event.location ? [`LOCATION:${escapeIcsText(event.location)}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(foldIcsLine).join('\r\n') + '\r\n';
}

// ---- email packets -------------------------------------------------------

export interface EmailPayload {
  from: string;
  to: string;
  subject: string;
  text: string;
  attachments: { filename: string; contentType: string; content: string }[];
}

export interface NotificationPacket {
  kind: 'shift' | 'meeting';
  /** Stable dedupe key, e.g. "shift:12:member:3". */
  key: string;
  email: EmailPayload;
}

/** Local Date from a schema DATE plus TIME ('HH:MM:SS', with optional fractional seconds). */
export function localDateTime(date: string, time: string): Date {
  const [y, mo, d] = date.slice(0, 10).split('-').map(Number);
  const [h = 0, mi = 0, s = 0] = time.split(':').map((part) => Math.floor(Number(part)));
  return new Date(y, mo - 1, d, h, mi, s);
}

const describeStart = (start: Date) => `${toIsoDate(start)} at ${p2(start.getHours())}:${p2(start.getMinutes())}`;

export function buildShiftReminder(input: {
  shift: Shift;
  event: CouncilEvent;
  member: Pick<Member, 'id' | 'Email' | 'MemberFirstName'>;
  now?: Date;
}): NotificationPacket {
  const { shift, event, member, now } = input;
  const start = localDateTime(shift.ShiftDate, shift.StartTime);
  const ics = buildIcs(
    {
      uid: `shift-${shift.id}@kofc-tracking-platform`,
      summary: `${shift.ShiftName} - ${event.EventName}`,
      description: shift.ShiftDescription,
      location: event.Location,
      start,
      end: localDateTime(shift.ShiftDate, shift.EndTime),
    },
    now,
  );
  return {
    kind: 'shift',
    key: `shift:${shift.id}:member:${member.id}`,
    email: {
      from: NOTIFICATION_SENDER,
      to: member.Email,
      subject: `Reminder: ${shift.ShiftName} on ${describeStart(start)}`,
      text:
        `Hello ${member.MemberFirstName},\n\n` +
        `You are signed up for "${shift.ShiftName}" (${event.EventName}) on ${describeStart(start)} at ${event.Location}.\n` +
        `A calendar file is attached.`,
      attachments: [{ filename: 'shift.ics', contentType: 'text/calendar; charset=utf-8; method=PUBLISH', content: ics }],
    },
  };
}

export function buildMeetingReminder(input: {
  meeting: Meeting;
  member: Pick<Member, 'id' | 'Email' | 'MemberFirstName'>;
  now?: Date;
}): NotificationPacket {
  const { meeting, member, now } = input;
  const start = localDateTime(meeting.Date, meeting['Time Start']);
  const ics = buildIcs(
    {
      uid: `meeting-${meeting.id}@kofc-tracking-platform`,
      summary: meeting['Meeting Name'],
      description: [meeting['Meeting Description'], meeting.Agenda && `Agenda:\n${meeting.Agenda}`].filter(Boolean).join('\n\n'),
      location: meeting.Location,
      start,
      end: localDateTime(meeting.Date, meeting['Time End']),
    },
    now,
  );
  return {
    kind: 'meeting',
    key: `meeting:${meeting.id}:member:${member.id}`,
    email: {
      from: NOTIFICATION_SENDER,
      to: member.Email,
      subject: `Reminder: ${meeting['Meeting Name']} on ${describeStart(start)}`,
      text:
        `Hello ${member.MemberFirstName},\n\n` +
        `You are invited to "${meeting['Meeting Name']}" on ${describeStart(start)} at ${meeting.Location}.\n` +
        `A calendar file is attached.`,
      attachments: [{ filename: 'meeting.ics', contentType: 'text/calendar; charset=utf-8; method=PUBLISH', content: ics }],
    },
  };
}

// ---- the sweep -----------------------------------------------------------

export interface SweepOptions {
  /** Clock override for tests. Default: the real time. */
  now?: Date;
  /** Where packets go. Default: console.log (no mail infrastructure exists yet). */
  log?: (...args: unknown[]) => void;
  /** Override for the length of the reminder window. */
  windowMs?: number;
  /** Keys already sent. Pass one Set for the lifetime of the process to guarantee at-most-once delivery. */
  sent?: Set<string>;
}

/**
 * Finds every shift signup and meeting invitation whose start is 24 hours away
 * (see NOTICE_WINDOW_MS), builds a packet for each and logs it. Resolves to the packets.
 */
export async function runNotificationSweep(db: DataService, options: SweepOptions = {}): Promise<NotificationPacket[]> {
  const now = options.now ?? new Date();
  const log = options.log ?? console.log;
  const sent = options.sent ?? new Set<string>();
  const from = new Date(now.getTime() + NOTICE_LEAD_MS);
  const to = new Date(from.getTime() + (options.windowMs ?? NOTICE_WINDOW_MS));
  const inWindow = (start: Date) => start >= from && start < to;

  const packets: NotificationPacket[] = [];
  const emit = (packet: NotificationPacket) => {
    if (sent.has(packet.key)) return;
    sent.add(packet.key);
    packets.push(packet);
    log('[notification]', JSON.stringify(packet, null, 2));
  };

  for (const shift of await db.events.listShiftsBetween(toIsoDate(from), toIsoDate(to))) {
    if (!inWindow(localDateTime(shift.ShiftDate, shift.StartTime))) continue;
    const event = await db.events.get(shift.EventID);
    if (!event) continue;
    for (const signup of await db.events.listSignups(shift.id)) {
      const member = await db.members.get(signup.MemberID);
      if (member?.Email) emit(buildShiftReminder({ shift, event, member, now }));
    }
  }

  for (const council of await db.councils.list()) {
    for (const meeting of await db.meetings.listUpcoming(council.id, { fromDate: toIsoDate(from) })) {
      if (!inWindow(localDateTime(meeting.Date, meeting['Time Start']))) continue;
      for (const invite of await db.meetings.listInvites(meeting.id)) {
        const member = await db.members.get(invite.MemberID);
        if (member?.Email) emit(buildMeetingReminder({ meeting, member, now }));
      }
    }
  }

  return packets;
}

/**
 * Runs a sweep now and then every `intervalMs` (default: the sweep window), keeping one
 * `sent` set so nothing goes out twice. Returns a function that stops it.
 * A foreground timer only: reminders will not fire while the mobile app is suspended,
 * so the production version needs a server job or an OS background task.
 */
export function startNotificationScheduler(
  db: DataService,
  options: Omit<SweepOptions, 'now'> & { intervalMs?: number } = {},
): () => void {
  const sweepOptions = { ...options, sent: options.sent ?? new Set<string>() };
  const tick = () => {
    runNotificationSweep(db, sweepOptions).catch((err) => console.error('[notification] sweep failed:', err));
  };
  tick();
  const handle = setInterval(tick, options.intervalMs ?? options.windowMs ?? NOTICE_WINDOW_MS);
  return () => clearInterval(handle);
}
