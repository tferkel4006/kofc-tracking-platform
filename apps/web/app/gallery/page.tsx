'use client';
// Fraternal Photo Gallery: the council's photo library (media.getLibrary): the tagged photos of the media vault
// (CouncilMediaVault, Sprint 6P) and the older event photos in Event.PhotoGalleryURL, as a dense mosaic grouped by event
// or meeting, or by year. Sprint 6P adds:
//   * filters: several events and meetings at once, a location text and calendar years (matchesAlbumCriteria);
//   * Smart Albums: a filter saved under a name (media.saveSmartAlbum), reopened with one click, and deleted by whoever
//     saved it or an Admin (canDeleteSmartAlbum);
//   * the slideshow: the viewer opens full screen and moves to the next photo every SLIDESHOW_INTERVAL_MS with a fade
//     (no fade for viewers who ask for reduced motion), and loops back to the first photo after the last one;
//   * tagged uploads to an event or a meeting (media.uploadToVault) for those who may attach its media
//     (canAttachEventMedia, canLinkMeetingDrive).
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import {
  canAttachEventMedia,
  canDeleteSmartAlbum,
  canLinkMeetingDrive,
  describeError,
  EMPTY_ALBUM_CRITERIA,
  filterMediaLibrary,
  formatDate,
  isEmptyAlbumCriteria,
  MEDIA_LOCATION_MAX_LENGTH,
  SLIDESHOW_INTERVAL_MS,
  SMART_ALBUM_NAME_MAX_LENGTH,
  type Event as CouncilEvent,
  type MediaAlbumCriteria,
  type MediaLibrary,
  type MediaLibraryItem,
  type SmartAlbum,
} from '@kofc/shared';
import { CouncilSelect, RequireArea, useCouncilScope } from '@/components/CouncilScope';
import { Button, cx, Empty, Field, Input, Notice, PageTitle, Panel, Pill, Select, Tabs } from '@/components/ui';
import { photoName, photoSrc } from '@/lib/media';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';
import { archiveToDriveVault } from '@/services/drive-vault-transport';

type Grouping = 'source' | 'year';
const GROUPINGS = [
  { id: 'source', label: 'By event or meeting' },
  { id: 'year', label: 'By year' },
] as const satisfies readonly { id: Grouping; label: string }[];

const sourceName = (item: MediaLibraryItem) => item.eventName ?? item.meetingName ?? 'Council photos';

