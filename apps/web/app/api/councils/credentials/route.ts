// /api/councils/credentials - a council's rows in the Centralized Encrypted Credentials Vault (Sprint 6Y).
//
//   GET  ?councilId=N                                        lists what is saved, masked
//   POST { councilId, credentialKey, value }                 seals and saves one credential
//   POST { councilId, credentialKey, clear: true }           deletes it
//
// Every answer is { credentials: CredentialStatus[] }: the key, when it was saved and REDACTED_SECRET. A value goes in
// once and never comes back out, plain or sealed. SMTP_OUTBOUND_PASSWORD is saved with its host and username through
// /api/councils/email-gateway instead, so it is refused here; GOOGLE_DRIVE_PRIVATE_KEY is the key this route writes.
//
// Only the portal session of an Active Admin of that council or an Active Super Admin may (401 without a session, 403
// otherwise) - the assertMayMaintainCouncilRecords rule of the email gateway.
import { NextResponse } from 'next/server';
import { assertMayMaintainCouncilRecords, describeError, isCredentialKey, type CredentialKey } from '@kofc/shared';
import { credentialsVault } from '@/services/server/credentials-vault';
import { memberDirectory, requirePortalSession } from '@/services/server/session';

/** Keys saved through their own route, alongside the settings they belong with. */
const OWN_ROUTE: Partial<Record<CredentialKey, string>> = { SMTP_OUTBOUND_PASSWORD: '/api/councils/email-gateway' };

const councilIdOf = (value: unknown): number | null => {
  const id = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  return typeof id === 'number' && Number.isInteger(id) && id > 0 ? id : null;
};

const mayMaintain = (councilId: number) => (actor: Parameters<typeof assertMayMaintainCouncilRecords>[0]) => {
  try {
    assertMayMaintainCouncilRecords(actor, councilId, "manage the council's saved credentials");
    return true;
  } catch {
    return false;
  }
};

const listing = (councilId: number) => NextResponse.json({ credentials: credentialsVault().status(councilId) });

export async function GET(req: Request) {
  const councilId = councilIdOf(new URL(req.url).searchParams.get('councilId'));
  if (councilId === null) return NextResponse.json({ message: 'Name the council as ?councilId=.' }, { status: 400 });
  const session = await requirePortalSession(req, mayMaintain(councilId));
  if ('denied' in session) return session.denied;
  return listing(councilId);
}

export async function POST(req: Request) {
  const payload = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const councilId = typeof payload?.councilId === 'number' ? councilIdOf(payload.councilId) : null;
  if (councilId === null) return NextResponse.json({ message: 'Name the council as councilId.' }, { status: 400 });
  const session = await requirePortalSession(req, mayMaintain(councilId));
  if ('denied' in session) return session.denied;

  const key = payload?.credentialKey;
  if (!isCredentialKey(key)) return NextResponse.json({ message: 'Name a known credential as credentialKey.' }, { status: 400 });
  if (OWN_ROUTE[key]) return NextResponse.json({ message: `Save ${key} through ${OWN_ROUTE[key]}.` }, { status: 400 });
  if ((await (await memberDirectory()).councils.get(councilId)) === null) {
    return NextResponse.json({ message: `Council ${councilId} does not exist.` }, { status: 404 });
  }

  try {
    if (payload?.clear === true) credentialsVault().remove(councilId, key);
    else credentialsVault().put(councilId, key, payload?.value);
    return listing(councilId);
  } catch (err) {
    return NextResponse.json({ message: describeError(err) }, { status: 400 });
  }
}
