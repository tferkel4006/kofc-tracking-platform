'use client';
// Council History - the Team Legacy dashboard (Sprint 6K). One summary card per fraternal year, newest first: the
// year's seated officer core (CouncilLeadershipHistory) as a single roster grid beside the officers' collective
// accomplishments and team metrics (CouncilHistoryAnnals), then the year's diary entries and Oral History Testimonials
// (CouncilSpiritualDiary). It is a team record: no member's hours, signups or scores appear.
// Every member reads it and records testimonials; the council's history keepers - its Active officers and Admins, any
// Super Admin (CouncilLegacyMatrix.canKeepAnnals) - write each year's annals and the founding facts.
// Sprint 6L Extension 5: each member records at most one Oral History Testimonial (the recorder gives way to a note once
// it is on file), and the In Memoriam card deck (InMemoriamParts) honors the council's deceased brothers.
import { useState } from 'react';
import {
  describeError,
  platformSettings,
  driveFileViewUrl,
  HISTORY_TEXT_MAX_LENGTH,
  isDriveFileId,
  ORIGINAL_CHAPLAIN_MAX_LENGTH,
  type CouncilAnnalsInput,
  type CouncilLegacyMatrix,
  type DiaryEntryDetail,
  type LegacyYear,
} from '@kofc/shared';
import { usePlatformSettings } from '@/components/SettingsParts';
import { RequireArea } from '@/components/CouncilScope';
import { SummaryCard } from '@/components/DuesParts';
import { InMemoriamDeck } from '@/components/InMemoriamParts';
import { OralHistoryRecorder } from '@/components/OralHistoryRecorder';
import { Button, Field, Input, Notice, PageTitle, Panel, Textarea } from '@/components/ui';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

const longDate = (iso: string | null | undefined) =>
  iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { dateStyle: 'long' }) : null;

/** A stored asset: a Drive file id opens in Drive; an https or blob link opens as is. */
const assetHref = (ref: string) => (isDriveFileId(ref) ? driveFileViewUrl(ref) : ref.split('#')[0]);

function Founding({ matrix }: { matrix: CouncilLegacyMatrix }) {
  const f = matrix.founding;
  const nothing = !f.establishmentDate && !f.originalChaplain && !f.charterPhotoUrl;
  return (
    <SummaryCard id="history-founding" title="Our founding" subtitle="The council's charter, as the annals record it.">
      {nothing ? (
        <p>{matrix.canKeepAnnals ? 'No founding facts yet. Add them with Edit year on the earliest year you know.' : 'No founding facts recorded yet.'}</p>
      ) : (
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-sm uppercase tracking-wide text-muted">Chartered</dt>
            <dd className="text-xl">{longDate(f.establishmentDate) ?? 'Not recorded'}</dd>
          </div>
          <div>
            <dt className="text-sm uppercase tracking-wide text-muted">Original chaplain</dt>
            <dd className="text-xl">{f.originalChaplain ?? 'Not recorded'}</dd>
          </div>
          <div>
            <dt className="text-sm uppercase tracking-wide text-muted">Charter photo</dt>
            <dd className="text-xl">
              {f.charterPhotoUrl ? (
                <a href={assetHref(f.charterPhotoUrl)} target="_blank" rel="noreferrer" className="underline">
                  Open the charter photo
                </a>
              ) : (
                'Not recorded'
              )}
            </dd>
          </div>
        </dl>
      )}
    </SummaryCard>
  );
}

