// =========================================================================
// LITURGICAL CALENDAR (Phase 4.5, Sprint 6Z-Immediate-Upgrades)
// Pure helpers behind the portal calendar's observance rows and the phone's Faith Center: U.S. federal holidays,
// the major solemnities, feasts and memorials of the General Roman Calendar as kept in the United States, the U.S.
// Holy Days of Obligation, the liturgical season, the Daily Bible Quote (NABRE) and member birthdays.
// Everything is computed from the date, so nothing is stored in the database.
//
// U.S. rules applied (USCCB complementary norms):
//   - Holy Days of Obligation: Mary, Mother of God (Jan 1), the Assumption (Aug 15), All Saints (Nov 1), the
//     Immaculate Conception (Dec 8) and Christmas (Dec 25). Ascension is a Holy Day only where it is kept on Thursday
//     (ASCENSION_ON_THURSDAY); most U.S. provinces move it to the Seventh Sunday of Easter.
//   - Jan 1, Aug 15 and Nov 1 lose the obligation when they fall on a Saturday or a Monday.
//   - Dec 8 on a Sunday moves to Monday Dec 9, and the obligation does not move with it.
//   - Epiphany is the Sunday from Jan 2 to Jan 8; Corpus Christi is kept on the Sunday after Trinity Sunday.
// Precedence is simplified: a memorial or feast that meets a Sunday, Ash Wednesday, Holy Week or the Easter Octave is
// left out (feasts of the Lord still replace a Sunday), and St. Joseph and the Annunciation move as the norms require.
// =========================================================================
import { addDays } from './planning';
import { assertIsoDate, toIsoDate } from './rules';
import type { Member } from './types';

export type ObservanceKind = 'holiday' | 'solemnity' | 'feast' | 'memorial' | 'observance';

/** One holiday or liturgical day on one date. */
export interface Observance {
  /** YYYY-MM-DD */
  date: string;
  title: string;
  kind: ObservanceKind;
  /** True for a U.S. Holy Day of Obligation in that year (after the Saturday/Monday rule). */
  holyDayOfObligation: boolean;
  /** Fasting, abstinence or obligation guidance, or null. */
  note: string | null;
}

/** The sub-badge printed under every Holy Day of Obligation, on both platforms. */
export const HOLY_DAY_BADGE = '[ 🟥 HOLY DAY OF OBLIGATION ]';

/**
 * False keeps the Ascension on the Seventh Sunday of Easter, as most U.S. provinces do. The provinces of Boston,
 * Hartford, New York, Newark, Omaha and Philadelphia keep it on Thursday as a Holy Day of Obligation.
 */
export const ASCENSION_ON_THURSDAY = false;

const iso = (y: number, m: number, d: number): string => toIsoDate(new Date(y, m - 1, d));

const weekdayOf = (date: string): number => {
  const [y, m, d] = assertIsoDate(date, 'Date').split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
};

/** Easter Sunday of `year` (Gregorian; the anonymous Meeus/Jones/Butcher algorithm). */
export function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return iso(year, month, day);
}

/** The `n`th `weekday` (0 Sunday to 6 Saturday) of the month. */
function nthWeekday(year: number, month: number, weekday: number, n: number): string {
  const first = new Date(year, month - 1, 1).getDay();
  return iso(year, month, 1 + ((weekday - first + 7) % 7) + 7 * (n - 1));
}

/** The last `weekday` of the month. */
function lastWeekday(year: number, month: number, weekday: number): string {
  const lastDay = new Date(year, month, 0);
  const back = (lastDay.getDay() - weekday + 7) % 7;
  return iso(year, month, lastDay.getDate() - back);
}

/** First Sunday of Advent: the fourth Sunday before Christmas. */
export function firstSundayOfAdvent(year: number): string {
  const christmas = iso(year, 12, 25);
  const w = weekdayOf(christmas);
  return addDays(christmas, -(w === 0 ? 7 : w) - 21);
}

/** Epiphany (U.S.): the Sunday from Jan 2 to Jan 8. */
function epiphany(year: number): string {
  const jan2 = iso(year, 1, 2);
  return addDays(jan2, (7 - weekdayOf(jan2)) % 7);
}

/** Baptism of the Lord: the Sunday after Epiphany, or the Monday after when Epiphany falls on Jan 7 or 8. */
function baptismOfTheLord(year: number): string {
  const e = epiphany(year);
  return Number(e.slice(8)) >= 7 ? addDays(e, 1) : addDays(e, 7);
}

