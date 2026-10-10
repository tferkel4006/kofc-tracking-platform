// =========================================================================
// COUNCIL WIDE SETTINGS AND PLATFORM SETTINGS (Sprint 7C, schema 62)
//
// Council Wide Settings are four Council columns that used to be hardcoded numbers:
//   - quarantine_max_daily_activities (DEFAULT 5): more distinct activities than this in one day sends the entry to
//     leadership review (volunteer-quarantine.ts quarantineReasons);
//   - quarantine_max_single_hours (DEFAULT 5.0): more hours than this against one activity in one day sends it to review;
//   - max_shift_padding_hours (DEFAULT 1.0): a shift report may run this many hours over the shift's scheduled length;
//   - inactivity_threshold_days (DEFAULT 365): the inactivity check marks Inactive a member with no logged service in
//     more than this many days (member-lifecycle.ts planInactivitySweep).
// The council's Active Admins and officers (a Role with Officer = 1) edit them on /setup/council-settings, and any
// Super Admin for any council (councils.setCouncilWideSettings).
//
// Platform Settings are the universal limits every council shares, kept in the one-row PlatformSettings table and
// edited by Super Admins on /lookups (councils.setPlatformSettings): the oral history recorder's time cap and the
// character limits of a diary entry and a prayer intention. A limit may not exceed its column's size.
// =========================================================================
import { DIARY_TEXT_MAX_LENGTH, ORAL_HISTORY_MAX_SECONDS } from './history';
import { PRAYER_INTENTION_MAX_LENGTH } from './prayers';
import { BusinessRuleError, describeActor, hasAdminRights, hasSuperAdminRights, HOURS_STEP, SecurityPrivilegeError, type MemberWriteActor } from './rules';
import type { Council, PlatformSettings } from './types';

const invalid = (message: string, details: Record<string, unknown> = {}) => new BusinessRuleError('INVALID_INPUT', message, details);

// ---- council wide settings ------------------------------------------------------------------------------------

export const DEFAULT_QUARANTINE_MAX_DAILY_ACTIVITIES = 5;
export const DEFAULT_QUARANTINE_MAX_SINGLE_HOURS = 5.0;
export const DEFAULT_MAX_SHIFT_PADDING_HOURS = 1.0;
export const DEFAULT_INACTIVITY_THRESHOLD_DAYS = 365;

/** The four Council Wide Settings columns. */
export const COUNCIL_WIDE_SETTING_NAMES = [
  'quarantine_max_daily_activities',
  'quarantine_max_single_hours',
  'max_shift_padding_hours',
  'inactivity_threshold_days',
] as const;
export type CouncilWideSettingName = (typeof COUNCIL_WIDE_SETTING_NAMES)[number];
export type CouncilWideSettings = Record<CouncilWideSettingName, number>;

export const COUNCIL_WIDE_SETTING_DEFAULTS: CouncilWideSettings = {
  quarantine_max_daily_activities: DEFAULT_QUARANTINE_MAX_DAILY_ACTIVITIES,
  quarantine_max_single_hours: DEFAULT_QUARANTINE_MAX_SINGLE_HOURS,
  max_shift_padding_hours: DEFAULT_MAX_SHIFT_PADDING_HOURS,
  inactivity_threshold_days: DEFAULT_INACTIVITY_THRESHOLD_DAYS,
};

/** How each setting is entered: whole numbers or quarter hours, and its range. */
interface SettingRule {
  label: string;
  hint: string;
  min: number;
  max: number;
  /** Quarter hours (HOURS_STEP), like every hours value; otherwise a whole number. */
  quarterHours?: boolean;
  unit: string;
}

