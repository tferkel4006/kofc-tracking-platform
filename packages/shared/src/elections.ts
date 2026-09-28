// =========================================================================
// OFFICER ELECTIONS AND LEADERSHIP HISTORY (Sprint 5U)
// Pure helpers behind the elections.* service methods: which offices are
// elected, climb the trustee ladder or are appointed; the fraternal year
// (July 1 - June 30); the nomination windows; who may run each step; and the
// seat, ballot and vacancy views the screens read. Drivers load rows, call
// these, then only store.
//
// Offices are matched by Role name, never by id, like FINANCE_ROLE_NAMES.
// A seat's holder is whoever holds the role in MemberRoles (that is what grants
// access); CouncilLeadershipHistory records the terms, and its open row (EndDate
// NULL) is the sitting term.
// =========================================================================
import type { BallotSeat, FraternalYearConclusion, OfficeKind, OfficerSeat, SeatHolder, SeatVacancy } from './contract';
import { toTimestamp } from './messaging';
import {
  BusinessRuleError,
  describeActor,
  hasAdminRights,
  hasSuperAdminRights,
  SecurityPrivilegeError,
  toIsoDate,
  type MemberWriteActor,
} from './rules';
import type { CouncilElectionBallot, CouncilLeadershipHistory, Member, OfficerNominations, Role } from './types';

export const GRAND_KNIGHT_ROLE = 'Grand Knight';
export const DEPUTY_GRAND_KNIGHT_ROLE = 'Deputy Grand Knight';
/** The trustee ladder, lowest seat first: Trustee 1 is the 1-year seat, Trustee 3 the 3-year seat. */
export const TRUSTEE_ROLE_NAMES = ['Trustee 1', 'Trustee 2', 'Trustee 3'] as const;
/** Offices the council elects each year; the only seats a ballot may open. */
export const ELECTED_ROLE_NAMES = [
  GRAND_KNIGHT_ROLE,
  DEPUTY_GRAND_KNIGHT_ROLE,
  'Chancellor',
  'Recorder',
  'Treasurer',
  'Warden',
  'Advocate',
  'Inside Guard',
  'Outside Guard',
] as const;
/** Offices the Grand Knight appoints (Supreme Council terminology); never on a ballot. */
export const APPOINTED_ROLE_NAMES = [
  'Financial Secretary',
  'Chaplain',
  'Lecturer',
  'Membership Director',
  'Community Director',
  'Program Director',
  'Family Director',
] as const;
/** Every single-holder council office, in the order screens list them. */
export const OFFICE_ROLE_NAMES: readonly string[] = [...ELECTED_ROLE_NAMES, ...TRUSTEE_ROLE_NAMES, ...APPOINTED_ROLE_NAMES];
/** An abdication in an elected office opens a mid-year election with this many days of nominations. */
export const MID_YEAR_NOMINATION_DAYS = 14;
/** Regular nominations run through this month (0-based: May). */
export const NOMINATION_MONTH = 4;
/** The earliest a fraternal year starts: July (0-based). */
const FRATERNAL_YEAR_START_MONTH = 6;

const includes = (names: readonly string[], name: string) => names.includes(name);

/** How a seat is filled, or null for a role that is not a council office (such as 'Member'). */
export function officeKind(roleName: string): OfficeKind | null {
  if (includes(ELECTED_ROLE_NAMES, roleName)) return 'elected';
  if (includes(TRUSTEE_ROLE_NAMES, roleName)) return 'trustee';
  if (includes(APPOINTED_ROLE_NAMES, roleName)) return 'appointed';
  return null;
}

const yearLabel = (startYear: number) => `${startYear}-${startYear + 1}`;

/** The fraternal year (July 1 - June 30) containing `date`, e.g. '2026-2027'. */
export function fraternalYearOf(date: Date): string {
  const y = date.getFullYear();
  return yearLabel(date.getMonth() >= FRATERNAL_YEAR_START_MONTH ? y : y - 1);
}

/**
 * The term a regular election held on `now` fills: May's election fills the year starting July 1, and a year
 * concluded late (July onward) fills the year already under way. Either way it starts in `now`'s calendar year.
 */
