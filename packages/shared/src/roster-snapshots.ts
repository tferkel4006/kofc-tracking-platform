// =========================================================================
// ROSTER SNAPSHOT GUARDS (Sprint 6P)
// Pure helpers behind the locked leadership snapshots (CouncilLeadershipSnapshot) and the transfer guard in
// members.update. Drivers load rows, call these, then only store.
//
// A snapshot is one member's officer record for one council and fraternal year: the seats held that year, joined. The
// compound key (user_id, council_id, fraternal_year) allows one, and a snapshot that already exists is never written
// again, so a past record stays as it was locked. CouncilLeadershipHistory keeps its own rows: one member may hold two
// seats in a year, so the per-seat history cannot carry that key itself.
// =========================================================================
import { officeKind } from './elections';
import { toIsoDate } from './rules';
import type { CouncilLeadershipHistory, CouncilLeadershipSnapshot, LeadershipSnapshotReason, Role } from './types';

/** Longest CouncilLeadershipSnapshot.roles_held (VARCHAR(1000)). */
export const ROLES_HELD_MAX_LENGTH = 1000;

const ROLES_SEPARATOR = ', ';

/** The key of a snapshot: one per member, council and fraternal year. */
export const leadershipSnapshotKey = (s: Pick<CouncilLeadershipSnapshot, 'user_id' | 'council_id' | 'fraternal_year'>): string =>
  `${s.user_id}|${s.council_id}|${s.fraternal_year}`;

/** The role names of `history` rows, without repeats, in role id order and joined; cut to ROLES_HELD_MAX_LENGTH. */
export function describeRolesHeld(history: readonly Pick<CouncilLeadershipHistory, 'RoleID'>[], roles: readonly Role[]): string {
  const ids = [...new Set(history.map((h) => h.RoleID))].sort((a, b) => a - b);
  const joined = ids.map((id) => roles.find((r) => r.id === id)?.Role ?? `Role ${id}`).join(ROLES_SEPARATOR);
  return joined.length > ROLES_HELD_MAX_LENGTH ? joined.slice(0, ROLES_HELD_MAX_LENGTH) : joined;
}

/** The seat names of a stored roles_held value. */
export const parseRolesHeld = (value: string): string[] =>
  value
    .split(ROLES_SEPARATOR)
    .map((r) => r.trim())
    .filter(Boolean);

/**
 * The snapshots to insert for a council: one per member and fraternal year found in `history` (the council's rows),
 * limited to `memberId` and to `fraternalYears` when given. Keys already in `existing` are skipped, so a locked record
 * is never rewritten. Ordered by year, then member id.
 */
export function planLeadershipSnapshots(input: {
  councilId: number;
  history: readonly CouncilLeadershipHistory[];
  roles: readonly Role[];
  existing: readonly Pick<CouncilLeadershipSnapshot, 'user_id' | 'council_id' | 'fraternal_year'>[];
  reason: LeadershipSnapshotReason;
  lockedAt: string;
  memberId?: number;
  fraternalYears?: readonly string[];
}): CouncilLeadershipSnapshot[] {
  const locked = new Set(input.existing.map(leadershipSnapshotKey));
  const groups = new Map<string, CouncilLeadershipHistory[]>();
  for (const h of input.history) {
    if (h.CouncilID !== input.councilId) continue;
    if (input.memberId !== undefined && h.MemberID !== input.memberId) continue;
    if (input.fraternalYears && !input.fraternalYears.includes(h.FraternalYear)) continue;
    const key = leadershipSnapshotKey({ user_id: h.MemberID, council_id: input.councilId, fraternal_year: h.FraternalYear });
    groups.set(key, [...(groups.get(key) ?? []), h]);
  }
  const out: CouncilLeadershipSnapshot[] = [];
  for (const [key, rows] of groups) {
    if (locked.has(key)) continue;
    out.push({
      user_id: rows[0].MemberID,
      council_id: input.councilId,
      fraternal_year: rows[0].FraternalYear,
      roles_held: describeRolesHeld(rows, input.roles),
      lock_reason: input.reason,
      locked_at: input.lockedAt,
    });
  }
  return out.sort((a, b) => a.fraternal_year.localeCompare(b.fraternal_year) || a.user_id - b.user_id);
}

/**
 * The history rows elections.concludeFraternalYear locks: every term the conclusion closed today ('TermConcluded'), and
 * every row of a year before the new term. A year concluded early (before July) labels the outgoing terms with the new
 * term's year, so the closed rows are matched by their exit, not their year label.
 */
export const concludedTermRows = (history: readonly CouncilLeadershipHistory[], newTermYear: string, today: string): CouncilLeadershipHistory[] =>
  history.filter((h) => h.FraternalYear < newTermYear || (h.ExitReason === 'TermConcluded' && h.EndDate === today));

/** What members.update does when a member's CouncilID changes. */
export interface TransferGuardPlan {
  /** Snapshots to insert: every year the member held a seat in the old council, not yet locked. */
  snapshots: CouncilLeadershipSnapshot[];
  /** History rows (ids) to close: the member's open terms in the old council. */
  closeTermIds: number[];
  /** The date those terms end (today) and the reason, 'Transferred'. */
  endDate: string;
  /** Role ids the member gives up: every office seat (officeKind) they hold, whose council they are leaving. */
  removeRoleIds: number[];
}

/**
 * The transfer guard: when member `memberId` moves out of `oldCouncilId`, their officer record there is locked
 * (snapshots, lock_reason 'Transfer'), their open terms close 'Transferred', and their office seats are vacated so the
 * seats do not follow them to the new council. Rows stay with the old council.
 */
export function planTransferGuard(input: {
  memberId: number;
  oldCouncilId: number;
  history: readonly CouncilLeadershipHistory[];
  roles: readonly Role[];
  heldRoleIds: readonly number[];
  existing: readonly Pick<CouncilLeadershipSnapshot, 'user_id' | 'council_id' | 'fraternal_year'>[];
  now: Date;
  lockedAt: string;
}): TransferGuardPlan {
  const own = input.history.filter((h) => h.CouncilID === input.oldCouncilId && h.MemberID === input.memberId);
  return {
    snapshots: planLeadershipSnapshots({
      councilId: input.oldCouncilId,
      history: own,
      roles: input.roles,
      existing: input.existing,
      reason: 'Transfer',
      lockedAt: input.lockedAt,
    }),
    closeTermIds: own.filter((h) => h.EndDate == null).map((h) => h.id),
    endDate: toIsoDate(input.now),
    removeRoleIds: input.heldRoleIds.filter((id) => {
      const name = input.roles.find((r) => r.id === id)?.Role;
      return name !== undefined && officeKind(name) !== null;
    }),
  };
}

/** The council's snapshots for display: newest fraternal year first, then member id. */
export const sortLeadershipSnapshots = (rows: readonly CouncilLeadershipSnapshot[]): CouncilLeadershipSnapshot[] =>
  [...rows].sort((a, b) => b.fraternal_year.localeCompare(a.fraternal_year) || a.user_id - b.user_id);
