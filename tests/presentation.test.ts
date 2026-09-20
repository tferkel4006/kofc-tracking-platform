import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  assertValidHours,
  attachmentKind,
  BRAND,
  cleanLookupValues,
  contrastRatio,
  councilLabel,
  daysBetween,
  daysUntil,
  feedWindow,
  flattenReplies,
  formatDate,
  formatHours,
  formatShiftWhen,
  formatTime,
  formatTimestamp,
  HOUR_OPTIONS,
  hoursToPicker,
  isUnread,
  isUrgent,
  LOOKUP_META,
  LOOKUP_TABLE_ORDER,
  memberDropdownOptions,
  MINUTE_OPTIONS,
  noShowWindowStart,
  padMinutes,
  pickerResult,
  pickerToHours,
  planEventCopy,
  preview,
  shiftStatus,
  sortCouncils,
  visibleFeed,
  type Event,
  type Shift,
  type ShiftFeedItem,
  type ThreadMessage,
} from '@kofc/shared';
import { NOW } from './helpers';

describe('brand tokens', () => {
  it('uses the Knights of Columbus palette', () => {
    expect(BRAND).toMatchObject({ navy: '#002855', red: '#C8102E', gold: '#D6A420', white: '#FFFFFF' });
  });

  it.each([
    ['navy text on white', BRAND.navy, BRAND.white, 7],
    ['white text on navy buttons', BRAND.white, BRAND.navy, 7],
    ['red urgency text on white', BRAND.red, BRAND.white, 4.5],
    ['white text on red badge', BRAND.white, BRAND.red, 4.5],
    ['navy text on a gold marker', BRAND.navy, BRAND.gold, 4.5],
    ['muted secondary text on white', BRAND.muted, BRAND.white, 4.5],
  ])('%s meets WCAG AA', (_label, fg, bg, min) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(min);
  });

  it('documents why gold is never text on white', () => {
    expect(contrastRatio(BRAND.gold, BRAND.white)).toBeLessThan(3);
  });
});

describe('hour and minute picker', () => {
  it('offers minutes 00, 15, 30 and 45', () => {
    expect(MINUTE_OPTIONS.map(padMinutes)).toEqual(['00', '15', '30', '45']);
    expect(HOUR_OPTIONS[0]).toBe(0);
    expect(HOUR_OPTIONS.at(-1)).toBe(24);
  });

  it.each([
    [0, 15, 0.25],
    [0, 30, 0.5],
    [0, 45, 0.75],
    [1, 0, 1],
    [1, 45, 1.75],
    [8, 30, 8.5],
    [24, 0, 24],
  ])('%i h %i m becomes %f', (h, m, expected) => {
    expect(pickerToHours(h, m)).toBe(expected);
  });

  it('every picker combination is an exact multiple of 0.25 the driver rules accept', () => {
    for (const h of HOUR_OPTIONS) {
      for (const m of MINUTE_OPTIONS) {
        const hours = pickerToHours(h, m);
        expect(hours % 0.25).toBe(0);
        if (hours > 0 && hours <= 24) expect(assertValidHours(hours)).toBe(hours);
      }
    }
  });

  it('rejects minutes outside the dropdown and hours outside 0-24', () => {
    expect(() => pickerToHours(1, 20)).toThrow(/00, 15, 30, 45/);
    expect(() => pickerToHours(-1, 0)).toThrow(RangeError);
    expect(() => pickerToHours(25, 0)).toThrow(RangeError);
    expect(() => pickerToHours(1.5, 0)).toThrow(RangeError);
  });

  it('reports a message instead of a value for a selection that cannot be saved', () => {
    expect(pickerResult(2, 15)).toEqual({ hours: 2.25 });
    expect(pickerResult(0, 0)).toMatchObject({ error: expect.stringContaining('greater than 0') });
    expect(pickerResult(24, 15)).toMatchObject({ error: expect.stringContaining('at most 24') });
  });

  it('converts a stored value back to the picker and formats it', () => {
    expect(hoursToPicker(2.25)).toEqual({ hours: 2, minutes: 15 });
    expect(hoursToPicker(0.75)).toEqual({ hours: 0, minutes: 45 });
    for (let q = 1; q <= 96; q++) {
      const { hours, minutes } = hoursToPicker(q / 4);
      expect(pickerToHours(hours, minutes)).toBe(q / 4);
    }
    expect([formatHours(2.25), formatHours(3), formatHours(0.5), formatHours(1.75)]).toEqual(['2 h 15 m', '3 h', '30 m', '1 h 45 m']);
  });
});

