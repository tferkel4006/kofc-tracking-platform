// =========================================================================
// SUPREME NEW-MEMBER ONBOARDING (Sprint 6B Patch)
// Pure helpers behind supreme.syncSupremeRoster, the welcome email that follows every new member row, and the
// 'New Member' badge: the 180-day badge rule, the one-time setup code (format, normalising, hashing, lifetime), the
// SendGrid v3 mail/send request a welcome email becomes, and the reading and checking of Supreme's roster export.
// Drivers load rows, call these, then only store.
// =========================================================================
import type { SupremeRosterRow } from './contract';
import { csvRecords } from './finance';
import type { EmailPayload } from './notifications';
import {
  assertIsoDate,
  BusinessRuleError,
  cleanNewMember,
  describeActor,
  hasAdminRights,
  hasSuperAdminRights,
  SecurityPrivilegeError,
  toIsoDate,
  type MemberWriteActor,
} from './rules';
import type { Member } from './types';
import type { NewMember } from './contract';

const invalid = (message: string, details: Record<string, unknown> = {}) => new BusinessRuleError('INVALID_INPUT', message, details);

// ---- the New Member badge --------------------------------------------------------------

/** How many days, the join day being day 1, a member carries the New Member badge; it is gone on day 181. */
export const NEW_MEMBER_BADGE_DAYS = 180;
/** The badge as rosters, roll calls and shift rosters print it. */
export const NEW_MEMBER_BADGE_LABEL = '🆕 New Member';

/** Whole calendar days from `joined` (YYYY-MM-DD) to `today`; null for a missing or malformed date. */
export function daysSinceJoined(joined: string | null | undefined, today: Date | string): number | null {
  const m = typeof joined === 'string' ? /^(\d{4})-(\d{2})-(\d{2})/.exec(joined) : null;
  if (!m) return null;
  const todayIso = typeof today === 'string' ? today.slice(0, 10) : toIsoDate(today);
  const [ty, tm, td] = todayIso.split('-').map(Number) as [number, number, number];
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))) / 86_400_000);
}

/**
 * The member is in their first NEW_MEMBER_BADGE_DAYS days on the council: the join day is day 1 and day 180 the last
 * with the badge (0 to 179 days after joining). A member with no join date, or one dated after today, has none.
 */
export function isNewMember(member: Pick<Member, 'DateJoinedCouncil'> | null | undefined, today: Date | string): boolean {
  const days = daysSinceJoined(member?.DateJoinedCouncil, today);
  return days !== null && days >= 0 && days < NEW_MEMBER_BADGE_DAYS;
}

/** `name` followed by '[🆕 New Member]' while the badge lasts - for text-only places such as a drop-down's options. */
export const withNewMemberBadge = (name: string, member: Pick<Member, 'DateJoinedCouncil'> | null | undefined, today: Date | string): string =>
  isNewMember(member, today) ? `${name} [${NEW_MEMBER_BADGE_LABEL}]` : name;

// ---- the one-time setup code -------------------------------------------------------------

/** How long a welcome email's setup code works. */
export const ENROLLMENT_CODE_LIFETIME_DAYS = 14;

/** Crockford base 32: no I, L, O or U, so a code read aloud or typed on a phone is hard to get wrong. */
const CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const CODE_LENGTH = 20;

/** A setup code from random bytes (at least CODE_LENGTH): 20 characters (100 bits) in four groups, 'K7Q2M-...'. */
export function formatEnrollmentCode(bytes: Uint8Array): string {
  if (bytes.length < CODE_LENGTH) throw new Error(`A setup code needs ${CODE_LENGTH} random bytes.`);
  const chars = Array.from(bytes.slice(0, CODE_LENGTH), (b) => CODE_ALPHABET[b % 32]).join('');
  return chars.match(/.{5}/g)!.join('-');
}

/** A typed code as stored: upper case, no spaces or dashes, the look-alike letters read as Crockford does. */
export const normalizeEnrollmentCode = (code: string): string =>
  code
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');

/** What a driver hashes (SHA-256) into MemberEnrollmentToken.TokenHash. */
export const enrollmentCodeHashInput = (code: string): string => `kofc-enroll:${normalizeEnrollmentCode(code)}`;

/** 'YYYY-MM-DD HH:MM:SS' UTC, ENROLLMENT_CODE_LIFETIME_DAYS after `issuedAt`. */
export const enrollmentCodeExpiry = (issuedAt: Date): string =>
  new Date(issuedAt.getTime() + ENROLLMENT_CODE_LIFETIME_DAYS * 86_400_000).toISOString().slice(0, 19).replace('T', ' ');