export function electionTermYear(now: Date): string {
  return yearLabel(now.getFullYear());
}

/** NominationsCloseAt for a mid-year election opened on `now`. */
export function midYearNominationsCloseAt(now: Date): string {
  return toTimestamp(new Date(now.getTime() + MID_YEAR_NOMINATION_DAYS * 86_400_000));
}

const isMidYearWindowOpen = (ballot: CouncilElectionBallot, now: Date): boolean =>
  ballot.IsMidYearElection === 1 && ballot.NominationsCloseAt != null && toTimestamp(now) <= ballot.NominationsCloseAt;

/** Whether an open seat takes nominations on `now`: during May, or before a mid-year election's closing time. */
export function nominationsOpen(ballot: CouncilElectionBallot, now: Date): boolean {
  return ballot.IsUpForElection === 1 && (now.getMonth() === NOMINATION_MONTH || isMidYearWindowOpen(ballot, now));
}

/** The term a seat's current nominations are for: this fraternal year during a mid-year election, else electionTermYear. */
export function ballotTermYear(ballot: CouncilElectionBallot, now: Date): string {
  return isMidYearWindowOpen(ballot, now) ? fraternalYearOf(now) : electionTermYear(now);
}

/** elections.submitNomination: the seat must be on the ballot and its window open. */
export function assertNominationsOpen(ballot: CouncilElectionBallot | undefined, roleName: string, now: Date): CouncilElectionBallot {
  if (!ballot || ballot.IsUpForElection !== 1) {
    throw new BusinessRuleError('ROLE_NOT_ON_BALLOT', `${roleName} is not open for nomination this cycle.`, { roleName });
  }
  if (!nominationsOpen(ballot, now)) {
    throw new BusinessRuleError(
      'NOMINATIONS_WINDOW_CLOSED',
      ballot.IsMidYearElection === 1
        ? `Nominations for the mid-year ${roleName} election closed at ${ballot.NominationsCloseAt ?? 'an unknown time'}; the regular officer nomination window opens annually on May 1st.`
        : `Nominations for ${roleName} are closed; the regular officer nomination window runs May 1 through May 31.`,
      { roleName, today: toIsoDate(now), closesAt: ballot.NominationsCloseAt ?? null },
    );
  }
  return ballot;
}

/**
 * A Grand Knight nominee should have served as Deputy Grand Knight or Grand Knight; `roleNames` are the roles of
 * every history row the nominee has, current or past. Other seats have no such requirement.
 */
export function isEligibleNominee(officeName: string, roleNames: readonly string[]): boolean {
  return officeName !== GRAND_KNIGHT_ROLE || roleNames.some((r) => r === GRAND_KNIGHT_ROLE || r === DEPUTY_GRAND_KNIGHT_ROLE);
}

// ---- who may act ---------------------------------------------------------

const outsideCouncil = (actor: MemberWriteActor, councilId: number, action: string) =>
  new SecurityPrivilegeError(
    'COUNCIL_ACCESS_DENIED',
    `Member ${actor.memberId} of council ${actor.councilId} cannot ${action} in council ${councilId}; a council's elections are run by its own members.`,
    { actorId: actor.memberId, actorCouncilId: actor.councilId, councilId },
  );

function concludeDenial(actor: MemberWriteActor, councilId: number, sittingGrandKnightId: number | null): SecurityPrivilegeError | null {
  if (hasSuperAdminRights(actor)) return null;
  const isGrandKnight = actor.active && actor.memberId === sittingGrandKnightId;
  if (!hasAdminRights(actor) && !isGrandKnight) {
    return new SecurityPrivilegeError(
      'ADMIN_REQUIRED',
      `Only an active Admin of the council, its sitting Grand Knight or a Super Admin can conclude the fraternal year; member ${actor.memberId} is ${describeActor(actor)}.`,
      { actorId: actor.memberId, actorType: actor.memberType ?? null, councilId },
    );
  }
  return actor.councilId === councilId ? null : outsideCouncil(actor, councilId, 'conclude the fraternal year');
}

