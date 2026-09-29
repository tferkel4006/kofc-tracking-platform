import { useEffect, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { councilLabel, type Council } from '@kofc/shared';
import { AppText } from '@/components/ui';
import { useApp } from '@/lib/app-context';
import { color, space } from '@/lib/theme';
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

/** A line-drawn envelope (outline plus flap) in white, with the unread count as a gold badge. */
function EnvelopeIcon({ unread }: { unread: number }) {
  return (
    <View style={{ width: 34, height: 28, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: 26, height: 18, borderWidth: 2, borderColor: color.white, borderRadius: 2, alignItems: 'center', overflow: 'hidden' }}>
        <View
          style={{
            width: 0,
            height: 0,
            borderLeftWidth: 11,
            borderRightWidth: 11,
            borderTopWidth: 9,
            borderLeftColor: 'transparent',
            borderRightColor: 'transparent',
            borderTopColor: color.white,
          }}
        />
      </View>
      {unread > 0 ? (
        <View
          style={{
            position: 'absolute',
            top: -4,
            right: -4,
            minWidth: 18,
            height: 18,
            borderRadius: 9,
            paddingHorizontal: 4,
            backgroundColor: color.gold,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AppText variant="small" tone="navy" style={{ fontSize: 11, lineHeight: 14, fontWeight: '700' }}>
            {unread > 99 ? '99+' : unread}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

/**
 * Navy app bar: logo, then the calling council's number and name directly under the title, then the Messaging
 * envelope (Messages left the bottom tabs in Sprint 5X-Mobile), then the member.
 */
export function BrandHeader() {
  const { user, signOut, unread } = useApp();
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
        paddingBottom: space.md,
        paddingHorizontal: space.lg,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        borderBottomWidth: 3,
        borderBottomColor: color.gold,
      }}
    >
      <BrandMark />
      <View style={{ flex: 1 }}>
        <AppText variant="heading" tone="white" style={{ fontSize: 18, lineHeight: 22 }} accessibilityRole="header">
          Knights of Columbus
        </AppText>
        <AppText variant="small" tone="white" numberOfLines={1}>
          {council ? councilLabel(council) : ' '}
        </AppText>
      </View>
      {user ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={unread > 0 ? `Messaging, ${unread} unread` : 'Messaging'}
          onPress={() => router.push('/messages')}
          hitSlop={10}
        >
          <EnvelopeIcon unread={unread} />
        </Pressable>
      ) : null}
      {user ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Sign out" onPress={() => void signOut()} hitSlop={10}>
          <AppText variant="small" tone="white" style={{ textAlign: 'right' }}>
            {user.firstName}
          </AppText>
          <AppText variant="label" tone="white" style={{ textDecorationLine: 'underline', textAlign: 'right' }}>
            Sign out
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}
