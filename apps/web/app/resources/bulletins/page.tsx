'use client';
// Bulletins (Sprint 6Z): a card wall of the council's files already filed in Google Drive - meeting flyers and minutes
// (Meeting.GoogleDriveFlyerURL, GoogleDriveMinutesURL, or a Drive vault id in MinutesURL) and event photo albums
// (Event.PhotoGalleryURL) - newest first (bulletinCards). Each card opens the file in Google Drive in a new tab;
// Drive's own sharing settings still decide who can open it. Open to every member of the council.
import { useState } from 'react';
import { bulletinCards, type BulletinKind } from '@kofc/shared';
import { RequireArea } from '@/components/CouncilScope';
import { cx, Empty, Notice, PageTitle, Pill } from '@/components/ui';
import { formatFullDate } from '@/lib/format';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

const KINDS: readonly BulletinKind[] = ['Flyer', 'Minutes', 'Photo album'];
const KIND_ICON: Record<BulletinKind, string> = { Flyer: '📣', Minutes: '📝', 'Photo album': '📷' };

function BulletinsBoard() {
  const user = useUser();
  const [kind, setKind] = useState<BulletinKind | 'all'>('all');
  const cards = useLoad(async () => {
    const [meetings, events] = await Promise.all([
      // Every meeting of the council, past ones included.
      db.meetings.listUpcoming(user.councilId, { fromDate: '1900-01-01' }),
      db.events.listByCouncil(user.councilId),
    ]);
    return bulletinCards(meetings, events);
  }, [user.councilId]);
  const all = cards.data ?? [];
  const shown = kind === 'all' ? all : all.filter((c) => c.kind === kind);

  return (
    <>
      <PageTitle>Bulletins</PageTitle>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted">Flyers, minutes and photo albums the council has filed in Google Drive. Each card opens the file in a new tab.</p>
        <div role="group" aria-label="Show" className="flex flex-wrap gap-2">
          {(['all', ...KINDS] as const).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={kind === k}
              onClick={() => setKind(k)}
              className={cx('rounded border-2 border-navy px-3 py-1 text-sm font-bold', kind === k ? 'bg-navy text-white' : 'bg-white text-navy')}
            >
              {k === 'all' ? `All (${all.length})` : `${k} (${all.filter((c) => c.kind === k).length})`}
            </button>
          ))}
        </div>
        {cards.error ? <Notice tone="error">{cards.error}</Notice> : null}
        {cards.loading ? null : shown.length === 0 ? (
          <Empty>No Google Drive files yet. Link a flyer or minutes to a meeting, or archive event photos to the Drive vault.</Empty>
        ) : (
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {shown.map((c) => (
              <li key={c.key}>
                <a
                  href={c.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-full flex-col gap-2 rounded border-2 border-navy border-t-8 border-t-gold bg-white p-4 hover:underline"
                >
                  <span className="flex items-center justify-between gap-2">
                    <Pill tone="outline">
                      <span aria-hidden="true">{KIND_ICON[c.kind]} </span>
                      {c.kind}
                    </Pill>
                    <span className="text-xs text-muted">{formatFullDate(c.date)}</span>
                  </span>
                  <span className="font-serif text-lg font-bold">{c.title}</span>
                  <span className="mt-auto text-sm font-bold">
                    Open in Google Drive <span aria-hidden="true">↗</span>
                    <span className="sr-only"> (opens in a new tab)</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

export default function BulletinsPage() {
  return (
    <RequireArea area="resources/bulletins">
      <BulletinsBoard />
    </RequireArea>
  );
}