/** U.S. federal holidays (Christmas is listed once, as the Nativity of the Lord). */
function nationalHolidays(year: number): Observance[] {
  const h = (date: string, title: string): Observance => ({ date, title, kind: 'holiday', holyDayOfObligation: false, note: null });
  return [
    h(iso(year, 1, 1), "New Year's Day"),
    h(nthWeekday(year, 1, 1, 3), 'Martin Luther King Jr. Day'),
    h(nthWeekday(year, 2, 1, 3), "Washington's Birthday (Presidents' Day)"),
    h(lastWeekday(year, 5, 1), 'Memorial Day'),
    h(iso(year, 6, 19), 'Juneteenth National Independence Day'),
    h(iso(year, 7, 4), 'Independence Day'),
    h(nthWeekday(year, 9, 1, 1), 'Labor Day'),
    h(nthWeekday(year, 10, 1, 2), 'Columbus Day'),
    h(iso(year, 11, 11), 'Veterans Day'),
    h(nthWeekday(year, 11, 4, 4), 'Thanksgiving Day'),
  ];
}

type FixedRank = 'solemnity' | 'feast' | 'memorial';

/** Fixed-date days: [month, day, title, rank, feast of the Lord (replaces a Sunday)]. */
const FIXED_DAYS: readonly (readonly [number, number, string, FixedRank, boolean?])[] = [
  [1, 1, 'Solemnity of Mary, the Holy Mother of God', 'solemnity'],
  [1, 28, 'Saint Thomas Aquinas', 'memorial'],
  [2, 2, 'The Presentation of the Lord', 'feast', true],
  [2, 22, 'The Chair of Saint Peter, Apostle', 'feast'],
  [3, 17, 'Saint Patrick', 'memorial'],
  [3, 19, 'Saint Joseph, Spouse of the Blessed Virgin Mary', 'solemnity'],
  [3, 25, 'The Annunciation of the Lord', 'solemnity'],
  [5, 1, 'Saint Joseph the Worker', 'memorial'],
  [5, 31, 'The Visitation of the Blessed Virgin Mary', 'feast'],
  [6, 24, 'The Nativity of Saint John the Baptist', 'solemnity'],
  [6, 29, 'Saints Peter and Paul, Apostles', 'solemnity'],
  [8, 6, 'The Transfiguration of the Lord', 'feast', true],
  [8, 13, 'Blessed Michael McGivney, Founder of the Knights of Columbus', 'memorial'],
  [8, 15, 'The Assumption of the Blessed Virgin Mary', 'solemnity'],
  [9, 8, 'The Nativity of the Blessed Virgin Mary', 'feast'],
  [9, 14, 'The Exaltation of the Holy Cross', 'feast', true],
  [9, 29, 'Saints Michael, Gabriel and Raphael, Archangels', 'feast'],
  [10, 2, 'The Holy Guardian Angels', 'memorial'],
  [10, 4, 'Saint Francis of Assisi', 'memorial'],
  [10, 7, 'Our Lady of the Rosary', 'memorial'],
  [10, 22, 'Saint John Paul II', 'memorial'],
  [11, 1, 'All Saints', 'solemnity'],
  [11, 2, 'The Commemoration of All the Faithful Departed (All Souls)', 'solemnity'],
  [12, 8, 'The Immaculate Conception of the Blessed Virgin Mary', 'solemnity'],
  [12, 12, 'Our Lady of Guadalupe', 'feast'],
  [12, 25, 'The Nativity of the Lord (Christmas)', 'solemnity'],
];

/** Holy Days whose obligation lapses on a Saturday or a Monday (U.S. norm). */
const ABROGABLE = new Set(['01-01', '08-15', '11-01']);
const ALWAYS_OBLIGATORY = new Set(['12-08', '12-25']);

const FAST_AND_ABSTINENCE = 'A day of fasting and abstinence.';

