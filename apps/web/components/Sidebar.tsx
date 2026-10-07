'use client';
// The portal's left sidebar (Sprint 6Z redesign): a navy column of the seven pillars from portalSidebar - Governance,
// Faith In Action, Finances, Performance, Resources, Answers and Setup - every pillar always open, with no accordions.
// The sign-off and meeting desks (PORTAL_LOCKABLE_DESKS) are listed for every member: one the viewer may not open is
// shown with a gold lock badge and says who holds it, instead of a link. The current page carries a gold marker.
// Sprint 6A: a module the council's feature flags switch off is left out entirely, never shown locked.
import Link from 'next/link';
import { canOpenArchiveVault, portalSidebar, type FeatureFlags, type PortalNavGroup, type PortalNavItem, type SessionUser } from '@kofc/shared';
import { cx } from '@/components/ui';

export interface NavEntry {
  href: string;
  label: string;
  hint: string;
  /** Who may open it, shown on a locked desk (Sprint 5Z-10). */
  restrictedTo?: string;
}

/**
 * Every sidebar link's route, label and tooltip. 'profile' is reached from the header's member menu, and 'messages' and
 * 'distribution-lists' from the header's Messaging menu, not the sidebar.
 */
export const NAV: Record<PortalNavItem | 'profile' | 'messages' | 'distribution-lists', NavEntry> = {
  'member-actions': { href: '/member-actions', label: 'Member Actions Hub', hint: 'My shifts, sign-ups, roster, hours' },
  messages: { href: '/messages', label: 'Council Messages & Alerts', hint: 'Message threads, trade-team messages and alerts' },
  calendar: { href: '/calendar', label: 'Visual Master Calendar', hint: 'Events, shifts and meetings by date' },
  activities: { href: '/activities', label: 'Standalone Activities', hint: 'Standing council activities' },
  members: { href: '/members', label: 'Affiliated Roster', hint: 'Members, types and skills' },
  events: { href: '/events', label: 'Event Planner', hint: 'Events, shifts and councils' },
  meetings: { href: '/meetings', label: 'Meeting Center', hint: 'Meetings, invitations, minutes' },
  'meetings/cadence': {
    href: '/meetings/cadence',
    label: 'Annual Cadence Manager',
    hint: 'Standing meeting patterns and the annual calendar',
    restrictedTo: 'the Grand Knight and Admins',
  },
  'meetings/live': {
    href: '/meetings/live',
    label: 'Live Meeting Console',
    hint: 'Run a meeting live: agenda, check-ins, secret ballots and the hand-vote recorder',
    restrictedTo: 'council officers and Admins',
  },
  elections: { href: '/elections', label: 'Council Officer Nominations', hint: 'Nominate brother Knights for elected office' },
  gallery: { href: '/gallery', label: 'Fraternal Photo Gallery', hint: 'Event photos and slideshows' },
  ledger: { href: '/ledger', label: 'Post-event Ledger', hint: 'Spend, funds raised, hours, lessons' },
  'lessons-registry': { href: '/lessons-registry', label: 'Lessons Registry', hint: 'Lessons learned across councils' },
  'distribution-lists': { href: '/distribution-lists', label: 'My Distribution Lists', hint: 'Your private member segments and the council-wide lists' },
  dashboard: { href: '/dashboard', label: 'Executive Dashboard', hint: 'Faith-in-Action, monthly hours, members and funds' },
  'finance/dashboard': { href: '/finance/dashboard', label: 'Financial Dashboard', hint: 'Liquidity tanks, balance scale, transfers, bank audits' },
  'finance/ledger': { href: '/finance/ledger', label: 'General Ledger Spreadsheet', hint: 'Chart of accounts with every posting' },
  'finance/balance-sheet': { href: '/finance/balance-sheet', label: 'Balance Sheet', hint: 'Assets against liabilities and equity' },
  donations: { href: '/donations', label: 'Recorded Donations History', hint: 'Record and review council donations' },
  expenses: { href: '/expenses', label: 'My Expense Reports', hint: 'Receipts and reimbursement status' },
  'expenses/queue': { href: '/expenses/queue', label: 'Leadership Auditing Queue', hint: 'Track signatures and return reports' },
  'expenses/audit': {
    href: '/expenses/audit',
    label: 'FS Expense Audit',
    hint: 'Issue written orders on submitted reports',
    restrictedTo: 'the Financial Secretary and Admins',
  },
  'expenses/authorize': {
    href: '/expenses/authorize',
    label: 'GK Expense Authorize',
    hint: 'Counter-sign ordered reports',
    restrictedTo: 'the Grand Knight and Admins',
  },
  'expenses/disbursements': { href: '/expenses/disbursements', label: 'Bulk Check Disbursements', hint: 'Pay dual-signed reports by check' },
  'charities/propose': { href: '/charities/propose', label: 'Propose Charity Grant', hint: "Shepherd an organization's request to the council and follow it" },
  'charities/registry': { href: '/charities/registry', label: 'Global Charities Registry', hint: 'Search, suggest and add charities' },
  'charities/queue': { href: '/charities/queue', label: 'Charitable Disbursements Ledger', hint: 'Pay charity proposals by check' },
  'charities/vetting': {
    href: '/charities/vetting',
    label: 'Charity Vetting Queue',
    hint: 'Claim, audit and advance intake requests',
    restrictedTo: 'council officers, Trustees and Admins',
  },
  'financials/budget': { href: '/budget', label: 'Annual Budget Projections', hint: 'Draft the council budget May 1 - June 30' },
  'council-lookups': { href: '/council-lookups', label: 'Council Lookup Tables', hint: 'Activities, donation types, methods' },
  'elections/appointments': { href: '/elections/appointments', label: 'Appointed Leadership Matrix', hint: "The Grand Knight's appointments and vacant seats" },
  'supreme-sync': { href: '/supreme-sync', label: 'Supreme Council Sync', hint: 'Audit and file Forms 1728 and 1295' },
  lookups: { href: '/lookups', label: 'Global Governance Matrices', hint: 'Maintain the global lookup tables' },
  parishes: { href: '/parishes', label: 'Parish & Pastors Linkage', hint: 'Parishes and their pastors' },
  councils: { href: '/councils', label: 'Councils', hint: "Add, edit and delete councils; switch a council's modules on and off" },
  help: { href: '/help', label: 'Online Help Center', hint: 'Searchable answers from the user manuals, and feedback' },
  'governance/bylaws': { href: '/governance/bylaws', label: 'Constitutional Bylaws', hint: "The council's own bylaws, article by article" },
  'governance/advisor': {
    href: '/governance/advisor',
    label: 'Constitutional Advisor',
    hint: 'Ask a parliamentary question; answers cite the bylaws or the baseline rules',
  },
  'answers/help': { href: '/answers/help', label: 'Interactive Help Desk', hint: 'Type what you need to do and see the steps from the member guide' },
  'answers/sop': { href: '/answers/sop', label: 'SOP Center', hint: 'Standard operating procedures, kept as markdown files' },
  'resources/bulletins': { href: '/resources/bulletins', label: 'Bulletins', hint: 'Flyers, minutes and photo albums filed in Google Drive' },
  'performance/charts': { href: '/performance/charts', label: 'Growth & Hours Charts', hint: 'Membership growth velocity and council hours by month' },
  profile: { href: '/profile', label: 'My Profile', hint: 'Photo, biography, contact details, skills' },
};

