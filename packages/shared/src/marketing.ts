// =========================================================================
// AI GENERATIVE MARKETING FACTORY (Sprint 6C, Phase 4)
// /resources/marketing turns one council event into a printable one-page flyer:
//   1. composeFlyerCopy writes warm public-event copy from the event's own fields (the marketing-factory skill's
//      public event voice: "join us", "all are welcome", no invented numbers, no emblems, no banned jargon).
//      Like the Constitutional Advisor this is a deterministic template engine - the project has no LLM backend.
//   2. flyerFacts sets the three critical variables - date, time and address - from the event and its shifts. A fact
//      the records do not hold is shown as a [PLACEHOLDER], never guessed.
//   3. pastEditions finds the earlier editions of an annual or duplicated event (same name, any year dropped), and
//      pastEditionPhotos collects their saved photos; the portal adds the image ids filed in the Drive vault under
//      Media / <past event name>. With no photos, the flyer draws a vector icon for the event type instead.
//   4. buildFlyerHtml assembles a self-contained, printable HTML page in the navy and gold brand tokens. The portal
//      previews it, prints it, and files it in the vault's Flyers folder (Event.GoogleDriveFlyerFileID).
// =========================================================================
import { parsePhotoGallery } from './media';
import { BRAND, FONT_BODY, FONT_HEADING } from './theme';
import type { Event, Shift } from './types';

/** Most past photos a flyer embeds. */
export const FLYER_MAX_PHOTOS = 4;

/** Event types the fallback icon is drawn for. */
export type FlyerIconKind = 'fish' | 'breakfast' | 'drive' | 'blood' | 'festival' | 'faith' | 'service' | 'fellowship' | 'fundraising' | 'calendar';

/**
 * Line-drawn icons on a 64 x 64 grid, stroked in gold on the navy photo frame. Generic shapes only: no Knights of
 * Columbus emblem or seal (the marketing-factory skill forbids them).
 */
export const FLYER_ICONS: Readonly<Record<FlyerIconKind, { label: string; paths: readonly string[] }>> = {
  fish: { label: 'Fish', paths: ['M8 32c10-14 30-14 40 0-10 14-30 14-40 0z', 'M48 32l10-10v20z', 'M20 30h.01', 'M30 24c2 5 2 11 0 16'] },
  breakfast: { label: 'Pancake stack', paths: ['M14 28h36', 'M12 36h40', 'M14 44h36', 'M8 52h48', 'M28 28c0-6 8-6 8 0', 'M44 36v6'] },
  drive: { label: 'Donation box', paths: ['M12 28h40v26H12z', 'M12 28l6-10h28l6 10', 'M32 48s-8-5-8-10a4 4 0 0 1 8-2 4 4 0 0 1 8 2c0 5-8 10-8 10z'] },
  blood: { label: 'Blood drop', paths: ['M32 8C26 20 16 30 16 40a16 16 0 0 0 32 0c0-10-10-20-16-32z', 'M32 34v12', 'M26 40h12'] },
  festival: { label: 'Festival tent', paths: ['M8 54L32 14l24 40z', 'M32 14V6', 'M32 6l8 3-8 3', 'M26 54l6-14 6 14', 'M4 54h56'] },
  faith: { label: 'Church', paths: ['M18 56V30l14-12 14 12v26z', 'M32 4v14', 'M26 10h12', 'M28 56V44a4 4 0 0 1 8 0v12', 'M10 56h44'] },
  service: { label: 'Helping hands', paths: ['M32 40s-12-7-12-15a6 6 0 0 1 12-3 6 6 0 0 1 12 3c0 8-12 15-12 15z', 'M6 46l12-4 14 6 14-6 12 4', 'M6 54h52'] },
  fellowship: { label: 'Neighbors', paths: ['M22 24a6 6 0 1 0 0.01 0', 'M42 24a6 6 0 1 0 0.01 0', 'M10 52c0-10 6-16 12-16s12 6 12 16', 'M30 52c0-10 6-16 12-16s12 6 12 16'] },
  fundraising: { label: 'Giving jar', paths: ['M20 20h24v6c6 4 8 10 8 16v10H12V42c0-6 2-12 8-16z', 'M18 14h28v6H18z', 'M32 32v14', 'M28 36h6a3 3 0 0 1 0 6h-4'] },
  calendar: { label: 'Calendar', paths: ['M10 16h44v40H10z', 'M10 26h44', 'M22 8v12', 'M42 8v12', 'M20 36h6', 'M30 36h6', 'M40 36h6', 'M20 46h6', 'M30 46h6'] },
};

