// Shift Signup Feed: the next six months of shifts for my council and its affiliated councils.
// Shifts that still need volunteers to reach MinNumberVolunteers are highlighted in gold; a shift that
// has reached its cap is locked, and hidden until "Show full shifts" is switched on.
import { useState } from 'react';
import { FlatList, RefreshControl, Switch, View } from 'react-native';
import { councilLabel, feedWindow, shiftStatus, sortCouncils, visibleFeed, type ShiftFeedItem } from '@kofc/shared';
import { Dropdown, type DropdownOption } from '@/components/Dropdown';
import { FullTag, PriorityTag, ShiftCard, SignedUpTag, type ShiftLook } from '@/components/ShiftCard';
import { AppText, Button, EmptyState, Loading, Notice } from '@/components/ui';
import { useUser } from '@/lib/app-context';
import { color, space } from '@/lib/theme';
import { describeError, useLoad } from '@/lib/use-async';
import { db } from '@/services/db';

type CouncilFilter = number | 'all';

export default function ShiftsScreen() {
  const user = useUser();
  const [councilId, setCouncilId] = useState<CouncilFilter>('all');
  const [showFull, setShowFull] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);
  const [signingUp, setSigningUp] = useState<number | null>(null);

  const state = useLoad(async () => {
    const today = new Date();
    const [own, affiliated] = await Promise.all([db.councils.get(user.councilId), db.councils.listAffiliated(user.councilId)]);
    const councils = sortCouncils([...(own ? [own] : []), ...affiliated]);
    const feed = await db.events.listShiftFeed({ memberId: user.memberId, councilIds: councils.map((c) => c.id), ...feedWindow(today) });
    return { today, councils, feed };
  }, [user.memberId, user.councilId]);

  const { data } = state;
  const options: DropdownOption<CouncilFilter>[] = [
    { value: 'all', label: 'All councils' },
    ...(data?.councils ?? []).map((c) => ({ value: c.id, label: councilLabel(c) })),
  ];
  const items = data ? visibleFeed(data.feed, { councilId, showLocked: showFull }) : [];

  const signUp = async (item: ShiftFeedItem) => {
    setSigningUp(item.shift.id);
    setMessage(null);
    try {
      await db.events.signupForShift(user.memberId, item.shift.id);
      setMessage({ tone: 'info', text: `You are signed up for ${item.shift.ShiftName} (${item.event.EventName}).` });
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setSigningUp(null);
      await state.reload();
    }
  };

  const renderItem = ({ item }: { item: ShiftFeedItem }) => {
    const { status, remaining } = shiftStatus(item.shift, data!.today);
    const look: ShiftLook = item.isSignedUp ? 'normal' : status === 'locked' ? 'locked' : status === 'priority' ? 'priority' : 'normal';
    const labels = item.councilIds
      .map((id) => data!.councils.find((c) => c.id === id))
      .filter((c) => c !== undefined)
      .map((c) => councilLabel(c));
    return (
      <ShiftCard
        shift={item.shift}
        event={item.event}
        look={look}
        councils={labels}
        badges={
          <>
            {item.isSignedUp ? <SignedUpTag /> : null}
            {!item.isSignedUp && status === 'priority' ? <PriorityTag remaining={remaining} /> : null}
            {!item.isSignedUp && status === 'locked' ? <FullTag /> : null}
          </>
        }
        footer={
          !item.isSignedUp && status !== 'locked' ? (
            <Button
              title="Sign up"
              busy={signingUp === item.shift.id}
              disabled={signingUp !== null}
              onPress={() => void signUp(item)}
            />
          ) : status === 'locked' && !item.isSignedUp ? (
            <AppText variant="small" tone="muted">
              This shift has all the volunteers it needs.
            </AppText>
          ) : undefined
        }
      />
    );
  };

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: color.white }}
      contentContainerStyle={{ padding: space.lg, gap: space.md }}
      data={items}
      keyExtractor={(item) => String(item.shift.id)}
      renderItem={renderItem}
      refreshControl={<RefreshControl refreshing={state.refreshing} onRefresh={() => void state.reload()} tintColor={color.navy} colors={[color.navy]} />}
      ListHeaderComponent={
        <View style={{ gap: space.md, marginBottom: space.sm }}>
          <AppText variant="heading" accessibilityRole="header">
            Volunteer shifts
          </AppText>
          <Dropdown title="Council" value={councilId} options={options} onChange={setCouncilId} accessibilityLabel="Filter by council" />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 }}>
            <AppText>Show full shifts</AppText>
            <Switch
              accessibilityLabel="Show full shifts"
              value={showFull}
              onValueChange={setShowFull}
              trackColor={{ false: color.line, true: color.navy }}
              thumbColor={showFull ? color.gold : color.white}
            />
          </View>
          {message ? <Notice tone={message.tone} message={message.text} onDismiss={() => setMessage(null)} /> : null}
          {state.error ? <Notice tone="error" message={state.error} /> : null}
        </View>
      }
      ListEmptyComponent={
        !data && state.loading ? (
          <Loading />
        ) : (
          <EmptyState message={showFull ? 'No shifts in the next six months for this filter.' : 'Every shift for this filter has its volunteers. Switch on "Show full shifts" to see them.'} />
        )
      }
    />
  );
}
