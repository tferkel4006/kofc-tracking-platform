// =========================================================================
// THE ST. MARY'S LIVE AGENDA AND THE RECORDER'S HAND-VOTE TALLIES (Sprint 6B)
// Pure helpers behind meetings.getMeetingAgenda, applyAgendaBlueprint, editAgendaLine, recordHandBallotTally and
// linkHandTallyTransaction: the agenda's sections and blueprint, who edits it, the line and tally checks, the speaker
// lookup and the MeetingAgendaView the console reads, and the light markdown its lines are written in. Drivers load
// rows, call these, then only store.
// =========================================================================
import type { AgendaLineRef, AgendaLineView, AgendaOfficerSeat, AgendaSpeaker, LedgerTransactionSummary, MeetingAgendaView } from './contract';
import { assertMotionPending, type FinalMotionResult } from './assembly';
import { assertText, BusinessRuleError, describeActor, hasAdminRights, hasSuperAdminRights, SecurityPrivilegeError, type MemberWriteActor } from './rules';
import type { AgendaSectionKey, Event, JournalEntry, Meeting, MeetingAgendaItem, MotionHandTally, ProposedMotion } from './types';

const invalid = (message: string, details: Record<string, unknown> = {}) => new BusinessRuleError('INVALID_INPUT', message, details);

// ---- sections and blueprint -------------------------------------------------------------

/** The St. Mary's agenda headings, in the order the meeting takes them. */
export const AGENDA_SECTIONS: readonly { key: AgendaSectionKey; title: string }[] = [
  { key: 'opening', title: 'Call to Order & Opening' },
  { key: 'officer_reports', title: "Chaplain's & Officer Reports" },
  { key: 'director_reports', title: 'Director & Ministry Reports' },
  { key: 'new_business', title: 'New Business' },
  { key: 'old_business', title: 'Old Business' },
  { key: 'upcoming_events', title: 'Upcoming Events' },
  { key: 'good_of_order', title: 'Good of the Order' },
];

export const AGENDA_SECTION_KEYS: readonly AgendaSectionKey[] = AGENDA_SECTIONS.map((s) => s.key);

/** The sections whose motion lines carry the Recorder's hand-vote console. */
export const LEGISLATIVE_SECTION_KEYS: readonly AgendaSectionKey[] = ['new_business', 'old_business'];

/** Longest MeetingAgendaItem.LineMarkdown a correction may write. */
export const AGENDA_LINE_MAX_LENGTH = 2000;
/** Most coming events the Upcoming Events block lists. */
export const AGENDA_UPCOMING_EVENTS_LIMIT = 8;

/** One line of AGENDA_BLUEPRINT: its seat by role name (looked up per council) and the label printed when it is vacant. */
export interface AgendaBlueprintLine {
  section: AgendaSectionKey;
  markdown: string;
  role?: string;
  label?: string;
}

/**
 * The St. Mary's Cathedral agenda (October 6, 2026) as a reusable skeleton: every report is tied to a seat, never to a
 * person, so it follows elections. New Business, Old Business and Upcoming Events fill themselves from the meeting's
 * motions and the council's calendar.
 */
