// Phone push alerts (Sprint 5T). After a member signs in, AppProvider calls registerForPushAlerts: on a physical
// phone it asks for notification permission (the system prompt appears once; later calls just read the answer),
// fetches the Expo push token and links it to the member's record (notifications.registerDeviceToken), so council
// leadership's alerts reach this phone. Signing out unlinks it (unregisterPushAlerts).
//
// Expo issues push tokens per EAS project. Until the app has one (`extra.eas.projectId` in app.json, written by
// `eas init`), registration logs a warning and stops; alerts still reach the member's in-app log.
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { color } from '@/lib/theme';
import { db } from '@/services/db';

/** Expo delivers to the 'default' Android channel unless a message names another, so the council alerts use it. */
const ANDROID_CHANNEL_ID = 'default';

export type PushRegistrationOutcome = 'registered' | 'denied' | 'unsupported' | 'unconfigured';

let displayConfigured = false;

/** Shows alerts that arrive while the app is open; without a handler Expo drops them silently. Safe to call repeatedly. */
export function configureAlertDisplay(): void {
  if (displayConfigured) return;
  displayConfigured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

const easProjectId = (): string | undefined =>
  (Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)?.projectId ?? Constants.easConfig?.projectId;

/** Asks for permission if needed, then links this phone's Expo push token to `memberId`. */
export async function registerForPushAlerts(memberId: number): Promise<PushRegistrationOutcome> {
  // Simulators and emulators cannot receive remote pushes, so they never get a token.
  if (Platform.OS === 'web' || !Device.isDevice) return 'unsupported';
  if (Platform.OS === 'android') {
    // Android 13+ shows the permission prompt only once a channel exists.
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: 'Council alerts',
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: color.navy,
    });
  }
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') ({ status } = await Notifications.requestPermissionsAsync());
  if (status !== 'granted') return 'denied';

  const projectId = easProjectId();
  if (!projectId) {
    console.warn('[push] No EAS project id (app.json extra.eas.projectId), so this phone cannot get an Expo push token yet.');
    return 'unconfigured';
  }
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  await db.notifications.registerDeviceToken(memberId, token);
  return 'registered';
}

/** Unlinks this phone from `memberId` on sign-out, so the next person holding it does not see their alerts. */
export async function unregisterPushAlerts(memberId: number): Promise<void> {
  await db.notifications.registerDeviceToken(memberId, null);
}
