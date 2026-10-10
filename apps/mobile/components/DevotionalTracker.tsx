// The phone's devotional tracker and canonization shield (Sprint 7A), a section of Home under the prayer intentions.
//
// The member types how many rosaries they said, hours of adoration they kept and confessions they made, and
// 'Log devotions' adds them to their running tally (devotionals.record). The tally is the member's own: nobody else
// reads it.
//
// The shield shows the member's level - Servant of God, Venerable, Blessed or Saint - measured only on their logged
// service (volunteer hours and distinct events) against the council's thresholds, with a gold bar toward Saint and what
// the next level still needs. Like the rest of the Faith Center it is a Knights of Columbus extension: for a white-label
// tenant the section draws nothing.
import { useState } from 'react';
import { View } from 'react-native';
import {
  CANONIZATION_LEVELS,
  DEVOTIONAL_ENTRY_MAX,
  describeError,
  isFraternalTenant,
  type CanonizationRank,
  type DevotionalEntry,
} from '@kofc/shared';
import { AppInput, AppText, Button, Card, Field, Notice, Section } from '@/components/ui';
import { useTenantType, useUser } from '@/lib/app-context';
import { useLoad } from '@/lib/use-async';
import { useTheme } from '@/lib/layout-mode';
import { db } from '@/services/db';

const SHIELD_ICONS = ['🕯️', '📿', '✨', '👑'] as const;

const hoursText = (h: number) => `${h.toLocaleString('en-US', { maximumFractionDigits: 2 })} hour${h === 1 ? '' : 's'}`;
const eventsText = (n: number) => `${n} event${n === 1 ? '' : 's'}`;

/** The shield: a navy crest with a gold rim, the level in large type, and a gold bar toward Saint. */
function CanonizationShield({ rank }: { rank: CanonizationRank }) {
  const { color, space, radius, border } = useTheme();
  const percent = Math.round(rank.progress * 100);
  return (
    <View
      accessible
      accessibilityLabel={`Canonization shield: ${rank.level}. ${percent} percent of the way to Saint.`}
      style={{
        alignItems: 'center',
        gap: space.sm,
        backgroundColor: color.navy,
        borderColor: color.gold,
        borderWidth: border(4),
        borderTopLeftRadius: radius.md,
        borderTopRightRadius: radius.md,
        borderBottomLeftRadius: 80,
        borderBottomRightRadius: 80,
        paddingTop: space.md,
        paddingBottom: space.xl,
        paddingHorizontal: space.md,
      }}
    >
      <AppText variant="heading" tone="white" style={{ fontSize: 40, lineHeight: 48 }}>
        {SHIELD_ICONS[rank.levelIndex]}
      </AppText>
      <AppText variant="heading" tone="white" style={{ color: color.gold, textAlign: 'center' }}>
        {rank.level}
      </AppText>
      <AppText variant="small" tone="white" style={{ textAlign: 'center' }}>
        {hoursText(rank.metrics.hours)} · {eventsText(rank.metrics.events)} served
      </AppText>
      <View style={{ alignSelf: 'stretch', height: 12, borderRadius: 6, backgroundColor: color.white, overflow: 'hidden' }}>
        <View style={{ width: `${percent}%`, height: '100%', backgroundColor: color.gold }} />
      </View>
      <AppText variant="small" tone="white" style={{ textAlign: 'center' }}>
        {rank.next
          ? `Next: ${rank.next.level} - ${rank.next.hoursNeeded > 0 ? `${hoursText(rank.next.hoursNeeded)}` : 'hours met'}, ${
              rank.next.eventsNeeded > 0 ? `${eventsText(rank.next.eventsNeeded)}` : 'events met'
            } to go`
          : 'You have reached the highest level. Thank you for your service!'}
      </AppText>
      <AppText variant="small" tone="white" style={{ textAlign: 'center' }}>
        Saint: {hoursText(rank.thresholds.hours)} and {eventsText(rank.thresholds.events)} · {CANONIZATION_LEVELS.join(' → ')}
      </AppText>
    </View>
  );
}

const FIELDS: { key: keyof DevotionalEntry; label: string }[] = [
  { key: 'rosaries', label: 'Rosaries said' },
  { key: 'adorations', label: 'Hours of adoration' },
  { key: 'confessions', label: 'Confessions' },
];

/** Home's devotional section. `version` changes on pull-to-refresh so the tally reloads with the screen. */
export function DevotionalTracker({ version }: { version: number }) {
  const { space } = useTheme();
  const user = useUser();
  const fraternal = isFraternalTenant(useTenantType());
  const progress = useLoad(async () => (fraternal ? db.devotionals.getProgress(user.memberId) : null), [user.memberId, fraternal, version]);
  const [draft, setDraft] = useState<Record<keyof DevotionalEntry, string>>({ rosaries: '', adorations: '', confessions: '' });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);
  if (!fraternal) return null;

  const log = async () => {
    setBusy(true);
    setMessage(null);
    try {
      // Blank boxes add nothing; anything else goes to the driver as typed, which refuses what is not a whole number.
      const entry: DevotionalEntry = {};
      for (const { key } of FIELDS) if (draft[key].trim() !== '') entry[key] = Number(draft[key].trim());
      await db.devotionals.record(user.memberId, entry);
      setDraft({ rosaries: '', adorations: '', confessions: '' });
      setMessage({ tone: 'info', text: 'Logged. God bless you!' });
      await progress.reload();
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setBusy(false);
    }
  };

  const p = progress.data;
  return (
    <Section title="My devotions">
      {progress.error ? <Notice tone="error" message={progress.error} /> : null}
      {p ? <CanonizationShield rank={p.rank} /> : null}
      <Card>
        <View style={{ gap: space.sm }}>
          {p ? (
            <AppText variant="label" accessibilityLiveRegion="polite">
              So far: {p.tally.rosaries_said} rosaries · {p.tally.adorations_count} hours of adoration · {p.tally.confessions_count} confessions
            </AppText>
          ) : null}
          {FIELDS.map((f) => (
            <Field key={f.key} label={f.label}>
              <AppInput
                value={draft[f.key]}
                onChangeText={(text) => setDraft((d) => ({ ...d, [f.key]: text }))}
                keyboardType="number-pad"
                placeholder="0"
                accessibilityLabel={f.label}
                maxLength={String(DEVOTIONAL_ENTRY_MAX).length}
                editable={!busy}
              />
            </Field>
          ))}
          <Button title="Log devotions" onPress={() => void log()} disabled={FIELDS.every((f) => draft[f.key].trim() === '')} busy={busy} />
          {message ? <Notice tone={message.tone} message={message.text} onDismiss={() => setMessage(null)} /> : null}
          <AppText variant="small" tone="muted">
            Only you see your devotions. Your shield level comes from the service hours and events you log, measured against your council&apos;s
            thresholds.
          </AppText>
        </View>
      </Card>
    </Section>
  );
}