/** A token row is usable at `now`: unspent and not expired. */
export const isEnrollmentTokenUsable = (token: { ExpiresAt: string; ConsumedAt?: string | null }, now: Date): boolean =>
  token.ConsumedAt == null && Date.parse(`${token.ExpiresAt.replace(' ', 'T')}Z`) > now.getTime();

export const enrollmentCodeInvalid = (): BusinessRuleError =>
  new BusinessRuleError('ENROLLMENT_CODE_INVALID', 'That setup code is not valid for this email, has already been used, or has expired. Ask your council admin for a new one.');

// ---- SendGrid ------------------------------------------------------------------------------

export const SENDGRID_MAIL_SEND_URL = 'https://api.sendgrid.com/v3/mail/send';
/** What the request carries in place of the real key wherever it is logged or built outside the server. */
export const SENDGRID_KEY_PLACEHOLDER = '[SENDGRID_API_KEY]';

/** A SendGrid v3 mail/send call. */
export interface SendGridMailRequest {
  method: 'POST';
  url: typeof SENDGRID_MAIL_SEND_URL;
  headers: { Authorization: string; 'Content-Type': 'application/json' };
  body: {
    personalizations: { to: { email: string }[] }[];
    from: { email: string };
    subject: string;
    content: { type: 'text/plain'; value: string }[];
    attachments?: { content: string; filename: string; type: string; disposition: 'attachment' }[];
  };
}

/** Base64 of a UTF-8 string, without Node's Buffer (the apps run in browsers and React Native). */
function base64Utf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

/** An email packet as a SendGrid v3 mail/send request; the key stays the placeholder unless the server supplies it. */
export function buildSendGridMailRequest(email: EmailPayload, apiKey: string = SENDGRID_KEY_PLACEHOLDER): SendGridMailRequest {
  return {
    method: 'POST',
    url: SENDGRID_MAIL_SEND_URL,
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: {
      personalizations: [{ to: [{ email: email.to }] }],
      from: { email: email.from },
      subject: email.subject,
      content: [{ type: 'text/plain', value: email.text }],
      ...(email.attachments.length
        ? {
            attachments: email.attachments.map((a) => ({ content: base64Utf8(a.content), filename: a.filename, type: a.contentType, disposition: 'attachment' as const })),
          }
        : {}),
    },
  };
}

// ---- Supreme's roster ------------------------------------------------------------------------

/** Who brings Supreme's roster in: the council's Active Admins, or an Active Super Admin. */
export function assertMayImportSupremeRoster(actor: MemberWriteActor, councilId: number): void {
  if (hasSuperAdminRights(actor)) return;
  if (!hasAdminRights(actor)) {
    throw new SecurityPrivilegeError(
      'ADMIN_REQUIRED',
      `Only an active Admin of the council or a Super Admin can bring in Supreme's roster; member ${actor.memberId} is ${describeActor(actor)}.`,
      { actorId: actor.memberId, councilId },
    );
  }
  if (actor.councilId === councilId) return;
  throw new SecurityPrivilegeError(
    'COUNCIL_ACCESS_DENIED',
    `Member ${actor.memberId} of council ${actor.councilId} cannot bring in the roster of council ${councilId}.`,
    { actorId: actor.memberId, actorCouncilId: actor.councilId, councilId },
  );
}

/** The roster export's columns, by their header with case, spaces and punctuation ignored. */
const ROSTER_HEADERS: Record<string, keyof SupremeRosterRow> = {
  membernumber: 'MemberNumber',
  member: 'MemberNumber',
  firstname: 'MemberFirstName',
  lastname: 'MemberLastName',
  email: 'Email',
  phone: 'Phone',
  street: 'StreetAddress1',
  address: 'StreetAddress1',
  streetaddress: 'StreetAddress1',
  street2: 'StreetAddress2',
  address2: 'StreetAddress2',
  city: 'City',
  state: 'State',
  zip: 'ZipCode',
  zipcode: 'ZipCode',
  birthdate: 'DateOfBirth',
  dateofbirth: 'DateOfBirth',
  degree: 'DegreeID',
  datejoined: 'DateJoinedCouncil',
  datejoinedcouncil: 'DateJoinedCouncil',
  joined: 'DateJoinedCouncil',
};
const rosterHeaderKey = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, '');
const REQUIRED_ROSTER_COLUMNS: (keyof SupremeRosterRow)[] = ['MemberNumber', 'MemberFirstName', 'MemberLastName', 'Email', 'DateJoinedCouncil'];

