// =========================================================================
// COUNCIL HISTORY ANNALS, THE SPIRITUAL DIARY AND ORAL HISTORY TESTIMONIALS (Sprint 6K)
// Pure helpers behind history.getLegacyMatrix, saveYearAnnals and addDiaryEntry, and the browser recorder on the Team
// Legacy dashboard (/history). Drivers load rows, call these, then only store.
// Sprint 6L adds the Council Historian's write access, the year-end closing metrics elections.concludeFraternalYear bakes
// into team_metrics_summary, and the diary content guard.
//
// The dashboard is a team record: each fraternal year shows its seated officer core (CouncilLeadershipHistory) beside
// the year's collective accomplishments and team metrics. No member's hours, signups or scores are read here.
// =========================================================================
import type {
  ClosingOfficerSeat,
  CouncilAnnalsInput,
  CouncilFounding,
  CouncilLegacyMatrix,
  DiaryEntryDetail,
  FraternalYearClosingMetrics,
  LegacyOfficerSeat,
  LegacyYear,
  NewDiaryEntryInput,
} from './contract';
import { assertFraternalYear, currentFraternalYear, fraternalYearBounds } from './budget';
import { isDriveFileId } from './drive-vault';
import { COUNCIL_HISTORIAN_ROLE } from './elections';
import {
  assertIsoDate,
  assertText,
  BusinessRuleError,
  describeActor,
  hasAdminRights,
  hasSuperAdminRights,
  SecurityPrivilegeError,
  toIsoDate,
  type MemberWriteActor,
} from './rules';
import type { CouncilHistoryAnnals, CouncilLeadershipHistory, CouncilSpiritualDiary, Member, Role } from './types';

/** Longest collective_accomplishments or team_metrics_summary. */
export const HISTORY_TEXT_MAX_LENGTH = 8000;
/** Longest CouncilHistoryAnnals.original_chaplain (VARCHAR(200)). */
export const ORIGINAL_CHAPLAIN_MAX_LENGTH = 200;
/** Longest diary entry. */
export const DIARY_TEXT_MAX_LENGTH = 4000;
/** Longest charter_photo_url or audio_asset_url (VARCHAR(2000)). */
export const HISTORY_ASSET_URL_MAX_LENGTH = 2000;
/** The recorder stops itself after this many seconds (10 minutes keeps a testimonial well under the vault's 25 MB). */
export const ORAL_HISTORY_MAX_SECONDS = 600;
/** The recorder's target bit rate: Opus speech at 32 kbps is about 240 KB a minute. */
export const ORAL_HISTORY_BITS_PER_SECOND = 32_000;
/**
 * Compressed audio formats the recorder asks MediaRecorder for, best first: Opus in WebM (Chrome, Edge, Firefox), Opus in
 * Ogg (Firefox), then AAC in MP4 (Safari).
 */
export const ORAL_HISTORY_MIME_TYPES: readonly string[] = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/webm'];

const invalid = (message: string, details: Record<string, unknown> = {}) => new BusinessRuleError('INVALID_INPUT', message, details);

// ---- access ---------------------------------------------------------------------------------------------------

/**
 * history.getLegacyMatrix and addDiaryEntry: any Active member of the council, or an Active Super Admin for any council.
 * `action` completes "cannot ...".
 */
export function assertMayReadCouncilHistory(actor: MemberWriteActor, councilId: number, action: string): void {
  if (hasSuperAdminRights(actor)) return;
  if (actor.active && actor.councilId === councilId) return;
  throw new SecurityPrivilegeError(
    'COUNCIL_ACCESS_DENIED',
    `Only active members of council ${councilId} can ${action}; member ${actor.memberId} is ${describeActor(actor)} of council ${actor.councilId}.`,
    { actorId: actor.memberId, actorCouncilId: actor.councilId, councilId },
  );
}

/** assertMayKeepCouncilAnnals as a yes/no. */
export const mayKeepCouncilAnnals = (actor: MemberWriteActor, councilId: number): boolean => annalsDenial(actor, councilId, 'keep the annals') === null;

/** Holds the Council Historian role (Sprint 6L). */
export const holdsHistorianRole = (roles: readonly string[] | undefined): boolean => (roles ?? []).includes(COUNCIL_HISTORIAN_ROLE);

/**
 * history.saveYearAnnals: the council's history keepers - its Active officers (any Role with Officer = 1), its Active
 * Council Historian (Sprint 6L) and its Admins - and any Active Super Admin. `action` completes "cannot ...".
 */
