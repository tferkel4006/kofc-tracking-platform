'use client';
// Navigation Guide (Sprint 7C Extension): "Navigation Explained" for the signed-in member, pinned above the sidebar
// pillars for everyone. navigationGuide (navigation-guide.ts) reads the member type and Role names and lists exactly the
// links this member's sidebar shows - the same feature flags and tenant gate apply - each with one plain-English
// sentence, then the header's menus. An ordinary member's guide therefore holds no leadership or finance desks. Black
// on white, bold labels, for easy reading.
import Link from 'next/link';
import { navigationGuide, whiteLabel } from '@kofc/shared';
import { RequireArea } from '@/components/CouncilScope';
import { NAV } from '@/components/Sidebar';
import { PageTitle } from '@/components/ui';
import { useFeatureFlags, useTenantType, useUser } from '@/lib/session';

export default function NavigationGuidePage() {
  const user = useUser();
  const tenant = useTenantType();
  const guide = navigationGuide(user, useFeatureFlags(), tenant);
  const text = (s: string) => whiteLabel(s, tenant);
  return (
    <RequireArea area="navigation-guide">
      <PageTitle>Navigation Guide</PageTitle>
      <div className="flex flex-col gap-5 rounded border-2 border-black bg-white p-5 text-black">
        <section aria-labelledby="guide-persona">
          <h2 id="guide-persona" className="text-lg font-bold">
            You are signed in as: {guide.persona}
            {guide.roles.length > 0 ? ` (${guide.roles.join(', ')})` : ''}
          </h2>
          <p className="text-base">{text(guide.summary)} Each link below is in your sidebar, in the same order.</p>
        </section>
        {guide.groups.map((group) => (
          <section key={group.id} aria-labelledby={`guide-${group.id}`} className="border-t-2 border-black pt-3">
            <h2 id={`guide-${group.id}`} className="mb-2 text-lg font-bold uppercase tracking-wide">
              {text(group.label)}
            </h2>
            <dl className="flex flex-col gap-2">
              {group.entries.map(({ item, explanation }) => (
                <div key={item}>
                  <dt>
                    <Link href={NAV[item].href} className="text-base font-bold underline">
                      {text(NAV[item].label)}
                    </Link>
                  </dt>
                  <dd className="text-base">{text(explanation)}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
        <section aria-labelledby="guide-top-bar" className="border-t-2 border-black pt-3">
          <h2 id="guide-top-bar" className="mb-2 text-lg font-bold uppercase tracking-wide">
            In the top bar
          </h2>
          <dl className="flex flex-col gap-2">
            {guide.topBar.map(({ item, explanation }) => (
              <div key={item}>
                <dt>
                  <Link href={NAV[item].href} className="text-base font-bold underline">
                    {text(NAV[item].label)}
                  </Link>
                </dt>
                <dd className="text-base">{text(explanation)}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </RequireArea>
  );
}
