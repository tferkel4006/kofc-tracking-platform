// =========================================================================
// MULTI-TENANT WHITE-LABEL GATE (Sprint 6Z-Dual-Gate-Model, schema version 39)
// Council.tenant_type says what kind of organization a council row is. 'KOFC' (the default) is a Knights of Columbus
// council: every fraternal extension is on and the portal speaks the order's language. Any other type is a
// white-labelled community organization: the fraternal extensions (FRATERNAL_AREAS, the liturgical overlay) are hidden,
// the drivers reject their operations (assertFraternalExtension in workflow.ts), and labels pass through whiteLabel.
//
// This is the second of the two gates. The first, the feature flags (features.ts), switches individual modules on and
// off within either kind of tenant.
// =========================================================================
import type { PortalArea } from './permissions';
import type { Council } from './types';

export const TENANT_TYPES = ['KOFC', 'GENERIC'] as const;
export type TenantType = (typeof TENANT_TYPES)[number];

/** The tenant a council row that predates the column, or has not loaded yet, belongs to. */
export const DEFAULT_TENANT_TYPE: TenantType = 'KOFC';

/**
 * A council row's tenant: a missing, NULL or blank tenant_type reads as 'KOFC', any spelling of 'kofc' is 'KOFC', and
 * every other value is a white-label tenant ('GENERIC'), so an unknown type never unlocks the fraternal extensions.
 */
export function councilTenantType(council: Partial<Pick<Council, 'tenant_type'>> | null | undefined): TenantType {
  const raw = council?.tenant_type;
  if (raw === undefined || raw === null || String(raw).trim() === '') return DEFAULT_TENANT_TYPE;
  return String(raw).trim().toUpperCase() === 'KOFC' ? 'KOFC' : 'GENERIC';
}

/** True for the Knights of Columbus tenant, the only one with the fraternal extensions. */
export const isFraternalTenant = (tenant: TenantType): boolean => tenant === 'KOFC';

/**
 * The portal areas only a Knights of Columbus council has: Supreme Council Sync (the order's Forms 1728 and 1295 and its
 * roster export) and the Constitutional Advisor (which cites the order's Charter and Supreme Laws).
 */
export const FRATERNAL_AREAS: readonly PortalArea[] = ['supreme-sync', 'governance/advisor'];

/** Drops the fraternal areas for a white-label tenant; a Knights of Columbus council keeps them all. */
export function withTenantGate<T extends PortalArea>(areas: readonly T[], tenant: TenantType): T[] {
  if (isFraternalTenant(tenant)) return [...areas];
  const fraternal = new Set<PortalArea>(FRATERNAL_AREAS);
  return areas.filter((area) => !fraternal.has(area));
}

/** The words the portal's chrome uses for the organization, which differ by tenant. */
export interface TenantVocabulary {
  /** The header title. */
  organizationName: string;
  /** One local unit: Council or Chapter. */
  unit: string;
  /** The presiding officer. */
  presidingOfficer: string;
}

export const TENANT_VOCABULARY: Record<TenantType, TenantVocabulary> = {
  KOFC: { organizationName: 'Knights of Columbus', unit: 'Council', presidingOfficer: 'Grand Knight' },
  GENERIC: { organizationName: 'Community Service Portal', unit: 'Chapter', presidingOfficer: 'President' },
};

/**
 * The fraternal terms a white-label tenant replaces, longest first so 'Deputy Grand Knight' is read before
 * 'Grand Knight' and 'Supreme Council' before 'Council'. Each pattern matches whole words and keeps the case of its
 * first letter where both cases occur.
 */
const WHITE_LABEL_TERMS: readonly (readonly [RegExp, string])[] = [
  [/\bKnights of Columbus\b/g, 'Community Service Portal'],
  [/\bDeputy Grand Knight\b/g, 'Vice President'],
  [/\bGrand Knights\b/g, 'Presidents'],
  [/\bGrand Knight\b/g, 'President'],
  [/\bDGK\b/g, 'Vice President'],
  [/\bGK\b/g, 'President'],
  [/\bSupreme Council\b/g, 'National Office'],
  [/\bSupreme\b/g, 'National'],
  [/\bbrother Knights\b/g, 'fellow members'],
  [/\bbrother Knight\b/g, 'fellow member'],
  [/\bKnights\b/g, 'Members'],
  [/\bKnight\b/g, 'Member'],
  [/\bFraternal\b/g, 'Community'],
  [/\bfraternal\b/g, 'community'],
  [/\bFaith In Action\b/g, 'Service In Action'],
  [/\bFaith-in-Action\b/g, 'Service-in-Action'],
  [/\bCouncils\b/g, 'Chapters'],
  [/\bCouncil\b/g, 'Chapter'],
  [/\bcouncils\b/g, 'chapters'],
  [/\bcouncil\b/g, 'chapter'],
];

/** `text` in the tenant's vocabulary: unchanged for a Knights of Columbus council, neutral words for a white label. */
export function whiteLabel(text: string, tenant: TenantType): string {
  if (isFraternalTenant(tenant)) return text;
  return WHITE_LABEL_TERMS.reduce((out, [pattern, replacement]) => out.replace(pattern, replacement), text);
}
