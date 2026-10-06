// In-memory cache for the collection QR codes (Sprint 6A). The bundled codes are 1.7-3.4 MB PNGs, and a council upload
// is a network image, so the first open of a code used to stall while it resolved, downloaded and decoded. This module
// keeps, for as long as the app runs:
//   - each code's resolved image source, so it is worked out once rather than on every open;
//   - which uploads failed to load, so a broken upload goes straight to the bundled code next time instead of failing again;
//   - which images were already prefetched into the platform's image cache.
// The Donate screen warms every channel as it loads (warmCollectionQrs), so the code is ready before the tile is tapped.
import { Image, type ImageSourcePropType } from 'react-native';
import { isLoadableQrUrl } from '@/components/DonationQr';

/** Bundled codes resolved to their file and pixel size, keyed by the bundled module. */
const resolvedBundled = new Map<ImageSourcePropType, ImageSourcePropType>();
const failedUploads = new Set<string>();
const prefetched = new Set<string>();

const prefetch = (uri: string): void => {
  if (prefetched.has(uri) || !/^https?:/i.test(uri)) return;
  prefetched.add(uri);
  // A failed prefetch is not an error: the code then loads (or falls back) when it is shown.
  Image.prefetch(uri).catch(() => prefetched.delete(uri));
};

/** A bundled code's resolved source, worked out (and prefetched where it is served over http) on first use only. */
function bundledSource(fallback: ImageSourcePropType): ImageSourcePropType {
  let source = resolvedBundled.get(fallback);
  if (!source) {
    const asset = Image.resolveAssetSource(fallback);
    source = asset?.uri ? { uri: asset.uri, width: asset.width, height: asset.height } : fallback;
    if (asset?.uri) prefetch(asset.uri);
    resolvedBundled.set(fallback, source);
  }
  return source;
}

/** True when this upload already failed to load during this run of the app. */
export const qrUploadFailed = (url: string | null): boolean => url !== null && failedUploads.has(url.trim());

/** Remembers a failed upload, so later opens show the bundled code at once. */
export const markQrUploadFailed = (url: string | null): void => {
  if (url !== null) failedUploads.add(url.trim());
};

/** The council's upload when it can be shown (and has not failed before), else the bundled code from memory. */
export function cachedQrSource(uploadedUrl: string | null, fallback: ImageSourcePropType): { source: ImageSourcePropType; uploaded: boolean } {
  if (isLoadableQrUrl(uploadedUrl) && !qrUploadFailed(uploadedUrl)) {
    prefetch(uploadedUrl.trim());
    return { source: { uri: uploadedUrl.trim() }, uploaded: true };
  }
  return { source: bundledSource(fallback), uploaded: false };
}

/** Resolves and prefetches every channel's code ahead of the tap. Safe to call on every load; repeats are free. */
export function warmCollectionQrs(channels: readonly { uploadedUrl: string | null; fallback: ImageSourcePropType | null }[]): void {
  for (const { uploadedUrl, fallback } of channels) {
    if (fallback !== null) bundledSource(fallback);
    if (isLoadableQrUrl(uploadedUrl) && !qrUploadFailed(uploadedUrl)) prefetch(uploadedUrl.trim());
  }
}
