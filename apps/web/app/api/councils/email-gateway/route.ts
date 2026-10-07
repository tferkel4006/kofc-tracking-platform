// POST /api/councils/email-gateway - saves a council's outbound email gateway (Sprint 6Z-Email-Proxy).
//
//   { councilId, EmailProvider, SmtpHost, SmtpPort, SmtpUsername, password? }  saves the gateway
//   { councilId, clear: true }                                               removes it
//
// Answers { settings } - the five Council columns with the password SEALED (services/server/email-gateway.ts) - or
// { settings: null } after a clear. The Councils page then stores the same values through its own data driver, so the
// password itself never reaches a driver, a log or the browser again.
//
// Only the portal session of an Active Admin of that council or an Active Super Admin may (Sprint 6Z-Admin-Email-Perms;
// 401 without a session, 403 otherwise), the assertMayMaintainCouncilRecords rule councils.setEmailGateway applies.
// The server keeps the gateway in its own data copy (session.ts), which the notification route reads at send time.
// Leaving the password out keeps the saved one, but only while the host and username stay the same.
import { NextResponse } from 'next/server';
import { assertMayMaintainCouncilRecords, councilEmailGateway, describeError } from '@kofc/shared';
import { sealSmtpPassword } from '@/services/server/email-gateway';
import { memberDirectory, requirePortalSession } from '@/services/server/session';

export async function POST(req: Request) {
  const payload = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const councilId = payload?.councilId;
  if (typeof councilId !== 'number' || !Number.isInteger(councilId) || councilId <= 0) {
    return NextResponse.json({ message: 'Name the council as councilId.' }, { status: 400 });
  }
  const session = await requirePortalSession(req, (actor) => {
    try {
      assertMayMaintainCouncilRecords(actor, councilId, 'configure the email gateway');
      return true;
    } catch {
      return false;
    }
  });
  if ('denied' in session) return session.denied;

  try {
    const db = await memberDirectory();
    if (payload?.clear === true) {
      await db.councils.setEmailGateway(session.claims.memberId, councilId, null);
      return NextResponse.json({ settings: null });
    }

    const host = typeof payload?.SmtpHost === 'string' ? payload.SmtpHost.trim().toLowerCase() : '';
    const username = typeof payload?.SmtpUsername === 'string' ? payload.SmtpUsername.trim() : '';
    const password = typeof payload?.password === 'string' ? payload.password : '';
    let sealed: string;
    if (password) {
      sealed = sealSmtpPassword(password, councilId);
    } else {
      const saved = councilEmailGateway(await db.councils.get(councilId));
      if (!saved || saved.SmtpHost !== host || saved.SmtpUsername !== username) {
        return NextResponse.json({ message: 'Enter the SMTP password. A new host or username needs it again.' }, { status: 400 });
      }
      sealed = saved.EmailPasswordEncrypted;
    }

    const council = await db.councils.setEmailGateway(session.claims.memberId, councilId, {
      EmailProvider: payload?.EmailProvider as never,
      SmtpHost: host,
      SmtpPort: payload?.SmtpPort as number,
      SmtpUsername: username,
      EmailPasswordEncrypted: sealed,
    });
    return NextResponse.json({ settings: councilEmailGateway(council) });
  } catch (err) {
    const status = (err as { code?: string }).code === 'RECORD_NOT_FOUND' ? 404 : 400;
    return NextResponse.json({ message: describeError(err) }, { status });
  }
}
