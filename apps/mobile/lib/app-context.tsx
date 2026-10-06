// Session and startup state for the whole app.
// Owns the OnboardingController (services/onboarding.ts), which does all the sign-in rules; screens
// only render its state. Also opens the local database, runs the reminder scheduler while signed in, and links the
// phone for push alerts after sign-in (lib/push-registration.ts), and reads the council's feature flags (Sprint 6A),
// which decide the tabs and buttons the app shows.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ALL_FEATURES_ON, councilFeatureFlags, startNotificationScheduler, type FeatureFlags, type SessionUser } from '@kofc/shared';
import { configureAlertDisplay, registerForPushAlerts, unregisterPushAlerts } from '@/lib/push-registration';
import { db } from '@/services/db';
import { getConfiguredCouncilNumber, OnboardingController, type OnboardingState } from '@/services/onboarding';
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
  /** Re-reads the flags, e.g. on a pull-to-refresh after a Super Admin changed them. */
  refreshFeatures(): Promise<void>;
  submitEmail(email: string): Promise<void>;
  submitPassword(password: string, confirmation?: string, setupCode?: string): Promise<void>;
  restart(): void;
  signOut(): Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const controller = useMemo(
    () => new OnboardingController({ db, sessions: sessionStore, councilNumber: getConfiguredCouncilNumber() }),
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
      setUnread(threads.reduce((sum, t) => sum + t.unreadCount, 0));
    } catch {
      // the badge is decoration; a failed refresh keeps the last count
    }
  }, [memberId]);

  const councilId = user?.councilId;
  const [features, setFeatures] = useState<FeatureFlags>(ALL_FEATURES_ON);
  const refreshFeatures = useCallback(async () => {
    if (councilId === undefined) return setFeatures(ALL_FEATURES_ON);
    try {
      setFeatures(councilFeatureFlags(await db.councils.get(councilId)));
    } catch {
      // an unreadable council keeps the last flags rather than locking the app
    }
  }, [councilId]);
  useEffect(() => void refreshFeatures(), [refreshFeatures]);

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
  const restart = useCallback(() => setOnboarding(controller.restart()), [controller]);
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
      refreshFeatures,
      submitEmail,
      submitPassword,
      restart,
      signOut,
    }),
    [user, onboarding, startupError, unread, refreshUnread, features, refreshFeatures, submitEmail, submitPassword, restart, signOut],
  );
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
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
