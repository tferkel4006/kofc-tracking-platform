'use client';
// The web Faith Center (Sprint 6L Extension 3): the portal's own copy of the phone app's spiritual center, on one page
// instead of the Donations page's old side widget (FaithCenterMirror, removed so the finance screens stay on the books).
//   - the Liturgical Feast Day banner (liturgicalBanner) with the crimson Holy Day of Obligation badge and its note;
//   - the Daily Bible Verse (dailyVerse, NABRE only, with its notice) and the feasts of the coming two weeks;
//   - the Council Prayer Intentions List: every member posts intentions and taps '[ 🙏 Praying Hands ]' to pray for one,
//     once a day per intention (prayers.*). The author, officers, Admins and Super Admins close an intention.
// A Knights of Columbus extension: a white-label tenant does not get the area (FRATERNAL_AREAS), and RequireArea says so.
import { useState, type FormEvent } from 'react';
import {
  addDays,
  dailyVerse,
  describeError,
  describePrayerCount,
  HOLY_DAY_BADGE,
  liturgicalBanner,
  NABRE_NOTICE,
  observancesBetween,
  platformSettings,
  PRAYING_HANDS_LABEL,
  toIsoDate,
  type PrayerIntentionDetail,
} from '@kofc/shared';
import { RequireArea } from '@/components/CouncilScope';
import { Button, Empty, Field, Notice, PageTitle, Panel, Textarea } from '@/components/ui';
import { useUser } from '@/lib/session';
import { usePlatformSettings } from '@/components/SettingsParts';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

/** How far ahead the page lists coming feasts, holy days and holidays (as the phone's modal does). */
const UPCOMING_DAYS = 14;

const shortDay = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

function HolyDayBadge() {
  return <p className="inline-block rounded bg-crimson px-2 py-0.5 text-sm font-bold text-white">{HOLY_DAY_BADGE}</p>;
}

function FeastBanner({ today }: { today: string }) {
  const banner = liturgicalBanner(today);
  return (
    <section
      aria-labelledby="faith-feast"
      data-surface="navy"
      className={`rounded border-l-8 bg-navy p-5 text-white ${banner.holyDayOfObligation ? 'border-crimson' : 'border-gold'}`}
    >
      <p className="text-xs font-bold uppercase tracking-wide">Liturgical feast or saint day</p>
      <h2 id="faith-feast" className="mt-1 font-serif text-2xl font-bold">
        {banner.text}
      </h2>
      {banner.holyDayOfObligation ? (
        <div className="mt-2">
          <HolyDayBadge />
        </div>
      ) : null}
      {banner.note ? <p className="mt-2">{banner.note}</p> : null}
    </section>
  );
}

