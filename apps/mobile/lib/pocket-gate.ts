// Pocket-touch gate for the rapid-tap hour grid (Sprint 6A patch). A tap only logs time once the member proves it was
// them, so a phone brushing against a pocket cannot pile up hours:
//   - Face ID, Touch ID or a fingerprint enrolled: the first tap asks the device's biometric check (no passcode
//     fallback); a pass trusts this run of the app for TRUST_MS, so a burst of taps scans once. A failed or cancelled
//     scan drops the tap.
//   - No biometrics on the phone, none enrolled, or the check is switched off: taps wait in a queue until the member
//     drags the Slide to Log Hours bar (log.tsx).
import * as LocalAuthentication from 'expo-local-authentication';

export type PocketGateMode = 'biometric' | 'slider';

/** How long one passed scan covers further taps. */
const TRUST_MS = 60_000;
let trustedUntil = 0;
let mode: Promise<PocketGateMode> | null = null;

/** Errors meaning the phone cannot scan at all, so the slider takes over rather than the tap being refused. */
const UNAVAILABLE = new Set<LocalAuthentication.LocalAuthenticationError>(['not_enrolled', 'not_available', 'passcode_not_set']);

/** Whether this phone can run the biometric check, worked out once per run of the app. */
export function pocketGateMode(): Promise<PocketGateMode> {
  mode ??= Promise.all([LocalAuthentication.hasHardwareAsync(), LocalAuthentication.isEnrolledAsync()]).then(
    ([hardware, enrolled]) => (hardware && enrolled ? 'biometric' : 'slider'),
    () => 'slider' as const,
  );
  return mode;
}

/**
 * The biometric check for one tap: 'passed' (log it), 'refused' (a failed or cancelled scan: drop it) or 'unavailable'
 * (biometrics went away: the caller switches to the slider and queues the tap).
 */
export async function confirmTap(): Promise<'passed' | 'refused' | 'unavailable'> {
  if (Date.now() < trustedUntil) return 'passed';
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Confirm it is you to log hours',
    cancelLabel: 'Cancel',
    disableDeviceFallback: true,
    fallbackLabel: '',
  }).catch(() => ({ success: false as const, error: 'unknown' as const }));
  if (result.success) {
    trustedUntil = Date.now() + TRUST_MS;
    return 'passed';
  }
  if (UNAVAILABLE.has(result.error)) {
    mode = Promise.resolve('slider');
    return 'unavailable';
  }
  return 'refused';
}
