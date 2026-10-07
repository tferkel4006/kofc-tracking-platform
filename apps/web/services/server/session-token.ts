// The portal's server session token (Sprint 6Z-Engine-Upgrade): the signed-in member as the server checked them at
// sign-in, sealed with HMAC-SHA256 so the browser can carry it but cannot change it.
//
//   <base64url(JSON claims)>.<base64url(HMAC-SHA256(secret, first part))>
//
// Pure Web Crypto, no Node-only APIs, so the API routes and the unit tests share it. The secret never leaves the server
// (services/server/secrets.ts); this module only takes it as an argument.
import type { MemberWriteActor, SessionUser } from '@kofc/shared';

/** The cookie the token rides in: HttpOnly, SameSite=Strict, scoped to /api. */
export const PORTAL_SESSION_COOKIE = 'kofc_portal_session';
/** How long a session lasts after sign-in. */
export const PORTAL_SESSION_TTL_SECONDS = 8 * 60 * 60;
/** Shortest PORTAL_SESSION_SECRET accepted. */
export const PORTAL_SESSION_SECRET_MIN_LENGTH = 32;

/** What the token vouches for: the member's identity and access, read from the server's own copy of the data. */
export interface PortalSessionClaims {
  memberId: number;
  councilId: number;
  username: string;
  memberType: SessionUser['memberType'];
  roles: string[];
  isOfficer: boolean;
  isBudgetDirector: boolean;
  /** Member.StatusID was Active at sign-in. */
  active: boolean;
  /** Issued and expiry times, in seconds since the epoch. */
  iat: number;
  exp: number;
}

const encoder = new TextEncoder();

function base64url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64url(text: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) return null;
  try {
    const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4));
    return Uint8Array.from(binary, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

async function hmac(secret: string, data: string): Promise<Uint8Array> {
  const key = await globalThis.crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await globalThis.crypto.subtle.sign('HMAC', key, encoder.encode(data)));
}

/** Compares two byte strings in time that does not depend on where they differ. */
function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/** Claims for `user`, valid for PORTAL_SESSION_TTL_SECONDS from `now`. */
export function sessionClaimsFor(user: SessionUser, active: boolean, now: Date): PortalSessionClaims {
  const iat = Math.floor(now.getTime() / 1000);
  return {
    memberId: user.memberId,
    councilId: user.councilId,
    username: user.username,
    memberType: user.memberType,
    roles: [...user.roles],
    isOfficer: user.isOfficer,
    isBudgetDirector: user.isBudgetDirector,
    active,
    iat,
    exp: iat + PORTAL_SESSION_TTL_SECONDS,
  };
}

export async function signSessionToken(claims: PortalSessionClaims, secret: string): Promise<string> {
  const body = base64url(encoder.encode(JSON.stringify(claims)));
  return `${body}.${base64url(await hmac(secret, body))}`;
}

/** The token's claims when its signature matches and it has not expired at `now`; null otherwise. */
export async function verifySessionToken(token: string | null | undefined, secret: string, now: Date): Promise<PortalSessionClaims | null> {
  if (typeof token !== 'string' || token.length > 4096) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, signature] = parts;
  const given = fromBase64url(signature);
  if (!given || !sameBytes(given, await hmac(secret, body))) return null;
  const json = fromBase64url(body);
  if (!json) return null;
  let claims: PortalSessionClaims;
  try {
    claims = JSON.parse(new TextDecoder().decode(json)) as PortalSessionClaims;
  } catch {
    return null;
  }
  if (typeof claims !== 'object' || claims === null || typeof claims.memberId !== 'number' || typeof claims.exp !== 'number') return null;
  return claims.exp > Math.floor(now.getTime() / 1000) ? claims : null;
}

/** The claims as the actor the shared business rules (rules.ts) check. */
export const sessionActor = (claims: PortalSessionClaims): MemberWriteActor => ({
  memberId: claims.memberId,
  councilId: claims.councilId,
  memberType: claims.memberType,
  active: claims.active,
  roles: claims.roles,
  budgetDirector: claims.isBudgetDirector,
  officer: claims.isOfficer,
});

/** The value of cookie `name` in a Cookie request header, or null. */
export function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0 && part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return null;
}

/**
 * The Set-Cookie header for a session token. No Max-Age, so the browser drops it when it closes; the token's own `exp`
 * ends it after PORTAL_SESSION_TTL_SECONDS regardless. `token` null clears the cookie.
 */
export function sessionCookieHeader(token: string | null, secure: boolean): string {
  const attrs = ['Path=/api', 'HttpOnly', 'SameSite=Strict', ...(secure ? ['Secure'] : [])];
  return token === null ? [`${PORTAL_SESSION_COOKIE}=`, 'Max-Age=0', ...attrs].join('; ') : [`${PORTAL_SESSION_COOKIE}=${token}`, ...attrs].join('; ');
}

/**
 * Failed sign-ins per key (the username), at most `limit` within `windowMs`; a successful sign-in clears the key.
 * In-process memory, which is enough for one server; a fleet needs a shared store.
 */
export class SignInThrottle {
  private readonly failures = new Map<string, number[]>();

  constructor(
    private readonly limit = 5,
    private readonly windowMs = 15 * 60 * 1000,
  ) {}

  private recent(key: string, now: number): number[] {
    const kept = (this.failures.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (kept.length) this.failures.set(key, kept);
    else this.failures.delete(key);
    return kept;
  }

  isLocked(key: string, now: number): boolean {
    return this.recent(key, now).length >= this.limit;
  }

  fail(key: string, now: number): void {
    this.failures.set(key, [...this.recent(key, now), now]);
  }

  clear(key: string): void {
    this.failures.delete(key);
  }
}