export function assertMayKeepCouncilAnnals(actor: MemberWriteActor, councilId: number, action: string): void {
  const denial = annalsDenial(actor, councilId, action);
  if (denial) throw denial;
}

function annalsDenial(actor: MemberWriteActor, councilId: number, action: string): SecurityPrivilegeError | null {
  if (hasSuperAdminRights(actor)) return null;
  if (!hasAdminRights(actor) && !(actor.active && (actor.officer || holdsHistorianRole(actor.roles)))) {
    return new SecurityPrivilegeError(
      'HISTORY_KEEPER_REQUIRED',
      `Only an active officer, the Council Historian, an Admin or a Super Admin can ${action}; member ${actor.memberId} is ${describeActor(actor)} without an officer seat or the Council Historian role.`,
      { actorId: actor.memberId },
    );
  }
  if (actor.councilId !== councilId) {
    return new SecurityPrivilegeError('COUNCIL_ACCESS_DENIED', `Member ${actor.memberId} of council ${actor.councilId} cannot ${action} of council ${councilId}.`, {
      actorId: actor.memberId,
      actorCouncilId: actor.councilId,
      councilId,
    });
  }
  return null;
}

// ---- validation -----------------------------------------------------------------------------------------------

/** An optional prose field: undefined keeps, null or blank clears, otherwise trimmed text of at most `max` characters. */
function optionalText(value: unknown, label: string, max: number): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const text = assertText(value, label, max, false);
  return text === '' ? null : text;
}

/**
 * A stored asset reference: a bare Google Drive file id or an https link, and for audio also a browser blob link (what
 * the recorder keeps while the vault is switched off). Rejects INVALID_INPUT otherwise.
 */
export function cleanHistoryAssetUrl(value: unknown, label: string, allowBlob: boolean): string | null | undefined {
  const text = optionalText(value, label, HISTORY_ASSET_URL_MAX_LENGTH);
  if (text == null) return text;
  if (isDriveFileId(text) || /^https:\/\/[^\s]+$/i.test(text) || (allowBlob && /^blob:[^\s]+$/i.test(text))) return text;
  throw invalid(`${label} must be a Google Drive file id or an https link${allowBlob ? ' (or a recording kept in this browser)' : ''}.`, { label });
}

/** history.saveYearAnnals's input, cleaned; omitted fields stay undefined so the stored value is kept. */
export function cleanCouncilAnnals(input: CouncilAnnalsInput): CouncilAnnalsInput {
  if (input === null || typeof input !== 'object') throw invalid('The annals must be an object.');
  const date = input.establishment_date;
  return {
    establishment_date: date === undefined ? undefined : date === null || date === '' ? null : assertIsoDate(date, 'Establishment date'),
    original_chaplain: optionalText(input.original_chaplain, 'Original chaplain', ORIGINAL_CHAPLAIN_MAX_LENGTH),
    charter_photo_url: cleanHistoryAssetUrl(input.charter_photo_url, 'Charter photo', false),
    collective_accomplishments: optionalText(input.collective_accomplishments, 'Collective accomplishments', HISTORY_TEXT_MAX_LENGTH),
    team_metrics_summary: optionalText(input.team_metrics_summary, 'Team metrics summary', HISTORY_TEXT_MAX_LENGTH),
  };
}

/** The annals row after applying `clean` to `existing` (or to an empty year). */
export function mergeCouncilAnnals(
  existing: CouncilHistoryAnnals | null,
  clean: CouncilAnnalsInput,
): Required<Pick<CouncilHistoryAnnals, 'establishment_date' | 'original_chaplain' | 'charter_photo_url' | 'collective_accomplishments' | 'team_metrics_summary'>> {
  const pick = <K extends keyof CouncilAnnalsInput>(key: K): string | null => (clean[key] !== undefined ? (clean[key] ?? null) : (existing?.[key] ?? null));
  return {
    establishment_date: pick('establishment_date'),
    original_chaplain: pick('original_chaplain'),
    charter_photo_url: pick('charter_photo_url'),
    collective_accomplishments: pick('collective_accomplishments'),
    team_metrics_summary: pick('team_metrics_summary'),
  };
}

