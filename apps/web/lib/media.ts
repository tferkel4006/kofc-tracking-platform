/**
 * The image source for a stored photo reference. Links (blob:, http(s):, data:) are used as they are; a plain
 * relative path such as "events/12/picnic.jpg" is served from the portal's /media folder (apps/web/public/media).
 * A phone's file:// path only exists on that phone, so the gallery shows a placeholder for it instead.
 */
export function photoSrc(path: string): string | null {
  if (/^(blob:|https?:|data:)/i.test(path)) return path;
  if (/^(file|content|ph|assets-library):/i.test(path)) return null;
  return `/media/${path.replace(/^\/+/, '').split('/').map(encodeURIComponent).join('/')}`;
}

/** The last segment of a photo path, for captions and placeholders. */
export const photoName = (path: string): string => decodeURIComponent(path.split(/[/\\]/).pop() || path);
