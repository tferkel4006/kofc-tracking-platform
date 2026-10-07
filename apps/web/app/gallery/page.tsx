'use client';
// Fraternal Photo Gallery: every photo attached to the council's events (Event.PhotoGalleryURL), as a dense
// mosaic grouped by event or by month, with a full-screen lightbox for flipping through pictures during a
// meeting. Members who may attach photos to an event (its owner, the council's Admins, Financial Secretary and
// Treasurer, Super Admins: canAttachEventMedia) get a drag-and-drop "Upload Photos" block.
import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react';
import {
  canAttachEventMedia,
  describeError,
  formatDate,
  galleryPhotos,
  groupGalleryPhotos,
  type Event as CouncilEvent,
  type GalleryGrouping,
  type GalleryPhoto,
} from '@kofc/shared';
import { CouncilSelect, RequireArea, useCouncilScope } from '@/components/CouncilScope';
import { Button, cx, Empty, Field, Notice, PageTitle, Panel, Pill, Select, Tabs } from '@/components/ui';
import { photoName, photoSrc } from '@/lib/media';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';
import { archiveToDriveVault } from '@/services/drive-vault-transport';

const GROUPINGS = [
  { id: 'event', label: 'By event' },
  { id: 'month', label: 'By month' },
] as const satisfies readonly { id: GalleryGrouping; label: string }[];

