// Session and startup state for the whole app.
// Owns the OnboardingController (services/onboarding.ts), which does all the sign-in rules; screens
// only render its state. Also opens the local database, runs the reminder scheduler while signed in, and links the
// phone for push alerts after sign-in (lib/push-registration.ts), and reads the council's feature flags (Sprint 6A),
// which decide the tabs and buttons the app shows. Sprint 6C: also holds the member's Large Text Layout Mode
// (Member.flag_large_text_mode) and mounts LayoutModeProvider with it, so every screen draws in that layout.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ALL_FEATURES_ON,
  councilFeatureFlags,
  councilTenantType,
  countUnreadMessages,
  DEFAULT_TENANT_TYPE,
  prefersLargeText,
  registerCouncilGates,
  startNotificationScheduler,
  type FeatureFlags,
  type SessionUser,
  type TenantType,
} from '@kofc/shared';
import { LayoutModeProvider } from '@/lib/layout-mode';
import { configureAlertDisplay, registerForPushAlerts, unregisterPushAlerts } from '@/lib/push-registration';
import { db } from '@/services/db';
import { getConfiguredCouncilNumber, OnboardingController, type OnboardingState } from '@/services/onboarding';
import { biometricLogin } from '@/services/biometric-login';
import { sessionStore } from '@/services/session';

