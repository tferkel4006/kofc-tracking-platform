// =========================================================================
// THE COUNCIL PRAYER INTENTIONS LIST (Sprint 6L Extension 3)
// Pure helpers behind prayers.getBoard, addIntention, pray and closeIntention: the intentions a council's members ask
// their brothers to pray for, each with a Praying Hands solidarity counter. Shown in the web Faith Center (/faith-center)
// and on the phone's Home screen. Like the rest of the Faith Center it is a Knights of Columbus extension; the drivers
// refuse a white-label council (assertFraternalExtension). Drivers load rows, call these, then only store.
//
// The counter counts one tap per member per intention per day (the member's local date), so it reads as "times prayed
// for", not "taps".
// =========================================================================
import type { PrayerIntentionBoard, PrayerIntentionDetail, PrayerTally } from './contract';
import { assertDiaryTextAllowed, assertMayReadCouncilHistory } from './history';
import { assertText, BusinessRuleError, describeActor, hasAdminRights, hasSuperAdminRights, SecurityPrivilegeError, type MemberWriteActor } from './rules';
import type { CouncilPrayerIntention, CouncilPrayerIntentionPrayer, Member } from './types';

/** Longest intention (CouncilPrayerIntention.intention_text, VARCHAR(500)). */
export const PRAYER_INTENTION_MAX_LENGTH = 500;

/** The Praying Hands button's text, the same on the web and the phone (bracketed like HOLY_DAY_BADGE). */
export const PRAYING_HANDS_LABEL = '[ 🙏 Praying Hands ]';

// ---- access ---------------------------------------------------------------------------------------------------

/**
 * Reading the list, posting and praying: any Active member of the council, or an Active Super Admin for any council
 * (the same audience as the council history). `action` completes "cannot ...".
 */
export const assertMayJoinCouncilPrayers = (actor: MemberWriteActor, councilId: number, action: string): void =>
  assertMayReadCouncilHistory(actor, councilId, action);

function closeDenial(actor: MemberWriteActor, intention: Pick<CouncilPrayerIntention, 'id' | 'council_id' | 'author_member_id'>): SecurityPrivilegeError | null {
  if (hasSuperAdminRights(actor)) return null;
  if (actor.councilId !== intention.council_id || !actor.active) {
    return new SecurityPrivilegeError(
      'COUNCIL_ACCESS_DENIED',
      `Member ${actor.memberId} is ${describeActor(actor)} of council ${actor.councilId} and cannot close prayer intention ${intention.id} of council ${intention.council_id}.`,
      { actorId: actor.memberId, actorCouncilId: actor.councilId, councilId: intention.council_id },
    );
  }
  if (actor.memberId === intention.author_member_id || actor.officer || hasAdminRights(actor)) return null;
  return new SecurityPrivilegeError(
    'PRAYER_INTENTION_CLOSER_REQUIRED',
    `Only the intention's author, an officer, an Admin or a Super Admin can close prayer intention ${intention.id}; member ${actor.memberId} is none of these.`,
    { actorId: actor.memberId, intentionId: intention.id },
  );
}

/** prayers.closeIntention: the author, an Active officer or Admin of the intention's council, or an Active Super Admin. */
export function assertMayClosePrayerIntention(actor: MemberWriteActor, intention: Pick<CouncilPrayerIntention, 'id' | 'council_id' | 'author_member_id'>): void {
  const denial = closeDenial(actor, intention);
  if (denial) throw denial;
}

/** assertMayClosePrayerIntention as a yes/no. */
export const mayClosePrayerIntention = (actor: MemberWriteActor, intention: Pick<CouncilPrayerIntention, 'id' | 'council_id' | 'author_member_id'>): boolean =>
  closeDenial(actor, intention) === null;

// ---- validation -----------------------------------------------------------------------------------------------

/**
 * The intention's text, trimmed and checked by the diary content guard. Rejects INVALID_INPUT or DIARY_CONTENT_BLOCKED.
 * `maxLength` is the platform's character limit (Sprint 7C, PlatformSettings.prayer_intention_max_length), never more
 * than the column's PRAYER_INTENTION_MAX_LENGTH.
 */
export const cleanPrayerIntentionText = (text: unknown, maxLength: number = PRAYER_INTENTION_MAX_LENGTH): string =>
  assertDiaryTextAllowed(assertText(text, 'Prayer intention', Math.min(maxLength, PRAYER_INTENTION_MAX_LENGTH)));

/** RECORD_NOT_FOUND for a missing intention. */
export function requirePrayerIntention<T extends Pick<CouncilPrayerIntention, 'id'>>(intention: T | null | undefined, intentionId: number): T {
  if (!intention) throw new BusinessRuleError('RECORD_NOT_FOUND', `No prayer intention with id ${intentionId}.`, { intentionId });
  return intention;
}

/** PRAYER_INTENTION_CLOSED once the intention has left the list. */
export function assertPrayerIntentionOpen(intention: Pick<CouncilPrayerIntention, 'id' | 'closed_at'>): void {
  if (intention.closed_at) {
    throw new BusinessRuleError('PRAYER_INTENTION_CLOSED', `Prayer intention ${intention.id} was closed on ${intention.closed_at}.`, { intentionId: intention.id });
  }
}

// ---- the list -------------------------------------------------------------------------------------------------

/** The counter for one intention: its taps, and whether `memberId` already tapped on `today`. */
export function prayerTally(
  intentionId: number,
  prayers: readonly Pick<CouncilPrayerIntentionPrayer, 'intention_id' | 'member_id' | 'prayed_on'>[],
  memberId: number,
  today: string,
): PrayerTally {
  const mine = prayers.filter((p) => p.intention_id === intentionId);
  return { intentionId, prayerCount: mine.length, prayedByMeToday: mine.some((p) => p.member_id === memberId && p.prayed_on === today) };
}

/** prayers.getBoard from the council's intentions, their taps and the authors. Closed intentions are left out. */
export function buildPrayerIntentionBoard(input: {
  councilId: number;
  intentions: readonly CouncilPrayerIntention[];
  prayers: readonly Pick<CouncilPrayerIntentionPrayer, 'intention_id' | 'member_id' | 'prayed_on'>[];
  members: readonly Pick<Member, 'id' | 'MemberFirstName' | 'MemberLastName'>[];
  actor: MemberWriteActor;
  today: string;
}): PrayerIntentionBoard {
  const names = new Map(input.members.map((m) => [m.id, m]));
  const intentions: PrayerIntentionDetail[] = input.intentions
    .filter((i) => i.council_id === input.councilId && !i.closed_at)
    .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id)
    .map((intention) => {
      const author = names.get(intention.author_member_id);
      const tally = prayerTally(intention.id, input.prayers, input.actor.memberId, input.today);
      return {
        intention,
        authorFirstName: author?.MemberFirstName ?? 'A',
        authorLastName: author?.MemberLastName ?? 'brother Knight',
        prayerCount: tally.prayerCount,
        prayedByMeToday: tally.prayedByMeToday,
        mayClose: mayClosePrayerIntention(input.actor, intention),
      };
    });
  return { councilId: input.councilId, intentions, today: input.today };
}

/** "Prayed for 3 times", or the invitation when no one has yet. */
export const describePrayerCount = (count: number): string =>
  count === 0 ? 'Be the first to pray for this intention.' : `Prayed for ${count} ${count === 1 ? 'time' : 'times'}`;
