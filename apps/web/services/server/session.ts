// Server-side portal sessions for the app/api routes (Sprint 6Z-Engine-Upgrade).
//
// Until now the portal had no server sessions: the memory driver runs in the browser, so the Drive vault and Supreme
// routes could not tell who was calling. Now sign-in also posts the username and password to /api/auth/session. The
// server checks them against ITS OWN copy of the data (a MemoryDataService seeded from the same Seed.sql, so the same
// logins work), reads the member's type, roles and status there, and answers with an HttpOnly cookie carrying the signed
// claims (session-token.ts). Routes then call requirePortalSession, which trusts only that cookie, never anything the
// browser says about itself.
//
// LIMIT OF THE MOCK: the server's copy does not see what changes in a browser tab (a password reset, a member added and
// registered there, a role or type change). A member whose record exists only in a tab gets no server session, and a
// tab-only promotion is not honoured, until the remote driver puts both sides on one database. Live Drive, SendGrid and
// Supreme actions are refused for them, which fails closed.
import { NextResponse } from 'next/server';
import type { MemberWriteActor, SessionUser } from '@kofc/shared';
import { MemoryDataService } from '../drivers/memory';
import { portalSessionSecret } from './secrets';
import {
  PORTAL_SESSION_COOKIE,
  readCookie,
  sessionActor,
  sessionClaimsFor,
  sessionCookieHeader,
  signSessionToken,
  SignInThrottle,
  verifySessionToken,
  type PortalSessionClaims,
} from './session-token';

let directory: MemoryDataService | null = null;
const throttle = new SignInThrottle();

/** The server's own copy of the member data, seeded once per process like the browser's. */
async function memberDirectory(): Promise<MemoryDataService> {
  directory ??= new MemoryDataService({ presentationData: true, log: () => {} });
  await directory.init();
  return directory;
}

const secureCookies = () => process.env.NODE_ENV === 'production';

export type SignInOutcome = { ok: true; user: SessionUser; cookie: string } | { ok: false; status: 401 | 429; message: string };

/** Checks the credentials on the server and, when they are good, mints the session cookie. */
export async function signInOnServer(username: string, password: string, now = new Date()): Promise<SignInOutcome> {
  const key = username.trim().toLowerCase();
  if (throttle.isLocked(key, now.getTime())) return { ok: false, status: 429, message: 'Too many failed sign-ins. Wait 15 minutes and try again.' };
  const db = await memberDirectory();
  const user = await db.auth.signIn(username.trim(), password);
  if (!user) {
    throttle.fail(key, now.getTime());
    return { ok: false, status: 401, message: 'The username or password is not correct.' };
  }
  throttle.clear(key);
  const [member, statuses] = await Promise.all([db.members.get(user.memberId), db.lookups.list('MemberStatus')]);
  const activeId = statuses.find((st) => st.Status === 'Active')?.id;
  const claims = sessionClaimsFor(user, member !== null && member.StatusID === activeId, now);
  return { ok: true, user, cookie: sessionCookieHeader(await signSessionToken(claims, portalSessionSecret()), secureCookies()) };
}

/** The Set-Cookie header that ends the session. */
export const signOutCookie = (): string => sessionCookieHeader(null, secureCookies());

/** The caller's verified session claims, or null. */
export async function readPortalSession(req: Request, now = new Date()): Promise<PortalSessionClaims | null> {
  return verifySessionToken(readCookie(req.headers.get('cookie'), PORTAL_SESSION_COOKIE), portalSessionSecret(), now);
}

/**
 * The caller's session when `allow` accepts its actor; otherwise the response to send instead: 401 with no valid session,
 * 403 when the member may not do this. `body` adds the route's own failure fields (e.g. { archived: false }).
 */
export async function requirePortalSession(
  req: Request,
  allow: (actor: MemberWriteActor, claims: PortalSessionClaims) => boolean,
  body: Record<string, unknown> = {},
): Promise<{ claims: PortalSessionClaims; actor: MemberWriteActor } | { denied: NextResponse }> {
  const claims = await readPortalSession(req);
  if (!claims) return { denied: NextResponse.json({ ...body, message: 'Sign in again: there is no portal session on the server.' }, { status: 401 }) };
  const actor = sessionActor(claims);
  if (!allow(actor, claims)) return { denied: NextResponse.json({ ...body, message: 'Your account may not do this.' }, { status: 403 }) };
  return { claims, actor };
}
