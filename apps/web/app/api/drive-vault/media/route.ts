// GET /api/drive-vault/media?folder=<past event name> - the Marketing Factory's historical photo scan (Sprint 6C).
// Answers { available: true, fileIds } with up to FLYER_MAX_PHOTOS image ids filed under
// Fraternal Enterprise Suite / Media / <past event name> in the council's shared drive (an empty list when the folder
// does not exist; nothing is created). The page shows them through Drive's thumbnail service, so the viewer's own
// Google account still decides whether each image opens.
//
// Sprint 6Z-Engine-Upgrade: reading the drive needs a portal session of an Active Admin or Super Admin (401 / 403
// otherwise), and still the credentials AND DRIVE_VAULT_LIVE=1 (503 otherwise). On any refusal the factory falls back to
// the photos saved on past editions, then to the event-type icon. Sprint 6Y: the council's own GOOGLE_DRIVE_PRIVATE_KEY
// from the credentials vault replaces the server's when it has one.
import { NextResponse } from 'next/server';
import { cleanDriveVaultSubfolder, describeError, DRIVE_VAULT_FOLDERS, DRIVE_VAULT_ROOT, FLYER_MAX_PHOTOS, hasAdminRights } from '@kofc/shared';
import { councilDriveCredentials, driveVaultClient } from '@/services/server/credentials-vault';
import { requirePortalSession } from '@/services/server/session';

export async function GET(req: Request) {
  const session = await requirePortalSession(req, hasAdminRights, { available: false });
  if ('denied' in session) return session.denied;

  let folder: string | null;
  try {
    folder = cleanDriveVaultSubfolder(new URL(req.url).searchParams.get('folder'));
    if (!folder) throw new Error('Name the past event folder as ?folder=.');
  } catch (err) {
    return NextResponse.json({ available: false, message: describeError(err) }, { status: 400 });
  }

  const creds = councilDriveCredentials(session.claims.councilId);
  if (!creds) return NextResponse.json({ available: false, message: 'The Drive vault is not switched on.' }, { status: 503 });

  try {
    const fileIds = await driveVaultClient(creds).listImages([DRIVE_VAULT_ROOT, DRIVE_VAULT_FOLDERS.media, folder], FLYER_MAX_PHOTOS);
    return NextResponse.json({ available: true, fileIds });
  } catch (err) {
    console.error('[drive-vault] media scan failed:', describeError(err));
    return NextResponse.json({ available: false, message: 'Google Drive did not answer. Try again later.' }, { status: 502 });
  }
}