/** The diary row history.addDiaryEntry writes for `today` (local date). */
export function cleanDiaryEntry(
  input: NewDiaryEntryInput,
  today: Date,
): Pick<CouncilSpiritualDiary, 'entry_date' | 'fraternal_year' | 'diary_text' | 'audio_asset_url'> {
  if (input === null || typeof input !== 'object') throw invalid('The diary entry must be an object.');
  return {
    entry_date: toIsoDate(today),
    fraternal_year: input.fraternal_year === undefined ? currentFraternalYear(today) : assertFraternalYear(input.fraternal_year),
    diary_text: assertDiaryTextAllowed(assertText(input.diary_text, 'Diary entry', DIARY_TEXT_MAX_LENGTH)),
    audio_asset_url: cleanHistoryAssetUrl(input.audio_asset_url, 'Oral history recording', true) ?? null,
  };
}

/** Refuses DIARY_ENTRY_EXISTS when the member already wrote an entry on `entryDate`. */
export function assertDiaryDayFree(entries: readonly Pick<CouncilSpiritualDiary, 'user_id' | 'entry_date'>[], memberId: number, entryDate: string): void {
  if (entries.some((e) => e.user_id === memberId && e.entry_date === entryDate)) {
    throw new BusinessRuleError('DIARY_ENTRY_EXISTS', `Member ${memberId} already wrote a diary entry on ${entryDate}; one entry per day is allowed.`, {
      memberId,
      entryDate,
    });
  }
}

// ---- the diary content guard (Sprint 6L) ----------------------------------------------------------------------

/** Why a diary entry was refused. */
export type DiaryContentCategory = 'profanity' | 'political' | 'hate';

/**
 * Words and phrases the council diary refuses, matched as whole words, ignoring case, accents and common letter swaps
 * (sh1t, @sshole). Deliberately left out because they are ordinary in a Catholic diary or in Scripture: hell, damn,
 * damnation, ass (the donkey), bastard, harlot, whore, prick (Acts 9:5), and the words vote, election, liberal and
 * conservative (the council holds its own elections). Common first names and surnames are left out too.
 */
export const DIARY_BLOCKED_PATTERNS: Readonly<Record<DiaryContentCategory, readonly RegExp[]>> = {
  profanity: [
    /\b(mother)?f(u|\*)(c|\*)?k+(s|ed|er|ers|in|ing|ingly|off|up|wit)?\b/,
    /\bf\*+k\w*/,
    /\b(bull|horse|dip|chicken)?sh(i|\*)t(s|ty|ter|head|heads|hole|holes|faced|show)?\b/,
    /\b(dumb|jack|smart|kick|bad|hard|lard|fat|wise)?a(s|\*){2}holes?\b/,
    /\bbitch(es|y|ing|ed)?\b/,
    /\bdickheads?\b/,
    /\bcunts?\b/,
    /\bcock ?suck(er|ers|ing)?\b/,
    /\bpiss(ed|es|ing)?\b/,
    /\bsluts?\b|\bslutty\b/,
    /\bwank(er|ers|ing)?\b/,
    /\btwats?\b/,
    /\bgod ?damn(ed|it)?\b/,
    /\bdam+n?it\b/,
    /\b(wtf|stfu|gtfo)\b/,
  ],
  political: [
    /\b(democrats?|democratic party|dems)\b/,
    /\b(republicans?|republican party|gop)\b/,
    /\bmaga\b/,
    /\b(trump|biden|obama)\b/,
    /\b(libtards?|repugs?|dumbocrats?|demonrats?|rethuglicans?)\b/,
    /\b(far|radical|alt)[- ](left|right)\b/,
    /\b(left|right)[- ]wing(ers?)?\b/,
    /\bantifa\b/,
    /\bproud boys\b/,
    /\bimpeach(ed|ment)?\b/,
  ],
  hate: [
    /\bn[i!][gq]{2}(er|ers|a|as|ah|az|uh)\b/,
    /\bkikes?\b/,
    /\bspics?\b/,
    /\bwetbacks?\b/,
    /\bbeaners?\b/,
    /\bgooks?\b/,
    /\b(rag|towel)heads?\b/,
    /\bfag(s|got|gots|gy)?\b/,
    /\btrann(y|ie|ies)\b/,
    /\bretard(s|ed)?\b/,
    /\bheil hitler\b|\bsieg heil\b/,
    /\bwhite (power|pride)\b/,
    /\b(death|kill all|gas) (to )?(the )?(jews|muslims|christians|catholics|blacks|whites|gays|immigrants)\b/,
    /\bsub ?humans?\b/,
  ],
};

