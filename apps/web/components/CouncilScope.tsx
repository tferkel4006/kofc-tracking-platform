'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { councilLabel, isSuperAdmin, portalAreaHref, portalAreas, sortCouncils, type Council, type PortalArea } from '@kofc/shared';
import { Field, Notice, Select } from '@/components/ui';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

/** Renders `children` only when the signed-in role may open `area`; otherwise says why and where to go. */
export function RequireArea({ area, children }: { area: PortalArea; children: ReactNode }) {
  const user = useUser();
  const areas = portalAreas(user);
  if (areas.includes(area)) return <>{children}</>;
  return (
    <Notice tone="error">
      Your role ({user.memberType}
      {user.isOfficer ? ', officer' : ''}) cannot open this section. You can use:{' '}
      {areas.map((a, i) => (
        <span key={a}>
          {i > 0 ? ', ' : ''}
          <Link href={portalAreaHref(a)} className="font-bold underline">
            {a}
          </Link>
        </span>
      ))}
      .
    </Notice>
  );
}

/**
 * The only routes where the council switcher appears: the root and Supreme Sync. Every council workspace
 * (/finance, /meetings, /expenses, /charities, …) is pinned to the signed-in member's own council.
 */
const COUNCIL_SWITCHER_ROUTES = new Set(['/', '/supreme-sync']);

export function showsCouncilSwitcher(pathname: string | null): boolean {
  return COUNCIL_SWITCHER_ROUTES.has(pathname ?? '');
}

export interface CouncilScope {
  /** Every council, ascending by CouncilNumber. */
  councils: Council[];
  /** The council the page works on. */
  councilId: number;
  setCouncilId(id: number): void;
  /** Only Super Admins choose, and only on the switcher routes; everyone else works on their own council. */
  canChoose: boolean;
  /** False on council workspace routes, where the selector (and its read-only label) is not rendered. */
  visible: boolean;
}

export function useCouncilScope(): CouncilScope {
  const user = useUser();
  const list = useLoad(() => db.councils.list(), []);
  const [chosen, setChosen] = useState<number | null>(null);
  const visible = showsCouncilSwitcher(usePathname());
  const canChoose = visible && isSuperAdmin(user);
  return {
    councils: sortCouncils(list.data ?? []),
    councilId: canChoose ? (chosen ?? user.councilId) : user.councilId,
    setCouncilId: setChosen,
    canChoose,
    visible,
  };
}

/**
 * Council drop-down in CouncilNumber order (Specifications: "User Interface Behaviors"); read-only text for non-Super-Admins.
 * Hidden entirely on council workspace routes (Sprint 5Z-Tony-Montana).
 */
export function CouncilSelect({ scope }: { scope: CouncilScope }) {
  if (!scope.visible) return null;
  const current = scope.councils.find((c) => c.id === scope.councilId);
  if (!scope.canChoose) {
    return <p className="text-sm font-bold">{current ? councilLabel(current) : ''}</p>;
  }
  return (
    <Field label="Council" className="w-72">
      {(id) => (
        <Select id={id} value={scope.councilId} onChange={(e) => scope.setCouncilId(Number(e.target.value))}>
          {scope.councils.map((c) => (
            <option key={c.id} value={c.id}>
              {councilLabel(c)}
            </option>
          ))}
        </Select>
      )}
    </Field>
  );
}
