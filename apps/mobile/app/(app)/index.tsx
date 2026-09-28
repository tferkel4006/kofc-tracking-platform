// Member Dashboard: the shifts I am signed up for (anything within two days in red), the rolling
// one-year no-show badge, and the meetings I am invited to (officers and admins can take attendance from them).
// Each of my shifts can report my own absence with a reason (events.setNoShow); only an Admin can clear one.
// Events I worked that have ended are listed too, where the event's owner and council officers can capture
// verification photos with the phone camera (events.uploadPhotos). A meeting's owner can open it like an officer.
import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  addDays,
  canAttachEventMedia,
  canManageMeeting,
  formatDate,
  formatTimeRange,
  isUrgent,
  noShowWindowStart,
  parsePhotoGallery,
  SHIFT_HISTORY_MONTHS,
  subtractMonths,
  toIsoDate,
  type Event,
  type EventSignup,
  type Meeting,
  type NoShowReason,
} from '@kofc/shared';
import { CapturePhotoButton } from '@/components/CapturePhotoButton';
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

/**
 * An event I worked that has finished, with its photo count. Its owner, the council's Admins, Financial Secretary
 * and Treasurer, and Super Admins may add verification photos straight from the phone camera.
 */
function CompletedEventCard({ event, canAddPhotos, onPhoto }: { event: Event; canAddPhotos: boolean; onPhoto: (path: string) => Promise<void> }) {
  const photos = parsePhotoGallery(event.PhotoGalleryURL).length;
  return (
    <Card accent={color.navy}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.sm }}>
        <AppText variant="title" style={{ flex: 1 }}>
          {event.EventName}
        </AppText>
        <Pill label="COMPLETED" tone="outline" />
      </View>
      <AppText>
        {event.StartDate === event.EndDate ? formatDate(event.StartDate) : `${formatDate(event.StartDate)} – ${formatDate(event.EndDate)}`}
      </AppText>
      <AppText variant="small" tone="muted">
        {event.Location} · {photos === 0 ? 'No photos yet' : `${photos} photo${photos === 1 ? '' : 's'}`}
      </AppText>
      {canAddPhotos ? (
        <CapturePhotoButton prefix={`event-${event.id}`} onCaptured={onPhoto} />
      ) : (
        <AppText variant="small" tone="muted">
          The event owner and council officers add photos.
        </AppText>
      )}
    </Card>
  );
}

const MeetingCard = ({ meeting, onAttendance }: { meeting: Meeting; onAttendance?: () => void }) => (
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
    {onAttendance ? <Button title="Take attendance" variant="secondary" onPress={onAttendance} /> : null}
  </Card>
);

export default function DashboardScreen() {
  const user = useUser();
  const router = useRouter();
  const state = useLoad(async () => {
    const today = new Date();
    const todayIso = toIsoDate(today);
    const [shifts, noShows, meetings, reasons, worked] = await Promise.all([
      db.events.listMemberShifts(user.memberId, { fromDate: todayIso }),
      db.events.countNoShows(user.memberId, noShowWindowStart(today)),
      db.meetings.listUpcoming(user.councilId, { memberId: user.memberId }),
      db.lookups.list('NoShowReason'),
      db.events.listMemberShifts(user.memberId, { fromDate: subtractMonths(today, SHIFT_HISTORY_MONTHS), toDate: addDays(todayIso, -1) }),
    ]);
    // Events I worked in the last 3 months that have ended, newest first, once each.
    const ended = new Map<number, Event>();
    for (const { event } of [...worked].reverse()) if (event.EndDate < todayIso && !ended.has(event.id)) ended.set(event.id, event);
    const completed = await Promise.all(
      [...ended.values()].map(async (event) => ({ event, canAddPhotos: canAttachEventMedia(user, event, await db.events.listCouncilIds(event.id)) })),
    );
    return { today, shifts, noShows, meetings, reasons, completed };
  }, [user.memberId, user.councilId]);
  const [notice, setNotice] = useState<string | null>(null);

  const { data } = state;
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
            {data.shifts.length === 0 ? (
              <EmptyState message="You are not signed up for any upcoming shifts. Open the Shifts tab to volunteer." />
            ) : (
              data.shifts.map(({ shift, event, signup }) => {
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

          {data.completed.length > 0 ? (
            <Section title="Completed events">
              {data.completed.map(({ event, canAddPhotos }) => (
                <CompletedEventCard
                  key={event.id}
                  event={event}
                  canAddPhotos={canAddPhotos}
                  onPhoto={async (path) => {
                    await db.events.uploadPhotos(user.memberId, event.id, [path]);
                    setNotice(`Photo added to ${event.EventName}.`);
                    await state.reload();
                  }}
                />
              ))}
            </Section>
          ) : null}

          <Section title="Upcoming meetings">
            {data.meetings.length === 0 ? (
              <EmptyState message="You have no meeting invitations." />
            ) : (
              data.meetings.map((m) => (
                <MeetingCard
                  key={m.id}
                  meeting={m}
                  onAttendance={canManageMeeting(user, m) ? () => router.push(`/meeting/${m.id}`) : undefined}
                />
              ))
            )}
          </Section>
        </>
      ) : null}
      <View style={{ height: space.lg }} />
    </Screen>
  );
}
