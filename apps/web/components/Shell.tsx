'use client';
// The portal frame: navy header (logo, the calling council's number and name, the Messaging menu and Help shortcut, the alert bell, and the member menu with
// the avatar that opens My Profile), the navy left Sidebar (Sidebar.tsx, Sprint 5Z-10) and a white content area. Nothing renders behind the sign-in gate.
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { councilLabel, countUnreadMessages, describeError, isFraternalTenant, TENANT_VOCABULARY, whiteLabel } from '@kofc/shared';
import { AlertBell } from '@/components/AlertBell';
import { MemberAvatar } from '@/components/MemberAvatar';
import { NAV, Sidebar } from '@/components/Sidebar';
import { Button, cx, Field, Input, Notice, PasswordInput } from '@/components/ui';
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

/** How often the envelope re-reads the member's threads, so messages sent from another session show up without a reload. */
const UNREAD_POLL_MS = 30_000;

/**
 * Phase 4.5: the number of unread messages addressed to the member, for the envelope's badge. It reloads on every
 * page change, whenever the Communications Hub reloads its conversations (messagesChanged), and every 30 seconds.
 */
function useUnreadMessages(pathname: string): number {
  const { user, messagesVersion } = useSession();
  const threads = useLoad(() => (user ? db.messages.listThreads(user.memberId) : Promise.resolve([])), [user?.memberId, pathname, messagesVersion]);
  const reload = threads.reload;
  useEffect(() => {
    const timer = setInterval(() => void reload(), UNREAD_POLL_MS);
    return () => clearInterval(timer);
  }, [reload]);
  return countUnreadMessages(threads.data ?? []);
}

/**
 * The envelope's unread count: a bright red bubble with bold white numerals ringed in navy (about 5.9:1), matching the
 * alert bell. Hidden at zero; 99+ beyond 99.
 */
function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      aria-hidden="true"
      data-testid="unread-messages-badge"
      className="absolute -right-1.5 -top-1.5 min-w-5 rounded-full border-2 border-navy bg-brand-red px-1 text-center text-xs font-bold leading-4 text-white"
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

/** The links of the header's Messaging menu (Sprint 5Z-10.8), open to every signed-in member. */
const MESSAGING_MENU = ['messages', 'distribution-lists'] as const;

/**
 * The header's Messaging menu, just left of the Help shortcut: the envelope opens a dropdown with Council Messages & Alerts
 * (/messages) and My Distribution Lists (/distribution-lists), both open to every signed-in member (Sprint 5Z-10.8;
 * a single shortcut since Sprint 5X). Escape, a click elsewhere or following a link closes it.
 */
