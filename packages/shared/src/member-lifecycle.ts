// =========================================================================
// MEMBER LIFECYCLE, DEVOTIONALS, CANONIZATION RANKS AND THE MEMBER CENTER (Sprint 7A, schemas 59-60)
// Pure helpers behind the member lifecycle hooks (members.create, members.update, supreme.syncSupremeRoster and
// members.sweepInactive), the phone's devotional tracker (devotionals.*), the canonization shield and the dashboard's
// monthly engagement card (reports.councilEngagement). Drivers load rows, call these, then only store.
//
// Lifecycle hooks, run inside the same transaction as the member write:
//   - A new member (added by hand or from Supreme's roster) joins every council-wide distribution list of the council.
//   - A member marked Deceased or Former leaves every distribution list, private or council-wide.
//   - A transfer to another council is one write: the member is Active in the new council, leaves the old council's
//     lists and joins the new council's council-wide lists. (The Sprint 6P transfer guard still closes their officer
//     terms in the old council 'Transferred' and locks their snapshots there.)
// The inactivity sweep marks Active members Inactive after more than INACTIVITY_SWEEP_DAYS without logged service.
// =========================================================================
import type { NewMember } from './contract';
import { daysSinceJoined } from './onboarding';
import { BusinessRuleError, describeActor, hasAdminRights, hasSuperAdminRights, SecurityPrivilegeError, type MemberWriteActor } from './rules';
import type { Council, Member, MemberCouncilAffiliationLog, MemberDevotionals, MemberStatus, MemberType } from './types';

const invalid = (message: string, details: Record<string, unknown> = {}) => new BusinessRuleError('INVALID_INPUT', message, details);

/** Statuses that take a member off every distribution list. */
export const LIFECYCLE_EXCISED_STATUSES = ['Deceased', 'Former'] as const;
/** The status the inactivity sweep sets. */
export const INACTIVE_STATUS = 'Inactive';
/**
 * Days without logged service after which the sweep marks an Active member Inactive (more than this many): the default of
 * Council.inactivity_threshold_days, which each council sets on Council Wide Settings since Sprint 7C.
 */
export const INACTIVITY_SWEEP_DAYS = 365;

// ---- lifecycle hooks ------------------------------------------------------------------------------------------

/** The distribution list columns the hooks read. IsCouncilWide missing or NULL reads as council-wide (the column default). */
export interface LifecycleList {
  id: number;
  CouncilID?: number | null;
  IsCouncilWide?: number | null;
}

/** What a member write must also do, beyond storing the member. */
export interface MemberLifecyclePlan {
  /** The status to store: Active on a transfer, otherwise the one asked for. */
  statusId: number;
  transferred: boolean;
  /** The member is now Deceased or Former. */
  excised: boolean;
  /** Lists to take the member off. */
  leaveListIds: number[];
  /** Council-wide lists to add the member to. */
  joinListIds: number[];
}

const statusNameOf = (statuses: readonly MemberStatus[], id: number): string | undefined => statuses.find((s) => s.id === id)?.Status;

/** The id of the named MemberStatus; throws when the lookup lacks it (a broken seed, not a user error). */
export function memberStatusId(statuses: readonly MemberStatus[], name: string): number {
  const id = statuses.find((s) => s.Status === name)?.id;
  if (id === undefined) throw new Error(`MemberStatus has no '${name}' row.`);
  return id;
}

/**
 * The lifecycle hooks for one member write. `before` is the stored member (null for a new one), `after` the cleaned
 * values, `memberListIds` the lists the member is on now.
 */