/**
 * Links outside the portal, drawn after a group's own entries and opened in a new tab (Sprint 5Z-Demo-Assets). A link with
 * `visible` shows only to the viewers it allows (Sprint 5Z-Demo-Final); the destination's own sharing settings still
 * decide who can open it.
 */
interface ExternalNavEntry {
  href: string;
  label: string;
  hint: string;
  visible?: (user: SessionUser) => boolean;
}

export const EXTERNAL_NAV: Partial<Record<PortalNavGroup['id'], ExternalNavEntry[]>> = {
  resources: [
    {
      href: 'https://drive.google.com/drive/u/3/folders/1ZGDjpkJG61hzWvDFRg4IZHI440ZYDjyH',
      label: '📂 Council Archive Vault',
      hint: "The council's shared Google Drive archive folder (opens in a new tab)",
      visible: canOpenArchiveVault,
    },
  ],
};

/** A sidebar link to a site outside the portal, opened in a new browser tab. */
function ExternalNavLink({ href, label, hint }: Omit<ExternalNavEntry, 'visible'>) {
  return (
    <li>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        title={hint}
        className="flex items-center gap-2 border-l-8 border-transparent py-1.5 pl-6 pr-3 text-sm hover:underline"
      >
        {label}
        <span aria-hidden="true">↗</span>
        <span className="sr-only">(opens in a new tab)</span>
      </a>
    </li>
  );
}

const isCurrent = (pathname: string, item: PortalNavItem): boolean => pathname === NAV[item].href;

/** A padlock drawn in currentColor. */
function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
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

/** A desk the viewer may not open: its name, a gold lock badge (navy on gold, 6.4:1) and who holds it. Not a link. */
function LockedEntry({ item }: { item: PortalNavItem }) {
  const { label, restrictedTo } = NAV[item];
  const who = restrictedTo ? `Restricted to ${restrictedTo}` : 'Restricted to authorized roles';
  return (
    <li>
      <span aria-disabled="true" title={who} className="flex items-center justify-between gap-2 border-l-8 border-transparent py-1.5 pl-6 pr-3 text-sm">
        <span>{label}</span>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gold px-1.5 py-0.5 text-xs font-bold uppercase tracking-wide text-navy">
          <LockIcon />
          Locked
        </span>
        <span className="sr-only">({who})</span>
      </span>
    </li>
  );
}

export function Sidebar({ user, pathname, features }: { user: SessionUser; pathname: string; features: FeatureFlags }) {
  const groups = portalSidebar(user, features);
  return (
    <nav data-surface="navy" aria-label="Portal sections" className="w-64 shrink-0 bg-navy py-3 text-white">
      {groups.map((group) => {
        const headingId = `nav-group-${group.id}`;
        return (
          <div key={group.id} className="border-t border-t-gold pb-2 pt-1 first:border-t-0 first:pt-0">
            <h2 id={headingId} className="px-4 py-2 text-xs font-bold uppercase tracking-wide">
              {group.label}
            </h2>
            <ul aria-labelledby={headingId} className="flex flex-col">
              {group.entries.map(({ item, locked }) =>
                locked ? <LockedEntry key={item} item={item} /> : <NavLink key={item} item={item} current={isCurrent(pathname, item)} />,
              )}
              {(EXTERNAL_NAV[group.id] ?? [])
                .filter((link) => !link.visible || link.visible(user))
                .map(({ href, label, hint }) => (
                  <ExternalNavLink key={href} href={href} label={label} hint={hint} />
                ))}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
