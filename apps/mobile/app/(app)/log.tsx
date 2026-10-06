// Report Hours. Sprint 6A replaced the hour and minute drop-downs with taps:
//   - Activities (the default): a high-contrast grid with one button per council activity. Each tap logs 15 minutes
//     for today at once (activityTime.addQuarterHour), and another tap on the same button grows that day's entry by
//     15 minutes more; a toast flashes the new total. Taps queue, so rapid taps never race each other's transaction.
//   - A shift I worked (only while the council keeps flag_complex_shifts on): pick a shift (up to 3 months back), then
//     step the time in 15-minute steps and save. A shift with no hours logged yet starts at its own length
//     (shifts.getShiftDefaultLength, Sprint 5Y-6).
// Sprint 5Z-6: a shift whose event has not started, or ended more than 30 days ago (expenseWindowState), is padlocked
// and grayed, and Save stays disabled while it is chosen.
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, View } from 'react-native';
import {
  eventExpenseSpan,
  expenseWindowLockMessage,
  formatHours,
  formatShiftWhen,
  HOURS_STEP,
  MAX_HOURS_PER_ENTRY,
  SHIFT_HISTORY_MONTHS,
  subtractMonths,
  toIsoDate,
  type Activities,
} from '@kofc/shared';
import { AppInput, AppText, Button, Card, EmptyState, Field, Loading, Notice, Screen, Section } from '@/components/ui';
import { useFeatureFlags, useUser } from '@/lib/app-context';
import { color, radius, space, touchTarget } from '@/lib/theme';
import { describeError, useLoad } from '@/lib/use-async';
import { db } from '@/services/db';

type Mode = 'activity' | 'shift';
/** How long a confirmation toast stays up, in milliseconds. */
const TOAST_MS = 1800;

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
  return <View style={{ flexDirection: 'row' }}>{[tab('activity', 'Activities'), tab('shift', 'A shift I worked')]}</View>;
}

type Toast = { tone: 'info' | 'error'; text: string };

/** A confirmation that flashes over the foot of the screen and fades away by itself. */
function useToast() {
  const [toast, setToast] = useState<Toast | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  const show = (next: Toast) => {
    if (timer.current) clearTimeout(timer.current);
    setToast(next);
    opacity.setValue(1);
    timer.current = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => setToast(null));
    }, TOAST_MS);
  };
  const view = toast ? (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={{
        position: 'absolute',
        left: space.lg,
        right: space.lg,
        bottom: space.lg,
        opacity,
        backgroundColor: toast.tone === 'error' ? color.red : color.green,
        borderRadius: radius.md,
        borderWidth: 2,
        borderColor: color.white,
        padding: space.md,
      }}
    >
      <AppText variant="title" tone="white" style={{ textAlign: 'center' }}>
        {toast.text}
      </AppText>
    </Animated.View>
  ) : null;
  return { show, view };
}

