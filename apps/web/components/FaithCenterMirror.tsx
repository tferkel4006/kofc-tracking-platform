'use client';
// Faith Center mirror (Sprint 6L Extension): a small desktop widget that shows what the phone app's Faith Center shows
// today - the feast or saint (liturgicalBanner), the Holy Day of Obligation badge, and the day's verse (dailyVerse, NABRE
// only, with its notice) - and links to the Visual Master Calendar, whose "All" filter lists the coming observances.
// Like the phone's Faith Center it is a Knights of Columbus extension, so a white-label tenant sees nothing.
import Link from 'next/link';
import { dailyVerse, HOLY_DAY_BADGE, isFraternalTenant, liturgicalBanner, NABRE_NOTICE, toIsoDate } from '@kofc/shared';
import { useTenantType } from '@/lib/session';

export function FaithCenterMirror() {
  const tenant = useTenantType();
  if (!isFraternalTenant(tenant)) return null;
  const today = toIsoDate(new Date());
  const banner = liturgicalBanner(today);
  const verse = dailyVerse(today);
  return (
    <aside aria-labelledby="faith-center-mirror" className="rounded border-2 border-navy bg-white p-4 text-navy">
      <h2 id="faith-center-mirror" className="mb-2 font-serif text-lg font-bold">
        <span aria-hidden="true">🙏 </span>Faith Center
      </h2>
      <p className="font-bold">{banner.text}</p>
      {banner.holyDayOfObligation ? <p className="mt-1 inline-block rounded bg-crimson px-2 py-0.5 text-sm font-bold text-white">{HOLY_DAY_BADGE}</p> : null}
      <blockquote className="mt-3 border-l-8 border-gold pl-3">
        <p>{verse.text}</p>
        <p className="mt-1 text-sm font-bold">{verse.reference}</p>
      </blockquote>
      <p className="mt-2 text-xs text-muted">{NABRE_NOTICE}</p>
      <p className="mt-3 text-sm">
        <Link href="/calendar" className="font-bold underline">
          Open the feasts and holy days on the calendar
        </Link>{' '}
        · the same Faith Center is on the phone app&apos;s 🙏 button.
      </p>
    </aside>
  );
}