export const COUNCIL_WIDE_SETTING_RULES: Record<CouncilWideSettingName, SettingRule> = {
  quarantine_max_daily_activities: {
    label: 'Most activities a member may report in one day',
    hint: 'A report past this number goes to leadership review before it counts.',
    min: 1,
    max: 24,
    unit: 'activities',
  },
  quarantine_max_single_hours: {
    label: 'Most hours a member may report on one activity in one day',
    hint: 'A report past this number of hours goes to leadership review before it counts.',
    min: 0.25,
    max: 24,
    quarterHours: true,
    unit: 'hours',
  },
  max_shift_padding_hours: {
    label: 'Extra hours allowed past a scheduled shift',
    hint: 'A shift report longer than the scheduled shift plus this time goes to leadership review.',
    min: 0,
    max: 8,
    quarterHours: true,
    unit: 'hours',
  },
  inactivity_threshold_days: {
    label: 'Days without service before a member counts as inactive',
    hint: 'Check for Inactive Members marks a member Inactive after this many days with no logged service.',
    min: 30,
    max: 3650,
    unit: 'days',
  },
};

/** The council's stored settings, with the column defaults for missing values. */
export function councilWideSettings(council: Partial<Pick<Council, CouncilWideSettingName>> | null | undefined): CouncilWideSettings {
  const out = { ...COUNCIL_WIDE_SETTING_DEFAULTS };
  for (const name of COUNCIL_WIDE_SETTING_NAMES) {
    const v = council?.[name];
    if (typeof v === 'number' && Number.isFinite(v)) out[name] = v;
  }
  return out;
}

function cleanSetting(rule: SettingRule, name: string, v: unknown): number {
  const ok =
    typeof v === 'number' &&
    Number.isFinite(v) &&
    v >= rule.min &&
    v <= rule.max &&
    (rule.quarterHours ? Number.isInteger(v / HOURS_STEP) : Number.isInteger(v));
  if (!ok) {
    const kind = rule.quarterHours ? `a multiple of ${HOURS_STEP} hours` : 'a whole number';
    throw invalid(`${rule.label} must be ${kind} from ${rule.min} to ${rule.max.toLocaleString('en-US')}; received ${JSON.stringify(v)}.`, { field: name });
  }
  return v as number;
}

/**
 * councils.setCouncilWideSettings' input: one or more of the four settings, each in its range (INVALID_INPUT for a bad
 * value, an unknown field or no field). A field left out keeps its stored value.
 */
export function cleanCouncilWideSettings(input: unknown): Partial<CouncilWideSettings> {
  if (input === null || typeof input !== 'object') throw invalid('Enter at least one council setting.');
  const raw = input as Record<string, unknown>;
  const unknown = Object.keys(raw).filter((k) => !(COUNCIL_WIDE_SETTING_NAMES as readonly string[]).includes(k));
  if (unknown.length > 0) throw invalid(`Unknown council setting: ${unknown.join(', ')}.`, { fields: unknown });
  const out: Partial<CouncilWideSettings> = {};
  for (const name of COUNCIL_WIDE_SETTING_NAMES) {
    if (raw[name] !== undefined) out[name] = cleanSetting(COUNCIL_WIDE_SETTING_RULES[name], name, raw[name]);
  }
  if (Object.keys(out).length === 0) throw invalid('Enter at least one council setting.');
  return out;
}

/** May change the council's Council Wide Settings: its Active Admins and officers, or any Active Super Admin. */
export function mayEditCouncilWideSettings(actor: MemberWriteActor, councilId: number): boolean {
  if (hasSuperAdminRights(actor)) return true;
  if (actor.councilId !== councilId) return false;
  return hasAdminRights(actor) || (actor.active && actor.officer === true);
}

/** Rejects ADMIN_REQUIRED for anyone else, COUNCIL_ACCESS_DENIED for Admins and officers of another council. */
export function assertMayEditCouncilWideSettings(actor: MemberWriteActor, councilId: number): void {
  if (mayEditCouncilWideSettings(actor, councilId)) return;
  if (hasAdminRights(actor) || (actor.active && actor.officer)) {
    throw new SecurityPrivilegeError(
      'COUNCIL_ACCESS_DENIED',
      `Member ${actor.memberId} changes the settings of their own council (${actor.councilId}) only, not council ${councilId}.`,
      { actorId: actor.memberId, actorCouncilId: actor.councilId, councilId },
    );
  }
  throw new SecurityPrivilegeError(
    'ADMIN_REQUIRED',
    `Only an active Admin or officer of the council, or a Super Admin, can change the Council Wide Settings; member ${actor.memberId} is ${describeActor(actor)}.`,
    { actorId: actor.memberId, actorType: actor.memberType ?? null, councilId },
  );
}

