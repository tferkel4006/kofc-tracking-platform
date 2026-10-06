// First launch and sign-in. Renders the OnboardingController state machine and nothing else:
//   enterEmail -> createPassword | signIn | contactAdmin -> signedIn (the root layout then swaps to the tabs)
// Sprint 6B Security: creating a password needs the welcome email's setup code; every password box has an eye toggle
// (PasswordInput); "Forgot Password?" runs forgotPassword -> resetCode -> newPassword -> signedIn.
// Sprint 6D: once this phone holds a biometric key (minted with the setup code), the email and password prompts lead
// with "Sign In with FaceID / Biometrics", which skips the password.
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { BrandMark } from '@/components/BrandHeader';
import { AppInput, AppText, Button, Card, Field, Notice, PasswordInput } from '@/components/ui';
import { useApp } from '@/lib/app-context';
import { describeError } from '@/lib/use-async';
import { useTheme } from '@/lib/layout-mode';

/** The 'Forgot Password?' text button under the email and password prompts. */
function ForgotLink({ onPress }: { onPress: () => void }) {
  const { space } = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={8} style={{ alignSelf: 'center', paddingVertical: space.sm }}>
      <AppText variant="label" style={{ textDecorationLine: 'underline' }}>
        Forgot Password?
      </AppText>
    </Pressable>
  );
}

/** The biometric sign-in button and an "or" rule above the password route; hidden when the phone holds no key. */
function BiometricSignIn({ email, busy, onPress }: { email: string | null; busy: boolean; onPress: () => void }) {
  const { space } = useTheme();
  if (!email) return null;
  return (
    <View style={{ gap: space.sm }}>
      <Button title="🔑 Sign In with FaceID / Biometrics" busy={busy} onPress={onPress} />
      <AppText variant="small" tone="muted" style={{ textAlign: 'center' }}>
        {email} · or use your password below
      </AppText>
    </View>
  );
}

export default function SignInScreen() {
  const { color, space } = useTheme();
  const { onboarding, biometricEmail, submitBiometric, submitEmail, submitPassword, startPasswordReset, submitResetEmail, submitResetCode, submitNewPassword, restart } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [setupCode, setSetupCode] = useState('');
  const [resetEmail, setResetEmail] = useState<string | null>(null);
  const [resetCode, setResetCode] = useState('');
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
              <BiometricSignIn email={biometricEmail} busy={busy} onPress={() => void run(submitBiometric)} />
              <AppText variant="title">Welcome. What is your email address?</AppText>
              <AppText variant="small" tone="muted">
                Use the address your council has on file for you.
              </AppText>
              <Field label="EMAIL">
                <AppInput value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" textContentType="emailAddress" placeholder="you@example.org" />
              </Field>
              <Button title="Continue" busy={busy} disabled={!email.trim()} onPress={() => void run(() => submitEmail(email))} />
              <ForgotLink onPress={startPasswordReset} />
            </>
          ) : null}

          {state.screen === 'createPassword' ? (
            <>
              <AppText variant="title">Welcome, {state.firstName}. Choose a password.</AppText>
              <AppText variant="small" tone="muted">
                Enter the setup code from your welcome email, then a password of at least 8 characters. You will stay signed in on this phone.
              </AppText>
              <Field label="SETUP CODE FROM YOUR WELCOME EMAIL">
                <AppInput
                  value={setupCode}
                  onChangeText={setSetupCode}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  textContentType="oneTimeCode"
                  placeholder="XXXXX-XXXXX-XXXXX-XXXXX"
                />
              </Field>
              <Field label="PASSWORD">
                <PasswordInput value={password} onChangeText={setPassword} textContentType="newPassword" />
              </Field>
              <Field label="CONFIRM PASSWORD">
                <PasswordInput value={confirmation} onChangeText={setConfirmation} textContentType="newPassword" />
              </Field>
              <Button
                title="Create password"
                busy={busy}
                disabled={!password}
                onPress={() => void run(() => submitPassword(password, confirmation, setupCode))}
              />
              <AppText variant="small" tone="muted">
                No code, or did it expire? Ask your council admin to send a new welcome email.
              </AppText>
            </>
          ) : null}

          {state.screen === 'signIn' ? (
            <>
              <AppText variant="title">Welcome back</AppText>
              <AppText variant="small" tone="muted">
                {state.email}
              </AppText>
              <BiometricSignIn
                email={biometricEmail?.toLowerCase() === state.email.toLowerCase() ? biometricEmail : null}
                busy={busy}
                onPress={() => void run(submitBiometric)}
              />
              <Field label="PASSWORD">
                <PasswordInput value={password} onChangeText={setPassword} textContentType="password" />
              </Field>
              <Button title="Sign in" busy={busy} disabled={!password} onPress={() => void run(() => submitPassword(password))} />
              <ForgotLink onPress={startPasswordReset} />
            </>
          ) : null}

          {state.screen === 'forgotPassword' ? (
            <>
              <AppText variant="title">Reset your password</AppText>
              <AppText variant="small" tone="muted">
                Enter the email you sign in with. If it belongs to a registered member, a 6-digit reset code is emailed to it.
              </AppText>
              <Field label="EMAIL">
                <AppInput
                  value={resetEmail ?? state.email}
                  onChangeText={setResetEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  placeholder="you@example.org"
                />
              </Field>
              <Button
                title="Email me a reset code"
                busy={busy}
                disabled={!(resetEmail ?? state.email).trim()}
                onPress={() => void run(() => submitResetEmail(resetEmail ?? state.email))}
              />
              <Button title="Back to sign in" variant="secondary" onPress={restart} />
            </>
          ) : null}

          {state.screen === 'resetCode' ? (
            <>
              <AppText variant="title">Enter your reset code</AppText>
              <AppText variant="small" tone="muted">
                If {state.email} belongs to a registered member, a 6-digit code is on its way. It expires in 15 minutes.
              </AppText>
              <Field label="6-DIGIT RESET CODE">
                <AppInput
                  value={resetCode}
                  onChangeText={(t) => setResetCode(t.replace(/[^0-9]/g, '').slice(0, 6))}
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  placeholder="123456"
                  maxLength={6}
                />
              </Field>
              <Button title="Continue" busy={busy} disabled={resetCode.length !== 6} onPress={() => void run(() => submitResetCode(resetCode))} />
              <Button title="Back to sign in" variant="secondary" onPress={restart} />
            </>
          ) : null}

          {state.screen === 'newPassword' ? (
            <>
              <AppText variant="title">Choose a new password</AppText>
              <AppText variant="small" tone="muted">
                At least 8 characters. You will be signed in on this phone.
              </AppText>
              <Field label="NEW PASSWORD">
                <PasswordInput value={password} onChangeText={setPassword} textContentType="newPassword" />
              </Field>
              <Field label="CONFIRM NEW PASSWORD">
                <PasswordInput value={confirmation} onChangeText={setConfirmation} textContentType="newPassword" />
              </Field>
              <Button title="Save new password" busy={busy} disabled={!password} onPress={() => void run(() => submitNewPassword(password, confirmation))} />
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
