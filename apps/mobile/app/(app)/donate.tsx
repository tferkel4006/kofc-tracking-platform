// Donations, optimised for taking them at an event table:
//  1. "Start accepting donations" pins an event with a default amount, type and description. Every donation
//     after that is linked to the event until "Stop accepting" (DonationSessionController, kept per council
//     for the life of the app, so switching tabs never loses the pinned event). Without a session a
//     donation is standalone.
//  2. The method is one tap on a large tile. Venmo/Zelle/Zeffy/Parishsoft show the council's QR code for
//     the donor to scan; physical items ask for a description and estimated value, and may carry a
//     verification photo taken with the phone camera from the "Take Verification Photo" tile (stored in
//     DonationPhotoURL).
//  3. The form is pre-filled from the session defaults; the member corrects the amount if the donor gave
//     something different, then records it or cancels.
// While a session is running, the event's donations from every phone are listed, newest first.
// Sprint 5Z-Mobile-Intake: tapping Venmo, ParishSoft, Zeffy or Zelle opens a full-screen pop-up with only that channel's
// code, bundled with the app (components/CollectionQrModal.tsx); the council's uploaded code is shown only for a QR
// method the app carries no image for.
// Sprint 5Z-10 high-speed gate intake: the pinned-event card carries the '🎬 Start Active Intake Session' switch
// (events.setIntakeSessionStatus). While the event's intake is Active, a full-screen overlay offers two one-tap targets,
// cash and card, that log a donation at a preset amount with nothing typed (components/GateIntake.tsx).
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import {
  formatDate,
  toIsoDate,
  type CouncilDonationOption,
  type DonationDefaults,
  type DonationType,
  type Event,
} from '@kofc/shared';
import { CollectionQrModal, collectionQrFor } from '@/components/CollectionQrModal';
import { DonationMethodGrid } from '@/components/DonationMethodGrid';
import { DonationQr } from '@/components/DonationQr';
import { GateIntakeOverlay, IntakeSessionSwitch } from '@/components/GateIntake';
import { Dropdown } from '@/components/Dropdown';
import { ReceiptScanTile, VERIFICATION_PHOTO_TITLE } from '@/components/ReceiptScanTile';
import { AppInput, AppText, Button, Card, EmptyState, Field, Loading, Notice, Pill, Screen, Section } from '@/components/ui';
import { useUser } from '@/lib/app-context';
import { color, space } from '@/lib/theme';
import { describeError, useLoad } from '@/lib/use-async';
import { useDonationSession } from '@/lib/use-donation-session';
import { db } from '@/services/db';

const money = (n: number) => `$${n.toFixed(2)}`;

/** What the donation form hands back; `photoPath` is the verification photo of a physical item, if one was taken. */
interface DonationValues {
  amount: number;
  typeId: number;
  donor: string;
  description: string;
  photoPath: string | null;
}

/** Amount text to dollars; blank is null. Anything else non-numeric is an error naming the field. */
function parseAmount(text: string, label: string): { value: number | null } | { error: string } {
  const trimmed = text.trim().replace(/[$,\s]/g, '');
  if (trimmed === '') return { value: null };
  const value = Number(trimmed);
  return Number.isFinite(value) ? { value } : { error: `${label} must be a dollar amount such as 20 or 12.50; received "${text}".` };
}

const multiline = { minHeight: 72, textAlignVertical: 'top' as const, paddingTop: space.md };

// ---- start a session -----------------------------------------------------------

