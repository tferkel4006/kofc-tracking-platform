// First launch and sign-in. Renders the OnboardingController state machine and nothing else:
//   enterEmail -> createPassword | signIn | contactAdmin -> signedIn (the root layout then swaps to the tabs)
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { BrandMark } from '@/components/BrandHeader';
import { AppInput, AppText, Button, Card, Field, Notice } from '@/components/ui';
import { useApp } from '@/lib/app-context';
import { describeError } from '@/lib/use-async';
import { color, space } from '@/lib/theme';

export default function SignInScreen() {
  const { onboarding, submitEmail, submitPassword, restart } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setFailure(null);
    try {
      await action();
    } catch (err) {
      setFailure(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  const state = onboarding;
  const error = 'error' in state ? state.error : undefined;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: color.navy }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: space.xl, gap: space.xl }} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: 'center', gap: space.md }}>
          <BrandMark size={84} />
          <AppText variant="heading" tone="white" accessibilityRole="header">
            Knights of Columbus
          </AppText>
          <AppText tone="white">Event and activity tracking</AppText>
        </View>

        <Card accent={color.gold} style={{ gap: space.lg }}>
          {failure ? <Notice tone="error" message={failure} onDismiss={() => setFailure(null)} /> : null}
          {error ? <Notice tone="error" message={error} /> : null}

          {state.screen === 'enterEmail' ? (
            <>
              <AppText variant="title">Welcome. What is your email address?</AppText>
              <AppText variant="small" tone="muted">
                Use the address your council has on file for you.
              </AppText>
              <Field label="EMAIL">
                <AppInput value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" textContentType="emailAddress" placeholder="you@example.org" />
              </Field>
              <Button title="Continue" busy={busy} disabled={!email.trim()} onPress={() => void run(() => submitEmail(email))} />
            </>
          ) : null}

          {state.screen === 'createPassword' ? (
            <>
              <AppText variant="title">Welcome, {state.firstName}. Choose a password.</AppText>
              <AppText variant="small" tone="muted">
                At least 8 characters. You will stay signed in on this phone.
              </AppText>
              <Field label="PASSWORD">
                <AppInput value={password} onChangeText={setPassword} secureTextEntry textContentType="newPassword" autoCapitalize="none" />
              </Field>
              <Field label="CONFIRM PASSWORD">
                <AppInput value={confirmation} onChangeText={setConfirmation} secureTextEntry textContentType="newPassword" autoCapitalize="none" />
              </Field>
              <Button title="Create password" busy={busy} disabled={!password} onPress={() => void run(() => submitPassword(password, confirmation))} />
            </>
          ) : null}

          {state.screen === 'signIn' ? (
            <>
              <AppText variant="title">Welcome back</AppText>
              <AppText variant="small" tone="muted">
                {state.email}
              </AppText>
              <Field label="PASSWORD">
                <AppInput value={password} onChangeText={setPassword} secureTextEntry textContentType="password" autoCapitalize="none" />
              </Field>
              <Button title="Sign in" busy={busy} disabled={!password} onPress={() => void run(() => submitPassword(password))} />
            </>
          ) : null}

          {state.screen === 'contactAdmin' ? (
            <>
              <Notice tone="error" message={state.message} />
              {state.contact ? (
                <View style={{ gap: space.xs }}>
                  <AppText variant="title">Contact your council admin</AppText>
                  <AppText>
                    Council {state.contact.councilNumber} – {state.contact.councilName}
                  </AppText>
                  {state.contact.admin ? (
                    <>
                      <AppText>{state.contact.admin.name}</AppText>
                      <AppText>{state.contact.admin.email}</AppText>
                      <AppText>{state.contact.admin.phone}</AppText>
                    </>
                  ) : (
                    <AppText tone="muted">No active admin is on file for this council.</AppText>
                  )}
                  {state.contact.councilPhone ? <AppText>Council office: {state.contact.councilPhone}</AppText> : null}
                </View>
              ) : null}
              <Button title="Try a different email" variant="secondary" onPress={restart} />
            </>
          ) : null}

          {state.screen === 'loading' || state.screen === 'signedIn' ? <AppText tone="muted">One moment…</AppText> : null}
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
