// Native camera capture (expo-image-picker) into the app's media folder (expo-file-system).
// The camera hands back a temporary cache file; it is copied into <documents>/media so the path the
// data layer stores (Event.PhotoGalleryURL, Donation.DonationPhotoURL) keeps pointing at a real file.
import { useState } from 'react';
import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { describeError } from './use-async';

/** Folder under the app's documents directory that holds every captured photo. */
export const MEDIA_FOLDER = 'media';

/** Copies a captured file into the media folder as `<prefix>-<timestamp>.<ext>` and resolves to its file:// URI. */
export async function saveToMediaFolder(sourceUri: string, prefix: string): Promise<string> {
  const folder = new Directory(Paths.document, MEDIA_FOLDER);
  folder.create({ intermediates: true, idempotent: true });
  const extension = (/\.([a-z0-9]+)$/i.exec(sourceUri)?.[1] ?? 'jpg').toLowerCase();
  // No commas: the event gallery stores its paths comma-separated.
  const safePrefix = prefix.replace(/[^a-z0-9-]+/gi, '-');
  const target = new File(folder, `${safePrefix}-${Date.now()}.${extension}`);
  await new File(sourceUri).copy(target);
  return target.uri;
}

/**
 * Opens the phone's camera (asking for permission the first time) and saves the photo into the media folder.
 * Resolves to its file:// URI, or null when the member cancels.
 */
export async function capturePhoto(prefix: string): Promise<string | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Camera access is turned off for KofC Tracker. Allow it in your phone settings, then try again.');
  }
  const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8, exif: false });
  if (result.canceled || result.assets.length === 0) return null;
  return saveToMediaFolder(result.assets[0].uri, prefix);
}

/**
 * State for a capture button: `capture()` takes a photo, saves it and hands the stored path to `onCaptured`
 * (which records it, e.g. events.uploadPhotos with the signed-in member as actorId). Failures land in `error`.
 */
export function usePhotoCapture(prefix: string, onCaptured: (path: string) => Promise<void> | void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const capture = async () => {
    setBusy(true);
    setError(null);
    try {
      const path = await capturePhoto(prefix);
      if (path) await onCaptured(path);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  return { capture, busy, error, clearError: () => setError(null) };
}
