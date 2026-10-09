'use client';
// AI Generative Marketing Factory (Sprint 6C, Phase 4): an officer picks one of the council's events and the factory
// writes the flyer copy (composeFlyerCopy, shared marketing.ts - a deterministic template engine, no LLM), sets the
// date, time and address as large type, and lays it all out as a printable navy and gold HTML page (buildFlyerHtml).
// For an annual or duplicated event it embeds past photos: first the image ids filed in the Drive vault under
// Media / <past event name> (/api/drive-vault/media, only while the vault is switched on), then the photos saved on the
// past editions (Event.PhotoGalleryURL). With none, the flyer draws a vector icon for the event type.
// Filing: an Admin's flyer goes to the vault's Flyers folder and its file id is recorded in Event.GoogleDriveFlyerFileID
// (events.setFlyerFile, the event media rule). Everyone may print it or download the HTML file.
// Audience: Admins, Super Admins and seated officers (canOpenMarketingFactory).
// Sprint 6L Extension 2: the Microsoft Co-Pilot box (components/CopilotPrompt) asks the council's Microsoft Copilot Studio agent
// for advanced collateral in plain language, alongside the template flyer below.
import { useMemo, useRef, useState } from 'react';
import {
  buildFlyerHtml,
  canAttachEventMedia,
  composeFlyerCopy,
  councilLabel,
  describeError,
  driveFileViewUrl,
  FLYER_ICONS,
  FLYER_MAX_PHOTOS,
  flyerFacts,
  flyerFileName,
  flyerIconFor,
  flyerPlaceholders,
  formatDate,
  isAdmin,
  isDriveFileId,
  isRecurringEdition,
  marketingJargonHits,
  pastEditionFolderNames,
  pastEditionPhotos,
  pastEditions,
  toIsoDate,
  type Category,
  type Event as CouncilEvent,
  type FlyerCopy,
  type FlyerFacts,
} from '@kofc/shared';
import { CopilotPrompt } from '@/components/CopilotPrompt';
import { RequireArea } from '@/components/CouncilScope';
import { Button, cx, Empty, Field, Input, Notice, PageTitle, Panel, Pill, Select, Textarea } from '@/components/ui';
import { photoSrc } from '@/lib/media';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';
import { archiveToDriveVault, listVaultEventPhotos } from '@/services/drive-vault-transport';

type Draft = FlyerCopy & FlyerFacts;

const COPY_FIELDS: readonly { key: keyof Draft; label: string; long?: boolean }[] = [
  { key: 'headline', label: 'Headline' },
  { key: 'subhead', label: 'Subhead' },
  { key: 'body', label: 'Invitation', long: true },
  { key: 'date', label: 'Date (large type)' },
  { key: 'time', label: 'Time (large type)' },
  { key: 'address', label: 'Address (large type)' },
  { key: 'callToAction', label: 'Call to action' },
  { key: 'hostLine', label: 'Host line' },
];

/** An absolute image source for the flyer file: a same-site /media path must still open once the file leaves the portal. */
function flyerImageSrc(ref: string): string | null {
  const src = photoSrc(ref);
  if (!src) return null;
  return src.startsWith('/') ? new URL(src, window.location.origin).href : src;
}

interface PhotoScan {
  /** The vault answered (it is switched on). */
  vaultReached: boolean;
  vaultIds: string[];
  folders: string[];
}

