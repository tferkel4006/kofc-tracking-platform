// The full St. Mary's agenda sheet on the phone (Sprint 6B Patch): every section and line of a meeting's order of
// business (meetings.getMeetingAgenda), read-only, so members can review it before the meeting. While the meeting is
// live the sheet follows the Grand Knight's console (meetings.getLiveAssemblyState, re-read every LIVE_POLL_MS): the line
// the chair put on the floor (LiveAgendaItem.lineKey) gets a high-contrast focus frame - a gold fill inside a heavy navy border
// with an ON THE FLOOR tag - its section heading is marked, and a banner at the top names the topic and its countdown.
// Blank last-minute lines (still being written at the console) are left out.
// Sprint 6C: in the large text layout nothing is filled gold (white type on gold is unreadable); the line on the floor,
// the floor banner and the marked section heading are black inside a thick white frame instead.
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import {
  formatCountdown,
  formatMeetingWhen,
  locateActiveAgendaLine,
  parseAgendaMarkdown,
  type AgendaLineView,
  type LiveAssemblyState,
  type MeetingAgendaView,
} from '@kofc/shared';
import { AppText, EmptyState, Loading, Notice, Pill } from '@/components/ui';
import { useUser } from '@/lib/app-context';
import { describeError } from '@/lib/use-async';
import { useTheme } from '@/lib/layout-mode';
import { fontFamily } from '@/lib/theme';
import { db } from '@/services/db';

/** How often a live meeting is re-read, as the web console does. */
const LIVE_POLL_MS = 3000;
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const RESULT_TONE: Record<string, 'navy' | 'red' | 'gold' | 'outline'> = { Pending: 'outline', Passed: 'navy', Failed: 'red', Tabled: 'gold' };

/** An agenda line's light markdown as nested Text: **bold**, *italic*, '- ' bullets. */
function Markdown({ text, emphasis }: { text: string; emphasis: boolean }) {
  const { color, font, large } = useTheme();
  const base = {
    fontFamily: fontFamily.body,
    fontSize: font(emphasis ? 18 : 16),
    lineHeight: font(emphasis ? 25 : 22),
    color: color.text,
    ...(large ? { fontWeight: '700' as const } : {}),
  };
  return (
    <View style={{ gap: 2 }}>
      {parseAgendaMarkdown(text).map((block, i) => (
        <Text key={i} style={base}>
          {block.kind === 'bullet' ? '•  ' : ''}
          {block.spans.map((span, j) => (
            <Text key={j} style={{ fontWeight: span.bold || large ? '700' : '400', fontStyle: span.italic ? 'italic' : 'normal' }}>
              {span.text}
            </Text>
          ))}
        </Text>
      ))}
    </View>
  );
}

function Line({ line, number, onFloor }: { line: AgendaLineView; number: number; onFloor: boolean }) {
  const { color, radius, space, large } = useTheme();
  return (
    <View
      accessible
      accessibilityState={{ selected: onFloor }}
      accessibilityLabel={onFloor ? 'On the floor now' : undefined}
      style={{
        flexDirection: 'row',
        gap: space.sm,
        paddingVertical: space.sm,
        paddingHorizontal: onFloor ? space.sm : 0,
        borderRadius: radius.md,
        borderWidth: onFloor ? (large ? 8 : 4) : 0,
        borderColor: large ? color.text : color.edge,
        backgroundColor: onFloor && !large ? color.gold : color.white,
        borderBottomWidth: onFloor ? (large ? 8 : 4) : large ? 2 : 1,
        borderBottomColor: onFloor ? (large ? color.text : color.navy) : color.line,
      }}
    >
      <AppText variant="title" style={{ width: large ? 52 : 26, textAlign: 'right' }}>
        {number}
      </AppText>
      <View style={{ flex: 1, gap: space.xs }}>
        {onFloor ? <Pill label="ON THE FLOOR" tone="navy" style={{ alignSelf: 'flex-start' }} /> : null}
        <Markdown text={line.markdown} emphasis={onFloor} />
        {line.speaker ? (
          <AppText variant="small" tone={onFloor ? 'navy' : 'muted'}>
            {line.speaker.name}
            {line.speaker.roleName ? ` · ${line.speaker.roleName}` : ''}
          </AppText>
        ) : null}
        {line.motion ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, alignItems: 'center' }}>
            <Pill label={line.motion.VoteResult.toUpperCase()} tone={RESULT_TONE[line.motion.VoteResult] ?? 'outline'} />
            {line.handTally ? (
              <AppText variant="label">
                Hands {line.handTally.ApprovedCount} – {line.handTally.DeniedCount}
              </AppText>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** Seconds left on the active item, ticking locally between reads. */
function useCountdown(live: LiveAssemblyState | null, readAt: number): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!live?.activeItem) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [live?.activeItem]);
  if (!live?.activeItem) return null;
  return Math.max(0, live.activeItem.secondsRemaining - Math.floor((now - readAt) / 1000));
}

