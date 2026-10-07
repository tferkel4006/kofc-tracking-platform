// Phase 4.5 Liturgical Alignment (Sprint 6Z-Immediate-Upgrades, schema 38): the envelope's unread count, the liturgical
// calendar (Easter, U.S. Holy Days of Obligation and their Saturday/Monday rule, federal holidays, seasons, the feast
// banner), the NABRE Daily Bible Quote, birthdays and the calendar filter, and All-Hands shifts with no volunteer cap.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  birthdaysBetween,
  calendarLayers,
  cleanShiftFields,
  contrastRatio,
  countUnreadMessages,
  dailyVerse,
  DAILY_VERSES,
  easterSunday,
  firstSundayOfAdvent,
  HOLY_DAY_BADGE,
  isAllHandsShift,
  isFirstOpenOfDay,
  isShiftFull,
  liturgicalBanner,
  liturgicalSeason,
  LITURGICAL_COLORS,
  observancesBetween,
  observancesForYear,
  observancesOn,
  planEventCopy,
  shiftNeedsVolunteers,
  shiftStatus,
  visibleFeed,
  volunteerCountLabel,
  type Event,
  type Shift,
  type ShiftFeedItem,
} from '@kofc/shared';
import { drivers, expectRule, MEMBER, NOW, shiftByName } from './helpers';

const root = join(__dirname, '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');

const find = (year: number, title: RegExp) => observancesForYear(year).find((o) => title.test(o.title));

