// Test stand-in for expo-local-authentication: a phone with no biometric hardware. Tests that need a scan inject
// their own BiometricScanner instead.
export type LocalAuthenticationError = string;
export const hasHardwareAsync = async () => false;
export const isEnrolledAsync = async () => false;
export const authenticateAsync = async (_options?: unknown) => ({ success: false as const, error: 'not_available' });