function Studio({
  event,
  events,
  categoryName,
  councilName,
  onFiled,
}: {
  event: CouncilEvent;
  events: CouncilEvent[];
  categoryName: string | null;
  councilName: string;
  onFiled: () => Promise<void>;
}) {
  const user = useUser();
  const frame = useRef<HTMLIFrameElement>(null);
  const editions = useMemo(() => pastEditions(event, events), [event, events]);
  const recurring = isRecurringEdition(event, editions);
  const icon = flyerIconFor(event, categoryName);

  const details = useLoad(async () => {
    const [shifts, councilIds] = await Promise.all([db.events.listShifts(event.id), db.events.listCouncilIds(event.id)]);
    return { shifts, councilIds };
  }, [event.id]);

  // The historical photo loop: only a recurring edition scans, each past edition's Media / <name> folder in turn.
  const scan = useLoad(async (): Promise<PhotoScan> => {
    const folders = recurring ? pastEditionFolderNames(editions.length > 0 ? editions : [event]) : [];
    const ids: string[] = [];
    let reached = false;
    for (const folder of folders) {
      if (ids.length >= FLYER_MAX_PHOTOS) break;
      const found = await listVaultEventPhotos(folder);
      if (found === null) break; // switched off or unreachable: the same answer for every folder
      reached = true;
      for (const id of found) if (!ids.includes(id)) ids.push(id);
    }
    return { vaultReached: reached, vaultIds: ids.slice(0, FLYER_MAX_PHOTOS), folders };
  }, [event.id, recurring]);

  const savedPhotos = useMemo(() => pastEditionPhotos(editions), [editions]);
  const photoRefs = useMemo(() => {
    const refs = [...(scan.data?.vaultIds ?? [])];
    for (const ref of savedPhotos) if (!refs.includes(ref)) refs.push(ref);
    return refs.slice(0, FLYER_MAX_PHOTOS);
  }, [scan.data, savedPhotos]);

  const generated: Draft = useMemo(
    () => ({ ...composeFlyerCopy({ event, icon, recurring, councilName }), ...flyerFacts(event, details.data?.shifts ?? []) }),
    [event, icon, recurring, councilName, details.data],
  );
  const [edits, setEdits] = useState<Partial<Draft>>({});
  const [usePhotos, setUsePhotos] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);
  const draft: Draft = { ...generated, ...edits };

  const photos = useMemo(
    () => (usePhotos ? photoRefs.map(flyerImageSrc).filter((s): s is string => s !== null) : []),
    [usePhotos, photoRefs],
  );
  const html = useMemo(
    () =>
      buildFlyerHtml({
        copy: { headline: draft.headline, subhead: draft.subhead, body: draft.body, callToAction: draft.callToAction, hostLine: draft.hostLine },
        facts: { date: draft.date, time: draft.time, address: draft.address },
        photos,
        icon,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(draft), photos, icon],
  );

  const jargon = marketingJargonHits(COPY_FIELDS.map((f) => draft[f.key]).join(' '));
  const placeholders = flyerPlaceholders(draft);
  const mayFile = details.data ? canAttachEventMedia(user, event, details.data.councilIds) : false;

  const print = () => frame.current?.contentWindow?.print();

  const download = () => {
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = flyerFileName(event.EventName);
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const file = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const fileId = await archiveToDriveVault(user, 'flyer', new File([html], flyerFileName(event.EventName), { type: 'text/html' }));
      if (!fileId) {
        setMessage({
          tone: 'info',
          text: isAdmin(user)
            ? 'The Google Drive vault is switched off on this server, so nothing was filed. Download or print the flyer instead.'
            : 'Only Admins file flyers in the Google Drive vault. Download the flyer and send it to a council Admin.',
        });
        return;
      }
      await db.events.setFlyerFile(user.memberId, event.id, fileId);
      setMessage({ tone: 'info', text: `Flyer filed in Google Drive under Fraternal Enterprise Suite / Flyers (file ${fileId}).` });
      await onFiled();
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setBusy(false);
    }
  };

  const photoStatus = !recurring
    ? `A first-time event: no past photos to scan, so the flyer draws the ${FLYER_ICONS[icon].label.toLowerCase()} icon.`
    : scan.loading
      ? 'Scanning the Drive vault for past photos…'
      : [
          scan.data?.vaultReached
            ? `Drive vault: ${scan.data.vaultIds.length} photo${scan.data.vaultIds.length === 1 ? '' : 's'} in Media / ${scan.data.folders.join(', ')}.`
            : 'Drive vault: switched off on this server, not scanned.',
          `Past editions: ${editions.length}, with ${savedPhotos.length} saved photo${savedPhotos.length === 1 ? '' : 's'}.`,
          photoRefs.length === 0 ? `No photos found, so the flyer draws the ${FLYER_ICONS[icon].label.toLowerCase()} icon.` : '',
        ]
          .filter(Boolean)
          .join(' ');

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
      <Panel title="Copy co-pilot">
        <div className="flex flex-col gap-3">
          {message ? (
            <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
              {message.text}
            </Notice>
          ) : null}
          {details.error ? <Notice tone="error">{details.error}</Notice> : null}
          <div className="flex flex-wrap gap-2">
            {recurring ? <Pill tone="gold">Recurring event</Pill> : <Pill tone="outline">First edition</Pill>}
            {editions.length > 0 ? <Pill tone="navy">{`${editions.length} past edition${editions.length === 1 ? '' : 's'}`}</Pill> : null}
          </div>
          <p className="text-sm">{photoStatus}</p>
          {photoRefs.length > 0 ? (
            <label className="flex items-center gap-2 text-sm font-bold">
              <input type="checkbox" checked={usePhotos} onChange={(e) => setUsePhotos(e.target.checked)} />
              Embed {photoRefs.length} past photo{photoRefs.length === 1 ? '' : 's'}
            </label>
          ) : null}
          {COPY_FIELDS.map((f) => (
            <Field key={f.key} label={f.label}>
              {(id) =>
                f.long ? (
                  <Textarea id={id} value={draft[f.key]} maxLength={600} onChange={(e) => setEdits((prev) => ({ ...prev, [f.key]: e.target.value }))} />
                ) : (
                  <Input id={id} value={draft[f.key]} maxLength={160} onChange={(e) => setEdits((prev) => ({ ...prev, [f.key]: e.target.value }))} />
                )
              }
            </Field>
          ))}
          {placeholders.length > 0 ? (
            <Notice tone="error">{`Fill in ${placeholders.join(', ')} before printing: the event records do not hold ${placeholders.length === 1 ? 'it' : 'them'}.`}</Notice>
          ) : null}
          {jargon.length > 0 ? <Notice tone="error">{`Rewrite in plain, warm words: ${jargon.join(', ')}.`}</Notice> : null}
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setEdits({})} disabled={Object.keys(edits).length === 0}>
              Regenerate copy
            </Button>
            <Button variant="secondary" onClick={print}>
              Print
            </Button>
            <Button variant="secondary" onClick={download}>
              Download HTML
            </Button>
            {mayFile ? (
              <Button variant="gold" onClick={() => void file()} disabled={busy}>
                {busy ? 'Filing…' : 'File in Google Drive'}
              </Button>
            ) : null}
          </div>
          {event.GoogleDriveFlyerFileID && isDriveFileId(event.GoogleDriveFlyerFileID) ? (
            <p className="text-sm">
              Filed flyer:{' '}
              <a href={driveFileViewUrl(event.GoogleDriveFlyerFileID)} target="_blank" rel="noopener noreferrer" className="font-bold underline">
                open in Google Drive
              </a>
            </p>
          ) : null}
        </div>
      </Panel>
      <Panel title="Printable layout">
        <iframe
          ref={frame}
          title={`Flyer preview: ${draft.headline}`}
          srcDoc={html}
          sandbox="allow-same-origin allow-modals"
          className="h-[70rem] w-full border-4 border-navy bg-white"
        />
      </Panel>
    </div>
  );
}

