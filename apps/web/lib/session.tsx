'use client';
// Signed-in member and startup state for the admin portal.
// The memory driver lives in the browser tab (see services/db.ts), so a reload starts a fresh seeded
// database and asks for sign-in again. That is the mock; the remote driver will hold real sessions.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { SessionUser } from '@kofc/shared';
import { db } from '@/services/db';

interface SessionValue {
  user: SessionUser | null;
  /** False until the in-memory database has been seeded. */
  ready: boolean;
  startupError: string | null;
  /** Resolves true when the credentials were accepted. */
  signIn(username: string, password: string): Promise<boolean>;
  signOut(): void;
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
    setUser(found);
    return found !== null;
  }, []);
  const signOut = useCallback(() => setUser(null), []);

  const value = useMemo(() => ({ user, ready, startupError, signIn, signOut }), [user, ready, startupError, signIn, signOut]);
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
