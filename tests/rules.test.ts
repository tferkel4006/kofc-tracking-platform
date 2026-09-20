import { describe, expect, it } from 'vitest';
import {
  assertActivityDateAllowed,
  assertIsoDate,
  assertPasswordAcceptable,
  assertShiftHasRoom,
  assertShiftReportAllowed,
  assertValidHours,
  BusinessRuleError,
  isSha256Hex,
  subtractMonths,
} from '@kofc/shared';
import { NOW } from './helpers';

const codeOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return (e as BusinessRuleError).code;
  }
  return null;
};

describe('assertValidHours (multiples of 0.25)', () => {
  it.each([0.25, 0.5, 1, 1.75, 8, 24])('accepts %s', (h) => expect(assertValidHours(h)).toBe(h));

  it.each([0.1, 0.3, 1.3, 1.26, 0.3333, 0.7500000000000001])('rejects %s as not a 15-minute step', (h) =>
    expect(codeOf(() => assertValidHours(h))).toBe('INVALID_HOURS_INCREMENT'),
  );

  it.each([0, -0.25, 24.25, 100])('rejects %s as out of range', (h) =>
    expect(codeOf(() => assertValidHours(h))).toBe('HOURS_OUT_OF_RANGE'),
  );

  it.each([Number.NaN, Number.POSITIVE_INFINITY, '1', null, undefined])('rejects non-number %s', (h) =>
    expect(codeOf(() => assertValidHours(h))).toBe('INVALID_HOURS'),
  );

  it('names the value and the nearest valid steps', () => {
    expect(() => assertValidHours(1.3)).toThrow(/multiple of 0\.25.*received 1\.3.*1\.25 or 1\.5/);
  });
});

describe('subtractMonths', () => {
  it.each([
    ['2026-09-20', 6, '2026-03-20'],
    ['2026-09-20', 3, '2026-06-20'],
    ['2026-08-31', 6, '2026-02-28'],
    ['2024-08-31', 6, '2024-02-29'],
    ['2026-01-15', 3, '2025-10-15'],
    ['2026-03-31', 1, '2026-02-28'],
  ])('%s minus %i months is %s', (today, months, expected) => {
    const [y, m, d] = today.split('-').map(Number);
    expect(subtractMonths(new Date(y, m - 1, d), months)).toBe(expected);
  });
});

describe('history windows (today is 2026-09-20)', () => {
  it('allows activity dates back to exactly 6 months and rejects the day before', () => {
    expect(assertActivityDateAllowed('2026-03-20', NOW)).toBe('2026-03-20');
    expect(codeOf(() => assertActivityDateAllowed('2026-03-19', NOW))).toBe('ACTIVITY_DATE_TOO_OLD');
  });

  it('allows shift reports back to exactly 3 months and rejects the day before', () => {
    expect(() => assertShiftReportAllowed('2026-06-20', NOW, 7)).not.toThrow();
    expect(codeOf(() => assertShiftReportAllowed('2026-06-19', NOW, 7))).toBe('SHIFT_REPORT_TOO_OLD');
  });

  it('explains the rejection with the dates involved', () => {
    expect(() => assertActivityDateAllowed('2025-01-01', NOW)).toThrow(/2025-01-01.*6 months.*2026-03-20/);
    expect(() => assertShiftReportAllowed('2026-01-01', NOW, 9)).toThrow(/Shift 9.*2026-01-01.*3 months.*2026-06-20/);
  });

  it.each(['2026-2-3', '2026-02-30', 'yesterday', '', 20260920])('rejects malformed date %s', (d) =>
    expect(codeOf(() => assertIsoDate(d, 'Date'))).toBe('INVALID_DATE'),
  );
});

describe('assertShiftHasRoom (Signed >= Min locks the shift)', () => {
  const shift = (signed: number, min: number) => ({
    id: 5,
    ShiftName: 'Packing',
    NumberVolunteersSignedUp: signed,
    MinNumberVolunteers: min,
  });

  it('allows a signup while below the limit', () => expect(() => assertShiftHasRoom(shift(1, 2))).not.toThrow());
  it('locks when signed up equals the limit', () =>
    expect(codeOf(() => assertShiftHasRoom(shift(2, 2)))).toBe('SHIFT_LOCKED'));
  it('stays locked above the limit', () =>
    expect(codeOf(() => assertShiftHasRoom(shift(3, 2)))).toBe('SHIFT_LOCKED'));
  it('says which shift and how full it is', () =>
    expect(() => assertShiftHasRoom(shift(2, 2))).toThrow(/"Packing" \(id 5\).*2 of 2/));
});

describe('passwords', () => {
  it('requires 8 characters', () => {
    expect(codeOf(() => assertPasswordAcceptable('1234567'))).toBe('PASSWORD_TOO_SHORT');
    expect(assertPasswordAcceptable('12345678')).toBe('12345678');
  });

  it('recognises SHA-256 hex digests', () => {
    expect(isSha256Hex('a'.repeat(64))).toBe(true);
    expect(isSha256Hex('A'.repeat(64))).toBe(false);
    expect(isSha256Hex('koc15295')).toBe(false);
    expect(isSha256Hex('')).toBe(false);
  });
});