/** Keywords in the event's name or description, checked in order before the category. */
const ICON_KEYWORDS: readonly [RegExp, FlyerIconKind][] = [
  [/fish|lent(en)? (dinner|supper)|seafood/i, 'fish'],
  [/pancake|breakfast|brunch|waffle/i, 'breakfast'],
  [/blood/i, 'blood'],
  [/coat|clothing|food drive|pantry|tootsie|collection|drive\b/i, 'drive'],
  [/festival|fair|carnival|picnic|bbq|barbecue|cook[- ]?out/i, 'festival'],
  [/mass|rosary|prayer|adoration|retreat|vigil|novena|holy hour/i, 'faith'],
];

/** The icon for each event Category (Seed.sql). */
const CATEGORY_ICONS: Readonly<Record<string, FlyerIconKind>> = {
  Fellowship: 'fellowship',
  Service: 'service',
  'Faith Building': 'faith',
  Evangelization: 'faith',
  'Parish Community': 'festival',
  Fundraising: 'fundraising',
};

/** The fallback icon for an event: a keyword in its name or description, else its category, else a calendar. */
export function flyerIconFor(event: Pick<Event, 'EventName' | 'EventDescription'>, categoryName?: string | null): FlyerIconKind {
  const text = `${event.EventName} ${event.EventDescription ?? ''}`;
  for (const [pattern, kind] of ICON_KEYWORDS) if (pattern.test(text)) return kind;
  return (categoryName && CATEGORY_ICONS[categoryName]) || 'calendar';
}

// ---- past editions -----------------------------------------------------------------