function MessagingMenu({ pathname }: { pathname: string }) {
  const { tenantType } = useSession();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const current = MESSAGING_MENU.some((item) => NAV[item].href === pathname);
  const unread = useUnreadMessages(pathname);
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

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="messaging-menu"
        aria-label={unread > 0 ? `Messaging: ${unread} unread` : 'Messaging'}
        onClick={() => setOpen((o) => !o)}
        className={cx(
          'flex items-center gap-1.5 rounded px-2 py-2 text-sm font-bold text-white hover:bg-white/10',
          current && 'bg-white/10 underline decoration-gold decoration-2 underline-offset-4',
        )}
      >
        <span className="relative inline-flex">
          <EnvelopeIcon />
          <UnreadBadge count={unread} />
        </span>
        Messaging
        <span aria-hidden="true" className="text-gold">
          {open ? '▴' : '▾'}
        </span>
      </button>
      {open ? (
        <div
          id="messaging-menu"
          role="menu"
          aria-label="Messaging"
          className="absolute right-0 z-20 mt-2 w-72 overflow-hidden rounded border-2 border-navy border-t-4 border-t-gold bg-white text-navy shadow-xl"
        >
          {MESSAGING_MENU.map((item, i) => {
            const { href, label, hint } = NAV[item];
            const here = pathname === href;
            return (
              <Link
                key={item}
                role="menuitem"
                href={href}
                aria-current={here ? 'page' : undefined}
                className={cx('block border-l-8 px-4 py-2 hover:underline', i > 0 && 'border-t border-t-line', here ? 'border-l-gold' : 'border-l-transparent')}
              >
                <span className="block text-sm font-bold">{whiteLabel(label, tenantType)}</span>
                <span className="block text-xs text-muted">{whiteLabel(hint, tenantType)}</span>
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
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

/**
 * Sprint 6B Security: the self-service password reset, in place of the sign-in form. The email step always moves on,
 * so the form never tells whether an email belongs to a member; the 6-digit code (15 minutes, 5 tries) unlocks the
 * new-password step, which saves through auth.resetPassword and then signs the member in.
 */
function PasswordReset({ initialEmail, onDone, onCancel }: { initialEmail: string; onDone: (email: string, password: string) => Promise<void>; onCancel: () => void }) {
  const [step, setStep] = useState<'email' | 'code' | 'password'>('email');
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (step === 'email') {
      void run(async () => {
        await db.auth.requestPasswordReset(email.trim());
        setStep('code');
      });
    } else if (step === 'code') {
      void run(async () => {
        await db.auth.verifyPasswordResetCode(email.trim(), code);
        setStep('password');
      });
    } else if (password !== confirmation) {
      setError('The two passwords do not match.');
    } else {
      void run(async () => {
        await db.auth.resetPassword(email.trim(), code, password);
        await onDone(email.trim(), password);
      });
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <h2 className="font-serif text-lg font-bold">Reset your password</h2>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {step === 'email' ? (
        <>
          <p className="text-sm text-muted">Enter the email you sign in with. If it belongs to a registered member, a 6-digit reset code is emailed to it.</p>
          <Field label="Email">{(id) => <Input id={id} type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />}</Field>
          <Button type="submit" disabled={busy || email.trim() === ''}>
            {busy ? 'Sending…' : 'Email me a reset code'}
          </Button>
        </>
      ) : step === 'code' ? (
        <>
          <p className="text-sm text-muted">If {email.trim()} belongs to a registered member, a 6-digit code is on its way. It expires in 15 minutes.</p>
          <Field label="6-digit reset code">
            {(id) => (
              <Input
                id={id}
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                className="text-center text-2xl tracking-[0.5em]"
                required
              />
            )}
          </Field>
          <Button type="submit" disabled={busy || code.length !== 6}>
            {busy ? 'Checking…' : 'Continue'}
          </Button>
        </>
      ) : (
        <>
          <p className="text-sm text-muted">Choose a new password of at least 8 characters.</p>
          <Field label="New password">
            {(id) => <PasswordInput id={id} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />}
          </Field>
          <Field label="Confirm new password">
            {(id) => <PasswordInput id={id} autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} required />}
          </Field>
          <Button type="submit" disabled={busy || password === ''}>
            {busy ? 'Saving…' : 'Save new password and sign in'}
          </Button>
        </>
      )}
      <button type="button" onClick={onCancel} className="self-center text-sm font-bold underline">
        Back to sign in
      </button>
    </form>
  );
}

function SignIn() {
  const { signIn } = useSession();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resetting, setResetting] = useState(false);
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

  const brand = (
    <div className="flex items-center gap-3">
      <BrandMark size={52} />
      <div>
        <h1 className="font-serif text-xl font-bold leading-tight">Knights of Columbus</h1>
        <p className="text-sm text-muted">Council administration portal</p>
      </div>
    </div>
  );

  if (resetting) {
    return (
      <div data-surface="navy" className="flex min-h-screen items-center justify-center bg-navy p-6">
        <div className="flex w-full max-w-sm flex-col gap-4 rounded border-t-8 border-gold bg-white p-6">
          {brand}
          <PasswordReset
            initialEmail={username}
            onCancel={() => setResetting(false)}
            onDone={async (email, newPassword) => {
              if (!(await signIn(email, newPassword))) throw new Error('Your password was changed, but signing in failed. Sign in with the new password.');
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div data-surface="navy" className="flex min-h-screen items-center justify-center bg-navy p-6">
      <form onSubmit={(e) => void submit(e)} className="flex w-full max-w-sm flex-col gap-4 rounded border-t-8 border-gold bg-white p-6">
        {brand}
        {error ? <Notice tone="error">{error}</Notice> : null}
        <Field label="Email">{(id) => <Input id={id} type="email" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required />}</Field>
        <Field label="Password">
          {(id) => <PasswordInput id={id} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />}
        </Field>
        <Button type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </Button>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setResetting(true);
          }}
          className="self-center text-sm font-bold underline"
        >
          Forgot Password?
        </button>
        {devHint ? <p className="text-xs text-muted">Development data: testadmin@kofc.org or testsuperadmin@kofc.org, password dev-pass-secure-9912.</p> : null}
      </form>
    </div>
  );
}

function Frame({ children }: { children: ReactNode }) {
  const { user, features, featuresLoaded, tenantType } = useSession();
  const pathname = usePathname();
  const council = useLoad(() => (user ? db.councils.get(user.councilId) : Promise.resolve(null)), [user?.councilId]);
  if (!user) return null;

  return (
    <div className="flex min-h-screen flex-col">
      <header data-surface="navy" className="flex items-center gap-4 border-b-4 border-gold bg-navy px-6 py-3 text-white">
        {/* Sprint 6Z-Dual-Gate-Model: the order's emblem and name belong to Knights of Columbus councils only. */}
        {isFraternalTenant(tenantType) ? <BrandMark /> : null}
        <div className="flex-1">
          <p className="font-serif text-xl font-bold leading-tight">{TENANT_VOCABULARY[tenantType].organizationName}</p>
          <p className="text-sm">{council.data ? councilLabel(council.data) : ' '}</p>
        </div>
        <MessagingMenu pathname={pathname} />
        <HelpLink current={pathname === '/help'} />
        <AlertBell />
        <MemberMenu />
      </header>
      <div className="flex flex-1">
        <Sidebar user={user} pathname={pathname} features={features} tenant={tenantType} />
        {/* Sprint 6A: pages wait for the council's feature flags, so a switched-off module never flashes into view. */}
        <main className="min-w-0 flex-1 bg-white p-6">{featuresLoaded ? children : null}</main>
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