export const AGENDA_BLUEPRINT: readonly AgendaBlueprintLine[] = [
  { section: 'opening', markdown: '**Call to Order** - the Grand Knight opens the meeting', role: 'Grand Knight' },
  { section: 'opening', markdown: '**Opening Prayer & Pledge of Allegiance**', role: 'Chaplain', label: 'Chaplain' },
  { section: 'opening', markdown: '**Roll Call of Officers**', role: 'Deputy Grand Knight' },
  { section: 'opening', markdown: '**Reading & Approval of the Minutes** of the last meeting', role: 'Recorder' },
  { section: 'officer_reports', markdown: "**Chaplain's Report** & spiritual reflection", role: 'Chaplain', label: 'Chaplain' },
  { section: 'officer_reports', markdown: "**Grand Knight's Report**", role: 'Grand Knight' },
  { section: 'officer_reports', markdown: "**Financial Secretary's Report**", role: 'Financial Secretary' },
  { section: 'officer_reports', markdown: "**Treasurer's Report**", role: 'Treasurer' },
  { section: 'officer_reports', markdown: "**State Deputy's Remarks**", label: 'State Deputy' },
  { section: 'director_reports', markdown: "**Membership Director's Report**", role: 'Membership Director' },
  { section: 'director_reports', markdown: "**Program Director's Report**", role: 'Program Director' },
  { section: 'director_reports', markdown: "**Community Director's Report**", role: 'Community Director' },
  { section: 'director_reports', markdown: "**Family Director's Report**", role: 'Family Director' },
  { section: 'good_of_order', markdown: '**Prayer Requests**' },
  { section: 'good_of_order', markdown: '**Closing Prayer**', role: 'Chaplain', label: 'Chaplain' },
];

/** The blueprint as rows for `meeting`, each seat's RoleID looked up by name (an unknown role keeps only its label). */
export function blueprintAgendaItems(
  meeting: Pick<Meeting, 'id' | 'CouncilID'>,
  roles: readonly { id: number; Role: string }[],
): Omit<MeetingAgendaItem, 'id'>[] {
  const order = new Map<AgendaSectionKey, number>();
  return AGENDA_BLUEPRINT.map((line) => {
    const sort = (order.get(line.section) ?? 0) + 1;
    order.set(line.section, sort);
    return {
      CouncilID: meeting.CouncilID,
      MeetingID: meeting.id,
      SectionKey: line.section,
      SortOrder: sort,
      LineMarkdown: line.markdown,
      SpeakerRoleID: line.role ? (roles.find((r) => r.Role === line.role)?.id ?? null) : null,
      SpeakerMemberID: null,
      SpeakerLabel: line.label ?? null,
      ProposedMotionID: null,
      LinkedEventID: null,
      LastEditedByMemberID: null,
      LastEditedAt: null,
    };
  });
}

/** applyAgendaBlueprint on a meeting that already has agenda items. */
export const agendaAlreadyStructured = (meetingId: number): BusinessRuleError =>
  new BusinessRuleError('AGENDA_CONFLICT', `Meeting ${meetingId} already has its agenda laid out; correct its lines instead.`, { meetingId });

// ---- who edits ----------------------------------------------------------------------------

/** The seats that keep the live agenda and record hand votes, besides Admins and Super Admins. */
export const AGENDA_EDITOR_ROLE_NAMES = ['Grand Knight', 'Recorder'] as const;

function agendaEditorDenial(actor: MemberWriteActor, meeting: Pick<Meeting, 'id' | 'CouncilID'>, action: string): SecurityPrivilegeError | null {
  if (hasSuperAdminRights(actor)) return null;
  const seated = actor.active && (actor.roles ?? []).some((r) => (AGENDA_EDITOR_ROLE_NAMES as readonly string[]).includes(r));
  if (!hasAdminRights(actor) && !seated) {
    return new SecurityPrivilegeError(
      'AGENDA_EDITOR_REQUIRED',
      `Only the council's Grand Knight or Recorder, an Admin, or a Super Admin can ${action}; member ${actor.memberId} is ${describeActor(actor)}.`,
      { actorId: actor.memberId, meetingId: meeting.id },
    );
  }
  if (actor.councilId === meeting.CouncilID) return null;
  return new SecurityPrivilegeError(
    'COUNCIL_ACCESS_DENIED',
    `Member ${actor.memberId} of council ${actor.councilId} cannot ${action} for council ${meeting.CouncilID}; a meeting's agenda is kept by its own council.`,
    { actorId: actor.memberId, actorCouncilId: actor.councilId, councilId: meeting.CouncilID, meetingId: meeting.id },
  );
}

/**
 * The live agenda's editors (Sprint 6B): an Active Grand Knight or Recorder of the meeting's council, an Active Admin of
 * it, or an Active Super Admin. They lay out the agenda, correct its lines and record hand votes. `action` completes
 * "cannot ...".
 */