/** An event series key: the name lower-cased, four-digit years and punctuation dropped ("Fish Fry 2025" = "fish fry"). */
export const eventSeriesKey = (name: string): string =>
  name
    .toLowerCase()
    .replace(/\b(19|20)\d{2}\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/**
 * The earlier editions of `target` among `events`: the same series key and an earlier start date, newest first. An
 * event copied with events.copy keeps its name, so a duplicated event finds the one it was copied from.
 */
export function pastEditions<E extends Pick<Event, 'id' | 'EventName' | 'StartDate'>>(target: Pick<Event, 'id' | 'EventName' | 'StartDate'>, events: readonly E[]): E[] {
  const key = eventSeriesKey(target.EventName);
  if (key === '') return [];
  return events
    .filter((e) => e.id !== target.id && e.StartDate < target.StartDate && eventSeriesKey(e.EventName) === key)
    .sort((a, b) => b.StartDate.localeCompare(a.StartDate) || b.id - a.id);
}

/** A recurring edition: flagged annual (Event.IsAnnual), or an earlier edition exists. */
export const isRecurringEdition = (target: Pick<Event, 'IsAnnual'>, editions: readonly unknown[]): boolean => target.IsAnnual === 1 || editions.length > 0;

/**
 * The photo references saved on past editions (Event.PhotoGalleryURL), newest edition first, without repeats, at most
 * `max`. Browser blob links are left out: they only lived in the session that made them.
 */
export function pastEditionPhotos(editions: readonly Pick<Event, 'PhotoGalleryURL'>[], max = FLYER_MAX_PHOTOS): string[] {
  const out: string[] = [];
  for (const e of editions) {
    for (const ref of parsePhotoGallery(e.PhotoGalleryURL)) {
      if (out.length >= max) return out;
      if (!/^blob:/i.test(ref) && !out.includes(ref)) out.push(ref);
    }
  }
  return out;
}

/** The distinct names of past editions, newest first: each one's Media / <name> folder in the Drive vault is scanned. */
export const pastEditionFolderNames = (editions: readonly Pick<Event, 'EventName'>[]): string[] => [...new Set(editions.map((e) => e.EventName.trim()))];

// ---- copy and facts ----------------------------------------------------------------

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** 'Saturday, March 14, 2026'. */
function longDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${DAY_NAMES[new Date(y, m - 1, d).getDay()]}, ${MONTH_NAMES[m - 1]} ${d}, ${y}`;
}

/** '17:30:00' -> '5:30 PM'. */
function clockTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

export const FLYER_DATE_PLACEHOLDER = '[DATE]';
export const FLYER_TIME_PLACEHOLDER = '[TIME]';
export const FLYER_ADDRESS_PLACEHOLDER = '[ADDRESS]';

export interface FlyerFacts {
  date: string;
  time: string;
  address: string;
}

/**
 * The flyer's three large facts. Date: the event's days. Time: the earliest shift start to the latest shift end on the
 * first day (events carry dates only; shifts carry the hours). Address: Event.Location. Missing facts are placeholders.
 */
export function flyerFacts(event: Pick<Event, 'StartDate' | 'EndDate' | 'Location'>, shifts: readonly Pick<Shift, 'ShiftDate' | 'StartTime' | 'EndTime'>[]): FlyerFacts {
  const start = event.StartDate?.slice(0, 10) ?? '';
  const end = event.EndDate?.slice(0, 10) ?? start;
  const date = !start ? FLYER_DATE_PLACEHOLDER : end && end !== start ? `${longDate(start)} – ${longDate(end)}` : longDate(start);
  const firstDay = shifts.filter((s) => s.ShiftDate.slice(0, 10) === start);
  let time = FLYER_TIME_PLACEHOLDER;
  if (firstDay.length > 0) {
    const from = firstDay.map((s) => s.StartTime).sort()[0];
    const to = firstDay.map((s) => s.EndTime).sort().at(-1)!;
    time = `${clockTime(from)} – ${clockTime(to)}`;
  }
  return { date, time, address: event.Location?.trim() || FLYER_ADDRESS_PLACEHOLDER };
}

export interface FlyerCopy {
  headline: string;
  subhead: string;
  body: string;
  callToAction: string;
  /** The host line under the facts: the council's name, never an emblem or an endorsement. */
  hostLine: string;
}

const CALLS_TO_ACTION: Readonly<Record<FlyerIconKind, string>> = {
  fish: 'Come hungry, bring the family - all are welcome.',
  breakfast: 'Pull up a chair, bring the family - all are welcome.',
  drive: 'Bring a gift and join us - all are welcome.',
  blood: 'Roll up a sleeve and join us - all are welcome.',
  festival: 'Bring the whole family and join us - all are welcome.',
  faith: 'Come pray with us - all are welcome.',
  service: 'Lend a hand and join us - all are welcome.',
  fellowship: 'Join us and meet your neighbors - all are welcome.',
  fundraising: 'Join us and support the cause - all are welcome.',
  calendar: 'Join us - all are welcome.',
};

/**
 * Public-event flyer copy from the event's own words. A recurring edition says the tradition is back; nothing else is
 * claimed, so no number, testimonial or endorsement is ever invented.
 */
export function composeFlyerCopy(input: {
  event: Pick<Event, 'EventName' | 'EventDescription'>;
  icon: FlyerIconKind;
  recurring: boolean;
  councilName: string;
}): FlyerCopy {
  const description = input.event.EventDescription?.trim() ?? '';
  return {
    headline: input.event.EventName.trim(),
    subhead: input.recurring ? 'A parish tradition returns - join us again this year!' : 'You and your family are invited!',
    body: description || 'Join the Knights and your parish neighbors for a day of faith, family and community.',
    callToAction: CALLS_TO_ACTION[input.icon],
    hostLine: `Hosted by the Knights of Columbus, ${input.councilName.trim()}`,
  };
}

/** The marketing-factory skill's jargon scan (section 3.1): every banned term found in `text`, lower-cased. */
export function marketingJargonHits(text: string): string[] {
  const banned =
    /resource allocation|operational efficiency|labou?r units?|\bmodules?\b|headcount|human resources|\bftes?\b|\bend users?\b|\bcustomers?\b|cost cent(er|re)|overhead reduction|throughput|utili[sz]ation|leverage|synerg\w*|disrupt\w*/gi;
  return [...new Set((text.match(banned) ?? []).map((t) => t.toLowerCase()))];
}

/** Placeholders still showing in the facts, so the page can warn before printing. */
export const flyerPlaceholders = (facts: FlyerFacts): string[] =>
  [facts.date, facts.time, facts.address].filter((v) => /^\[[A-Z ]+\]$/.test(v.trim()));

// ---- the printable layout --------------------------------------------------------

export interface FlyerLayout {
  copy: FlyerCopy;
  facts: FlyerFacts;
  /** Image sources ready for <img src>, at most FLYER_MAX_PHOTOS are drawn. Empty: the icon is drawn instead. */
  photos: readonly string[];
  icon: FlyerIconKind;
}

const escapeHtml = (text: string): string =>
  text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Only http(s) and same-site paths are embedded, so a stored reference can never inject a script URL. */
const safeImageSrc = (src: string): string | null => (/^(https?:\/\/|\/(?!\/))/i.test(src.trim()) ? src.trim() : null);

/** The icon as inline SVG, gold strokes on navy. */
export function flyerIconSvg(kind: FlyerIconKind, size = 160): string {
  const icon = FLYER_ICONS[kind];
  const paths = icon.paths.map((d) => `<path d="${escapeHtml(d)}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}" fill="none" stroke="${BRAND.gold}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="${escapeHtml(icon.label)}">${paths}</svg>`;
}

