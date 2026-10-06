// Signup Desk: the next 30 days of shifts for my council and its affiliated councils (Sprint 5Z-Final-Polish
// narrowed it from six months; signupWindow), in two tabs styled like the Meetings page:
//   Shifts Opening (default) - shifts still short of MinNumberVolunteers, the ones close or empty in gold;
//   Full Up                  - shifts that have reached their minimum, still open to honorary signups.
// Shifts I already hold are left out; they live under "My shifts" on Home.
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { councilLabel, isShiftFull, shiftStatus, signupWindow, sortCouncils, visibleFeed, type ShiftFeedItem } from '@kofc/shared';
import { Dropdown, type DropdownOption } from '@/components/Dropdown';
import { FullTag, PriorityTag, ShiftCard, type ShiftLook } from '@/components/ShiftCard';
import { AppText, choiceStyle, Button, EmptyState, Loading, Notice } from '@/components/ui';
import { FeatureGate } from '@/components/FeatureGate';
import { useUser } from '@/lib/app-context';
import { useTheme } from '@/lib/layout-mode';
import { describeError, useLoad } from '@/lib/use-async';
import { db } from '@/services/db';

type CouncilFilter = number | 'all';
type SignupTab = 'opening' | 'full';

const TABS: { key: SignupTab; label: string }[] = [
  { key: 'opening', label: 'Shifts Opening' },
  { key: 'full', label: 'Full Up' },
];

function ShiftsScreenBody() {
  const theme = useTheme();
  const { color, radius, space, touchTarget } = theme;
  const user = useUser();
  const [councilId, setCouncilId] = useState<CouncilFilter>('all');
  const [tab, setTab] = useState<SignupTab>('opening');
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);
  const [signingUp, setSigningUp] = useState<number | null>(null);

  const state = useLoad(async () => {
    const today = new Date();
    const [own, affiliated] = await Promise.all([db.councils.get(user.councilId), db.councils.listAffiliated(user.councilId)]);
    const councils = sortCouncils([...(own ? [own] : []), ...affiliated]);
    const feed = await db.events.listShiftFeed({ memberId: user.memberId, councilIds: councils.map((c) => c.id), ...signupWindow(today) });
    return { today, councils, feed };
  }, [user.memberId, user.councilId]);

  const { data } = state;
  const options: DropdownOption<CouncilFilter>[] = [
    { value: 'all', label: 'All councils' },
    ...(data?.councils ?? []).map((c) => ({ value: c.id, label: councilLabel(c) })),
  ];
  const shown = data ? visibleFeed(data.feed, { councilId, showLocked: true, hideSignedUp: true }) : [];
  const byTab: Record<SignupTab, ShiftFeedItem[]> = {
    opening: shown.filter((item) => !isShiftFull(item.shift)),
    full: shown.filter((item) => isShiftFull(item.shift)),
  };
  const items = byTab[tab];

  const signUp = async (item: ShiftFeedItem) => {
    setSigningUp(item.shift.id);
    setMessage(null);
    try {
      await db.events.signupForShift(user.memberId, item.shift.id);
      const honorary = isShiftFull(item.shift) ? ' as an honorary volunteer' : '';
      setMessage({ tone: 'info', text: `You are signed up${honorary} for ${item.shift.ShiftName} (${item.event.EventName}). It is now under My shifts on Home.` });
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setSigningUp(null);
      await state.reload();
    }
  };

  const renderItem = ({ item }: { item: ShiftFeedItem }) => {
    const { status, remaining } = shiftStatus(item.shift, data!.today);
    const look: ShiftLook = status === 'locked' ? 'locked' : status === 'priority' ? 'priority' : 'normal';
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
            {status === 'priority' ? <PriorityTag remaining={remaining} /> : null}
            {status === 'locked' ? <FullTag /> : null}
          </>
        }
        footer={
          <Button
            title={status === 'locked' ? 'Sign up as honorary volunteer' : 'Sign up'}
            variant={status === 'locked' ? 'secondary' : undefined}
            busy={signingUp === item.shift.id}
            disabled={signingUp !== null}
            onPress={() => void signUp(item)}
          />
        }
      />
    );
  };

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: color.white }}
      contentContainerStyle={{ padding: space.lg, paddingTop: space.md, gap: space.md }}
      data={items}
      keyExtractor={(item) => String(item.shift.id)}
      renderItem={renderItem}
      refreshControl={<RefreshControl refreshing={state.refreshing} onRefresh={() => void state.reload()} tintColor={color.text} colors={[color.text]} />}
      ListHeaderComponent={
        <View style={{ gap: space.md, marginBottom: space.sm }}>
          <AppText variant="heading" accessibilityRole="header">
            Signup Desk
          </AppText>
          <View
            accessibilityRole="tablist"
            style={{ flexDirection: 'row', borderWidth: theme.border(2), borderColor: theme.large ? color.gold : color.navy, borderRadius: radius.md, overflow: 'hidden' }}
          >
            {TABS.map(({ key, label }) => {
              const selected = tab === key;
              return (
                <Pressable
                  key={key}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  onPress={() => setTab(key)}
                  style={[{ flex: 1, minHeight: touchTarget, alignItems: 'center', justifyContent: 'center' }, choiceStyle(theme, selected)]}
                >
                  <AppText variant="label" tone={selected ? 'white' : 'navy'}>
                    {data ? `${label} (${byTab[key].length})` : label}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
          <Dropdown title="Council" value={councilId} options={options} onChange={setCouncilId} accessibilityLabel="Filter by council" />
          {message ? <Notice tone={message.tone} message={message.text} onDismiss={() => setMessage(null)} /> : null}
          {state.error ? <Notice tone="error" message={state.error} /> : null}
        </View>
      }
      ListEmptyComponent={
        !data && state.loading ? (
          <Loading />
        ) : (
          <EmptyState
            message={
              tab === 'opening'
                ? 'Every shift in the next 30 days for this filter has its volunteers. See Full Up to join one as an honorary volunteer.'
                : 'No shift in the next 30 days for this filter is full yet.'
            }
          />
        )
      }
    />
  );
}

export default function ShiftsScreen() {
  return (
    <FeatureGate flag="flag_complex_shifts">
      <ShiftsScreenBody />
    </FeatureGate>
  );
}