interface AppContextValue {
  /** The signed-in member, or null. */
  user: SessionUser | null;
  /** False until the database is open and any remembered session has been checked. */
  ready: boolean;
  /** Set when the local database could not be opened. */
  startupError: string | null;
  onboarding: OnboardingState;
  /** Unread messages addressed to the member, across all threads (the header envelope badge). */
  unread: number;
  refreshUnread(): Promise<void>;
  /** The member's council feature flags (Sprint 6A); every module reads as on until the council has loaded. */
  features: FeatureFlags;
  /**
   * Sprint 6Z-Dual-Gate-Model: the member's council tenant type, 'KOFC' until the council has loaded. A white-label
   * tenant hides the Catholic Faith Center.
   */
  tenantType: TenantType;
  /** Re-reads the flags and the tenant type, e.g. on a pull-to-refresh after a Super Admin changed them. */
  refreshFeatures(): Promise<void>;
  /** Sprint 6C: the member chose the large text layout (Member.flag_large_text_mode). False while signed out. */
  largeText: boolean;
  /** Saves the member's Large Text Layout Mode choice on their record and redraws the app in that layout. */
  setLargeText(on: boolean): Promise<void>;
  submitEmail(email: string): Promise<void>;
  submitPassword(password: string, confirmation?: string, setupCode?: string): Promise<void>;
  /** Sprint 6D: the email this phone's biometric key belongs to, or null when the biometric button is hidden. */
  biometricEmail: string | null;
  submitBiometric(): Promise<void>;
  /** Sprint 6B Security: the self-service password reset (OnboardingController). */
  startPasswordReset(): void;
  submitResetEmail(email: string): Promise<void>;
  submitResetCode(code: string): Promise<void>;
  submitNewPassword(password: string, confirmation: string): Promise<void>;
  restart(): void;
  signOut(): Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const controller = useMemo(
    () => new OnboardingController({ db, sessions: sessionStore, councilNumber: getConfiguredCouncilNumber(), biometric: biometricLogin }),
    [],
  );
  const [onboarding, setOnboarding] = useState<OnboardingState>(controller.state);
  const [startupError, setStartupError] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let cancelled = false;
    db.init()
      .then(() => controller.start())
      .then((state) => {
        if (!cancelled) setOnboarding(state);
      })
      .catch((err: unknown) => {
        if (!cancelled) setStartupError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [controller]);

  const user = onboarding.screen === 'signedIn' ? onboarding.user : null;

  // Shift and meeting reminders (Phase 3): one sweep now, then every window while a member is signed in.
  useEffect(() => (user ? startNotificationScheduler(db) : undefined), [user]);

  const memberId = user?.memberId;

  // Push alerts (Sprint 5T): once per sign-in, ask for notification permission and link this phone's token.
  useEffect(() => {
    if (memberId === undefined) return;
    configureAlertDisplay();
    registerForPushAlerts(memberId).catch((err: unknown) => console.warn('[push] registration failed:', err));
  }, [memberId]);
  const refreshUnread = useCallback(async () => {
    if (memberId === undefined) return setUnread(0);
    try {
      const threads = await db.messages.listThreads(memberId);
      setUnread(countUnreadMessages(threads));
    } catch {
      // the badge is decoration; a failed refresh keeps the last count
    }
  }, [memberId]);

  const councilId = user?.councilId;
  const [features, setFeatures] = useState<FeatureFlags>(ALL_FEATURES_ON);
  const [tenantType, setTenantType] = useState<TenantType>(DEFAULT_TENANT_TYPE);
  const refreshFeatures = useCallback(async () => {
    if (councilId === undefined) {
      setTenantType(DEFAULT_TENANT_TYPE);
      return setFeatures(ALL_FEATURES_ON);
    }
    try {
      const council = await db.councils.get(councilId);
      registerCouncilGates(council);
      setFeatures(councilFeatureFlags(council));
      setTenantType(councilTenantType(council));
    } catch {
      // an unreadable council keeps the last flags rather than locking the app
    }
  }, [councilId]);
  useEffect(() => void refreshFeatures(), [refreshFeatures]);

  const [largeText, setLargeTextState] = useState(false);
  useEffect(() => {
    let live = true;
    if (memberId === undefined) setLargeTextState(false);
    else {
      db.members
        .get(memberId)
        .then((m) => live && setLargeTextState(prefersLargeText(m)))
        .catch(() => undefined); // an unreadable record keeps the standard layout
    }
    return () => {
      live = false;
    };
  }, [memberId]);
  const setLargeText = useCallback(
    async (on: boolean) => {
      if (memberId === undefined) return;
      const saved = await db.members.update(memberId, memberId, { flag_large_text_mode: on ? 1 : 0 });
      setLargeTextState(prefersLargeText(saved));
    },
    [memberId],
  );

  useEffect(() => {
    void refreshUnread();
    const timer = setInterval(() => void refreshUnread(), 30_000);
    return () => clearInterval(timer);
  }, [refreshUnread]);

  const submitEmail = useCallback(async (email: string) => setOnboarding(await controller.submitEmail(email)), [controller]);
  const submitPassword = useCallback(
    async (password: string, confirmation?: string, setupCode?: string) => setOnboarding(await controller.submitPassword(password, confirmation, setupCode)),
    [controller],
  );
  const startPasswordReset = useCallback(() => setOnboarding(controller.startPasswordReset()), [controller]);
  const submitResetEmail = useCallback(async (email: string) => setOnboarding(await controller.submitResetEmail(email)), [controller]);
  const submitResetCode = useCallback(async (code: string) => setOnboarding(await controller.submitResetCode(code)), [controller]);
  const submitNewPassword = useCallback(
    async (password: string, confirmation: string) => setOnboarding(await controller.submitNewPassword(password, confirmation)),
    [controller],
  );
  const restart = useCallback(() => setOnboarding(controller.restart()), [controller]);
  const [biometricEmail, setBiometricEmail] = useState<string | null>(null);
  const promptScreen = onboarding.screen === 'enterEmail' || onboarding.screen === 'signIn';
  useEffect(() => {
    let live = true;
    if (promptScreen) void controller.biometricEmail().then((email) => live && setBiometricEmail(email), () => undefined);
    return () => {
      live = false;
    };
  }, [controller, promptScreen]);
  const submitBiometric = useCallback(async () => setOnboarding(await controller.submitBiometric()), [controller]);
  const signOut = useCallback(async () => {
    // Unlink the phone first, while the member is still known; a failure must not block signing out.
    if (memberId !== undefined) await unregisterPushAlerts(memberId).catch(() => undefined);
    setOnboarding(await controller.signOut());
  }, [controller, memberId]);

  const value = useMemo<AppContextValue>(
    () => ({
      user,
      ready: onboarding.screen !== 'loading' || startupError !== null,
      startupError,
      onboarding,
      unread,
      refreshUnread,
      features,
      tenantType,
      refreshFeatures,
      largeText,
      setLargeText,
      submitEmail,
      submitPassword,
      biometricEmail,
      submitBiometric,
      startPasswordReset,
      submitResetEmail,
      submitResetCode,
      submitNewPassword,
      restart,
      signOut,
    }),
    [
      user,
      onboarding,
      startupError,
      unread,
      refreshUnread,
      features,
      tenantType,
      refreshFeatures,
      largeText,
      setLargeText,
      submitEmail,
      submitPassword,
      biometricEmail,
      submitBiometric,
      startPasswordReset,
      submitResetEmail,
      submitResetCode,
      submitNewPassword,
      restart,
      signOut,
    ],
  );
  return (
    <AppContext.Provider value={value}>
      <LayoutModeProvider large={largeText}>{children}</LayoutModeProvider>
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}

/** The signed-in member. Only call inside the (app) route group, which is guarded. */
export function useUser(): SessionUser {
  const { user } = useApp();
  if (!user) throw new Error('useUser called with nobody signed in');
  return user;
}

/** The member's council feature flags (Sprint 6A). */
export function useFeatureFlags(): FeatureFlags {
  return useApp().features;
}

/** The member's council tenant type (Sprint 6Z-Dual-Gate-Model). */
export function useTenantType(): TenantType {
  return useApp().tenantType;
}