// ---- platform settings ----------------------------------------------------------------------------------------

/** The one PlatformSettings row's id. */
export const PLATFORM_SETTINGS_ID = 1;

export const PLATFORM_SETTING_NAMES = ['oral_history_max_seconds', 'diary_text_max_length', 'prayer_intention_max_length'] as const;
export type PlatformSettingName = (typeof PLATFORM_SETTING_NAMES)[number];

export const PLATFORM_SETTING_DEFAULTS: Omit<PlatformSettings, 'id'> = {
  oral_history_max_seconds: ORAL_HISTORY_MAX_SECONDS,
  diary_text_max_length: DIARY_TEXT_MAX_LENGTH,
  prayer_intention_max_length: PRAYER_INTENTION_MAX_LENGTH,
};

/** Ranges; the character limits stop at their columns' sizes, so a saved value always fits. */
export const PLATFORM_SETTING_RULES: Record<PlatformSettingName, SettingRule> = {
  oral_history_max_seconds: {
    label: 'Oral history recording time limit',
    hint: 'The recorder stops and saves on its own when this time runs out.',
    min: 60,
    max: 3600,
    unit: 'seconds',
  },
  diary_text_max_length: {
    label: 'Diary entry character limit',
    hint: 'The longest spiritual diary entry or testimonial note a member may save.',
    min: 100,
    max: DIARY_TEXT_MAX_LENGTH,
    unit: 'characters',
  },
  prayer_intention_max_length: {
    label: 'Prayer intention character limit',
    hint: 'The longest prayer intention a member may post.',
    min: 50,
    max: PRAYER_INTENTION_MAX_LENGTH,
    unit: 'characters',
  },
};

/** The stored row, with the defaults for a missing row or value. */
export function platformSettings(row: Partial<PlatformSettings> | null | undefined): PlatformSettings {
  const out: PlatformSettings = { id: PLATFORM_SETTINGS_ID, ...PLATFORM_SETTING_DEFAULTS };
  for (const name of PLATFORM_SETTING_NAMES) {
    const v = row?.[name];
    if (typeof v === 'number' && Number.isFinite(v)) out[name] = v;
  }
  return out;
}

/** councils.setPlatformSettings' input: one or more whole numbers in range (INVALID_INPUT otherwise). */
export function cleanPlatformSettings(input: unknown): Partial<Omit<PlatformSettings, 'id'>> {
  if (input === null || typeof input !== 'object') throw invalid('Enter at least one platform setting.');
  const raw = input as Record<string, unknown>;
  const unknown = Object.keys(raw).filter((k) => !(PLATFORM_SETTING_NAMES as readonly string[]).includes(k));
  if (unknown.length > 0) throw invalid(`Unknown platform setting: ${unknown.join(', ')}.`, { fields: unknown });
  const out: Partial<Omit<PlatformSettings, 'id'>> = {};
  for (const name of PLATFORM_SETTING_NAMES) {
    if (raw[name] !== undefined) out[name] = cleanSetting(PLATFORM_SETTING_RULES[name], name, raw[name]);
  }
  if (Object.keys(out).length === 0) throw invalid('Enter at least one platform setting.');
  return out;
}

/** Only an Active Super Admin changes the platform settings (SUPER_ADMIN_REQUIRED). */
export function assertMaySetPlatformSettings(actor: MemberWriteActor): void {
  if (hasSuperAdminRights(actor)) return;
  throw new SecurityPrivilegeError(
    'SUPER_ADMIN_REQUIRED',
    `Only an active Super Admin can change the platform settings; member ${actor.memberId} is ${describeActor(actor)}.`,
    { actorId: actor.memberId, actorType: actor.memberType ?? null },
  );
}
