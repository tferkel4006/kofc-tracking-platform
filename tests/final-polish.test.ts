// Sprint 5Z-Final-Polish: the flat chronological chat log, the phone's 30-day Signup Desk window with its
// Shifts Opening / Full Up split, and the 2-hour gate window that decides which events donations can pin.
import { describe, expect, it } from 'vitest';
import {
  chronologicalThread,
  GATE_LEAD_HOURS,
  isEventAtGate,
  isShiftFull,
  SIGNUP_HORIZON_DAYS,
  signupWindow,
  type ThreadMessage,
} from '@kofc/shared';

const msg = (id: number, parent: number | null, at: string | undefined): ThreadMessage => ({
  message: { id, ParentMessageID: parent, CreatedAt: at, IsDraft: 0, MessageText: `m${id}` },
  senderName: 'x',
  attachments: [],
  receipt: null,
});

describe('chronological thread', () => {
  it('lists every message flat, oldest first, ignoring the reply tree', () => {
    const flat = chronologicalThread([
      msg(1, null, '2026-09-20 10:00:00'),
      msg(2, 1, '2026-09-20 10:05:00'),
      msg(3, null, '2026-09-20 10:02:00'),
      msg(4, 3, '2026-09-20 10:01:00'),
    ]);
    expect(flat.map((f) => [f.item.message.id, f.depth])).toEqual([[1, 0], [4, 0], [3, 0], [2, 0]]);
  });

  it('breaks ties and missing timestamps by id, and leaves the input untouched', () => {
    const input = [msg(5, null, '2026-09-20 10:00:00'), msg(2, null, '2026-09-20 10:00:00'), msg(9, null, undefined)];
    expect(chronologicalThread(input).map((f) => f.item.message.id)).toEqual([9, 2, 5]);
    expect(input.map((m) => m.message.id)).toEqual([5, 2, 9]);
  });

  it('keeps a reply cycle without dropping or looping', () => {
    expect(chronologicalThread([msg(1, 2, 'b'), msg(2, 1, 'a')]).map((f) => f.item.message.id)).toEqual([2, 1]);
  });
});

describe('signup window', () => {
  it('covers today through 30 calendar days ahead', () => {
    expect(SIGNUP_HORIZON_DAYS).toBe(30);
    expect(signupWindow(new Date(2026, 9, 2, 15, 30))).toEqual({ fromDate: '2026-10-02', toDate: '2026-11-01' });
  });

  it('crosses a year end', () => {
    expect(signupWindow(new Date(2026, 11, 15))).toEqual({ fromDate: '2026-12-15', toDate: '2027-01-14' });
  });

  it('calls a shift full at its minimum and beyond (honorary signups)', () => {
    expect(isShiftFull({ MinNumberVolunteers: 3, NumberVolunteersSignedUp: 2 })).toBe(false);
    expect(isShiftFull({ MinNumberVolunteers: 3, NumberVolunteersSignedUp: 3 })).toBe(true);
    expect(isShiftFull({ MinNumberVolunteers: 3, NumberVolunteersSignedUp: 5 })).toBe(true);
  });
});

describe('gate window', () => {
  const event = { StartDate: '2026-10-03', EndDate: '2026-10-03' };
  const shift = (date: string, start: string, end: string) => ({ ShiftDate: date, StartTime: start, EndTime: end });
  const at = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m);

  it('opens two hours before the first shift', () => {
    expect(GATE_LEAD_HOURS).toBe(2);
    const shifts = [shift('2026-10-03', '10:00:00', '12:00:00'), shift('2026-10-03', '08:00:00', '10:00:00')];
    expect(isEventAtGate(event, shifts, at(3, 5, 59))).toBe(false);
    expect(isEventAtGate(event, shifts, at(3, 6, 0))).toBe(true);
    expect(isEventAtGate(event, shifts, at(3, 11))).toBe(true);
  });

  it('stays open through the end date, or later when a shift runs past midnight', () => {
    expect(isEventAtGate(event, [], at(3, 23, 59))).toBe(true);
    expect(isEventAtGate(event, [], at(4, 0, 0))).toBe(false);
    const late = [shift('2026-10-03', '22:00:00', '02:00:00')];
    expect(isEventAtGate(event, late, at(4, 1, 30))).toBe(true);
    expect(isEventAtGate(event, late, at(4, 2, 0))).toBe(false);
  });

  it('falls back to midnight on the start date for an event without shifts', () => {
    expect(isEventAtGate(event, [], at(2, 21, 59))).toBe(false);
    expect(isEventAtGate(event, [], at(2, 22, 0))).toBe(true);
  });

  it('hides far-off and finished events', () => {
    expect(isEventAtGate({ StartDate: '2026-11-20', EndDate: '2026-11-21' }, [], at(3, 12))).toBe(false);
    expect(isEventAtGate({ StartDate: '2026-09-01', EndDate: '2026-09-02' }, [], at(3, 12))).toBe(false);
    expect(isEventAtGate({ StartDate: '2026-10-01', EndDate: '2026-10-05' }, [], at(3, 12))).toBe(true);
  });
});
