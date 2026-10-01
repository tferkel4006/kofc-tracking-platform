// High-speed gate intake (Sprint 5Z-10). While the donation screen is pinned to an event, the
// '🎬 Start Active Intake Session' switch opens or closes the event's intake (events.setIntakeSessionStatus, shared by
// every phone pinned to it). While it is Active the screen is covered by a high-contrast overlay: the amount (the
// session's default, or one tap on a preset chip) and two massive one-tap targets - '💵 Log Cash Transaction' and
// '💳 Log Stripe CC Swipe' - that record a donation with nothing typed (gateIntakeEntry: the council's cash or card
// method, the session's donation type, a gate description, the pinned event, the member and today). The overlay is navy
// with white text (14.9:1); the cash target is white with navy text and the card target gold with navy text (6.4:1).
// Note: '💳 Log Stripe CC Swipe' records a credit-card donation; no card is charged from the app.
import { useState } from 'react';
import { Modal, Pressable, ScrollView, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  GATE_INTAKE_AMOUNTS,
  GATE_INTAKE_TARGETS,
  gateIntakeEntry,
  gateIntakeOption,
  type CouncilDonationOption,
  type DonationSessionController,
  type DonationType,
  type GateIntakeTarget,
} from '@kofc/shared';
import { AppText, Button, Card, Notice } from '@/components/ui';
import { color, radius, space, touchTarget } from '@/lib/theme';
import { describeError } from '@/lib/use-async';

const money = (n: number) => `$${n.toFixed(2)}`;

/** The large '🎬 Start Active Intake Session' switch on the pinned-event card. */
export function IntakeSessionSwitch({
  active,
  busy,
  onChange,
}: {
  active: boolean;
  busy: boolean;
  onChange: (active: boolean) => void;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: active, disabled: busy }}
      accessibilityLabel="Start Active Intake Session"
      disabled={busy}
      onPress={() => onChange(!active)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: space.md,
        minHeight: touchTarget + space.lg,
        paddingHorizontal: space.lg,
        paddingVertical: space.md,
        borderRadius: radius.md,
        borderWidth: 2,
        borderColor: color.navy,
        backgroundColor: active ? color.navy : color.white,
      }}
    >
      <View style={{ flex: 1 }}>
        <AppText variant="title" tone={active ? 'white' : 'navy'} style={{ fontSize: 19 }}>
          🎬 Start Active Intake Session
        </AppText>
        <AppText variant="small" tone={active ? 'white' : 'muted'}>
          {active ? 'Active: one-tap cash and card logging is on for this event.' : 'Off: flip it at the gate for one-tap logging.'}
        </AppText>
      </View>
      <Switch
        value={active}
        disabled={busy}
        onValueChange={onChange}
        trackColor={{ false: color.line, true: color.gold }}
        thumbColor={active ? color.white : color.navy}
        accessibilityElementsHidden
        importantForAccessibility="no"
        style={{ transform: [{ scale: 1.3 }] }}
      />
    </Pressable>
  );
}