export function AgendaSheet({ meetingId }: { meetingId: number }) {
  const { color, radius, space, large } = useTheme();
  const user = useUser();
  const [agenda, setAgenda] = useState<MeetingAgendaView | null>(null);
  const [live, setLive] = useState<LiveAssemblyState | null>(null);
  const [readAt, setReadAt] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const remaining = useCountdown(live, readAt);
  const isLive = agenda?.meeting.IsLiveInProgress === 1;

  useEffect(() => {
    let alive = true;
    setAgenda(null);
    setLive(null);
    const read = async () => {
      try {
        const view = await db.meetings.getMeetingAgenda(user.memberId, meetingId);
        const state = view.meeting.IsLiveInProgress === 1 ? await db.meetings.getLiveAssemblyState(user.memberId, meetingId) : null;
        if (!alive) return;
        setAgenda(view);
        setLive(state);
        setReadAt(Date.now());
        setError(null);
      } catch (err) {
        if (alive) setError(describeError(err));
      }
    };
    void read();
    const timer = setInterval(() => void read(), LIVE_POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [meetingId, user.memberId]);

  if (error && !agenda) return <Notice tone="error" message={error} />;
  if (!agenda) return <Loading label="Loading the agenda…" />;

  const activeKey = live?.activeItem?.lineKey ?? null;
  const floorSection = locateActiveAgendaLine(agenda, activeKey)?.sectionIndex ?? -1;
  let numbered = 0;

  return (
    <View style={{ gap: space.lg }}>
      <View style={{ gap: space.xs, backgroundColor: color.navy, borderBottomWidth: 6, borderBottomColor: color.gold, borderRadius: radius.md, padding: space.md }}>
        <AppText variant="label" tone="white">
          ORDER OF BUSINESS
        </AppText>
        <AppText variant="heading" tone="white" accessibilityRole="header">
          {agenda.meeting['Meeting Name']}
        </AppText>
        <AppText tone="white">{formatMeetingWhen(agenda.meeting)}</AppText>
        <AppText variant="small" tone="white">
          {agenda.meeting.Location}
        </AppText>
        {isLive ? <Pill label="● LIVE" tone="red" style={{ alignSelf: 'flex-start' }} /> : null}
      </View>

      {isLive && live?.activeItem ? (
        <View
          accessibilityLiveRegion="polite"
          style={{
            borderWidth: large ? 8 : 4,
            borderColor: large ? color.text : color.edge,
            backgroundColor: large ? color.white : color.gold,
            borderRadius: radius.md,
            padding: space.md,
            gap: space.xs,
          }}
        >
          <AppText variant="label">NOW ON THE FLOOR</AppText>
          <AppText variant="title">{live.activeItem.name}</AppText>
          {remaining !== null ? <AppText variant="label">{formatCountdown(remaining)} remaining</AppText> : null}
        </View>
      ) : isLive ? (
        <Notice tone="info" message="The meeting is live. The line on the floor will be framed as the Grand Knight takes each item." />
      ) : null}
      {error ? <Notice tone="error" message={error} onDismiss={() => setError(null)} /> : null}

      {agenda.sections.map((section, si) => {
        const lines = section.lines.filter((l) => l.markdown.trim() !== '');
        return (
          <View key={section.key} style={{ gap: space.xs }}>
            <View
              style={{
                flexDirection: 'row',
                gap: space.sm,
                alignItems: 'baseline',
                borderBottomWidth: 4,
                borderBottomColor: color.gold,
                paddingBottom: space.xs,
                backgroundColor: floorSection === si ? color.navy : color.white,
                ...(large && floorSection === si ? { borderWidth: 6, borderColor: color.text } : {}),
                paddingHorizontal: floorSection === si ? space.sm : 0,
                borderRadius: floorSection === si ? radius.sm : 0,
              }}
            >
              <AppText variant="heading" tone={floorSection === si ? 'white' : 'navy'} style={{ fontSize: 20, lineHeight: 26 }}>
                {ROMAN[si]}. {section.title}
              </AppText>
            </View>
            {lines.length === 0 ? (
              <AppText variant="small" tone="muted">
                {section.key === 'upcoming_events' ? 'Nothing on the council calendar from this meeting on.' : 'Nothing listed.'}
              </AppText>
            ) : (
              lines.map((line) => {
                numbered += 1;
                return <Line key={line.key} line={line} number={numbered} onFloor={line.key === activeKey} />;
              })
            )}
          </View>
        );
      })}
      {!agenda.hasStructuredAgenda && agenda.meeting.Agenda ? (
        <View style={{ gap: space.xs }}>
          <AppText variant="label">AGENDA NOTES</AppText>
          <AppText>{agenda.meeting.Agenda}</AppText>
        </View>
      ) : null}
      {agenda.sections.every((s) => s.lines.length === 0) ? <EmptyState message="This meeting's agenda has not been laid out yet." /> : null}
    </View>
  );
}
