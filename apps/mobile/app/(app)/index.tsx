// Member Dashboard: the shifts I am signed up for (anything within two days in red), the rolling
// one-year no-show badge, and an expense card that links to My expense reports and flags any report leadership
// returned for changes. Each of my shifts can report my own absence with a reason (events.setNoShow); only an Admin
// can clear one.
// Sprint 5Z-Mobile-Clean: Home holds only work still ahead. Meetings live on the Meetings tab, completed events are
// gone, and a shift drops off the minute it ends by the device clock, for every member, officers and admins included.
import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { isUrgent, noShowWindowStart, toIsoDate, withoutEndedShifts, type EventSignup, type NoShowReason } from '@kofc/shared';
import { Dropdown } from '@/components/Dropdown';
import { NoShowBadge } from '@/components/NoShowBadge';
import { ShiftCard, UrgentTag } from '@/components/ShiftCard';
import { AppText, Button, Card, EmptyState, Field, Loading, Notice, Pill, Screen, Section } from '@/components/ui';
import { useUser } from '@/lib/app-context';
import { describeError, useLoad } from '@/lib/use-async';
import { color, space } from '@/lib/theme';
import { db } from '@/services/db';

/** The foot of one of my shift cards: the reported absence, or the button that reports one after asking why. */
function AbsenceFooter({
  signup,
  shiftName,
  reasons,
  onReported,
}: {
  signup: EventSignup;
  shiftName: string;
  reasons: readonly NoShowReason[];
  onReported: (message: string) => Promise<void>;
}) {
  const user = useUser();
  const [asking, setAsking] = useState(false);
  const [reasonId, setReasonId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (signup.NoShow === 1) {
    const reason = reasons.find((r) => r.id === signup.NoShowReasonID);
    return (
      <View style={{ gap: space.xs }}>
        <Pill label="ABSENCE REPORTED" tone="red" />
        {reason ? (
          <AppText variant="small" tone="muted">
            Reason: {reason.NoShowReasonDescription}
          </AppText>
        ) : null}
      </View>
    );
  }
  if (!asking) return <Button title="Report absence / no-show" variant="secondary" onPress={() => setAsking(true)} />;

  const confirm = async () => {
    if (reasonId === null) return;
    setBusy(true);
    setError(null);
    try {
      await db.events.setNoShow(user.memberId, signup.id, true, reasonId);
      await onReported(`Absence reported for ${shiftName}. Please also let the event owner know.`);
    } catch (err) {
      setError(describeError(err));
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: space.md }}>
      {error ? <Notice tone="error" message={error} onDismiss={() => setError(null)} /> : null}
      <Field label="WHY CAN'T YOU MAKE IT?">
        <Dropdown
          title="Reason"
          placeholder="Choose a reason…"
          value={reasonId}
          options={reasons.map((r) => ({ value: r.id, label: r.NoShowReasonDescription }))}
          onChange={setReasonId}
        />
      </Field>
      <AppText variant="small" tone="muted">
        This counts as a no-show on your badge. Only a council admin can remove it.
      </AppText>
      <Button title="Confirm absence" variant="danger" busy={busy} disabled={reasonId === null} onPress={() => void confirm()} />
      <Button title="Cancel" variant="secondary" onPress={() => setAsking(false)} />
    </View>
  );
}

export default function DashboardScreen() {
  const user = useUser();
  const router = useRouter();
  const state = useLoad(async () => {
    const today = new Date();
    const todayIso = toIsoDate(today);
    const [shifts, noShows, reasons, expenses] = await Promise.all([
      db.events.listMemberShifts(user.memberId, { fromDate: todayIso }),
      db.events.countNoShows(user.memberId, noShowWindowStart(today)),
      db.lookups.list('NoShowReason'),
      db.expenses.listUserReports(user.memberId),
    ]);
    const expenseSummary = {
      returned: expenses.filter((d) => d.report.Status === 'Draft' && d.report.RejectionReason).length,
      open: expenses.filter((d) => d.report.Status !== 'Reimbursed').length,
    };
    return { today, shifts, noShows, reasons, expenseSummary };
  }, [user.memberId, user.councilId]);
  const [notice, setNotice] = useState<string | null>(null);

  const { data } = state;
  // A shift that has finished by the device clock, even earlier today, is gone for everyone.
  const myShifts = data ? withoutEndedShifts(data.shifts, new Date()) : [];
  return (
    <Screen refreshing={state.refreshing} onRefresh={() => void state.reload()}>
      <View>
        <AppText variant="heading" accessibilityRole="header">
          Hello, {user.firstName}
        </AppText>
      </View>

      {state.error ? <Notice tone="error" message={state.error} /> : null}
      {notice ? <Notice tone="info" message={notice} onDismiss={() => setNotice(null)} /> : null}
      {!data && state.loading ? <Loading /> : null}

      {data ? (
        <>
          <NoShowBadge count={data.noShows} />

          <Section title="My shifts">
            {myShifts.length === 0 ? (
              <EmptyState message="You are not signed up for any upcoming shifts. Open the Signup Desk to volunteer." />
            ) : (
              myShifts.map(({ shift, event, signup }) => {
                const urgent = isUrgent(shift.ShiftDate, data.today);
                return (
                  <ShiftCard
                    key={shift.id}
                    shift={shift}
                    event={event}
                    look={signup.NoShow === 1 ? 'locked' : urgent ? 'urgent' : 'normal'}
                    badges={urgent && signup.NoShow !== 1 ? <UrgentTag /> : undefined}
                    footer={
                      <AbsenceFooter
                        signup={signup}
                        shiftName={shift.ShiftName}
                        reasons={data.reasons}
                        onReported={async (message) => {
                          setNotice(message);
                          await state.reload();
                        }}
                      />
                    }
                  />
                );
              })
            )}
          </Section>

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
