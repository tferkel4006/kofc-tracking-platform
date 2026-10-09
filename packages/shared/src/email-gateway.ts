// Sprint 6Z-Email-Proxy (Schema 37): a council's own outbound email gateway.
//
// Four Council columns name the SMTP server the council's portal email goes out through: EmailProvider, SmtpHost,
// SmtpPort and SmtpUsername. Only an Active Admin of the council or an Active Super Admin saves them
// (councils.setEmailGateway, from the Outbound Email Gateway tab of Council Lookups - Sprint 6Z-Admin-Email-Perms);
// councils.create and update never touch them.
//
// THE PASSWORD IS NOT ON THE COUNCIL ROW. Sprint 6Y (Schema 40) moved it to the Centralized Encrypted Credentials Vault
// (credentials-vault.ts) as SMTP_OUTBOUND_PASSWORD. The panel posts it once to /api/councils/email-gateway, where the
// server seals it with AES-256-GCM and keeps it in CouncilCredentialsVault; nothing sealed or plain comes back, only a
// CredentialStatus. The notification route unseals it on the server at send time (apps/web/services/server/smtp.ts).
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

/** The four Council columns of the gateway. */
export interface EmailGatewaySettings {
  EmailProvider: EmailProvider;
  SmtpHost: string;
  SmtpPort: number;
  SmtpUsername: string;
}

export const EMAIL_GATEWAY_COLUMNS = ['EmailProvider', 'SmtpHost', 'SmtpPort', 'SmtpUsername'] as const satisfies readonly (keyof EmailGatewaySettings)[];
export type EmailGatewayColumn = (typeof EMAIL_GATEWAY_COLUMNS)[number];

/** The gateway columns as one cleared (all NULL) row update. */
export const CLEARED_EMAIL_GATEWAY: Record<EmailGatewayColumn, null> = {
  EmailProvider: null,
  SmtpHost: null,
  SmtpPort: null,
  SmtpUsername: null,
};

const HOSTNAME = /^(?=.{1,253}$)[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

export const isEmailProvider = (value: unknown): value is EmailProvider => typeof value === 'string' && (EMAIL_PROVIDERS as readonly string[]).includes(value);

/**
 * A councils.setEmailGateway request, checked: a known provider, a dotted host name, one of SMTP_PORTS, a username of
 * 1-255 characters without control characters. Rejects INVALID_INPUT, and refuses any credential field outright: a password
 * belongs in the credentials vault, never on the Council row.
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
  if (v.EmailPasswordEncrypted != null || v.password != null) {
    throw fail('The SMTP password is kept in the credentials vault, not on the council; enter it on the Credentials Vault page.', 'password');
  }
  return { EmailProvider: v.EmailProvider, SmtpHost: host, SmtpPort: port, SmtpUsername: username };
}

/**
 * The council's gateway when all four columns are filled; otherwise null and email takes the default route. The SMTP
 * password is looked up separately, in the credentials vault, by the server.
 */
export function councilEmailGateway(council: Partial<Council> | null | undefined): EmailGatewaySettings | null {
  if (!council) return null;
  const { EmailProvider: provider, SmtpHost, SmtpPort, SmtpUsername } = council;
  if (!isEmailProvider(provider) || !SmtpHost || !SmtpPort || !SmtpUsername) return null;
  return { EmailProvider: provider, SmtpHost, SmtpPort: Number(SmtpPort), SmtpUsername };
}
