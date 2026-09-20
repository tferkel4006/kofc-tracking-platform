// =========================================================================
// KNIGHTS OF COLUMBUS BRAND TOKENS
// One source for both apps: the Tailwind config (web) and the StyleSheets
// (mobile) import these values, so a brand change is a one-line edit.
//
//   Navy  - base frames, headers, navigation, buttons
//   Red   - urgency: shifts within 2 days, required alerts, the no-show badge
//   Gold  - priority milestones and selection markers
//   White - every content surface stays flat white for contrast
//
// Gold on white is only ~2.3:1, so gold is never used as text on white. It is a
// border, bar or fill, and the text on a gold fill is navy (~6.4:1).
// =========================================================================

export const BRAND = {
  navy: '#002855',
  red: '#C8102E',
  gold: '#D6A420',
  white: '#FFFFFF',
  /** Secondary text on white (7.5:1). */
  muted: '#4A5568',
  /** Hairlines and disabled outlines only, never text. */
  line: '#C9D1DC',
} as const;

/** Body copy, forms, lists, timestamps. */
export const FONT_BODY = 'Arial, sans-serif';
/** Major titles only. */
export const FONT_HEADING = 'Georgia, "Times New Roman", serif';

export const SPACING = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;
export const RADIUS = { sm: 6, md: 10, pill: 999 } as const;
/** Minimum touch target on phones (points), per platform accessibility guidance. */
export const TOUCH_TARGET = 44;

const channel = (v: number) => {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

/** WCAG relative luminance of a #RRGGBB colour. */
export function luminance(hex: string): number {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) throw new Error(`Expected a #RRGGBB colour; received ${hex}`);
  return 0.2126 * channel(parseInt(m[1], 16)) + 0.7152 * channel(parseInt(m[2], 16)) + 0.0722 * channel(parseInt(m[3], 16));
}

/** WCAG contrast ratio between two colours, from 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