export function assertMayEditLiveAgenda(actor: MemberWriteActor, meeting: Pick<Meeting, 'id' | 'CouncilID'>, action: string): void {
  const denial = agendaEditorDenial(actor, meeting, action);
  if (denial) throw denial;
}

export const mayEditLiveAgenda = (actor: MemberWriteActor, meeting: Pick<Meeting, 'id' | 'CouncilID'>): boolean =>
  agendaEditorDenial(actor, meeting, 'edit the agenda') === null;

// ---- line corrections -----------------------------------------------------------------------

/** A correction's markdown, trimmed (INVALID_INPUT when blank or over AGENDA_LINE_MAX_LENGTH). */
export const cleanAgendaLineMarkdown = (value: unknown): string => assertText(value, 'Agenda line', AGENDA_LINE_MAX_LENGTH);

/** An AgendaLineRef from the caller, checked (INVALID_INPUT). */
export function assertAgendaLineRef(value: unknown): AgendaLineRef {
  const ref = value as Partial<{ kind: string; itemId: unknown; motionId: unknown; eventId: unknown }> | null;
  const id = (v: unknown) => typeof v === 'number' && Number.isInteger(v) && v > 0;
  if (ref && ref.kind === 'item' && id(ref.itemId)) return { kind: 'item', itemId: ref.itemId as number };
  if (ref && ref.kind === 'motion' && id(ref.motionId)) return { kind: 'motion', motionId: ref.motionId as number };
  if (ref && ref.kind === 'event' && id(ref.eventId)) return { kind: 'event', eventId: ref.eventId as number };
  throw invalid(`An agenda line is an item, a motion or an event with its id; received ${JSON.stringify(value)}.`, { line: value });
}

/**
 * A stored item's line: a motion's or an event's item is addressed by its motion or event, so the line keeps its key
 * from before its first correction to after.
 */
export const itemLineRef = (item: Pick<MeetingAgendaItem, 'id' | 'ProposedMotionID' | 'LinkedEventID'>): AgendaLineRef =>
  item.ProposedMotionID != null
    ? { kind: 'motion', motionId: item.ProposedMotionID }
    : item.LinkedEventID != null
      ? { kind: 'event', eventId: item.LinkedEventID }
      : { kind: 'item', itemId: item.id };

export const agendaLineKey = (ref: AgendaLineRef): string =>
  ref.kind === 'item' ? `item:${ref.itemId}` : ref.kind === 'motion' ? `motion:${ref.motionId}` : `event:${ref.eventId}`;

export const agendaLineNotFound = (ref: AgendaLineRef, meetingId: number): BusinessRuleError =>
  new BusinessRuleError('RECORD_NOT_FOUND', `Agenda line ${agendaLineKey(ref)} is not on meeting ${meetingId}'s agenda.`, { line: ref, meetingId });

/** Where a generated motion line sorts among its section's items, so a corrected motion keeps its place. */
export const MOTION_LINE_SORT_BASE = 10_000;

/** The text a motion's line shows until it is corrected. */
export const defaultMotionLine = (motion: Pick<ProposedMotion, 'MotionText'>): string => `**Motion:** ${motion.MotionText}`;

/** The text an event's Upcoming Events line shows until it is corrected: name, dates and place. */
export function defaultEventLine(event: Pick<Event, 'EventName' | 'StartDate' | 'EndDate' | 'Location'>): string {
  const start = event.StartDate.slice(0, 10);
  const end = event.EndDate.slice(0, 10);
  const when = end && end !== start ? `${start} to ${end}` : start;
  return `**${event.EventName}** - ${when}${event.Location ? ` · ${event.Location}` : ''}`;
}

// ---- hand tallies ---------------------------------------------------------------------------

/** Most hands one side of a hand vote may count. */
export const HAND_TALLY_MAX_COUNT = 9999;

