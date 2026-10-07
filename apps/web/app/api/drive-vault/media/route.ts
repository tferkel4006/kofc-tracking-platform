// GET /api/drive-vault/media?folder=<past event name> - the Marketing Factory's historical photo scan (Sprint 6C).
// Answers { available: true, fileIds } with up to FLYER_MAX_PHOTOS image ids filed under
// Fraternal Enterprise Suite / Media / <past event name> in the council's shared drive (an empty list when the folder
// does not exist; nothing is created). The page shows them through Drive's thumbnail service, so the viewer's own
// Google account still decides whether each image opens.
//
// Like the upload route this is OPT-IN: with no server-side sessions the route cannot tell who is asking, so it reads the
// drive only when the credentials are set AND DRIVE_VAULT_LIVE=1. Otherwise it answers 503 { available: false } and the
// factory falls back to the photos saved on past editions, then to the event-type icon.
import { NextResponse } from 'next/server';
import { cleanDriveVaultSubfolder, describeError, DRIVE_VAULT_FOLDERS, DRIVE_VAULT_ROOT, FLYER_MAX_PHOTOS } from '@kofc/shared';
import { driveCredentialsFromEnv, GoogleDriveVault } from '@/services/google-drive';

let vault: GoogleDriveVault | null = null;

export async function GET(req: Request) {
  let folder: string | null;
  try {
    folder = cleanDriveVaultSubfolder(new URL(req.url).searchParams.get('folder'));
    if (!folder) throw new Error('Name the past event folder as ?folder=.');
  } catch (err) {
    return NextResponse.json({ available: false, message: describeError(err) }, { status: 400 });
  }

  const creds = driveCredentialsFromEnv();
  if (!creds || process.env.DRIVE_VAULT_LIVE !== '1') {
    return NextResponse.json({ available: false, message: 'The Drive vault is not switched on.' }, { status: 503 });
  }

  try {
    vault ??= new GoogleDriveVault(creds);
    const fileIds = await vault.listImages([DRIVE_VAULT_ROOT, DRIVE_VAULT_FOLDERS.media, folder], FLYER_MAX_PHOTOS);
    return NextResponse.json({ available: true, fileIds });
  } catch (err) {
    console.error('[drive-vault] media scan failed:', describeError(err));
    return NextResponse.json({ available: false, message: 'Google Drive did not answer. Try again later.' }, { status: 502 });
  }
}