function StartSessionForm({
  events,
  types,
  onStart,
  onCancel,
}: {
  events: Event[];
  types: DonationType[];
  onStart: (eventId: number, defaults: DonationDefaults) => Promise<void>;
  onCancel: () => void;
}) {
  const [eventId, setEventId] = useState<number | null>(events[0]?.id ?? null);
  const [amount, setAmount] = useState('');
  const [typeId, setTypeId] = useState<number | null>(types[0]?.id ?? null);
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (events.length === 0) {
    return <EmptyState message="No event of your council has started yet. Event donations are taken during or after an event; record a standalone donation instead." />;
  }

  const start = async () => {
    const parsed = parseAmount(amount, 'Default amount');
    if ('error' in parsed) return setError(parsed.error);
    if (eventId === null) return;
    setBusy(true);
    setError(null);
    try {
      await onStart(eventId, {
        amount: parsed.value ?? undefined,
        donationTypeId: typeId ?? undefined,
        description: description.trim() || undefined,
      });
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card accent={color.gold}>
      <AppText variant="title">Start accepting donations</AppText>
      {error ? <Notice tone="error" message={error} /> : null}
      <Field label="EVENT">
        <Dropdown
          title="Event"
          value={eventId}
          options={events.map((e) => ({ value: e.id, label: `${e.EventName} · ${formatDate(e.StartDate)}` }))}
          onChange={setEventId}
        />
      </Field>
      <Field label="DEFAULT AMOUNT (OPTIONAL)">
        <AppInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="e.g. 20" />
      </Field>
      {types.length > 0 ? (
        <Field label="DEFAULT DONATION TYPE">
          <Dropdown title="Donation type" value={typeId} options={types.map((t) => ({ value: t.id, label: t.DonationType }))} onChange={setTypeId} />
        </Field>
      ) : null}
      <Field label="DEFAULT DESCRIPTION (OPTIONAL)">
        <AppInput value={description} onChangeText={setDescription} maxLength={255} />
      </Field>
      <View style={{ flexDirection: 'row', gap: space.md }}>
        <Button title="Cancel" variant="secondary" style={{ flex: 1 }} onPress={onCancel} />
        <Button title="Start" style={{ flex: 2 }} busy={busy} disabled={eventId === null} onPress={() => void start()} />
      </View>
    </Card>
  );
}

// ---- record one donation ---------------------------------------------------------

function DonationForm({
  option,
  types,
  defaults,
  onRecord,
  onCancel,
}: {
  option: CouncilDonationOption;
  types: DonationType[];
  defaults: DonationDefaults;
  onRecord: (values: DonationValues) => Promise<void>;
  onCancel: () => void;
}) {
  const isItem = option.kind === 'item';
  const [amount, setAmount] = useState(defaults.amount != null ? String(defaults.amount) : '');
  const [typeId, setTypeId] = useState<number | null>(defaults.donationTypeId ?? types[0]?.id ?? null);
  const [donor, setDonor] = useState('');
  const [description, setDescription] = useState(isItem ? '' : (defaults.description ?? ''));
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Venmo, ParishSoft, Zeffy and Zelle open their own bundled code full screen as soon as the tile is tapped.
  const bundledQr = option.kind === 'qr' ? collectionQrFor(option.method.DonationMethod) : null;
  const [qrOpen, setQrOpen] = useState(bundledQr !== null);

  const amountLabel = isItem ? 'Estimated value' : 'Amount';
  const record = async () => {
    const parsed = parseAmount(amount, amountLabel);
    if ('error' in parsed) return setError(parsed.error);
    if (parsed.value === null) return setError(`Enter the ${amountLabel.toLowerCase()}.`);
    if (isItem && description.trim() === '') return setError('Describe the donated items, e.g. "3 boxes of canned food".');
    if (typeId === null) return setError('Choose a donation type.');
    setBusy(true);
    setError(null);
    try {
      await onRecord({ amount: parsed.value, typeId, donor: donor.trim(), description: description.trim(), photoPath: isItem ? photoPath : null });
    } catch (err) {
      setError(describeError(err));
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: space.lg }}>
      {bundledQr ? (
        <>
          <CollectionQrModal methodName={option.method.DonationMethod} source={bundledQr} visible={qrOpen} onClose={() => setQrOpen(false)} />
          <Button title={`Show the ${option.method.DonationMethod} QR code`} variant="secondary" onPress={() => setQrOpen(true)} />
        </>
      ) : option.kind === 'qr' ? (
        <DonationQr url={option.qrCodeUrl} methodName={option.method.DonationMethod} />
      ) : null}
      <Card accent={color.navy}>
        <AppText variant="title">{isItem ? 'Physical item donation' : `${option.method.DonationMethod} donation`}</AppText>
        {error ? <Notice tone="error" message={error} /> : null}
        {isItem ? (
          <Field label="WHAT WAS DONATED">
            <AppInput value={description} onChangeText={setDescription} multiline style={multiline} maxLength={255} placeholder="e.g. 3 boxes of canned food" />
          </Field>
        ) : null}
        {isItem ? (
          <Field label="VERIFICATION PHOTO (OPTIONAL)">
            <ReceiptScanTile
              prefix="donation"
              title={VERIFICATION_PHOTO_TITLE}
              hint="Photograph the donated items or the donor's paper receipt."
              photoPath={photoPath}
              photoLabel="Photo of the donated items"
              onCaptured={setPhotoPath}
              onRemove={() => setPhotoPath(null)}
            />
          </Field>
        ) : null}
        <Field label={amountLabel.toUpperCase()}>
          <AppInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" style={{ fontSize: 22 }} />
        </Field>
        {types.length > 0 ? (
          <Field label="DONATION TYPE">
            <Dropdown title="Donation type" value={typeId} options={types.map((t) => ({ value: t.id, label: t.DonationType }))} onChange={setTypeId} />
          </Field>
        ) : (
          <Notice tone="error" message="Your council has no donation types yet, so donations cannot be recorded. A council admin adds them." />
        )}
        <Field label="DONOR NAME (OPTIONAL)">
          <AppInput value={donor} onChangeText={setDonor} maxLength={100} autoCapitalize="words" />
        </Field>
        {!isItem ? (
          <Field label="DESCRIPTION (OPTIONAL)">
            <AppInput value={description} onChangeText={setDescription} maxLength={255} />
          </Field>
        ) : null}
        <View style={{ flexDirection: 'row', gap: space.md }}>
          <Button title="Cancel" variant="secondary" style={{ flex: 1 }} onPress={onCancel} />
          <Button title="Record donation" style={{ flex: 2 }} busy={busy} disabled={types.length === 0} onPress={() => void record()} />
        </View>
      </Card>
    </View>
  );
}

