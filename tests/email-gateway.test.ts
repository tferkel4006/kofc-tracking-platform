// Sprint 6Z-Email-Proxy (Schema 37): a council's own outbound email gateway - the five Council columns and
// councils.setEmailGateway, the server's password sealing, the SMTP client, the save route and the notification
// route's SMTP branch.
import { readFileSync } from 'node:fs';
import net from 'node:net';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanEmailGatewaySettings, councilEmailGateway, SEALED_SECRET_PATTERN, type EmailGatewaySettings } from '@kofc/shared';
import { drivers, expectRule, MEMBER } from './helpers';
import { sealSmtpPassword, unsealSmtpPassword } from '../apps/web/services/server/email-gateway';
import { buildMimeMessage, smtpMessageFor, type SmtpMessage } from '../apps/web/services/server/smtp';
import { signInOnServer } from '../apps/web/services/server/session';
import { POST as gatewayPost } from '../apps/web/app/api/councils/email-gateway/route';
import { POST as emailPost } from '../apps/web/app/api/notifications/email/route';
import { GET as sessionGet } from '../apps/web/app/api/auth/session/route';

const smtpSend = vi.hoisted(() => vi.fn(async () => {}));
vi.mock('../apps/web/services/server/smtp', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../apps/web/services/server/smtp')>()),
  sendSmtpMail: smtpSend,
}));

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const SECRET = 's'.repeat(40);
const PASSWORD = 'app-pass word 9912!';

