// Meeting attendance, taken on a phone during the meeting (Specifications: "Be able to record attendance
// at/during meeting"; officers can do this as well as admins). One large row per invited member: tap to
// mark them present, tap again to undo. Each tap saves at once and is shown immediately; a failed save
// puts the row back and says why. Members who may not manage the meeting see the list read-only.
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { canManageMeetings, formatDate, formatTimeRange } from '@kofc/shared';
import { AppText, Button, EmptyState, Loading, Notice, Screen, Section } from '@/components/ui';
import { useUser } from '@/lib/app-context';
import { color, radius, space, touchTarget } from '@/lib/theme';
import { describeError, useLoad } from '@/lib/use-async';
import { db } from '@/services/db';

export default function MeetingAttendanceScreen() {
  const user = useUser();
  const router = useRouter();
  const meetingId = Number(useLocalSearchParams<{ meetingId: string }>().meetingId);
  // Taps not yet confirmed by the database, keyed by member; they win over the loaded value until it reloads.
  const [pending, setPending] = useState(new Map<number, boolean>());
  const [error, setError] = useState<string | null>(null);

  const state = useLoad(async () => {
    const meeting = await db.meetings.get(meetingId);
    if (!meeting) return null;
    const [invites, members] = await Promise.all([db.meetings.listInvites(meetingId), db.members.listByCouncil(meeting.CouncilID)]);
    const name = new Map(members.map((m) => [m.id, `${m.MemberLastName}, ${m.MemberFirstName}`]));
    const rows = invites
      .map((i) => ({ memberId: i.MemberID, name: name.get(i.MemberID) ?? `Member ${i.MemberID}`, attended: i.Attended === 1 }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return { meeting, rows };
  }, [meetingId]);

  const { data } = state;
  const editable = data ? canManageMeetings(user, data.meeting.CouncilID) : false;
  const present = (row: { memberId: number; attended: boolean }) => pending.get(row.memberId) ?? row.attended;
  const here = data?.rows.filter(present).length ?? 0;

  const toggle = async (memberId: number, attended: boolean) => {
    setError(null);
    setPending((p) => new Map(p).set(memberId, attended));
    try {
      await db.meetings.setAttended(meetingId, memberId, attended);
      await state.reload();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setPending((p) => {
        const next = new Map(p);
        next.delete(memberId);
        return next;
      });
    }
  };

  return (
    <Screen refreshing={state.refreshing} onRefresh={() => void state.reload()}>
      <Button title="‹ Back" variant="secondary" style={{ alignSelf: 'flex-start' }} onPress={() => router.back()} />
      {state.error ? <Notice tone="error" message={state.error} /> : null}
      {error ? <Notice tone="error" message={error} onDismiss={() => setError(null)} /> : null}
      {data === undefined && state.loading ? <Loading /> : null}
      {data === null ? <Notice tone="error" message={`Meeting ${meetingId} no longer exists.`} /> : null}

      {data ? (
        <>
          <View style={{ gap: space.xs }}>
            <AppText variant="heading" accessibilityRole="header">
              {data.meeting['Meeting Name']}
            </AppText>
            <AppText>
              {formatDate(data.meeting.Date)} · {formatTimeRange(data.meeting['Time Start'], data.meeting['Time End'])}
            </AppText>
            <AppText variant="small" tone="muted">
              {data.meeting.Location}
            </AppText>
          </View>
          {!editable ? <Notice tone="info" message="Only the council's officers and admins can take attendance." /> : null}

          <Section
            title="Attendance"
            right={
              <AppText variant="title" accessibilityLiveRegion="polite">
                {here} of {data.rows.length} here
              </AppText>
            }
          >
            {data.rows.length === 0 ? (
              <EmptyState message="Nobody is invited to this meeting. Invite members from the web portal's meeting center." />
            ) : (
              data.rows.map((row) => {
                const on = present(row);
                return (
                  <Pressable
                    key={row.memberId}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on, disabled: !editable, busy: pending.has(row.memberId) }}
                    accessibilityLabel={row.name}
                    disabled={!editable}
                    onPress={() => void toggle(row.memberId, !on)}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: space.md,
                      minHeight: touchTarget + space.md,
                      paddingHorizontal: space.md,
                      borderWidth: 1,
                      borderColor: on ? color.navy : color.line,
                      borderLeftWidth: 8,
                      borderLeftColor: on ? color.gold : color.line,
                      borderRadius: radius.md,
                      backgroundColor: color.white,
                      opacity: pressed ? 0.8 : 1,
                    })}
                  >
                    <View
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: radius.sm,
                        borderWidth: 2,
                        borderColor: color.navy,
                        backgroundColor: on ? color.navy : color.white,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {on ? (
                        <AppText variant="title" tone="white">
                          ✓
                        </AppText>
                      ) : null}
                    </View>
                    <AppText variant={on ? 'title' : 'body'} style={{ flex: 1 }}>
                      {row.name}
                    </AppText>
                    <AppText variant="label" tone={on ? 'navy' : 'muted'}>
                      {on ? 'HERE' : 'NOT YET'}
                    </AppText>
                  </Pressable>
                );
              })
            )}
          </Section>
        </>
      ) : null}
    </Screen>
  );
}