export function planMemberLifecycle(input: {
  before: Pick<Member, 'CouncilID' | 'StatusID'> | null;
  after: Pick<NewMember, 'CouncilID' | 'StatusID'>;
  statuses: readonly MemberStatus[];
  lists: readonly LifecycleList[];
  memberListIds: readonly number[];
}): MemberLifecyclePlan {
  const { before, after, statuses, lists, memberListIds } = input;
  const transferred = before !== null && before.CouncilID !== after.CouncilID;
  const statusId = transferred ? memberStatusId(statuses, 'Active') : after.StatusID;
  const statusName = statusNameOf(statuses, statusId);
  const excised = (LIFECYCLE_EXCISED_STATUSES as readonly string[]).includes(statusName ?? '');
  if (excised) return { statusId, transferred, excised, leaveListIds: [...memberListIds].sort((a, b) => a - b), joinListIds: [] };
  const councilOf = new Map(lists.map((l) => [l.id, l.CouncilID ?? null]));
  const leaveListIds = transferred ? memberListIds.filter((id) => councilOf.get(id) !== after.CouncilID).sort((a, b) => a - b) : [];
  const onList = new Set(memberListIds);
  const joinListIds =
    before === null || transferred
      ? lists
          .filter((l) => l.CouncilID === after.CouncilID && l.IsCouncilWide !== 0 && !onList.has(l.id))
          .map((l) => l.id)
          .sort((a, b) => a - b)
      : [];
  return { statusId, transferred, excised, leaveListIds, joinListIds };
}

// ---- service logs and the inactivity sweep --------------------------------------------------------------------

/** One logged stretch of service: EventTime (dated by its shift, with the event) or ActivityTime (no event). */
export interface ServiceLogRow {
  MemberID: number;
  Hours: number;
  /** YYYY-MM-DD: the shift's ShiftDate or the ActivityDate. */
  date: string;
  eventId: number | null;
}

/** Each member's most recent logged service date. */
export function lastServiceDates(logs: readonly ServiceLogRow[]): Map<number, string> {
  const last = new Map<number, string>();
  for (const log of logs) {
    const seen = last.get(log.MemberID);
    if (seen === undefined || log.date > seen) last.set(log.MemberID, log.date);
  }
  return last;
}

/**
 * The members the inactivity sweep marks Inactive: Active, of member type 'Member' (Admins and Super Admins are never
 * swept, so a quiet administrator cannot lock themselves out), and more than `thresholdDays` days past their last
 * logged service - or, with none logged, past the day they joined the council. A member with neither is left as they
 * are. Ascending id order. Sprint 7C: `thresholdDays` is the council's inactivity_threshold_days (council-settings.ts);
 * left out, INACTIVITY_SWEEP_DAYS.
 */
export function planInactivitySweep(input: {
  members: readonly Pick<Member, 'id' | 'StatusID' | 'MemberTypeID' | 'DateJoinedCouncil'>[];
  statuses: readonly MemberStatus[];
  memberTypes: readonly MemberType[];
  logs: readonly ServiceLogRow[];
  today: string;
  thresholdDays?: number;
}): number[] {
  const thresholdDays = input.thresholdDays ?? INACTIVITY_SWEEP_DAYS;
  const active = memberStatusId(input.statuses, 'Active');
  const plainType = input.memberTypes.find((t) => t.Type === 'Member')?.id;
  const last = lastServiceDates(input.logs);
  return input.members
    .filter((m) => m.StatusID === active && m.MemberTypeID === plainType)
    .filter((m) => {
      const days = daysSinceJoined(last.get(m.id) ?? m.DateJoinedCouncil ?? null, input.today);
      return days !== null && days > thresholdDays;
    })
    .map((m) => m.id)
    .sort((a, b) => a - b);
}

/** members.sweepInactive: an Active Admin of the council or an Active Super Admin. */
export function assertMaySweepInactiveMembers(actor: MemberWriteActor, councilId: number): void {
  if (hasSuperAdminRights(actor)) return;
  if (!hasAdminRights(actor)) {
    throw new SecurityPrivilegeError(
      'ADMIN_REQUIRED',
      `Only an active Admin of the council or a Super Admin can check for inactive members; member ${actor.memberId} is ${describeActor(actor)}.`,
      { actorId: actor.memberId, councilId },
    );
  }
  if (actor.councilId !== councilId) {
    throw new SecurityPrivilegeError(
      'COUNCIL_ACCESS_DENIED',
      `Admin ${actor.memberId} of council ${actor.councilId} cannot check for inactive members in council ${councilId}.`,
      { actorId: actor.memberId, actorCouncilId: actor.councilId, councilId },
    );
  }
}

// ---- devotional tracker ---------------------------------------------------------------------------------------

/** The most of each devotion one entry may add (a guard against a typo such as 500 rosaries in a day). */
export const DEVOTIONAL_ENTRY_MAX = 100;

