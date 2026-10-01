'use client';
// The portal frame: navy header (logo, the calling council's number and name, the Messaging and Help shortcuts, the alert bell, and the member menu with
// the avatar that opens My Profile), the navy left Sidebar (Sidebar.tsx, Sprint 5Z-10) and a white content area. Nothing renders behind the sign-in gate.
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { councilLabel } from '@kofc/shared';
import { AlertBell } from '@/components/AlertBell';
import { MemberAvatar } from '@/components/MemberAvatar';
import { NAV, Sidebar } from '@/components/Sidebar';
import { Button, cx, Field, Input, Notice } from '@/components/ui';
import { useSession } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';
import emblem from './kofc-logo.png';

/**
 * The council-supplied Knights of Columbus emblem; decorative, since the title beside it names the order.
 * The 737px source is served at 1x and 2x of `size` (next/image srcset) at quality 90, so it stays sharp on
 * high-density screens.
 */
export function BrandMark({ size = 44 }: { size?: number }) {
  return <Image src={emblem} alt="" width={size} height={size} quality={90} preload className="shrink-0" />;
}

/** Question mark in a circle, drawn in currentColor so it follows the header's white text. */
function HelpIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

/** An envelope, drawn in currentColor so it follows the header's white text (Sprint 5Z-10.6, matching the phone app). */
function EnvelopeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}

/** The header's Messaging shortcut to the Communications Hub, just left of the Help shortcut (Sprint 5X). */
function MessagingLink({ current }: { current: boolean }) {
  const { href, label, hint } = NAV.messages;
  return (
    <Link
      href={href}
      title={`${label}: ${hint.toLowerCase()}`}
      aria-current={current ? 'page' : undefined}
      className={cx(
        'flex items-center gap-1.5 rounded px-2 py-2 text-sm font-bold text-white hover:bg-white/10',
        current && 'bg-white/10 underline decoration-gold decoration-2 underline-offset-4',
      )}
    >
      <EnvelopeIcon />
      Messaging
    </Link>
  );
}

/** The header's Help shortcut to the searchable help center, just left of the alert bell (Sprint 5W). */
function HelpLink({ current }: { current: boolean }) {
  return (
    <Link
      href="/help"
      title="Online Help Center: answers from the user manuals"
      aria-current={current ? 'page' : undefined}
      className={cx(
        'flex items-center gap-1.5 rounded px-2 py-2 text-sm font-bold text-white hover:bg-white/10',
        current && 'bg-white/10 underline decoration-gold decoration-2 underline-offset-4',
      )}
    >
      <HelpIcon />
      Help
    </Link>
  );
}

/**
 * The member token in the header: avatar, name and title. It opens a small menu with My Profile and Sign out;
 * Escape, a click elsewhere or following a link closes it.
 */
function MemberMenu() {
  const { user, signOut, profileVersion } = useSession();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const member = useLoad(() => (user ? db.members.get(user.memberId) : Promise.resolve(null)), [user?.memberId, profileVersion]);
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  if (!user) return null;
  const title = `${user.memberType}${user.isOfficer ? ' · Officer' : ''}`;

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="member-menu"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-3 rounded px-2 py-1 text-right hover:underline"
      >
        <span className="text-sm">
          <span className="block font-bold">
            {user.firstName} {user.lastName}
          </span>
          <span className="block text-xs">{title}</span>
        </span>
        <MemberAvatar photoUrl={member.data?.ProfilePhotoURL} firstName={user.firstName} lastName={user.lastName} size={40} />
        <span aria-hidden="true" className="text-gold">
          {open ? '▴' : '▾'}
        </span>
      </button>
      {open ? (
        <div id="member-menu" role="menu" aria-label="Member menu" className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded border-2 border-navy border-t-4 border-t-gold bg-white text-navy shadow-xl">
          <Link role="menuitem" href={NAV.profile.href} className="block px-4 py-2 hover:underline">
            <span className="block text-sm font-bold">{NAV.profile.label}</span>
            <span className="block text-xs text-muted">{NAV.profile.hint}</span>
          </Link>
          <button role="menuitem" type="button" onClick={signOut} className="block w-full border-t border-line px-4 py-2 text-left text-sm font-bold hover:underline">
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}

function SignIn() {
  const { signIn } = useSession();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const devHint = (process.env.NEXT_PUBLIC_DATA_DRIVER ?? 'memory') === 'memory';

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (!(await signIn(username, password))) setError('That email and password do not match a registered member. Check both and try again.');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-surface="navy" className="flex min-h-screen items-center justify-center bg-navy p-6">
      <form onSubmit={(e) => void submit(e)} className="flex w-full max-w-sm flex-col gap-4 rounded border-t-8 border-gold bg-white p-6">
        <div className="flex items-center gap-3">
          <BrandMark size={52} />
          <div>
            <h1 className="font-serif text-xl font-bold leading-tight">Knights of Columbus</h1>
            <p className="text-sm text-muted">Council administration portal</p>
          </div>
        </div>
        {error ? <Notice tone="error">{error}</Notice> : null}
        <Field label="Email">{(id) => <Input id={id} type="email" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required />}</Field>
        <Field label="Password">
          {(id) => <Input id={id} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />}
        </Field>
        <Button type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </Button>
        {devHint ? <p className="text-xs text-muted">Development data: testadmin@kofc.org or testsuperadmin@kofc.org, password dev-pass-secure-9912.</p> : null}
      </form>
    </div>
  );
}

function Frame({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const pathname = usePathname();
  const council = useLoad(() => (user ? db.councils.get(user.councilId) : Promise.resolve(null)), [user?.councilId]);
  if (!user) return null;

  return (
    <div className="flex min-h-screen flex-col">
      <header data-surface="navy" className="flex items-center gap-4 border-b-4 border-gold bg-navy px-6 py-3 text-white">
        <BrandMark />
        <div className="flex-1">
          <p className="font-serif text-xl font-bold leading-tight">Knights of Columbus</p>
          <p className="text-sm">{council.data ? councilLabel(council.data) : ' '}</p>
        </div>
        <MessagingLink current={pathname === NAV.messages.href} />
        <HelpLink current={pathname === '/help'} />
        <AlertBell />
        <MemberMenu />
      </header>
      <div className="flex flex-1">
        <Sidebar user={user} pathname={pathname} />
        <main className="min-w-0 flex-1 bg-white p-6">{children}</main>
      </div>
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const { user, ready, startupError } = useSession();
  if (startupError) {
    return (
      <div className="p-6">
        <Notice tone="error">The in-memory database could not be seeded, so the portal cannot start: {startupError}</Notice>
      </div>
    );
  }
  if (!ready) {
    return (
      <div data-surface="navy" className="flex min-h-screen items-center justify-center bg-navy text-white">
        <p className="font-serif text-xl">Opening the portal…</p>
      </div>
    );
  }
  return user ? <Frame>{children}</Frame> : <SignIn />;
}
