// The command strip at the top of every screen opened over a tab, and of every modal sheet (Sprint 5Y-Mobile):
// a bold "Back" link on the left and a high-contrast ✕ close button on the right, both full touch targets.
// It replaces the small "‹" links, which were too thin to read or hit.
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { AppText } from '@/components/ui';
import type { LayoutTokens } from '@kofc/shared';
import { useTheme } from '@/lib/layout-mode';

type Surface = 'white' | 'navy';

/**
 * Navy on white, or white and gold on a navy sheet header, so both controls stay high contrast. In the large text
 * layout the ✕ is white in a black circle with a thick gold ring on either surface.
 */
const looks = ({ color }: LayoutTokens) =>
  ({
    white: { back: 'navy', closeFill: color.navy, closeMark: color.white },
    navy: { back: 'white', closeFill: color.gold, closeMark: color.navy },
  }) as const;

export function BackLink({ onPress, label = 'Back', surface = 'white' }: { onPress: () => void; label?: string; surface?: Surface }) {
  const theme = useTheme();
  const { touchTarget } = theme;
  const look = looks(theme);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      style={{ minHeight: touchTarget, minWidth: touchTarget, justifyContent: 'center' }}
    >
      <AppText variant="title" tone={look[surface].back} style={{ fontWeight: '700', textDecorationLine: 'underline' }}>
        Back
      </AppText>
    </Pressable>
  );
}

export function CloseButton({ onPress, label = 'Close', surface = 'white' }: { onPress: () => void; label?: string; surface?: Surface }) {
  const theme = useTheme();
  const { color, touchTarget, large } = theme;
  const look = looks(theme);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => ({
        width: touchTarget,
        height: touchTarget,
        borderRadius: touchTarget / 2,
        backgroundColor: large ? color.navy : look[surface].closeFill,
        borderWidth: large ? 6 : 0,
        borderColor: color.gold,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <AppText style={{ color: look[surface].closeMark, fontSize: 22, lineHeight: 26, fontWeight: '700' }}>✕</AppText>
    </Pressable>
  );
}

/** Back on the left, an optional title in the middle, ✕ on the right. */
export function NavStripLayout({
  onBack,
  onClose,
  title,
  closeLabel,
  surface = 'white',
}: {
  onBack: () => void;
  onClose: () => void;
  title?: ReactNode;
  closeLabel?: string;
  surface?: Surface;
}) {
  const { space } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
      <BackLink onPress={onBack} surface={surface} />
      <View style={{ flex: 1, alignItems: 'center' }}>{title}</View>
      <CloseButton onPress={onClose} label={closeLabel} surface={surface} />
    </View>
  );
}

/**
 * The strip for a routed screen. Back returns to the previous screen (Home when there is none, e.g. after a deep
 * link); ✕ leaves the whole flow for `closeTo`, Home by default.
 */
export function NavStrip({ closeTo = '/', closeLabel }: { closeTo?: Href; closeLabel?: string }) {
  const router = useRouter();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  return <NavStripLayout onBack={back} onClose={() => router.navigate(closeTo)} closeLabel={closeLabel} />;
}