/** One devotional entry: how many of each to add to the member's tally. Omitted counts add 0. */
export interface DevotionalEntry {
  rosaries?: number;
  adorations?: number;
  confessions?: number;
}

const DEVOTION_LABELS: Record<keyof DevotionalEntry, string> = {
  rosaries: 'Rosaries said',
  adorations: 'Hours of adoration',
  confessions: 'Confessions',
};

/** The entry's three counts: whole numbers from 0 to DEVOTIONAL_ENTRY_MAX, at least one above 0 (INVALID_INPUT). */
export function cleanDevotionalEntry(entry: unknown): Required<DevotionalEntry> {
  if (entry === null || typeof entry !== 'object') throw invalid('A devotional entry needs at least one count.');
  const raw = entry as Record<string, unknown>;
  for (const key of Object.keys(raw)) {
    if (!(key in DEVOTION_LABELS)) throw invalid(`A devotional entry has no field "${key}".`, { field: key });
  }
  const count = (key: keyof DevotionalEntry): number => {
    const v = raw[key];
    if (v === undefined || v === null) return 0;
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > DEVOTIONAL_ENTRY_MAX) {
      throw invalid(`${DEVOTION_LABELS[key]} must be a whole number from 0 to ${DEVOTIONAL_ENTRY_MAX}; received ${JSON.stringify(v)}.`, { field: key });
    }
    return v;
  };
  const clean = { rosaries: count('rosaries'), adorations: count('adorations'), confessions: count('confessions') };
  if (clean.rosaries + clean.adorations + clean.confessions === 0) throw invalid('Enter at least one rosary, hour of adoration or confession.');
  return clean;
}

/** An empty tally for a member who has logged nothing yet. */
export const emptyDevotionals = (memberId: number): MemberDevotionals => ({ user_id: memberId, rosaries_said: 0, adorations_count: 0, confessions_count: 0 });

/** The tally after adding a cleaned entry. */
export const addDevotionalEntry = (current: MemberDevotionals, entry: Required<DevotionalEntry>): MemberDevotionals => ({
  user_id: current.user_id,
  rosaries_said: current.rosaries_said + entry.rosaries,
  adorations_count: current.adorations_count + entry.adorations,
  confessions_count: current.confessions_count + entry.confessions,
});

// ---- canonization shield ---------------------------------------------------------------------------------------

/** The shield's levels, lowest first. */
export const CANONIZATION_LEVELS = ['Servant of God', 'Venerable', 'Blessed', 'Saint'] as const;
export type CanonizationLevel = (typeof CANONIZATION_LEVELS)[number];

/** Thirds of the council's thresholds each level needs, by CANONIZATION_LEVELS index (Saint is the whole bar). */
const LEVEL_THIRDS = [0, 1, 2, 3] as const;

export const DEFAULT_RANK_THRESHOLD_HOURS = 100;
export const DEFAULT_RANK_THRESHOLD_EVENTS = 10;
export const RANK_THRESHOLD_MAX_HOURS = 10_000;
export const RANK_THRESHOLD_MAX_EVENTS = 1_000;

/** The volunteer hours and distinct events that make a 'Saint' in a council. */
export interface RankThresholds {
  hours: number;
  events: number;
}

/** The council's stored thresholds, with the column defaults for missing values. */
export const councilRankThresholds = (council: Pick<Council, 'rank_threshold_hours' | 'rank_threshold_events'> | null | undefined): RankThresholds => ({
  hours: council?.rank_threshold_hours ?? DEFAULT_RANK_THRESHOLD_HOURS,
  events: council?.rank_threshold_events ?? DEFAULT_RANK_THRESHOLD_EVENTS,
});

/** councils.setRankThresholds' input: whole numbers from 1 to the maximums (INVALID_INPUT). */
export function cleanRankThresholds(input: unknown): RankThresholds {
  if (input === null || typeof input !== 'object') throw invalid('Enter the hours and events thresholds.');
  const raw = input as Record<string, unknown>;
  const whole = (key: 'hours' | 'events', label: string, max: number): number => {
    const v = raw[key];
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 1 || v > max) {
      throw invalid(`${label} must be a whole number from 1 to ${max.toLocaleString('en-US')}; received ${JSON.stringify(v)}.`, { field: key });
    }
    return v;
  };
  return { hours: whole('hours', 'The hours threshold', RANK_THRESHOLD_MAX_HOURS), events: whole('events', 'The events threshold', RANK_THRESHOLD_MAX_EVENTS) };
}