/** A hand count's two sides, checked: whole numbers from 0 to HAND_TALLY_MAX_COUNT and at least one hand (INVALID_INPUT). */
export function cleanHandTally(approved: unknown, denied: unknown): { approved: number; denied: number } {
  for (const [label, v] of [['Approved', approved], ['Denied', denied]] as const) {
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > HAND_TALLY_MAX_COUNT) {
      throw invalid(`${label} hands must be a whole number from 0 to ${HAND_TALLY_MAX_COUNT}; received ${String(v)}.`, { label, value: v });
    }
  }
  if ((approved as number) + (denied as number) === 0) throw invalid('A hand vote counts at least one hand.', { approved, denied });
  return { approved: approved as number, denied: denied as number };
}

/** A hand vote's decision: more Approved than Denied passes; a tie fails, as on the smartphone ballot. */
export const handTallyResult = (approved: number, denied: number): Extract<FinalMotionResult, 'Passed' | 'Failed'> =>
  approved > denied ? 'Passed' : 'Failed';

/**
 * recordHandBallotTally: the motion still awaits its vote (MOTION_STATUS_CONFLICT) and never went to a smartphone
 * ballot (BALLOT_STATE_CONFLICT) - one vote, one method.
 */
export function assertHandTallyAllowed(motion: Pick<ProposedMotion, 'id' | 'VoteResult' | 'BallotOpenedAt'>): void {
  assertMotionPending(motion, 'take a hand tally');
  if (motion.BallotOpenedAt == null) return;
  throw new BusinessRuleError('BALLOT_STATE_CONFLICT', `Motion ${motion.id} went to a smartphone ballot; decide it by that ballot, not by hand.`, {
    motionId: motion.id,
  });
}

/** A ledger TransactionID from the caller, trimmed; null or '' means none (INVALID_INPUT past VARCHAR(50)). */
export function cleanTransactionId(value: unknown): string | null {
  if (value == null) return null;
  const id = assertText(value, 'Ledger transaction', 50, false);
  return id === '' ? null : id;
}

/** Linking capital to a motion that did not pass. */
export const capitalOnFailedMotion = (motionId: number): BusinessRuleError =>
  invalid(`Motion ${motionId} did not pass, so no capital was released for it.`, { motionId });

export const ledgerTransactionNotFound = (transactionId: string, councilId: number): BusinessRuleError =>
  new BusinessRuleError('RECORD_NOT_FOUND', `Council ${councilId}'s ledger has no posting ${transactionId}.`, { table: 'JournalEntry', transactionId, councilId });

export const handTallyNotFound = (motionId: number): BusinessRuleError =>
  new BusinessRuleError('RECORD_NOT_FOUND', `Motion ${motionId} has no hand tally recorded.`, { table: 'MotionHandTally', motionId });

/** The council's postings summed, newest first (DateLogged, then TransactionID), at most `limit`. */
export function summarizeLedgerTransactions(entries: readonly JournalEntry[], limit = 50): LedgerTransactionSummary[] {
  const byTxn = new Map<string, JournalEntry[]>();
  for (const e of [...entries].sort((a, b) => a.id - b.id)) {
    const lines = byTxn.get(e.TransactionID) ?? [];
    lines.push(e);
    byTxn.set(e.TransactionID, lines);
  }
  return [...byTxn.entries()]
    .map(([transactionId, lines]) => ({
      transactionId,
      dateLogged: lines[0]!.DateLogged,
      description: lines[0]!.Description,
      amount: Math.round(lines.reduce((sum, l) => sum + Number(l.DebitAmount), 0) * 100) / 100,
      lineCount: lines.length,
      linkedEventId: lines.find((l) => l.LinkedEventID != null)?.LinkedEventID ?? null,
      linkedMeetingId: lines.find((l) => l.LinkedMeetingID != null)?.LinkedMeetingID ?? null,
    }))
    .sort((a, b) => b.dateLogged.localeCompare(a.dateLogged) || b.transactionId.localeCompare(a.transactionId))
    .slice(0, Math.max(1, limit));
}

// ---- the view ----------------------------------------------------------------------------------

