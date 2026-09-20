import { Stack } from 'expo-router';
import { color } from '@/lib/theme';

// The Messages tab is its own stack: thread list -> conversation, plus the compose screen.
// The tab bar's header (with the council banner) stays on top, so these screens draw no header of their own.
export default function MessagesLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.white } }} />;
}