describe('dates and urgency (today is Sunday 2026-09-20)', () => {
  it('highlights shifts within two days and nothing else', () => {
    expect(isUrgent('2026-09-20', NOW)).toBe(true);
    expect(isUrgent('2026-09-22', NOW)).toBe(true);
    expect(isUrgent('2026-09-23', NOW)).toBe(false);
    expect(isUrgent('2026-09-19', NOW)).toBe(false);
    expect(daysUntil('2026-09-24', NOW)).toBe(4);
  });

  it('works across a daylight-saving change', () => {
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2);
    expect(daysBetween('2026-11-01', '2026-11-02')).toBe(1);
    expect(addDays('2026-03-07', 2)).toBe('2026-03-09');
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
  });

  it('covers a six-month feed window and a rolling one-year no-show window', () => {
    expect(feedWindow(NOW)).toEqual({ fromDate: '2026-09-20', toDate: '2027-03-20' });
    expect(addMonths(new Date(2026, 7, 31), 6)).toBe('2027-02-28'); // clamped to a shorter month
    expect(noShowWindowStart(NOW)).toBe('2025-09-20');
  });

  it('formats dates and times without depending on Intl', () => {
    expect(formatDate('2026-09-24')).toBe('Thu, Sep 24');
    expect([formatTime('13:00:00'), formatTime('00:15:00'), formatTime('12:00:00'), formatTime('09:05:00')]).toEqual([
      '1:00 PM', '12:15 AM', '12:00 PM', '9:05 AM',
    ]);
    expect(formatShiftWhen({ ShiftDate: '2026-09-24', StartTime: '13:00:00', EndTime: '16:00:00' })).toBe('Thu, Sep 24 · 1:00 PM – 4:00 PM');
  });

  it('labels and sorts councils by ascending CouncilNumber', () => {
    const councils = [
      { CouncilNumber: 15295, CouncilName: 'St. Jude Council' },
      { CouncilNumber: 1024, CouncilName: 'Our Lady of Peace Council' },
      { CouncilNumber: 3311, CouncilName: 'B' },
      { CouncilNumber: 3311, CouncilName: 'A' },
    ];
    expect(sortCouncils(councils).map((c) => `${c.CouncilNumber}${c.CouncilName}`)).toEqual(['1024Our Lady of Peace Council', '3311A', '3311B', '15295St. Jude Council']);
    expect(councilLabel(councils[0])).toBe('15295 – St. Jude Council');
  });
});

const shift = (over: Partial<Shift>): Shift => ({
  id: 1, ShiftName: 'S', ShiftDescription: '', ShiftDate: '2026-10-30', StartTime: '09:00:00', EndTime: '10:00:00',
  EventID: 1, MinNumberVolunteers: 4, NumberVolunteersSignedUp: 1, ...over,
});

describe('shift status', () => {
  it('locks a shift once the target is reached', () => {
    expect(shiftStatus(shift({ MinNumberVolunteers: 2, NumberVolunteersSignedUp: 2 }), NOW)).toEqual({ status: 'locked', remaining: 0 });
  });

  it('marks an empty shift, or one starting within a week, as a priority', () => {
    expect(shiftStatus(shift({ NumberVolunteersSignedUp: 0 }), NOW)).toEqual({ status: 'priority', remaining: 4 });
    expect(shiftStatus(shift({ ShiftDate: '2026-09-27' }), NOW)).toEqual({ status: 'priority', remaining: 3 });
    expect(shiftStatus(shift({ ShiftDate: '2026-09-28' }), NOW)).toEqual({ status: 'open', remaining: 3 });
  });
});

const item = (id: number, over: Partial<Shift>, councilIds: number[], isSignedUp = false): ShiftFeedItem => ({
  shift: shift({ id, ...over }),
  event: { id: 1 } as Event,
  councilIds,
  isSignedUp,
});

describe('feed filtering', () => {
  const feed = [
    item(1, {}, [1]),
    item(2, { MinNumberVolunteers: 2, NumberVolunteersSignedUp: 2 }, [1]), // full
    item(3, {}, [2]),
    item(4, { MinNumberVolunteers: 1, NumberVolunteersSignedUp: 1 }, [1, 2], true), // full but mine
  ];

  it('hides full shifts by default but keeps the member’s own', () => {
    expect(visibleFeed(feed, { councilId: 'all', showLocked: false }).map((f) => f.shift.id)).toEqual([1, 3, 4]);
  });

  it('shows locked shifts when asked', () => {
    expect(visibleFeed(feed, { councilId: 'all', showLocked: true }).map((f) => f.shift.id)).toEqual([1, 2, 3, 4]);
  });

  it('filters by council, including shifts shared between councils', () => {
    expect(visibleFeed(feed, { councilId: 2, showLocked: true }).map((f) => f.shift.id)).toEqual([3, 4]);
    expect(visibleFeed(feed, { councilId: 1, showLocked: false }).map((f) => f.shift.id)).toEqual([1, 4]);
  });
});

const msg = (id: number, parent: number | null, at: string, receipt: ThreadMessage['receipt'] = null): ThreadMessage => ({
  message: { id, ParentMessageID: parent, CreatedAt: at, IsDraft: 0, MessageText: `m${id}` },
  senderName: 'x',
  attachments: [],
  receipt,
});

