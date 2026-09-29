import type { ReactNode } from 'react';
import { formatDate, formatTimeRange, type Meeting } from '@kofc/shared';
import { AppText, Button, Card } from '@/components/ui';
import { color } from '@/lib/theme';

/** One meeting: name, date and time, place and agenda; officers and the owner get a Take attendance button. */
export const MeetingCard = ({ meeting, onAttendance, badge }: { meeting: Meeting; onAttendance?: () => void; badge?: ReactNode }) => (
  <Card accent={color.navy}>
    <AppText variant="title">{meeting['Meeting Name']}</AppText>
    {badge}
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
