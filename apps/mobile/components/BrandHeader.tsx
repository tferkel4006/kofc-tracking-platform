import { useEffect, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { councilLabel, type Council } from '@kofc/shared';
import { PrayingHandsButton } from '@/components/FaithCenter';
import { AppText } from '@/components/ui';
import { useApp } from '@/lib/app-context';
import { useTheme } from '@/lib/layout-mode';
import { db } from '@/services/db';
import emblem from './kofc-logo.png';

/** The council-supplied Knights of Columbus emblem, square, decorative next to the spelled-out title. */
export function BrandMark({ size = 40 }: { size?: number }) {
  return (
    <Image
      source={emblem}
      accessibilityElementsHidden
      importantForAccessibility="no"
      resizeMode="contain"
      style={{ width: size, height: size }}
    />
  );
}

/**
 * A line-drawn envelope (outline plus flap) in white, with the unread count (countUnreadMessages) as a bright red
 * bubble with bold white numerals in a white ring (Phase 4.5; gold until then), matching the portal's envelope.
 */
function EnvelopeIcon({ unread }: { unread: number }) {
  const { color, large } = useTheme();
  // Large text layout: drawn twice the size, white lines on black, with a gold-ringed black badge.
  const k = (n: number) => (large ? n * 2 : n);
  const ink = large ? color.text : color.white;
  return (
    <View style={{ width: k(34), height: k(28), justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: k(26), height: k(18), borderWidth: k(2), borderColor: ink, borderRadius: 2, alignItems: 'center', overflow: 'hidden' }}>
        <View
          style={{
            width: 0,
            height: 0,
            borderLeftWidth: k(11),
            borderRightWidth: k(11),
            borderTopWidth: k(9),
            borderLeftColor: 'transparent',
            borderRightColor: 'transparent',
            borderTopColor: ink,
          }}
        />
      </View>
      {unread > 0 ? (
        <View
          style={{
            position: 'absolute',
            top: large ? -12 : -4,
            right: large ? -12 : -4,
            minWidth: large ? 34 : 18,
            height: large ? 34 : 18,
            borderRadius: large ? 17 : 9,
            paddingHorizontal: 4,
            backgroundColor: large ? color.navy : color.red,
            borderWidth: large ? 3 : 2,
            borderColor: large ? color.gold : color.white,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AppText variant="small" tone={large ? 'navy' : 'white'} style={{ fontSize: 11, lineHeight: 14, fontWeight: '700' }}>
            {unread > 99 ? '99+' : unread}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

/**
 * Navy app bar: logo, then the calling council's number and name directly under the title, then the Messaging
 * envelope (Messages left the bottom tabs in Sprint 5X-Mobile), then the member. Phase 4.5: praying hands just left of
 * the envelope open the Daily Bible Quote (FaithCenter.tsx).
 * Sprint 6C: the member's name opens Settings (Large Text Layout Mode). In the large text layout the bar is black with
 * a thick gold edge, the envelope and a Settings button are touchTarget-tall tap areas, and Sign out moves to Settings.
 */
export function BrandHeader() {
  const { user, signOut, unread } = useApp();
  const { color, space, touchTarget, large } = useTheme();
  const tapArea = large ? { minHeight: touchTarget, minWidth: 96, alignItems: 'center' as const, justifyContent: 'center' as const } : undefined;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [council, setCouncil] = useState<Council | null>(null);

  useEffect(() => {
    let live = true;
    if (user) void db.councils.get(user.councilId).then((c) => live && setCouncil(c));
    return () => {
      live = false;
    };
  }, [user]);

  return (
    <View
      style={{
        backgroundColor: color.navy,
        paddingTop: insets.top + space.sm,
        paddingBottom: space.sm,
        paddingHorizontal: large ? space.md : space.lg,
        flexDirection: 'row',
        alignItems: 'center',
        gap: large ? space.sm : space.md,
        borderBottomWidth: large ? 6 : 3,
        borderBottomColor: color.gold,
      }}
    >
      <BrandMark size={large ? 64 : 40} />
      {/* Flexible title box: it takes the room left between the emblem and the controls, and a long council
          name shrinks to fit on one line (numberOfLines + adjustsFontSizeToFit) instead of wrapping. The large text
          layout leaves the title out: at its size there is room only for the emblem and the two big buttons. */}
      {large ? (
        <View style={{ flex: 1 }} accessibilityRole="header" accessibilityLabel={council ? `Knights of Columbus, ${councilLabel(council)}` : 'Knights of Columbus'} />
      ) : (
        <View style={{ flex: 1, minWidth: 0, flexShrink: 1 }}>
          <AppText
            variant="heading"
            tone="white"
            style={{ fontSize: 18, lineHeight: 22 }}
            accessibilityRole="header"
            numberOfLines={1}
            adjustsFontSizeToFit={true}
            minimumFontScale={0.7}
          >
            Knights of Columbus
          </AppText>
          <AppText variant="small" tone="white" numberOfLines={1} adjustsFontSizeToFit={true} minimumFontScale={0.6}>
            {council ? councilLabel(council) : ' '}
          </AppText>
        </View>
      )}
      {user ? <PrayingHandsButton /> : null}
      {user ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={unread > 0 ? `Messaging, ${unread} unread` : 'Messaging'}
          onPress={() => router.push('/messages')}
          hitSlop={10}
          style={tapArea}
        >
          <EnvelopeIcon unread={unread} />
        </Pressable>
      ) : null}
      {user && large ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Settings for ${user.firstName}`}
          onPress={() => router.push('/settings')}
          style={({ pressed }) => [tapArea, { borderWidth: 4, borderColor: color.gold, borderRadius: 10, paddingHorizontal: space.sm, opacity: pressed ? 0.8 : 1 }]}
        >
          <AppText variant="label" tone="white">
            ⚙ Settings
          </AppText>
        </Pressable>
      ) : user ? (
        <View style={{ alignItems: 'flex-end' }}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Settings for ${user.firstName}`} onPress={() => router.push('/settings')} hitSlop={10}>
            <AppText variant="small" tone="white" style={{ textAlign: 'right' }}>
              {user.firstName} ⚙
            </AppText>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Sign out" onPress={() => void signOut()} hitSlop={10}>
            <AppText variant="label" tone="white" style={{ textDecorationLine: 'underline', textAlign: 'right' }}>
              Sign out
            </AppText>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