/** Every holiday and liturgical day of `year`, in date order. */
export function observancesForYear(year: number): Observance[] {
  const easter = easterSunday(year);
  const e = (offset: number) => addDays(easter, offset);
  const palmSunday = e(-7);
  const divineMercy = e(7);
  const ashWednesday = e(-46);
  const inHolyWeekOrOctave = (date: string) => date >= palmSunday && date <= divineMercy;
  const out: Observance[] = [...nationalHolidays(year)];
  const add = (date: string, title: string, kind: ObservanceKind, holyDayOfObligation = false, note: string | null = null) =>
    out.push({ date, title, kind, holyDayOfObligation, note });

  for (const [month, day, title, rank, ofTheLord] of FIXED_DAYS) {
    const key = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    let date = iso(year, month, day);
    const sunday = weekdayOf(date) === 0;
    let obligation = ABROGABLE.has(key) || ALWAYS_OBLIGATORY.has(key);
    let note: string | null = null;

    if (key === '03-19') {
      if (inHolyWeekOrOctave(date)) date = addDays(palmSunday, -1);
      else if (sunday) date = addDays(date, 1);
    } else if (key === '03-25') {
      if (inHolyWeekOrOctave(date)) date = addDays(divineMercy, 1);
      else if (sunday) date = addDays(date, 1);
    } else if (key === '12-08' && sunday) {
      date = addDays(date, 1);
      obligation = false;
      note = 'Moved from the Second Sunday of Advent; the obligation is not transferred.';
    } else if (rank !== 'solemnity') {
      if (date === ashWednesday || inHolyWeekOrOctave(date)) continue;
      if (sunday && !ofTheLord) continue;
    }

    if (obligation && ABROGABLE.has(key)) {
      const w = weekdayOf(date);
      if (w === 6 || w === 1) {
        obligation = false;
        note = `Falls on a ${w === 6 ? 'Saturday' : 'Monday'} this year, so the obligation to attend Mass is lifted.`;
      }
    }
    add(date, title, rank, obligation, note);
  }

  add(epiphany(year), 'The Epiphany of the Lord', 'solemnity');
  add(baptismOfTheLord(year), 'The Baptism of the Lord', 'feast');
  add(ashWednesday, 'Ash Wednesday', 'observance', false, FAST_AND_ABSTINENCE);
  add(palmSunday, "Palm Sunday of the Lord's Passion", 'observance');
  add(e(-3), 'Holy Thursday', 'observance');
  add(e(-2), "Good Friday of the Lord's Passion", 'observance', false, FAST_AND_ABSTINENCE);
  add(easter, 'Easter Sunday of the Resurrection of the Lord', 'solemnity');
  add(divineMercy, 'Second Sunday of Easter (Divine Mercy Sunday)', 'observance');
  if (ASCENSION_ON_THURSDAY) add(e(39), 'The Ascension of the Lord', 'solemnity', true);
  else add(e(42), 'The Ascension of the Lord', 'solemnity', false, 'Kept on the Seventh Sunday of Easter in most U.S. provinces.');
  add(e(49), 'Pentecost Sunday', 'solemnity');
  add(e(56), 'The Most Holy Trinity', 'solemnity');
  add(e(63), 'The Most Holy Body and Blood of Christ (Corpus Christi)', 'solemnity');
  add(e(68), 'The Most Sacred Heart of Jesus', 'solemnity');
  add(e(69), 'The Immaculate Heart of the Blessed Virgin Mary', 'memorial');
  const advent = firstSundayOfAdvent(year);
  add(addDays(advent, -7), 'Our Lord Jesus Christ, King of the Universe', 'solemnity');
  add(advent, 'First Sunday of Advent', 'observance');
  const christmas = iso(year, 12, 25);
  add(weekdayOf(christmas) === 0 ? iso(year, 12, 30) : addDays(christmas, 7 - weekdayOf(christmas)), 'The Holy Family of Jesus, Mary and Joseph', 'feast');

  return out.sort((a, b) => a.date.localeCompare(b.date) || KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.title.localeCompare(b.title));
}

/** Within one day: solemnities first, national holidays last. */
const KIND_ORDER: Record<ObservanceKind, number> = { solemnity: 0, feast: 1, observance: 2, memorial: 3, holiday: 4 };

/** Every observance dated between the dates inclusive (YYYY-MM-DD), in date order. */
export function observancesBetween(from: string, to: string): Observance[] {
  assertIsoDate(from, 'Start date');
  assertIsoDate(to, 'End date');
  const out: Observance[] = [];
  for (let y = Number(from.slice(0, 4)); y <= Number(to.slice(0, 4)); y++) {
    out.push(...observancesForYear(y).filter((o) => o.date >= from && o.date <= to));
  }
  return out;
}

