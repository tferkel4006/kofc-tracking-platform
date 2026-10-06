// Mobile brand theme: the shared KofC tokens plus the React Native font rules.
// React Native takes one family name, not a CSS stack. 'Arial' is installed on iOS, and Android maps
// the name to its sans-serif family (Roboto), so body copy is Arial wherever Arial exists.
// Sprint 6C: screens size and colour themselves from useTheme() (lib/layout-mode.tsx), which swaps these standard
// tokens for the large text layout when the member switched it on. The constants below stay the standard layout.
import { Platform } from 'react-native';
import { BRAND, RADIUS, SPACING, TOUCH_TARGET } from '@kofc/shared';

export const color = BRAND;
export const space = SPACING;
export const radius = RADIUS;
export const touchTarget = TOUCH_TARGET;

export const fontFamily = {
  body: 'Arial',
  /** Major titles only. */
  heading: Platform.select({ ios: 'Georgia', default: 'serif' }),
} as const;
