// POST /api/drive-vault - the portal's file ingestion route for the Google Drive archival vault (Sprint 6D).
// Takes multipart form data { kind: 'minutes' | 'voucher' | 'media' | 'flyer', file, folder? }, files it under
// Fraternal Enterprise Suite / Minutes | Vouchers | Media | Flyers in the council's shared drive and answers { fileId }.
// Sprint 6C: a media upload may name its event's folder (`folder`, the event name), filing it under Media / <event name>.
// The screen then stores only that id in the record's link column.
//
// The Drive credentials live only on the server (services/server/secrets.ts), never in the browser bundle.
//
// Sprint 6Z-Engine-Upgrade: the route now checks the caller's portal session (services/server/session.ts) BEFORE it
// reads the form: 401 without a session, 403 unless the session is an Active Admin or Super Admin (the same members
// whose uploads the screens send here). Live uploads still need the credentials AND DRIVE_VAULT_LIVE=1; otherwise the
// route answers 503 { archived: false } and the screen keeps the file as a browser blob link.
import { NextResponse } from 'next/server';
import { assertDriveVaultUpload, cleanDriveVaultSubfolder, describeError, hasAdminRights } from '@kofc/shared';
import { GoogleDriveVault } from '@/services/google-drive';
import { driveVaultOffReason, liveDriveCredentials } from '@/services/server/secrets';
import { requirePortalSession } from '@/services/server/session';

let vault: GoogleDriveVault | null = null;

export async function POST(req: Request) {
  const session = await requirePortalSession(req, hasAdminRights, { archived: false });
  if ('denied' in session) return session.denied;

  let kind;
  let file: File;
  let folder: string | null;
  try {
    const form = await req.formData();
    const entry = form.get('file');
    if (!(entry instanceof File)) throw new Error('Attach the file as "file".');
    file = entry;
    kind = assertDriveVaultUpload({ kind: form.get('kind'), name: file.name, mimeType: file.type || 'application/octet-stream', size: file.size });
    folder = kind === 'media' ? cleanDriveVaultSubfolder(form.get('folder')) : null;
  } catch (err) {
    return NextResponse.json({ archived: false, message: describeError(err) }, { status: 400 });
  }

  const creds = liveDriveCredentials();
  if (!creds) return NextResponse.json({ archived: false, message: driveVaultOffReason() }, { status: 503 });

  try {
    vault ??= new GoogleDriveVault(creds);
    const fileId = await vault.upload(kind, { name: file.name, mimeType: file.type, data: new Uint8Array(await file.arrayBuffer()) }, folder);
    console.log(`[drive-vault] member ${session.claims.memberId} filed a ${kind} upload: ${fileId}`);
    return NextResponse.json({ archived: true, fileId });
  } catch (err) {
    console.error('[drive-vault] upload failed:', describeError(err));
    return NextResponse.json({ archived: false, message: 'Google Drive did not accept the file. Try again later.' }, { status: 502 });
  }
}
