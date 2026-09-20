// Hours and minutes drop-downs (minutes: 00, 15, 30, 45). The screen keeps the two selections and
// converts them to the 0.25-step decimal with pickerResult() right before calling the DataService.
import { View } from 'react-native';
import { formatHours, HOUR_OPTIONS, MINUTE_OPTIONS, padMinutes, pickerResult } from '@kofc/shared';
import { Dropdown } from '@/components/Dropdown';
import { AppText, Field } from '@/components/ui';
import { space } from '@/lib/theme';

export interface PickerValue {
  hours: number;
  minutes: number;
}

const hourOptions = HOUR_OPTIONS.map((h) => ({ value: h, label: `${h} ${h === 1 ? 'hour' : 'hours'}` }));
const minuteOptions = MINUTE_OPTIONS.map((m) => ({ value: m, label: `${padMinutes(m)} min` }));

export function TimePicker({ value, onChange }: { value: PickerValue; onChange: (next: PickerValue) => void }) {
  const result = pickerResult(value.hours, value.minutes);
  return (
    <View style={{ gap: space.sm }}>
      <View style={{ flexDirection: 'row', gap: space.md }}>
        <View style={{ flex: 1 }}>
          <Field label="HOURS">
            <Dropdown title="Hours" value={value.hours} options={hourOptions} onChange={(hours) => onChange({ ...value, hours })} />
          </Field>
        </View>
        <View style={{ flex: 1 }}>
          <Field label="MINUTES">
            <Dropdown title="Minutes" value={value.minutes} options={minuteOptions} onChange={(minutes) => onChange({ ...value, minutes })} />
          </Field>
        </View>
      </View>
      {'hours' in result ? (
        <AppText variant="small" tone="muted">
          {formatHours(result.hours)} = {result.hours} hours
        </AppText>
      ) : (
        <AppText variant="small" tone="red" accessibilityLiveRegion="polite">
          {result.error}
        </AppText>
      )}
    </View>
  );
}
