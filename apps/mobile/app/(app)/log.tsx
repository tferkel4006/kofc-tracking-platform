// Quick Log: record time against a shift I worked (up to 3 months back) or a council activity (up to
// 6 months back). Hours and minutes come from drop-downs (minutes 00/15/30/45) and are converted to
// a decimal in exact 0.25 steps by pickerResult() immediately before the DataService call, which
// validates the value again.
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import {
  addDays,
  formatHours,
  formatShiftWhen,
  hoursToPicker,
  pickerResult,
  SHIFT_HISTORY_MONTHS,
  subtractMonths,
  toIsoDate,
} from '@kofc/shared';
import { Dropdown } from '@/components/Dropdown';
import { TimePicker, type PickerValue } from '@/components/TimePicker';
import { AppInput, AppText, Button, Card, EmptyState, Field, Loading, Notice, Screen, Section } from '@/components/ui';
import { useUser } from '@/lib/app-context';
import { color, space, touchTarget } from '@/lib/theme';
import { describeError, useLoad } from '@/lib/use-async';
import { db } from '@/services/db';

type Mode = 'shift' | 'activity';
const NO_TIME: PickerValue = { hours: 0, minutes: 0 };

function Segmented({ value, onChange }: { value: Mode; onChange: (m: Mode) => void }) {
  const tab = (mode: Mode, label: string) => (
    <Pressable
      key={mode}
      accessibilityRole="tab"
      accessibilityState={{ selected: value === mode }}
      onPress={() => onChange(mode)}
      style={{ flex: 1, minHeight: touchTarget, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 4, borderBottomColor: value === mode ? color.gold : color.line }}
    >
      <AppText variant="title" tone={value === mode ? 'navy' : 'muted'}>
        {label}
      </AppText>
    </Pressable>
  );
  return <View style={{ flexDirection: 'row' }}>{[tab('shift', 'A shift I worked'), tab('activity', 'An activity')]}</View>;
}

