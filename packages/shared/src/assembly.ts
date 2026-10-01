// =========================================================================
// LIVE MEETING MANAGEMENT AND SMARTPHONE BALLOTING (Sprint 5Z-9)
// Pure helpers behind the meetings.* live assembly methods: who runs the
// console, the live and ballot state checks, the agenda countdown, secret
// ballot hashing and tallies, the decision-against-tally rule, the charitable
// outcome of a decided motion, and the LiveAssemblyState the console and the
// phones read. Drivers load rows, call these, then only store.
// =========================================================================
import type { BallotTally, LiveAssemblyState, LiveMotionState } from './contract';
import { assertText, BusinessRuleError, describeActor, hasAdminRights, hasSuperAdminRights, SecurityPrivilegeError, type MemberWriteActor } from './rules';
import type { BallotSelection, BallotVote, CharitableRequest, Meeting, ProposedMotion } from './types';

/** BallotVote.VoteSelection values. */
export const BALLOT_SELECTIONS: readonly BallotSelection[] = ['Approve', 'Deny', 'Abstain'];
/** The decisions finalizeProposedMotionVote records. */
export const FINAL_MOTION_RESULTS = ['Passed', 'Failed', 'Tabled'] as const;
export type FinalMotionResult = (typeof FINAL_MOTION_RESULTS)[number];
/** Longest Meeting.ActiveAgendaItemName (VARCHAR(255)). */
export const LIVE_AGENDA_ITEM_NAME_MAX_LENGTH = 255;
/** Longest allotment for one agenda item, in minutes. */
export const LIVE_AGENDA_ITEM_MAX_MINUTES = 240;

const invalid = (message: string, details: Record<string, unknown> = {}) => new BusinessRuleError('INVALID_INPUT', message, details);

// ---- who runs the console ----------------------------------------------------------

type LiveMeeting = Pick<Meeting, 'id' | 'CouncilID'> & { OwnerID?: number | null };

/**
 * The live console's chair, mirroring the portal's canManageMeeting: the meeting's Active owner, an Active Admin or
 * officer of its council, or an Active Super Admin. `action` completes "cannot ...".
 */
export function assertMayRunLiveAssembly(actor: MemberWriteActor, meeting: LiveMeeting, action: string): void {
  if (hasSuperAdminRights(actor)) return;
  if (actor.active && meeting.OwnerID != null && meeting.OwnerID === actor.memberId) return;
  if (!hasAdminRights(actor) && !(actor.active && actor.officer)) {
    throw new SecurityPrivilegeError(
      'ADMIN_REQUIRED',
      `Only the meeting's owner, an active Admin or officer of its council, or a Super Admin can ${action}; member ${actor.memberId} is ${describeActor(actor)}.`,
      { actorId: actor.memberId, meetingId: meeting.id },
    );
  }
  if (actor.councilId === meeting.CouncilID) return;
  throw new SecurityPrivilegeError(
    'COUNCIL_ACCESS_DENIED',
    `Member ${actor.memberId} of council ${actor.councilId} cannot ${action} for council ${meeting.CouncilID}; a meeting is run by its own council.`,
    { actorId: actor.memberId, actorCouncilId: actor.councilId, councilId: meeting.CouncilID, meetingId: meeting.id },
  );
}

/** Reading a live meeting: any Active member of its council, or an Active Super Admin. */
export function assertMayFollowLiveAssembly(actor: MemberWriteActor, meeting: LiveMeeting): void {
  if (hasSuperAdminRights(actor) || (actor.active && actor.councilId === meeting.CouncilID)) return;
  throw new SecurityPrivilegeError(
    'COUNCIL_ACCESS_DENIED',
    `Only active members of council ${meeting.CouncilID} can follow meeting ${meeting.id}; member ${actor.memberId} is ${describeActor(actor)} of council ${actor.councilId}.`,
    { actorId: actor.memberId, actorCouncilId: actor.councilId, councilId: meeting.CouncilID, meetingId: meeting.id },
  );
}

/**
 * logLiveAttendanceOverride and castAnonymousMobileVote: the member checked in (or voting) must be Active and of the
 * meeting's council (NOT_ACTIVE_COUNCIL_MEMBER).
 */
