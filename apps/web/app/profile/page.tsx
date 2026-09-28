'use client';
// My Profile (opened from the member menu in the header): every signed-in member maintains their own avatar photo,
// fraternal biography and contact details (members.update allows a member only the MEMBER_SELF_SERVICE_COLUMNS on
// their own record), their working status, trade skills and training classes. Name, member number, degree, type
// and status belong to the council's admins and are shown read-only.
import { useEffect, useState } from 'react';
import { describeError, MEMBER_BIOGRAPHY_MAX_LENGTH, type Member } from '@kofc/shared';
import { RequireArea } from '@/components/CouncilScope';
import { MemberAvatar } from '@/components/MemberAvatar';
import { ProfileExtensionsEditor } from '@/components/ProfileExtensionsEditor';
import { Button, cx, Field, Input, Notice, PageTitle, Panel, Pill, Textarea } from '@/components/ui';
import { formatPhone } from '@/lib/format';
import { useSession, useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

type ContactKey = 'Phone' | 'Email' | 'StreetAddress1' | 'StreetAddress2' | 'City' | 'State' | 'ZipCode';

const CONTACT_FIELDS: { key: ContactKey; label: string; type?: string; maxLength: number; optional?: boolean; wide?: boolean }[] = [
  { key: 'Phone', label: 'Phone', type: 'tel', maxLength: 50 },
  { key: 'Email', label: 'Email (also your sign-in)', type: 'email', maxLength: 50 },
  { key: 'StreetAddress1', label: 'Street address', maxLength: 255, wide: true },
  { key: 'StreetAddress2', label: 'Street address line 2', maxLength: 255, optional: true, wide: true },
  { key: 'City', label: 'City', maxLength: 50 },
  { key: 'State', label: 'State', maxLength: 20 },
  { key: 'ZipCode', label: 'ZIP code', maxLength: 15 },
];

type ContactDraft = Record<ContactKey, string>;

const draftFrom = (m: Member): ContactDraft =>
  Object.fromEntries(CONTACT_FIELDS.map((f) => [f.key, (m[f.key] as string | null | undefined) ?? ''])) as ContactDraft;

function ContactForm({ member, onSaved }: { member: Member; onSaved: () => void }) {
  const user = useUser();
  const [draft, setDraft] = useState<ContactDraft>(() => draftFrom(member));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);
  useEffect(() => setDraft(draftFrom(member)), [member]);

  const emailChanged = draft.Email.trim().toLowerCase() !== member.Email.toLowerCase();

  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const changes: Partial<Member> = {};
      for (const f of CONTACT_FIELDS) {
        const next = draft[f.key].trim();
        const stored = ((member[f.key] as string | null | undefined) ?? '').trim();
        if (next !== stored) (changes as Record<string, string | undefined>)[f.key] = f.optional && next === '' ? undefined : next;
      }
      if (Object.keys(changes).length === 0) {
        setMessage({ tone: 'info', text: 'Nothing has changed.' });
        return;
      }
      await db.members.update(user.memberId, member.id, changes);
      setMessage({ tone: 'info', text: emailChanged ? 'Contact details saved. Sign in with your new email from now on.' : 'Contact details saved.' });
      onSaved();
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="flex flex-col gap-4"
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
      <div className="grid grid-cols-3 gap-3">
        {CONTACT_FIELDS.map((f) => (
          <Field key={f.key} label={f.optional ? `${f.label} (optional)` : f.label} className={f.wide ? 'col-span-3' : undefined}>
            {(id) => (
              <Input
                id={id}
                type={f.type ?? 'text'}
                value={draft[f.key]}
                maxLength={f.maxLength}
                required={!f.optional}
                onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
              />
            )}
          </Field>
        ))}
      </div>
      {emailChanged ? <Notice tone="info">Saving changes your sign-in email as well.</Notice> : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save contact details'}
        </Button>
        <Button variant="secondary" onClick={() => setDraft(draftFrom(member))} disabled={busy}>
          Undo changes
        </Button>
      </div>
    </form>
  );
}

/** Shown at 160 CSS px; a source of at least twice that stays sharp on high-density (2x) screens. */
const AVATAR_SIZE = 160;
const AVATAR_SHARP_SOURCE = AVATAR_SIZE * 2;

/** The pixel size of a chosen image file, read before it is saved. */
function imageSize(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error('That file could not be opened as an image. Choose a JPEG, PNG or other photo.'));
    img.src = url;
  });
}

/**
 * The avatar frame: the member's photo (or initials) with Choose and Remove. A chosen file is saved at once as
 * ProfilePhotoURL, a browser blob link carrying the file name after the # (the memory driver has no file store).
 */
