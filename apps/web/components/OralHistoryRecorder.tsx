'use client';
// Oral History Testimonial recorder (Sprint 6K): records the member's microphone in the browser with MediaRecorder,
// compressed as Opus (WebM or Ogg) or AAC (MP4, Safari) at ORAL_HISTORY_BITS_PER_SECOND, in one-second chunks. On stop
// the recording goes to the council's Google Drive vault under Oral Histories (/api/drive-vault/oral-history) and its file
// id is written to the member's diary entry for today, filed under the chosen fraternal year (history.addDiaryEntry).
// While the vault is switched off the entry keeps a browser blob link, which plays only in this browser session.
// One diary entry per member per day: once today's entry exists the button is disabled.
// Sprint 6M: every session is capped at ORAL_HISTORY_MAX_SECONDS (15 minutes; since Sprint 7C the Super Admins' platform
// limit, PlatformSettings.oral_history_max_seconds). While recording, a countdown
// meter (navy on white, brand red near the end) shows the minutes and seconds left before the recorder stops and
// saves on its own; in the last minute it turns gold and says so. Screen readers hear it each minute, and every second of
// the final ten.
import { useEffect, useRef, useState } from 'react';
import {
  describeError,
  ORAL_HISTORY_BITS_PER_SECOND,
  oralHistoryCountdown,
  oralHistoryFileName,
  pickOralHistoryMimeType,
  platformSettings,
  type CouncilSpiritualDiary,
} from '@kofc/shared';
import { usePlatformSettings } from '@/components/SettingsParts';
import { Button, cx, Field, Notice, Select, Textarea } from '@/components/ui';
import { useUser } from '@/lib/session';
import { db } from '@/services/db';
import { archiveOralHistory, localFileLink } from '@/services/drive-vault-transport';

type Phase = 'idle' | 'starting' | 'recording' | 'saving';

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

/** Why this browser cannot record, or null when it can. */
function recorderUnavailable(): string | null {
  if (typeof window === 'undefined') return 'Recording starts once the page has loaded.';
  if (!window.isSecureContext) return 'The microphone works only over a secure (https) connection.';
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') return 'This browser cannot record audio. Try a current Chrome, Edge, Firefox or Safari.';
  return null;
}

