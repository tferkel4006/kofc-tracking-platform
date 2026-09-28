'use client';
// A member's round avatar: their ProfilePhotoURL when the portal can show it, otherwise their initials on navy with
// a gold ring. The initials are live text, so they stay sharp at any size and pixel density.
import { cx } from '@/components/ui';
import { photoSrc } from '@/lib/media';

export const initialsOf = (first: string, last: string): string => `${first.trim().charAt(0)}${last.trim().charAt(0)}`.toUpperCase() || '?';

export function MemberAvatar({
  photoUrl,
  firstName,
  lastName,
  size,
  className,
}: {
  photoUrl: string | null | undefined;
  firstName: string;
  lastName: string;
  /** Rendered width and height in CSS pixels. */
  size: number;
  className?: string;
}) {
  const src = photoUrl ? photoSrc(photoUrl) : null;
  const box = { width: size, height: size };
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element -- local blob or /media path, not an optimisable asset
    return <img src={src} alt="" style={box} className={cx('shrink-0 rounded-full border-2 border-gold object-cover', className)} />;
  }
  return (
    <span
      aria-hidden="true"
      style={{ ...box, fontSize: Math.round(size * 0.4) }}
      className={cx('inline-flex shrink-0 select-none items-center justify-center rounded-full border-2 border-gold bg-navy font-serif font-bold text-white', className)}
    >
      {initialsOf(firstName, lastName)}
    </span>
  );
}
