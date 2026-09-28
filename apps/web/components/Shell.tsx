'use client';
// The portal frame: navy header (logo, then the calling council's number and name), a navy side navigation
// with a gold marker on the current section, and a white content area. Nothing renders behind the sign-in gate.
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type FormEvent, type ReactNode } from 'react';
import { councilLabel, portalAreas, type PortalArea } from '@kofc/shared';
import { Button, cx, Field, Input, Notice } from '@/components/ui';
import { useSession } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';
import emblem from './kofc-logo.png';

const AREAS: Record<PortalArea, { href: string; label: string; hint: string }> = {
  'member-actions': { href: '/member-actions', label: 'Member Actions', hint: 'My shifts, sign-ups, roster, hours' },
  calendar: { href: '/calendar', label: 'Visual Master Calendar', hint: 'Events, shifts and meetings by date' },
  gallery: { href: '/gallery', label: 'Fraternal Photo Gallery', hint: 'Event photos and slideshows' },
  lookups: { href: '/lookups', label: 'System lookups', hint: 'Maintain the global tables' },
  councils: { href: '/councils', label: 'Councils', hint: 'Add, edit and delete councils' },
  'council-lookups': { href: '/council-lookups', label: 'Council lookups', hint: 'Activities, donation types, methods' },
  parishes: { href: '/parishes', label: 'Parishes & pastors', hint: 'Parishes and their pastors' },
  members: { href: '/members', label: 'Member roster', hint: 'Members, types and skills' },
  activities: { href: '/activities', label: 'Activities catalog', hint: 'Standing council activities' },
  events: { href: '/events', label: 'Event planner', hint: 'Events, shifts and councils' },
  meetings: { href: '/meetings', label: 'Meeting center', hint: 'Meetings, invitations, minutes' },
  'distribution-lists': { href: '/distribution-lists', label: 'Distribution lists', hint: 'Member lists for council blasts' },
  ledger: { href: '/ledger', label: 'Post-event ledger', hint: 'Spend, funds raised, lessons' },
  expenses: { href: '/expenses', label: 'My Expense Reports', hint: 'Receipts and reimbursement status' },
  'expenses/queue': { href: '/expenses/queue', label: 'Expense Audit Queue', hint: 'Approve or return submitted reports' },
  'expenses/disbursements': { href: '/expenses/disbursements', label: 'Check Disbursements', hint: 'Pay approved reports by check' },
  'lessons-registry': { href: '/lessons-registry', label: 'Lessons registry', hint: 'Lessons learned across councils' },
  donations: { href: '/donations', label: 'Donations', hint: 'Record and review council donations' },
  dashboard: { href: '/dashboard', label: 'Executive Summaries', hint: 'Monthly hours, members and funds' },
  messages: { href: '/messages', label: 'Communications Hub', hint: 'Message threads and replies' },
  profile: { href: '/profile', label: 'My Profile', hint: 'Contact details, skills, training' },
};

/**
 * The council-supplied Knights of Columbus emblem; decorative, since the title beside it names the order.
 * The 737px source is served at 1x and 2x of `size` (next/image srcset) at quality 90, so it stays sharp on
 * high-density screens.
 */
export function BrandMark({ size = 44 }: { size?: number }) {
  return <Image src={emblem} alt="" width={size} height={size} quality={90} preload className="shrink-0" />;
}

/** Question mark in a circle, drawn in currentColor so it follows the link's navy or white text. */
function HelpIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

/** Help is for every signed-in member, so it sits below the permission-driven areas rather than in portalAreas. */
const HELP = { href: '/help', label: 'Online Help Center', hint: 'Answers from the user manuals' };

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
        {devHint ? <p className="text-xs text-muted">Development data: testadmin@kofc.org or testsuperadmin@kofc.org, password koc15295.</p> : null}
      </form>
    </div>
  );
}

function Frame({ children }: { children: ReactNode }) {
  const { user, signOut } = useSession();
  const pathname = usePathname();
  const council = useLoad(() => (user ? db.councils.get(user.councilId) : Promise.resolve(null)), [user?.councilId]);
  if (!user) return null;
  const areas = portalAreas(user);
  const helpCurrent = pathname === HELP.href;

  return (
    <div className="flex min-h-screen flex-col">
      <header data-surface="navy" className="flex items-center gap-4 border-b-4 border-gold bg-navy px-6 py-3 text-white">
        <BrandMark />
        <div className="flex-1">
          <p className="font-serif text-xl font-bold leading-tight">Knights of Columbus</p>
          <p className="text-sm">{council.data ? councilLabel(council.data) : ' '}</p>
        </div>
        <div className="text-right text-sm">
          <p>
            {user.firstName} {user.lastName} · {user.memberType}
            {user.isOfficer ? ' · Officer' : ''}
          </p>
          <button type="button" onClick={signOut} className="font-bold underline">
            Sign out
          </button>
        </div>
      </header>
      <div className="flex flex-1">
        <nav data-surface="navy" aria-label="Portal sections" className="w-56 shrink-0 bg-navy py-4 text-white">
          <ul className="flex flex-col">
            {areas.map((area) => {
              const item = AREAS[area];
              const current = pathname === item.href;
              return (
                <li key={area}>
                  <Link
                    href={item.href}
                    aria-current={current ? 'page' : undefined}
                    className={cx('block border-l-8 px-4 py-2', current ? 'border-gold bg-white text-navy' : 'border-transparent hover:underline')}
                  >
                    <span className="block text-sm font-bold">{item.label}</span>
                    <span className={cx('block text-xs', current ? 'text-muted' : 'text-white')}>{item.hint}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <Link
            href={HELP.href}
            aria-current={helpCurrent ? 'page' : undefined}
            className={cx(
              'mt-4 flex items-start gap-2 border-l-8 border-t border-t-gold px-4 pb-2 pt-3',
              helpCurrent ? 'border-l-gold bg-white text-navy' : 'border-l-transparent hover:underline',
            )}
          >
            <HelpIcon />
            <span>
              <span className="block text-sm font-bold">{HELP.label}</span>
              <span className={cx('block text-xs', helpCurrent ? 'text-muted' : 'text-white')}>{HELP.hint}</span>
            </span>
          </Link>
        </nav>
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