function MarketingFactory() {
  const user = useUser();
  const data = useLoad(async () => {
    const [council, events, categories] = await Promise.all([
      db.councils.get(user.councilId),
      db.events.listByCouncil(user.councilId),
      db.lookups.list('Category') as Promise<Category[]>,
    ]);
    return { council, events, categories };
  }, [user.councilId]);
  const [chosen, setChosen] = useState<number | null>(null);

  const events = data.data?.events ?? [];
  // Default: the next event still ahead, else the newest.
  const today = toIsoDate(new Date());
  const upcoming = [...events].filter((e) => e.EndDate.slice(0, 10) >= today).sort((a, b) => a.StartDate.localeCompare(b.StartDate))[0];
  const event = events.find((e) => e.id === chosen) ?? upcoming ?? events[0];
  const categoryName = event ? (data.data?.categories.find((c) => c.id === event.CategoryID)?.Category ?? null) : null;

  return (
    <>
      <PageTitle>AI Generative Marketing Factory</PageTitle>
      <div className="flex flex-col gap-4">
        {data.error ? <Notice tone="error">{data.error}</Notice> : null}
        <section aria-labelledby="factory-title" data-surface="navy" className="rounded border-4 border-gold bg-navy p-4 text-white sm:p-6">
          <h2 id="factory-title" className="border-b-4 border-gold pb-1 font-serif text-2xl font-bold">
            Flyer co-pilot{data.data?.council ? ` - ${councilLabel(data.data.council)}` : ''}
          </h2>
          <p className="mt-2 text-base font-bold">
            Pick an event. The factory writes the invitation, sets the date, time and address in large type, and embeds photos from past editions of a
            recurring event. Edit any line, then print it or file it in the council&apos;s Google Drive.
          </p>
          {events.length > 0 && event ? (
            <div className="mt-3 max-w-xl rounded bg-white p-3 text-navy">
              <Field label="Event">
                {(id) => (
                  <Select id={id} value={event.id} onChange={(e) => setChosen(Number(e.target.value))}>
                    {events.map((e) => (
                      <option key={e.id} value={e.id}>
                        {`${e.EventName} - ${formatDate(e.StartDate.slice(0, 10))} ${e.StartDate.slice(0, 4)}`}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
          ) : null}
        </section>
        {data.data ? <CopilotPrompt event={event} councilName={data.data.council ? data.data.council.CouncilName : ''} /> : null}
        {data.data && events.length === 0 ? <Empty>The council has no events yet. Plan one on the Events page first.</Empty> : null}
        {event && data.data ? (
          <Studio
            key={event.id}
            event={event}
            events={events}
            categoryName={categoryName}
            councilName={data.data.council ? data.data.council.CouncilName : ''}
            onFiled={data.reload}
          />
        ) : null}
        <p className={cx('text-sm', !data.data && 'hidden')}>
          The co-pilot writes from the event&apos;s own records with fixed templates; it never invents numbers, quotes or endorsements, and uses no Knights
          of Columbus emblem. Check every line before the flyer goes to print.
        </p>
      </div>
    </>
  );
}

export default function MarketingFactoryPage() {
  return (
    <RequireArea area="resources/marketing">
      <MarketingFactory />
    </RequireArea>
  );
}
