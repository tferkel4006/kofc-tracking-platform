// Member Dashboard: the shifts I am signed up for (anything within two days in red), the rolling
// one-year no-show badge, and the meetings I am invited to.
import { View } from 'react-native';
import { formatDate, formatTimeRange, isUrgent, noShowWindowStart, toIsoDate, type Meeting } from '@kofc/shared';
import { NoShowBadge } from '@/components/NoShowBadge';
import { ShiftCard, UrgentTag } from '@/components/ShiftCard';
import { AppText, Card, EmptyState, Loading, Notice, Screen, Section } from '@/components/ui';
import { useUser } from '@/lib/app-context';
import { useLoad } from '@/lib/use-async';
import { color, space } from '@/lib/theme';
import { db } from '@/services/db';

const MeetingCard = ({ meeting }: { meeting: Meeting }) => (
  <Card accent={color.navy}>
    <AppText variant="title">{meeting['Meeting Name']}</AppText>
    <AppText>
      {formatDate(meeting.Date)} · {formatTimeRange(meeting['Time Start'], meeting['Time End'])}
    </AppText>
    <AppText variant="small" tone="muted">
      {meeting.Location}
    </AppText>
    {meeting.Agenda ? (
      <AppText variant="small" tone="muted" numberOfLines={3}>
        {meeting.Agenda}
      </AppText>
    ) : null}
  </Card>
);

export default function DashboardScreen() {
  const user = useUser();
  const state = useLoad(async () => {
    const today = new Date();
    const [shifts, noShows, meetings] = await Promise.all([
      db.events.listMemberShifts(user.memberId, { fromDate: toIsoDate(today) }),
      db.events.countNoShows(user.memberId, noShowWindowStart(today)),
      db.meetings.listUpcoming(user.councilId, { memberId: user.memberId }),
    ]);
    return { today, shifts, noShows, meetings };
  }, [user.memberId, user.councilId]);

  const { data } = state;
  return (
    <Screen refreshing={state.refreshing} onRefresh={() => void state.reload()}>
      <View>
        <AppText variant="heading" accessibilityRole="header">
          Hello, {user.firstName}
        </AppText>
      </View>

      {state.error ? <Notice tone="error" message={state.error} /> : null}
      {!data && state.loading ? <Loading /> : null}

      {data ? (
        <>
          <NoShowBadge count={data.noShows} />

          <Section title="My shifts">
            {data.shifts.length === 0 ? (
              <EmptyState message="You are not signed up for any upcoming shifts. Open the Shifts tab to volunteer." />
            ) : (
              data.shifts.map(({ shift, event }) => {
                const urgent = isUrgent(shift.ShiftDate, data.today);
                return (
                  <ShiftCard
                    key={shift.id}
                    shift={shift}
                    event={event}
                    look={urgent ? 'urgent' : 'normal'}
                    badges={urgent ? <UrgentTag /> : undefined}
                  />
                );
              })
            )}
          </Section>

          <Section title="Upcoming meetings">
            {data.meetings.length === 0 ? (
              <EmptyState message="You have no meeting invitations." />
            ) : (
              data.meetings.map((m) => <MeetingCard key={m.id} meeting={m} />)
            )}
          </Section>
        </>
      ) : null}
      <View style={{ height: space.lg }} />
    </Screen>
  );
}