/** The observances of one date, most solemn first. */
export const observancesOn = (date: string): Observance[] => observancesBetween(date, date);

export type LiturgicalSeason = 'Advent' | 'Christmas' | 'Lent' | 'Paschal Triduum' | 'Easter' | 'Ordinary Time';

/** The liturgical season `date` falls in. */
export function liturgicalSeason(date: string): LiturgicalSeason {
  assertIsoDate(date, 'Date');
  const year = Number(date.slice(0, 4));
  const easter = easterSunday(year);
  if (date <= baptismOfTheLord(year)) return 'Christmas';
  if (date >= iso(year, 12, 25)) return 'Christmas';
  if (date >= firstSundayOfAdvent(year)) return 'Advent';
  // Lent runs through Holy Thursday; Good Friday and Holy Saturday are read as the Triduum.
  if (date >= addDays(easter, -46) && date < addDays(easter, -2)) return 'Lent';
  if (date >= addDays(easter, -2) && date < easter) return 'Paschal Triduum';
  if (date >= easter && date <= addDays(easter, 49)) return 'Easter';
  return 'Ordinary Time';
}

/**
 * The phone banner's line for `date`: its most solemn liturgical day (national holidays are left out), or the
 * season when the day keeps none, and whether it is a Holy Day of Obligation.
 */
export function liturgicalBanner(date: string): { text: string; holyDayOfObligation: boolean; note: string | null } {
  const day = observancesOn(date).find((o) => o.kind !== 'holiday');
  if (day) return { text: `Today: ${day.title}`, holyDayOfObligation: day.holyDayOfObligation, note: day.note };
  return { text: `Today: a weekday in the season of ${liturgicalSeason(date)}`, holyDayOfObligation: false, note: null };
}

// ---- Daily Bible Quote ---------------------------------------------------------

export interface BibleVerse {
  reference: string;
  text: string;
}

/** The notice the Confraternity of Christian Doctrine asks for wherever NABRE text is reproduced. */
export const NABRE_NOTICE =
  'Scripture texts are taken from the New American Bible, revised edition © 2010, 1991, 1986, 1970 Confraternity of Christian Doctrine, Washington, D.C. and are used by permission of the copyright owner. All Rights Reserved.';

/** Short verses, quoted only from the New American Bible, Revised Edition (NABRE). */
export const DAILY_VERSES: readonly BibleVerse[] = [
  { reference: 'John 3:16', text: 'For God so loved the world that he gave his only Son, so that everyone who believes in him might not perish but might have eternal life.' },
  { reference: 'Psalm 23:1', text: 'The LORD is my shepherd; there is nothing I lack.' },
  { reference: 'Matthew 11:28', text: 'Come to me, all you who labor and are burdened, and I will give you rest.' },
  { reference: 'Philippians 4:13', text: 'I have the strength for everything through him who empowers me.' },
  {
    reference: 'Micah 6:8',
    text: 'You have been told, O mortal, what is good, and what the LORD requires of you: Only to do justice and to love goodness, and to walk humbly with your God.',
  },
  {
    reference: 'Matthew 25:40',
    text: "And the king will say to them in reply, 'Amen, I say to you, whatever you did for one of these least brothers of mine, you did for me.'",
  },
  { reference: 'Galatians 6:9', text: 'Let us not grow tired of doing good, for in due time we shall reap our harvest, if we do not give up.' },
  { reference: 'Romans 12:12', text: 'Rejoice in hope, endure in affliction, persevere in prayer.' },
  {
    reference: '1 John 4:16',
    text: 'We have come to know and to believe in the love God has for us. God is love, and whoever remains in love remains in God and God in him.',
  },
  {
    reference: 'Joshua 1:9',
    text: 'I command you: be strong and steadfast! Do not fear nor be dismayed, for the LORD, your God, is with you wherever you go.',
  },
  {
    reference: 'Isaiah 40:31',
    text: "They that hope in the LORD will renew their strength, they will soar on eagles' wings; They will run and not grow weary, walk and not grow faint.",
  },
  { reference: 'James 2:17', text: 'So also faith of itself, if it does not have works, is dead.' },
  { reference: 'Matthew 5:9', text: 'Blessed are the peacemakers, for they will be called children of God.' },
  { reference: 'Psalm 46:11', text: 'Be still and know that I am God! I am exalted among the nations, exalted on the earth.' },
  {
    reference: 'Proverbs 3:5-6',
    text: 'Trust in the LORD with all your heart, on your own intelligence do not rely; In all your ways be mindful of him, and he will make straight your paths.',
  },
  { reference: '1 Corinthians 16:14', text: 'Your every act should be done with love.' },
  {
    reference: 'Luke 1:38',
    text: "Mary said, 'Behold, I am the handmaid of the Lord. May it be done to me according to your word.' Then the angel departed from her.",
  },
  { reference: 'John 15:13', text: "No one has greater love than this, to lay down one's life for one's friends." },
  { reference: 'Hebrews 13:16', text: 'Do not neglect to do good and to share what you have; God is pleased by sacrifices of that kind.' },
  { reference: 'Psalm 118:24', text: 'This is the day the LORD has made; let us rejoice in it and be glad.' },
  { reference: 'Romans 8:28', text: 'We know that all things work for good for those who love God, who are called according to his purpose.' },
  { reference: '1 Peter 4:10', text: "As each one has received a gift, use it to serve one another as good stewards of God's varied grace." },
  {
    reference: 'Lamentations 3:22-23',
    text: "The LORD's acts of mercy are not exhausted, his compassion is not spent; They are renewed each morning—great is your faithfulness!",
  },
  {
    reference: 'Acts 20:35',
    text: "In every way I have shown you that by hard work of that sort we must help the weak, and keep in mind the words of the Lord Jesus who himself said, 'It is more blessed to give than to receive.'",
  },
];