/** One activity's button: navy with white type and a gold edge (12.6:1), today's total underneath. */
function ActivityTile({ activity, today, onPress }: { activity: Activities; today: number; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Log 15 minutes of ${activity.ActivityName}`}
      accessibilityHint={today > 0 ? `${formatHours(today)} logged today` : 'Nothing logged today yet'}
      onPress={onPress}
      style={({ pressed }) => ({
        flexBasis: '47%',
        flexGrow: 1,
        minHeight: 88,
        padding: space.md,
        gap: space.xs,
        justifyContent: 'center',
        borderRadius: radius.md,
        borderWidth: 3,
        borderColor: color.gold,
        backgroundColor: pressed ? color.gold : color.navy,
      })}
    >
      {({ pressed }) => (
        <>
          <AppText variant="title" style={{ color: pressed ? color.navy : color.white }}>
            {activity.ActivityName}
          </AppText>
          <AppText variant="label" style={{ color: pressed ? color.navy : color.gold }}>
            {today > 0 ? `${formatHours(today).toUpperCase()} TODAY` : '+15 MIN'}
          </AppText>
        </>
      )}
    </Pressable>
  );
}

/** The rapid-tap grid: one tap, 15 minutes against the activity for today. */
function ActivityGrid({ onToast }: { onToast: (toast: Toast) => void }) {
  const user = useUser();
  const [today] = useState(() => toIsoDate(new Date()));
  const state = useLoad(async () => {
    const activities = await db.activities.listByCouncil(user.councilId);
    const logs = await Promise.all(activities.map((a) => db.activityTime.listByActivity(a.id)));
    const totals = new Map(
      logs.map((log) => [
        log.activity.id,
        log.entries.filter((e) => e.row.MemberID === user.memberId && e.row.ActivityDate === today).reduce((sum, e) => sum + e.row.Hours, 0),
      ]),
    );
    return { activities, totals };
  }, [user.memberId, user.councilId, today]);
  // Today's totals per activity; the ref is the running count the queued taps add to, the state what is drawn.
  const [totals, setTotals] = useState<ReadonlyMap<number, number>>(new Map());
  const running = useRef(new Map<number, number>());
  useEffect(() => {
    if (!state.data) return;
    running.current = new Map(state.data.totals);
    setTotals(running.current);
  }, [state.data]);

  // Taps run one after another, each in its own transaction, however fast they come.
  const queue = useRef<Promise<void>>(Promise.resolve());
  const tap = (activity: Activities) => {
    queue.current = queue.current.then(async () => {
      try {
        await db.activityTime.addQuarterHour(user.memberId, activity.id, today);
        const total = (running.current.get(activity.id) ?? 0) + HOURS_STEP;
        running.current = new Map(running.current).set(activity.id, total);
        setTotals(running.current);
        onToast({ tone: 'info', text: `+15 min · ${activity.ActivityName} (${formatHours(total)} today)` });
      } catch (err) {
        onToast({ tone: 'error', text: describeError(err) });
      }
    });
  };

  const { data } = state;
  return (
    <>
      {state.error ? <Notice tone="error" message={state.error} /> : null}
      {!data && state.loading ? <Loading /> : null}
      {data ? (
        <Section title="Tap an activity: 15 minutes per tap">
          {data.activities.length === 0 ? (
            <EmptyState message="Your council has no activities yet. An admin can add them." />
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
              {data.activities.map((a) => (
                <ActivityTile key={a.id} activity={a} today={totals.get(a.id) ?? 0} onPress={() => tap(a)} />
              ))}
            </View>
          )}
        </Section>
      ) : null}
    </>
  );
}

/** Minus and plus 15 minutes around the total, in place of the old hour and minute drop-downs. */
function QuarterStepper({ value, onChange }: { value: number; onChange: (hours: number) => void }) {
  const step = (delta: number) => onChange(Math.min(MAX_HOURS_PER_ENTRY, Math.max(0, value + delta)));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
      <Button title="− 15 min" variant="secondary" style={{ flex: 1 }} disabled={value <= 0} onPress={() => step(-HOURS_STEP)} />
      <AppText variant="heading" style={{ minWidth: 96, textAlign: 'center' }} accessibilityLiveRegion="polite">
        {value > 0 ? formatHours(value) : '0 m'}
      </AppText>
      <Button title="+ 15 min" variant="secondary" style={{ flex: 1 }} disabled={value >= MAX_HOURS_PER_ENTRY} onPress={() => step(HOURS_STEP)} />
    </View>
  );
}

function ShiftReport({ onToast }: { onToast: (toast: Toast) => void }) {
  const user = useUser();
  const [shiftId, setShiftId] = useState<number | null>(null);
  const [hours, setHours] = useState(0);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const state = useLoad(async () => {
    const today = new Date();
    const shifts = await db.events.listMemberShifts(user.memberId, { fromDate: subtractMonths(today, SHIFT_HISTORY_MONTHS), toDate: toIsoDate(today) });
    return { today: toIsoDate(today), shifts: shifts.reverse() };
  }, [user.memberId]);
  const { data } = state;

  // The shift the time is being filled for, so a slow default for a shift no longer chosen is dropped.
  const picking = useRef<number | null>(null);
  const pickShift = (id: number) => {
    picking.current = id;
    setShiftId(id);
    const logged = data?.shifts.find((s) => s.shift.id === id)?.hoursLogged;
    if (logged != null) {
      setHours(logged);
      return;
    }
    setHours(0);
    db.shifts.getShiftDefaultLength(id).then(
      (length) => {
        if (picking.current === id && length > 0) setHours(length);
      },
      () => undefined, // no default: the member steps the time themselves
    );
  };

  // Low-click default: the most recent shift still missing hours, with its length filled in.
  useEffect(() => {
    if (!data || shiftId !== null) return;
    const first = data.shifts.find((s) => s.hoursLogged === null) ?? data.shifts[0];
    if (first) pickShift(first.shift.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, shiftId]);

  const lockOf = (event: Parameters<typeof eventExpenseSpan>[0]) => (data ? expenseWindowLockMessage(eventExpenseSpan(event), data.today) : null);
  const chosen = data?.shifts.find((s) => s.shift.id === shiftId);
  const locked = chosen ? lockOf(chosen.event) : null;
  const canSave = shiftId !== null && hours > 0 && !busy && locked === null;

  const save = async () => {
    if (!canSave || shiftId === null) return;
    setBusy(true);
    try {
      await db.eventTime.logHours(user.memberId, shiftId, hours, notes.trim() || undefined);
      onToast({ tone: 'info', text: `Saved ${formatHours(hours)} to ${chosen?.shift.ShiftName ?? 'the shift'}` });
      setNotes('');
      await state.reload();
    } catch (err) {
      onToast({ tone: 'error', text: describeError(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {state.error ? <Notice tone="error" message={state.error} /> : null}
      {!data && state.loading ? <Loading /> : null}
      {data ? (
        <Section title="Which shift?">
          {data.shifts.length === 0 ? (
            <EmptyState message={`You have no shifts in the last ${SHIFT_HISTORY_MONTHS} months to report time for.`} />
          ) : (
            data.shifts.map(({ shift, event, hoursLogged }) => {
              const selected = shift.id === shiftId;
              const lock = lockOf(event);
              return (
                <Pressable key={shift.id} accessibilityRole="radio" accessibilityState={{ selected }} onPress={() => pickShift(shift.id)}>
                  <Card accent={selected ? color.gold : color.line}>
                    <AppText variant="title" tone={lock ? 'muted' : 'navy'}>
                      {lock ? '🔒 ' : ''}
                      {shift.ShiftName}
                    </AppText>
                    <AppText variant="small" tone="muted">
                      {event.EventName} · {formatShiftWhen(shift)}
                    </AppText>
                    {lock ? (
                      <AppText variant="small" tone="muted">
                        {lock}
                      </AppText>
                    ) : hoursLogged === null ? (
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
      {data && data.shifts.length > 0 ? (
        <>
          <Section title="How long?">
            <QuarterStepper value={hours} onChange={setHours} />
          </Section>
          <Field label="NOTES (OPTIONAL)">
            <AppInput value={notes} onChangeText={setNotes} multiline style={{ minHeight: 72, textAlignVertical: 'top', paddingTop: space.md }} maxLength={255} />
          </Field>
          <Button title={locked ? '🔒 Reporting locked' : 'Save time'} busy={busy} disabled={!canSave} onPress={() => void save()} />
        </>
      ) : null}
    </>
  );
}

export default function LogScreen() {
  const shiftsOn = useFeatureFlags().flag_complex_shifts;
  const [chosen, setMode] = useState<Mode>('activity');
  const mode = shiftsOn ? chosen : 'activity';
  const toast = useToast();

  return (
    <View style={{ flex: 1 }}>
      <Screen>
        <AppText variant="heading" accessibilityRole="header">
          Report Hours
        </AppText>
        {shiftsOn ? <Segmented value={mode} onChange={setMode} /> : null}
        {mode === 'activity' ? <ActivityGrid onToast={toast.show} /> : <ShiftReport onToast={toast.show} />}
        <View style={{ height: 72 }} />
      </Screen>
      {toast.view}
    </View>
  );
}