/** councils.setRankThresholds: an Active Admin of the council or an Active Super Admin. */
export function assertMaySetRankThresholds(actor: MemberWriteActor, councilId: number): void {
  if (hasSuperAdminRights(actor)) return;
  if (!hasAdminRights(actor)) {
    throw new SecurityPrivilegeError(
      'ADMIN_REQUIRED',
      `Only an active Admin of the council or a Super Admin can set the canonization thresholds; member ${actor.memberId} is ${describeActor(actor)}.`,
      { actorId: actor.memberId, councilId },
    );
  }
  if (actor.councilId !== councilId) {
    throw new SecurityPrivilegeError(
      'COUNCIL_ACCESS_DENIED',
      `Admin ${actor.memberId} of council ${actor.councilId} cannot set the canonization thresholds of council ${councilId}.`,
      { actorId: actor.memberId, actorCouncilId: actor.councilId, councilId },
    );
  }
}

/** A member's logged service: total hours (2 decimals) and the distinct events they logged a shift at. */
export interface ServiceMetrics {
  hours: number;
  events: number;
}

export function memberServiceMetrics(memberId: number, logs: readonly ServiceLogRow[]): ServiceMetrics {
  let hours = 0;
  const events = new Set<number>();
  for (const log of logs) {
    if (log.MemberID !== memberId) continue;
    hours += log.Hours;
    if (log.eventId !== null) events.add(log.eventId);
  }
  return { hours: Math.round(hours * 100) / 100, events: events.size };
}

/** Where a member stands on the shield. */
export interface CanonizationRank {
  level: CanonizationLevel;
  /** Index into CANONIZATION_LEVELS (0 = Servant of God, 3 = Saint). */
  levelIndex: number;
  metrics: ServiceMetrics;
  thresholds: RankThresholds;
  /** Share of the way to Saint, 0 to 1: the lesser of the hours and events shares. */
  progress: number;
  /** The next level and what it still needs (hours rounded up to a quarter hour); null for a Saint. */
  next: { level: CanonizationLevel; hoursNeeded: number; eventsNeeded: number } | null;
}

/**
 * The member's level: the highest whose share of BOTH council thresholds they have met - a third for Venerable, two
 * thirds for Blessed, the whole bar for Saint. Everyone starts as a Servant of God.
 */
export function canonizationRank(metrics: ServiceMetrics, thresholds: RankThresholds): CanonizationRank {
  // Compared in thirds (hours * 3 >= k * threshold) so 1/3 of 100 hours is not rounded.
  const meets = (k: number) => metrics.hours * 3 >= k * thresholds.hours && metrics.events * 3 >= k * thresholds.events;
  let levelIndex = 0;
  for (const k of LEVEL_THIRDS) if (meets(k)) levelIndex = k;
  const nextK = levelIndex + 1;
  const next =
    nextK < CANONIZATION_LEVELS.length
      ? {
          level: CANONIZATION_LEVELS[nextK]!,
          hoursNeeded: Math.max(0, Math.ceil(((nextK * thresholds.hours) / 3 - metrics.hours) * 4 - 1e-9) / 4),
          eventsNeeded: Math.max(0, Math.ceil((nextK * thresholds.events) / 3 - metrics.events - 1e-9)),
        }
      : null;
  const progress = Math.min(1, metrics.hours / thresholds.hours, metrics.events / thresholds.events);
  return { level: CANONIZATION_LEVELS[levelIndex]!, levelIndex, metrics, thresholds, progress: Math.round(progress * 1000) / 1000, next };
}

/** devotionals.getProgress and record: the member's own tally and shield. */
export interface DevotionalProgress {
  memberId: number;
  tally: MemberDevotionals;
  rank: CanonizationRank;
}

// ---- monthly engagement card and leaderboard -------------------------------------------------------------------

/** Volunteers ranked on the dashboard's leaderboard. */
export const LEADERBOARD_SIZE = 5;

export interface VolunteerStanding {
  memberId: number;
  firstName: string;
  lastName: string;
  hours: number;
}

