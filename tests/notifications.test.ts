import { describe, expect, it, vi } from 'vitest';
import {
  buildIcs,
  escapeIcsText,
  foldIcsLine,
  localDateTime,
  NOTICE_WINDOW_MS,
  runNotificationSweep,
  type NotificationPacket,
} from '@kofc/shared';
import { drivers } from './helpers';

// Seed dates are relative to 2026-09-20: Packing Shift 09-24 13:00, Officer meeting 09-23 18:00.
const at = (m: number, d: number, h: number, mi = 0) => new Date(2026, m - 1, d, h, mi, 0);
const icsOf = (p: NotificationPacket) => p.email.attachments[0].content;

describe('iCalendar output', () => {
  const event = {
    uid: 'shift-1@kofc-tracking-platform',
    summary: 'Packing, Sorting; and more',
    description: 'Line one\nLine two',
    location: 'St. Jude Parish Hall',
    start: at(9, 24, 13),
    end: at(9, 24, 16),
  };

  it('is a well-formed VCALENDAR with CRLF line endings and floating local times', () => {
    const ics = buildIcs(event, new Date(Date.UTC(2026, 8, 23, 13, 0, 0)));
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/); // no bare LF or CR anywhere
    const lines = ics.split('\r\n');
    expect(lines.slice(0, 3)).toEqual(['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Knights of Columbus//Tracking Platform//EN']);
    expect(lines).toContain('BEGIN:VEVENT');
    expect(lines).toContain('UID:shift-1@kofc-tracking-platform');
    expect(lines).toContain('DTSTAMP:20260923T130000Z');
    expect(lines).toContain('DTSTART:20260924T130000');
    expect(lines).toContain('DTEND:20260924T160000');
    expect(lines).toContain('SUMMARY:Packing\\, Sorting\\; and more');
    expect(lines).toContain('DESCRIPTION:Line one\\nLine two');
    expect(lines).toContain('END:VEVENT');
  });

  it('moves an end time at or before the start to the next day', () => {
    const ics = buildIcs({ ...event, start: at(9, 24, 22), end: at(9, 24, 1) });
    expect(ics).toContain('DTEND:20260925T010000');
  });

  it('escapes backslashes, semicolons, commas and newlines', () => {
    expect(escapeIcsText('a,b;c\\d\ne')).toBe('a\\,b\\;c\\\\d\\ne');
  });

  it('folds long lines to at most 75 octets and unfolds back to the original', () => {
    for (const text of ['x'.repeat(300), 'é'.repeat(120), 'a😀'.repeat(60)]) {
      const line = `DESCRIPTION:${text}`;
      const folded = foldIcsLine(line);
      for (const physical of folded.split('\r\n')) expect(Buffer.byteLength(physical, 'utf8')).toBeLessThanOrEqual(75);
      expect(folded.replace(/\r\n /g, '')).toBe(line);
    }
  });

  it('parses schema times, including fractional seconds and missing seconds', () => {
    expect(localDateTime('2026-09-24', '13:00:00')).toEqual(at(9, 24, 13));
    expect(localDateTime('2026-09-24', '13:00:00.0000000')).toEqual(at(9, 24, 13));
    expect(localDateTime('2026-09-24', '13:30')).toEqual(at(9, 24, 13, 30));
  });
});

describe.each(drivers)('$name driver: 24-hour notification sweep', (d) => {
  it('emits an email packet with an .ics attachment for a shift exactly 24 hours away', async () => {
    const db = await d.make();
    const log = vi.fn();
    const packets = await runNotificationSweep(db, { now: at(9, 23, 13), log });

    expect(packets).toHaveLength(1); // Packing Shift has one signup (the super admin)
    const [packet] = packets;
    expect(packet.kind).toBe('shift');
    expect(packet.email).toMatchObject({
      to: 'testsuperadmin@kofc.org',
      subject: 'Reminder: Packing Shift on 2026-09-24 at 13:00',
    });
    expect(packet.email.text).toContain('Parish Food Drive');
    expect(packet.email.attachments[0]).toMatchObject({ filename: 'shift.ics' });
    expect(icsOf(packet)).toContain('SUMMARY:Packing Shift - Parish Food Drive\r\n');
    expect(icsOf(packet)).toContain('DTSTART:20260924T130000\r\n');
    expect(icsOf(packet)).toContain('LOCATION:St. Jude Parish Hall\r\n');

    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][0]).toBe('[notification]');
    expect(JSON.parse(log.mock.calls[0][1] as string).email.to).toBe('testsuperadmin@kofc.org');
  });

  it('prints the packet with console.log by default', async () => {
    const db = await d.make();
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await runNotificationSweep(db, { now: at(9, 23, 13) });
      expect(spy).toHaveBeenCalledTimes(1);
      expect(String(spy.mock.calls[0][1])).toContain('BEGIN:VCALENDAR');
    } finally {
      spy.mockRestore();
    }
  });

  it('fires only in the window [24h, 24h + 15min) before the start', async () => {
    const db = await d.make();
    const sweep = async (now: Date) => (await runNotificationSweep(db, { now, log: () => {} })).length;

    expect(NOTICE_WINDOW_MS).toBe(15 * 60 * 1000);
    expect(await sweep(at(9, 23, 12, 44))).toBe(0); // 24h16m away: too early
    expect(await sweep(at(9, 23, 12, 46))).toBe(1); // 24h14m away
    expect(await sweep(at(9, 23, 13, 0))).toBe(1); // exactly 24h
    expect(await sweep(at(9, 23, 13, 1))).toBe(0); // 23h59m away: this sweep's window has passed
  });

  it('reminds each invited member of a meeting 24 hours ahead', async () => {
    const db = await d.make();
    const packets = await runNotificationSweep(db, { now: at(9, 22, 18), log: () => {} }); // Officer meeting is 09-23 18:00

    expect(packets.map((p) => p.kind)).toEqual(['meeting', 'meeting']);
    expect(packets.map((p) => p.email.to).sort()).toEqual(['testadmin@kofc.org', 'testsuperadmin@kofc.org']); // officers only
    expect(packets[0].email.subject).toBe('Reminder: Officer Planning Meeting on 2026-09-23 at 18:00');
    expect(icsOf(packets[0])).toContain('DTSTART:20260923T180000\r\n');
    expect(icsOf(packets[0])).toContain('DESCRIPTION:Review upcoming events and shift coverage');
  });

  it('never sends the same reminder twice when given a sent set', async () => {
    const db = await d.make();
    const sent = new Set<string>();
    const first = await runNotificationSweep(db, { now: at(9, 23, 13), log: () => {}, sent });
    const second = await runNotificationSweep(db, { now: at(9, 23, 13), log: () => {}, sent });
    expect(first).toHaveLength(1);
    expect(second).toHaveLength(0);
    expect([...sent]).toEqual([first[0].key]);
  });

  it('stays quiet when nothing starts in 24 hours', async () => {
    const db = await d.make();
    const log = vi.fn();
    expect(await runNotificationSweep(db, { now: at(9, 21, 3), log })).toEqual([]);
    expect(log).not.toHaveBeenCalled();
  });
});