interface AgendaMember {
  id: number;
  CouncilID: number;
  MemberFirstName: string;
  MemberLastName: string;
  active: boolean;
}

const fullName = (m: Pick<AgendaMember, 'MemberFirstName' | 'MemberLastName'>): string => `${m.MemberFirstName} ${m.MemberLastName}`.trim();

/**
 * Who holds `roleId` now in `councilId`: the most recently seated (highest MemberRoles id) Active member of the council,
 * so a seat shared during a hand-over shows its newest holder.
 */
export function currentSeatHolder(
  roleId: number,
  councilId: number,
  seats: readonly { id: number; RoleID: number; MemberID: number }[],
  members: ReadonlyMap<number, AgendaMember>,
): AgendaMember | null {
  let best: { seat: number; member: AgendaMember } | null = null;
  for (const s of seats) {
    if (s.RoleID !== roleId) continue;
    const m = members.get(s.MemberID);
    if (!m || !m.active || m.CouncilID !== councilId) continue;
    if (!best || s.id > best.seat) best = { seat: s.id, member: m };
  }
  return best?.member ?? null;
}

/**
 * MeetingAgendaView from the meeting's rows: its items by section (SortOrder, then id), every motion no item carries
 * added to New Business, and the council's coming `events` (already filtered by the driver to the council) that end on
 * or after the meeting's date, soonest first, at most AGENDA_UPCOMING_EVENTS_LIMIT, each replaced by its correction.
 */