export function OralHistoryRecorder({
  years,
  defaultYear,
  todaysEntry,
  onSaved,
}: {
  years: readonly string[];
  defaultYear: string;
  todaysEntry: CouncilSpiritualDiary | null;
  onSaved: () => Promise<void>;
}) {
  const user = useUser();
  const limits = platformSettings(usePlatformSettings());
  const maxSeconds = limits.oral_history_max_seconds;
  const maxChars = limits.diary_text_max_length;
  const [year, setYear] = useState(defaultYear);
  const [note, setNote] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [unavailable, setUnavailable] = useState<string | null>(null);

  useEffect(() => setUnavailable(recorderUnavailable()), []);
  // Leaving the page mid-recording discards it and lets go of the microphone.
  useEffect(
    () => () => {
      if (recorder.current) recorder.current.onstop = null;
      if (recorder.current?.state === 'recording') recorder.current.stop();
      release();
    },
    [],
  );
  // The recorder stops itself at the platform's time limit and saves what it has.
  useEffect(() => {
    if (phase === 'recording' && elapsed >= maxSeconds) stop();
  }, [phase, elapsed, maxSeconds]);

  function release() {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }

  async function save(blob: Blob, mimeType: string) {
    setPhase('saving');
    try {
      const file = new File([blob], oralHistoryFileName(user.memberId, year, mimeType, new Date()), { type: mimeType });
      const assetUrl = (await archiveOralHistory(file)) ?? localFileLink(file);
      await db.history.addDiaryEntry(user.memberId, user.councilId, {
        fraternal_year: year,
        diary_text: note.trim() || `Oral history testimonial for fraternal year ${year}.`,
        audio_asset_url: assetUrl,
      });
      setNote('');
      setMessage({ tone: 'info', text: `Your testimonial is saved in the ${year} diary.` });
      await onSaved();
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setPhase('idle');
    }
  }

  async function start() {
    setMessage(null);
    setPhase('starting');
    try {
      const mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      stream.current = mic;
      const mimeType = pickOralHistoryMimeType((t) => MediaRecorder.isTypeSupported(t));
      const rec = new MediaRecorder(mic, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: ORAL_HISTORY_BITS_PER_SECOND });
      chunks.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data);
      };
      rec.onstop = () => {
        const type = rec.mimeType || mimeType || 'audio/webm';
        release();
        void save(new Blob(chunks.current, { type }), type);
      };
      recorder.current = rec;
      rec.start(1000);
      setElapsed(0);
      setPhase('recording');
      timer.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } catch (err) {
      release();
      setPhase('idle');
      setMessage({
        tone: 'error',
        text: err instanceof DOMException && err.name === 'NotAllowedError' ? 'The browser was not allowed to use the microphone. Allow it and try again.' : describeError(err),
      });
    }
  }

  function stop() {
    if (recorder.current?.state === 'recording') recorder.current.stop();
    recorder.current = null;
  }

  const countdown = oralHistoryCountdown(elapsed, maxSeconds);
  const blocked = todaysEntry
    ? `You already wrote today's diary entry (filed under ${todaysEntry.fraternal_year}). One entry per day is allowed; record again tomorrow.`
    : unavailable;

  return (
    <div className="flex flex-col gap-3">
      {message ? (
        <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
          {message.text}
        </Notice>
      ) : null}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[12rem_1fr]">
        <Field label="File under fraternal year">
          {(id) => (
            <Select id={id} value={year} onChange={(e) => setYear(e.target.value)} disabled={phase !== 'idle'}>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="What is the testimonial about? (optional)" hint={`Saved as the diary text. At most ${maxChars.toLocaleString('en-US')} characters.`}>
          {(id) => <Textarea id={id} value={note} maxLength={maxChars} onChange={(e) => setNote(e.target.value)} disabled={phase !== 'idle'} />}
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {phase === 'recording' ? (
          <Button variant="danger" onClick={stop} aria-label={`Stop recording and save (recording for ${clock(elapsed)})`}>
            ⏹ Stop and save
          </Button>
        ) : (
          <Button variant="gold" onClick={() => void start()} disabled={phase !== 'idle' || !!blocked} className="text-base">
            🎙️ Record Oral History Testimonial
          </Button>
        )}
        <span role="status" aria-live="polite" className="text-sm font-bold">
          {phase === 'starting'
            ? 'Asking for the microphone…'
            : phase === 'recording'
              ? `● Recording ${clock(elapsed)} of ${clock(maxSeconds)}`
              : phase === 'saving'
                ? 'Saving the recording…'
                : ''}
        </span>
      </div>
      {phase === 'recording' ? <CountdownMeter countdown={countdown} maxSeconds={maxSeconds} /> : null}
      {phase === 'idle' && !blocked ? (
        <p className="text-sm">Each recording can run up to {minutesText(maxSeconds)}. It stops and saves on its own when the time runs out.</p>
      ) : null}
      {blocked && phase === 'idle' ? <p className="text-sm">{blocked}</p> : null}
    </div>
  );
}

/**
 * The live countdown to the automatic timeout: navy on white inside a navy frame, the time left in large
 * MM:SS figures over a bar that empties as the session runs. In the final minute the figures turn gold and a warning is
 * spelled out, so the state never rests on colour alone. The visible clock updates every second; the polite live region
 * speaks only on each whole minute and every second of the last ten, so a screen reader is not flooded.
 */
/** "15 minutes", "1 minute", "90 seconds". */
const minutesText = (seconds: number): string =>
  seconds % 60 === 0 ? `${seconds / 60} minute${seconds === 60 ? '' : 's'}` : `${seconds} seconds`;

function CountdownMeter({ countdown, maxSeconds }: { countdown: ReturnType<typeof oralHistoryCountdown>; maxSeconds: number }) {
  const { remainingSeconds, remainingLabel, remainingSpoken, percentRemaining, warning } = countdown;
  const announce = remainingSeconds % 60 === 0 || remainingSeconds <= 10;
  return (
    <div className="rounded border-2 border-navy bg-white p-4 text-navy" role="timer" aria-label={`Time left before the recording stops: ${remainingSpoken}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-base uppercase tracking-wide">⏱ Time left before automatic stop</span>
        <span className={cx('text-5xl tabular-nums', warning ? 'text-brand-red' : 'text-navy')}>{remainingLabel}</span>
      </div>
      <div className="mt-3 h-4 w-full overflow-hidden rounded border-2 border-line bg-white" aria-hidden="true">
        <div className={cx('h-full', warning ? 'bg-brand-red' : 'bg-navy')} style={{ width: `${percentRemaining}%` }} />
      </div>
      <p className={cx('mt-2 text-base', warning && 'text-brand-red')}>
        {warning ? `⚠ Under one minute left: the recording stops and saves at 00:00.` : `The recording stops and saves on its own at 00:00 (${minutesText(maxSeconds)} limit).`}
      </p>
      <span className="sr-only" aria-live="polite">
        {announce ? `${remainingSpoken} left` : ''}
      </span>
    </div>
  );
}