export interface LeaderboardEntry extends VolunteerStanding {
  /** 1-based; members with equal hours share a rank (1, 2, 2, 4). */
  rank: number;
}

/** reports.councilEngagement: the month's volunteers and the council's all-time Top 5 Volunteers Leaderboard. */
export interface CouncilEngagement {
  councilId: number;
  year: number;
  month: number;
  /** Everyone who logged service at the council's events or activities in the month, most hours first. */
  volunteers: VolunteerStanding[];
  /** The council's Active members with the most hours logged at its events and activities, ever. */
  leaderboard: LeaderboardEntry[];
}

const byHoursThenName = (a: VolunteerStanding, b: VolunteerStanding) =>
  b.hours - a.hours || a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName) || a.memberId - b.memberId;

function standings(logs: readonly ServiceLogRow[], members: ReadonlyMap<number, Pick<Member, 'MemberFirstName' | 'MemberLastName'>>): VolunteerStanding[] {
  const hours = new Map<number, number>();
  for (const log of logs) hours.set(log.MemberID, (hours.get(log.MemberID) ?? 0) + log.Hours);
  return [...hours]
    .filter(([, h]) => h > 0)
    .map(([memberId, h]) => ({
      memberId,
      firstName: members.get(memberId)?.MemberFirstName ?? '',
      lastName: members.get(memberId)?.MemberLastName ?? `Member ${memberId}`,
      hours: Math.round(h * 100) / 100,
    }))
    .sort(byHoursThenName);
}

/**
 * Builds the card from the council's service logs (EventTime at its linked events, ActivityTime on its activities).
 * The month's list counts everyone, as reports.monthlySummary's unique Knights does; the leaderboard counts only the
 * council's own Active members.
 */
export function buildCouncilEngagement(input: {
  councilId: number;
  year: number;
  month: number;
  fromDate: string;
  toDate: string;
  logs: readonly ServiceLogRow[];
  members: readonly Pick<Member, 'id' | 'CouncilID' | 'StatusID' | 'MemberFirstName' | 'MemberLastName'>[];
  activeStatusId: number;
}): CouncilEngagement {
  const byId = new Map(input.members.map((m) => [m.id, m]));
  const volunteers = standings(
    input.logs.filter((l) => l.date >= input.fromDate && l.date <= input.toDate),
    byId,
  );
  const ranked = standings(
    input.logs.filter((l) => {
      const m = byId.get(l.MemberID);
      return m !== undefined && m.CouncilID === input.councilId && m.StatusID === input.activeStatusId;
    }),
    byId,
  ).slice(0, LEADERBOARD_SIZE);
  const leaderboard = ranked.map((s, i) => ({ ...s, rank: i > 0 && ranked[i - 1]!.hours === s.hours ? 0 : i + 1 }));
  for (let i = 1; i < leaderboard.length; i++) if (leaderboard[i]!.rank === 0) leaderboard[i]!.rank = leaderboard[i - 1]!.rank;
  return { councilId: input.councilId, year: input.year, month: input.month, volunteers, leaderboard };
}

// ---- multi-council affiliation log (Sprint 7A Extension, schema 60) ---------------------------------------------

/** A MemberCouncilAffiliationLog row to insert. */
export type NewAffiliationRow = Omit<MemberCouncilAffiliationLog, 'id'>;

/** What a member write does to the member's affiliation log. */
export interface AffiliationLogPlan {
  inserts: NewAffiliationRow[];
  updates: { id: number; membership_status: string; date_exited: string | null }[];
}

/** The status a membership closed by transfer keeps. */
export const TRANSFERRED_OUT_STATUS = 'Former';

const joinStamp = (date: string | null | undefined, fallback: string): string => (date ? `${date.slice(0, 10)} 00:00:00` : fallback);

/**
 * The log rows a member write adds or changes (the table's header in Schema.sql gives the rules). `before` is the stored
 * member (null for a new one); `after` is what will be stored, with the status planMemberLifecycle chose; `rows` is the
 * member's log so far; `now` is 'YYYY-MM-DD HH:MM:SS'.
 */