/** elections.concludeFraternalYear: an Active Super Admin, an Active Admin of the council, or its sitting Grand Knight. */
export function assertMayConcludeFraternalYear(actor: MemberWriteActor, councilId: number, sittingGrandKnightId: number | null): void {
  const denial = concludeDenial(actor, councilId, sittingGrandKnightId);
  if (denial) throw denial;
}

export const mayConcludeFraternalYear = (actor: MemberWriteActor, councilId: number, sittingGrandKnightId: number | null): boolean =>
  concludeDenial(actor, councilId, sittingGrandKnightId) === null;

/** elections.recordOfficerAbdication: an Active Super Admin, an Active Admin of the council, or the member resigning their own seat. */
export function assertMayRecordAbdication(actor: MemberWriteActor, councilId: number, memberId: number): void {
  if (hasSuperAdminRights(actor)) return;
  if (actor.active && actor.memberId === memberId) return;
  if (!hasAdminRights(actor)) {
    throw new SecurityPrivilegeError(
      'ADMIN_REQUIRED',
      `Only an active Admin of the council or a Super Admin can record another member's abdication; member ${actor.memberId} is ${describeActor(actor)}.`,
      { actorId: actor.memberId, actorType: actor.memberType ?? null, councilId, memberId },
    );
  }
  if (actor.councilId !== councilId) throw outsideCouncil(actor, councilId, 'record an abdication');
}

function appointDenial(actor: MemberWriteActor, councilId: number, sittingGrandKnightId: number | null): SecurityPrivilegeError | null {
  if (hasSuperAdminRights(actor)) return null;
  if (actor.active && actor.memberId === sittingGrandKnightId) return null;
  return new SecurityPrivilegeError(
    'GRAND_KNIGHT_REQUIRED',
    `Only the sitting Grand Knight of council ${councilId} or a Super Admin can appoint officers; member ${actor.memberId} is not.`,
    { actorId: actor.memberId, councilId, sittingGrandKnightId },
  );
}

/** elections.assignAppointedRole and the appointments desk: the council's sitting (Active) Grand Knight or an Active Super Admin. */
export function assertMayAppointOfficers(actor: MemberWriteActor, councilId: number, sittingGrandKnightId: number | null): void {
  const denial = appointDenial(actor, councilId, sittingGrandKnightId);
  if (denial) throw denial;
}

export const mayAppointOfficers = (actor: MemberWriteActor, councilId: number, sittingGrandKnightId: number | null): boolean =>
  appointDenial(actor, councilId, sittingGrandKnightId) === null;

function ballotDenial(actor: MemberWriteActor, councilId: number): SecurityPrivilegeError | null {
  if (hasSuperAdminRights(actor)) return null;
  if (!hasAdminRights(actor)) {
    return new SecurityPrivilegeError(
      'ADMIN_REQUIRED',
      `Only an active Admin of the council or a Super Admin can open or close seats for election; member ${actor.memberId} is ${describeActor(actor)}.`,
      { actorId: actor.memberId, actorType: actor.memberType ?? null, councilId },
    );
  }
  return actor.councilId === councilId ? null : outsideCouncil(actor, councilId, 'change the election ballot');
}

/** elections.toggleRoleBallotStatus: an Active Admin of the council or an Active Super Admin. */
export function assertMayConfigureBallot(actor: MemberWriteActor, councilId: number): void {
  const denial = ballotDenial(actor, councilId);
  if (denial) throw denial;
}

export const mayConfigureBallot = (actor: MemberWriteActor, councilId: number): boolean => ballotDenial(actor, councilId) === null;

/** elections.submitNomination: any Active member of the council, or an Active Super Admin. */
export function assertMayNominate(actor: MemberWriteActor, councilId: number): void {
  if (hasSuperAdminRights(actor)) return;
  if (actor.active && actor.councilId === councilId) return;
  throw new SecurityPrivilegeError(
    'COUNCIL_ACCESS_DENIED',
    `Only active members of council ${councilId} can submit its nominations; member ${actor.memberId} is ${describeActor(actor)} of council ${actor.councilId}.`,
    { actorId: actor.memberId, actorCouncilId: actor.councilId, councilId },
  );
}

