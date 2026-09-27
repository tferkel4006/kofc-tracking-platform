'use client';
// My Profile: every signed-in member maintains their own contact details (members.update allows a member only
// the MEMBER_SELF_SERVICE_COLUMNS on their own record), their working status, trade skills and training classes.
// Name, member number, degree, type and status belong to the council's admins and are shown read-only.
import { useEffect, useState } from 'react';
import { describeError, type Member } from '@kofc/shared';
import { RequireArea } from '@/components/CouncilScope';
import { ProfileExtensionsEditor } from '@/components/ProfileExtensionsEditor';
import { Button, Field, Input, Notice, PageTitle, Panel, Pill } from '@/components/ui';
import { formatPhone } from '@/lib/format';
import { useUser } from '@/lib/session';
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

function Profile() {
  const user = useUser();
  const member = useLoad(() => db.members.get(user.memberId), [user.memberId]);
  const council = useLoad(() => db.councils.get(user.councilId), [user.councilId]);

  if (member.error) return <Notice tone="error">{member.error}</Notice>;
  if (!member.data) return <p className="text-sm text-muted">Loading your profile…</p>;
  const m = member.data;

  return (
    <>
      <PageTitle>My Profile</PageTitle>
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <Panel title={`${m.MemberFirstName} ${m.MemberLastName}`}>
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