/** What each category reads as in the refusal message. */
const DIARY_CATEGORY_LABEL: Record<DiaryContentCategory, string> = {
  profanity: 'foul or vulgar language',
  political: 'overt political content',
  hate: 'hateful language',
};

const LETTER_SWAPS: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', $: 's', '!': 'i' };

/** The forms of `text` the patterns run against: plain lower case, and with digit and symbol letter swaps undone. */
function diaryScanForms(text: string): string[] {
  const plain = text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ');
  const unswapped = plain.replace(/[013457@$!]/g, (c) => LETTER_SWAPS[c]);
  return unswapped === plain ? [plain] : [plain, unswapped];
}

/** The first category `text` breaks, or null when the diary may store it. */
export function findDiaryContentViolation(text: string): DiaryContentCategory | null {
  const forms = diaryScanForms(text);
  for (const category of Object.keys(DIARY_BLOCKED_PATTERNS) as DiaryContentCategory[]) {
    if (DIARY_BLOCKED_PATTERNS[category].some((pattern) => forms.some((form) => pattern.test(form)))) return category;
  }
  return null;
}

/**
 * Refuses DIARY_CONTENT_BLOCKED, before anything is stored, when `text` contains foul language, vulgarity, overt political
 * keywords or hate speech. The message names the kind of language but never repeats the word. Returns `text`.
 */
export function assertDiaryTextAllowed(text: string): string {
  const category = findDiaryContentViolation(text);
  if (category) {
    throw new BusinessRuleError(
      'DIARY_CONTENT_BLOCKED',
      `This diary entry was not saved because it contains ${DIARY_CATEGORY_LABEL[category]}. The council diary is a spiritual record, so please reword the entry and save it again.`,
      { category },
    );
  }
  return text;
}

// ---- year-end closing metrics (Sprint 6L) ---------------------------------------------------------------------

/** The rows a driver loads for one council's closing metrics; buildYearClosingMetrics keeps only the year's dates. */
export interface YearClosingRows {
  roles: readonly Pick<Role, 'id' | 'Role' | 'Officer'>[];
  /** The council's members (names, and DateJoinedCouncil for the new-member count). */
  members: readonly Pick<Member, 'id' | 'MemberFirstName' | 'MemberLastName' | 'DateJoinedCouncil'>[];
  /** The council's CouncilLeadershipHistory rows, read before the conclusion closes any term. */
  leadership: readonly CouncilLeadershipHistory[];
  /** The council's events (EventCouncils). */
  events: readonly { StartDate: string; 'FundsRaised-Cash'?: number | null; 'FundsRaised-Electronic'?: number | null; ActualNumberAttendees?: number | null }[];
  /** EventTime on the council's events, with the shift's date. */
  eventTime: readonly { MemberID: number; Hours: number; ShiftDate: string }[];
  /** ActivityTime on the council's activities. */
  activityTime: readonly { MemberID: number; Hours: number; ActivityDate: string }[];
  /** The council's CharitableDisbursementLedger checks. */
  charitableGifts: readonly { Amount: number; PayoutDate: string }[];
  /** The council's meetings. */
  meetings: readonly { Date: string }[];
}

const cents = (values: readonly (number | null | undefined)[]): number => values.reduce<number>((t, v) => t + Math.round((v ?? 0) * 100), 0) / 100;

/**
 * The closing metrics of `fraternalYear`, concluded on `today`. The officer roster is every officer term (Role.Officer = 1)
 * filed under that year, plus every officer term still open when the year concluded (the outgoing chairs, even when their
 * row was opened under a later year label).
 */
