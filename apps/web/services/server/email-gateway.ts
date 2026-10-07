// Sealing councils' SMTP passwords (Sprint 6Z-Email-Proxy). SERVER ONLY, like secrets.ts.
//
// A password is sealed with AES-256-GCM under SHA-256(EMAIL_GATEWAY_SECRET), with the council id as additional data, so
// a sealed value copied onto another council's row does not open. The sealed form is `v1.<iv>.<tag>.<ciphertext>`, each
// part base64url (SEALED_SECRET_PATTERN in @kofc/shared). Nothing here ever logs or returns the password.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { BusinessRuleError, SEALED_SECRET_PATTERN } from '@kofc/shared';
import { emailGatewaySecret } from './secrets';

if (typeof window !== 'undefined') {
  throw new Error('services/server/email-gateway.ts was loaded in a browser. Server secrets must never reach the client bundle.');
}

/** The longest SMTP password the Councils page accepts. */
export const SMTP_PASSWORD_MAX_LENGTH = 1000;

const keyFrom = (secret: string): Buffer => createHash('sha256').update(`kofc-email-gateway:${secret}`).digest();
const aad = (councilId: number): Buffer => Buffer.from(`kofc-council-${councilId}`, 'utf8');

/** Seals `password` for council `councilId`. Rejects INVALID_INPUT for an empty, oversized or multi-line password. */
export function sealSmtpPassword(password: string, councilId: number, secret: string = emailGatewaySecret()): string {
  if (typeof password !== 'string' || !password || password.length > SMTP_PASSWORD_MAX_LENGTH || /[\r\n]/.test(password)) {
    throw new BusinessRuleError('INVALID_INPUT', `The SMTP password must be 1-${SMTP_PASSWORD_MAX_LENGTH} characters on one line.`, { field: 'password' });
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyFrom(secret), iv);
  cipher.setAAD(aad(councilId));
  const body = Buffer.concat([cipher.update(password, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), body.toString('base64url')].join('.');
}

/**
 * The password inside a sealed value, or null when it does not open: another key (EMAIL_GATEWAY_SECRET changed or was
 * never set and the server restarted), another council, or a damaged value.
 */
export function unsealSmtpPassword(sealed: string, councilId: number, secret: string = emailGatewaySecret()): string | null {
  if (!SEALED_SECRET_PATTERN.test(sealed)) return null;
  const [, iv, tag, body] = sealed.split('.');
  try {
    const decipher = createDecipheriv('aes-256-gcm', keyFrom(secret), Buffer.from(iv, 'base64url'));
    decipher.setAAD(aad(councilId));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(body, 'base64url')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}