/** One massive one-tap target. */
function IntakeTarget({ label, detail, fill, disabled, onPress }: { label: string; detail: string; fill: string; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${detail}`}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: 180,
        alignItems: 'center',
        justifyContent: 'center',
        gap: space.sm,
        borderRadius: radius.md,
        borderWidth: 4,
        borderColor: color.gold,
        backgroundColor: fill,
        opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
        padding: space.lg,
      })}
    >
      <AppText tone="navy" style={{ fontSize: 30, lineHeight: 38, fontWeight: '700', textAlign: 'center' }}>
        {label}
      </AppText>
      <AppText tone="navy" style={{ fontSize: 18, lineHeight: 24, fontWeight: '700' }}>
        {detail}
      </AppText>
    </Pressable>
  );
}

/**
 * The full-screen intake overlay. Each tap records one donation through the pinned session (so it is linked to the
 * event and counted on this phone) and flashes the result; "Close intake" sets the event Inactive for every phone.
 */
export function GateIntakeOverlay({
  visible,
  eventName,
  controller,
  options,
  types,
  defaults,
  recordedCount,
  recordedTotal,
  onClose,
  onHide,
  onRecorded,
}: {
  visible: boolean;
  eventName: string;
  controller: DonationSessionController;
  options: readonly CouncilDonationOption[];
  types: readonly DonationType[];
  defaults: { amount?: number; donationTypeId?: number; description?: string };
  recordedCount: number;
  recordedTotal: number;
  onClose: () => Promise<void>;
  onHide: () => void;
  onRecorded: () => void;
}) {
  const insets = useSafeAreaInsets();
  const presets = defaults.amount != null && !GATE_INTAKE_AMOUNTS.includes(defaults.amount) ? [defaults.amount, ...GATE_INTAKE_AMOUNTS] : GATE_INTAKE_AMOUNTS;
  const [amount, setAmount] = useState<number>(defaults.amount ?? 10);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);

  const log = async (target: GateIntakeTarget) => {
    setBusy(true);
    setFlash(null);
    try {
      const saved = await controller.record(gateIntakeEntry(target, amount, options, types, defaults));
      setFlash({ tone: 'info', text: `✓ ${money(saved.DonationAmount)} ${target === 'cash' ? 'cash' : 'card swipe'} logged for ${eventName}.` });
      onRecorded();
    } catch (err) {
      setFlash({ tone: 'error', text: describeError(err) });
    } finally {
      setBusy(false);
    }
  };

  const cash = gateIntakeOption(options, 'cash');
  const card = gateIntakeOption(options, 'card');

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onHide}>
      <View style={{ flex: 1, backgroundColor: color.navy, paddingTop: insets.top + space.lg, paddingBottom: insets.bottom + space.lg, paddingHorizontal: space.lg }}>
        <ScrollView contentContainerStyle={{ gap: space.lg, flexGrow: 1 }}>
          <View style={{ gap: space.xs }}>
            <AppText variant="label" tone="white">
              🎬 ACTIVE INTAKE SESSION
            </AppText>
            <AppText variant="heading" tone="white">
              {eventName}
            </AppText>
            <AppText tone="white">
              This phone: {recordedCount} logged · {money(recordedTotal)}
            </AppText>
          </View>

          <View style={{ gap: space.sm }}>
            <AppText variant="label" tone="white">
              AMOUNT PER TAP
            </AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              {presets.map((value) => {
                const selected = value === amount;
                return (
                  <Pressable
                    key={value}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    onPress={() => setAmount(value)}
                    style={{
                      minWidth: 72,
                      minHeight: touchTarget,
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingHorizontal: space.md,
                      borderRadius: radius.pill,
                      borderWidth: 2,
                      borderColor: color.gold,
                      backgroundColor: selected ? color.gold : color.navy,
                    }}
                  >
                    <AppText variant="title" tone={selected ? 'navy' : 'white'} style={{ fontSize: 20 }}>
                      ${value}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {flash ? (
            <View style={{ backgroundColor: color.white, borderRadius: radius.md }}>
              <Notice tone={flash.tone} message={flash.text} onDismiss={() => setFlash(null)} />
            </View>
          ) : null}

          <View style={{ flex: 1, gap: space.lg, minHeight: 400 }}>
            <IntakeTarget
              label={GATE_INTAKE_TARGETS.cash.label}
              detail={cash ? money(amount) : 'Cash is not enabled'}
              fill={color.white}
              disabled={busy || !cash || types.length === 0}
              onPress={() => void log('cash')}
            />
            <IntakeTarget
              label={GATE_INTAKE_TARGETS.card.label}
              detail={card ? money(amount) : 'Credit Card is not enabled'}
              fill={color.gold}
              disabled={busy || !card || types.length === 0}
              onPress={() => void log('card')}
            />
          </View>

          {types.length === 0 ? (
            <Card accent={color.red}>
              <AppText tone="red">Your council has no donation types yet, so nothing can be logged. A council admin adds them.</AppText>
            </Card>
          ) : null}

          <View style={{ flexDirection: 'row', gap: space.md }}>
            <Button title="Hide overlay" variant="secondary" style={{ flex: 1 }} onPress={onHide} />
            <Button
              title="Close intake"
              variant="danger"
              style={{ flex: 1 }}
              disabled={busy}
              onPress={() => {
                setBusy(true);
                void onClose().finally(() => setBusy(false));
              }}
            />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
