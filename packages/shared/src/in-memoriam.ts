// =========================================================================
// THE IN MEMORIAM ROLL (Sprint 6L Extension 5, schema version 54)
// Pure helpers behind history.getInMemoriamRoll, saveInMemoriamEntry and compileInMemoriam. The roll is built from the
// roster: every member of the council whose MemberStatus is 'Deceased' gets a card. Each card cross-references the
// brother's CouncilLeadershipHistory seats, then compiles the council's collective accomplishments (CouncilHistoryAnnals)
// and team totals (buildYearClosingMetrics) for the fraternal years the brother held a seat. The keepers' photo, biography and
// past councils come from CouncilInMemoriam. Drivers load rows, call these, then only store.
// =========================================================================
import type { InMemoriamCard, InMemoriamInput, InMemoriamRoll, InMemoriamSeat, InMemoriamTotals } from './contract';
import { buildYearClosingMetrics, cleanHistoryAssetUrl, type YearClosingRows } from './history';
import { assertText, BusinessRuleError } from './rules';
import type { CouncilHistoryAnnals, CouncilInMemoriam, CouncilLeadershipHistory, Member, MemberStatus, Role } from './types';

/** The MemberStatus a brother must carry to appear on the roll. */
export const DECEASED_STATUS = 'Deceased';
/** Longest biography. */
export const IN_MEMORIAM_TEXT_MAX_LENGTH = 4000;
/** Longest past_councils text (VARCHAR(1000)). */
export const IN_MEMORIAM_PAST_COUNCILS_MAX_LENGTH = 1000;
/** How much of one year's collective accomplishments the compiled summary quotes. */
export const IN_MEMORIAM_ACCOMPLISHMENT_EXCERPT = 400;
/** The heading of the roll on the Council History page. */
export const IN_MEMORIAM_TITLE = 'In Memoriam';

const invalid = (message: string, details: Record<string, unknown> = {}) => new BusinessRuleError('INVALID_INPUT', message, details);

/** undefined keeps, null or blank clears, otherwise trimmed text of at most `max` characters. */
function optionalText(value: unknown, label: string, max: number): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const text = assertText(value, label, max, false);
  return text === '' ? null : text;
}

/** history.saveInMemoriamEntry's input, cleaned; omitted fields stay undefined so the stored value is kept. */
export function cleanInMemoriamInput(input: InMemoriamInput): InMemoriamInput {
  if (input === null || typeof input !== 'object') throw invalid('The remembrance must be an object.');
  for (const key of Object.keys(input)) {
    if (!['photo_url', 'biography', 'past_councils'].includes(key)) throw invalid(`A remembrance has no field "${key}".`, { field: key });
  }
  return {
    photo_url: cleanHistoryAssetUrl(input.photo_url, 'Photo', false),
    biography: optionalText(input.biography, 'Biography', IN_MEMORIAM_TEXT_MAX_LENGTH),
    past_councils: optionalText(input.past_councils, 'Past councils', IN_MEMORIAM_PAST_COUNCILS_MAX_LENGTH),
  };
}

/** The keeper fields of a remembrance after applying `clean` to `existing` (or to a new row). */
export function mergeInMemoriamInput(
  existing: Pick<CouncilInMemoriam, 'photo_url' | 'biography' | 'past_councils'> | null | undefined,
  clean: InMemoriamInput,
): { photo_url: string | null; biography: string | null; past_councils: string | null } {
  const pick = (key: keyof InMemoriamInput): string | null => (clean[key] !== undefined ? (clean[key] ?? null) : (existing?.[key] ?? null));
  return { photo_url: pick('photo_url'), biography: pick('biography'), past_councils: pick('past_councils') };
}

/** Refuses IN_MEMORIAM_NOT_DECEASED unless `memberId` is a deceased member of the council. */
export function assertDeceasedMember(
  member: Pick<Member, 'id' | 'CouncilID' | 'StatusID'> | null | undefined,
  statuses: readonly Pick<MemberStatus, 'id' | 'Status'>[],
  councilId: number,
  memberId: number,
): void {
  const deceased = statuses.find((s) => s.Status === DECEASED_STATUS)?.id;
  if (member && member.CouncilID === councilId && deceased !== undefined && member.StatusID === deceased) return;
  throw new BusinessRuleError('IN_MEMORIAM_NOT_DECEASED', `Member ${memberId} is not a deceased member of council ${councilId}; only they appear In Memoriam.`, {
    memberId,
    councilId,
  });
}

const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const count = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 });
const plural = (n: number, one: string, many: string) => `${count(n)} ${n === 1 ? one : many}`;
const cents = (values: readonly number[]) => values.reduce((t, v) => t + Math.round(v * 100), 0) / 100;

/** The seats as one line: 'Grand Knight (2024-2025); Trustee 1 (2025-2026)'. */
export const describeInMemoriamSeats = (seats: readonly InMemoriamSeat[]): string =>
  seats.map((s) => `${s.roleName} (${s.fraternalYear})${s.steppedDown ? ', stepped down' : ''}`).join('; ');