describe('reply tree', () => {
  it('nests replies under their parent, oldest first at every level', () => {
    const flat = flattenReplies([msg(1, null, '1'), msg(2, 1, '2'), msg(3, 2, '3'), msg(4, 1, '4'), msg(5, null, '5'), msg(6, 4, '6')]);
    expect(flat.map((f) => [f.item.message.id, f.depth])).toEqual([[1, 0], [2, 1], [3, 2], [4, 1], [6, 2], [5, 0]]);
  });

  it('shows a reply whose parent is missing at the top level', () => {
    expect(flattenReplies([msg(2, 99, '1'), msg(3, 2, '2')]).map((f) => [f.item.message.id, f.depth])).toEqual([[2, 0], [3, 1]]);
  });

  it('never drops or loops on a cycle or a self-reply', () => {
    const ids = flattenReplies([msg(1, 2, '1'), msg(2, 1, '2'), msg(3, 3, '3')]).map((f) => f.item.message.id).sort();
    expect(ids).toEqual([1, 2, 3]);
  });

  it('treats a message as unread only when it has a receipt without a read time', () => {
    expect(isUnread(msg(1, null, '1'))).toBe(false); // sent by the viewer
    expect(isUnread(msg(1, null, '1', { id: 1, ReadAt: null, IsFlagged: 0 }))).toBe(true);
    expect(isUnread(msg(1, null, '1', { id: 1, ReadAt: '2026-09-20 10:00:00', IsFlagged: 0 }))).toBe(false);
    expect(preview('a   b\n c d', 5)).toBe('a b…');
  });
});

describe('lookup metadata', () => {
  it('describes all eight tables in tab order', () => {
    expect(LOOKUP_TABLE_ORDER).toEqual(['MemberStatus', 'Role', 'Degree', 'MemberType', 'Category', 'NoShowReason', 'MeetingType', 'LessonsLearnedCategory']);
    for (const table of LOOKUP_TABLE_ORDER) {
      const meta = LOOKUP_META[table];
      expect(meta.fields.some((f) => f.key === meta.keyField)).toBe(true);
      expect(meta.references.length).toBeGreaterThan(0);
    }
  });

  it('trims text, defaults an omitted flag to 0 and keeps optional text optional', () => {
    expect(cleanLookupValues('Role', { Role: '  Warden ' })).toEqual({ Role: 'Warden', Officer: 0 });
    expect(cleanLookupValues('MeetingType', { Type: 'Special' })).toEqual({ Type: 'Special', Description: '' });
    expect(() => cleanLookupValues('Role', { Role: 'x', Officer: 2 })).toThrow(/0 or 1/);
  });
});

describe('copy plan', () => {
  const event = { id: 1, EventName: 'Fish Fry', EventDescription: 'd', OwnerID: 2, StartDate: '2026-10-02', EndDate: '2026-10-03', Location: 'Hall', CategoryID: 5, Budget: 300, Spend: 250, Highlights: 'x' } as Event;

  it('moves every date by the same offset and drops the ledger', () => {
    const plan = planEventCopy(event, [shift({ ShiftDate: '2026-10-02' }), shift({ ShiftDate: '2026-10-03' })], { startDate: '2026-12-31' });
    expect(plan.event).toMatchObject({ StartDate: '2026-12-31', EndDate: '2027-01-01', Budget: 300 });
    expect(plan.event).not.toHaveProperty('Spend');
    expect(plan.event).not.toHaveProperty('Highlights');
    expect(plan.shifts.map((s) => s.ShiftDate)).toEqual(['2026-12-31', '2027-01-01']);
  });
});

describe('attachments, timestamps and the member dropdown', () => {
  it('tags attachments by kind', () => {
    expect(
      [
        'application/pdf',
        'image/png',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/zip',
      ].map(attachmentKind),
    ).toEqual(['PDF', 'IMG', 'XLS', 'DOC', 'FILE']);
  });

  it('shows stored UTC timestamps in local time and passes anything else through', () => {
    const local = new Date(Date.UTC(2026, 8, 20, 15, 5));
    const h = local.getHours();
    const expected = `Sep ${local.getDate()}, ${h % 12 === 0 ? 12 : h % 12}:05 ${h < 12 ? 'AM' : 'PM'}`;
    expect(formatTimestamp('2026-09-20 15:05:00')).toBe(expected);
    expect(formatTimestamp('not a time')).toBe('not a time');
    expect(formatTimestamp(null)).toBe('');
  });

  it('orders member dropdown rows by council name, then last name', () => {
    const councils = [{ id: 1, CouncilName: 'St. Jude Council' }, { id: 2, CouncilName: 'Our Lady of Peace Council' }];
    const members = [
      { id: 10, MemberFirstName: 'Zed', MemberLastName: 'Adams', CouncilID: 1 },
      { id: 11, MemberFirstName: 'Amy', MemberLastName: 'Young', CouncilID: 2 },
      { id: 12, MemberFirstName: 'Bo', MemberLastName: 'Adams', CouncilID: 1 },
    ];
    expect(memberDropdownOptions(members, councils)).toEqual([
      { value: 11, label: 'Young, Amy – Our Lady of Peace Council' },
      { value: 12, label: 'Adams, Bo – St. Jude Council' },
      { value: 10, label: 'Adams, Zed – St. Jude Council' },
    ]);
  });
});
