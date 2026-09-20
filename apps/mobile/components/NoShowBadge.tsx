import { View } from 'react-native';
import { NO_SHOW_WINDOW_MONTHS } from '@kofc/shared';
import { AppText } from '@/components/ui';
import { color, radius, space } from '@/lib/theme';

/** Rolling one-year no-show tally, always in Secondary Red: filled when there are any, outlined at zero. */
export function NoShowBadge({ count }: { count: number }) {
  const filled = count > 0;
  return (
    <View
      accessible
      accessibilityLabel={`${count} no-show${count === 1 ? '' : 's'} recorded in the past ${NO_SHOW_WINDOW_MONTHS} months`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}
    >
      <View
        style={{
          minWidth: 56,
          height: 56,
          borderRadius: radius.pill,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: space.md,
          borderWidth: 3,
          borderColor: color.red,
          backgroundColor: filled ? color.red : color.white,
        }}
      >
        <AppText variant="heading" tone={filled ? 'white' : 'red'}>
          {count}
        </AppText>
      </View>
      <View style={{ flex: 1 }}>
        <AppText variant="title" tone="red">
          No-shows
        </AppText>
        <AppText variant="small" tone="muted">
          Past {NO_SHOW_WINDOW_MONTHS} months
        </AppText>
      </View>
    </View>
  );
}
