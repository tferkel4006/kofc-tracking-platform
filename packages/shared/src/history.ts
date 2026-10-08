// =========================================================================
// COUNCIL HISTORY ANNALS, THE SPIRITUAL DIARY AND ORAL HISTORY TESTIMONIALS (Sprint 6K)
// Pure helpers behind history.getLegacyMatrix, saveYearAnnals and addDiaryEntry, and the browser recorder on the Team
// Legacy dashboard (/history). Drivers load rows, call these, then only store.
//
// The dashboard is a team record: each fraternal year shows its seated officer core (CouncilLeadershipHistory) beside
// the year's collective accomplishments and team metrics. No member's hours, signups or scores are read here.
// =========================================================================
import type { CouncilAnnalsInput, CouncilFounding, CouncilLegacyMatrix, DiaryEntryDetail, LegacyOfficerSeat, LegacyYear, NewDiaryEntryInput } from './contract';
import { assertFraternalYear, currentFraternalYear } from './budget';
import { isDriveFileId } from './drive-vault';
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

/**
 * history.saveYearAnnals: the council's history keepers - its Active officers (any Role with Officer = 1) and Admins - and
 * any Active Super Admin. `action` completes "cannot ...".
 */
export function assertMayKeepCouncilAnnals(actor: MemberWriteActor, councilId: number, action: string): void {
  const denial = annalsDenial(actor, councilId, action);
  if (denial) throw denial;
}

function annalsDenial(actor: MemberWriteActor, councilId: number, action: string): SecurityPrivilegeError | null {
  if (hasSuperAdminRights(actor)) return null;
  if (!hasAdminRights(actor) && !(actor.active && actor.officer)) {
    return new SecurityPrivilegeError(
      'HISTORY_KEEPER_REQUIRED',
      `Only an active officer, Admin or Super Admin can ${action}; member ${actor.memberId} is ${describeActor(actor)} without an officer seat.`,
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
    diary_text: assertText(input.diary_text, 'Diary entry', DIARY_TEXT_MAX_LENGTH),
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
