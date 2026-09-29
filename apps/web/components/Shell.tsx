'use client';
// The portal frame: navy header (logo, the calling council's number and name, the Messaging and Help shortcuts, the alert bell, and the member menu with
// the avatar that opens My Profile), a navy side navigation folded into accordion groups (portalNavGroups) with a gold marker
// on the current section, and a white content area. Nothing renders behind the sign-in gate.
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { councilLabel, portalNavGroups, type PortalNavGroup, type PortalNavItem } from '@kofc/shared';
import { AlertBell } from '@/components/AlertBell';
import { MemberAvatar } from '@/components/MemberAvatar';
import { Button, cx, Field, Input, Notice } from '@/components/ui';
import { useSession } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';
import emblem from './kofc-logo.png';

/**
 * Every sidebar link's route, label and tooltip. 'profile' is reached from the header's member menu, 'messages' from
 * the header's Messaging shortcut, and the help center from the header's Help shortcut, not the sidebar.
 */
const NAV: Record<PortalNavItem | 'profile' | 'messages', { href: string; label: string; hint: string }> = {
  'member-actions': { href: '/member-actions', label: 'Member Actions Hub', hint: 'My shifts, sign-ups, roster, hours' },
  messages: { href: '/messages', label: 'Communications Hub', hint: 'Message threads and replies' },
  calendar: { href: '/calendar', label: 'Visual Master Calendar', hint: 'Events, shifts and meetings by date' },
  activities: { href: '/activities', label: 'Standalone Activities', hint: 'Standing council activities' },
  members: { href: '/members', label: 'Affiliated Roster', hint: 'Members, types and skills' },
  events: { href: '/events', label: 'Event Planner', hint: 'Events, shifts and councils' },
  meetings: { href: '/meetings', label: 'Meeting Center', hint: 'Meetings, invitations, minutes' },
  elections: { href: '/elections', label: 'Council Officer Nominations', hint: 'Nominate brother Knights for elected office' },
  gallery: { href: '/gallery', label: 'Fraternal Photo Gallery', hint: 'Event photos and slideshows' },
  ledger: { href: '/ledger', label: 'Post-event Ledger', hint: 'Spend, funds raised, lessons' },
  'lessons-registry': { href: '/lessons-registry', label: 'Lessons Registry', hint: 'Lessons learned across councils' },
  'distribution-lists': { href: '/distribution-lists', label: 'Distribution Lists', hint: 'Member lists for council blasts' },
  dashboard: { href: '/dashboard', label: 'Executive Dashboard Summaries', hint: 'Monthly hours, members and funds' },
  donations: { href: '/donations', label: 'Recorded Donations History', hint: 'Record and review council donations' },
  expenses: { href: '/expenses', label: 'My Expense Reports', hint: 'Receipts and reimbursement status' },
  'expenses/queue': { href: '/expenses/queue', label: 'Leadership Auditing Queue', hint: 'Approve or return submitted reports' },
  'expenses/disbursements': { href: '/expenses/disbursements', label: 'Bulk Check Disbursements', hint: 'Pay approved reports by check' },
  'charities/propose': { href: '/charities/propose', label: 'Propose Charity Grant', hint: 'Suggest a charity gift and follow it' },
  'charities/registry': { href: '/charities/registry', label: 'Global Charities Registry', hint: 'Search, suggest and add charities' },
  'charities/queue': { href: '/charities/queue', label: 'Charitable Disbursements Ledger', hint: 'Pay charity proposals by check' },
  'financials/budget': { href: '/budget', label: 'Annual Budget Projections', hint: 'Draft the council budget May 1 - June 30' },
  'council-lookups': { href: '/council-lookups', label: 'Council Lookup Tables', hint: 'Activities, donation types, methods' },
  'elections/appointments': { href: '/elections/appointments', label: 'Appointed Leadership Matrix', hint: "The Grand Knight's appointments and vacant seats" },
  'supreme-sync': { href: '/supreme-sync', label: 'Supreme Council Sync', hint: 'Audit and file Forms 1728 and 1295' },
  lookups: { href: '/lookups', label: 'Global Governance Matrices', hint: 'Maintain the global lookup tables' },
  parishes: { href: '/parishes', label: 'Parish & Pastors Linkage', hint: 'Parishes and their pastors' },
  councils: { href: '/councils', label: 'Councils', hint: 'Add, edit and delete councils' },
  profile: { href: '/profile', label: 'My Profile', hint: 'Photo, biography, contact details, skills' },
};

