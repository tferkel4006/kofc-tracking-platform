import type { ReactNode } from 'react';
import { View } from 'react-native';
import { formatShiftWhen, type Event, type Shift } from '@kofc/shared';
import { AppText, Card, Pill } from '@/components/ui';
import { color, space } from '@/lib/theme';

export type ShiftLook = 'urgent' | 'priority' | 'normal' | 'locked';

const accentFor: Record<ShiftLook, string> = {
  urgent: color.red, // within 2 days
  priority: color.gold, // still needs volunteers
  normal: color.navy,
  locked: color.line,
};

/**
 * One shift. `look` picks the accent bar: red when it starts within two days, gold when it is a priority
 * for volunteers, a muted bar when it is full. `badges` and `footer` let each screen add its own status
 * chips and action button.
 */
export function ShiftCard({
  shift,
  event,
  look,
  councils,
  badges,
  footer,
}: {
  shift: Shift;
  event: Pick<Event, 'EventName' | 'Location'>;
  look: ShiftLook;
  councils?: string[];
  badges?: ReactNode;
  footer?: ReactNode;
}) {
  const urgent = look === 'urgent';
  return (
    <Card accent={accentFor[look]} muted={look === 'locked'}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>{badges}</View>
      <AppText variant="title">{shift.ShiftName}</AppText>
      <AppText variant="body" tone={urgent ? 'red' : 'navy'} style={urgent ? { fontWeight: '700' } : undefined}>
        {formatShiftWhen(shift)}
      </AppText>
      <AppText variant="small" tone="muted">
        {event.EventName} · {event.Location}
      </AppText>
      {councils && councils.length > 0 ? (
        <AppText variant="small" tone="muted">
          {councils.join(' · ')}
        </AppText>
      ) : null}
      <AppText variant="small" tone="muted">
        {shift.NumberVolunteersSignedUp} of {shift.MinNumberVolunteers} volunteers
      </AppText>
      {footer}
    </Card>
  );
}

export const UrgentTag = () => <Pill label="WITHIN 2 DAYS" tone="red" />;
export const PriorityTag = ({ remaining }: { remaining: number }) => (
  <Pill label={`NEEDS ${remaining} MORE`} tone="gold" />
);
export const FullTag = () => <Pill label="FULL" tone="outline" />;
export const SignedUpTag = () => <Pill label="YOU'RE SIGNED UP" tone="navy" />;
