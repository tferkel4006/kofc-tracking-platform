// /api/marketing/copilot - the GYST Co-Pilot (Sprint 6L Extension 2).
//
//   GET                                              { connected } - whether the council has saved its agent's key
//   POST { request, councilName, event? }            { reply } - the agent's answer
//
// The request is checked (cleanCopilotPrompt), wrapped with the event's facts and the council's voice rules
// (buildCollateralPrompt), and sent to the council's Microsoft Copilot Studio agent by services/marketing/copilot-gateway.
// Only the portal session of a member who may open the Marketing Factory (Admins, Super Admins, seated officers) may call
// it (401 without a session, 403 otherwise). The session's own council is the one whose key is used.
import { NextResponse } from 'next/server';
import { buildCollateralPrompt, canOpenMarketingFactory, cleanCopilotPrompt, describeError } from '@kofc/shared';
import { askCopilotStudio, copilotConnected, CopilotGatewayError } from '@/services/marketing/copilot-gateway';
import { requirePortalSession } from '@/services/server/session';

const mayUse = (_actor: unknown, claims: Parameters<typeof canOpenMarketingFactory>[0]) => canOpenMarketingFactory(claims);

/** A short plain-text field from the request body, or ''. */
const text = (value: unknown, max: number): string => (typeof value === 'string' ? value.trim().slice(0, max) : '');

export async function GET(req: Request) {
  const session = await requirePortalSession(req, mayUse, { connected: false });
  if ('denied' in session) return session.denied;
  return NextResponse.json({ connected: copilotConnected(session.claims.councilId) });
}

export async function POST(req: Request) {
  const session = await requirePortalSession(req, mayUse);
  if ('denied' in session) return session.denied;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;

  let prompt: string;
  try {
    const event = (body?.event ?? null) as Record<string, unknown> | null;
    prompt = buildCollateralPrompt({
      request: cleanCopilotPrompt(body?.request),
      councilName: text(body?.councilName, 200),
      event:
        event && text(event.EventName, 200)
          ? {
              EventName: text(event.EventName, 200),
              EventDescription: text(event.EventDescription, 2000),
              StartDate: text(event.StartDate, 30),
              EndDate: text(event.EndDate, 30) || text(event.StartDate, 30),
              Location: text(event.Location, 300),
            }
          : null,
    });
  } catch (err) {
    return NextResponse.json({ message: describeError(err) }, { status: 400 });
  }

  try {
    const reply = await askCopilotStudio(session.claims.councilId, `kofc-member-${session.claims.memberId}`, prompt);
    return NextResponse.json({ reply });
  } catch (err) {
    if (err instanceof CopilotGatewayError) return NextResponse.json({ message: err.message }, { status: err.status });
    console.error('[copilot] request failed:', describeError(err));
    return NextResponse.json({ message: 'The GYST Co-Pilot failed. Try again later.' }, { status: 502 });
  }
}