export function planAffiliationLog(input: {
  memberId: number;
  before: Pick<Member, 'CouncilID' | 'StatusID' | 'DateJoinedCouncil'> | null;
  after: Pick<NewMember, 'CouncilID' | 'StatusID' | 'DateJoinedCouncil'>;
  statuses: readonly MemberStatus[];
  rows: readonly Pick<MemberCouncilAffiliationLog, 'id' | 'council_id' | 'date_exited'>[];
  now: string;
}): AffiliationLogPlan {
  const { memberId, before, after, statuses, rows, now } = input;
  const status = statusNameOf(statuses, after.StatusID) ?? 'Active';
  const excised = (LIFECYCLE_EXCISED_STATUSES as readonly string[]).includes(status);
  const openIn = (councilId: number) => rows.filter((r) => r.council_id === councilId && r.date_exited == null);
  const plan: AffiliationLogPlan = { inserts: [], updates: [] };
  const open = (councilId: number, joined: string) =>
    plan.inserts.push({ user_id: memberId, council_id: councilId, membership_status: status, date_joined: joined, date_exited: excised ? now : null });

  if (before === null) {
    open(after.CouncilID, joinStamp(after.DateJoinedCouncil, now));
  } else if (before.CouncilID !== after.CouncilID) {
    const left = openIn(before.CouncilID);
    for (const r of left) plan.updates.push({ id: r.id, membership_status: TRANSFERRED_OUT_STATUS, date_exited: now });
    if (left.length === 0 && !rows.some((r) => r.council_id === before.CouncilID)) {
      plan.inserts.push({
        user_id: memberId,
        council_id: before.CouncilID,
        membership_status: TRANSFERRED_OUT_STATUS,
        date_joined: joinStamp(before.DateJoinedCouncil, now),
        date_exited: now,
      });
    }
    open(after.CouncilID, now);
  } else if (before.StatusID !== after.StatusID) {
    const here = openIn(after.CouncilID);
    if (here.length > 0) {
      for (const r of here) plan.updates.push({ id: r.id, membership_status: status, date_exited: excised ? now : null });
    } else if (!rows.some((r) => r.council_id === after.CouncilID)) {
      open(after.CouncilID, joinStamp(after.DateJoinedCouncil, now)); // a member from before the log began
    } else if (!excised) {
      open(after.CouncilID, now); // rejoining after leaving
    }
  }
  return plan;
}

/** One line of a member's council history card. */
export interface AffiliationHistoryEntry {
  /** The log row; null for the current membership of a member whose log has no row for it yet (added before schema 60). */
  id: number | null;
  councilId: number;
  councilNumber: number | null;
  councilName: string;
  status: string;
  /** 'YYYY-MM-DD HH:MM:SS', or null when nothing records it. */
  dateJoined: string | null;
  dateExited: string | null;
}

/**
 * members.listAffiliations: the member's log, oldest first, with council names. When no row covers the member's current
 * council (a member added before the log began), the current membership is added from the Member row.
 */
export function buildAffiliationHistory(input: {
  member: Pick<Member, 'CouncilID' | 'StatusID' | 'DateJoinedCouncil'>;
  rows: readonly MemberCouncilAffiliationLog[];
  councils: readonly Pick<Council, 'id' | 'CouncilNumber' | 'CouncilName'>[];
  statuses: readonly MemberStatus[];
}): AffiliationHistoryEntry[] {
  const council = (id: number) => input.councils.find((c) => c.id === id);
  const entry = (councilId: number) => ({
    councilId,
    councilNumber: council(councilId)?.CouncilNumber ?? null,
    councilName: council(councilId)?.CouncilName ?? `Council ${councilId}`,
  });
  const entries: AffiliationHistoryEntry[] = input.rows.map((r) => ({
    id: r.id,
    ...entry(r.council_id),
    status: r.membership_status,
    dateJoined: r.date_joined,
    dateExited: r.date_exited ?? null,
  }));
  const current = input.member.CouncilID;
  const status = statusNameOf(input.statuses, input.member.StatusID) ?? '';
  // A Deceased or Former member's membership is closed, so a closed row in the current council covers it.
  const closedOk = (LIFECYCLE_EXCISED_STATUSES as readonly string[]).includes(status);
  const covered = input.rows.some((r) => r.council_id === current && (r.date_exited == null || closedOk));
  if (!covered) {
    entries.push({
      id: null,
      ...entry(current),
      status,
      dateJoined: input.member.DateJoinedCouncil ? joinStamp(input.member.DateJoinedCouncil, '') : null,
      dateExited: null,
    });
  }
  return entries.sort((a, b) => (a.dateJoined ?? '').localeCompare(b.dateJoined ?? '') || (a.id ?? Infinity) - (b.id ?? Infinity));
}

