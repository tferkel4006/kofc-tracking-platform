// POST /api/notifications/email - where the web driver sends welcome and password-reset email (Sprint 6Z-Engine-Upgrade).
// Takes the body of a SendGrid v3 mail/send request (one recipient) and answers { sent, simulated }.
//
// The SendGrid key lives only on the server (services/server/secrets.ts: SENDGRID_API_KEY). The browser builds the
// request with the placeholder key; this route rebuilds it with buildSendGridMailRequest, so neither the key nor the URL
// ever comes from the client.
//
// LIVE SENDING NEEDS ALL THREE: SENDGRID_API_KEY, SENDGRID_LIVE=1, and a portal session of an Active Admin or Super Admin
// (the members who add members and resend setup codes). Anything else - no key, a member's own password reset, nobody
// signed in - is logged with the key redacted, as before. A route that mailed whatever any caller sent would let anyone
// send mail as the council, and the reset email is composed in the browser until the remote driver moves it here.
//
// Sprint 6Z-Email-Proxy: when the session's council has its own email gateway (all four Council gateway columns, in the
// server's data copy) and a saved SMTP_OUTBOUND_PASSWORD in the credentials vault (Sprint 6Y), an Admin's email goes out
// through that SMTP server instead, with the password unsealed only here, and SendGrid is not used. The same Admin rule
// applies; everyone else is still only logged.
import { NextResponse } from 'next/server';
import { buildSendGridMailRequest, councilEmailGateway, describeError, hasAdminRights, logSendGridRequest, type EmailPayload } from '@kofc/shared';
import { credentialsVault } from '@/services/server/credentials-vault';
import { liveSendGridKey } from '@/services/server/secrets';
import { memberDirectory, readPortalSession } from '@/services/server/session';
import { sessionActor } from '@/services/server/session-token';
import { sendSmtpMail, smtpMessageFor } from '@/services/server/smtp';

const MAX_SUBJECT = 200;
const MAX_TEXT = 20_000;
const MAX_ATTACHMENTS = 3;
const MAX_ATTACHMENT_BASE64 = 1_000_000;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function fail(message: string): never {
  throw new Error(message);
}

/** The mail/send body back as one EmailPayload, refusing anything but a single plain-text message to one address. */
function cleanEmail(body: unknown): EmailPayload {
  const b = (body ?? {}) as Record<string, unknown>;
  const personalizations = b.personalizations as { to?: { email?: unknown }[] }[] | undefined;
  if (!Array.isArray(personalizations) || personalizations.length !== 1) fail('Send exactly one personalization.');
  const to = personalizations[0]?.to;
  if (!Array.isArray(to) || to.length !== 1 || typeof to[0]?.email !== 'string' || !EMAIL.test(to[0].email)) fail('Send exactly one recipient address.');
  const from = (b.from as { email?: unknown } | undefined)?.email;
  if (typeof from !== 'string' || !EMAIL.test(from)) fail('The sender address is not valid.');
  if (typeof b.subject !== 'string' || !b.subject.trim() || b.subject.length > MAX_SUBJECT) fail('The subject is missing or too long.');
  const content = b.content as { type?: unknown; value?: unknown }[] | undefined;
  if (!Array.isArray(content) || content.length !== 1 || content[0]?.type !== 'text/plain' || typeof content[0].value !== 'string' || content[0].value.length > MAX_TEXT) {
    fail('Send one plain-text body.');
  }
  const raw = b.attachments === undefined ? [] : b.attachments;
  if (!Array.isArray(raw) || raw.length > MAX_ATTACHMENTS) fail('Too many attachments.');
  const attachments = raw.map((a: { content?: unknown; filename?: unknown; type?: unknown }) => {
    if (typeof a?.content !== 'string' || a.content.length > MAX_ATTACHMENT_BASE64 || typeof a.filename !== 'string' || typeof a.type !== 'string') fail('An attachment is not valid.');
    return { filename: a.filename, contentType: a.type, content: Buffer.from(a.content, 'base64').toString('utf8') };
  });
  return { to: to[0].email, from, subject: b.subject, text: content[0].value as string, attachments };
}

export async function POST(req: Request) {
  let email: EmailPayload;
  try {
    email = cleanEmail(((await req.json().catch(() => null)) as { body?: unknown } | null)?.body);
  } catch (err) {
    return NextResponse.json({ sent: false, message: describeError(err) }, { status: 400 });
  }

  const claims = await readPortalSession(req);
  const mayGoLive = claims !== null && hasAdminRights(sessionActor(claims));

  const vault = credentialsVault();
  const gateway = mayGoLive ? councilEmailGateway(await (await memberDirectory()).councils.get(claims.councilId)) : null;
  if (claims && gateway && vault.has(claims.councilId, 'SMTP_OUTBOUND_PASSWORD')) {
    const password = vault.reveal(claims.councilId, 'SMTP_OUTBOUND_PASSWORD');
    if (password === null) {
      return NextResponse.json(
        { sent: false, simulated: false, message: "The council's SMTP password could not be unsealed. An Admin must enter it again in the Outbound Email Gateway tab." },
        { status: 502 },
      );
    }
    try {
      await sendSmtpMail({ host: gateway.SmtpHost, port: gateway.SmtpPort, username: gateway.SmtpUsername, password }, smtpMessageFor(email, gateway.SmtpUsername));
      return NextResponse.json({ sent: true, simulated: false, transport: 'smtp' });
    } catch (err) {
      console.error(`[notification] SMTP send through ${gateway.SmtpHost}:${gateway.SmtpPort} failed:`, describeError(err));
      return NextResponse.json({ sent: false, simulated: false, message: `${gateway.SmtpHost} did not accept the email.` }, { status: 502 });
    }
  }

  const key = liveSendGridKey();
  if (!key || !mayGoLive) {
    await logSendGridRequest(console.log)(buildSendGridMailRequest(email));
    return NextResponse.json({ sent: false, simulated: true });
  }

  const request = buildSendGridMailRequest(email, key);
  try {
    const res = await fetch(request.url, { method: request.method, headers: request.headers, body: JSON.stringify(request.body) });
    if (!res.ok) throw new Error(`SendGrid answered HTTP ${res.status}.`);
    return NextResponse.json({ sent: true, simulated: false, transport: 'sendgrid' });
  } catch (err) {
    console.error('[notification] SendGrid send failed:', describeError(err));
    return NextResponse.json({ sent: false, simulated: false, message: 'SendGrid did not accept the email.' }, { status: 502 });
  }
}
