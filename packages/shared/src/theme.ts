// =========================================================================
// KNIGHTS OF COLUMBUS BRAND TOKENS
// One source for both apps: the Tailwind config (web) and the StyleSheets
// (mobile) import these values, so a brand change is a one-line edit.
//
//   Navy  - base frames, headers, navigation, buttons
//   Red   - urgency: shifts within 2 days, required alerts, the no-show badge
//   Gold  - priority milestones and selection markers
//   White - every content surface stays flat white for contrast
//   Green - confirmation only: the phone's "Attending" RSVP banner (Sprint 5Y-6) and the portal's balanced-ledger
//           badge (Sprint 5Z-8), white text at 6.8:1
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
  /** Confirmation fills only (the RSVP "Attending" banner); text on it is white. */
  green: '#17692F',
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

// =========================================================================
// Sprint 6C: LARGE TEXT LAYOUT MODE (Member.flag_large_text_mode)
// The phone app's visually impaired layout. Every screen reads its colours, sizes and spacing from layoutTokens(),
// so switching the member's flag redraws the whole app: larger type, tap areas at least LARGE_TEXT_TOUCH_TARGET
// points tall, doubled padding, and a pitch-black background with bold white text inside thick gold borders.
// =========================================================================

/**
 * Font multiplier in the large text layout. 1.5 lands the app's 16 pt body copy on 24 pt and its 24 pt headings on
 * 36 pt, the sizes the Sprint 6C brief names.
 */
export const LARGE_TEXT_FONT_SCALE = 1.5;
/** No text in the large text layout is drawn smaller than this (points), even the smallest captions. */
export const LARGE_TEXT_MIN_FONT_SIZE = 20;
/** Minimum height (points) of every button, tab, tile, input and other tap area in the large text layout. */
export const LARGE_TEXT_TOUCH_TARGET = 140;
/** Width (points) of the gold borders round every card, button, input and chip in the large text layout. */
export const LARGE_TEXT_BORDER_WIDTH = 4;
/** Padding multiplier in the large text layout. */
export const LARGE_TEXT_SPACING_SCALE = 2;

/**
 * The large text layout's palette, under the same role names as BRAND so a screen reads `color.navy` either way.
 * Navy frames and white surfaces both turn pitch black, text and muted text turn white, hairlines turn gold, and
 * red and gold brighten so they stand out on black. Text is always white (bold) in this layout, never gold or red,
 * and nothing is filled gold, since white on gold is unreadable.
 */
export const HIGH_CONTRAST = {
  navy: '#000000',
  red: '#FF4040',
  gold: '#FFC72C',
  white: '#000000',
  muted: '#FFFFFF',
  line: '#FFC72C',
  green: '#17692F',
  /** The one text colour of the large text layout. */
  text: '#FFFFFF',
  /** Outlines of fields, tabs and frames: the thick gold boundaries. */
  edge: '#FFC72C',
} as const;

/**
 * Colour roles a screen draws with: BRAND's names, plus `text` (the text colour) and `edge` (outlines of fields, tabs
 * and frames), both navy in the standard layout.
 */
export type LayoutPalette = { [K in keyof typeof BRAND | 'text' | 'edge']: string };

/** Everything a phone screen sizes and colours itself from, in the standard or the large text layout. */
export interface LayoutTokens {
  /** True in the large text layout. */
  large: boolean;
  color: LayoutPalette;
  space: { [K in keyof typeof SPACING]: number };
  radius: { [K in keyof typeof RADIUS]: number };
  /** Minimum height of any tap area. */
  touchTarget: number;
  /** Border width for a card, button, input or chip edge drawn `width` points wide in the standard layout. */
  border(width: number): number;
  /** A font size (or line height) given in standard-layout points, in this layout. */
  font(size: number): number;
}

const scaleRecord = <T extends Record<string, number>>(record: T, factor: number): { [K in keyof T]: number } =>
  Object.fromEntries(Object.entries(record).map(([k, v]) => [k, v * factor])) as { [K in keyof T]: number };

const STANDARD_LAYOUT: LayoutTokens = {
  large: false,
  color: { ...BRAND, text: BRAND.navy, edge: BRAND.navy },
  space: { ...SPACING },
  radius: { ...RADIUS },
  touchTarget: TOUCH_TARGET,
  border: (width) => width,
  font: (size) => size,
};

const LARGE_TEXT_LAYOUT: LayoutTokens = {
  large: true,
  color: { ...HIGH_CONTRAST },
  space: scaleRecord(SPACING, LARGE_TEXT_SPACING_SCALE),
  radius: { ...RADIUS },
  touchTarget: LARGE_TEXT_TOUCH_TARGET,
  border: (width) => Math.max(width, LARGE_TEXT_BORDER_WIDTH),
  font: (size) => Math.max(Math.round(size * LARGE_TEXT_FONT_SCALE), LARGE_TEXT_MIN_FONT_SIZE),
};

/** The phone's layout tokens: the large text layout when `large`, otherwise the standard KofC brand layout. */
export const layoutTokens = (large: boolean): LayoutTokens => (large ? LARGE_TEXT_LAYOUT : STANDARD_LAYOUT);

/** Whether the member chose the large text layout (Member.flag_large_text_mode = 1). */
export const prefersLargeText = (member: { flag_large_text_mode?: number | null } | null | undefined): boolean =>
  member?.flag_large_text_mode === 1;

/** The label of the Large Text Layout Mode switch on the web profile and the phone settings screen. */
export const LARGE_TEXT_TOGGLE_LABEL = '[ 👓 Enable Large Text Layout Mode ]';
