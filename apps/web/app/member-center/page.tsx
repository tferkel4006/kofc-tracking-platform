'use client';
// The Shared Member Center (Sprint 7A Extension): every member's view of how the council is doing, from
// reports.memberCenter. Collective and non-financial on purpose - no cash, budget or ledger figure is on this page; those
// stay on the Executive Summary and the finance screens, which ordinary members cannot open.
//   - The month at a glance: volunteer count, hours served and the names of everyone who served.
//   - The council's combined devotions: rosaries, hours of adoration and confessions added up (never one member's tally).
//   - The gold-bordered Top 5 Volunteers Leaderboard (shared with the Executive Summary).
//   - My impact card: the member's own events attended, hours and canonization shield, and their council membership
//     history (members.listAffiliations).
// For a white-label council the devotions and the shield are left out (Knights of Columbus extensions).
import { useState } from 'react';
import { type MemberCenter } from '@kofc/shared';
import { RequireArea } from '@/components/CouncilScope';
import { AffiliationHistoryCard, CanonizationShield, Leaderboard } from '@/components/EngagementParts';
import { Field, Notice, PageTitle, Select } from '@/components/ui';
import { formatDecimalHours, formatPersonName } from '@/lib/format';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-wide text-gold">{label}</dt>
      <dd className="text-4xl font-bold">{value}</dd>
    </div>
  );
}

function MonthOverview({ c, label }: { c: MemberCenter; label: string }) {
  return (
    <section aria-label="The month at a glance" className="rounded border-4 border-gold bg-navy px-5 py-4 text-white">
      <h2 className="font-serif text-xl font-bold">Council volunteers · {label}</h2>
      <dl className="mt-3 grid grid-cols-2 gap-3">
        <Stat label="Volunteers" value={c.volunteerCount.toLocaleString('en-US')} />
        <Stat label="Hours served" value={formatDecimalHours(c.totalHours)} />
      </dl>
      <h3 className="mt-4 text-sm font-bold text-gold">Who served</h3>
      {c.volunteers.length === 0 ? (
        <p className="text-sm">Nobody has logged service this month yet.</p>
      ) : (
        <ul className="mt-1 grid max-h-64 grid-cols-1 gap-x-4 overflow-y-auto text-sm sm:grid-cols-2" aria-label="Volunteers this month">
          {c.volunteers.map((v) => (
            <li key={v.memberId} className="flex justify-between gap-2 border-b border-white/20 py-1">
              <span className="font-bold">{formatPersonName(v.firstName, v.lastName)}</span>
              <span>{formatDecimalHours(v.hours)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Devotions({ d }: { d: NonNullable<MemberCenter['devotions']> }) {
  const tiles: [string, number][] = [
    ['📿 Rosaries said', d.rosaries],
    ['🕯️ Hours of adoration', d.adorations],
    ['✝️ Confessions', d.confessions],
  ];
  return (
    <section aria-label="Our combined devotions" className="rounded border-2 border-navy bg-white px-5 py-4">
      <h2 className="font-serif text-xl font-bold">Our combined devotions</h2>
      <p className="text-xs text-muted">
        Everything the council&apos;s members have logged in the phone app, added together. Nobody&apos;s own tally is shown. {d.contributors} member
        {d.contributors === 1 ? '' : 's'} logged devotions.
      </p>
      <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {tiles.map(([label, value]) => (
          <div key={label} className="rounded border-2 border-gold px-3 py-2">
            <dt className="text-sm font-bold">{label}</dt>
            <dd className="text-3xl font-bold text-navy">{value.toLocaleString('en-US')}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function MyImpact({ c }: { c: MemberCenter }) {
  const me = c.me;
  return (
    <section aria-label="My impact" className="flex flex-col gap-3 rounded border-4 border-gold bg-white px-5 py-4">
      <h2 className="font-serif text-xl font-bold">My impact · {formatPersonName(me.firstName, me.lastName)}</h2>
      <dl className="grid grid-cols-2 gap-3">
        <div className="rounded border-2 border-navy px-3 py-2">
          <dt className="text-sm font-bold">Events attended</dt>
          <dd className="text-3xl font-bold text-navy">{me.eventsAttended.toLocaleString('en-US')}</dd>
        </div>
        <div className="rounded border-2 border-navy px-3 py-2">
          <dt className="text-sm font-bold">Personal hours</dt>
          <dd className="text-3xl font-bold text-navy">{formatDecimalHours(me.hours)}</dd>
        </div>
      </dl>
      {me.rank ? <CanonizationShield rank={me.rank} /> : null}
      <AffiliationHistoryCard memberId={me.memberId} title="My council history" />
    </section>
  );
}

function Center() {
  const user = useUser();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const center = useLoad(() => db.reports.memberCenter(user.memberId, user.councilId, year, month), [user.memberId, user.councilId, year, month]);
  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);
  const c = center.data;
  const label = `${MONTHS[month - 1]} ${year}`;
  return (
    <>
      <PageTitle
        actions={
          <div className="flex items-end gap-3">
            <Field label="Month" className="w-40">
              {(id) => (
                <Select id={id} value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                  {MONTHS.map((name, i) => (
                    <option key={name} value={i + 1}>
                      {name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Year" className="w-28">
              {(id) => (
                <Select id={id} value={year} onChange={(e) => setYear(Number(e.target.value))}>
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
        }
      >
        Shared Member Center
      </PageTitle>
      {center.error ? <Notice tone="error">{center.error}</Notice> : null}
      {!c ? (
        center.error ? null : <p className="text-sm text-muted">Loading the Member Center…</p>
      ) : (
        <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_26rem]">
          <div className="flex flex-col gap-4">
            <MonthOverview c={c} label={label} />
            {c.devotions ? <Devotions d={c.devotions} /> : null}
            <Leaderboard entries={c.leaderboard} />
          </div>
          <MyImpact c={c} />
        </div>
      )}
    </>
  );
}

export default function MemberCenterPage() {
  return (
    <RequireArea area="member-center">
      <Center />
    </RequireArea>
  );
}