/**
 * Supreme's roster export (CSV with a header row) as SupremeRosterRow values: Member Number, First Name, Last Name,
 * Email, Phone, Street, Street 2, City, State, Zip, Birth Date, Degree, Date Joined (header case and spacing ignored).
 * Numbers are read as numbers; blank cells stay ''. Rejects INVALID_INPUT for a file without the member number, names,
 * email and join date columns. Each row is checked when it is synced (cleanSupremeRosterRow).
 */
export function parseSupremeRosterCsv(csv: unknown): SupremeRosterRow[] {
  if (typeof csv !== 'string' || csv.trim() === '') throw invalid('The roster file is empty.');
  const [header, ...data] = csvRecords(csv, 'The roster file').filter((r) => r.fields.some((f) => f.trim() !== ''));
  if (!header) throw invalid('The roster file is empty.');
  const columns = header.fields.map((h) => ROSTER_HEADERS[rosterHeaderKey(h)]);
  const missing = REQUIRED_ROSTER_COLUMNS.filter((c) => !columns.includes(c));
  if (missing.length) throw invalid(`The roster file needs these columns: ${missing.join(', ')}.`, { missing });
  return data.map(({ fields }) => {
    const row: Record<string, unknown> = {};
    columns.forEach((col, i) => {
      if (!col) return;
      const cell = (fields[i] ?? '').trim();
      row[col] = col === 'MemberNumber' || col === 'DegreeID' ? (cell === '' ? null : Number(cell)) : cell;
    });
    return row as unknown as SupremeRosterRow;
  });
}

/**
 * One roster row as the new member it would create in `councilId` (Active, MemberType 'Member', the First Degree when
 * none is given), checked as members.create checks it, plus a required join date. Throws INVALID_INPUT or INVALID_DATE.
 */
export function cleanSupremeRosterRow(
  row: SupremeRosterRow,
  councilId: number,
  ids: { activeStatusId: number; memberTypeId: number },
  now: Date,
): NewMember {
  const joined = assertIsoDate(row?.DateJoinedCouncil, 'Date joined council');
  const degree = row.DegreeID == null ? 1 : row.DegreeID;
  if (!Number.isInteger(degree) || degree < 1 || degree > 4) throw invalid(`Degree must be 1 to 4; received ${String(row.DegreeID)}.`, { degree: row.DegreeID });
  return cleanNewMember(
    {
      CouncilID: councilId,
      MemberNumber: row.MemberNumber,
      MemberFirstName: row.MemberFirstName,
      MemberLastName: row.MemberLastName,
      Phone: row.Phone,
      StreetAddress1: row.StreetAddress1,
      StreetAddress2: row.StreetAddress2 || undefined,
      City: row.City,
      State: row.State,
      ZipCode: row.ZipCode,
      Email: row.Email,
      DateOfBirth: row.DateOfBirth,
      StatusID: ids.activeStatusId,
      DegreeID: degree,
      MemberTypeID: ids.memberTypeId,
      DateJoinedCouncil: joined,
    },
    now,
  );
}

/** A roster row's member number, when it has a usable one. */
export const rosterMemberNumber = (row: Pick<SupremeRosterRow, 'MemberNumber'>): number | null =>
  typeof row?.MemberNumber === 'number' && Number.isInteger(row.MemberNumber) && row.MemberNumber > 0 ? row.MemberNumber : null;

/** A roster row's join date for a member already on the roster: a real date, not in the future (INVALID_INPUT/INVALID_DATE). */
export function cleanRosterJoinDate(value: unknown, now: Date): string {
  const joined = assertIsoDate(value, 'Date joined council');
  if (joined > toIsoDate(now)) throw invalid(`Date joined council ${joined} cannot be in the future.`, { dateJoinedCouncil: joined });
  return joined;
}

/** The default way a driver sends an email (Sprint 6B Patch): print the SendGrid request it would make, key withheld. */
export const logSendGridRequest =
  (log: (...args: unknown[]) => void) =>
  async (request: SendGridMailRequest): Promise<void> => {
    log('[notification]', JSON.stringify({ transport: 'sendgrid (simulated)', request }, null, 2));
  };