export function buildYearClosingMetrics(councilId: number, fraternalYear: string, rows: YearClosingRows, today: Date): FraternalYearClosingMetrics {
  const year = assertFraternalYear(fraternalYear);
  const { fromDate, toDate } = fraternalYearBounds(year);
  const inYear = (date: string | null | undefined) => typeof date === 'string' && date.slice(0, 10) >= fromDate && date.slice(0, 10) <= toDate;
  const role = new Map(rows.roles.map((r) => [r.id, r]));
  const member = new Map(rows.members.map((m) => [m.id, m]));

  const officers: ClosingOfficerSeat[] = rows.leadership
    .filter((h) => h.CouncilID === councilId && role.get(h.RoleID)?.Officer === 1 && (h.FraternalYear === year || h.EndDate == null))
    .sort((a, b) => a.RoleID - b.RoleID || a.StartDate.localeCompare(b.StartDate) || a.id - b.id)
    .map((h) => ({
      roleName: role.get(h.RoleID)?.Role ?? `Role ${h.RoleID}`,
      memberId: h.MemberID,
      firstName: member.get(h.MemberID)?.MemberFirstName ?? '',
      lastName: member.get(h.MemberID)?.MemberLastName ?? `Member ${h.MemberID}`,
      steppedDown: h.ExitReason === 'Abdicated',
    }));

  const eventTime = rows.eventTime.filter((t) => inYear(t.ShiftDate));
  const activityTime = rows.activityTime.filter((t) => inYear(t.ActivityDate));
  const eventHours = cents(eventTime.map((t) => t.Hours));
  const activityHours = cents(activityTime.map((t) => t.Hours));
  const events = rows.events.filter((e) => inYear(e.StartDate));
  const cash = cents(events.map((e) => e['FundsRaised-Cash']));
  const electronic = cents(events.map((e) => e['FundsRaised-Electronic']));

  return {
    councilId,
    fraternalYear: year,
    fromDate,
    toDate,
    compiledOn: toIsoDate(today),
    officers,
    volunteerHours: { events: eventHours, activities: activityHours, total: cents([eventHours, activityHours]) },
    volunteers: new Set([...eventTime, ...activityTime].map((t) => t.MemberID)).size,
    fundsRaised: { cash, electronic, total: cents([cash, electronic]) },
    charitableGiving: cents(rows.charitableGifts.filter((g) => inYear(g.PayoutDate)).map((g) => g.Amount)),
    eventsHeld: events.length,
    attendees: events.reduce((n, e) => n + (e.ActualNumberAttendees ?? 0), 0),
    meetingsHeld: rows.meetings.filter((m) => inYear(m.Date)).length,
    newMembers: rows.members.filter((m) => inYear(m.DateJoinedCouncil)).length,
  };
}

/** The first words of the automatic block; composeYearClosingSummary finds an earlier block by them. */
export const YEAR_CLOSING_HEADER = 'Year-end closing metrics';
/** The last line of the automatic block. */
export const YEAR_CLOSING_FOOTER = '(End of the year-end closing metrics. Notes written by the history keepers follow.)';

const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const count = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 });

/** The automatic block of plain text that opens the year's team_metrics_summary. */
export function formatYearClosingMetrics(m: FraternalYearClosingMetrics): string {
  const roster = m.officers.length
    ? m.officers.map((o) => `- ${o.roleName}: ${`${o.firstName} ${o.lastName}`.trim()}${o.steppedDown ? ' (stepped down)' : ''}`)
    : ['- No officer terms were recorded for this year.'];
  return [
    `${YEAR_CLOSING_HEADER} for ${m.fraternalYear} (${m.fromDate} to ${m.toDate}), compiled automatically when the year concluded on ${m.compiledOn}.`,
    'Seated officers:',
    ...roster,
    `Volunteer hours: ${count(m.volunteerHours.total)} (${count(m.volunteerHours.events)} at events, ${count(m.volunteerHours.activities)} in council activities) from ${count(m.volunteers)} ${m.volunteers === 1 ? 'member' : 'members'}.`,
    `Funds raised at events: ${money(m.fundsRaised.total)} (${money(m.fundsRaised.cash)} cash, ${money(m.fundsRaised.electronic)} electronic).`,
    `Charitable giving paid out: ${money(m.charitableGiving)}.`,
    `Events held: ${count(m.eventsHeld)}, with ${count(m.attendees)} ${m.attendees === 1 ? 'attendee' : 'attendees'}. Meetings held: ${count(m.meetingsHeld)}. New members: ${count(m.newMembers)}.`,
    YEAR_CLOSING_FOOTER,
  ].join('\n');
}

/**
 * The year's team_metrics_summary with the closing metrics baked in: an earlier automatic block (a repeat conclusion) is
 * replaced, and anything the history keepers wrote is kept after the block.
 */
export function composeYearClosingSummary(existing: string | null | undefined, metrics: FraternalYearClosingMetrics): string {
  const block = formatYearClosingMetrics(metrics);
  let notes = (existing ?? '').trim();
  const end = notes.indexOf(YEAR_CLOSING_FOOTER);
  if (notes.startsWith(YEAR_CLOSING_HEADER) && end > 0) notes = notes.slice(end + YEAR_CLOSING_FOOTER.length).trim();
  return notes ? `${block}\n\n${notes}` : block;
}

// ---- the recorder ---------------------------------------------------------------------------------------------

