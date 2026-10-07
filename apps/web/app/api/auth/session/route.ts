// /api/auth/session - the portal's server session (Sprint 6Z-Engine-Upgrade).
//   POST   { username, password }  checks the credentials on the server and sets the HttpOnly session cookie
//   GET                            answers who the cookie belongs to (401 without one)
//   DELETE                         clears the cookie (sign-out)
// The browser's own sign-in (the memory driver) runs alongside; this cookie is what the Drive vault, Supreme and email
// routes trust. Five failed attempts for one username within 15 minutes are refused with 429.
import { NextResponse } from 'next/server';
import { readPortalSession, signInOnServer, signOutCookie } from '@/services/server/session';

/** Longest username or password read; anything longer is refused before hashing. */
const MAX_FIELD_LENGTH = 256;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { username?: unknown; password?: unknown } | null;
  const { username, password } = body ?? {};
  if (typeof username !== 'string' || typeof password !== 'string' || !username.trim() || !password || username.length > MAX_FIELD_LENGTH || password.length > MAX_FIELD_LENGTH) {
    return NextResponse.json({ signedIn: false, message: 'Send a username and password.' }, { status: 400 });
  }
  const outcome = await signInOnServer(username, password);
  if (!outcome.ok) return NextResponse.json({ signedIn: false, message: outcome.message }, { status: outcome.status });
  const res = NextResponse.json({ signedIn: true, memberId: outcome.user.memberId });
  res.headers.set('Set-Cookie', outcome.cookie);
  return res;
}

export async function GET(req: Request) {
  const claims = await readPortalSession(req);
  if (!claims) return NextResponse.json({ signedIn: false }, { status: 401 });
  return NextResponse.json({
    signedIn: true,
    memberId: claims.memberId,
    councilId: claims.councilId,
    memberType: claims.memberType,
    roles: claims.roles,
    expiresAt: new Date(claims.exp * 1000).toISOString(),
  });
}

export async function DELETE() {
  const res = NextResponse.json({ signedIn: false });
  res.headers.set('Set-Cookie', signOutCookie());
  return res;
}