/** A photo, or a navy placeholder naming the file when it cannot be shown here (a phone path, a missing file). */
function Photo({ item, className, large = false }: { item: MediaLibraryItem; className?: string; large?: boolean }) {
  const [failed, setFailed] = useState(false);
  const src = photoSrc(item.fileUrl);
  if (!src || failed) {
    return (
      <div data-surface="navy" className={cx('flex aspect-[4/3] flex-col items-center justify-center gap-1 bg-navy p-3 text-center text-white', className)}>
        <svg viewBox="0 0 24 24" width={large ? 48 : 28} height={large ? 48 : 28} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <circle cx="9" cy="11" r="2" />
          <path d="m21 17-5-5-8 7" />
        </svg>
        <span className="break-all text-xs">{photoName(item.fileUrl)}</span>
        <span className="text-xs">{src ? 'Photo file not found' : 'Stored on the phone that took it'}</span>
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element -- photo references are arbitrary local paths and blobs
  return <img src={src} alt={`Photo from ${sourceName(item)}, ${formatDate(item.date)}`} loading="lazy" onError={() => setFailed(true)} className={className} />;
}

// ---- the slideshow viewer --------------------------------------------------------

function Slideshow({
  items,
  index,
  onIndex,
  autoplay,
  onClose,
}: {
  items: MediaLibraryItem[];
  index: number;
  onIndex: (i: number) => void;
  autoplay: boolean;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(autoplay);
  const item = items[index];
  const step = useCallback((delta: number) => onIndex((index + delta + items.length) % items.length), [index, items.length, onIndex]);

  // Focus moves into the viewer and back out; a slideshow asks the browser for the full screen.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    if (autoplay) dialog.current?.requestFullscreen?.().catch(() => undefined);
    return () => {
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
      previous?.focus();
    };
  }, [autoplay]);

  // The automatic cycle: the next photo after each interval, looping from the last back to the first.
  useEffect(() => {
    if (!playing || items.length < 2) return;
    const timer = window.setTimeout(() => step(1), SLIDESHOW_INTERVAL_MS);
    return () => window.clearTimeout(timer);
  }, [playing, index, items.length, step]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') step(1);
      else if (e.key === 'ArrowLeft') step(-1);
      else if (e.key === ' ') {
        e.preventDefault();
        setPlaying((p) => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, step]);

  const fullScreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    else dialog.current?.requestFullscreen?.().catch(() => undefined);
  };

  return (
    <div
      ref={dialog}
      role="dialog"
      aria-modal="true"
      aria-label={`Photo ${index + 1} of ${items.length}: ${sourceName(item)}`}
      tabIndex={-1}
      data-surface="navy"
      className="fixed inset-0 z-30 flex flex-col bg-navy text-white"
    >
      <header className="flex flex-wrap items-center justify-between gap-4 border-b-4 border-gold px-6 py-3">
        <div>
          <p className="font-serif text-lg font-bold">{sourceName(item)}</p>
          <p className="text-sm">
            {formatDate(item.date)}
            {item.locationTag ? ` · ${item.locationTag}` : ''} · Photo {index + 1} of {items.length}
          </p>
        </div>
        <div className="flex gap-2">
          {items.length > 1 ? (
            <button type="button" onClick={() => setPlaying((p) => !p)} aria-pressed={playing} className="rounded border-2 border-gold px-3 py-1 font-bold">
              {playing ? 'Pause slideshow' : 'Play slideshow'}
            </button>
          ) : null}
          <button type="button" onClick={fullScreen} className="rounded border-2 border-white px-3 py-1 font-bold">
            Full screen
          </button>
          <button type="button" onClick={onClose} className="rounded border-2 border-white px-3 py-1 font-bold">
            Close <span className="sr-only">the photo viewer</span>
          </button>
        </div>
      </header>
      {/* The progress bar fills over one interval while the slideshow plays. */}
      <div className="h-1 bg-navy" aria-hidden="true">
        {playing && items.length > 1 ? (
          <div key={`progress-${index}`} className="h-1 bg-gold motion-safe:animate-slide-progress" style={{ animationDuration: `${SLIDESHOW_INTERVAL_MS}ms` }} />
        ) : null}
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center gap-4 px-4 py-4">
        <button type="button" onClick={() => step(-1)} aria-label="Previous photo" className="shrink-0 rounded-full border-2 border-gold px-4 py-3 text-2xl font-bold">
          ‹
        </button>
        <div className="flex h-full min-w-0 flex-1 items-center justify-center" aria-live={playing ? 'off' : 'polite'}>
          <div key={item.key} className="flex h-full w-full items-center justify-center motion-safe:animate-slide-fade">
            <Photo item={item} large className="max-h-full max-w-full rounded object-contain" />
          </div>
        </div>
        <button type="button" onClick={() => step(1)} aria-label="Next photo" className="shrink-0 rounded-full border-2 border-gold px-4 py-3 text-2xl font-bold">
          ›
        </button>
      </div>
      <nav aria-label="All photos" className="flex gap-2 overflow-x-auto border-t border-white px-6 py-3">
        {items.map((p, i) => (
          <button
            key={p.key}
            type="button"
            onClick={() => onIndex(i)}
            aria-label={`Show photo ${i + 1}`}
            aria-current={i === index ? 'true' : undefined}
            className={cx('h-16 w-20 shrink-0 overflow-hidden rounded border-4', i === index ? 'border-gold' : 'border-transparent')}
          >
            <Photo item={p} className="h-full w-full object-cover" />
          </button>
        ))}
      </nav>
    </div>
  );
}

// ---- filters and Smart Albums ----------------------------------------------------

function toggle<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function CheckList({ legend, options, picked, onToggle }: { legend: string; options: { id: number; name: string; date: string }[]; picked: number[]; onToggle: (id: number) => void }) {
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-1 text-xs font-bold uppercase tracking-wide text-navy">{legend}</legend>
      {options.length === 0 ? <p className="text-xs text-muted">None yet.</p> : null}
      <div className="flex max-h-44 flex-col gap-1 overflow-y-auto rounded border border-line p-2">
        {options.map((o) => (
          <label key={o.id} className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={picked.includes(o.id)} onChange={() => onToggle(o.id)} />
            <span>
              {o.name} <span className="text-xs text-muted">({formatDate(o.date)})</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function FiltersPanel({ library, criteria, onChange }: { library: MediaLibrary; criteria: MediaAlbumCriteria; onChange: (c: MediaAlbumCriteria) => void }) {
  return (
    <Panel title="Find photos" actions={!isEmptyAlbumCriteria(criteria) ? <Button size="sm" variant="secondary" onClick={() => onChange(EMPTY_ALBUM_CRITERIA)}>Clear</Button> : undefined}>
      <div className="flex flex-col gap-4">
        <CheckList legend="Events" options={library.events} picked={criteria.eventIds} onToggle={(id) => onChange({ ...criteria, eventIds: toggle(criteria.eventIds, id) })} />
        <CheckList legend="Meetings" options={library.meetings} picked={criteria.meetingIds} onToggle={(id) => onChange({ ...criteria, meetingIds: toggle(criteria.meetingIds, id) })} />
        <Field label="Location">
          {(id) => (
            <>
              <Input id={id} list={`${id}-places`} value={criteria.location} maxLength={MEDIA_LOCATION_MAX_LENGTH} placeholder="Any location" onChange={(e) => onChange({ ...criteria, location: e.target.value })} />
              <datalist id={`${id}-places`}>
                {library.locations.map((l) => (
                  <option key={l} value={l} />
                ))}
              </datalist>
            </>
          )}
        </Field>
        <fieldset>
          <legend className="mb-1 text-xs font-bold uppercase tracking-wide text-navy">Years</legend>
          <div className="flex flex-wrap gap-2">
            {library.years.map((y) => (
              <button
                key={y}
                type="button"
                aria-pressed={criteria.years.includes(y)}
                onClick={() => onChange({ ...criteria, years: toggle(criteria.years, y) })}
                className={cx('rounded-full border-2 px-3 py-0.5 text-sm font-bold', criteria.years.includes(y) ? 'border-navy bg-navy text-white' : 'border-line')}
              >
                {y}
              </button>
            ))}
            {library.years.length === 0 ? <p className="text-xs text-muted">No photos yet.</p> : null}
          </div>
        </fieldset>
      </div>
    </Panel>
  );
}

function AlbumsPanel({
  councilId,
  albums,
  criteria,
  activeId,
  onOpen,
  onChanged,
}: {
  councilId: number;
  albums: SmartAlbum[];
  criteria: MediaAlbumCriteria;
  activeId: number | null;
  onOpen: (album: SmartAlbum) => void;
  onChanged: () => Promise<void>;
}) {
  const user = useUser();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);

  const act = async (work: () => Promise<string>) => {
    setBusy(true);
    setMessage(null);
    try {
      setMessage({ tone: 'info', text: await work() });
      await onChanged();
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setBusy(false);
    }
  };
  const save = () =>
    act(async () => {
      const album = await db.media.saveSmartAlbum(user.memberId, councilId, name, criteria);
      setName('');
      return `Saved the Smart Album "${album.album_name}".`;
    });
  const remove = (album: SmartAlbum) =>
    act(async () => {
      await db.media.deleteSmartAlbum(user.memberId, album.id);
      return `Deleted "${album.album_name}". The photos are still in the gallery.`;
    });

  return (
    <Panel title="Smart Albums">
      <div className="flex flex-col gap-3">
        {message ? (
          <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
            {message.text}
          </Notice>
        ) : null}
        {albums.length === 0 ? <p className="text-sm text-muted">No albums yet. Pick filters, then save them here.</p> : null}
        <ul className="flex flex-col gap-1">
          {albums.map((a) => (
            <li key={a.id} className="flex items-center gap-2">
              <button
                type="button"
                aria-pressed={activeId === a.id}
                onClick={() => onOpen(a)}
                className={cx('flex-1 border-l-8 px-2 py-1 text-left text-sm font-bold', activeId === a.id ? 'border-gold bg-white outline outline-1 outline-line' : 'border-transparent hover:underline')}
              >
                {a.album_name}
              </button>
              {canDeleteSmartAlbum(user, a) ? (
                <button type="button" disabled={busy} onClick={() => void remove(a)} aria-label={`Delete the Smart Album ${a.album_name}`} className="rounded px-2 text-sm font-bold">
                  ×
                </button>
              ) : null}
            </li>
          ))}
        </ul>
        <Field label="Save the current filters as" hint={isEmptyAlbumCriteria(criteria) ? 'Pick at least one filter first.' : undefined}>
          {(id) => <Input id={id} value={name} maxLength={SMART_ALBUM_NAME_MAX_LENGTH} placeholder="For example: Fish Fry 2026" onChange={(e) => setName(e.target.value)} />}
        </Field>
        <Button size="sm" disabled={busy || !name.trim() || isEmptyAlbumCriteria(criteria)} onClick={() => void save()}>
          Save Smart Album
        </Button>
      </div>
    </Panel>
  );
}

// ---- tagged upload -----------------------------------------------------------------

type Target = { kind: 'event' | 'meeting'; id: number; name: string; location: string };

function UploadPhotos({ targets, onUploaded }: { targets: Target[]; onUploaded: () => Promise<void> }) {
  const user = useUser();
  const [targetKey, setTargetKey] = useState(targets[0] ? `${targets[0].kind}-${targets[0].id}` : '');
  const [locationTag, setLocationTag] = useState('');
  const [files, setFiles] = useState<{ file: File; url: string }[]>([]);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const target = targets.find((t) => `${t.kind}-${t.id}` === targetKey);

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
    if (!target) return;
    setBusy(true);
    setMessage(null);
    try {
      // An Admin's photos go to the Drive vault's Media folder (Media / <event or meeting name>) and only their file ids
      // are stored. Otherwise the memory driver has no file store, so each photo is a browser blob link.
      const refs: string[] = [];
      for (const f of files) refs.push((await archiveToDriveVault(user, 'media', f.file, target.name)) ?? f.url);
      await db.media.uploadToVault(user.memberId, {
        eventId: target.kind === 'event' ? target.id : null,
        meetingId: target.kind === 'meeting' ? target.id : null,
        fileUrls: refs,
        locationTag: locationTag.trim() || null,
      });
      setMessage({ tone: 'info', text: `${files.length} photo${files.length === 1 ? '' : 's'} added to ${target.name}.` });
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
        <Field label="Event or meeting">
          {(id) => (
            <Select id={id} value={targetKey} onChange={(e) => setTargetKey(e.target.value)}>
              {(['event', 'meeting'] as const).map((kind) => {
                const group = targets.filter((t) => t.kind === kind);
                return group.length > 0 ? (
                  <optgroup key={kind} label={kind === 'event' ? 'Events' : 'Meetings'}>
                    {group.map((t) => (
                      <option key={`${t.kind}-${t.id}`} value={`${t.kind}-${t.id}`}>
                        {t.name}
                      </option>
                    ))}
                  </optgroup>
                ) : null;
              })}
            </Select>
          )}
        </Field>
        <Field label="Location tag" hint="Left blank, the event's or meeting's location is used.">
          {(id) => <Input id={id} value={locationTag} maxLength={MEDIA_LOCATION_MAX_LENGTH} placeholder={target?.location ?? ''} onChange={(e) => setLocationTag(e.target.value)} />}
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
          <input
            ref={input}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => {
              add(e.target.files);
              e.target.value = '';
            }}
          />
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
            <Button onClick={() => void upload()} disabled={busy || !target}>
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

interface PhotoGroup {
  key: string;
  label: string;
  items: MediaLibraryItem[];
}

function groupItems(items: readonly MediaLibraryItem[], by: Grouping): PhotoGroup[] {
  const groups = new Map<string, PhotoGroup>();
  for (const item of items) {
    const key = by === 'year' ? `year-${item.calendarYear}` : item.eventId !== null ? `event-${item.eventId}` : item.meetingId !== null ? `meeting-${item.meetingId}` : 'untagged';
    const label = by === 'year' ? String(item.calendarYear) : `${sourceName(item)} · ${formatDate(item.date)}`;
    const group = groups.get(key) ?? { key, label, items: [] };
    group.items.push(item);
    groups.set(key, group);
  }
  return [...groups.values()];
}

function PhotoGallery() {
  const user = useUser();
  const scope = useCouncilScope();
  const councilId = scope.councilId;
  const [grouping, setGrouping] = useState<Grouping>('source');
  const [criteria, setCriteria] = useState<MediaAlbumCriteria>(EMPTY_ALBUM_CRITERIA);
  const [albumId, setAlbumId] = useState<number | null>(null);
  const [viewer, setViewer] = useState<{ index: number; autoplay: boolean } | null>(null);

  const library = useLoad(() => db.media.getLibrary(user.memberId, councilId), [councilId, user.memberId]);
  const albums = useLoad(() => db.media.listSmartAlbums(user.memberId, councilId), [councilId, user.memberId]);
  const targets = useLoad(async (): Promise<Target[]> => {
    const events = await db.events.listByCouncil(councilId);
    const links = await Promise.all(events.map((e) => db.events.listCouncilIds(e.id)));
    const lib = await db.media.getLibrary(user.memberId, councilId);
    const eventTargets = events
      .filter((e: CouncilEvent, i) => canAttachEventMedia(user, e, links[i]))
      .map((e) => ({ kind: 'event' as const, id: e.id, name: e.EventName, location: e.Location }));
    const meetingTargets = lib.meetings
      .filter((m) => canLinkMeetingDrive(user, { CouncilID: councilId, OwnerID: m.ownerId }))
      .map((m) => ({ kind: 'meeting' as const, id: m.id, name: m.name, location: '' }));
    return [...eventTargets, ...meetingTargets];
  }, [councilId, user.memberId]);

  useEffect(() => {
    setCriteria(EMPTY_ALBUM_CRITERIA);
    setAlbumId(null);
  }, [councilId]);

  const shown = useMemo(() => filterMediaLibrary(library.data?.items ?? [], criteria), [library.data, criteria]);
  const groups = groupItems(shown, grouping);
  // The viewer flips through photos in the order they appear on the page.
  const ordered = groups.flatMap((g) => g.items);
  const closeViewer = useCallback(() => setViewer(null), []);
  const setIndex = useCallback((index: number) => setViewer((v) => (v ? { ...v, index } : v)), []);

  const changeCriteria = (c: MediaAlbumCriteria) => {
    setCriteria(c);
    setAlbumId(null);
  };
  const reloadAll = async () => {
    await Promise.all([library.reload(), albums.reload()]);
  };
  const total = library.data?.items.length ?? 0;
  const activeAlbum = albums.data?.find((a) => a.id === albumId) ?? null;

  return (
    <>
      <PageTitle actions={<CouncilSelect scope={scope} />}>Fraternal Photo Gallery</PageTitle>
      {library.error ?? albums.error ? <Notice tone="error">{library.error ?? albums.error}</Notice> : null}
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section aria-label="Photos" className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <Tabs tabs={GROUPINGS} value={grouping} onChange={setGrouping} label="Group photos" idPrefix="gallery" />
            <div className="flex items-center gap-2">
              {activeAlbum ? <Pill tone="gold">Album: {activeAlbum.album_name}</Pill> : null}
              <Pill tone="outline">{shown.length === total ? `${total} photo${total === 1 ? '' : 's'}` : `${shown.length} of ${total} photos`}</Pill>
              {ordered.length > 0 ? (
                <Button size="sm" onClick={() => setViewer({ index: 0, autoplay: true })}>
                  ▶ Play slideshow
                </Button>
              ) : null}
            </div>
          </div>
          <div id="gallery-panel" role="tabpanel" aria-labelledby={`gallery-tab-${grouping}`} className="flex flex-col gap-6">
            {library.loading && !library.data ? <p className="text-sm text-muted">Loading photos…</p> : null}
            {library.data && total === 0 ? (
              <Empty>No photos yet. {(targets.data?.length ?? 0) > 0 ? 'Add some with the Upload Photos block.' : 'Event owners and council officers add them.'}</Empty>
            ) : null}
            {library.data && total > 0 && shown.length === 0 ? <Empty>No photos match these filters.</Empty> : null}
            {groups.map((group) => (
              <section key={group.key} aria-labelledby={`${group.key}-title`}>
                <h2 id={`${group.key}-title`} className="mb-2 flex items-baseline gap-2 border-b-2 border-gold pb-1 font-serif text-lg font-bold">
                  {group.label}
                  <span className="font-sans text-xs font-normal text-muted">
                    {group.items.length} photo{group.items.length === 1 ? '' : 's'}
                  </span>
                </h2>
                <ul className="columns-2 gap-2 sm:columns-3 lg:columns-4 2xl:columns-5">
                  {group.items.map((item) => (
                    <li key={item.key} className="mb-2 break-inside-avoid">
                      <button
                        type="button"
                        onClick={() => setViewer({ index: ordered.indexOf(item), autoplay: false })}
                        className="group block w-full overflow-hidden rounded border border-line text-left"
                        aria-label={`Open photo from ${sourceName(item)}`}
                      >
                        <Photo item={item} className="block w-full transition-transform duration-200 motion-safe:group-hover:scale-105" />
                        <span className="block truncate px-2 py-1 text-xs">
                          {grouping === 'year' ? <span className="font-bold">{sourceName(item)}</span> : null}
                          {grouping === 'year' && item.locationTag ? ' · ' : ''}
                          {item.locationTag ?? ''}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </section>
        <aside className="flex flex-col gap-4">
          {albums.data ? (
            <AlbumsPanel
              key={`albums-${councilId}`}
              councilId={councilId}
              albums={albums.data}
              criteria={criteria}
              activeId={albumId}
              onOpen={(a) => {
                setCriteria(a.criteria);
                setAlbumId(a.id);
              }}
              onChanged={() => albums.reload()}
            />
          ) : null}
          {library.data ? <FiltersPanel library={library.data} criteria={criteria} onChange={changeCriteria} /> : null}
          {targets.data && targets.data.length > 0 ? <UploadPhotos key={`upload-${councilId}`} targets={targets.data} onUploaded={reloadAll} /> : null}
        </aside>
      </div>
      {viewer && ordered[viewer.index] ? <Slideshow items={ordered} index={viewer.index} onIndex={setIndex} autoplay={viewer.autoplay} onClose={closeViewer} /> : null}
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
