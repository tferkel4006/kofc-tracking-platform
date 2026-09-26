import { useEffect, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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

/** Navy app bar: logo, then the calling council's number and name directly under the title, then the member. */
export function BrandHeader() {
  const { user, signOut } = useApp();
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
