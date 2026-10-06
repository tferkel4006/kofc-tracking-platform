// Member Dashboard: the shifts I am signed up for (anything within two days in red), and an expense card that links to
// My expense reports and flags any report leadership returned for changes.
// Sprint 6A: no no-show tallies, badges or absence logs on the phone; a signup already marked as a no-show simply drops
// off My shifts. When the council switches off flag_complex_shifts, My shifts is gone too.
// Sprint 5Z-Mobile-Clean: Home holds only work still ahead. Meetings live on the Meetings tab, completed events are
// gone, and a shift drops off the minute it ends by the device clock, for every member, officers and admins included.
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { isUrgent, toIsoDate, withoutEndedShifts } from '@kofc/shared';
import { ShiftCard, UrgentTag } from '@/components/ShiftCard';
import { AppText, Button, Card, EmptyState, Loading, Notice, Screen, Section } from '@/components/ui';
import { useApp, useUser } from '@/lib/app-context';
import { useLoad } from '@/lib/use-async';
import { color, space } from '@/lib/theme';
import { db } from '@/services/db';

export default function DashboardScreen() {
  const user = useUser();
  const { features, refreshFeatures } = useApp();
  const shiftsOn = features.flag_complex_shifts;
  const router = useRouter();
  const state = useLoad(async () => {
    const today = new Date();
    const todayIso = toIsoDate(today);
    const [shifts, expenses] = await Promise.all([
      db.events.listMemberShifts(user.memberId, { fromDate: todayIso }),
      db.expenses.listUserReports(user.memberId),
    ]);
    const expenseSummary = {
      returned: expenses.filter((d) => d.report.Status === 'Draft' && d.report.RejectionReason).length,
      open: expenses.filter((d) => d.report.Status !== 'Reimbursed').length,
    };
    return { today, shifts, expenseSummary };
  }, [user.memberId, user.councilId]);

  const { data } = state;
  // A shift that has finished by the device clock, even earlier today, is gone for everyone, as is one marked a no-show.
  const myShifts = data ? withoutEndedShifts(data.shifts, new Date()).filter(({ signup }) => signup.NoShow !== 1) : [];
  return (
    <Screen refreshing={state.refreshing} onRefresh={() => void Promise.all([state.reload(), refreshFeatures()])}>
      <View>
        <AppText variant="heading" accessibilityRole="header">
          Hello, {user.firstName}
        </AppText>
      </View>

      {state.error ? <Notice tone="error" message={state.error} /> : null}
      {!data && state.loading ? <Loading /> : null}

      {data ? (
        <>
          {shiftsOn ? (
            <Section title="My shifts">
              {myShifts.length === 0 ? (
                <EmptyState message="You are not signed up for any upcoming shifts. Open the Signup Desk to volunteer." />
              ) : (
                myShifts.map(({ shift, event }) => {
                  const urgent = isUrgent(shift.ShiftDate, data.today);
                  return <ShiftCard key={shift.id} shift={shift} event={event} look={urgent ? 'urgent' : 'normal'} badges={urgent ? <UrgentTag /> : undefined} />;
                })
              )}
            </Section>
          ) : null}

          <Section title="Expense reports">
            <Card accent={data.expenseSummary.returned > 0 ? color.red : color.navy}>
              {data.expenseSummary.returned > 0 ? (
                <Notice
                  tone="error"
                  message={`${data.expenseSummary.returned} of your expense reports ${data.expenseSummary.returned === 1 ? 'was' : 'were'} returned for changes.`}
                />
              ) : null}
              <AppText>
                {data.expenseSummary.open === 0
                  ? 'Bought something for the council? Scan the receipt and claim a reimbursement.'
                  : `${data.expenseSummary.open} report${data.expenseSummary.open === 1 ? '' : 's'} not yet reimbursed.`}
              </AppText>
              <Button title="My expense reports" variant="secondary" onPress={() => router.push('/expenses')} />
            </Card>
          </Section>
        </>
      ) : null}
      <View style={{ height: space.lg }} />
    </Screen>
  );
}