/** The verse of `date`: the same all day for every member, stepping through DAILY_VERSES one day at a time. */
export function dailyVerse(date: string): BibleVerse {
  const [y, m, d] = assertIsoDate(date, 'Date').split('-').map(Number);
  const dayNumber = Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
  return DAILY_VERSES[((dayNumber % DAILY_VERSES.length) + DAILY_VERSES.length) % DAILY_VERSES.length];
}

/** True when the Daily Bible Quote has not yet been shown on `today` (the device's first open of the day). */
export const isFirstOpenOfDay = (lastShown: string | null | undefined, today: string): boolean => lastShown !== today;

// ---- Birthdays and the calendar filter -------------------------------------------

/** A member's birthday on a calendar grid. The year of birth is never shown. */
export interface BirthdayEntry {
  /** YYYY-MM-DD in the year shown. */
  date: string;
  memberId: number;
  name: string;
}

/**
 * Every birthday of `members` between the dates inclusive. A Feb 29 birthday is kept on Feb 28 in common years.
 * Members with no valid DateOfBirth are skipped.
 */
export function birthdaysBetween(
  members: readonly Pick<Member, 'id' | 'MemberFirstName' | 'MemberLastName' | 'DateOfBirth'>[],
  from: string,
  to: string,
): BirthdayEntry[] {
  assertIsoDate(from, 'Start date');
  assertIsoDate(to, 'End date');
  const out: BirthdayEntry[] = [];
  for (const member of members) {
    const match = /^\d{4}-(\d{2})-(\d{2})/.exec(member.DateOfBirth ?? '');
    if (!match) continue;
    const [month, day] = [Number(match[1]), Number(match[2])];
    for (let y = Number(from.slice(0, 4)); y <= Number(to.slice(0, 4)); y++) {
      const leap = new Date(y, 1, 29).getMonth() === 1;
      const date = month === 2 && day === 29 && !leap ? iso(y, 2, 28) : iso(y, month, day);
      if (date >= from && date <= to) out.push({ date, memberId: member.id, name: `${member.MemberFirstName} ${member.MemberLastName}`.trim() });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
}

export type CalendarFilter = 'all' | 'events' | 'meetings' | 'birthdays';

export const CALENDAR_FILTERS: readonly { id: CalendarFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'events', label: 'Events' },
  { id: 'meetings', label: 'Meetings' },
  { id: 'birthdays', label: 'Birthdays' },
];

/** Which layers a calendar filter shows: 'All' shows every layer, holidays and feasts included. */
export function calendarLayers(filter: CalendarFilter): { events: boolean; meetings: boolean; birthdays: boolean; observances: boolean } {
  return {
    events: filter === 'all' || filter === 'events',
    meetings: filter === 'all' || filter === 'meetings',
    birthdays: filter === 'all' || filter === 'birthdays',
    observances: filter === 'all',
  };
}
