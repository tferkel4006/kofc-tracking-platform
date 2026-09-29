// The signed-in shell: navy header with the council banner, and five bottom tabs.
// The selected tab is a navy block with a gold bar and a bold gold label (gold on navy ~6.4:1; gold is never
// text on white, see the shared theme), so the active choice reads at a glance. Messages is no longer a tab (Sprint 5X-Mobile): the header's
// envelope opens it and carries the unread badge.
import { View } from 'react-native';
import { Tabs } from 'expo-router/js-tabs';
import { BrandHeader } from '@/components/BrandHeader';
import { AppText } from '@/components/ui';
import { color, fontFamily, space } from '@/lib/theme';

const TabLabel = ({ label, focused }: { label: string; focused: boolean }) => (
  <View
    style={{
      alignItems: 'center',
      alignSelf: 'stretch',
      flex: 1,
      paddingHorizontal: space.sm,
      backgroundColor: focused ? color.navy : 'transparent',
    }}
  >
    <View style={{ height: 4, alignSelf: 'stretch', backgroundColor: focused ? color.gold : 'transparent', marginBottom: space.sm }} />
    <AppText variant="label" tone="muted" style={{ fontSize: 14, fontWeight: focused ? '700' : '400', color: focused ? color.gold : color.muted }}>
      {label}
    </AppText>
  </View>
);

export default function AppLayout() {
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
        tabBarStyle: { backgroundColor: color.white, borderTopColor: color.navy, borderTopWidth: 2, height: 60 },
        tabBarLabelStyle: { fontFamily: fontFamily.body },
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
