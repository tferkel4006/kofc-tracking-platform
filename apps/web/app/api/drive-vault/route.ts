// POST /api/drive-vault - the portal's file ingestion route for the Google Drive archival vault (Sprint 6D).
// Takes multipart form data { kind: 'minutes' | 'voucher' | 'media', file }, files it under
// Fraternal Enterprise Suite / Minutes | Vouchers | Media in the council's shared drive and answers { fileId }.
// The screen then stores only that id in the record's link column.
//
// The Drive credentials live here on the server (services/google-drive.ts), never in the browser bundle.
//
// LIVE UPLOADS ARE OPT-IN. Like the Alchemer route, the portal has no server-side sessions yet, so this route cannot
// tell whether the caller is really a signed-in Admin; the Admin check happens only in the browser. Left open, anyone
// who can reach the server could write files into the council's shared drive. Uploads therefore go to Drive only when
// the credentials are set AND DRIVE_VAULT_LIVE=1; otherwise the route answers 503 { archived: false } and the screen
// keeps the file as it did before Sprint 6D (a browser blob link). Turn DRIVE_VAULT_LIVE on only behind an
// authenticating proxy, or once the remote driver brings server sessions.
import { NextResponse } from 'next/server';
import { assertDriveVaultUpload, describeError } from '@kofc/shared';
import { driveCredentialsFromEnv, GoogleDriveVault } from '@/services/google-drive';

let vault: GoogleDriveVault | null = null;

export async function POST(req: Request) {
  let kind;
  let file: File;
  try {
    const form = await req.formData();
    const entry = form.get('file');
    if (!(entry instanceof File)) throw new Error('Attach the file as "file".');
    file = entry;
    kind = assertDriveVaultUpload({ kind: form.get('kind'), name: file.name, mimeType: file.type || 'application/octet-stream', size: file.size });
  } catch (err) {
    return NextResponse.json({ archived: false, message: describeError(err) }, { status: 400 });
  }

  const creds = driveCredentialsFromEnv();
  if (!creds || process.env.DRIVE_VAULT_LIVE !== '1') {
    return NextResponse.json(
      { archived: false, message: creds ? 'The Drive vault is configured but DRIVE_VAULT_LIVE is not on.' : 'The Drive vault is not configured.' },
      { status: 503 },
    );
  }

  try {
    vault ??= new GoogleDriveVault(creds);
    const fileId = await vault.upload(kind, { name: file.name, mimeType: file.type, data: new Uint8Array(await file.arrayBuffer()) });
    return NextResponse.json({ archived: true, fileId });
  } catch (err) {
    console.error('[drive-vault] upload failed:', describeError(err));
    return NextResponse.json({ archived: false, message: 'Google Drive did not accept the file. Try again later.' }, { status: 502 });
  }
}
