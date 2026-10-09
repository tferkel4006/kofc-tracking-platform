'use client';
// Sprint 6L Extension 5: the In Memoriam card deck on the Council History page. One black card with gold type per
// deceased brother on the roster (history.getInMemoriamRoll): a photo, the officer seats held, the compiled
// summary of the council's accomplishments and totals in those leadership years, a biography and past councils. The
// history keepers edit the photo, biography and past councils, and recompile the stored snapshot of the roll.
import { useState } from 'react';
import {
  describeError,
  driveFileViewUrl,
  IN_MEMORIAM_PAST_COUNCILS_MAX_LENGTH,
  IN_MEMORIAM_TEXT_MAX_LENGTH,
  IN_MEMORIAM_TITLE,
  isDriveFileId,
  type InMemoriamCard,
  type InMemoriamRoll,
} from '@kofc/shared';
import { Button, Field, Input, Notice, Textarea } from '@/components/ui';
import { useUser } from '@/lib/session';
import { db } from '@/services/db';

const longDate = (iso: string | null | undefined) =>
  iso ? new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString('en-US', { dateStyle: 'long' }) : null;

function Photo({ card }: { card: InMemoriamCard }) {
  const name = `${card.firstName} ${card.lastName}`;
  if (!card.photoUrl) {
    return (
      <div aria-hidden="true" className="flex size-24 shrink-0 items-center justify-center rounded border-2 border-gold font-serif text-3xl">
        {card.firstName.charAt(0)}
        {card.lastName.charAt(0)}
      </div>
    );
  }
  if (isDriveFileId(card.photoUrl)) {
    return (
      <a href={driveFileViewUrl(card.photoUrl)} target="_blank" rel="noreferrer" className="flex size-24 shrink-0 items-center justify-center rounded border-2 border-gold p-1 text-center text-xs underline">
        Photo of {name} in Google Drive
      </a>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element -- a remembrance photo from any https host, shown as is
  return <img src={card.photoUrl} alt={`Brother ${name}`} className="size-24 shrink-0 rounded border-2 border-gold object-cover" />;
}

function Editor({ card, councilId, onDone }: { card: InMemoriamCard; councilId: number; onDone: (saved: boolean) => Promise<void> }) {
  const user = useUser();
  const [form, setForm] = useState({ photo_url: card.photoUrl ?? '', biography: card.biography ?? '', past_councils: card.pastCouncils ?? '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await db.history.saveInMemoriamEntry(user.memberId, councilId, card.memberId, form);
      await onDone(true);
    } catch (err) {
      setError(describeError(err));
      setSaving(false);
    }
  };
  return (
    <div className="mt-4 flex flex-col gap-3 rounded border-2 border-gold bg-white p-4 text-navy">
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Field label="Photo" hint="A Google Drive file id or an https link.">
        {(id) => <Input id={id} value={form.photo_url} onChange={set('photo_url')} />}
      </Field>
      <Field label="Biography" hint={`At most ${IN_MEMORIAM_TEXT_MAX_LENGTH.toLocaleString('en-US')} characters.`}>
        {(id) => <Textarea id={id} value={form.biography} maxLength={IN_MEMORIAM_TEXT_MAX_LENGTH} onChange={set('biography')} className="min-h-28" />}
      </Field>
      <Field label="Past councils" hint="Other councils the brother belonged to, such as 'Council 4511, Salem (1988-1996)'.">
        {(id) => <Input id={id} value={form.past_councils} maxLength={IN_MEMORIAM_PAST_COUNCILS_MAX_LENGTH} onChange={set('past_councils')} />}
      </Field>
      <div className="flex gap-2">
        <Button onClick={() => void save()} disabled={saving}>
          {saving ? 'Saving…' : 'Save remembrance'}
        </Button>
        <Button variant="secondary" onClick={() => void onDone(false)} disabled={saving}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function MemorialCard({ card, roll, reload }: { card: InMemoriamCard; roll: InMemoriamRoll; reload: () => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const headingId = `in-memoriam-${card.memberId}`;
  return (
    <article aria-labelledby={headingId} className="flex flex-col rounded border-4 border-gold bg-memorial p-5 text-gold">
      <div className="flex items-start gap-4">
        <Photo card={card} />
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-widest">✝ In loving memory</p>
          <h3 id={headingId} className="font-serif text-2xl font-bold">
            Brother {card.firstName} {card.lastName}
          </h3>
          {card.dateJoinedCouncil ? <p className="text-sm">Joined the council {longDate(card.dateJoinedCouncil)}</p> : null}
        </div>
      </div>
      <dl className="mt-4 flex flex-col gap-3 border-t-2 border-gold pt-3">
        <div>
          <dt className="text-xs font-bold uppercase tracking-widest">Officer seats held</dt>
          <dd className="mt-1">{card.officerSeatsHeld || 'No officer seat recorded'}</dd>
        </div>
        <div>
          <dt className="text-xs font-bold uppercase tracking-widest">Legacy of leadership</dt>
          <dd className="mt-1 whitespace-pre-wrap leading-relaxed">{card.leadershipSummary}</dd>
        </div>
        {card.biography ? (
          <div>
            <dt className="text-xs font-bold uppercase tracking-widest">Biography</dt>
            <dd className="mt-1 whitespace-pre-wrap leading-relaxed">{card.biography}</dd>
          </div>
        ) : null}
        {card.pastCouncils ? (
          <div>
            <dt className="text-xs font-bold uppercase tracking-widest">Past councils</dt>
            <dd className="mt-1">{card.pastCouncils}</dd>
          </div>
        ) : null}
      </dl>
      {roll.canKeep ? (
        editing ? (
          <Editor
            card={card}
            councilId={roll.councilId}
            onDone={async (saved) => {
              if (saved) await reload();
              setEditing(false);
            }}
          />
        ) : (
          <div className="mt-4">
            <Button variant="gold" size="sm" className="border-gold" onClick={() => setEditing(true)}>
              Edit remembrance
            </Button>
          </div>
        )
      ) : null}
    </article>
  );
}

/** The In Memoriam roll: a black-and-gold card per deceased brother on the roster. */
export function InMemoriamDeck({ roll, reload }: { roll: InMemoriamRoll; reload: () => Promise<void> }) {
  const user = useUser();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);
  const compile = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const saved = await db.history.compileInMemoriam(user.memberId, roll.councilId);
      setMessage({ tone: 'info', text: `Compiled ${saved.cards.length} ${saved.cards.length === 1 ? 'remembrance' : 'remembrances'}.` });
      await reload();
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setBusy(false);
    }
  };
  return (
    <section aria-labelledby="history-in-memoriam" className="rounded border-4 border-gold bg-memorial p-4 text-gold sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 id="history-in-memoriam" className="font-serif text-3xl font-bold">
            {IN_MEMORIAM_TITLE}
          </h2>
          <p className="mt-1">Our departed brothers, the seats they held and what the council achieved while they led.</p>
        </div>
        {roll.canKeep && roll.cards.length > 0 ? (
          <Button variant="gold" className="border-gold" onClick={() => void compile()} disabled={busy}>
            {busy ? 'Compiling…' : 'Recompile the roll'}
          </Button>
        ) : null}
      </div>
      {message ? (
        <div className="mt-3">
          <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
            {message.text}
          </Notice>
        </div>
      ) : null}
      {roll.cards.length === 0 ? (
        <p className="mt-4">No brother on the council roster is marked Deceased.</p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {roll.cards.map((card) => (
            <MemorialCard key={card.memberId} card={card} roll={roll} reload={reload} />
          ))}
        </div>
      )}
    </section>
  );
}
