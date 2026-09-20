// Messages: my conversations, most recent first, with unread and draft badges.
import { useEffect } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { useRouter } from 'expo-router';
import { formatTimestamp, preview, type ThreadSummary } from '@kofc/shared';
import { AppText, Button, Card, EmptyState, Loading, Notice, Pill } from '@/components/ui';
import { useApp, useUser } from '@/lib/app-context';
import { color, space } from '@/lib/theme';
import { useLoad } from '@/lib/use-async';
import { db } from '@/services/db';

/** Everyone in the thread except me, e.g. "Test Admin, Test Super". */
function otherNames(t: ThreadSummary, myId: number): string {
  const names = t.participantIds.flatMap((id, i) => (id === myId ? [] : [t.participantNames[i]]));
  return names.length > 0 ? names.join(', ') : 'Just you';
}

export default function ThreadsScreen() {
  const user = useUser();
  const router = useRouter();
  const { refreshUnread } = useApp();
  const state = useLoad(() => db.messages.listThreads(user.memberId), [user.memberId]);

  useEffect(() => {
    if (state.data) void refreshUnread();
  }, [state.data, refreshUnread]);

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: color.white }}
      contentContainerStyle={{ padding: space.lg, gap: space.md }}
      data={state.data ?? []}
      keyExtractor={(t) => String(t.thread.id)}
      refreshControl={<RefreshControl refreshing={state.refreshing} onRefresh={() => void state.reload()} tintColor={color.navy} colors={[color.navy]} />}
      ListHeaderComponent={
        <View style={{ gap: space.md, marginBottom: space.sm }}>
          <AppText variant="heading" accessibilityRole="header">
            Messages
          </AppText>
          <Button title="New message" onPress={() => router.push('/messages/new')} />
          {state.error ? <Notice tone="error" message={state.error} /> : null}
        </View>
      }
      ListEmptyComponent={!state.data && state.loading ? <Loading /> : <EmptyState message="No conversations yet. Start one with New message." />}
      renderItem={({ item: t }) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Conversation with ${otherNames(t, user.memberId)}. ${t.unreadCount} unread.`}
          onPress={() => router.push(`/messages/${t.thread.id}`)}
        >
          <Card accent={t.unreadCount > 0 ? color.gold : color.line}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm }}>
              <AppText variant="title" style={{ flexShrink: 1 }}>
                {otherNames(t, user.memberId)}
              </AppText>
              {t.unreadCount > 0 ? <Pill label={`${t.unreadCount} NEW`} tone="gold" /> : null}
              {t.draftCount > 0 ? <Pill label="DRAFT" tone="outline" /> : null}
              {t.thread.IsGroupChat === 1 ? <Pill label="GROUP" tone="outline" /> : null}
            </View>
            {t.lastMessage ? (
              <AppText numberOfLines={2} style={t.unreadCount > 0 ? { fontWeight: '700' } : undefined}>
                {t.lastSenderName ? `${t.lastSenderName}: ` : ''}
                {preview(t.lastMessage.MessageText, 120)}
              </AppText>
            ) : (
              <AppText tone="muted">Only your unsent draft is here.</AppText>
            )}
            <AppText variant="small" tone="muted">
              {formatTimestamp(t.lastMessage?.CreatedAt ?? t.thread.CreatedAt)}
            </AppText>
          </Card>
        </Pressable>
      )}
    />
  );
}