export function buildMeetingAgendaView(input: {
  meeting: Meeting;
  items: readonly MeetingAgendaItem[];
  motions: readonly ProposedMotion[];
  handTallies: readonly MotionHandTally[];
  events: readonly Pick<Event, 'id' | 'EventName' | 'StartDate' | 'EndDate' | 'Location'>[];
  roles: readonly { id: number; Role: string; Officer: number }[];
  seats: readonly { id: number; RoleID: number; MemberID: number }[];
  members: readonly AgendaMember[];
}): MeetingAgendaView {
  const { meeting } = input;
  const members = new Map(input.members.map((m) => [m.id, m]));
  const roles = new Map(input.roles.map((r) => [r.id, r]));
  const motions = new Map(input.motions.map((m) => [m.id, m]));
  const tallies = new Map(input.handTallies.map((t) => [t.ProposedMotionID, t]));
  const meetingDate = meeting.Date.slice(0, 10);

  const speakerOf = (item: Pick<MeetingAgendaItem, 'SpeakerMemberID' | 'SpeakerRoleID' | 'SpeakerLabel'>): AgendaSpeaker | null => {
    const roleName = item.SpeakerRoleID != null ? (roles.get(item.SpeakerRoleID)?.Role ?? null) : null;
    const named = item.SpeakerMemberID != null ? members.get(item.SpeakerMemberID) : undefined;
    if (named) return { name: fullName(named), roleName, memberId: named.id };
    const holder = item.SpeakerRoleID != null ? currentSeatHolder(item.SpeakerRoleID, meeting.CouncilID, input.seats, members) : null;
    if (holder) return { name: fullName(holder), roleName, memberId: holder.id };
    if (item.SpeakerLabel) return { name: item.SpeakerLabel, roleName, memberId: null };
    return null;
  };
  const editedBy = (item: MeetingAgendaItem | undefined): string | null => {
    const m = item?.LastEditedByMemberID != null ? members.get(item.LastEditedByMemberID) : undefined;
    return m ? fullName(m) : null;
  };
  const fromItem = (item: MeetingAgendaItem, ref: AgendaLineRef, extra: Partial<AgendaLineView> = {}): AgendaLineView => {
    const motion = item.ProposedMotionID != null ? (motions.get(item.ProposedMotionID) ?? null) : null;
    return {
      key: agendaLineKey(ref),
      ref,
      section: item.SectionKey,
      markdown: item.LineMarkdown,
      speaker: speakerOf(item),
      motion: motion ? { ...motion } : null,
      handTally: motion && tallies.has(motion.id) ? { ...tallies.get(motion.id)! } : null,
      event: null,
      lastEditedAt: item.LastEditedAt ?? null,
      lastEditedByName: editedBy(item),
      ...extra,
    };
  };

  const items = [...input.items].filter((i) => i.MeetingID === meeting.id).sort((a, b) => a.SortOrder - b.SortOrder || a.id - b.id);
  const motionItems = new Map(items.filter((i) => i.ProposedMotionID != null).map((i) => [i.ProposedMotionID!, i]));
  const eventItems = new Map(items.filter((i) => i.LinkedEventID != null).map((i) => [i.LinkedEventID!, i]));

  const sections = AGENDA_SECTIONS.map(({ key, title }) => {
    type Sorted = { sort: number; tie: number; line: AgendaLineView };
    const sorted: Sorted[] = [];
    if (key === 'upcoming_events') {
      const coming = [...input.events]
        .filter((e) => (e.EndDate || e.StartDate).slice(0, 10) >= meetingDate)
        .sort((a, b) => a.StartDate.localeCompare(b.StartDate) || a.id - b.id)
        .slice(0, AGENDA_UPCOMING_EVENTS_LIMIT);
      const lines: AgendaLineView[] = coming.map((e) => {
        const event = { id: e.id, EventName: e.EventName, StartDate: e.StartDate, EndDate: e.EndDate, Location: e.Location };
        const ref: AgendaLineRef = { kind: 'event', eventId: e.id };
        const item = eventItems.get(e.id);
        if (item) return fromItem(item, ref, { section: key, event });
        return {
          key: agendaLineKey(ref),
          ref,
          section: key,
          markdown: defaultEventLine(e),
          speaker: null,
          motion: null,
          handTally: null,
          event,
          lastEditedAt: null,
          lastEditedByName: null,
        };
      });
      const plain = items.filter((i) => i.SectionKey === key && i.LinkedEventID == null).map((i) => fromItem(i, { kind: 'item', itemId: i.id }));
      return { key, title, lines: [...lines, ...plain] };
    }
    for (const item of items) {
      if (item.SectionKey !== key || item.LinkedEventID != null) continue;
      sorted.push({ sort: item.SortOrder, tie: item.id, line: fromItem(item, itemLineRef(item)) });
    }
    if (key === 'new_business') {
      for (const motion of [...input.motions].sort((a, b) => a.id - b.id)) {
        if (motion.TargetMeetingID !== meeting.id || motionItems.has(motion.id)) continue;
        const ref: AgendaLineRef = { kind: 'motion', motionId: motion.id };
        sorted.push({
          sort: MOTION_LINE_SORT_BASE + motion.id,
          tie: 0,
          line: {
            key: agendaLineKey(ref),
            ref,
            section: key,
            markdown: defaultMotionLine(motion),
            speaker: (() => {
              const presenter = members.get(motion.PresenterMemberID);
              return presenter ? { name: fullName(presenter), roleName: null, memberId: presenter.id } : null;
            })(),
            motion: { ...motion },
            handTally: tallies.has(motion.id) ? { ...tallies.get(motion.id)! } : null,
            event: null,
            lastEditedAt: null,
            lastEditedByName: null,
          },
        });
      }
    }
    sorted.sort((a, b) => a.sort - b.sort || a.tie - b.tie);
    return { key, title, lines: sorted.map((s) => s.line) };
  });

  const officers: AgendaOfficerSeat[] = [...input.roles]
    .filter((r) => r.Officer === 1)
    .sort((a, b) => a.id - b.id)
    .flatMap((r) => {
      const holder = currentSeatHolder(r.id, meeting.CouncilID, input.seats, members);
      return holder ? [{ roleId: r.id, roleName: r.Role, memberId: holder.id, name: fullName(holder) }] : [];
    });

  return { meeting: { ...meeting }, sections, officers, hasStructuredAgenda: items.length > 0 };
}

// ---- light markdown ------------------------------------------------------------------------------