export function assertLiveParticipant(member: { memberId: number; councilId: number; active: boolean }, meeting: LiveMeeting): void {
  if (member.active && member.councilId === meeting.CouncilID) return;
  throw new BusinessRuleError(
    'NOT_ACTIVE_COUNCIL_MEMBER',
    `Member ${member.memberId} is not an active member of council ${meeting.CouncilID}, so they cannot take part in meeting ${meeting.id}.`,
    { memberId: member.memberId, councilId: meeting.CouncilID, meetingId: meeting.id },
  );
}

/** Rejects NOT_CHECKED_IN unless the voter is on the meeting's live roster. */
export function assertCheckedIn(checkedIn: boolean, memberId: number, meetingId: number): void {
  if (checkedIn) return;
  throw new BusinessRuleError('NOT_CHECKED_IN', `Member ${memberId} has not checked in to meeting ${meetingId}; check in to vote.`, { memberId, meetingId });
}

// ---- live and ballot state -----------------------------------------------------------

export const isMeetingLive = (m: Pick<Meeting, 'IsLiveInProgress'>): boolean => m.IsLiveInProgress === 1;

/** Rejects LIVE_ASSEMBLY_CONFLICT unless the meeting is being run live. `action` completes "cannot ...". */
export function assertMeetingLive(meeting: Pick<Meeting, 'id' | 'IsLiveInProgress'>, action: string): void {
  if (isMeetingLive(meeting)) return;
  throw new BusinessRuleError('LIVE_ASSEMBLY_CONFLICT', `Meeting ${meeting.id} is not live, so it cannot ${action}; start its live console first.`, {
    meetingId: meeting.id,
  });
}

/** A motion's ballot is open from launch until the motion is decided. */
export const isBallotOpen = (m: Pick<ProposedMotion, 'VoteResult' | 'BallotOpenedAt'>): boolean => m.VoteResult === 'Pending' && m.BallotOpenedAt != null;

/** Rejects MOTION_STATUS_CONFLICT unless the motion still awaits its vote. `action` completes "cannot ...". */
export function assertMotionPending(motion: Pick<ProposedMotion, 'id' | 'VoteResult'>, action: string): void {
  if (motion.VoteResult === 'Pending') return;
  throw new BusinessRuleError('MOTION_STATUS_CONFLICT', `Motion ${motion.id} is already ${motion.VoteResult}, so it cannot ${action}.`, {
    motionId: motion.id,
    voteResult: motion.VoteResult,
  });
}

/**
 * launchSecretSmartphoneBallot: the motion's ballot is not open yet and no other motion of the meeting has one open
 * (`meetingMotions` holds every motion of the meeting), else BALLOT_STATE_CONFLICT.
 */
export function assertBallotLaunchable(motion: Pick<ProposedMotion, 'id'>, meetingMotions: readonly Pick<ProposedMotion, 'id' | 'VoteResult' | 'BallotOpenedAt'>[]): void {
  const open = meetingMotions.find(isBallotOpen);
  if (!open) return;
  throw new BusinessRuleError(
    'BALLOT_STATE_CONFLICT',
    open.id === motion.id
      ? `The ballot on motion ${motion.id} is already open.`
      : `Motion ${open.id} still has its ballot open; decide it before opening the ballot on motion ${motion.id}.`,
    { motionId: motion.id, openMotionId: open.id },
  );
}

/** Rejects BALLOT_STATE_CONFLICT unless the motion's ballot is open. */
export function assertBallotOpen(motion: Pick<ProposedMotion, 'id' | 'VoteResult' | 'BallotOpenedAt'>): void {
  if (isBallotOpen(motion)) return;
  throw new BusinessRuleError('BALLOT_STATE_CONFLICT', `Motion ${motion.id} has no ballot open.`, { motionId: motion.id });
}

/** closeLiveAssemblyConsole: no motion of the meeting may still have its ballot open (BALLOT_STATE_CONFLICT). */
export function assertNoBallotOpen(meetingId: number, meetingMotions: readonly Pick<ProposedMotion, 'id' | 'VoteResult' | 'BallotOpenedAt'>[]): void {
  const open = meetingMotions.find(isBallotOpen);
  if (!open) return;
  throw new BusinessRuleError('BALLOT_STATE_CONFLICT', `Motion ${open.id} still has its ballot open; decide it before closing meeting ${meetingId}.`, {
    meetingId,
    motionId: open.id,
  });
}

