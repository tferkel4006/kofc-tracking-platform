'use client';
// The portal's left sidebar (Sprint 6Z redesign): a navy column of the seven pillars from portalSidebar - Governance,
// Faith In Action, Finances, Performance, Resources, Answers and Setup - every pillar always open, with no accordions.
// Only the links the viewer may open are drawn: since the Sprint 6G Extension a desk the viewer's role cannot open is
// removed from the sidebar, never shown locked or greyed out. The current page carries a gold marker.
// Sprint 6A: a module the council's feature flags switch off is left out entirely too.
// Sprint 6Z-Dual-Gate-Model: a white-label tenant loses the fraternal areas the same way, and every label, tooltip and
// pillar name is drawn through whiteLabel in the tenant's vocabulary.
import Link from 'next/link';
import {
  canOpenArchiveVault,
  portalSidebar,
  whiteLabel,
  type FeatureFlags,
  type PortalNavGroup,
  type PortalNavItem,
  type SessionUser,
  type TenantType,
} from '@kofc/shared';
import { cx } from '@/components/ui';

export interface NavEntry {
  href: string;
  label: string;
  hint: string;
  /** Who may open it (Sprint 5Z-10): kept for reference; the sidebar no longer draws desks the viewer may not open. */
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
  'faith-center': { href: '/faith-center', label: 'Faith Center', hint: "Today's feast day, the daily Bible verse and the Council Prayer Intentions List" },
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
  'finance/audit': { href: '/finance/audit', label: 'Trustee Audit Desk', hint: 'Semiannual Form 1295 audit: verify ledger lines, sign and lock' },
  donations: { href: '/donations', label: 'Donations History', hint: 'Record and review council donations' },
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
  'credentials-vault': {
    href: '/credentials-vault',
    label: 'Credentials Vault',
    hint: 'Connect the council email account and Google Drive',
    restrictedTo: 'council officers, Admins and Super Admins',
  },
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
    restrictedTo: 'council officers, Admins and Super Admins',
  },
  'answers/help': { href: '/answers/help', label: 'Interactive Help Desk', hint: 'Type what you need to do and see the steps from the member guide' },
  'answers/sop': { href: '/answers/sop', label: 'SOP Center', hint: 'Standard operating procedures, kept as markdown files' },
  'resources/bulletins': { href: '/resources/bulletins', label: 'Council Artifacts', hint: 'Flyers, minutes and photo albums filed in Google Drive' },
  'resources/marketing': {
    href: '/resources/marketing',
    label: 'Marketing Factory',
    hint: 'Turn an event into a printable flyer with past photos, and file it in Google Drive',
  },
  'performance/charts': { href: '/performance/charts', label: 'Growth & Hours Charts', hint: 'Membership growth velocity and council hours by month' },
  history: { href: '/history', label: 'Council History', hint: "Each year's officer core, collective accomplishments and oral histories" },
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

/** One dense sidebar link: the label only, with its description as the tooltip; gold marker when current. */
function NavLink({ item, current, tenant }: { item: PortalNavItem; current: boolean; tenant: TenantType }) {
  const { href, label, hint } = NAV[item];
  return (
    <li>
      <Link
        href={href}
        title={whiteLabel(hint, tenant)}
        aria-current={current ? 'page' : undefined}
        className={cx('flex items-center gap-2 border-l-8 py-1.5 pl-6 pr-3 text-sm', current ? 'border-gold bg-white font-bold text-navy' : 'border-transparent hover:underline')}
      >
        {whiteLabel(label, tenant)}
      </Link>
    </li>
  );
}

export function Sidebar({ user, pathname, features, tenant }: { user: SessionUser; pathname: string; features: FeatureFlags; tenant: TenantType }) {
  const groups = portalSidebar(user, features, tenant);
  return (
    <nav data-surface="navy" aria-label="Portal sections" className="w-64 shrink-0 bg-navy py-3 text-white">
      {groups.map((group) => {
        const headingId = `nav-group-${group.id}`;
        return (
          <div key={group.id} className="border-t border-t-gold pb-2 pt-1 first:border-t-0 first:pt-0">
            <h2 id={headingId} className="px-4 py-2 text-xs font-bold uppercase tracking-wide">
              {whiteLabel(group.label, tenant)}
            </h2>
            <ul aria-labelledby={headingId} className="flex flex-col">
              {group.entries.map(({ item }) => (
                <NavLink key={item} item={item} current={isCurrent(pathname, item)} tenant={tenant} />
              ))}
              {(EXTERNAL_NAV[group.id] ?? [])
                .filter((link) => !link.visible || link.visible(user))
                .map(({ href, label, hint }) => (
                  <ExternalNavLink key={href} href={href} label={whiteLabel(label, tenant)} hint={whiteLabel(hint, tenant)} />
                ))}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