/** A photo, or a navy placeholder naming the file when it cannot be shown here (a phone path, a missing file). */
function Photo({ photo, className, large = false }: { photo: GalleryPhoto; className?: string; large?: boolean }) {
  const [failed, setFailed] = useState(false);
  const src = photoSrc(photo.path);
  if (!src || failed) {
    return (
      <div data-surface="navy" className={cx('flex aspect-[4/3] flex-col items-center justify-center gap-1 bg-navy p-3 text-center text-white', className)}>
        <svg viewBox="0 0 24 24" width={large ? 48 : 28} height={large ? 48 : 28} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <circle cx="9" cy="11" r="2" />
          <path d="m21 17-5-5-8 7" />
        </svg>
        <span className="break-all text-xs">{photoName(photo.path)}</span>
        <span className="text-xs">{src ? 'Photo file not found' : 'Stored on the phone that took it'}</span>
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element -- photo references are arbitrary local paths and blobs
  return <img src={src} alt={`Photo from ${photo.eventName}, ${formatDate(photo.eventDate)}`} loading="lazy" onError={() => setFailed(true)} className={className} />;
}

// ---- lightbox ------------------------------------------------------------------

function Lightbox({ photos, index, onIndex, onClose }: { photos: GalleryPhoto[]; index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const dialog = useRef<HTMLDivElement>(null);
  const photo = photos[index];
  const step = useCallback((delta: number) => onIndex((index + delta + photos.length) % photos.length), [index, photos.length, onIndex]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    return () => previous?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') step(1);
      else if (e.key === 'ArrowLeft') step(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, step]);

  return (
    <div
      ref={dialog}
      role="dialog"
      aria-modal="true"
      aria-label={`Photo ${index + 1} of ${photos.length}: ${photo.eventName}`}
      tabIndex={-1}
      data-surface="navy"
      className="fixed inset-0 z-30 flex flex-col bg-navy text-white"
    >
      <header className="flex items-center justify-between gap-4 border-b-4 border-gold px-6 py-3">
        <div>
          <p className="font-serif text-lg font-bold">{photo.eventName}</p>
          <p className="text-sm">
            {formatDate(photo.eventDate)} · Photo {index + 1} of {photos.length}
          </p>
        </div>
        <button type="button" onClick={onClose} className="rounded border-2 border-white px-3 py-1 font-bold">
          Close <span className="sr-only">the photo viewer</span>
        </button>
      </header>
      <div className="relative flex min-h-0 flex-1 items-center justify-center gap-4 px-4 py-4">
        <button type="button" onClick={() => step(-1)} aria-label="Previous photo" className="shrink-0 rounded-full border-2 border-gold px-4 py-3 text-2xl font-bold">
          ‹
        </button>
        <div className="flex h-full min-w-0 flex-1 items-center justify-center">
          <Photo key={photo.key} photo={photo} large className="max-h-full max-w-full rounded object-contain" />
        </div>
        <button type="button" onClick={() => step(1)} aria-label="Next photo" className="shrink-0 rounded-full border-2 border-gold px-4 py-3 text-2xl font-bold">
          ›
        </button>
      </div>
      <nav aria-label="All photos" className="flex gap-2 overflow-x-auto border-t border-white px-6 py-3">
        {photos.map((p, i) => (
          <button
            key={p.key}
            type="button"
            onClick={() => onIndex(i)}
            aria-label={`Show photo ${i + 1}`}
            aria-current={i === index ? 'true' : undefined}
            className={cx('h-16 w-20 shrink-0 overflow-hidden rounded border-4', i === index ? 'border-gold' : 'border-transparent')}
          >
            <Photo photo={p} className="h-full w-full object-cover" />
          </button>
        ))}
      </nav>
    </div>
  );
}

// ---- upload block ----------------------------------------------------------------

function UploadPhotos({ events, onUploaded }: { events: CouncilEvent[]; onUploaded: () => Promise<void> }) {
  const user = useUser();
  const [eventId, setEventId] = useState<number>(events[0]?.id ?? 0);
  const [files, setFiles] = useState<{ file: File; url: string }[]>([]);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const add = (list: FileList | null) => {
    const images = Array.from(list ?? []).filter((f) => f.type.startsWith('image/'));
    const skipped = (list?.length ?? 0) - images.length;
    setMessage(skipped > 0 ? { tone: 'error', text: `${skipped} file${skipped === 1 ? ' is' : 's are'} not an image and ${skipped === 1 ? 'was' : 'were'} skipped.` } : null);
    setFiles((now) => [...now, ...images.map((file) => ({ file, url: URL.createObjectURL(file) }))]);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    add(e.dataTransfer.files);
  };

  const upload = async () => {
    setBusy(true);
    setMessage(null);
    try {
      // Sprint 6D: an Admin's photos go to the Drive vault's Media folder and only their file ids are stored. Otherwise
      // the memory driver has no file store, so each photo is a browser blob link (as meeting minutes are). Sprint 6C: the
      // photos go to the event's own folder (Media / <event name>), where the Marketing Factory finds them next year.
      const folder = events.find((e) => e.id === eventId)?.EventName;
      const refs: string[] = [];
      for (const f of files) refs.push((await archiveToDriveVault(user, 'media', f.file, folder)) ?? f.url);
      const event = await db.events.uploadPhotos(user.memberId, eventId, refs);
      setMessage({ tone: 'info', text: `${files.length} photo${files.length === 1 ? '' : 's'} added to ${event.EventName}.` });
      setFiles([]);
      await onUploaded();
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title="Upload Photos">
      <div className="flex flex-col gap-3">
        {message ? (
          <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
            {message.text}
          </Notice>
        ) : null}
        <Field label="Event">
          {(id) => (
            <Select id={id} value={eventId} onChange={(e) => setEventId(Number(e.target.value))}>
              {events.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.EventName} ({formatDate(e.StartDate)})
                </option>
              ))}
            </Select>
          )}
        </Field>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cx('flex flex-col items-center gap-2 rounded border-2 border-dashed p-6 text-center', dragging ? 'border-gold bg-white' : 'border-navy')}
        >
          <p className="text-sm font-bold">Drag and drop photos here</p>
          <p className="text-xs text-muted">JPEG, PNG, HEIC or any other image</p>
          <Button variant="secondary" size="sm" onClick={() => input.current?.click()}>
            Choose photos…
          </Button>
          <input ref={input} type="file" accept="image/*" multiple className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => {
            add(e.target.files);
            e.target.value = '';
          }} />
        </div>
        {files.length > 0 ? (
          <>
            <ul className="grid grid-cols-4 gap-2">
              {files.map((f, i) => (
                <li key={f.url} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
                  <img src={f.url} alt={f.file.name} className="aspect-square w-full rounded object-cover" />
                  <button
                    type="button"
                    onClick={() => setFiles((now) => now.filter((_, j) => j !== i))}
                    aria-label={`Remove ${f.file.name}`}
                    className="absolute right-1 top-1 rounded-full bg-navy px-1.5 text-xs font-bold text-white"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
            <Button onClick={() => void upload()} disabled={busy || !eventId}>
              {busy ? 'Uploading…' : `Upload ${files.length} photo${files.length === 1 ? '' : 's'}`}
            </Button>
          </>
        ) : null}
        <p className="text-xs text-muted">In this preview build, photos added here last until the page is reloaded.</p>
      </div>
    </Panel>
  );
}

// ---- the page ----------------------------------------------------------------------

function PhotoGallery() {
  const user = useUser();
  const scope = useCouncilScope();
  const [grouping, setGrouping] = useState<GalleryGrouping>('event');
  const [open, setOpen] = useState<number | null>(null);
  const data = useLoad(async () => {
    const events = await db.events.listByCouncil(scope.councilId);
    const links = await Promise.all(events.map((e) => db.events.listCouncilIds(e.id)));
    return { events, uploadable: events.filter((e, i) => canAttachEventMedia(user, e, links[i])) };
  }, [scope.councilId, user.memberId]);

  const photos = galleryPhotos(data.data?.events ?? []);
  const groups = groupGalleryPhotos(photos, grouping);
  // The lightbox flips through photos in the order they appear on the page.
  const ordered = groups.flatMap((g) => g.photos);
  const closeLightbox = useCallback(() => setOpen(null), []);

  return (
    <>
      <PageTitle actions={<CouncilSelect scope={scope} />}>Fraternal Photo Gallery</PageTitle>
      {data.error ? <Notice tone="error">{data.error}</Notice> : null}
      <div className={cx('grid items-start gap-4', (data.data?.uploadable.length ?? 0) > 0 ? 'xl:grid-cols-[minmax(0,1fr)_22rem]' : '')}>
        <section aria-label="Photos" className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <Tabs tabs={GROUPINGS} value={grouping} onChange={setGrouping} label="Group photos" idPrefix="gallery" />
            <div className="flex items-center gap-2">
              <Pill tone="outline">
                {photos.length} photo{photos.length === 1 ? '' : 's'}
              </Pill>
              {ordered.length > 0 ? (
                <Button size="sm" onClick={() => setOpen(0)}>
                  Start slideshow
                </Button>
              ) : null}
            </div>
          </div>
          <div id="gallery-panel" role="tabpanel" aria-labelledby={`gallery-tab-${grouping}`} className="flex flex-col gap-6">
            {data.loading && !data.data ? <p className="text-sm text-muted">Loading photos…</p> : null}
            {data.data && photos.length === 0 ? (
              <Empty>No event photos yet. {(data.data.uploadable.length ?? 0) > 0 ? 'Add some with the Upload Photos block.' : 'Event owners and council officers add them.'}</Empty>
            ) : null}
            {groups.map((group) => (
              <section key={group.key} aria-labelledby={`${group.key}-title`}>
                <h2 id={`${group.key}-title`} className="mb-2 flex items-baseline gap-2 border-b-2 border-gold pb-1 font-serif text-lg font-bold">
                  {group.label}
                  <span className="font-sans text-xs font-normal text-muted">
                    {group.photos.length} photo{group.photos.length === 1 ? '' : 's'}
                  </span>
                </h2>
                <ul className="columns-2 gap-2 sm:columns-3 lg:columns-4 2xl:columns-5">
                  {group.photos.map((photo) => (
                    <li key={photo.key} className="mb-2 break-inside-avoid">
                      <button
                        type="button"
                        onClick={() => setOpen(ordered.indexOf(photo))}
                        className="group block w-full overflow-hidden rounded border border-line text-left"
                        aria-label={`Open photo from ${photo.eventName}`}
                      >
                        <Photo photo={photo} className="block w-full transition-transform duration-200 motion-safe:group-hover:scale-105" />
                        {grouping === 'month' ? <span className="block truncate px-2 py-1 text-xs font-bold">{photo.eventName}</span> : null}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </section>
        {data.data && data.data.uploadable.length > 0 ? <UploadPhotos key={scope.councilId} events={data.data.uploadable} onUploaded={data.reload} /> : null}
      </div>
      {open !== null && ordered[open] ? <Lightbox photos={ordered} index={open} onIndex={setOpen} onClose={closeLightbox} /> : null}
    </>
  );
}

export default function GalleryPage() {
  return (
    <RequireArea area="gallery">
      <PhotoGallery />
    </RequireArea>
  );
}
