// =========================================================================
// COUNCIL FEATURE FLAGS (Sprint 6A, widened in Sprint 6R)
// On/off switches on the Council row. A flag that is off hides its module from the portal sidebar, its pages
// (RequireArea), the phone's tab bar and the buttons that lead there, for every member of the council, leaving the
// financial engine and the simple service logs. Only a Super Admin flips them (councils.setFeatureFlags), from the
// Feature Flags Control Center (/feature-flags, Sprint 6R). The data behind a hidden module stays; switching the flag
// back on brings it all back.
// Sprint 6R (schema 57) adds six 'feature_*' switches beside the five 'flag_*' ones, named as the user gave them: expense
// reporting, the Faith Center, the Constitutional Advisor, the council bylaws, the council history and the live console.
// =========================================================================
import type { PortalArea } from './permissions';
import { assertValidHours, BusinessRuleError, HOURS_STEP } from './rules';
import type { Council } from './types';

export const FEATURE_FLAG_NAMES = [
  'flag_mobile_elections',
  'flag_fundraising_inflow',
  'flag_charity_proposals',
  'flag_complex_shifts',
  'flag_meeting_management',
  'feature_expense_reporting',
  'feature_faith_center',
  'feature_constitutional_advisor',
  'feature_council_bylaws',
  'feature_council_history',
  'feature_live_meeting_console',
] as const;
export type FeatureFlagName = (typeof FEATURE_FLAG_NAMES)[number];

/** Whether each module is on for a council. */
export type FeatureFlags = Record<FeatureFlagName, boolean>;

/** Every module on: the default for a council row that predates the flags or has not loaded yet. */
export const ALL_FEATURES_ON: FeatureFlags = {
  flag_mobile_elections: true,
  flag_fundraising_inflow: true,
  flag_charity_proposals: true,
  flag_complex_shifts: true,
  flag_meeting_management: true,
  feature_expense_reporting: true,
  feature_faith_center: true,
  feature_constitutional_advisor: true,
  feature_council_bylaws: true,
  feature_council_history: true,
  feature_live_meeting_console: true,
};

/** How the master admin portal names and explains each switch. */
export const FEATURE_FLAG_LABELS: Record<FeatureFlagName, { label: string; hint: string }> = {
  flag_mobile_elections: { label: 'Officer elections', hint: 'Officer nominations and the appointed leadership matrix' },
  flag_fundraising_inflow: {
    label: 'Fundraising inflow',
    hint: 'Recorded donations, the phone app Donate tab: event point-of-sale, card and QR collections, gate intake drawers',
  },
  flag_charity_proposals: { label: 'Charity proposals', hint: 'Member charity grant proposals and the vetting desk that tracks them' },
  flag_complex_shifts: { label: 'Event shifts', hint: 'The event planner, shift sign-ups and shift hour reports' },
  flag_meeting_management: { label: 'Meeting management', hint: 'Meeting center, cadence manager, live console and the phone app Meetings tab' },
  feature_expense_reporting: {
    label: 'Expense reporting',
    hint: 'Member expense reports, the FS, Treasurer and GK signature desks, check disbursements and the phone app expense screen',
  },
  feature_faith_center: {
    label: 'Faith Center',
    hint: "The web Faith Center page and the phone app's feast-day banner, Daily Bible Quote and prayer intentions",
  },
  feature_constitutional_advisor: { label: 'Constitutional Advisor', hint: 'The parliamentary question desk that cites the bylaws' },
  feature_council_bylaws: { label: 'Council bylaws', hint: "The council's constitutional bylaws page" },
  feature_council_history: { label: 'Council history', hint: 'The Team Legacy history page: annals, diary, oral histories and the In Memoriam roll' },
  feature_live_meeting_console: { label: 'Live meeting console', hint: 'The live meeting console: agenda, check-ins, secret ballots and hand tallies' },
};