/** members.listAffiliations: the member themself, an Active Admin of the member's council, or an Active Super Admin. */
export function assertMayReadAffiliations(actor: MemberWriteActor, member: Pick<Member, 'id' | 'CouncilID'>): void {
  if (actor.memberId === member.id || hasSuperAdminRights(actor)) return;
  if (hasAdminRights(actor) && actor.councilId === member.CouncilID) return;
  throw new SecurityPrivilegeError(
    hasAdminRights(actor) ? 'COUNCIL_ACCESS_DENIED' : 'ADMIN_REQUIRED',
    `Member ${actor.memberId} cannot read the council history of member ${member.id}; only the member, an Admin of their council or a Super Admin can.`,
    { actorId: actor.memberId, memberId: member.id },
  );
}

// ---- Shared Member Center (Sprint 7A Extension) ------------------------------------------------------------------

/** The council's combined devotional tally: sums only, never who prayed what. */
export interface CouncilDevotionTotals {
  rosaries: number;
  adorations: number;
  confessions: number;
  /** Members with anything logged. */
  contributors: number;
}

/** The viewer's own impact card. */
export interface PersonalImpact {
  memberId: number;
  firstName: string;
  lastName: string;
  /** Distinct events the member logged a shift at, ever. */
  eventsAttended: number;
  /** All hours the member logged, events and activities, ever. */
  hours: number;
  /** null for a white-label council (the shield is a Knights of Columbus extension). */
  rank: CanonizationRank | null;
}

/**
 * reports.memberCenter: the Shared Member Center, open to every member. Collective, non-financial council figures - no
 * cash, budget or ledger figure is in it - and the viewer's own impact card.
 */
export interface MemberCenter extends CouncilEngagement {
  volunteerCount: number;
  totalHours: number;
  /** null for a white-label council. */
  devotions: CouncilDevotionTotals | null;
  me: PersonalImpact;
}

/** Sums the council members' devotional tallies (rows of other members are ignored). */
export function councilDevotionTotals(rows: readonly MemberDevotionals[], memberIds: ReadonlySet<number>): CouncilDevotionTotals {
  const totals: CouncilDevotionTotals = { rosaries: 0, adorations: 0, confessions: 0, contributors: 0 };
  for (const r of rows) {
    if (!memberIds.has(r.user_id)) continue;
    totals.rosaries += r.rosaries_said;
    totals.adorations += r.adorations_count;
    totals.confessions += r.confessions_count;
    if (r.rosaries_said + r.adorations_count + r.confessions_count > 0) totals.contributors += 1;
  }
  return totals;
}

/** Builds the Member Center from the engagement card, the council's devotional totals and the viewer's own logs. */
export function buildMemberCenter(input: {
  engagement: CouncilEngagement;
  viewer: Pick<Member, 'id' | 'MemberFirstName' | 'MemberLastName'>;
  /** Every service log of the viewer, any council. */
  viewerLogs: readonly ServiceLogRow[];
  /** The viewer's own council's thresholds. */
  thresholds: RankThresholds;
  /** Null for a white-label council. */
  devotions: CouncilDevotionTotals | null;
}): MemberCenter {
  const { engagement, viewer } = input;
  const metrics = memberServiceMetrics(viewer.id, input.viewerLogs);
  return {
    ...engagement,
    volunteerCount: engagement.volunteers.length,
    totalHours: Math.round(engagement.volunteers.reduce((sum, v) => sum + v.hours, 0) * 100) / 100,
    devotions: input.devotions,
    me: {
      memberId: viewer.id,
      firstName: viewer.MemberFirstName,
      lastName: viewer.MemberLastName,
      eventsAttended: metrics.events,
      hours: metrics.hours,
      rank: input.devotions === null ? null : canonizationRank(metrics, input.thresholds),
    },
  };
}