/** A nominee, appointee or incoming Grand Knight must be an Active member of the council. */
export function assertActiveCouncilMember(
  member: { id: number; CouncilID: number } | undefined | null,
  active: boolean,
  councilId: number,
  purpose: string,
): void {
  if (member && active && member.CouncilID === councilId) return;
  throw new BusinessRuleError(
    'NOT_ACTIVE_COUNCIL_MEMBER',
    `${member ? `Member ${member.id}` : 'That member'} cannot be ${purpose}: only an active member of council ${councilId} can.`,
    { memberId: member?.id ?? null, councilId },
  );
}

// ---- role checks -----------------------------------------------------------

/** The Role row for `roleId`, which must exist (INVALID_INPUT). */
export function requireRole(roles: readonly Role[], roleId: number): Role {
  const role = roles.find((r) => r.id === roleId);
  if (!role) throw new BusinessRuleError('INVALID_INPUT', `No role with id ${roleId}.`, { roleId });
  return role;
}

/** Only elected offices may be put on the ballot or nominated for (ROLE_NOT_ELECTED). */
export function assertElectedRole(role: Role): void {
  if (officeKind(role.Role) === 'elected') return;
  throw new BusinessRuleError(
    'ROLE_NOT_ELECTED',
    `${role.Role} is not an elected office${officeKind(role.Role) ? '; it is filled by the Grand Knight or the trustee ladder' : ''}, so it cannot go on a ballot.`,
    { roleId: role.id, role: role.Role },
  );
}

/** Only appointed offices and trustee seats may be filled by appointment (ROLE_NOT_APPOINTED). */
export function assertAppointableRole(role: Role): void {
  const kind = officeKind(role.Role);
  if (kind === 'appointed' || kind === 'trustee') return;
  throw new BusinessRuleError(
    'ROLE_NOT_APPOINTED',
    `${role.Role} is ${kind === 'elected' ? 'an elected office, filled by the council ballot' : 'not a council office'}; the Grand Knight appoints only ${APPOINTED_ROLE_NAMES.join(', ')} and vacant trustee seats.`,
    { roleId: role.id, role: role.Role },
  );
}

/** toggleRoleBallotStatus's flag must be a real boolean, so a stray string never opens a seat. */
export function cleanBallotStatus(isOpen: unknown): boolean {
  if (typeof isOpen === 'boolean') return isOpen;
  throw new BusinessRuleError('INVALID_INPUT', `The ballot status must be true (open) or false (closed); received ${JSON.stringify(isOpen)}.`, { isOpen });
}

export const alreadyNominated = (roleName: string, nomineeMemberId: number, fraternalYear: string) =>
  new BusinessRuleError('ALREADY_NOMINATED', `Member ${nomineeMemberId} is already nominated for ${roleName} for ${fraternalYear}.`, {
    roleName,
    nomineeMemberId,
    fraternalYear,
  });

export const roleNotHeld = (memberId: number, roleName: string, councilId: number) =>
  new BusinessRuleError('ROLE_NOT_HELD', `Member ${memberId} does not hold ${roleName} in council ${councilId}.`, { memberId, roleName, councilId });

export const roleOccupied = (roleName: string, holderId: number) =>
  new BusinessRuleError(
    'ROLE_OCCUPIED',
    `${roleName} is held by member ${holderId}; record their abdication before appointing a replacement.`,
    { roleName, holderId },
  );

/** A member sits in at most one trustee chair, so an appointment may not put a sitting trustee in a second one. */
export function assertOneTrusteeSeat(role: Role, heldRoleNames: readonly string[], memberId: number): void {
  if (!includes(TRUSTEE_ROLE_NAMES, role.Role)) return;
  const seat = heldRoleNames.find((r) => includes(TRUSTEE_ROLE_NAMES, r));
  if (!seat) return;
  throw new BusinessRuleError('INVALID_INPUT', `Member ${memberId} already sits as ${seat}, so cannot also be appointed ${role.Role}.`, {
    memberId,
    role: role.Role,
    heldSeat: seat,
  });
}