// ---- agenda items ----------------------------------------------------------------------

/** advanceActiveAgendaItem's topic and allotment, trimmed and checked (INVALID_INPUT). */
export function cleanLiveAgendaItem(itemName: unknown, allottedMinutes: unknown): { name: string; minutes: number } {
  const name = assertText(itemName, 'Agenda item', LIVE_AGENDA_ITEM_NAME_MAX_LENGTH);
  if (typeof allottedMinutes !== 'number' || !Number.isInteger(allottedMinutes) || allottedMinutes < 1 || allottedMinutes > LIVE_AGENDA_ITEM_MAX_MINUTES) {
    throw invalid(`Allotted minutes must be a whole number from 1 to ${LIVE_AGENDA_ITEM_MAX_MINUTES}; received ${String(allottedMinutes)}.`, {
      allottedMinutes,
    });
  }
  return { name, minutes: allottedMinutes };
}

/** A 'YYYY-MM-DD HH:MM:SS' UTC stamp (as toTimestamp writes it) as epoch milliseconds. */
const stampMillis = (stamp: string): number => Date.parse(`${stamp.replace(' ', 'T')}Z`);

/** The center bar's item with the seconds left at `now`, or null when no item is active. */
export function liveAgendaItem(meeting: Pick<Meeting, 'ActiveAgendaItemName' | 'ActiveAgendaItemTimeRemaining' | 'ActiveAgendaItemStartedAt'>, now: Date) {
  const { ActiveAgendaItemName: name, ActiveAgendaItemTimeRemaining: minutes, ActiveAgendaItemStartedAt: startedAt } = meeting;
  if (!name || minutes == null || !startedAt) return null;
  const elapsed = Math.max(0, Math.floor((now.getTime() - stampMillis(startedAt)) / 1000));
  return { name, allottedMinutes: minutes, startedAt, secondsRemaining: Math.max(0, minutes * 60 - elapsed) };
}

// ---- secret ballots ----------------------------------------------------------------------

/** Rejects INVALID_INPUT unless `value` is one of BALLOT_SELECTIONS. */
export function assertBallotSelection(value: unknown): BallotSelection {
  if ((BALLOT_SELECTIONS as readonly unknown[]).includes(value)) return value as BallotSelection;
  throw invalid(`A ballot is Approve, Deny or Abstain; received ${JSON.stringify(value)}.`, { selection: value });
}

/**
 * What a driver hashes (SHA-256) into BallotVote.AnonymousBallotHash: the motion and the voter under the driver's
 * ballot secret. The secret never enters the database, so the hash cannot be recomputed from the tables to find who
 * voted; the same member on the same motion always hashes the same, so a second ballot collides.
 */
export const ballotHashInput = (secret: string, motionId: number, memberId: number): string => `kofc-ballot:${secret}:${motionId}:${memberId}`;

/** The motion's ballots counted, against the `eligible` members checked in. */
export function tallyBallots(motionId: number, votes: readonly Pick<BallotVote, 'VoteSelection'>[], eligible: number): BallotTally {
  const count = (s: BallotSelection) => votes.filter((v) => v.VoteSelection === s).length;
  return { motionId, approve: count('Approve'), deny: count('Deny'), abstain: count('Abstain'), total: votes.length, eligible };
}

/** Rejects INVALID_INPUT unless `value` is Passed, Failed or Tabled. */
export function assertFinalMotionResult(value: unknown): FinalMotionResult {
  if ((FINAL_MOTION_RESULTS as readonly unknown[]).includes(value)) return value as FinalMotionResult;
  throw invalid(`A motion is decided Passed, Failed or Tabled; received ${JSON.stringify(value)}.`, { resultStatus: value });
}

/**
 * When a smartphone ballot was held, the decision must agree with it: Passed needs more Approve than Deny ballots,
 * Failed no more (abstentions count for neither); Tabled is always allowed (VOTE_TALLY_CONFLICT).
 */
