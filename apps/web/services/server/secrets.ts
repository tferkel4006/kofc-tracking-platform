// The portal's server-held secrets (Sprint 6Z-Engine-Upgrade), read in one place from the server's environment.
//
// SERVER ONLY. Import this file only from app/api route handlers and other services/server modules. Anything a client
// component reads from process.env (and every NEXT_PUBLIC_ variable) is baked into the public JavaScript bundle, so no
// secret below may ever be read anywhere else. The guard throws if a browser bundle ever pulls this file in, and
// tests/engine-upgrade.test.ts fails the build's tests if a "use client" module imports it.
//
//   PORTAL_SESSION_SECRET          signs the portal session cookie (at least 32 characters)
//   SENDGRID_API_KEY               SendGrid v3 key; live email also needs SENDGRID_LIVE=1
//   CREDENTIALS_VAULT_SECRET       seals every CouncilCredentialsVault row (at least 32 characters; Sprint 6Y). The
//                                  Sprint 6Z-Email-Proxy name EMAIL_GATEWAY_SECRET is still read when it is not set.
//   GOOGLE_DRIVE_CLIENT_EMAIL      \
//   GOOGLE_DRIVE_PRIVATE_KEY        > the Drive vault's service account; live use also needs DRIVE_VAULT_LIVE=1. Sprint 6Y:
//   GOOGLE_DRIVE_SHARED_DRIVE_ID   /  a council's own GOOGLE_DRIVE_PRIVATE_KEY in the credentials vault wins over this one
//   ALCHEMER_API_KEY / _SECRET     Alchemer REST v5 pair (the Supreme sync is still simulated)
import { driveCredentialsFromEnv, type DriveCredentials } from '../google-drive';
import { PORTAL_SESSION_SECRET_MIN_LENGTH } from './session-token';

if (typeof window !== 'undefined') {
  throw new Error('services/server/secrets.ts was loaded in a browser. Server secrets must never reach the client bundle.');
}

type Env = Record<string, string | undefined>;

const generatedSecrets = new Map<string, string>();

/** The named secret when it is set and long enough; otherwise one random key per process, with a warning naming `effect`. */
function configuredOrRandom(env: Env, name: string, tag: string, effect: string): string {
  const configured = env[name]?.trim();
  if (configured && configured.length >= PORTAL_SESSION_SECRET_MIN_LENGTH) return configured;
  let generated = generatedSecrets.get(name);
  if (!generated) {
    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(32));
    generated = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    generatedSecrets.set(name, generated);
    console.warn(
      `[${tag}] ${name} is ${configured ? `shorter than ${PORTAL_SESSION_SECRET_MIN_LENGTH} characters` : 'not set'}; using a random key, so ${effect}.`,
    );
  }
  return generated;
}

/**
 * The key that signs session cookies. Without PORTAL_SESSION_SECRET (or with one under 32 characters) the server makes a
 * random one for this process, so sessions still work but end whenever the server restarts.
 */
export const portalSessionSecret = (env: Env = process.env): string =>
  configuredOrRandom(env, 'PORTAL_SESSION_SECRET', 'session', 'portal sessions end when the server restarts');

/**
 * The key that seals every row of the credentials vault (Sprint 6Y; before it, councils' SMTP passwords). Read from
 * CREDENTIALS_VAULT_SECRET, else the older EMAIL_GATEWAY_SECRET. Without either the server makes a random one for this
 * process: saving still works, but every saved credential must be entered again after a restart.
 */
export const credentialsVaultSecret = (env: Env = process.env): string =>
  configuredOrRandom(
    { CREDENTIALS_VAULT_SECRET: env.CREDENTIALS_VAULT_SECRET?.trim() || env.EMAIL_GATEWAY_SECRET },
    'CREDENTIALS_VAULT_SECRET',
    'credentials-vault',
    'saved council credentials must be entered again after the server restarts',
  );

/** The Drive settings with a council's own private key (from the credentials vault) in place of the server's, when it has one. */
const withPrivateKey = (env: Env, councilPrivateKey: string | null | undefined): NodeJS.ProcessEnv =>
  (councilPrivateKey ? { ...env, GOOGLE_DRIVE_PRIVATE_KEY: councilPrivateKey } : env) as NodeJS.ProcessEnv;

/**
 * The Drive vault's service account when it is configured AND DRIVE_VAULT_LIVE=1; otherwise null. Sprint 6Y: the
 * routes pass the council's GOOGLE_DRIVE_PRIVATE_KEY from the credentials vault, which replaces the server's own.
 */
export function liveDriveCredentials(env: Env = process.env, councilPrivateKey?: string | null): DriveCredentials | null {
  const creds = driveCredentialsFromEnv(withPrivateKey(env, councilPrivateKey));
  return creds && env.DRIVE_VAULT_LIVE === '1' ? creds : null;
}

/** Why the Drive vault is not in use, for the 503 answer. */
export const driveVaultOffReason = (env: Env = process.env, councilPrivateKey?: string | null): string =>
  driveCredentialsFromEnv(withPrivateKey(env, councilPrivateKey)) ? 'The Drive vault is configured but DRIVE_VAULT_LIVE is not on.' : 'The Drive vault is not configured.';

/** The SendGrid key when it is set AND SENDGRID_LIVE=1; otherwise null and email stays simulated. */
export function liveSendGridKey(env: Env = process.env): string | null {
  const key = env.SENDGRID_API_KEY?.trim();
  return key && env.SENDGRID_LIVE === '1' ? key : null;
}

/** Whether the Alchemer pair is present (the route reports it; nothing is sent yet). */
export const alchemerCredentialsConfigured = (env: Env = process.env): boolean => Boolean(env.ALCHEMER_API_KEY && env.ALCHEMER_API_SECRET);
