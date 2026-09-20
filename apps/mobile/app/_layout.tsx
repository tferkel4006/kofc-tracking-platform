// Root of the route tree: providers, then a stack whose two halves are gated on the session.
// Signed out -> /sign-in (the onboarding flow). Signed in -> the (app) tabs. Router guards flip the
// visible half automatically when the session changes, so no screen ever redirects by hand.
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BrandMark } from '@/components/BrandHeader';
import { AppText } from '@/components/ui';
import { AppProvider, useApp } from '@/lib/app-context';
import { color, space } from '@/lib/theme';

function Gate() {
  const { user, ready, startupError } = useApp();
  return (
    <View style={{ flex: 1, backgroundColor: color.white }}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.white } }}>
        <Stack.Protected guard={!!user}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        <Stack.Protected guard={!user}>
          <Stack.Screen name="sign-in" />
        </Stack.Protected>
      </Stack>
      {!ready || startupError ? (
        <View
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            backgroundColor: color.navy,
            alignItems: 'center',
            justifyContent: 'center',
            gap: space.lg,
            padding: space.xl,
          }}
        >
          <BrandMark size={72} />
          <AppText variant="heading" tone="white">
            Knights of Columbus
          </AppText>
          <AppText tone="white" style={{ textAlign: 'center' }}>
            {startupError
              ? `The local database could not be opened, so the app cannot start. ${startupError}`
              : 'Opening your council…'}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <StatusBar style="light" />
        <Gate />
      </AppProvider>
    </SafeAreaProvider>
  );
}