export function assertResultMatchesTally(result: FinalMotionResult, tally: BallotTally, ballotHeld: boolean): void {
  if (!ballotHeld || result === 'Tabled') return;
  const carried = tally.approve > tally.deny;
  if ((result === 'Passed') === carried) return;
  throw new BusinessRuleError(
    'VOTE_TALLY_CONFLICT',
    `The ballot on motion ${tally.motionId} stands ${tally.approve} Approve to ${tally.deny} Deny, so it cannot be recorded as ${result}.`,
    { motionId: tally.motionId, approve: tally.approve, deny: tally.deny, result },
  );
}

/**
 * A decided motion's effect on the charitable request it carries: Passed approves the gift for the full amount
 * requested (it joins the Financial Secretary's funding queue), Failed rejects it, Tabled leaves it awaiting a vote.
 */
export function charitableVoteOutcome(
  result: FinalMotionResult,
  request: Pick<CharitableRequest, 'AmountRequested'>,
): Pick<CharitableRequest, 'VoteStatus' | 'AmountApproved'> | null {
  if (result === 'Passed') return { VoteStatus: 'Approved', AmountApproved: request.AmountRequested };
  if (result === 'Failed') return { VoteStatus: 'Rejected', AmountApproved: 0 };
  return null;
}

export const proposedMotionNotFound = (motionId: number): BusinessRuleError =>
  new BusinessRuleError('RECORD_NOT_FOUND', `Proposed motion ${motionId} does not exist.`, { table: 'ProposedMotion', id: motionId });

// ---- the state ----------------------------------------------------------------------------

/**
 * LiveAssemblyState from the meeting's rows: its motions in id order, each with its ballots, the check-ins, and what
 * the reader has done (`viewerVotedMotionIds`, worked out by the driver from the reader's ballot hashes).
 */
export function buildLiveAssemblyState(input: {
  meeting: Meeting;
  motions: readonly ProposedMotion[];
  votes: readonly Pick<BallotVote, 'ProposedMotionID' | 'VoteSelection'>[];
  checkedInMemberIds: readonly number[];
  viewerId: number;
  viewerVotedMotionIds: ReadonlySet<number>;
  now: Date;
}): LiveAssemblyState {
  const { meeting, checkedInMemberIds } = input;
  const eligible = checkedInMemberIds.length;
  const motions: LiveMotionState[] = [...input.motions]
    .sort((a, b) => a.id - b.id)
    .map((motion) => ({
      motion: { ...motion },
      ballotOpen: isBallotOpen(motion),
      tally: tallyBallots(
        motion.id,
        input.votes.filter((v) => v.ProposedMotionID === motion.id),
        eligible,
      ),
      viewerHasVoted: input.viewerVotedMotionIds.has(motion.id),
    }));
  return {
    meeting: { ...meeting },
    isLive: isMeetingLive(meeting),
    rosterCount: meeting.LiveQuorumRosterCount ?? null,
    checkedInCount: eligible,
    checkedInMemberIds: [...checkedInMemberIds].sort((a, b) => a - b),
    activeItem: liveAgendaItem(meeting, input.now),
    viewerCheckedIn: checkedInMemberIds.includes(input.viewerId),
    motions,
  };
}

/** A member's second ballot on one motion. Says nothing about how they voted. */
export const ballotAlreadyCast = (motionId: number): BusinessRuleError =>
  new BusinessRuleError('BALLOT_ALREADY_CAST', `You have already cast your ballot on motion ${motionId}; each member votes once.`, { motionId });

/** A fresh ballot secret: 32 random bytes as hex. Drivers keep it outside the database. */
export const formatBallotSecret = (bytes: Uint8Array): string => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

/**
 * The live console's quick-pick topics (Sprint 5Z-10): one per non-blank line of the meeting's Agenda, with list
 * numbering or bullets ('1.', '2)', '-', '•') removed, each cut to LIVE_AGENDA_ITEM_NAME_MAX_LENGTH.
 */
export function agendaTopics(agenda: string | null | undefined): string[] {
  return (agenda ?? '')
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:\d+[.)]|[-•*])\s*/, '').trim())
    .filter((line) => line !== '')
    .map((line) => line.slice(0, LIVE_AGENDA_ITEM_NAME_MAX_LENGTH));
}

/** mm:ss for the console's countdown; negative values read 00:00. */
export function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