function OfficerCore({ year }: { year: LegacyYear }) {
  if (year.officers.length === 0) return <p>No officer seats are recorded for this year.</p>;
  return (
    <table className="w-full border-collapse text-left">
      <caption className="sr-only">Seated officer core, {year.fraternalYear}</caption>
      <thead>
        <tr className="border-b-2 border-gold text-sm uppercase tracking-wide text-muted">
          <th scope="col" className="py-1 pr-3">
            Office
          </th>
          <th scope="col" className="py-1">
            Brother Knight
          </th>
        </tr>
      </thead>
      <tbody>
        {year.officers.map((o) => (
          <tr key={`${o.roleName}-${o.memberId}`} className="border-b border-line">
            <td className="py-1.5 pr-3">{o.roleName}</td>
            <td className="py-1.5">
              {o.firstName} {o.lastName}
              {o.steppedDown ? <span className="ml-2 text-sm text-navy">(stepped down mid-term)</span> : null}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Prose({ label, text }: { label: string; text: string | null | undefined }) {
  return (
    <div>
      <h3 className="text-sm uppercase tracking-wide text-muted">{label}</h3>
      <p className="mt-1 whitespace-pre-wrap text-lg leading-relaxed">{text || 'Not written yet.'}</p>
    </div>
  );
}

function DiaryEntry({ d }: { d: DiaryEntryDetail }) {
  const audio = d.entry.audio_asset_url;
  return (
    <li className="rounded border-2 border-line p-3">
      <p className="text-sm text-navy">
        {longDate(d.entry.entry_date)} · {d.authorFirstName} {d.authorLastName}
      </p>
      <p className="mt-1 whitespace-pre-wrap">{d.entry.diary_text}</p>
      {audio ? (
        isDriveFileId(audio) ? (
          <a href={driveFileViewUrl(audio)} target="_blank" rel="noreferrer" className="mt-2 inline-block underline">
            🎧 Listen to the testimonial in Google Drive
          </a>
        ) : (
          <audio controls preload="none" src={assetHref(audio)} className="mt-2 w-full" aria-label={`Oral history testimonial by ${d.authorFirstName} ${d.authorLastName}`}>
            <a href={assetHref(audio)}>Download the testimonial</a>
          </audio>
        )
      ) : null}
    </li>
  );
}

function AnnalsEditor({ year, councilId, onDone }: { year: LegacyYear; councilId: number; onDone: (saved: boolean) => Promise<void> }) {
  const user = useUser();
  const a = year.annals;
  const [form, setForm] = useState({
    collective_accomplishments: a?.collective_accomplishments ?? '',
    team_metrics_summary: a?.team_metrics_summary ?? '',
    establishment_date: a?.establishment_date ?? '',
    original_chaplain: a?.original_chaplain ?? '',
    charter_photo_url: a?.charter_photo_url ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const input: CouncilAnnalsInput = { ...form };
      await db.history.saveYearAnnals(user.memberId, councilId, year.fraternalYear, input);
      await onDone(true);
    } catch (err) {
      setError(describeError(err));
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded border-2 border-gold bg-white p-4 font-normal text-navy">
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Field label="Collective accomplishments" hint={`What the officer core achieved together. At most ${HISTORY_TEXT_MAX_LENGTH.toLocaleString('en-US')} characters.`}>
        {(id) => <Textarea id={id} value={form.collective_accomplishments} maxLength={HISTORY_TEXT_MAX_LENGTH} onChange={set('collective_accomplishments')} className="min-h-32" />}
      </Field>
      <Field label="Team metrics summary" hint="Council-wide totals for the tenure, such as members recruited, service hours or funds raised. No individual scores.">
        {(id) => <Textarea id={id} value={form.team_metrics_summary} maxLength={HISTORY_TEXT_MAX_LENGTH} onChange={set('team_metrics_summary')} className="min-h-24" />}
      </Field>
      <details>
        <summary className="cursor-pointer text-sm font-bold">Founding facts (fill in on the council&apos;s earliest year)</summary>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          <Field label="Establishment date">{(id) => <Input id={id} type="date" value={form.establishment_date} onChange={set('establishment_date')} />}</Field>
          <Field label="Original chaplain">
            {(id) => <Input id={id} value={form.original_chaplain} maxLength={ORIGINAL_CHAPLAIN_MAX_LENGTH} onChange={set('original_chaplain')} />}
          </Field>
          <Field label="Charter photo" hint="A Google Drive file id or an https link.">
            {(id) => <Input id={id} value={form.charter_photo_url} onChange={set('charter_photo_url')} />}
          </Field>
        </div>
      </details>
      <div className="flex gap-2">
        <Button onClick={() => void save()} disabled={saving}>
          {saving ? 'Saving…' : `Save ${year.fraternalYear}`}
        </Button>
        <Button variant="secondary" onClick={() => void onDone(false)} disabled={saving}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function YearCard({ year, matrix, reload }: { year: LegacyYear; matrix: CouncilLegacyMatrix; reload: () => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const id = `history-year-${year.fraternalYear}`;
  const current = year.fraternalYear === matrix.currentFraternalYear;
  return (
    <SummaryCard id={id} title={`Fraternal Year ${year.fraternalYear}${current ? ' (current)' : ''}`}>
      {editing ? (
        <AnnalsEditor
          year={year}
          councilId={matrix.councilId}
          onDone={async (saved) => {
            if (saved) await reload();
            setEditing(false);
          }}
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(16rem,22rem)_1fr]">
          <section aria-label={`Officer core, ${year.fraternalYear}`}>
            <h3 className="mb-2 text-sm uppercase tracking-wide text-muted">Seated officer core</h3>
            <OfficerCore year={year} />
          </section>
          <section aria-label={`Team record, ${year.fraternalYear}`} className="flex flex-col gap-4">
            <Prose label="Collective accomplishments" text={year.annals?.collective_accomplishments} />
            <Prose label="Team metrics" text={year.annals?.team_metrics_summary} />
            {matrix.canKeepAnnals ? (
              <div>
                <Button variant="gold" onClick={() => setEditing(true)}>
                  Edit year
                </Button>
              </div>
            ) : null}
          </section>
        </div>
      )}
      {year.diary.length > 0 ? (
        <section aria-label={`Diary and oral histories, ${year.fraternalYear}`} className="mt-6">
          <h3 className="mb-2 text-sm uppercase tracking-wide text-muted">Diary and oral histories</h3>
          <ul className="flex flex-col gap-2">
            {year.diary.map((d) => (
              <DiaryEntry key={d.entry.id} d={d} />
            ))}
          </ul>
        </section>
      ) : null}
    </SummaryCard>
  );
}

function WrittenEntry({ matrix, reload }: { matrix: CouncilLegacyMatrix; reload: () => Promise<void> }) {
  const user = useUser();
  const maxChars = platformSettings(usePlatformSettings()).diary_text_max_length;
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);
  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await db.history.addDiaryEntry(user.memberId, matrix.councilId, { fraternal_year: matrix.currentFraternalYear, diary_text: text });
      setText('');
      setMessage({ tone: 'info', text: "Today's diary entry is saved." });
      await reload();
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-2">
      {message ? (
        <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
          {message.text}
        </Notice>
      ) : null}
      <Field label={`Today's written entry (filed under ${matrix.currentFraternalYear})`} hint="One entry per day: a written entry or a recording.">
        {(id) => <Textarea id={id} value={text} maxLength={maxChars} onChange={(e) => setText(e.target.value)} disabled={!!matrix.myEntryToday} />}
      </Field>
      <div>
        <Button onClick={() => void save()} disabled={busy || !text.trim() || !!matrix.myEntryToday}>
          {busy ? 'Saving…' : 'Save written entry'}
        </Button>
      </div>
    </div>
  );
}

function CouncilHistory() {
  const user = useUser();
  const matrix = useLoad(() => db.history.getLegacyMatrix(user.memberId, user.councilId), [user.memberId, user.councilId]);
  const roll = useLoad(() => db.history.getInMemoriamRoll(user.memberId, user.councilId), [user.memberId, user.councilId]);
  const m = matrix.data;
  return (
    <>
      <PageTitle>Council History</PageTitle>
      <div className="flex flex-col gap-6">
        {matrix.error ? <Notice tone="error">{matrix.error}</Notice> : null}
        {m ? (
          <>
            <Founding matrix={m} />
            <Panel title="Spiritual diary and oral history">
              <div className="flex flex-col gap-6">
                {m.myTestimonial ? (
                  <Notice tone="info">
                    Your Oral History Testimonial is on file ({longDate(m.myTestimonial.entry_date)}, filed under {m.myTestimonial.fraternal_year}). Each member
                    records one.
                  </Notice>
                ) : (
                  <OralHistoryRecorder years={m.years.map((y) => y.fraternalYear)} defaultYear={m.currentFraternalYear} todaysEntry={m.myEntryToday} onSaved={matrix.reload} />
                )}
                <WrittenEntry matrix={m} reload={matrix.reload} />
              </div>
            </Panel>
            {roll.error ? <Notice tone="error">{roll.error}</Notice> : null}
            {roll.data ? <InMemoriamDeck roll={roll.data} reload={roll.reload} /> : null}
            {m.years.map((y) => (
              <YearCard key={y.fraternalYear} year={y} matrix={m} reload={matrix.reload} />
            ))}
          </>
        ) : null}
      </div>
    </>
  );
}

export default function HistoryPage() {
  return (
    <RequireArea area="history">
      <CouncilHistory />
    </RequireArea>
  );
}
