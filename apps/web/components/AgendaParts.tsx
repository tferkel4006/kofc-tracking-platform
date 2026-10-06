'use client';
// The St. Mary's live agenda (Sprint 6B): the meeting's order of business as a high-contrast, magazine-style board on
// the Live Meeting Console (meetings.getMeetingAgenda, polled like the live state so a second screen follows along).
//   - Every speaker is read from the council's seats and members when the agenda is read; Upcoming Events comes
//     straight from the council's calendar, and New Business lists the meeting's motions.
//   - The Grand Knight, the Recorder and the council's Admins (canEditLiveAgenda) click any line to correct it in place:
//     a markdown textarea opens on the line, Ctrl+Enter saves (meetings.editAgendaLine), Escape cancels.
//   - Motion lines under New and Old Business carry the Recorder's 'Record Hand Ballot Tally' drawer
//     (meetings.recordHandBallotTally): the split decides the motion, its status badge updates, and a motion that
//     released capital is tied to its general-ledger posting (finance.listLedgerTransactions).
//   - Sprint 6B Patch: each section header carries '[ ➕ Add Last-Minute Agenda Line ]' for the editors
//     (meetings.addAgendaLine): a blank line is stored at once and opens for typing; every screen shows it on its next
//     read. The line the chair put on the floor (LiveAgendaItem.lineKey) is framed in gold with an 'On the floor' tag.
import { useEffect, useState, type KeyboardEvent } from 'react';
import {
  AGENDA_LINE_MAX_LENGTH,
  canReadGeneralLedger,
  describeError,
  handTallyResult,
  HAND_TALLY_MAX_COUNT,
  LEGISLATIVE_SECTION_KEYS,
  LIVE_AGENDA_ITEM_NAME_MAX_LENGTH,
  locateActiveAgendaLine,
  parseAgendaMarkdown,
  type AgendaSectionKey,
  type AgendaLineView,
  type MeetingAgendaView,
} from '@kofc/shared';
import { Drawer } from '@/components/Drawer';
import { Button, cx, Field, Notice, Pill, Select, Textarea } from '@/components/ui';
import { formatFullDate, formatMoney } from '@/lib/format';
import { useUser } from '@/lib/session';
import { db } from '@/services/db';

/** How often the board re-reads the agenda, as the console re-reads the live state. */
const AGENDA_POLL_MS = 3000;
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const RESULT_TONE: Record<string, 'navy' | 'red' | 'gold' | 'outline'> = { Pending: 'outline', Passed: 'navy', Failed: 'red', Tabled: 'gold' };