function PhotoFrame({ member, onSaved }: { member: Member; onSaved: () => Promise<void> }) {
  const user = useUser();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);

  const save = async (photoUrl: string | null, done: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await db.members.update(user.memberId, member.id, { ProfilePhotoURL: photoUrl });
      await onSaved();
      setMessage({ tone: 'info', text: done });
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setBusy(false);
    }
  };

  const choose = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return setMessage({ tone: 'error', text: `${file.name} is not an image. Choose a JPEG, PNG or other photo.` });
    const url = `${URL.createObjectURL(file)}#${encodeURIComponent(file.name)}`;
    try {
      const { width, height } = await imageSize(url);
      const soft = Math.min(width, height) < AVATAR_SHARP_SOURCE;
      await save(
        url,
        soft
          ? `Photo saved. It is ${width}×${height} pixels; one at least ${AVATAR_SHARP_SOURCE}×${AVATAR_SHARP_SOURCE} stays crisp on high-density screens.`
          : 'Photo saved.',
      );
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <MemberAvatar photoUrl={member.ProfilePhotoURL} firstName={member.MemberFirstName} lastName={member.MemberLastName} size={AVATAR_SIZE} className="border-4" />
      <div className="flex flex-wrap justify-center gap-2">
        <label className={cx('cursor-pointer rounded border-2 border-navy bg-navy px-2 py-0.5 text-xs font-bold text-white focus-within:outline-2', busy && 'opacity-45')}>
          {member.ProfilePhotoURL ? 'Change photo…' : 'Choose photo…'}
          <input
            type="file"
            accept="image/*"
            aria-label="Profile photo file"
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              void choose(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </label>
        {member.ProfilePhotoURL ? (
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => void save(null, 'Photo removed.')}>
            Remove photo
          </Button>
        ) : null}
      </div>
      <p className="text-center text-xs text-muted">
        A square photo of at least {AVATAR_SHARP_SOURCE}×{AVATAR_SHARP_SOURCE} pixels looks best.
      </p>
      {message ? (
        <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
          {message.text}
        </Notice>
      ) : null}
    </div>
  );
}

/** The member's own short fraternal biography (Member.Biography). */
function BiographyForm({ member, onSaved }: { member: Member; onSaved: () => Promise<void> }) {
  const user = useUser();
  const stored = member.Biography ?? '';
  const [text, setText] = useState(stored);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);
  useEffect(() => setText(member.Biography ?? ''), [member]);
  const changed = text.trim() !== stored.trim();

  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await db.members.update(user.memberId, member.id, { Biography: text.trim() || null });
      await onSaved();
      setMessage({ tone: 'info', text: text.trim() ? 'Biography saved.' : 'Biography cleared.' });
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
      <Field
        label="About me"
        hint={`${text.length.toLocaleString('en-US')} of ${MEMBER_BIOGRAPHY_MAX_LENGTH.toLocaleString('en-US')} characters.`}
      >
        {(id) => (
          <Textarea
            id={id}
            rows={8}
            maxLength={MEMBER_BIOGRAPHY_MAX_LENGTH}
            placeholder="Your parish, when you joined the Knights, your family, and the works of charity closest to your heart."
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="min-h-48"
          />
        )}
      </Field>
      <div className="flex gap-2">
        <Button type="submit" disabled={busy || !changed}>
          {busy ? 'Saving…' : 'Save biography'}
        </Button>
        <Button variant="secondary" onClick={() => setText(stored)} disabled={busy || !changed}>
          Undo changes
        </Button>
      </div>
    </form>
  );
}

function Profile() {
  const user = useUser();
  const { profileChanged } = useSession();
  const member = useLoad(() => db.members.get(user.memberId), [user.memberId]);
  const reloadOwn = async () => {
    await member.reload();
    profileChanged();
  };
  const council = useLoad(() => db.councils.get(user.councilId), [user.councilId]);

  if (member.error) return <Notice tone="error">{member.error}</Notice>;
  if (!member.data) return <p className="text-sm text-muted">Loading your profile…</p>;
  const m = member.data;

  return (
    <>
      <PageTitle>My Profile</PageTitle>
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <Panel title={`${m.MemberFirstName} ${m.MemberLastName}`}>
          <div className="mb-4 border-b border-line pb-4">
            <PhotoFrame member={m} onSaved={reloadOwn} />
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="font-bold">Member no.</dt>
            <dd>{m.MemberNumber}</dd>
            <dt className="font-bold">Council</dt>
            <dd>{council.data ? `${council.data.CouncilNumber} – ${council.data.CouncilName}` : '–'}</dd>
            <dt className="font-bold">Member type</dt>
            <dd>{user.memberType}</dd>
            <dt className="font-bold">Phone</dt>
            <dd>{formatPhone(m.Phone)}</dd>
            <dt className="font-bold">Roles</dt>
            <dd className="flex flex-wrap gap-1">
              {user.roles.length === 0 ? '–' : user.roles.map((r) => <Pill key={r} tone={user.isOfficer ? 'gold' : 'outline'}>{r}</Pill>)}
            </dd>
          </dl>
          <p className="mt-4 text-xs text-muted">Your name, member number, degree and type are kept by your council&apos;s admins. Ask them to correct these.</p>
        </Panel>
        <div className="flex flex-col gap-4">
          <Panel title="My fraternal biography">
            <BiographyForm member={m} onSaved={reloadOwn} />
          </Panel>
          <Panel title="Contact details">
            <ContactForm member={m} onSaved={() => void member.reload()} />
          </Panel>
          <Panel title="Working status, skills and training">
            <ProfileExtensionsEditor memberId={m.id} showWorkingStatus />
          </Panel>
        </div>
      </div>
    </>
  );
}

export default function ProfilePage() {
  return (
    <RequireArea area="profile">
      <Profile />
    </RequireArea>
  );
}