/** An abdication names a council office (INVALID_INPUT otherwise). */
export function assertOfficeRole(role: Role): OfficeKind {
  const kind = officeKind(role.Role);
  if (kind) return kind;
  throw new BusinessRuleError('INVALID_INPUT', `${role.Role} is not a council office.`, { roleId: role.id, role: role.Role });
}

// ---- the council's election rows ---------------------------------------------

/** Everything the election views read for one council, as the driver loaded it. */
export interface ElectionRows {
  roles: readonly Role[];
  /** At least every member the other rows name. */
  members: readonly Pick<Member, 'id' | 'MemberFirstName' | 'MemberLastName'>[];
  /** MemberRoles rows of the council's members. */
  holdings: readonly { RoleID: number; MemberID: number }[];
  /** The council's CouncilLeadershipHistory rows. */
  history: readonly CouncilLeadershipHistory[];
  /** The council's CouncilElectionBallot rows. */
  ballots: readonly CouncilElectionBallot[];
  /** The council's OfficerNominations rows. */
  nominations: readonly OfficerNominations[];
}

const nameOf = (rows: ElectionRows, memberId: number) => {
  const m = rows.members.find((x) => x.id === memberId);
  return m ? { firstName: m.MemberFirstName, lastName: m.MemberLastName } : { firstName: '', lastName: `Member ${memberId}` };
};

/** The member holding `roleId` (the lowest member id should legacy data hold two), or null for a vacant seat. */
export function seatHolderId(rows: Pick<ElectionRows, 'holdings'>, roleId: number): number | null {
  const ids = rows.holdings.filter((h) => h.RoleID === roleId).map((h) => h.MemberID);
  return ids.length ? Math.min(...ids) : null;
}

/** seatHolderId by role name; null when the role does not exist either. */
export function seatHolderIdByName(rows: Pick<ElectionRows, 'holdings' | 'roles'>, roleName: string): number | null {
  const role = rows.roles.find((r) => r.Role === roleName);
  return role ? seatHolderId(rows, role.id) : null;
}

/** The member's open history row for the seat, if any. */
export const openHistoryRow = (history: readonly CouncilLeadershipHistory[], memberId: number, roleId: number) =>
  history.find((h) => h.MemberID === memberId && h.RoleID === roleId && h.EndDate == null);

function holderOf(rows: ElectionRows, roleId: number): SeatHolder | null {
  const memberId = seatHolderId(rows, roleId);
  if (memberId === null) return null;
  return { memberId, ...nameOf(rows, memberId), since: openHistoryRow(rows.history, memberId, roleId)?.StartDate ?? null };
}

const officeRoles = (roles: readonly Role[]) =>
  OFFICE_ROLE_NAMES.map((name) => roles.find((r) => r.Role === name)).filter((r): r is Role => r !== undefined);

/** elections.listOfficerSeats: every council office in OFFICE_ROLE_NAMES order, with its holder and (elected seats) ballot state. */
export function buildOfficerSeats(councilId: number, rows: ElectionRows): OfficerSeat[] {
  return officeRoles(rows.roles).map((role) => {
    const kind = officeKind(role.Role)!;
    const ballot = rows.ballots.find((b) => b.RoleID === role.id);
    return {
      roleId: role.id,
      roleName: role.Role,
      kind,
      holder: holderOf(rows, role.id),
      ballot: kind !== 'elected' ? null : ballot ? { ...ballot } : closedBallot(councilId, role.id),
    };
  });
}

/** The ballot state of a seat that has never been opened. */
export const closedBallot = (councilId: number, roleId: number): CouncilElectionBallot => ({
  CouncilID: councilId,
  RoleID: roleId,
  IsUpForElection: 0,
  IsMidYearElection: 0,
  NominationsCloseAt: null,
});

