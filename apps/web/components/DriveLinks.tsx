'use client';
// A meeting's shared Google Drive files: "View Meeting Minutes" and "View Event Announcement Flyer" buttons that
// open the stored link in a new tab, and (for its owner, the council's Admins and finance officers, and Super
// Admins) a small form that saves the links through meetings.linkGoogleDrive.
import { useState } from 'react';
import { describeError, GOOGLE_DRIVE_HOSTS, type Meeting } from '@kofc/shared';
import { Button, cx, Field, Input, Notice } from '@/components/ui';
import { useUser } from '@/lib/session';
import { db } from '@/services/db';

/** Drive glyph: a document with a folded corner, drawn in currentColor. */
function DocIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <path d="M14 3v6h6" />
      <path d="M8 13h8M8 17h5" />
    </svg>
  );
}

function DriveButton({ href, label, tone }: { href: string | null | undefined; label: string; tone: 'navy' | 'gold' }) {
  const look = tone === 'navy' ? 'border-navy bg-navy text-white' : 'border-gold bg-gold text-navy';
  if (!href) {
    return (
      <span aria-disabled="true" title="Not linked yet" className="inline-flex items-center gap-2 rounded border-2 border-line bg-white px-3 py-1.5 text-sm font-bold text-muted">
        <DocIcon />
        {label}
      </span>
    );
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cx('inline-flex items-center gap-2 rounded border-2 px-3 py-1.5 text-sm font-bold hover:underline', look)}>
      <DocIcon />
      {label}
      <span className="sr-only"> (opens Google Drive in a new tab)</span>
    </a>
  );
}

/** The two Drive buttons; an unlinked file shows as a greyed, inert chip. */
export function DriveButtons({ meeting }: { meeting: Pick<Meeting, 'GoogleDriveMinutesURL' | 'GoogleDriveFlyerURL'> }) {
  return (
    <div className="flex flex-wrap gap-2">
      <DriveButton href={meeting.GoogleDriveMinutesURL} label="View Meeting Minutes" tone="navy" />
      <DriveButton href={meeting.GoogleDriveFlyerURL} label="View Event Announcement Flyer" tone="gold" />
    </div>
  );
}

/** Edits both links at once; a blank field clears that link. */
export function DriveLinkEditor({ meeting, onSaved }: { meeting: Meeting; onSaved: () => void | Promise<void> }) {
  const user = useUser();
  const [minutes, setMinutes] = useState(meeting.GoogleDriveMinutesURL ?? '');
  const [flyer, setFlyer] = useState(meeting.GoogleDriveFlyerURL ?? '');
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await db.meetings.linkGoogleDrive(user.memberId, meeting.id, minutes.trim() || null, flyer.trim() || null);
      setMessage({ tone: 'info', text: 'Google Drive links saved.' });
      await onSaved();
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      {message ? (
        <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
          {message.text}
        </Notice>
      ) : null}
      <Field label="Minutes link" hint={`A shared link on ${GOOGLE_DRIVE_HOSTS.join(' or ')}. Leave blank to remove it.`}>
        {(id) => <Input id={id} type="url" inputMode="url" value={minutes} onChange={(e) => setMinutes(e.target.value)} placeholder="https://drive.google.com/file/d/…" />}
      </Field>
      <Field label="Announcement flyer link">
        {(id) => <Input id={id} type="url" inputMode="url" value={flyer} onChange={(e) => setFlyer(e.target.value)} placeholder="https://docs.google.com/document/d/…" />}
      </Field>
      <div>
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? 'Saving…' : 'Save Drive links'}
        </Button>
      </div>
    </form>
  );
}
