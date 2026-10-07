// POST /api/supreme/roster { councilId, csv } - reads Supreme Headquarters' roster export on the server
// (Sprint 6Z-Engine-Upgrade) and answers { rows } (SupremeRosterRow values) for supreme.syncSupremeRoster.
//
// Only a portal session that may bring in the council's roster gets an answer: an Active Admin of that council or a
// Super Admin (assertMayImportSupremeRoster; 401 without a session, 403 otherwise). The Supreme Sync page's preview still
// reads the file in the browser as it is typed; the rows it syncs are the ones this route returns.
import { NextResponse } from 'next/server';
import { assertMayImportSupremeRoster, describeError, parseSupremeRosterCsv } from '@kofc/shared';
import { requirePortalSession } from '@/services/server/session';

/** Largest roster export accepted (about 20,000 members). */
const MAX_ROSTER_BYTES = 4 * 1024 * 1024;

export async function POST(req: Request) {
  const payload = (await req.json().catch(() => null)) as { councilId?: unknown; csv?: unknown } | null;
  const councilId = payload?.councilId;
  if (typeof councilId !== 'number' || !Number.isInteger(councilId) || councilId <= 0) {
    return NextResponse.json({ message: 'Name the council as councilId.' }, { status: 400 });
  }
  const session = await requirePortalSession(req, (actor) => {
    try {
      assertMayImportSupremeRoster(actor, councilId);
      return true;
    } catch {
      return false;
    }
  });
  if ('denied' in session) return session.denied;

  if (typeof payload?.csv === 'string' && payload.csv.length > MAX_ROSTER_BYTES) {
    return NextResponse.json({ message: 'The roster file is larger than 4 MB.' }, { status: 413 });
  }
  try {
    return NextResponse.json({ rows: parseSupremeRosterCsv(payload?.csv) });
  } catch (err) {
    return NextResponse.json({ message: describeError(err) }, { status: 400 });
  }
}