/**
 * The finished flyer: one self-contained, letter-size printable HTML page (inline styles only, no scripts). Navy frame,
 * gold rules, flat white content surface; the date, time and address are the largest type after the headline.
 */
export function buildFlyerHtml(layout: FlyerLayout): string {
  const { copy, facts } = layout;
  const photos = layout.photos.map(safeImageSrc).filter((s): s is string => s !== null).slice(0, FLYER_MAX_PHOTOS);
  const media =
    photos.length > 0
      ? `<div class="photos photos-${photos.length}">${photos
          .map((src, i) => `<img src="${escapeHtml(src)}" alt="Photo ${i + 1} from a past ${escapeHtml(copy.headline)}" referrerpolicy="no-referrer">`)
          .join('')}</div>`
      : `<div class="icon-frame">${flyerIconSvg(layout.icon)}</div>`;
  const fact = (label: string, value: string) =>
    `<div class="fact"><span class="fact-label">${label}</span><span class="fact-value">${escapeHtml(value)}</span></div>`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(copy.headline)} - Flyer</title>
<style>
  @page { size: letter; margin: 0.4in; }
  * { box-sizing: border-box; }
  html, body { margin: 0; background: ${BRAND.white}; color: ${BRAND.navy}; font-family: ${FONT_BODY}; }
  .sheet { max-width: 7.7in; margin: 0 auto; border: 10px solid ${BRAND.navy}; outline: 4px solid ${BRAND.gold}; outline-offset: -18px; padding: 0.45in 0.45in 0.35in; }
  h1 { font-family: ${FONT_HEADING}; font-size: 44pt; line-height: 1.05; margin: 0 0 8px; text-align: center; }
  .subhead { font-size: 18pt; font-weight: 700; text-align: center; margin: 0 0 14px; }
  .rule { height: 8px; background: ${BRAND.gold}; margin: 12px 0; }
  .photos { display: grid; gap: 8px; margin: 12px 0; }
  .photos-1 { grid-template-columns: 1fr; }
  .photos-2, .photos-4 { grid-template-columns: 1fr 1fr; }
  .photos-3 { grid-template-columns: 2fr 1fr 1fr; }
  .photos img { width: 100%; height: 2.1in; object-fit: cover; border: 4px solid ${BRAND.navy}; display: block; background: ${BRAND.navy}; }
  .photos-1 img { height: 3.2in; }
  .icon-frame { margin: 12px auto; width: 2.6in; height: 2.6in; display: flex; align-items: center; justify-content: center; background: ${BRAND.navy}; border: 4px dashed ${BRAND.gold}; border-radius: 12px; }
  .body { font-size: 15pt; line-height: 1.4; text-align: center; margin: 12px 0; }
  .facts { background: ${BRAND.navy}; color: ${BRAND.white}; border-left: 14px solid ${BRAND.gold}; padding: 14px 18px; margin: 14px 0; }
  .fact { display: flex; flex-direction: column; padding: 6px 0; }
  .fact + .fact { border-top: 2px solid ${BRAND.gold}; }
  .fact-label { font-size: 12pt; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: ${BRAND.gold}; }
  .fact-value { font-size: 26pt; font-weight: 800; line-height: 1.15; }
  .cta { font-family: ${FONT_HEADING}; font-size: 22pt; font-weight: 700; text-align: center; background: ${BRAND.gold}; color: ${BRAND.navy}; padding: 10px 14px; margin: 14px 0 10px; }
  .host { font-size: 12pt; font-weight: 700; text-align: center; margin: 0; }
  @media print { html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .sheet { max-width: none; } }
</style>
</head>
<body>
<main class="sheet">
  <h1>${escapeHtml(copy.headline)}</h1>
  <p class="subhead">${escapeHtml(copy.subhead)}</p>
  <div class="rule"></div>
  ${media}
  <p class="body">${escapeHtml(copy.body)}</p>
  <section class="facts" aria-label="When and where">
    ${fact('Date', facts.date)}
    ${fact('Time', facts.time)}
    ${fact('Address', facts.address)}
  </section>
  <p class="cta">${escapeHtml(copy.callToAction)}</p>
  <p class="host">${escapeHtml(copy.hostLine)}</p>
</main>
</body>
</html>
`;
}

/** The file name a flyer is saved under: the event name in lower-case words, then -flyer.html. */
export const flyerFileName = (eventName: string): string =>
  `${
    eventName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'event'
  }-flyer.html`;