function DailyVerse({ today }: { today: string }) {
  const verse = dailyVerse(today);
  const upcoming = observancesBetween(addDays(today, 1), addDays(today, UPCOMING_DAYS));
  return (
    <Panel title="Daily Bible Verse">
      <blockquote className="border-l-8 border-gold pl-4">
        <p className="font-serif text-xl">“{verse.text}”</p>
        <p className="mt-2 font-bold">{verse.reference} (NABRE)</p>
      </blockquote>
      {upcoming.length > 0 ? (
        <div className="mt-5">
          <h3 className="text-xs font-bold uppercase tracking-wide text-navy">Coming {UPCOMING_DAYS} days</h3>
          <ul className="mt-2 flex flex-col gap-2">
            {upcoming.map((o) => (
              <li key={`${o.date}-${o.title}`}>
                <span className="font-bold">{shortDay(o.date)}</span> · {o.title}
                {o.kind === 'holiday' ? ' (national holiday)' : ''}
                {o.holyDayOfObligation ? (
                  <span className="ml-2">
                    <HolyDayBadge />
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="mt-4 text-xs text-muted">{NABRE_NOTICE}</p>
    </Panel>
  );
}

function IntentionRow({ item, onChanged }: { item: PrayerIntentionDetail; onChanged: () => Promise<void> }) {
  const user = useUser();
  const [count, setCount] = useState(item.prayerCount);
  const [prayed, setPrayed] = useState(item.prayedByMeToday);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pray = async () => {
    setBusy(true);
    setError(null);
    try {
      const tally = await db.prayers.pray(user.memberId, item.intention.id);
      setCount(tally.prayerCount);
      setPrayed(tally.prayedByMeToday);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  const close = async () => {
    setBusy(true);
    setError(null);
    try {
      await db.prayers.closeIntention(user.memberId, item.intention.id);
      await onChanged();
    } catch (err) {
      setError(describeError(err));
      setBusy(false);
    }
  };

  return (
    <li className="rounded border-2 border-navy bg-white p-4">
      <p className="text-lg">{item.intention.intention_text}</p>
      <p className="mt-1 text-sm text-muted">
        Asked by {item.authorFirstName} {item.authorLastName}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button variant={prayed ? 'secondary' : 'gold'} onClick={() => void pray()} disabled={busy || prayed} aria-pressed={prayed}>
          {PRAYING_HANDS_LABEL}
        </Button>
        <span className="font-bold" aria-live="polite">
          {describePrayerCount(count)}
          {prayed ? ' · You prayed for this today.' : ''}
        </span>
        {item.mayClose ? (
          <Button variant="secondary" size="sm" onClick={() => void close()} disabled={busy}>
            Close intention
          </Button>
        ) : null}
      </div>
      {error ? (
        <div className="mt-2">
          <Notice tone="error" onDismiss={() => setError(null)}>
            {error}
          </Notice>
        </div>
      ) : null}
    </li>
  );
}

function NewIntention({ councilId, onSaved }: { councilId: number; onSaved: () => Promise<void> }) {
  const user = useUser();
  const maxChars = platformSettings(usePlatformSettings()).prayer_intention_max_length;
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await db.prayers.addIntention(user.memberId, councilId, text);
      setText('');
      await onSaved();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-3">
      <Field label="Ask the council to pray" hint="Your name shows with the intention. Every member of the council can read it.">
        {(id) => (
          <Textarea
            id={id}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. For my father's recovery after surgery."
            maxLength={maxChars}
            rows={3}
            disabled={busy}
          />
        )}
      </Field>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={busy || !text.trim()}>
          {busy ? 'Posting…' : 'Post intention'}
        </Button>
        <span className="text-sm text-muted">
          {text.length} / {maxChars}
        </span>
      </div>
      {error ? (
        <Notice tone="error" onDismiss={() => setError(null)}>
          {error}
        </Notice>
      ) : null}
    </form>
  );
}

function PrayerIntentions() {
  const user = useUser();
  const board = useLoad(() => db.prayers.getBoard(user.memberId, user.councilId), [user.memberId, user.councilId]);
  const b = board.data;
  return (
    <Panel title="Council Prayer Intentions">
      <div className="flex flex-col gap-5">
        {board.error ? <Notice tone="error">{board.error}</Notice> : null}
        <NewIntention councilId={user.councilId} onSaved={board.reload} />
        {b ? (
          b.intentions.length === 0 ? (
            <Empty>No open intentions. Post the first one above.</Empty>
          ) : (
            <ul className="flex flex-col gap-3">
              {b.intentions.map((item) => (
                <IntentionRow key={`${item.intention.id}-${item.prayerCount}`} item={item} onChanged={board.reload} />
              ))}
            </ul>
          )
        ) : null}
      </div>
    </Panel>
  );
}

function FaithCenter() {
  const today = toIsoDate(new Date());
  return (
    <>
      <PageTitle>Faith Center</PageTitle>
      <div className="flex flex-col gap-6">
        <FeastBanner today={today} />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <DailyVerse today={today} />
          <PrayerIntentions />
        </div>
      </div>
    </>
  );
}

export default function FaithCenterPage() {
  return (
    <RequireArea area="faith-center">
      <FaithCenter />
    </RequireArea>
  );
}
