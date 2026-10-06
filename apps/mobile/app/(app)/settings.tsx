// Settings (Sprint 6C), opened from the member's name in the header: the member's own profile settings on the phone.
// The Large Text Layout Mode switch saves Member.flag_large_text_mode on their record (the same flag as the web
// portal's My Profile switch) and redraws every screen at once: larger bold white type on pitch black, thick gold
// borders, and tap areas at least 140 points tall. Sign out lives here too, since the large header has no room for it.
import { useState } from 'react';
import { LARGE_TEXT_TOGGLE_LABEL } from '@kofc/shared';
import { NavStrip } from '@/components/NavStrip';
import { AppText, Button, Card, Notice, Screen, Section, ToggleSwitch } from '@/components/ui';
import { useApp, useUser } from '@/lib/app-context';
import { describeError } from '@/lib/use-async';

export default function SettingsScreen() {
  const user = useUser();
  const { largeText, setLargeText, signOut } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = async (on: boolean) => {
    setBusy(true);
    setError(null);
    try {
      await setLargeText(on);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <NavStrip closeLabel="Close settings" />
      <AppText variant="heading" accessibilityRole="header">
        Settings
      </AppText>
      {error ? <Notice tone="error" message={error} onDismiss={() => setError(null)} /> : null}
      <Section title="Display">
        <ToggleSwitch
          label={LARGE_TEXT_TOGGLE_LABEL}
          hint="Larger bold text, bigger buttons, and white on black with gold borders on every screen."
          value={largeText}
          disabled={busy}
          onChange={(on) => void toggle(on)}
        />
        <AppText tone="muted">
          {largeText
            ? 'Large Text Layout Mode is on. Switch it off here to return to the standard layout.'
            : 'For easier reading: every screen gets larger bold text, taller buttons, and a black background with gold borders.'}
        </AppText>
      </Section>
      <Section title="Account">
        <Card>
          <AppText variant="title">
            {user.firstName} {user.lastName}
          </AppText>
          <AppText tone="muted">{user.username}</AppText>
        </Card>
        <Button title="Sign out" variant="secondary" onPress={() => void signOut()} />
      </Section>
    </Screen>
  );
}
