// Session and startup state for the whole app.
// Owns the OnboardingController (services/onboarding.ts), which does all the sign-in rules; screens
// only render its state. Also opens the local database and runs the reminder scheduler while signed in.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { startNotificationScheduler, type SessionUser } from '@kofc/shared';
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
  /** Unread messages addressed to the member, across all threads (Messages tab badge). */
  unread: number;
  refreshUnread(): Promise<void>;
  submitEmail(email: string): Promise<void>;
  submitPassword(password: string, confirmation?: string): Promise<void>;
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
  const refreshUnread = useCallback(async () => {
    if (memberId === undefined) return setUnread(0);
    try {
      const threads = await db.messages.listThreads(memberId);
      setUnread(threads.reduce((sum, t) => sum + t.unreadCount, 0));
    } catch {
      // the badge is decoration; a failed refresh keeps the last count
    }
  }, [memberId]);

  useEffect(() => {
    void refreshUnread();
    const timer = setInterval(() => void refreshUnread(), 30_000);
    return () => clearInterval(timer);
  }, [refreshUnread]);

  const submitEmail = useCallback(async (email: string) => setOnboarding(await controller.submitEmail(email)), [controller]);
  const submitPassword = useCallback(
    async (password: string, confirmation?: string) => setOnboarding(await controller.submitPassword(password, confirmation)),
    [controller],
  );
  const restart = useCallback(() => setOnboarding(controller.restart()), [controller]);
  const signOut = useCallback(async () => setOnboarding(await controller.signOut()), [controller]);

  const value = useMemo<AppContextValue>(
    () => ({
      user,
      ready: onboarding.screen !== 'loading' || startupError !== null,
      startupError,
      onboarding,
      unread,
      refreshUnread,
      submitEmail,
      submitPassword,
      restart,
      signOut,
    }),
    [user, onboarding, startupError, unread, refreshUnread, submitEmail, submitPassword, restart, signOut],
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
