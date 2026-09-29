// Meetings tab (Sprint 5X-Mobile): the council's upcoming meetings in two sub-tabs from meetings.listSchedules.
// "My Invites" holds the meetings I am on the invitation list for; "All Schedules" every meeting of my council,
// so members can see what leadership has on the calendar. Officers and a meeting's owner can take attendance.
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { canManageMeeting } from '@kofc/shared';
import { MeetingCard } from '@/components/MeetingCard';
import { AppText, EmptyState, Loading, Notice, Pill, Screen } from '@/components/ui';
import { useUser } from '@/lib/app-context';
import { useLoad } from '@/lib/use-async';
import { color, radius, space, touchTarget } from '@/lib/theme';
import { db } from '@/services/db';

type MeetingsTab = 'invites' | 'all';

const TABS: { key: MeetingsTab; label: string }[] = [
  { key: 'invites', label: 'My Invites' },
  { key: 'all', label: 'All Schedules' },
];

export default function MeetingsScreen() {
  const user = useUser();
  const router = useRouter();
  const [tab, setTab] = useState<MeetingsTab>('invites');
  const state = useLoad(() => db.meetings.listSchedules(user.councilId, user.memberId), [user.memberId, user.councilId]);

  const { data } = state;
  const invitedIds = new Set((data?.myInvites ?? []).map((m) => m.id));
  const meetings = data ? (tab === 'invites' ? data.myInvites : data.allSchedules) : [];

  return (
    <Screen refreshing={state.refreshing} onRefresh={() => void state.reload()}>
      <AppText variant="heading" accessibilityRole="header">
        Meetings
      </AppText>

      <View accessibilityRole="tablist" style={{ flexDirection: 'row', borderWidth: 2, borderColor: color.navy, borderRadius: radius.md, overflow: 'hidden' }}>
        {TABS.map(({ key, label }) => {
          const selected = tab === key;
          const count = key === 'invites' ? data?.myInvites.length : data?.allSchedules.length;
          return (
            <Pressable
              key={key}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => setTab(key)}
              style={{ flex: 1, minHeight: touchTarget, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? color.navy : color.white }}
            >
              <AppText variant="label" tone={selected ? 'white' : 'navy'}>
                {count === undefined ? label : `${label} (${count})`}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      {state.error ? <Notice tone="error" message={state.error} /> : null}
      {!data && state.loading ? <Loading /> : null}

      {data ? (
        <View style={{ gap: space.md }}>
          {meetings.length === 0 ? (
            <EmptyState message={tab === 'invites' ? 'You have no meeting invitations.' : 'Your council has no upcoming meetings scheduled.'} />
          ) : (
            meetings.map((m) => (
              <MeetingCard
                key={m.id}
                meeting={m}
                badge={tab === 'all' && invitedIds.has(m.id) ? <Pill label="INVITED" tone="navy" /> : undefined}
                onAttendance={canManageMeeting(user, m) ? () => router.push(`/meeting/${m.id}`) : undefined}
              />
            ))
          )}
        </View>
      ) : null}
      <View style={{ height: space.lg }} />
    </Screen>
  );
}
