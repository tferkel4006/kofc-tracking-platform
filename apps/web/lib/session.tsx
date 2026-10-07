'use client';
// Signed-in member and startup state for the admin portal.
// The memory driver lives in the browser tab (see services/db.ts), so a reload starts a fresh seeded
// database and asks for sign-in again. That is the mock; the remote driver will hold real sessions.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ALL_FEATURES_ON,
  councilFeatureFlags,
  councilTenantType,
  DEFAULT_TENANT_TYPE,
  registerCouncilGates,
  type FeatureFlags,
  type SessionUser,
  type TenantType,
} from '@kofc/shared';
import { db } from '@/services/db';
import { closeServerSession, openServerSession } from '@/services/session-transport';

interface SessionValue {
  user: SessionUser | null;
  /** False until the in-memory database has been seeded. */
  ready: boolean;
  startupError: string | null;
  /** Resolves true when the credentials were accepted. */
  signIn(username: string, password: string): Promise<boolean>;
  signOut(): void;
  /** Bumped by profileChanged(), so views of the member's own record (the header avatar) reload. */
  profileVersion: number;
  /** Call after saving the signed-in member's own profile photo or details. */
  profileChanged(): void;
  /** Bumped by alertsChanged(), so the header bell reloads its alert log. */
  alertsVersion: number;
  /** Call after sending or reading alerts, so the bell's unread count catches up at once. */
  alertsChanged(): void;
  /** Bumped by messagesChanged(), so the header envelope reloads its unread count (Phase 4.5). */
  messagesVersion: number;
  /** Call after sending or reading messages, so the envelope's unread badge catches up at once. */
  messagesChanged(): void;
  /**
   * The signed-in member's council feature flags (Sprint 6A); every module reads as on until the council has loaded.
   * `featuresLoaded` turns true once it has, so a page of a switched-off module never flashes into view.
   */
  features: FeatureFlags;
  featuresLoaded: boolean;
  /**
   * The signed-in member's council tenant type (Sprint 6Z-Dual-Gate-Model): 'KOFC' until the council has loaded, like
   * the flags. A white-label tenant hides the fraternal areas and relabels the portal (whiteLabel).
   */
  tenantType: TenantType;
  /** Call after a Super Admin changes feature flags, so the sidebar and pages catch up at once. */
  featuresChanged(): void;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);
  const [startupError, setStartupError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    db.init().then(
      () => live && setReady(true),
      (err: unknown) => live && setStartupError(err instanceof Error ? err.message : String(err)),
    );
    return () => {
      live = false;
    };
  }, []);

  const signIn = useCallback(async (username: string, password: string) => {
    const found = await db.auth.signIn(username.trim(), password);
    // Sprint 6Z-Engine-Upgrade: the server checks the same credentials and sets its own session cookie, which its Drive
    // vault, Supreme and email routes require. A member it does not know (added in this tab) simply gets no cookie.
    if (found) await openServerSession(username.trim(), password);
    setUser(found);
    return found !== null;
  }, []);
  const signOut = useCallback(() => {
    setUser(null);
    void closeServerSession();
  }, []);
  const [profileVersion, setProfileVersion] = useState(0);
  const profileChanged = useCallback(() => setProfileVersion((v) => v + 1), []);
  const [alertsVersion, setAlertsVersion] = useState(0);
  const alertsChanged = useCallback(() => setAlertsVersion((v) => v + 1), []);
  const [messagesVersion, setMessagesVersion] = useState(0);
  const messagesChanged = useCallback(() => setMessagesVersion((v) => v + 1), []);
  const [featuresVersion, setFeaturesVersion] = useState(0);
  const featuresChanged = useCallback(() => setFeaturesVersion((v) => v + 1), []);
  const [loadedFeatures, setLoadedFeatures] = useState<{ councilId: number; flags: FeatureFlags; tenantType: TenantType } | null>(null);
  const councilId = user?.councilId;
  useEffect(() => {
    if (councilId === undefined) return;
    let live = true;
    db.councils.get(councilId).then(
      (council) => {
        if (!live) return;
        registerCouncilGates(council);
        setLoadedFeatures({ councilId, flags: councilFeatureFlags(council), tenantType: councilTenantType(council) });
      },
      // An unreadable council keeps every module on rather than locking the portal.
      () => live && setLoadedFeatures({ councilId, flags: ALL_FEATURES_ON, tenantType: DEFAULT_TENANT_TYPE }),
    );
    return () => {
      live = false;
    };
  }, [councilId, featuresVersion]);
  const featuresLoaded = loadedFeatures !== null && loadedFeatures.councilId === councilId;
  const features = featuresLoaded ? loadedFeatures.flags : ALL_FEATURES_ON;
  const tenantType = featuresLoaded ? loadedFeatures.tenantType : DEFAULT_TENANT_TYPE;

  const value = useMemo(
    () => ({
      user,
      ready,
      startupError,
      signIn,
      signOut,
      profileVersion,
      profileChanged,
      alertsVersion,
      alertsChanged,
      messagesVersion,
      messagesChanged,
      features,
      featuresLoaded,
      tenantType,
      featuresChanged,
    }),
    [user, ready, startupError, signIn, signOut, profileVersion, profileChanged, alertsVersion, alertsChanged, messagesVersion, messagesChanged, features, featuresLoaded, tenantType, featuresChanged],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>');
  return ctx;
}

/** The signed-in member. Pages render only behind the shell's sign-in gate, so this is never null there. */
export function useUser(): SessionUser {
  const { user } = useSession();
  if (!user) throw new Error('useUser called with nobody signed in');
  return user;
}

/** The signed-in member's council feature flags (Sprint 6A). */
export function useFeatureFlags(): FeatureFlags {
  return useSession().features;
}

/** The signed-in member's council tenant type (Sprint 6Z-Dual-Gate-Model). */
export function useTenantType(): TenantType {
  return useSession().tenantType;
}