/** An agenda line's light markdown (**bold**, *italic*, '- ' bullets) as React elements - never as HTML. */
export function AgendaMarkdown({ text, className }: { text: string; className?: string }) {
  const blocks = parseAgendaMarkdown(text);
  const bullets = blocks.filter((b) => b.kind === 'bullet');
  const spans = (b: (typeof blocks)[number]) =>
    b.spans.map((s, i) => (
      <span key={i} className={cx(s.bold && 'font-bold', s.italic && 'italic')}>
        {s.text}
      </span>
    ));
  return (
    <div className={className}>
      {blocks
        .filter((b) => b.kind === 'paragraph')
        .map((b, i) => (
          <p key={i}>{spans(b)}</p>
        ))}
      {bullets.length ? (
        <ul className="mt-1 list-disc pl-6">
          {bullets.map((b, i) => (
            <li key={i}>{spans(b)}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** The first line of an agenda line as plain text, for the console's center bar. */
const plainTopic = (markdown: string): string =>
  (parseAgendaMarkdown(markdown)[0]?.spans.map((s) => s.text).join('') ?? '').trim().slice(0, LIVE_AGENDA_ITEM_NAME_MAX_LENGTH);

const stampTime = (stamp: string): string => {
  const at = new Date(`${stamp.replace(' ', 'T')}Z`);
  return Number.isNaN(at.getTime()) ? stamp : at.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
};

function StatusBadge({ line }: { line: AgendaLineView }) {
  if (!line.motion) return null;
  const { VoteResult } = line.motion;
  return (
    <span className="flex flex-wrap items-center gap-1.5" aria-live="polite">
      <Pill tone={RESULT_TONE[VoteResult] ?? 'outline'}>{VoteResult}</Pill>
      {line.handTally ? (
        <span className="rounded border-2 border-navy px-2 py-0.5 text-xs font-bold tabular-nums">
          Hands {line.handTally.ApprovedCount} – {line.handTally.DeniedCount}
        </span>
      ) : null}
      {line.handTally?.LinkedTransactionID ? <Pill tone="gold">Ledger linked</Pill> : null}
    </span>
  );
}

function AgendaLine({
  line,
  number,
  canEdit,
  canPush,
  busy,
  onFloor,
  startEditing,
  onSave,
  onTally,
  onPush,
}: {
  line: AgendaLineView;
  number: string;
  canEdit: boolean;
  canPush: boolean;
  busy: boolean;
  /** The chair put this line on the floor. */
  onFloor: boolean;
  /** Open the editor straight away (a last-minute line just added from this screen). */
  startEditing: boolean;
  onSave: (markdown: string) => Promise<boolean>;
  onTally: () => void;
  onPush: () => void;
}) {
  const [draft, setDraft] = useState<string | null>(startEditing ? line.markdown : null);
  const blank = line.markdown.trim() === '';

  const save = async () => {
    if (draft === null || draft.trim() === '') return;
    if (await onSave(draft)) setDraft(null);
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      setDraft(null);
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void save();
    }
  };
  const legislative = !!line.motion && LEGISLATIVE_SECTION_KEYS.includes(line.section);
  const tallyOpen = legislative && line.motion!.VoteResult === 'Pending' && line.motion!.BallotOpenedAt == null;
  const linkable = legislative && !!line.handTally && line.motion!.VoteResult === 'Passed' && !line.handTally.LinkedTransactionID;

  return (
    <li
      aria-current={onFloor ? 'step' : undefined}
      className={cx(
        'grid grid-cols-[2.25rem_1fr] gap-x-3 border-b border-line py-3 last:border-b-0',
        legislative && !onFloor && 'rounded border-l-8 border-l-gold bg-white pl-2',
        onFloor && 'rounded border-4 border-navy bg-gold px-2',
      )}
    >
      <span className="pt-0.5 text-right font-serif text-lg font-bold tabular-nums text-navy">{number}</span>
      <div className="flex min-w-0 flex-col gap-2">
        {onFloor ? (
          <span className="self-start rounded-full bg-navy px-3 py-0.5 text-xs font-bold uppercase tracking-wide text-white">On the floor</span>
        ) : null}
        {draft === null ? (
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
            {canEdit ? (
              <button
                type="button"
                onClick={() => setDraft(line.markdown)}
                title="Click to correct this line"
                className="min-w-0 flex-1 cursor-text rounded text-left text-lg leading-snug hover:bg-gold/20 focus-visible:bg-gold/20"
              >
                {blank ? <span className="italic text-muted">Blank last-minute line - click to write it</span> : <AgendaMarkdown text={line.markdown} />}
              </button>
            ) : (
              <AgendaMarkdown text={line.markdown} className="min-w-0 flex-1 text-lg leading-snug" />
            )}
            {line.speaker ? (
              <p className="shrink-0 text-right">
                <span className="block font-bold">{line.speaker.name}</span>
                {line.speaker.roleName ? <span className="block text-xs font-bold uppercase tracking-wide text-muted">{line.speaker.roleName}</span> : null}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <Textarea
              autoFocus
              aria-label={`Correct agenda line ${number}`}
              value={draft}
              maxLength={AGENDA_LINE_MAX_LENGTH}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKey}
              className="text-base"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" disabled={busy || draft.trim() === ''} onClick={() => void save()}>
                Save line
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setDraft(null)}>
                Cancel
              </Button>
              <span className="text-xs text-muted">**bold**, *italic*, a line starting “- ” is a bullet · Ctrl+Enter saves · Esc cancels</span>
            </div>
          </div>
        )}
        {(legislative || line.lastEditedAt || canPush) && draft === null ? (
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge line={line} />
            {tallyOpen && canEdit ? (
              <Button size="sm" variant="gold" disabled={busy} onClick={onTally}>
                Record Hand Ballot Tally
              </Button>
            ) : null}
            {linkable && canEdit ? (
              <Button size="sm" variant="secondary" disabled={busy} onClick={onTally}>
                Link ledger posting
              </Button>
            ) : null}
            {canPush ? (
              <Button size="sm" variant="secondary" disabled={busy} onClick={onPush} title="Put this line on the center bar">
                ▶ To the floor
              </Button>
            ) : null}
            {line.lastEditedAt ? (
              <span className="text-xs italic text-muted">
                Corrected {stampTime(line.lastEditedAt)}
                {line.lastEditedByName ? ` by ${line.lastEditedByName}` : ''}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </li>
  );
}

/**
 * The Recorder's hand-vote drawer: '[ Record Hand Tally: ___ Approved | ___ Denied ]'. Enter saves. A passing motion
 * can be tied to the ledger posting that released its capital; a tallied, passed motion opens in link-only mode.
 */
export function HandTallyDrawer({
  line,
  councilId,
  onClose,
  onSaved,
}: {
  line: AgendaLineView;
  councilId: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const user = useUser();
  const motion = line.motion!;
  const linkOnly = !!line.handTally;
  const [approved, setApproved] = useState('');
  const [denied, setDenied] = useState('');
  const [releases, setReleases] = useState(linkOnly);
  const [transactionId, setTransactionId] = useState('');
  const [postings, setPostings] = useState<Awaited<ReturnType<typeof db.finance.listLedgerTransactions>>>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const mayReadLedger = canReadGeneralLedger(user, councilId);

  useEffect(() => {
    if (!mayReadLedger || !releases) return;
    let alive = true;
    db.finance.listLedgerTransactions(user.memberId, councilId, { limit: 25 }).then(
      (rows) => alive && setPostings(rows),
      (err: unknown) => alive && setError(describeError(err)),
    );
    return () => {
      alive = false;
    };
  }, [mayReadLedger, releases, user.memberId, councilId]);

  const count = (text: string): number | null => (/^\d{1,4}$/.test(text.trim()) ? Number(text.trim()) : null);
  const a = count(approved);
  const d = count(denied);
  const valid = a !== null && d !== null && a + d > 0 && a <= HAND_TALLY_MAX_COUNT && d <= HAND_TALLY_MAX_COUNT;
  const result = valid ? handTallyResult(a, d) : null;

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const txn = releases && result !== 'Failed' && transactionId ? transactionId : null;
      if (linkOnly) await db.meetings.linkHandTallyTransaction(user.memberId, motion.id, txn);
      else {
        if (!valid) return;
        await db.meetings.recordHandBallotTally(user.memberId, motion.id, a, d, { transactionId: txn });
      }
      onSaved();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  };
  const enterSaves = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void save();
    }
  };
  const countBox = 'w-28 rounded border-4 border-navy bg-white px-2 py-2 text-center text-4xl font-bold tabular-nums focus:border-gold focus:outline-none';

  return (
    <Drawer title={linkOnly ? 'Link the Released Capital' : 'Record Hand Ballot Tally'} onClose={onClose} wide>
      <div className="flex flex-col gap-1">
        <p className="text-xs font-bold uppercase tracking-wide">Motion #{motion.id}</p>
        <AgendaMarkdown text={line.markdown} className="font-serif text-xl" />
      </div>
      {error ? (
        <Notice tone="error" onDismiss={() => setError(null)}>
          {error}
        </Notice>
      ) : null}
      {linkOnly ? (
        <StatusBadge line={line} />
      ) : (
        <fieldset className="flex flex-col gap-3 rounded border-2 border-navy p-4">
          <legend className="px-1 text-sm font-bold">Count the hands, then save</legend>
          <div className="flex flex-wrap items-center justify-center gap-3 font-serif text-2xl font-bold" role="group" aria-label="Record Hand Tally">
            <span aria-hidden="true">[</span>
            <span>Record Hand Tally:</span>
            <label className="flex items-center gap-2">
              <input
                autoFocus
                inputMode="numeric"
                pattern="[0-9]*"
                aria-label="Approved hands"
                className={countBox}
                value={approved}
                onChange={(e) => setApproved(e.target.value.replace(/\D/g, '').slice(0, 4))}
                onKeyDown={enterSaves}
              />
              Approved
            </label>
            <span aria-hidden="true">|</span>
            <label className="flex items-center gap-2">
              <input
                inputMode="numeric"
                pattern="[0-9]*"
                aria-label="Denied hands"
                className={countBox}
                value={denied}
                onChange={(e) => setDenied(e.target.value.replace(/\D/g, '').slice(0, 4))}
                onKeyDown={enterSaves}
              />
              Denied
            </label>
            <span aria-hidden="true">]</span>
          </div>
          <p className="text-center text-sm" aria-live="polite">
            {result ? (
              <>
                The motion <strong>{result === 'Passed' ? 'passes' : 'fails'}</strong> {a} to {d}
                {result === 'Failed' && a === d ? ' (a tie fails)' : ''}.
              </>
            ) : (
              'Type both counts; at least one hand.'
            )}
          </p>
        </fieldset>
      )}

      {linkOnly || result !== 'Failed' ? (
        <div className="flex flex-col gap-2">
          {!linkOnly ? (
            <label className="flex items-center gap-2 text-sm font-bold">
              <input type="checkbox" checked={releases} onChange={(e) => setReleases(e.target.checked)} className="h-5 w-5 accent-navy" />
              This motion releases capital - tie it to the ledger posting
            </label>
          ) : null}
          {releases ? (
            mayReadLedger ? (
              <Field label="General-ledger posting" hint="The double-entry posting that paid out the funds; the Financial Secretary or Treasurer can link it later.">
                {(id) => (
                  <Select id={id} value={transactionId} onChange={(e) => setTransactionId(e.target.value)}>
                    <option value="">{linkOnly ? 'No posting (unlink)' : 'Not posted yet - link it later'}</option>
                    {postings.map((p) => (
                      <option key={p.transactionId} value={p.transactionId}>
                        {formatFullDate(p.dateLogged.slice(0, 10))} · {formatMoney(p.amount)} · {p.description}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            ) : (
              <p className="text-sm">Only the council&apos;s leadership reads the books; the Financial Secretary or Treasurer can link the posting later.</p>
            )
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button variant="gold" disabled={busy || (!linkOnly && !valid)} onClick={() => void save()}>
          {linkOnly ? 'Save link' : 'Save tally & decide the motion'}
        </Button>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </Drawer>
  );
}

/** The St. Mary's order of business for the console's meeting. */
export function LiveAgendaBoard({
  meetingId,
  councilId,
  canEdit,
  live,
  canPush,
  activeLineKey,
  onPush,
  onChanged,
}: {
  meetingId: number;
  councilId: number;
  canEdit: boolean;
  live: boolean;
  canPush: boolean;
  /** The line on the floor (LiveAgendaItem.lineKey), framed on the board. */
  activeLineKey: string | null;
  onPush: (topic: string, lineKey: string) => void;
  onChanged: () => void;
}) {
  const user = useUser();
  const [view, setView] = useState<MeetingAgendaView>();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tallying, setTallying] = useState<AgendaLineView | null>(null);
  /** The last-minute line this screen just added, opened for typing. */
  const [addedKey, setAddedKey] = useState<string | null>(null);

  const addLine = async (section: AgendaSectionKey) => {
    setBusy(true);
    setError(null);
    try {
      const { agenda, line } = await db.meetings.addAgendaLine(user.memberId, meetingId, section);
      setView(agenda);
      setAddedKey(line.key);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    let alive = true;
    setView(undefined);
    const read = () =>
      db.meetings.getMeetingAgenda(user.memberId, meetingId).then(
        (next) => alive && setView(next),
        (err: unknown) => alive && setError(describeError(err)),
      );
    void read();
    const timer = window.setInterval(() => void read(), AGENDA_POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [meetingId, user.memberId]);

  const run = async (write: () => Promise<MeetingAgendaView | unknown>): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      const next = await write();
      setView(next && typeof next === 'object' && 'sections' in next ? (next as MeetingAgendaView) : await db.meetings.getMeetingAgenda(user.memberId, meetingId));
      return true;
    } catch (err) {
      setError(describeError(err));
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (!view) return error ? <Notice tone="error">{error}</Notice> : <p className="text-sm">Loading the agenda…</p>;
  const { meeting } = view;
  const floorSection = locateActiveAgendaLine(view, activeLineKey)?.sectionIndex ?? -1;
  let numbered = 0;

  return (
    <section aria-label="Order of business" className="overflow-hidden rounded border-4 border-navy bg-white">
      <header data-surface="navy" className="flex flex-wrap items-end justify-between gap-4 border-b-8 border-gold bg-navy px-6 py-5 text-white">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-gold">Order of Business</p>
          <h2 className="font-serif text-3xl font-bold leading-tight md:text-4xl">{meeting['Meeting Name']}</h2>
          <p className="text-sm">
            {formatFullDate(meeting.Date)} · {meeting.Location}
          </p>
        </div>
        {canEdit ? <p className="max-w-xs text-right text-xs">Click any line to correct it on the display.</p> : null}
      </header>

      <div className="flex flex-col gap-2 p-6">
        {error ? (
          <Notice tone="error" onDismiss={() => setError(null)}>
            {error}
          </Notice>
        ) : null}
        {!view.hasStructuredAgenda ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded border-2 border-dashed border-navy p-4">
            <p className="text-sm">
              This meeting has no order of business yet. The St. Mary&apos;s blueprint seats every report on its officer, so speakers follow elections.
            </p>
            {canEdit ? (
              <Button variant="gold" disabled={busy} onClick={() => void run(() => db.meetings.applyAgendaBlueprint(user.memberId, meetingId))}>
                Lay out the St. Mary&apos;s agenda
              </Button>
            ) : null}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-x-10 gap-y-6 xl:grid-cols-2">
          {view.sections.map((s, si) => (
            <div key={s.key} className={cx('flex flex-col', s.key === 'opening' && 'xl:col-span-2')}>
              <div className="flex flex-wrap items-end justify-between gap-2 border-b-4 border-gold pb-1">
                <h3 className={cx('flex items-baseline gap-3 font-serif text-2xl font-bold text-navy', floorSection === si && 'underline decoration-gold decoration-4')}>
                  <span className="tabular-nums">{ROMAN[si]}.</span>
                  {s.title}
                </h3>
                {canEdit ? (
                  <Button size="sm" variant="secondary" disabled={busy} onClick={() => void addLine(s.key)} aria-label={`Add a last-minute line to ${s.title}`}>
                    [ ➕ Add Last-Minute Agenda Line ]
                  </Button>
                ) : null}
              </div>
              {s.key === 'opening' && view.officers.length ? (
                <ul aria-label="Officer array" className="mt-3 flex flex-wrap gap-2">
                  {view.officers.map((o) => (
                    <li key={o.roleId} className="rounded border-2 border-navy px-2 py-1 text-sm">
                      <span className="block text-[0.65rem] font-bold uppercase tracking-wide text-muted">{o.roleName}</span>
                      <span className="font-bold">{o.name}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {s.lines.length ? (
                <ol className="flex flex-col">
                  {s.lines.map((line) => {
                    // A blank last-minute line is the editors' scratch space until it is written; nobody else sees it.
                    if (!canEdit && line.markdown.trim() === '') return null;
                    numbered += 1;
                    return (
                      <AgendaLine
                        key={line.key}
                        line={line}
                        number={String(numbered)}
                        canEdit={canEdit}
                        canPush={canPush && live}
                        busy={busy}
                        onFloor={line.key === activeLineKey}
                        startEditing={line.key === addedKey}
                        onSave={(markdown) => run(() => db.meetings.editAgendaLine(user.memberId, meetingId, line.ref, markdown))}
                        onTally={() => setTallying(line)}
                        onPush={() => onPush(plainTopic(line.markdown) || s.title, line.key)}
                      />
                    );
                  })}
                </ol>
              ) : (
                <p className="py-3 text-sm italic text-muted">
                  {s.key === 'upcoming_events' ? 'Nothing on the council calendar from this meeting on.' : s.key === 'new_business' ? 'No motion is queued for the floor.' : 'Nothing listed.'}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {tallying ? (
        <HandTallyDrawer
          line={tallying}
          councilId={councilId}
          onClose={() => setTallying(null)}
          onSaved={() => {
            setTallying(null);
            void run(() => db.meetings.getMeetingAgenda(user.memberId, meetingId));
            onChanged();
          }}
        />
      ) : null}
    </section>
  );
}
