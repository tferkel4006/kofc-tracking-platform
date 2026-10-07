// How the Supreme Sync page reads Supreme's roster export before syncing it (Sprint 6Z-Engine-Upgrade): on the server
// (app/api/supreme/roster), which first checks the caller's portal session is an Admin of the council or a Super Admin.
import { BusinessRuleError, type SupremeRosterRow } from '@kofc/shared';

export const SUPREME_ROSTER_ROUTE = '/api/supreme/roster';

/** The roster rows as the server read them. A refusal (no session, not an Admin, a bad file) throws its message. */
export async function readRosterOnServer(councilId: number, csv: string): Promise<SupremeRosterRow[]> {
  const res = await fetch(SUPREME_ROSTER_ROUTE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ councilId, csv }),
  }).catch(() => null);
  const body = (await res?.json().catch(() => null)) as { rows?: SupremeRosterRow[]; message?: string } | null;
  if (res?.ok && Array.isArray(body?.rows)) return body.rows;
  if (res?.status === 401 || res?.status === 403) throw new BusinessRuleError('ADMIN_REQUIRED', body?.message ?? 'Sign in again as a council Admin.');
  throw new BusinessRuleError('INVALID_INPUT', body?.message ?? 'The server could not read the roster file. Try again.');
}