/** Which collapsible groups the viewer has open, remembered per browser. Storage may be blocked; the sidebar works without it. */
const NAV_STATE_KEY = 'kofc.nav.open';
type OpenGroups = Partial<Record<PortalNavGroup['id'], boolean>>;

function readOpenGroups(): OpenGroups {
  try {
    const raw = typeof window === 'undefined' ? null : window.localStorage.getItem(NAV_STATE_KEY);
    return raw ? (JSON.parse(raw) as OpenGroups) : {};
  } catch {
    return {};
  }
}

function writeOpenGroups(open: OpenGroups): void {
  try {
    window.localStorage.setItem(NAV_STATE_KEY, JSON.stringify(open));
  } catch {
    // a private window or blocked storage: the choice lasts only for this page view
  }
}

const isCurrent = (pathname: string, item: PortalNavItem): boolean => pathname === NAV[item].href;

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

/** Speech bubble, drawn in currentColor so it follows the header's white text. */
function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
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
      <ChatIcon />
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

/** One dense sidebar link: the label only, with its description as the tooltip; gold marker when current. */
function NavLink({ item, current }: { item: PortalNavItem; current: boolean }) {
  const { href, label, hint } = NAV[item];
  return (
    <li>
      <Link
        href={href}
        title={hint}
        aria-current={current ? 'page' : undefined}
        className={cx('flex items-center gap-2 border-l-8 py-1.5 pl-6 pr-3 text-sm', current ? 'border-gold bg-white font-bold text-navy' : 'border-transparent hover:underline')}
      >
        {label}
      </Link>
    </li>
  );
}

/**
 * The sidebar: one block per portalNavGroups group. The Self-Service Hub is always open; the others fold under a
 * header button (▸ closed, ▾ open). The group holding the current page opens itself, and the viewer's choices are
 * remembered in this browser.
 */
function SideNav({ groups, pathname }: { groups: PortalNavGroup[]; pathname: string }) {
  const [open, setOpen] = useState<OpenGroups>(readOpenGroups);
  const currentGroup = groups.find((g) => g.items.some((item) => isCurrent(pathname, item)))?.id;
  useEffect(() => {
    if (currentGroup) setOpen((now) => (now[currentGroup] ? now : { ...now, [currentGroup]: true }));
  }, [currentGroup]);
  const toggle = (id: PortalNavGroup['id']) =>
    setOpen((now) => {
      const next = { ...now, [id]: !now[id] };
      writeOpenGroups(next);
      return next;
    });

  return (
    <nav data-surface="navy" aria-label="Portal sections" className="w-60 shrink-0 bg-navy py-3 text-white">
      {groups.map((group) => {
        const expanded = !group.collapsible || !!open[group.id];
        const listId = `nav-group-${group.id}`;
        return (
          <div key={group.id} className="border-t border-t-gold pb-2 pt-1 first:border-t-0 first:pt-0">
            {group.collapsible ? (
              <h2>
                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-controls={listId}
                  onClick={() => toggle(group.id)}
                  className="flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-xs font-bold uppercase tracking-wide hover:underline"
                >
                  <span>{group.label}</span>
                  <span aria-hidden="true" className="text-gold">
                    {expanded ? '▾' : '▸'}
                  </span>
                </button>
              </h2>
            ) : (
              <h2 className="px-4 py-2 text-xs font-bold uppercase tracking-wide">{group.label}</h2>
            )}
            {expanded ? (
              <ul id={listId} className="flex flex-col">
                {group.items.map((item) => (
                  <NavLink key={item} item={item} current={isCurrent(pathname, item)} />
                ))}
              </ul>
            ) : null}
          </div>
        );
      })}
    </nav>
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
        {devHint ? <p className="text-xs text-muted">Development data: testadmin@kofc.org or testsuperadmin@kofc.org, password koc15295.</p> : null}
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
        <SideNav groups={portalNavGroups(user)} pathname={pathname} />
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