/** The first of ORAL_HISTORY_MIME_TYPES the browser can record, or null when none (the recorder then uses its default). */
export function pickOralHistoryMimeType(isTypeSupported: (mimeType: string) => boolean): string | null {
  return ORAL_HISTORY_MIME_TYPES.find((t) => isTypeSupported(t)) ?? null;
}

/** The file name a testimonial is filed under: 'oral-history-2026-2027-member-7-2026-10-08.webm'. */
export function oralHistoryFileName(memberId: number, fraternalYear: string, mimeType: string, today: Date): string {
  const base = mimeType.split(';')[0].trim().toLowerCase();
  const ext = base === 'audio/mp4' ? 'm4a' : base === 'audio/ogg' ? 'ogg' : 'webm';
  return `oral-history-${fraternalYear}-member-${memberId}-${toIsoDate(today)}.${ext}`;
}

// ---- the matrix -----------------------------------------------------------------------------------------------

const byYearDesc = (a: string, b: string) => b.localeCompare(a);

/** history.getLegacyMatrix from the council's rows. */
export function buildCouncilLegacyMatrix(input: {
  councilId: number;
  annals: readonly CouncilHistoryAnnals[];
  leadership: readonly CouncilLeadershipHistory[];
  diary: readonly CouncilSpiritualDiary[];
  roles: readonly Role[];
  members: readonly Pick<Member, 'id' | 'MemberFirstName' | 'MemberLastName'>[];
  actorId: number;
  canKeepAnnals: boolean;
  today: Date;
}): CouncilLegacyMatrix {
  const { councilId, today } = input;
  const annals = input.annals.filter((a) => a.council_id === councilId);
  const leadership = input.leadership.filter((h) => h.CouncilID === councilId);
  const diary = input.diary.filter((d) => d.council_id === councilId);
  const member = new Map(input.members.map((m) => [m.id, m]));
  const role = new Map(input.roles.map((r) => [r.id, r]));
  const current = currentFraternalYear(today);

  const years = [...new Set([current, ...annals.map((a) => a.fraternal_year), ...leadership.map((h) => h.FraternalYear), ...diary.map((d) => d.fraternal_year)])].sort(
    byYearDesc,
  );

  const seatsOf = (year: string): LegacyOfficerSeat[] =>
    leadership
      .filter((h) => h.FraternalYear === year && role.get(h.RoleID)?.Officer === 1)
      .sort((a, b) => a.RoleID - b.RoleID || a.StartDate.localeCompare(b.StartDate) || a.id - b.id)
      .map((h) => ({
        roleName: role.get(h.RoleID)?.Role ?? `Role ${h.RoleID}`,
        memberId: h.MemberID,
        firstName: member.get(h.MemberID)?.MemberFirstName ?? '',
        lastName: member.get(h.MemberID)?.MemberLastName ?? `Member ${h.MemberID}`,
        steppedDown: h.ExitReason === 'Abdicated',
      }));

  const diaryOf = (year: string): DiaryEntryDetail[] =>
    diary
      .filter((d) => d.fraternal_year === year)
      .sort((a, b) => a.entry_date.localeCompare(b.entry_date) || a.id - b.id)
      .map((entry) => ({
        entry: { ...entry },
        authorFirstName: member.get(entry.user_id)?.MemberFirstName ?? '',
        authorLastName: member.get(entry.user_id)?.MemberLastName ?? `Member ${entry.user_id}`,
      }));

  const rows: LegacyYear[] = years.map((fraternalYear) => {
    const row = annals.find((a) => a.fraternal_year === fraternalYear);
    return { fraternalYear, annals: row ? { ...row } : null, officers: seatsOf(fraternalYear), diary: diaryOf(fraternalYear) };
  });

  const oldestFirst = [...annals].sort((a, b) => a.fraternal_year.localeCompare(b.fraternal_year));
  const first = (key: 'establishment_date' | 'original_chaplain' | 'charter_photo_url'): string | null => oldestFirst.find((a) => a[key])?.[key] ?? null;
  const founding: CouncilFounding = {
    establishmentDate: first('establishment_date'),
    originalChaplain: first('original_chaplain'),
    charterPhotoUrl: first('charter_photo_url'),
  };

  const todayIso = toIsoDate(today);
  const mine = diary.find((d) => d.user_id === input.actorId && d.entry_date === todayIso);
  return { councilId, founding, years: rows, canKeepAnnals: input.canKeepAnnals, myEntryToday: mine ? { ...mine } : null, currentFraternalYear: current };
}