describe('countUnreadMessages', () => {
  it('adds the unread counts of every thread', () => {
    expect(countUnreadMessages([])).toBe(0);
    expect(countUnreadMessages([{ unreadCount: 2 }, { unreadCount: 0 }, { unreadCount: 5 }])).toBe(7);
  });

  it('feeds the envelope badge in both headers', () => {
    const shell = read('apps/web/components/Shell.tsx');
    expect(shell).toContain('countUnreadMessages(');
    expect(shell).toContain('<UnreadBadge count={unread} />');
    expect(shell).toMatch(/bg-brand-red[^"]*text-white/);
    expect(read('apps/mobile/lib/app-context.tsx')).toContain('countUnreadMessages(threads)');
    expect(read('apps/mobile/components/BrandHeader.tsx')).toContain("backgroundColor: large ? color.navy : color.red");
  });
});

describe('Easter and the movable feasts', () => {
  it.each([
    [2024, '2024-03-31'],
    [2025, '2025-04-20'],
    [2026, '2026-04-05'],
    [2027, '2027-03-28'],
    [2035, '2035-03-25'],
    [2038, '2038-04-25'],
  ])('Easter %i is %s', (year, date) => {
    expect(easterSunday(year)).toBe(date);
  });

  it('places Ash Wednesday, Pentecost, Advent and Christ the King', () => {
    expect(find(2026, /^Ash Wednesday/)?.date).toBe('2026-02-18');
    expect(find(2026, /^Pentecost/)?.date).toBe('2026-05-24');
    expect(firstSundayOfAdvent(2026)).toBe('2026-11-29');
    expect(firstSundayOfAdvent(2027)).toBe('2027-11-28');
    expect(find(2026, /King of the Universe/)?.date).toBe('2026-11-22');
    expect(find(2026, /Epiphany/)?.date).toBe('2026-01-04');
    expect(find(2026, /Baptism of the Lord/)?.date).toBe('2026-01-11');
    expect(find(2024, /Epiphany/)?.date).toBe('2024-01-07');
    expect(find(2024, /Baptism of the Lord/)?.date).toBe('2024-01-08');
  });

  it('keeps the Ascension on the Seventh Sunday of Easter, without a separate obligation', () => {
    expect(find(2026, /Ascension/)).toMatchObject({ date: '2026-05-17', holyDayOfObligation: false });
  });

  it('moves St. Joseph and the Annunciation out of Holy Week and the Easter Octave', () => {
    expect(find(2024, /Annunciation/)?.date).toBe('2024-04-08');
    expect(find(2035, /Saint Joseph, Spouse/)?.date).toBe('2035-03-17');
    expect(find(2035, /Annunciation/)?.date).toBe('2035-04-02');
    expect(find(2026, /Saint Joseph, Spouse/)?.date).toBe('2026-03-19');
  });

  it('drops a memorial that falls on a Sunday', () => {
    // Oct 4 2026 is a Sunday: no St. Francis that year; Oct 7 (Wednesday) keeps Our Lady of the Rosary.
    expect(find(2026, /Francis of Assisi/)).toBeUndefined();
    expect(find(2026, /Our Lady of the Rosary/)?.date).toBe('2026-10-07');
    expect(find(2026, /McGivney/)?.date).toBe('2026-08-13');
  });
});

describe('U.S. Holy Days of Obligation', () => {
  const holyDays = (year: number) => observancesForYear(year).filter((o) => o.holyDayOfObligation).map((o) => o.date);

  it('lists the 2026 Holy Days, lifting the Saturday Assumption', () => {
    expect(holyDays(2026)).toEqual(['2026-01-01', '2026-11-01', '2026-12-08', '2026-12-25']);
    expect(find(2026, /Assumption/)).toMatchObject({ date: '2026-08-15', holyDayOfObligation: false });
    expect(find(2026, /Assumption/)?.note).toMatch(/Saturday/);
  });

  it('lifts a Saturday All Saints and a Monday Mary, Mother of God', () => {
    expect(find(2025, /^All Saints/)?.holyDayOfObligation).toBe(false);
    expect(find(2024, /Mother of God/)?.holyDayOfObligation).toBe(false);
    expect(find(2024, /Mother of God/)?.note).toMatch(/Monday/);
  });

  it('never lifts Christmas or the Immaculate Conception on a weekday', () => {
    expect(find(2027, /Nativity of the Lord/)).toMatchObject({ date: '2027-12-25', holyDayOfObligation: true }); // a Saturday
    expect(find(2025, /Immaculate Conception/)).toMatchObject({ date: '2025-12-08', holyDayOfObligation: true }); // a Monday
  });

  it('moves a Sunday Immaculate Conception to Monday without the obligation', () => {
    expect(find(2024, /Immaculate Conception/)).toMatchObject({ date: '2024-12-09', holyDayOfObligation: false });
  });

  it('prints the crimson sub-badge on both platforms', () => {
    expect(HOLY_DAY_BADGE).toBe('[ 🟥 HOLY DAY OF OBLIGATION ]');
    expect(read('apps/web/app/calendar/page.tsx')).toContain('bg-crimson');
    expect(read('apps/mobile/components/FaithCenter.tsx')).toContain('LITURGICAL_COLORS.crimson');
  });
});

describe('federal holidays', () => {
  it.each([
    ["New Year's Day", '2026-01-01'],
    ['Martin Luther King Jr. Day', '2026-01-19'],
    ["Washington's Birthday (Presidents' Day)", '2026-02-16'],
    ['Memorial Day', '2026-05-25'],
    ['Juneteenth National Independence Day', '2026-06-19'],
    ['Independence Day', '2026-07-04'],
    ['Labor Day', '2026-09-07'],
    ['Columbus Day', '2026-10-12'],
    ['Veterans Day', '2026-11-11'],
    ['Thanksgiving Day', '2026-11-26'],
  ])('%s 2026 is %s', (title, date) => {
    expect(observancesForYear(2026).find((o) => o.kind === 'holiday' && o.title === title)?.date).toBe(date);
  });

  it('spans years and keeps date order', () => {
    const span = observancesBetween('2026-12-20', '2027-01-02');
    expect(span.map((o) => o.date)).toEqual([...span.map((o) => o.date)].sort());
    expect(span.some((o) => o.date === '2027-01-01' && o.kind === 'holiday')).toBe(true);
    expect(span.some((o) => o.date === '2026-12-25' && o.holyDayOfObligation)).toBe(true);
  });
});

describe('the feast banner and the season', () => {
  it('names today’s feast', () => {
    expect(liturgicalBanner('2026-10-07')).toEqual({ text: 'Today: Our Lady of the Rosary', holyDayOfObligation: false, note: null });
    expect(liturgicalBanner('2026-12-08').holyDayOfObligation).toBe(true);
  });

  it('falls back to the season, never to a national holiday', () => {
    expect(observancesOn('2026-10-12').map((o) => o.kind)).toEqual(['holiday']);
    expect(liturgicalBanner('2026-10-12').text).toBe('Today: a weekday in the season of Ordinary Time');
  });

  it.each([
    ['2026-01-05', 'Christmas'],
    ['2026-01-12', 'Ordinary Time'],
    ['2026-03-01', 'Lent'],
    ['2026-04-02', 'Lent'],
    ['2026-04-03', 'Paschal Triduum'],
    ['2026-04-10', 'Easter'],
    ['2026-05-24', 'Easter'],
    ['2026-10-07', 'Ordinary Time'],
    ['2026-12-01', 'Advent'],
    ['2026-12-26', 'Christmas'],
  ])('%s is in %s', (date, season) => {
    expect(liturgicalSeason(date)).toBe(season);
  });
});

describe('Daily Bible Quote', () => {
  it('quotes the NABRE only, the same verse all day and a new one tomorrow', () => {
    expect(DAILY_VERSES.length).toBeGreaterThanOrEqual(20);
    expect(new Set(DAILY_VERSES.map((v) => v.reference)).size).toBe(DAILY_VERSES.length);
    expect(dailyVerse('2026-10-07')).toBe(dailyVerse('2026-10-07'));
    expect(dailyVerse('2026-10-08')).not.toBe(dailyVerse('2026-10-07'));
    expect(DAILY_VERSES).toContain(dailyVerse('1999-02-28'));
    expect(read('apps/mobile/components/FaithCenter.tsx')).toContain('NABRE_NOTICE');
  });

  it('opens by itself on the first launch of each day only', () => {
    expect(isFirstOpenOfDay(null, '2026-10-07')).toBe(true);
    expect(isFirstOpenOfDay('2026-10-06', '2026-10-07')).toBe(true);
    expect(isFirstOpenOfDay('2026-10-07', '2026-10-07')).toBe(false);
  });

  it('puts praying hands in the phone header and the banner on Home', () => {
    expect(read('apps/mobile/components/BrandHeader.tsx')).toContain('<PrayingHandsButton />');
    expect(read('apps/mobile/app/(app)/_layout.tsx')).toContain('<FaithCenterProvider>');
    expect(read('apps/mobile/app/(app)/index.tsx')).toContain('<LiturgicalBanner />');
  });
});

describe('birthdays and the calendar filter', () => {
  const member = (id: number, DateOfBirth: string) => ({ id, MemberFirstName: 'Pat', MemberLastName: `Knight${id}`, DateOfBirth });

  it('places birthdays in the year shown, Feb 29 on Feb 28 in a common year, and skips bad dates', () => {
    const members = [member(1, '1960-02-29'), member(2, '1985-12-31'), member(3, '1990-01-01'), member(4, '')];
    expect(birthdaysBetween(members, '2026-02-01', '2026-02-28')).toEqual([{ date: '2026-02-28', memberId: 1, name: 'Pat Knight1' }]);
    expect(birthdaysBetween(members, '2028-02-29', '2028-02-29').map((b) => b.memberId)).toEqual([1]);
    expect(birthdaysBetween(members, '2026-12-27', '2027-01-03').map((b) => b.date)).toEqual(['2026-12-31', '2027-01-01']);
  });

  it('shows each layer under its filter, and feasts only under All', () => {
    expect(calendarLayers('all')).toEqual({ events: true, meetings: true, birthdays: true, observances: true });
    expect(calendarLayers('events')).toEqual({ events: true, meetings: false, birthdays: false, observances: false });
    expect(calendarLayers('meetings')).toEqual({ events: false, meetings: true, birthdays: false, observances: false });
    expect(calendarLayers('birthdays')).toEqual({ events: false, meetings: false, birthdays: true, observances: false });
  });

  it('draws the Birthday Flare and the crimson badge with readable white text', () => {
    expect(contrastRatio(LITURGICAL_COLORS.crimson, '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(LITURGICAL_COLORS.birthdayFlare, '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
    const css = read('apps/web/app/globals.css');
    expect(css).toContain(`--color-crimson: ${LITURGICAL_COLORS.crimson};`);
    expect(css).toContain(`--color-birthday: ${LITURGICAL_COLORS.birthdayFlare};`);
    expect(read('apps/web/app/calendar/page.tsx')).toContain('bg-birthday');
  });
});

describe('All-Hands shifts', () => {
  const shift = (over: Partial<Shift> = {}): Shift => ({
    id: 1,
    ShiftName: 'Parish picnic setup',
    ShiftDescription: '',
    ShiftDate: '2026-10-20',
    StartTime: '09:00:00',
    EndTime: '12:00:00',
    EventID: 1,
    MinNumberVolunteers: 4,
    NumberVolunteersSignedUp: 9,
    ...over,
  });

  it('never reads as full or short, and hides the target', () => {
    const allHands = shift({ IsAllHands: 1 });
    expect(isAllHandsShift(allHands)).toBe(true);
    expect(isShiftFull(allHands)).toBe(false);
    expect(isShiftFull(shift())).toBe(true);
    expect(shiftNeedsVolunteers({ ...allHands, NumberVolunteersSignedUp: 0 })).toBe(false);
    expect(shiftStatus(allHands, NOW)).toEqual({ status: 'open', remaining: 0 });
    expect(shiftStatus(shift(), NOW).status).toBe('locked');
    expect(volunteerCountLabel(allHands)).toBe('9 signed up · all hands welcome');
    expect(volunteerCountLabel(shift())).toBe('9 of 4 volunteers');
  });

  it('stays in the feed when full shifts are hidden', () => {
    const item = (s: Shift): ShiftFeedItem => ({ shift: s, event: {} as Event, councilIds: [1], isSignedUp: false });
    const feed = [item(shift({ id: 1 })), item(shift({ id: 2, IsAllHands: 1 }))];
    expect(visibleFeed(feed, { councilId: 'all', showLocked: false }).map((i) => i.shift.id)).toEqual([2]);
  });

  it('validates the flag and carries it into a copied event', () => {
    expect(cleanShiftFields({ IsAllHands: true as unknown as number })).toEqual({ IsAllHands: 1 });
    expect(() => cleanShiftFields({ IsAllHands: 2 })).toThrow(/IsAllHands/);
    const event = { id: 1, EventName: 'Picnic', EventDescription: '', OwnerID: 1, StartDate: '2026-10-20', EndDate: '2026-10-20', Location: 'Hall', CategoryID: 1 } as Event;
    const copy = planEventCopy(event, [shift({ IsAllHands: 1 }), shift()], { startDate: '2027-10-20' });
    expect(copy.shifts.map((s) => s.IsAllHands)).toEqual([1, undefined]);
  });

  it('adds the column in schema 38', () => {
    expect(read('Schema.sql')).toMatch(/ALTER TABLE \[Shift\] ADD \[IsAllHands\] BIT NOT NULL DEFAULT 0;/);
    expect(read('apps/mobile/services/drivers/sqlite.ts')).toMatch(/const SCHEMA_VERSION = (3[8-9]|[4-9]\d);/);
    expect(read('data_dictionary.md')).toContain('IsAllHands (BIT, NOT NULL, DEFAULT 0)');
  });
});

describe.each(drivers)('$name driver: All-Hands shifts', (d) => {
  it('defaults existing shifts to capped', async () => {
    const db = await d.make();
    expect((await shiftByName(db, 'Coat Sorting')).IsAllHands).toBe(0);
  });

  it('creates an All-Hands shift that takes any number of volunteers and lets its target fall', async () => {
    const db = await d.make();
    const coats = await shiftByName(db, 'Coat Sorting');
    const created = await db.events.createShift({
      ShiftName: 'Everyone welcome',
      ShiftDescription: '',
      ShiftDate: coats.ShiftDate,
      StartTime: '18:00',
      EndTime: '20:00',
      EventID: coats.EventID,
      MinNumberVolunteers: 1,
      IsAllHands: 1,
    });
    expect(created).toMatchObject({ IsAllHands: 1, MinNumberVolunteers: 1 });
    for (const id of [MEMBER.superAdmin, MEMBER.admin, MEMBER.member]) await db.events.signupForShift(id, created.id);
    const after = (await db.events.getShift(created.id))!;
    expect(after.NumberVolunteersSignedUp).toBe(3);
    expect(isShiftFull(after)).toBe(false);

    // A capped shift still refuses a target below its signups; an All-Hands one does not.
    await expectRule(db.events.updateShift(coats.id, { MinNumberVolunteers: 1 }), 'INVALID_INPUT');
    expect(await db.events.updateShift(coats.id, { MinNumberVolunteers: 1, IsAllHands: 1 })).toMatchObject({ MinNumberVolunteers: 1, IsAllHands: 1 });
  });
});
