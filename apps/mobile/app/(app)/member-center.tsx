// The Shared Member Center on the phone (Sprint 7A Extension), opened from the card on Home; not a tab of its own.
// The same collective, non-financial view as the web portal's /member-center (reports.memberCenter): this month's
// volunteer count, hours and names, the council's combined devotions (sums only), the gold-bordered Top 5 Volunteers
// Leaderboard, and the member's own impact card - events attended, personal hours, the canonization shield and their
// council membership history. No cash, budget or ledger figure appears here.
import { View } from 'react-native';
import { toIsoDate, type AffiliationHistoryEntry, type MemberCenter } from '@kofc/shared';
import { CanonizationShield } from '@/components/DevotionalTracker';
import { AppText, Card, EmptyState, Loading, Notice, Screen, Section } from '@/components/ui';
import { useUser } from '@/lib/app-context';
import { useLoad } from '@/lib/use-async';
import { useTheme } from '@/lib/layout-mode';
import { db } from '@/services/db';

const MEDALS = ['🥇', '🥈', '🥉'];
const hours = (h: number) => `${h.toLocaleString('en-US', { maximumFractionDigits: 2 })} h`;
const day = (stamp: string | null) => (stamp ? stamp.slice(0, 10) : 'not recorded');

function Figure({ label, value }: { label: string; value: string }) {
  const { color } = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <AppText variant="label" tone="white" style={{ color: color.gold }}>
        {label}
      </AppText>
      <AppText variant="heading" tone="white">
        {value}
      </AppText>
    </View>
  );
}

function Overview({ c }: { c: MemberCenter }) {
  const { color, space, radius, border } = useTheme();
  return (
    <View style={{ backgroundColor: color.navy, borderColor: color.gold, borderWidth: border(4), borderRadius: radius.md, padding: space.md, gap: space.sm }}>
      <View style={{ flexDirection: 'row', gap: space.md }}>
        <Figure label="VOLUNTEERS" value={String(c.volunteerCount)} />
        <Figure label="HOURS SERVED" value={hours(c.totalHours)} />
      </View>
      <AppText variant="label" tone="white" style={{ color: color.gold }}>
        WHO SERVED THIS MONTH
      </AppText>
      {c.volunteers.length === 0 ? (
        <AppText tone="white">Nobody has logged service this month yet.</AppText>
      ) : (
        c.volunteers.map((v) => (
          <AppText key={v.memberId} tone="white">
            {v.firstName} {v.lastName} · {hours(v.hours)}
          </AppText>
        ))
      )}
    </View>
  );
}

function Leaderboard({ c }: { c: MemberCenter }) {
  const { color, space, radius, border } = useTheme();
  return (
    <View style={{ borderColor: color.gold, borderWidth: border(4), borderRadius: radius.md, padding: space.md, gap: space.sm, backgroundColor: color.white }}>
      <AppText variant="title">🏆 Top 5 Volunteers Leaderboard</AppText>
      {c.leaderboard.length === 0 ? (
        <AppText>No member has logged hours yet. Be the first!</AppText>
      ) : (
        c.leaderboard.map((l) => (
          <View
            key={l.memberId}
            style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, borderColor: color.navy, borderWidth: border(2), borderRadius: radius.sm, padding: space.sm }}
          >
            <AppText variant="title" accessibilityLabel={`Rank ${l.rank}`}>
              {MEDALS[l.rank - 1] ?? `#${l.rank}`}
            </AppText>
            <AppText variant="title" style={{ flex: 1 }}>
              {l.firstName} {l.lastName}
            </AppText>
            <AppText variant="label" style={{ backgroundColor: color.gold, paddingHorizontal: space.sm, borderRadius: radius.sm }}>
              {hours(l.hours)}
            </AppText>
          </View>
        ))
      )}
    </View>
  );
}

function History({ entries }: { entries: AffiliationHistoryEntry[] }) {
  return (
    <View>
      {entries.map((h, i) => (
        <AppText key={h.id ?? `current-${i}`} variant="small">
          {h.councilName} · {h.status} · joined {day(h.dateJoined)}
          {h.dateExited ? ` · left ${day(h.dateExited)}` : ' · current'}
        </AppText>
      ))}
    </View>
  );
}

export default function MemberCenterScreen() {
  const { space } = useTheme();
  const user = useUser();
  const state = useLoad(async () => {
    const today = toIsoDate(new Date());
    const [center, history] = await Promise.all([
      db.reports.memberCenter(user.memberId, user.councilId, Number(today.slice(0, 4)), Number(today.slice(5, 7))),
      db.members.listAffiliations(user.memberId, user.memberId),
    ]);
    return { center, history };
  }, [user.memberId, user.councilId]);
  const c = state.data?.center;
  return (
    <Screen refreshing={state.refreshing} onRefresh={() => void state.reload()}>
      <AppText variant="heading" accessibilityRole="header">
        Shared Member Center
      </AppText>
      {state.error ? <Notice tone="error" message={state.error} /> : null}
      {!c && state.loading ? <Loading /> : null}
      {c ? (
        <>
          <Section title="This month">
            <Overview c={c} />
          </Section>
          {c.devotions ? (
            <Section title="Our combined devotions">
              <Card>
                <AppText>📿 {c.devotions.rosaries} rosaries said</AppText>
                <AppText>🕯️ {c.devotions.adorations} hours of adoration</AppText>
                <AppText>✝️ {c.devotions.confessions} confessions</AppText>
                <AppText variant="small" tone="muted">
                  Added up from {c.devotions.contributors} member{c.devotions.contributors === 1 ? '' : 's'}. Nobody&apos;s own tally is shown.
                </AppText>
              </Card>
            </Section>
          ) : null}
          <Section title="Leaderboard">
            <Leaderboard c={c} />
          </Section>
          <Section title="My impact">
            <Card>
              <View style={{ gap: space.sm }}>
                <AppText variant="title">
                  {c.me.eventsAttended} event{c.me.eventsAttended === 1 ? '' : 's'} attended · {hours(c.me.hours)} served
                </AppText>
                {c.me.rank ? <CanonizationShield rank={c.me.rank} /> : null}
                <AppText variant="label">My council history</AppText>
                {state.data && state.data.history.length > 0 ? <History entries={state.data.history} /> : <EmptyState message="No council history yet." />}
              </View>
            </Card>
          </Section>
        </>
      ) : null}
      <View style={{ height: space.lg }} />
    </Screen>
  );
}