/** elections.listBallotConfig: the open elected seats with their nominees for the term, oldest nomination first. */
export function buildBallotSeats(rows: ElectionRows, now: Date): BallotSeat[] {
  return officeRoles(rows.roles)
    .filter((role) => officeKind(role.Role) === 'elected')
    .flatMap((role) => {
      const ballot = rows.ballots.find((b) => b.RoleID === role.id && b.IsUpForElection === 1);
      if (!ballot) return [];
      const fraternalYear = ballotTermYear(ballot, now);
      const nominees = rows.nominations
        .filter((n) => n.OfficeRoleID === role.id && n.FraternalYear === fraternalYear)
        .sort((a, b) => a.NominatedAt.localeCompare(b.NominatedAt) || a.id - b.id)
        .map((n) => {
          const by = nameOf(rows, n.NominatedByMemberID);
          return {
            nomination: { ...n },
            ...nameOf(rows, n.NomineeMemberID),
            nominatedByName: `${by.firstName} ${by.lastName}`.trim(),
          };
        });
      return [
        {
          roleId: role.id,
          roleName: role.Role,
          ballot: { ...ballot },
          fraternalYear,
          nominationsOpen: nominationsOpen(ballot, now),
          holder: holderOf(rows, role.id),
          nominees,
        },
      ];
    });
}

/** elections.listVacancies: appointed and trustee seats nobody holds, with whoever last left each. */
export function buildVacancies(rows: ElectionRows): SeatVacancy[] {
  return officeRoles(rows.roles)
    .filter((role) => officeKind(role.Role) !== 'elected' && seatHolderId(rows, role.id) === null)
    .map((role) => {
      const last = rows.history
        .filter((h) => h.RoleID === role.id && h.EndDate != null)
        .sort((a, b) => (b.EndDate as string).localeCompare(a.EndDate as string) || b.id - a.id)[0];
      return {
        roleId: role.id,
        roleName: role.Role,
        kind: officeKind(role.Role) as 'appointed' | 'trustee',
        previous: last
          ? { memberId: last.MemberID, ...nameOf(rows, last.MemberID), endDate: last.EndDate as string, exitReason: last.ExitReason ?? null }
          : null,
      };
    });
}

/**
 * Day-one history: an open CouncilLeadershipHistory row for every Active member holding a council office who has
 * none, starting `now` in the current fraternal year. The seed runs it for every council, and each election write
 * runs it first so officers named since (members.update, Super Admin fixes) have a term to close.
 */
export function planHistoryBackfill(
  councilId: number,
  rows: Pick<ElectionRows, 'roles' | 'holdings' | 'history'>,
  activeMemberIds: ReadonlySet<number>,
  now: Date,
): Omit<CouncilLeadershipHistory, 'id'>[] {
  return rows.holdings
    .filter((h) => activeMemberIds.has(h.MemberID))
    .filter((h) => {
      const role = rows.roles.find((r) => r.id === h.RoleID);
      return role !== undefined && officeKind(role.Role) !== null && !openHistoryRow(rows.history, h.MemberID, h.RoleID);
    })
    .sort((a, b) => a.RoleID - b.RoleID || a.MemberID - b.MemberID)
    .map((h) => ({
      CouncilID: councilId,
      MemberID: h.MemberID,
      RoleID: h.RoleID,
      FraternalYear: fraternalYearOf(now),
      StartDate: toIsoDate(now),
      EndDate: null,
      ExitReason: null,
      AppointedByID: null,
    }));
}

// ---- concluding the fraternal year -------------------------------------------

/** One seat's change of hands: `from` leaves (TermConcluded), `to` starts a new term; equal ids renew the term. */
export interface SeatTransition {
  roleName: string;
  from: number | null;
  to: number | null;
}

/**
 * elections.concludeFraternalYear. With the Grand Knight seat on the ballot, the chairs rotate: the outgoing Grand
 * Knight takes Trustee 1, Trustee 1 moves to Trustee 2, Trustee 2 to Trustee 3, the old Trustee 3 leaves the board
 * and `newGrandKnightId` takes the Grand Knight's chair. An incoming Grand Knight who was a trustee leaves the ladder,
 * so the seat they would have climbed into stays vacant for an appointment. Re-electing the sitting Grand Knight renews
 * their term without moving the trustees. Off the ballot (the second year of a two-year term) nothing moves, and naming
 * anyone but the sitting Grand Knight rejects GRAND_KNIGHT_TERM_CONTINUES.
 */
