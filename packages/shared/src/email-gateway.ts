// Sprint 6Z-Email-Proxy (Schema 37): a council's own outbound email gateway.
//
// Five Council columns name the SMTP server the council's portal email goes out through: EmailProvider, SmtpHost,
// SmtpPort, SmtpUsername and EmailPasswordEncrypted. Only an Active Super Admin saves them (councils.setEmailGateway,
// from the Councils page); councils.create and update never touch them.
//
// THE PASSWORD IS NEVER STORED OR SHOWN IN THE CLEAR. The Councils page posts it once to /api/councils/email-gateway,
// where the server seals it with AES-256-GCM under a key that exists only on the server (EMAIL_GATEWAY_SECRET) and
// hands back the sealed text. Only that sealed text reaches a data driver, and the page shows dots in its place. The
// notification route unseals it on the server at send time (apps/web/services/server/smtp.ts).
import { BusinessRuleError } from './rules';
import type { Council } from './types';

export const EMAIL_PROVIDERS = ['Custom SMTP', 'Google Workspace', 'Microsoft 365'] as const;
export type EmailProvider = (typeof EMAIL_PROVIDERS)[number];

/** The SMTP server each hosted provider documents for authenticated submission; Custom SMTP has none. */
export const EMAIL_PROVIDER_PRESETS: Record<EmailProvider, { host: string; port: number } | null> = {
  'Custom SMTP': null,
  'Google Workspace': { host: 'smtp.gmail.com', port: 587 },
  'Microsoft 365': { host: 'smtp.office365.com', port: 587 },
};

/** 465 opens TLS at once; the others must offer STARTTLS. The server never signs in over a plain connection. */
export const SMTP_PORTS = [25, 465, 587, 2525] as const;

/** Sealed passwords look like `v1.<iv>.<tag>.<ciphertext>`, each part base64url. */
export const SEALED_SECRET_PATTERN = /^v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{2,4100}$/;

/** What shows in place of a saved password. */
export const REDACTED_SECRET = '••••••••••••';

/** The five Council columns of the gateway. */
export interface EmailGatewaySettings {
  EmailProvider: EmailProvider;
  SmtpHost: string;
  SmtpPort: number;
  SmtpUsername: string;
  EmailPasswordEncrypted: string;
}

export const EMAIL_GATEWAY_COLUMNS = ['EmailProvider', 'SmtpHost', 'SmtpPort', 'SmtpUsername', 'EmailPasswordEncrypted'] as const satisfies readonly (keyof EmailGatewaySettings)[];
export type EmailGatewayColumn = (typeof EMAIL_GATEWAY_COLUMNS)[number];

/** The gateway columns as one cleared (all NULL) row update. */
export const CLEARED_EMAIL_GATEWAY: Record<EmailGatewayColumn, null> = {
  EmailProvider: null,
  SmtpHost: null,
  SmtpPort: null,
  SmtpUsername: null,
  EmailPasswordEncrypted: null,
};

const HOSTNAME = /^(?=.{1,253}$)[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

export const isEmailProvider = (value: unknown): value is EmailProvider => typeof value === 'string' && (EMAIL_PROVIDERS as readonly string[]).includes(value);

/**
 * A councils.setEmailGateway request, checked: a known provider, a dotted host name, one of SMTP_PORTS, a username of
 * 1-255 characters without control characters, and a password already sealed by the server. Rejects INVALID_INPUT.
 */
export function cleanEmailGatewaySettings(input: unknown): EmailGatewaySettings {
  const v = (input ?? {}) as Record<string, unknown>;
  const fail = (message: string, field: string) => new BusinessRuleError('INVALID_INPUT', message, { field });
  if (!isEmailProvider(v.EmailProvider)) throw fail(`The email provider must be one of ${EMAIL_PROVIDERS.join(', ')}.`, 'EmailProvider');
  const host = typeof v.SmtpHost === 'string' ? v.SmtpHost.trim().toLowerCase() : '';
  if (!HOSTNAME.test(host)) throw fail('The SMTP host must be a server name such as smtp.example.org.', 'SmtpHost');
  const port = v.SmtpPort;
  if (typeof port !== 'number' || !(SMTP_PORTS as readonly number[]).includes(port)) throw fail(`The SMTP port must be ${SMTP_PORTS.join(', ')}.`, 'SmtpPort');
  const username = typeof v.SmtpUsername === 'string' ? v.SmtpUsername.trim() : '';
  // eslint-disable-next-line no-control-regex
  if (!username || username.length > 255 || /[\x00-\x1f\x7f]/.test(username)) throw fail('The SMTP username is missing, too long or not plain text.', 'SmtpUsername');
  const sealed = v.EmailPasswordEncrypted;
  if (typeof sealed !== 'string' || !SEALED_SECRET_PATTERN.test(sealed)) {
    throw fail('The password must be sealed by the server before it is saved; enter it on the Councils page.', 'EmailPasswordEncrypted');
  }
  return { EmailProvider: v.EmailProvider, SmtpHost: host, SmtpPort: port, SmtpUsername: username, EmailPasswordEncrypted: sealed };
}

/** The council's gateway when all five columns are filled; otherwise null and email takes the default route. */
export function councilEmailGateway(council: Partial<Council> | null | undefined): EmailGatewaySettings | null {
  if (!council) return null;
  const { EmailProvider: provider, SmtpHost, SmtpPort, SmtpUsername, EmailPasswordEncrypted } = council;
  if (!isEmailProvider(provider) || !SmtpHost || !SmtpPort || !SmtpUsername || !EmailPasswordEncrypted) return null;
  return { EmailProvider: provider, SmtpHost, SmtpPort: Number(SmtpPort), SmtpUsername, EmailPasswordEncrypted };
}