export default function LogScreen() {
  const user = useUser();
  const [mode, setMode] = useState<Mode>('shift');
  const [shiftId, setShiftId] = useState<number | null>(null);
  const [activityId, setActivityId] = useState<number | null>(null);
  const [picker, setPicker] = useState<PickerValue>(NO_TIME);
  const [date, setDate] = useState(() => toIsoDate(new Date()));
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);

  const state = useLoad(async () => {
    const today = new Date();
    const [shifts, activities] = await Promise.all([
      db.events.listMemberShifts(user.memberId, { fromDate: subtractMonths(today, SHIFT_HISTORY_MONTHS), toDate: toIsoDate(today) }),
      db.activities.listByCouncil(user.councilId),
    ]);
    return { today: toIsoDate(today), shifts: shifts.reverse(), activities };
  }, [user.memberId, user.councilId]);
  const { data } = state;

  // Low-click defaults: the most recent shift still missing hours, and the council's first activity.
  useEffect(() => {
    if (!data) return;
    if (shiftId === null) {
      const first = data.shifts.find((s) => s.hoursLogged === null) ?? data.shifts[0];
      if (first) setShiftId(first.shift.id);
    }
    if (activityId === null && data.activities[0]) setActivityId(data.activities[0].id);
  }, [data, shiftId, activityId]);

  const pickShift = (id: number) => {
    setShiftId(id);
    const logged = data?.shifts.find((s) => s.shift.id === id)?.hoursLogged;
    setPicker(logged != null ? hoursToPicker(logged) : NO_TIME);
    setMessage(null);
  };

  const hours = pickerResult(picker.hours, picker.minutes);
  const target = mode === 'shift' ? shiftId : activityId;
  const canSave = target !== null && 'hours' in hours && !busy;

  const save = async () => {
    const result = pickerResult(picker.hours, picker.minutes);
    if (!('hours' in result) || target === null) return;
    setBusy(true);
    setMessage(null);
    try {
      const note = notes.trim() || undefined;
      let where: string;
      if (mode === 'shift') {
        await db.eventTime.logHours(user.memberId, target, result.hours, note);
        where = data?.shifts.find((s) => s.shift.id === target)?.shift.ShiftName ?? 'the shift';
      } else {
        await db.activityTime.logHours(user.memberId, target, result.hours, date.trim(), note);
        where = data?.activities.find((a) => a.id === target)?.ActivityName ?? 'the activity';
      }
      setMessage({ tone: 'info', text: `Saved ${formatHours(result.hours)} (${result.hours} hours) to ${where}.` });
      setNotes('');
      await state.reload();
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen refreshing={state.refreshing} onRefresh={() => void state.reload()}>
      <AppText variant="heading" accessibilityRole="header">
        Log your time
      </AppText>
      <Segmented value={mode} onChange={(m) => { setMode(m); setMessage(null); }} />

      {message ? <Notice tone={message.tone} message={message.text} onDismiss={() => setMessage(null)} /> : null}
      {state.error ? <Notice tone="error" message={state.error} /> : null}
      {!data && state.loading ? <Loading /> : null}

      {data && mode === 'shift' ? (
        <Section title="Which shift?">
          {data.shifts.length === 0 ? (
            <EmptyState message={`You have no shifts in the last ${SHIFT_HISTORY_MONTHS} months to report time for.`} />
          ) : (
            data.shifts.map(({ shift, event, hoursLogged }) => {
              const selected = shift.id === shiftId;
              return (
                <Pressable key={shift.id} accessibilityRole="radio" accessibilityState={{ selected }} onPress={() => pickShift(shift.id)}>
                  <Card accent={selected ? color.gold : color.line}>
                    <AppText variant="title">{shift.ShiftName}</AppText>
                    <AppText variant="small" tone="muted">
                      {event.EventName} · {formatShiftWhen(shift)}
                    </AppText>
                    {hoursLogged === null ? (
                      <AppText variant="label" tone="red">
                        NO TIME LOGGED YET
                      </AppText>
                    ) : (
                      <AppText variant="label">LOGGED {formatHours(hoursLogged).toUpperCase()} · TAP TO CHANGE</AppText>
                    )}
                  </Card>
                </Pressable>
              );
            })
          )}
        </Section>
      ) : null}

      {data && mode === 'activity' ? (
        <Section title="Which activity?">
          {data.activities.length === 0 ? (
            <EmptyState message="Your council has no activities yet. An admin can add them." />
          ) : (
            <View style={{ gap: space.md }}>
              <Dropdown
                title="Activity"
                value={activityId}
                options={data.activities.map((a) => ({ value: a.id, label: a.ActivityName }))}
                onChange={setActivityId}
              />
              <Field label="DATE (YYYY-MM-DD)">
                <AppInput value={date} onChangeText={setDate} autoCapitalize="none" autoCorrect={false} keyboardType="numbers-and-punctuation" maxLength={10} />
              </Field>
              <View style={{ flexDirection: 'row', gap: space.md }}>
                <Button title="Today" variant="secondary" style={{ flex: 1 }} onPress={() => setDate(data.today)} />
                <Button title="Yesterday" variant="secondary" style={{ flex: 1 }} onPress={() => setDate(addDays(data.today, -1))} />
              </View>
            </View>
          )}
        </Section>
      ) : null}

      {data && (mode === 'shift' ? data.shifts.length > 0 : data.activities.length > 0) ? (
        <>
          <Section title="How long?">
            <TimePicker value={picker} onChange={setPicker} />
          </Section>
          <Field label="NOTES (OPTIONAL)">
            <AppInput value={notes} onChangeText={setNotes} multiline style={{ minHeight: 72, textAlignVertical: 'top', paddingTop: space.md }} maxLength={255} />
          </Field>
          <Button title="Save time" busy={busy} disabled={!canSave} onPress={() => void save()} />
        </>
      ) : null}
    </Screen>
  );
}