export function planFraternalYearConclusion(input: {
  grandKnightOnBallot: boolean;
  sitting: { grandKnight: number | null; trustees: readonly [number | null, number | null, number | null] };
  newGrandKnightId: number;
}): { rotated: boolean; transitions: SeatTransition[] } {
  const { grandKnightOnBallot, sitting, newGrandKnightId } = input;
  if (!grandKnightOnBallot) {
    if (newGrandKnightId !== sitting.grandKnight) {
      throw new BusinessRuleError(
        'GRAND_KNIGHT_TERM_CONTINUES',
        `The Grand Knight seat was not on this year's ballot, so ${
          sitting.grandKnight === null ? 'no new Grand Knight can be seated by concluding the year' : `member ${sitting.grandKnight} continues as Grand Knight`
        }; member ${newGrandKnightId} cannot take the chair.`,
        { sittingGrandKnightId: sitting.grandKnight, newGrandKnightId },
      );
    }
    return { rotated: false, transitions: [] };
  }
  if (newGrandKnightId === sitting.grandKnight) {
    return { rotated: false, transitions: [{ roleName: GRAND_KNIGHT_ROLE, from: newGrandKnightId, to: newGrandKnightId }] };
  }
  const [t1, t2, t3] = sitting.trustees;
  const climbing = (id: number | null) => (id === newGrandKnightId ? null : id);
  return {
    rotated: true,
    transitions: [
      { roleName: GRAND_KNIGHT_ROLE, from: sitting.grandKnight, to: newGrandKnightId },
      { roleName: TRUSTEE_ROLE_NAMES[0], from: t1, to: climbing(sitting.grandKnight) },
      { roleName: TRUSTEE_ROLE_NAMES[1], from: t2, to: climbing(t1) },
      { roleName: TRUSTEE_ROLE_NAMES[2], from: t3, to: climbing(t2) },
    ].filter((t) => t.from !== null || t.to !== null),
  };
}

/**
 * planFraternalYearConclusion from the council's seats (buildOfficerSeats): the drivers plan the real conclusion with
 * it, and the demo simulator previews the same plan before asking for confirmation.
 */
export function planConclusionFromSeats(
  seats: readonly OfficerSeat[],
  newGrandKnightId: number,
): { rotated: boolean; transitions: SeatTransition[] } {
  const holder = (name: string) => seats.find((s) => s.roleName === name)?.holder?.memberId ?? null;
  const [t1, t2, t3] = TRUSTEE_ROLE_NAMES;
  return planFraternalYearConclusion({
    grandKnightOnBallot: seats.find((s) => s.roleName === GRAND_KNIGHT_ROLE)?.ballot?.IsUpForElection === 1,
    sitting: { grandKnight: holder(GRAND_KNIGHT_ROLE), trustees: [holder(t1), holder(t2), holder(t3)] },
    newGrandKnightId,
  });
}

/** One member's chairs before and after a conclusion: `from` null means they join the board, `to` null that they leave it. */
export interface ChairMove {
  memberId: number;
  from: string | null;
  to: string | null;
}

/** A plan's transitions per member, in seat order, for the confirmation that names who moves to which chair. */
export function chairMoves(transitions: readonly SeatTransition[]): ChairMove[] {
  const ids = [...new Set(transitions.flatMap((t) => [t.from, t.to]).filter((id): id is number => id !== null))];
  return ids.map((memberId) => ({
    memberId,
    from: transitions.find((t) => t.from === memberId)?.roleName ?? null,
    to: transitions.find((t) => t.to === memberId)?.roleName ?? null,
  }));
}

/** The result screens show, from the plan and the Role ids. */
export function conclusionResult(
  plan: { rotated: boolean; transitions: readonly SeatTransition[] },
  roles: readonly Role[],
  fraternalYear: string,
  ballotsReset: number,
): FraternalYearConclusion {
  return {
    rotated: plan.rotated,
    fraternalYear,
    changes: plan.transitions.map((t) => ({
      roleId: roles.find((r) => r.Role === t.roleName)?.id ?? 0,
      roleName: t.roleName,
      previousMemberId: t.from,
      memberId: t.to,
    })),
    ballotsReset,
  };
}