/** The compiled remembrance text: seats, the council's totals over those years, and the annals' accomplishments. */
export function composeInMemoriamSummary(input: {
  name: string;
  seats: readonly InMemoriamSeat[];
  leadershipYears: readonly string[];
  totals: InMemoriamTotals;
  accomplishments: readonly { fraternalYear: string; text: string }[];
}): string {
  const { name, seats, leadershipYears, totals } = input;
  if (seats.length === 0) return `Brother ${name} held no officer seat recorded in the council's leadership history. The council remembers a faithful brother Knight.`;
  const lines = [
    `Brother ${name} served the council in ${plural(seats.length, 'seat', 'seats')}: ${describeInMemoriamSeats(seats)}.`,
    `In those years of leadership (${leadershipYears.join(', ')}) the council logged ${plural(totals.volunteerHours, 'volunteer hour', 'volunteer hours')}, ` +
      `raised ${money(totals.fundsRaised)} at events, paid out ${money(totals.charitableGiving)} in charitable gifts, ` +
      `held ${plural(totals.eventsHeld, 'event', 'events')} and ${plural(totals.meetingsHeld, 'meeting', 'meetings')}, ` +
      `and welcomed ${plural(totals.newMembers, 'new member', 'new members')}.`,
  ];
  if (input.accomplishments.length > 0) {
    lines.push('Collective accomplishments recorded in the annals:');
    for (const a of input.accomplishments) {
      const text = a.text.trim().replace(/\s+/g, ' ');
      lines.push(`- ${a.fraternalYear}: ${text.length > IN_MEMORIAM_ACCOMPLISHMENT_EXCERPT ? `${text.slice(0, IN_MEMORIAM_ACCOMPLISHMENT_EXCERPT - 1).trimEnd()}…` : text}`);
    }
  }
  return lines.join('\n');
}

/** history.getInMemoriamRoll from the council's rows. */
export function buildInMemoriamRoll(input: {
  councilId: number;
  /** The council's members, with StatusID. */
  members: readonly Pick<Member, 'id' | 'CouncilID' | 'StatusID' | 'MemberFirstName' | 'MemberLastName' | 'DateJoinedCouncil'>[];
  statuses: readonly Pick<MemberStatus, 'id' | 'Status'>[];
  roles: readonly Pick<Role, 'id' | 'Role' | 'Officer'>[];
  leadership: readonly CouncilLeadershipHistory[];
  annals: readonly Pick<CouncilHistoryAnnals, 'council_id' | 'fraternal_year' | 'collective_accomplishments'>[];
  /** The rows behind the year totals (the same loader elections.concludeFraternalYear uses). */
  closingRows: YearClosingRows;
  stored: readonly CouncilInMemoriam[];
  canKeep: boolean;
  today: Date;
}): InMemoriamRoll {
  const { councilId, today } = input;
  const deceased = input.statuses.find((s) => s.Status === DECEASED_STATUS)?.id;
  const role = new Map(input.roles.map((r) => [r.id, r]));
  const stored = new Map(input.stored.filter((r) => r.council_id === councilId).map((r) => [r.member_id, r]));
  const yearTotals = new Map<string, InMemoriamTotals>();
  const totalsOf = (year: string): InMemoriamTotals => {
    let t = yearTotals.get(year);
    if (!t) {
      const m = buildYearClosingMetrics(councilId, year, input.closingRows, today);
      t = {
        volunteerHours: m.volunteerHours.total,
        fundsRaised: m.fundsRaised.total,
        charitableGiving: m.charitableGiving,
        eventsHeld: m.eventsHeld,
        meetingsHeld: m.meetingsHeld,
        newMembers: m.newMembers,
      };
      yearTotals.set(year, t);
    }
    return t;
  };

  const cards: InMemoriamCard[] = input.members
    .filter((m) => m.CouncilID === councilId && deceased !== undefined && m.StatusID === deceased)
    .sort((a, b) => a.MemberLastName.localeCompare(b.MemberLastName) || a.MemberFirstName.localeCompare(b.MemberFirstName) || a.id - b.id)
    .map((m) => {
      const seats: InMemoriamSeat[] = input.leadership
        .filter((h) => h.CouncilID === councilId && h.MemberID === m.id)
        .sort((a, b) => a.StartDate.localeCompare(b.StartDate) || a.RoleID - b.RoleID || a.id - b.id)
        .map((h) => ({
          roleName: role.get(h.RoleID)?.Role ?? `Role ${h.RoleID}`,
          fraternalYear: h.FraternalYear,
          startDate: h.StartDate,
          endDate: h.EndDate ?? null,
          steppedDown: h.ExitReason === 'Abdicated',
        }));
      const leadershipYears = [...new Set(seats.map((s) => s.fraternalYear))].sort();
      const perYear = leadershipYears.map(totalsOf);
      const totals: InMemoriamTotals = {
        volunteerHours: cents(perYear.map((t) => t.volunteerHours)),
        fundsRaised: cents(perYear.map((t) => t.fundsRaised)),
        charitableGiving: cents(perYear.map((t) => t.charitableGiving)),
        eventsHeld: perYear.reduce((n, t) => n + t.eventsHeld, 0),
        meetingsHeld: perYear.reduce((n, t) => n + t.meetingsHeld, 0),
        newMembers: perYear.reduce((n, t) => n + t.newMembers, 0),
      };
      const accomplishments = leadershipYears.flatMap((year) => {
        const text = input.annals.find((a) => a.council_id === councilId && a.fraternal_year === year)?.collective_accomplishments;
        return text && text.trim() ? [{ fraternalYear: year, text }] : [];
      });
      const name = `${m.MemberFirstName} ${m.MemberLastName}`.trim();
      const row = stored.get(m.id);
      return {
        memberId: m.id,
        firstName: m.MemberFirstName,
        lastName: m.MemberLastName,
        dateJoinedCouncil: m.DateJoinedCouncil ?? null,
        entryId: row?.id ?? null,
        photoUrl: row?.photo_url ?? null,
        biography: row?.biography ?? null,
        pastCouncils: row?.past_councils ?? null,
        seats,
        officerSeatsHeld: describeInMemoriamSeats(seats),
        leadershipYears,
        totals,
        leadershipSummary: composeInMemoriamSummary({ name, seats, leadershipYears, totals, accomplishments }),
        compiledAt: row?.compiled_at ?? null,
      };
    });
  return { councilId, canKeep: input.canKeep, cards };
}