// ---- the screen --------------------------------------------------------------------

export default function DonateScreen() {
  const user = useUser();
  const { controller, state: session } = useDonationSession(user.councilId, user.memberId);
  const [picked, setPicked] = useState<CouncilDonationOption | null>(null);
  const [starting, setStarting] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);
  const pinnedEventId = session.active ? session.eventId : null;

  const setup = useLoad(async () => {
    const today = toIsoDate(new Date());
    const [methods, types, events] = await Promise.all([
      db.donations.listMethods(user.councilId),
      db.donations.listTypes(user.councilId),
      db.events.listByCouncil(user.councilId),
    ]);
    // Event donations are taken during or after the event, so only events that have started are offered.
    return { methods, types, events: events.filter((e) => e.StartDate <= today) };
  }, [user.councilId]);

  const stream = useLoad(
    async () => (pinnedEventId === null ? [] : (await db.donations.list(user.councilId, { eventId: pinnedEventId })).slice(0, 10)),
    [user.councilId, pinnedEventId],
  );

  // The pinned event's gate intake (Sprint 5Z-10), shared by every phone pinned to it.
  const intake = useLoad(async () => (pinnedEventId === null ? null : db.events.get(pinnedEventId)), [pinnedEventId]);
  const intakeActive = intake.data?.IntakeSessionStatus === 'Active';
  const [intakeBusy, setIntakeBusy] = useState(false);
  const [overlayHidden, setOverlayHidden] = useState(false);
  const setIntake = async (on: boolean) => {
    if (pinnedEventId === null) return;
    setIntakeBusy(true);
    try {
      await db.events.setIntakeSessionStatus(user.memberId, pinnedEventId, on ? 'Active' : 'Inactive');
      setOverlayHidden(false);
      await intake.reload();
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setIntakeBusy(false);
    }
  };

  // Leaving a half-filled form when the session changes would record against the wrong event.
  useEffect(() => setPicked(null), [pinnedEventId]);

  const { data } = setup;
  const methodName = new Map((data?.methods ?? []).map((o) => [o.method.id, o.method.DonationMethod]));
  const typeName = new Map((data?.types ?? []).map((t) => [t.id, t.DonationType]));

  const record = async (option: CouncilDonationOption, v: DonationValues) => {
    const saved = await controller.record({
      DonationMethodID: option.method.id,
      DonationAmount: v.amount,
      DonationTypeID: v.typeId,
      Donor: v.donor || null,
      DonationDesciption: v.description || null,
      DonationPhotoURL: v.photoPath,
    });
    const where = session.active ? ` for ${session.eventName}` : ' as a standalone donation';
    setMessage({ tone: 'info', text: `Recorded ${money(saved.DonationAmount)} by ${option.method.DonationMethod}${where}. Thank the donor!` });
    setPicked(null);
    await stream.reload();
  };

  return (
    <Screen refreshing={setup.refreshing || stream.refreshing} onRefresh={() => void Promise.all([setup.reload(), stream.reload()])}>
      <AppText variant="heading" accessibilityRole="header">
        Donations
      </AppText>

      {message ? <Notice tone={message.tone} message={message.text} onDismiss={() => setMessage(null)} /> : null}
      {setup.error ? <Notice tone="error" message={setup.error} /> : null}
      {!data && setup.loading ? <Loading /> : null}

      {data ? (
        <>
          {session.active ? (
            <Card accent={color.gold}>
              <Pill label="ACCEPTING DONATIONS" tone="gold" />
              <AppText variant="title">{session.eventName}</AppText>
              <AppText>
                This phone: {session.recordedCount} donation{session.recordedCount === 1 ? '' : 's'}, {money(session.recordedTotal)}
              </AppText>
              {session.defaults.amount != null || session.defaults.description ? (
                <AppText variant="small" tone="muted">
                  Defaults: {[session.defaults.amount != null ? money(session.defaults.amount) : null, session.defaults.donationTypeId ? typeName.get(session.defaults.donationTypeId) : null, session.defaults.description]
                    .filter(Boolean)
                    .join(' · ')}
                </AppText>
              ) : null}
              <IntakeSessionSwitch active={intakeActive} busy={intakeBusy} onChange={(on) => void setIntake(on)} />
              {intakeActive && overlayHidden ? <Button title="Show the one-tap intake overlay" onPress={() => setOverlayHidden(false)} /> : null}
              <Button
                title="Stop accepting – the event is over"
                variant="secondary"
                onPress={() => {
                  controller.stop();
                  setMessage({ tone: 'info', text: `Stopped accepting donations for ${session.eventName}. New donations are standalone.` });
                }}
              />
            </Card>
          ) : starting ? (
            <StartSessionForm
              events={data.events}
              types={data.types}
              onCancel={() => setStarting(false)}
              onStart={async (eventId, defaults) => {
                await controller.start(eventId, defaults);
                setStarting(false);
                setMessage(null);
              }}
            />
          ) : (
            <Card accent={color.navy}>
              <AppText>Donations are recorded as standalone. Collecting at an event? Pin it once and every donation is linked to it.</AppText>
              <Button title="Start accepting for an event" onPress={() => setStarting(true)} />
            </Card>
          )}

          {picked ? (
            <DonationForm
              key={`${picked.method.id}-${pinnedEventId ?? 'none'}`}
              option={picked}
              types={data.types}
              defaults={session.active ? session.defaults : {}}
              onRecord={(v) => record(picked, v)}
              onCancel={() => setPicked(null)}
            />
          ) : (
            <Section title="How is the donor giving?">
              {data.methods.length === 0 ? (
                <EmptyState message="Your council has not enabled any donation methods yet. A council admin turns them on." />
              ) : (
                <DonationMethodGrid options={data.methods} onPick={(o) => { setPicked(o); setMessage(null); }} />
              )}
            </Section>
          )}

          {session.active ? (
            <GateIntakeOverlay
              visible={intakeActive && !overlayHidden}
              eventName={session.eventName}
              controller={controller}
              options={data.methods}
              types={data.types}
              defaults={session.defaults}
              recordedCount={session.recordedCount}
              recordedTotal={session.recordedTotal}
              onHide={() => setOverlayHidden(true)}
              onClose={() => setIntake(false)}
              onRecorded={() => void stream.reload()}
            />
          ) : null}

          {session.active ? (
            <Section title="Recorded for this event">
              {stream.error ? <Notice tone="error" message={stream.error} /> : null}
              {!stream.data && stream.loading ? <Loading label="Loading donations…" /> : null}
              {stream.data?.length === 0 ? <EmptyState message="No donations recorded for this event yet, from any phone." /> : null}
              {(stream.data ?? []).map((d) => (
                <Card key={d.id} accent={color.line}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.md }}>
                    <AppText variant="title">{money(d.DonationAmount)}</AppText>
                    <AppText variant="small" tone="muted">
                      {methodName.get(d.DonationMethodID) ?? 'Method'} · {formatDate(d.DonationDate)}
                    </AppText>
                  </View>
                  {d.Donor || d.DonationDesciption ? (
                    <AppText variant="small" tone="muted" numberOfLines={2}>
                      {[d.Donor, d.DonationDesciption].filter(Boolean).join(' · ')}
                    </AppText>
                  ) : null}
                </Card>
              ))}
            </Section>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}
