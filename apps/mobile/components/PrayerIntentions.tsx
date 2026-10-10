// The Council Prayer Intentions List on the phone (Sprint 6L Extension 3), a section of Home under the feast day banner:
// the council's open intentions, newest first, each with its '[ 🙏 Praying Hands ]' button and solidarity count, and a
// box to post a new one. A tap counts once per member per intention per day (prayers.pray); after it the button reads
// as prayed until tomorrow. The author, officers, Admins and Super Admins may close an intention.
// The same list is on the web portal's Faith Center page. Like the rest of the Faith Center it is a Knights of Columbus
// extension: for a white-label tenant the section draws nothing.
import { useState } from 'react';
import { View } from 'react-native';
import {
  describeError,
  describePrayerCount,
  isFraternalTenant,
  platformSettings,
  PRAYING_HANDS_LABEL,
  type PrayerIntentionDetail,
} from '@kofc/shared';
import { AppInput, AppText, Button, Card, EmptyState, Notice, Section } from '@/components/ui';
import { useTenantType, useUser } from '@/lib/app-context';
import { useLoad } from '@/lib/use-async';
import { useTheme } from '@/lib/layout-mode';
import { db } from '@/services/db';

function IntentionCard({ item, onChanged }: { item: PrayerIntentionDetail; onChanged: () => Promise<void> }) {
  const { space } = useTheme();
  const user = useUser();
  const [count, setCount] = useState(item.prayerCount);
  const [prayed, setPrayed] = useState(item.prayedByMeToday);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pray = async () => {
    setBusy(true);
    setError(null);
    try {
      const tally = await db.prayers.pray(user.memberId, item.intention.id);
      setCount(tally.prayerCount);
      setPrayed(tally.prayedByMeToday);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  const close = async () => {
    setBusy(true);
    setError(null);
    try {
      await db.prayers.closeIntention(user.memberId, item.intention.id);
      await onChanged();
    } catch (err) {
      setError(describeError(err));
      setBusy(false);
    }
  };

  return (
    <Card>
      <View style={{ gap: space.sm }}>
        <AppText variant="body">{item.intention.intention_text}</AppText>
        <AppText variant="small" tone="muted">
          Asked by {item.authorFirstName} {item.authorLastName}
        </AppText>
        <Button title={PRAYING_HANDS_LABEL} variant={prayed ? 'secondary' : 'primary'} onPress={() => void pray()} disabled={prayed} busy={busy} />
        <AppText variant="label" accessibilityLiveRegion="polite">
          {describePrayerCount(count)}
          {prayed ? ' · You prayed for this today.' : ''}
        </AppText>
        {item.mayClose ? <Button title="Close intention" variant="secondary" onPress={() => void close()} disabled={busy} /> : null}
        {error ? <Notice tone="error" message={error} onDismiss={() => setError(null)} /> : null}
      </View>
    </Card>
  );
}

/** Home's Council Prayer Intentions section. `version` changes on pull-to-refresh so the list reloads with the screen. */
export function PrayerIntentions({ version }: { version: number }) {
  const { space } = useTheme();
  const user = useUser();
  const fraternal = isFraternalTenant(useTenantType());
  const board = useLoad(
    async () => (fraternal ? db.prayers.getBoard(user.memberId, user.councilId) : null),
    [user.memberId, user.councilId, fraternal, version],
  );
  // Sprint 7C: the Super Admins' platform character limit (PlatformSettings.prayer_intention_max_length).
  const limits = useLoad(() => db.councils.getPlatformSettings(), []);
  const maxChars = platformSettings(limits.data).prayer_intention_max_length;
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!fraternal) return null;

  const post = async () => {
    setBusy(true);
    setError(null);
    try {
      await db.prayers.addIntention(user.memberId, user.councilId, text);
      setText('');
      await board.reload();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  const b = board.data;
  return (
    <Section title="Council Prayer Intentions">
      {board.error ? <Notice tone="error" message={board.error} /> : null}
      <View style={{ gap: space.sm }}>
        <AppInput
          value={text}
          onChangeText={setText}
          placeholder="Ask the council to pray for…"
          accessibilityLabel="New prayer intention"
          maxLength={maxChars}
          multiline
          editable={!busy}
        />
        <Button title="Post intention" onPress={() => void post()} disabled={!text.trim()} busy={busy} />
        {error ? <Notice tone="error" message={error} onDismiss={() => setError(null)} /> : null}
      </View>
      {b ? (
        b.intentions.length === 0 ? (
          <EmptyState message="No open intentions. Post the first one above." />
        ) : (
          b.intentions.map((item) => <IntentionCard key={`${item.intention.id}-${item.prayerCount}`} item={item} onChanged={board.reload} />)
        )
      ) : null}
    </Section>
  );
}
