// The browser half of the portal's server session (Sprint 6Z-Engine-Upgrade): sign-in also asks /api/auth/session for
// the HttpOnly cookie the Drive vault, Supreme and email routes check, and sign-out clears it. The cookie is the server's
// own decision; the browser never reads or writes it.
export const SESSION_ROUTE = '/api/auth/session';

/** True when the server accepted the credentials and set its session cookie. */
export async function openServerSession(username: string, password: string): Promise<boolean> {
  const res = await fetch(SESSION_ROUTE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  }).catch(() => null);
  return res?.ok ?? false;
}

export async function closeServerSession(): Promise<void> {
  await fetch(SESSION_ROUTE, { method: 'DELETE' }).catch(() => null);
}
