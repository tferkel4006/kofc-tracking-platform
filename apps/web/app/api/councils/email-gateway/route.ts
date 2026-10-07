// /api/councils/email-gateway - a council's outbound email gateway (Sprint 6Z-Email-Proxy; Sprint 6Y vault).
//
//   POST { councilId, EmailProvider, SmtpHost, SmtpPort, SmtpUsername, password? }  saves the gateway
//   POST { councilId, clear: true }                                               removes it and its password
//   GET  ?councilId=N                                                             reads it
//
// Every answer is { settings, password } - the four Council columns (or null) and the masked CredentialStatus of the
// council's SMTP_OUTBOUND_PASSWORD (or null). Sprint 6Y: the password goes straight into the Centralized Encrypted
// Credentials Vault (services/server/credentials-vault.ts), which seals it with AES-256-GCM; neither the password nor its
// sealed form is ever answered, so neither reaches the browser. The panel then stores the four columns through its own
// data driver.
//
// Only the portal session of an Active Admin of that council or an Active Super Admin may (Sprint 6Z-Admin-Email-Perms;
// 401 without a session, 403 otherwise), the assertMayMaintainCouncilRecords rule councils.setEmailGateway applies.
// The server keeps the four columns in its own data copy (session.ts), which the notification route reads at send time.
// Leaving the password out keeps the saved one, but only while the host and username stay the same.
import { NextResponse } from 'next/server';
import { assertMayMaintainCouncilRecords, cleanCredentialValue, councilEmailGateway, describeError, type CredentialStatus, type EmailGatewaySettings } from '@kofc/shared';
import { credentialsVault } from '@/services/server/credentials-vault';
import { memberDirectory, requirePortalSession } from '@/services/server/session';

const PASSWORD_KEY = 'SMTP_OUTBOUND_PASSWORD';

const councilIdOf = (value: unknown): number | null => {
  const id = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  return typeof id === 'number' && Number.isInteger(id) && id > 0 ? id : null;
};

const mayConfigure = (councilId: number) => (actor: Parameters<typeof assertMayMaintainCouncilRecords>[0]) => {
  try {
    assertMayMaintainCouncilRecords(actor, councilId, 'configure the email gateway');
    return true;
  } catch {
    return false;
  }
};

const answer = (settings: EmailGatewaySettings | null, councilId: number) =>
  NextResponse.json({ settings, password: credentialsVault().statusOf(councilId, PASSWORD_KEY) satisfies CredentialStatus | null });

export async function GET(req: Request) {
  const councilId = councilIdOf(new URL(req.url).searchParams.get('councilId'));
  if (councilId === null) return NextResponse.json({ message: 'Name the council as ?councilId=.' }, { status: 400 });
  const session = await requirePortalSession(req, mayConfigure(councilId));
  if ('denied' in session) return session.denied;
  return answer(councilEmailGateway(await (await memberDirectory()).councils.get(councilId)), councilId);
}

export async function POST(req: Request) {
  const payload = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const councilId = councilIdOf(payload?.councilId);
  if (councilId === null || typeof payload?.councilId !== 'number') {
    return NextResponse.json({ message: 'Name the council as councilId.' }, { status: 400 });
  }
  const session = await requirePortalSession(req, mayConfigure(councilId));
  if ('denied' in session) return session.denied;

  const vault = credentialsVault();
  try {
    const db = await memberDirectory();
    if (payload?.clear === true) {
      await db.councils.setEmailGateway(session.claims.memberId, councilId, null);
      vault.remove(councilId, PASSWORD_KEY);
      return answer(null, councilId);
    }

    const host = typeof payload?.SmtpHost === 'string' ? payload.SmtpHost.trim().toLowerCase() : '';
    const username = typeof payload?.SmtpUsername === 'string' ? payload.SmtpUsername.trim() : '';
    const password = typeof payload?.password === 'string' ? payload.password : '';
    if (!password) {
      const saved = councilEmailGateway(await db.councils.get(councilId));
      if (!saved || saved.SmtpHost !== host || saved.SmtpUsername !== username || !vault.has(councilId, PASSWORD_KEY)) {
        return NextResponse.json({ message: 'Enter the SMTP password. A new host or username needs it again.' }, { status: 400 });
      }
    }

    // Both halves are checked before either is written, so a refused password or host changes nothing.
    if (password) cleanCredentialValue(PASSWORD_KEY, password);
    const council = await db.councils.setEmailGateway(session.claims.memberId, councilId, {
      EmailProvider: payload?.EmailProvider as never,
      SmtpHost: host,
      SmtpPort: payload?.SmtpPort as number,
      SmtpUsername: username,
    });
    if (password) vault.put(councilId, PASSWORD_KEY, password);
    return answer(councilEmailGateway(council), councilId);
  } catch (err) {
    const status = (err as { code?: string }).code === 'RECORD_NOT_FOUND' ? 404 : 400;
    return NextResponse.json({ message: describeError(err) }, { status });
  }
}
