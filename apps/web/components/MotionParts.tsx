'use client';
// Proposed Motions (Sprint 5Z-6): the motions queued for a meeting's floor (ProposedMotion), each with its motion
// text, the Knight Shepherd presenting it and its strict time block. The time block is a badge the chair can start:
// it counts the allocated minutes down to zero and turns red when the floor time is spent. Every member reads the
// list, like the meeting itself; motions are added by routing a vetted charitable request (Pooled Vetting Desk).
import { useEffect, useState } from 'react';
import { type ProposedMotionDetail } from '@kofc/shared';
import { cx, Empty, Notice, Pill } from '@/components/ui';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

const clock = (seconds: number): string => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

/** '5 Minutes Strict': press to count the floor time down; press again to stop and reset. */
export function StrictTimeBadge({ minutes }: { minutes: number }) {
  const total = minutes * 60;
  const [left, setLeft] = useState<number | null>(null);
  const running = left !== null && left > 0;

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setLeft((s) => (s === null ? null : Math.max(0, s - 1))), 1000);
    return () => clearInterval(timer);
  }, [running]);

  const label = `${minutes} Minute${minutes === 1 ? '' : 's'} Strict`;
  const spent = left === 0;
  return (
    <button
      type="button"
      onClick={() => setLeft(left === null ? total : null)}
      aria-label={left === null ? `${label}: start the floor timer` : `${clock(left)} left of ${label}: stop and reset the timer`}
      className={cx(
        'inline-flex shrink-0 items-center gap-2 rounded border-2 px-3 py-1 text-sm font-bold uppercase tracking-wide',
        spent ? 'border-brand-red bg-brand-red text-white' : 'border-navy bg-navy text-white',
      )}
    >
      <span aria-hidden="true">⏱</span>
      <span>{left === null ? label : spent ? 'Time — yield the floor' : `${clock(left)} · ${label}`}</span>
    </button>
  );
}

function MotionRow({ detail, index }: { detail: ProposedMotionDetail; index: number }) {
  const { motion } = detail;
  const presenter = `${detail.presenterFirstName} ${detail.presenterLastName}`.trim() || `Member ${motion.PresenterMemberID}`;
  return (
    <li className="flex flex-col gap-2 border-t border-line py-3 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="flex-1 text-sm">
          <span className="mr-2 font-bold">Motion {index + 1}.</span>
          {motion.MotionText}
        </p>
        <StrictTimeBadge minutes={motion.AllocatedMinutes} />
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span>
          <span className="font-bold uppercase tracking-wide">Floor presenter:</span> {presenter}
          {motion.SourceType === 'CharitableRequest' ? ', Knight Shepherd' : ''}
        </span>
        {motion.SourceType === 'CharitableRequest' ? <Pill tone="outline">Charitable request #{motion.SourceRecordID}</Pill> : <Pill tone="outline">Member motion</Pill>}
        <Pill tone={motion.VoteResult === 'Pending' ? 'gold' : motion.VoteResult === 'Passed' ? 'navy' : 'redOutline'}>{motion.VoteResult}</Pill>
      </div>
    </li>
  );
}

/** The bordered 'Proposed Motions' section of a meeting's detail view. */
export function ProposedMotionsSection({ meetingId }: { meetingId: number }) {
  const motions = useLoad(() => db.meetings.listProposedMotions(meetingId), [meetingId]);
  const rows = motions.data ?? [];
  return (
    <section aria-labelledby={`motions-${meetingId}`} className="rounded border-2 border-navy bg-white">
      <header className="flex items-center justify-between gap-3 border-b-2 border-navy px-4 py-2">
        <h2 id={`motions-${meetingId}`} className="font-serif text-lg font-bold">
          Proposed Motions
        </h2>
        {rows.length > 0 ? <Pill tone="navy">{rows.length} on the floor</Pill> : null}
      </header>
      <div className="p-4">
        {motions.error ? <Notice tone="error">{motions.error}</Notice> : null}
        {motions.data && rows.length === 0 ? <Empty>No motions are queued for this meeting.</Empty> : null}
        <ol className="flex flex-col">
          {rows.map((detail, i) => (
            <MotionRow key={detail.motion.id} detail={detail} index={i} />
          ))}
        </ol>
      </div>
    </section>
  );
}
