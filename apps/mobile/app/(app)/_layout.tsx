// The signed-in shell: navy header with the council banner, and four bottom tabs.
// The selected tab is marked with a gold bar; unread messages show as a gold badge on Messages.
import { View } from 'react-native';
import { Tabs } from 'expo-router/js-tabs';
import { BrandHeader } from '@/components/BrandHeader';
import { AppText } from '@/components/ui';
import { useApp } from '@/lib/app-context';
import { color, fontFamily, space } from '@/lib/theme';

const TabLabel = ({ label, focused }: { label: string; focused: boolean }) => (
  <View style={{ alignItems: 'center', justifyContent: 'center', flex: 1, paddingHorizontal: space.sm }}>
    <View style={{ height: 4, alignSelf: 'stretch', backgroundColor: focused ? color.gold : 'transparent', marginBottom: space.sm }} />
    <AppText variant="label" tone={focused ? 'navy' : 'muted'} style={{ fontSize: 14 }}>
      {label}
    </AppText>
  </View>
);

export default function AppLayout() {
  const { unread } = useApp();
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
      <Tabs.Screen name="shifts" options={tab('Shifts')} />
      <Tabs.Screen name="log" options={tab('Log time')} />
      <Tabs.Screen name="messages" options={{ ...tab('Messages'), tabBarBadge: unread > 0 ? unread : undefined }} />
    </Tabs>
  );
}