/** A run of text with its emphasis. */
export interface AgendaMarkdownSpan {
  text: string;
  bold: boolean;
  italic: boolean;
}

/** A paragraph or a '- ' bullet of an agenda line. */
export interface AgendaMarkdownBlock {
  kind: 'paragraph' | 'bullet';
  spans: AgendaMarkdownSpan[];
}

/** **bold** and *italic* runs of one line; an unmatched marker stays literal text. */
function parseSpans(line: string): AgendaMarkdownSpan[] {
  const spans: AgendaMarkdownSpan[] = [];
  const pattern = /\*\*(.+?)\*\*|\*(.+?)\*/g;
  let last = 0;
  for (let m = pattern.exec(line); m; m = pattern.exec(line)) {
    if (m.index > last) spans.push({ text: line.slice(last, m.index), bold: false, italic: false });
    spans.push(m[1] !== undefined ? { text: m[1], bold: true, italic: false } : { text: m[2]!, bold: false, italic: true });
    last = m.index + m[0].length;
  }
  if (last < line.length) spans.push({ text: line.slice(last), bold: false, italic: false });
  return spans;
}

/**
 * An agenda line's light markdown as blocks the console renders without HTML: each non-blank line is a paragraph, or a
 * bullet when it starts with '- ' or '* '; inside, **bold** and *italic*. Anything else is plain text.
 */
export function parseAgendaMarkdown(text: string): AgendaMarkdownBlock[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .map((line) => {
      const bullet = /^[-*]\s+/.exec(line);
      return bullet ? { kind: 'bullet' as const, spans: parseSpans(line.slice(bullet[0].length)) } : { kind: 'paragraph' as const, spans: parseSpans(line) };
    });
}

// ---- last-minute lines and the line on the floor (Sprint 6B Patch) ---------------------------------

/** Rejects INVALID_INPUT unless `value` is one of AGENDA_SECTION_KEYS. */
export function assertAgendaSectionKey(value: unknown): AgendaSectionKey {
  if ((AGENDA_SECTION_KEYS as readonly unknown[]).includes(value)) return value as AgendaSectionKey;
  throw invalid(`An agenda section is one of ${AGENDA_SECTION_KEYS.join(', ')}; received ${JSON.stringify(value)}.`, { section: value });
}

/**
 * Where a last-minute line goes in `section`: after every line already there - its stored items and, in New Business,
 * the generated motion lines (which sort at MOTION_LINE_SORT_BASE + motion id).
 */
export function nextAgendaSortOrder(
  section: AgendaSectionKey,
  items: readonly Pick<MeetingAgendaItem, 'SectionKey' | 'SortOrder'>[],
  meetingMotionIds: readonly number[],
): number {
  const sorts = items.filter((i) => i.SectionKey === section).map((i) => i.SortOrder);
  if (section === 'new_business') sorts.push(...meetingMotionIds.map((id) => MOTION_LINE_SORT_BASE + id));
  return Math.max(0, ...sorts) + 1;
}

/** A line key for Meeting.ActiveAgendaLineKey: 'item:N', 'motion:N' or 'event:N', or null (INVALID_INPUT otherwise). */
export function cleanAgendaLineKey(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (typeof value === 'string' && /^(?:item|motion|event):[1-9]\d{0,9}$/.test(value)) return value;
  throw invalid(`An agenda line key is 'item:N', 'motion:N' or 'event:N'; received ${JSON.stringify(value)}.`, { lineKey: value });
}

/** The line on the floor and the section holding it, for the phones' focus frame; nulls when none is on the agenda. */
export function locateActiveAgendaLine(view: Pick<MeetingAgendaView, 'sections'>, lineKey: string | null | undefined): { sectionIndex: number; lineKey: string } | null {
  if (!lineKey) return null;
  const sectionIndex = view.sections.findIndex((s) => s.lines.some((l) => l.key === lineKey));
  return sectionIndex < 0 ? null : { sectionIndex, lineKey };
}
