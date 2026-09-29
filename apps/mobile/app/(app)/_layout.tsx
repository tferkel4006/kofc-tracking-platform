// The signed-in shell: navy header with the council banner, and five bottom tabs.
// The selected tab is a navy block with a gold bar and a bold gold label (gold on navy ~6.4:1; gold is never
// text on white, see the shared theme), so the active choice reads at a glance. Messages is no longer a tab (Sprint 5X-Mobile): the header's
// envelope opens it and carries the unread badge.
// The gold bar floats over the top edge of the navy block so it never pushes the label down; the label sits centred
// in a tap space of TAB_HEIGHT, and the bar grows by the device's bottom inset so the home indicator doesn't eat it.
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Tabs } from 'expo-router/js-tabs';
import { BrandHeader } from '@/components/BrandHeader';
import { AppText } from '@/components/ui';
import { color, fontFamily, space, touchTarget } from '@/lib/theme';

const TAB_HEIGHT = touchTarget + 2 * space.sm;
const INDICATOR_HEIGHT = 4;

const TabLabel = ({ label, focused }: { label: string; focused: boolean }) => (
  <View
    style={{
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'stretch',
      flex: 1,
      paddingHorizontal: space.sm,
      paddingVertical: INDICATOR_HEIGHT,
      backgroundColor: focused ? color.navy : 'transparent',
    }}
  >
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: INDICATOR_HEIGHT,
        backgroundColor: focused ? color.gold : 'transparent',
      }}
    />
    <AppText
      variant="label"
      tone="muted"
      style={{ fontSize: 14, lineHeight: 18, margin: 0, fontWeight: focused ? '700' : '400', color: focused ? color.gold : color.muted }}
    >
      {label}
    </AppText>
  </View>
);

export default function AppLayout() {
  const insets = useSafeAreaInsets();
  const tab = (title: string) => ({
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
          borderTopColor: color.navy,
          borderTopWidth: 2,
          height: TAB_HEIGHT + insets.bottom,
          paddingTop: 0,
        },
        tabBarItemStyle: { height: TAB_HEIGHT, padding: 0, justifyContent: 'center', alignItems: 'stretch', borderRadius: 0 },
        tabBarLabelStyle: { fontFamily: fontFamily.body, margin: 0 },
        tabBarBadgeStyle: { backgroundColor: color.gold, color: color.navy, fontFamily: fontFamily.body, fontWeight: '700' },
      }}
    >
      <Tabs.Screen name="index" options={tab('Home')} />
      <Tabs.Screen name="shifts" options={tab('Signup')} />
      <Tabs.Screen name="log" options={tab('Report')} />
      <Tabs.Screen name="meetings" options={tab('Mtgs')} />
      <Tabs.Screen name="donate" options={tab('Donate')} />
      {/* Opened from the header envelope; not a tab of its own. */}
      <Tabs.Screen name="messages" options={{ ...tab('Messages'), href: null }} />
      {/* Opened from a meeting card on Home; not a tab of its own. */}
      <Tabs.Screen name="meeting/[meetingId]" options={{ ...tab('Attendance'), href: null }} />
      {/* Opened from the expense card on Home. */}
      <Tabs.Screen name="expenses" options={{ ...tab('Expenses'), href: null }} />
    </Tabs>
  );
}