/** The portal areas each flag hides when it is off. */
export const FEATURE_FLAG_AREAS: Record<FeatureFlagName, readonly PortalArea[]> = {
  flag_mobile_elections: ['elections', 'elections/appointments'],
  flag_fundraising_inflow: ['donations'],
  flag_charity_proposals: ['charities/propose', 'charities/vetting'],
  flag_complex_shifts: ['events'],
  flag_meeting_management: ['meetings', 'meetings/cadence', 'meetings/live'],
  // The Treasurer's desk codes expense sheets, so it goes with them; the general ledger and the budget stay.
  feature_expense_reporting: ['expenses', 'expenses/queue', 'expenses/audit', 'expenses/authorize', 'expenses/disbursements', 'finance/treasurer-desk'],
  feature_faith_center: ['faith-center'],
  feature_constitutional_advisor: ['governance/advisor'],
  feature_council_bylaws: ['governance/bylaws'],
  feature_council_history: ['history'],
  feature_live_meeting_console: ['meetings/live'],
};

/** The phone app's tabs (route names under app/(app)) that a flag hides when it is off. */
export type MobileTab = 'index' | 'shifts' | 'log' | 'meetings' | 'donate';
export const FEATURE_FLAG_MOBILE_TABS: Record<FeatureFlagName, readonly MobileTab[]> = {
  // The phone app has no election screens; the flag only trims the portal.
  flag_mobile_elections: [],
  flag_fundraising_inflow: ['donate'],
  // The phone app has no charity proposal screens either.
  flag_charity_proposals: [],
  flag_complex_shifts: ['shifts'],
  flag_meeting_management: ['meetings'],
  // The phone's expense screen and Faith Center are not tabs; their screens read the flags themselves (Sprint 6R).
  feature_expense_reporting: [],
  feature_faith_center: [],
  feature_constitutional_advisor: [],
  feature_council_bylaws: [],
  feature_council_history: [],
  feature_live_meeting_console: [],
};

/** A council row's flags; a missing or NULL column reads as on. */
export function councilFeatureFlags(council: Partial<Pick<Council, FeatureFlagName>> | null | undefined): FeatureFlags {
  const flags = { ...ALL_FEATURES_ON };
  for (const name of FEATURE_FLAG_NAMES) {
    const value = council?.[name];
    if (value !== undefined && value !== null) flags[name] = Number(value) !== 0;
  }
  return flags;
}

/** Drops the portal areas whose module is switched off. */
export function withFeatureFlags<T extends PortalArea>(areas: readonly T[], flags: FeatureFlags): T[] {
  const hidden = new Set<PortalArea>(FEATURE_FLAG_NAMES.filter((name) => !flags[name]).flatMap((name) => FEATURE_FLAG_AREAS[name]));
  return areas.filter((area) => !hidden.has(area));
}

/** Whether the phone app shows `tab` under these flags. */
export const mobileTabEnabled = (tab: MobileTab, flags: FeatureFlags): boolean =>
  FEATURE_FLAG_NAMES.every((name) => flags[name] || !FEATURE_FLAG_MOBILE_TABS[name].includes(tab));

/** The changes councils.setFeatureFlags accepts: any subset of the flags. */
export type FeatureFlagChanges = Partial<FeatureFlags>;

/**
 * Validates a councils.setFeatureFlags request: every key a known flag, every value a boolean. Returns the BIT values to
 * store, only for the flags named.
 */
export function cleanFeatureFlagChanges(changes: FeatureFlagChanges): Partial<Record<FeatureFlagName, 0 | 1>> {
  const out: Partial<Record<FeatureFlagName, 0 | 1>> = {};
  for (const [key, value] of Object.entries(changes ?? {})) {
    if (!(FEATURE_FLAG_NAMES as readonly string[]).includes(key)) {
      throw new BusinessRuleError('INVALID_INPUT', `"${key}" is not a feature flag; the flags are ${FEATURE_FLAG_NAMES.join(', ')}.`, { flag: key });
    }
    if (typeof value !== 'boolean') {
      throw new BusinessRuleError('INVALID_INPUT', `Feature flag ${key} must be true or false; received ${String(value)}.`, { flag: key, value });
    }
    out[key as FeatureFlagName] = value ? 1 : 0;
  }
  return out;
}

/**
 * The rapid-tap tracker's next total (Sprint 6A): an entry's hours plus one 15-minute step, or one step for a new entry,
 * validated like any logged hours (HOURS_OUT_OF_RANGE past 24).
 */
export const nextQuarterHourTotal = (current: number | null | undefined): number => assertValidHours((current ?? 0) + HOURS_STEP);