beforeAll(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterAll(() => vi.restoreAllMocks());

const settings = (overrides: Partial<EmailGatewaySettings> = {}): EmailGatewaySettings => ({
  EmailProvider: 'Google Workspace',
  SmtpHost: 'smtp.gmail.com',
  SmtpPort: 587,
  SmtpUsername: 'council15295@kofc.org',
  EmailPasswordEncrypted: sealSmtpPassword(PASSWORD, 1, SECRET),
  ...overrides,
});

describe('gateway settings', () => {
  it('accepts a full, sealed set and normalizes the host', () => {
    const clean = cleanEmailGatewaySettings({ ...settings(), SmtpHost: ' SMTP.Gmail.com ' });
    expect(clean.SmtpHost).toBe('smtp.gmail.com');
    expect(councilEmailGateway({ id: 1, ...clean })).toEqual(clean);
    expect(councilEmailGateway({ id: 1, ...clean, SmtpHost: null })).toBeNull();
  });

  it('refuses an unknown provider, a bad host or port, and any password the server did not seal', () => {
    expect(() => cleanEmailGatewaySettings({ ...settings(), EmailProvider: 'Yahoo' })).toThrow(/provider/);
    expect(() => cleanEmailGatewaySettings({ ...settings(), SmtpHost: 'localhost' })).toThrow(/host/);
    expect(() => cleanEmailGatewaySettings({ ...settings(), SmtpHost: 'smtp.x.org\r\nRCPT' })).toThrow(/host/);
    expect(() => cleanEmailGatewaySettings({ ...settings(), SmtpPort: 8080 })).toThrow(/port/);
    expect(() => cleanEmailGatewaySettings({ ...settings(), SmtpUsername: 'a\nb' })).toThrow(/username/);
    expect(() => cleanEmailGatewaySettings({ ...settings(), EmailPasswordEncrypted: PASSWORD })).toThrow(/sealed/);
  });
});

describe('password sealing', () => {
  it('round-trips, and opens only for the same council and key', () => {
    const sealed = sealSmtpPassword(PASSWORD, 1, SECRET);
    expect(sealed).toMatch(SEALED_SECRET_PATTERN);
    expect(sealed).not.toContain(Buffer.from(PASSWORD).toString('base64url'));
    expect(unsealSmtpPassword(sealed, 1, SECRET)).toBe(PASSWORD);
    expect(unsealSmtpPassword(sealed, 2, SECRET)).toBeNull();
    expect(unsealSmtpPassword(sealed, 1, 't'.repeat(40))).toBeNull();
    expect(unsealSmtpPassword(`${sealed.slice(0, -2)}AA`, 1, SECRET)).toBeNull();
    expect(sealSmtpPassword(PASSWORD, 1, SECRET)).not.toBe(sealed);
  });

  it('refuses an empty or multi-line password', () => {
    expect(() => sealSmtpPassword('', 1, SECRET)).toThrow(/password/);
    expect(() => sealSmtpPassword('a\r\nb', 1, SECRET)).toThrow(/password/);
  });
});

describe('SMTP message', () => {
  const email = { to: 'luke@example.org', from: 'noreply@kofc.org', subject: 'Welcome', text: 'Hello\n.dot line', attachments: [] };

  it('sends From the hosted mailbox with the portal sender as Reply-To', () => {
    expect(smtpMessageFor(email, 'council@kofc.org')).toMatchObject({ from: 'council@kofc.org', replyTo: 'noreply@kofc.org' });
    expect(smtpMessageFor(email, 'relay-user')).toMatchObject({ from: 'noreply@kofc.org' });
    expect(smtpMessageFor(email, 'relay-user').replyTo).toBeUndefined();
  });

  it('writes headers and a base64 body, encoding a non-ASCII subject and folding CR/LF out of it', () => {
    const mime = buildMimeMessage({ ...smtpMessageFor(email, 'council@kofc.org'), subject: 'Café\r\nBcc: x@y.org' }, new Date('2026-10-07T12:00:00Z'));
    expect(mime).toContain('From: <council@kofc.org>\r\nReply-To: <noreply@kofc.org>\r\nTo: <luke@example.org>');
    expect(mime).toContain(`Subject: =?UTF-8?B?${Buffer.from('Café Bcc: x@y.org').toString('base64')}?=`);
    expect(mime).not.toMatch(/^Bcc:/m);
    expect(mime).toContain('Date: Wed, 07 Oct 2026 12:00:00 +0000');
    expect(mime).toContain(Buffer.from('Hello\n.dot line').toString('base64'));
  });

  it('puts attachments in multipart/mixed and refuses an address that could break a command line', () => {
    const msg: SmtpMessage = { ...email, attachments: [{ filename: 'invite".ics', contentType: 'text/calendar', content: 'BEGIN:VCALENDAR' }] };
    const mime = buildMimeMessage(msg, new Date(), 'B');
    expect(mime).toContain('Content-Type: multipart/mixed; boundary="B"');
    expect(mime).toContain('filename="invite_.ics"');
    expect(mime).toContain(Buffer.from('BEGIN:VCALENDAR').toString('base64'));
    expect(mime.trimEnd().endsWith('--B--')).toBe(true);
    expect(() => buildMimeMessage({ ...email, to: 'a>@x.org' })).toThrow(/not an address/);
  });
});

describe('SMTP client', () => {
  it('never signs in over a connection without STARTTLS', async () => {
    const { sendSmtpMail } = await vi.importActual<typeof import('../apps/web/services/server/smtp')>('../apps/web/services/server/smtp');
    const heard: string[] = [];
    const server = net.createServer((socket) => {
      socket.write('220 test ESMTP\r\n');
      socket.on('data', (chunk) => {
        for (const line of chunk.toString().split('\r\n').filter(Boolean)) {
          heard.push(line);
          if (line.startsWith('EHLO')) socket.write('250-test\r\n250 AUTH PLAIN LOGIN\r\n');
        }
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as net.AddressInfo).port;
    try {
      await expect(
        sendSmtpMail({ host: '127.0.0.1', port, username: 'u', password: PASSWORD }, { from: 'a@x.org', to: 'b@x.org', subject: 's', text: 't', attachments: [] }, { timeoutMs: 2000 }),
      ).rejects.toThrow(/does not offer STARTTLS/);
      expect(heard.some((l) => l.startsWith('AUTH'))).toBe(false);
    } finally {
      server.close();
    }
  });
});

describe('schema 37', () => {
  it('adds the five council columns and bumps the phone database', () => {
    const schema = read('Schema.sql');
    expect(schema).toMatch(/ALTER TABLE \[Council\] ADD \[EmailProvider\] VARCHAR\(50\) NULL;/);
    expect(schema).toMatch(/ALTER TABLE \[Council\] ADD \[SmtpHost\] VARCHAR\(255\) NULL;/);
    expect(schema).toMatch(/ALTER TABLE \[Council\] ADD \[SmtpPort\] INT NULL;/);
    expect(schema).toMatch(/ALTER TABLE \[Council\] ADD \[SmtpUsername\] VARCHAR\(255\) NULL;/);
    expect(schema).toMatch(/ALTER TABLE \[Council\] ADD \[EmailPasswordEncrypted\] TEXT NULL;/);
    expect(read('apps/mobile/services/drivers/sqlite.ts')).toMatch(/const SCHEMA_VERSION = (3[7-9]|[4-9]\d);/);
    expect(read('data_dictionary.md')).toContain('EmailPasswordEncrypted (TEXT, NULL)');
  });
});

describe.each(drivers)('$name driver: councils.setEmailGateway', (d) => {
  it('starts empty, then saves and clears the gateway', async () => {
    const db = await d.make();
    expect(councilEmailGateway(await db.councils.get(1))).toBeNull();
    const saved = await db.councils.setEmailGateway(MEMBER.superAdmin, 1, settings());
    expect(councilEmailGateway(saved)).toEqual(settings({ EmailPasswordEncrypted: saved.EmailPasswordEncrypted! }));
    expect(councilEmailGateway(await db.councils.get(1))?.SmtpPort).toBe(587);
    const cleared = await db.councils.setEmailGateway(MEMBER.superAdmin, 1, null);
    expect(cleared.SmtpHost ?? null).toBeNull();
    expect(cleared.EmailPasswordEncrypted ?? null).toBeNull();
  });

  it('refuses an Admin, an unknown council and an unsealed password, writing nothing', async () => {
    const db = await d.make();
    await expectRule(db.councils.setEmailGateway(MEMBER.admin, 1, settings()), 'SUPER_ADMIN_REQUIRED');
    await expectRule(db.councils.setEmailGateway(MEMBER.superAdmin, 999, settings()), 'RECORD_NOT_FOUND');
    await expectRule(db.councils.setEmailGateway(MEMBER.superAdmin, 1, settings({ EmailPasswordEncrypted: PASSWORD })), 'INVALID_INPUT');
    expect(councilEmailGateway(await db.councils.get(1))).toBeNull();
  });

  it('keeps councils.update from touching the gateway', async () => {
    const db = await d.make();
    await db.councils.setEmailGateway(MEMBER.superAdmin, 1, settings());
    await db.councils.update(MEMBER.superAdmin, 1, { Phone: '555-0100' });
    expect(councilEmailGateway(await db.councils.get(1))?.SmtpHost).toBe('smtp.gmail.com');
  });
});

// ---- the routes ------------------------------------------------------------------------------------------------------

async function cookieFor(username: string): Promise<string> {
  const outcome = await signInOnServer(username, 'dev-pass-secure-9912');
  if (!outcome.ok) throw new Error(`${username} could not sign in: ${outcome.message}`);
  return outcome.cookie.split(';')[0];
}

const jsonRequest = (url: string, body: unknown, cookie?: string) =>
  new Request(`http://localhost${url}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) });

describe('/api/councils/email-gateway and the SMTP route', () => {
  const mail = {
    personalizations: [{ to: [{ email: 'luke@example.org' }] }],
    from: { email: 'noreply@kofc.org' },
    subject: 'Welcome',
    content: [{ type: 'text/plain', value: 'Hello' }],
  };

  it('lets only a Super Admin save, seals the password, and then sends the council email through SMTP', async () => {
    const superAdmin = await cookieFor('testsuperadmin@kofc.org');
    const { councilId } = await (await sessionGet(new Request('http://localhost/api/auth/session', { headers: { cookie: superAdmin } }))).json();
    const body = { councilId, EmailProvider: 'Microsoft 365', SmtpHost: 'smtp.office365.com', SmtpPort: 587, SmtpUsername: 'council@kofc.org', password: PASSWORD };

    expect((await gatewayPost(jsonRequest('/api/councils/email-gateway', body))).status).toBe(401);
    expect((await gatewayPost(jsonRequest('/api/councils/email-gateway', body, await cookieFor('testadmin@kofc.org')))).status).toBe(403);
    expect((await gatewayPost(jsonRequest('/api/councils/email-gateway', { ...body, password: undefined }, superAdmin))).status).toBe(400);

    const res = await gatewayPost(jsonRequest('/api/councils/email-gateway', body, superAdmin));
    expect(res.status).toBe(200);
    const text = await res.clone().text();
    expect(text).not.toContain(PASSWORD);
    const { settings: saved } = await res.json();
    expect(saved).toMatchObject({ EmailProvider: 'Microsoft 365', SmtpHost: 'smtp.office365.com', SmtpPort: 587 });
    expect(saved.EmailPasswordEncrypted).toMatch(SEALED_SECRET_PATTERN);

    // No password again: the sealed one is kept while host and username stay the same.
    const kept = await (await gatewayPost(jsonRequest('/api/councils/email-gateway', { ...body, password: undefined, SmtpPort: 465 }, superAdmin))).json();
    expect(kept.settings).toMatchObject({ SmtpPort: 465, EmailPasswordEncrypted: saved.EmailPasswordEncrypted });

    const sent = await emailPost(jsonRequest('/api/notifications/email', { body: mail }, superAdmin));
    expect(await sent.json()).toEqual({ sent: true, simulated: false, transport: 'smtp' });
    expect(smtpSend).toHaveBeenCalledWith(
      { host: 'smtp.office365.com', port: 465, username: 'council@kofc.org', password: PASSWORD },
      expect.objectContaining({ from: 'council@kofc.org', replyTo: 'noreply@kofc.org', to: 'luke@example.org' }),
    );

    // Nobody signed in: still only logged, gateway or not.
    smtpSend.mockClear();
    expect(await (await emailPost(jsonRequest('/api/notifications/email', { body: mail }))).json()).toEqual({ sent: false, simulated: true });
    expect(smtpSend).not.toHaveBeenCalled();

    smtpSend.mockRejectedValueOnce(new Error('535 bad credentials'));
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await emailPost(jsonRequest('/api/notifications/email', { body: mail }, superAdmin))).status).toBe(502);
    expect(String(error.mock.calls[0])).not.toContain(PASSWORD);

    expect(await (await gatewayPost(jsonRequest('/api/councils/email-gateway', { councilId, clear: true }, superAdmin))).json()).toEqual({ settings: null });
    smtpSend.mockClear();
    expect(await (await emailPost(jsonRequest('/api/notifications/email', { body: mail }, superAdmin))).json()).toEqual({ sent: false, simulated: true });
    expect(smtpSend).not.toHaveBeenCalled();
  });
});
