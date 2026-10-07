// The signed-in shell: navy header with the council banner, and five bottom tabs in the portal's pillar order (Sprint 6Z):
// Home, then Mtgs (Governance), Signup and Report (Faith In Action), and Donate (Finances).
// The selected tab is a navy block with a gold bar and a bold gold label (gold on navy ~6.4:1; gold is never
// text on white, see the shared theme), so the active choice reads at a glance. Messages is no longer a tab (Sprint 5X-Mobile): the header's
// envelope opens it and carries the unread badge.
// Sprint 6A: a tab whose module the council's feature flags switch off (Signup, Mtgs, Donate) is hidden entirely.
// The gold bar floats over the top edge of the navy block so it never pushes the label down; the label sits centred
// in a tap space of TAB_HEIGHT, and the bar grows by the device's bottom inset so the home indicator doesn't eat it.
// Sprint 6C: in the large text layout the bar is pitch black with a thick gold top edge, every tab is a touchTarget
// (140-point) tap space, the labels are large bold white, and the chosen tab carries a thick gold bar.
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Tabs } from 'expo-router/js-tabs';
import { mobileTabEnabled, type MobileTab } from '@kofc/shared';
import { BrandHeader } from '@/components/BrandHeader';
import { AppText } from '@/components/ui';
import { useFeatureFlags } from '@/lib/app-context';
import { useTheme } from '@/lib/layout-mode';
import { fontFamily } from '@/lib/theme';

function TabLabel({ label, focused }: { label: string; focused: boolean }) {
  const { color, space, large } = useTheme();
  const indicator = large ? 10 : 4;
  return (
    <View
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'stretch',
        flex: 1,
        paddingHorizontal: large ? 2 : space.sm,
        paddingVertical: indicator,
        backgroundColor: focused ? color.navy : 'transparent',
      }}
    >
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: indicator,
          backgroundColor: focused ? color.gold : 'transparent',
        }}
      />
      <AppText
        variant="label"
        tone="muted"
        numberOfLines={large ? 1 : undefined}
        adjustsFontSizeToFit={large}
        minimumFontScale={0.6}
        style={{ fontSize: 14, lineHeight: 18, margin: 0, fontWeight: focused ? '700' : '400', color: focused ? color.gold : color.muted }}
      >
        {label}
      </AppText>
    </View>
  );
}

export default function AppLayout() {
  const { color, space, touchTarget, large } = useTheme();
  // The large layout's touchTarget is already the 140-point floor; the standard 44 gets breathing room.
  const tabHeight = large ? touchTarget : touchTarget + 2 * space.sm;
  const insets = useSafeAreaInsets();
  const features = useFeatureFlags();
  const tab = (title: string, name?: MobileTab) => ({
    ...(name && !mobileTabEnabled(name, features) ? { href: null } : {}),
    title,
    tabBarLabel: ({ focused }: { focused: boolean }) => <TabLabel label={title} focused={focused} />,
    tabBarIcon: () => null,
    tabBarIconStyle: { display: 'none' as const },
  });
  return (
    <Tabs
      screenOptions={{
        header: () => <BrandHeader />,
        tabBarStyle: {
          backgroundColor: color.white,
          borderTopColor: large ? color.gold : color.navy,
          borderTopWidth: large ? 6 : 2,
          height: tabHeight + insets.bottom,
          paddingTop: 0,
        },
        tabBarItemStyle: { height: tabHeight, padding: 0, justifyContent: 'center', alignItems: 'stretch', borderRadius: 0 },
        sceneStyle: { backgroundColor: color.white },
        tabBarLabelStyle: { fontFamily: fontFamily.body, margin: 0 },
        tabBarBadgeStyle: { backgroundColor: color.gold, color: color.navy, fontFamily: fontFamily.body, fontWeight: '700' },
      }}
    >
      <Tabs.Screen name="index" options={tab('Home')} />
      {/* Sprint 6Z: the tabs follow the portal's pillar order - Governance, Faith In Action, Finances. */}
      <Tabs.Screen name="meetings" options={tab('Mtgs', 'meetings')} />
      <Tabs.Screen name="shifts" options={tab('Signup', 'shifts')} />
      <Tabs.Screen name="log" options={tab('Report')} />
      <Tabs.Screen name="donate" options={tab('Donate', 'donate')} />
      {/* Opened from the header envelope; not a tab of its own. */}
      <Tabs.Screen name="messages" options={{ ...tab('Messages'), href: null }} />
      {/* Opened from a meeting card on Home; not a tab of its own. */}
      <Tabs.Screen name="meeting/[meetingId]" options={{ ...tab('Attendance'), href: null }} />
      {/* Opened from the expense card on Home. */}
      <Tabs.Screen name="expenses" options={{ ...tab('Expenses'), href: null }} />
      {/* Sprint 6C: opened from the member's name in the header (Large Text Layout Mode and sign-out). */}
      <Tabs.Screen name="settings" options={{ ...tab('Settings'), href: null }} />
    </Tabs>
  );
}
