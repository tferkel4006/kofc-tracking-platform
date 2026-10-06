// Sprint 6C: the large text layout switch for every screen. LayoutModeProvider (mounted by AppProvider from the
// signed-in member's Member.flag_large_text_mode) hands out the shared layoutTokens(); every component reads its
// colours, font sizes, spacing and tap-area heights from useTheme(), so flipping the flag redraws the whole app.
import { createContext, useContext, type ReactNode } from 'react';
import { layoutTokens, type LayoutTokens } from '@kofc/shared';

const LayoutContext = createContext<LayoutTokens>(layoutTokens(false));

export function LayoutModeProvider({ large, children }: { large: boolean; children: ReactNode }) {
  return <LayoutContext.Provider value={layoutTokens(large)}>{children}</LayoutContext.Provider>;
}

/** The current layout's tokens: the standard brand layout, or the large text layout. */
export function useTheme(): LayoutTokens {
  return useContext(LayoutContext);
}
