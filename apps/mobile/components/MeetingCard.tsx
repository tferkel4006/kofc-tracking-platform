import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { formatMeetingWhen, type Meeting, type MeetingResponseStatus } from '@kofc/shared';
import { AppText, Button, Card } from '@/components/ui';
import { color, radius, space, touchTarget } from '@/lib/theme';

/** The invitee's RSVP control (Sprint 5Y-6): what they answered and the one tap that changes it. */
export interface MeetingRsvp {
  status: MeetingResponseStatus;
  onToggle: () => void;
}

/**
 * One tap to answer an invitation. Not yet attending: a gold outline "Count Me In" button. Attending: a green
 * "Attending" banner; tapping it again withdraws the answer.
 */
function RsvpToggle({ status, onToggle }: MeetingRsvp) {
  const attending = status === 'Accepted';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ checked: attending }}
      accessibilityLabel={attending ? 'Attending' : 'Count me in'}
      accessibilityHint={attending ? 'Withdraws your answer' : 'Tells the council you will attend'}
      onPress={onToggle}
      style={({ pressed }) => ({
        minHeight: touchTarget,
        borderRadius: radius.md,
        borderWidth: 2,
        borderColor: attending ? color.green : color.gold,
        backgroundColor: attending ? color.green : color.white,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: space.sm,
        paddingHorizontal: space.md,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <AppText variant="title" tone={attending ? 'white' : 'navy'}>
        {attending ? '✓ Attending' : '👍 Count Me In'}
      </AppText>
      {attending ? (
        <AppText variant="small" tone="white">
          Tap to undo
        </AppText>
      ) : status === 'Declined' ? (
        <AppText variant="small" tone="muted">
          {"You said you can't make it"}
        </AppText>
      ) : null}
    </Pressable>
  );
}

/**
 * One meeting: name, date and time (or its days, for a multi-day meeting), place and agenda; an invitee gets the RSVP
 * toggle, and officers and the owner a Take attendance button.
 */
export const MeetingCard = ({
  meeting,
  onAttendance,
  onAgenda,
  badge,
  rsvp,
}: {
  meeting: Meeting;
  onAttendance?: () => void;
  /** Sprint 6B Patch: open the meeting's full agenda sheet. */
  onAgenda?: () => void;
  badge?: ReactNode;
  rsvp?: MeetingRsvp;
}) => (
  <Card accent={color.navy}>
    <AppText variant="title">{meeting['Meeting Name']}</AppText>
    {badge}
    <AppText>{formatMeetingWhen(meeting)}</AppText>
    <AppText variant="small" tone="muted">
      {meeting.Location}
    </AppText>
    {meeting.Agenda ? (
      <AppText variant="small" tone="muted" numberOfLines={3}>
        {meeting.Agenda}
      </AppText>
    ) : null}
    {rsvp || onAttendance || onAgenda ? (
      <View style={{ gap: space.sm }}>
        {rsvp ? <RsvpToggle {...rsvp} /> : null}
        {onAgenda ? <Button title={meeting.IsLiveInProgress === 1 ? '● Follow the live agenda' : '📋 Full agenda'} variant="secondary" onPress={onAgenda} /> : null}
        {onAttendance ? <Button title="Take attendance" variant="secondary" onPress={onAttendance} /> : null}
      </View>
    ) : null}
  </Card>
);
