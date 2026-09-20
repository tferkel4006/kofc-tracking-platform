// SQLite driver for the mobile app (expo-sqlite).
// The schema and seed statements are generated from Schema.sql / Seed.sql by
// scripts/gen-db-assets.mjs. Nothing outside /services may import this file.
import * as SQLite from 'expo-sqlite';
import {
  assertActivityDateAllowed,
  assertEventRange,
  assertLookupKeyUnique,
  assertLookupNotProtected,
  assertLookupUnused,
  assertPasswordAcceptable,
  assertShiftHasRoom,
  assertShiftInsideEvent,
  assertShiftReportAllowed,
  assertText,
  assertThreadParticipant,
  assertValidHours,
  buildThreadMessages,
  buildThreadSummaries,
  BusinessRuleError,
  cleanCouncilIds,
  cleanEventFields,
  cleanLookupValues,
  cleanNewEvent,
  cleanNewShift,
  cleanShiftFields,
  EVENT_COLUMNS,
  isSha256Hex,
  LOOKUP_META,
  participantIds,
  planEventCopy,
  SHIFT_COLUMNS,
  toTimestamp,
  UNREGISTERED_PASSWORD,
  type MessagingRows,
} from '@kofc/shared';
import type {
  Activities,
  ActivityTime,
  ChatThread,
  Council,
  DataService,
  Event as CouncilEvent,
  EventChanges,
  EventSignup,
  EventTime,
  LessonsLearned,
  LookupRowMap,
  LookupTableName,
  LookupValues,
  Meeting,
  MeetingInvites,
  MeetingInviteMode,
  Member,
  MemberShift,
  Message,
  MessageAttachment,
  MessagePageOptions,
  NewEvent,
  NewMeeting,
  ReadReceipt,
  Role,
  SessionUser,
  Shift,
  ShiftChanges,
  ShiftFeedItem,
} from '@kofc/shared';
import { SCHEMA_STATEMENTS, SEED_STATEMENTS } from '../generated/schema.sqlite';
import { sha256Hex } from '../password';
import {
  buildDevEvents,
  buildDevExtraEvents,
  buildDevMeetings,
  buildDevMessaging,
  DEV_ACTIVITY,
  DEV_AFFILIATED_COUNCIL,
  DEV_COUNCIL_NUMBER,
  DEV_UNAFFILIATED_COUNCIL,
  DEV_UNREGISTERED_MEMBER,
  toIsoDate,
  type DevMeetingTypeName,
} from '../seed-dev';

const DB_NAME = 'kofc.db';
/** Bump when Schema.sql changes; stored in PRAGMA user_version. Migrations are a later concern. */
const SCHEMA_VERSION = 1;

/** Allow-list for the one place a table name is interpolated into SQL. Exhaustive by construction. */
const LOOKUP_TABLES: Record<LookupTableName, true> = {
  MemberStatus: true,
  Degree: true,
  MemberType: true,
  Role: true,
  NoShowReason: true,
  Category: true,
  LessonsLearnedCategory: true,
  MeetingType: true,
};

/** Credentials.Password holds a SHA-256 hex digest; a not-yet-registered member's placeholder never matches. */
const passwordMatches = async (stored: string, supplied: string) =>
  stored !== UNREGISTERED_PASSWORD && stored === (await sha256Hex(supplied));

const SIGN_IN_SELECT = `
  SELECT c.[id] AS credentialId, c.[Password] AS password, c.[Username] AS username,
         m.[id] AS memberId, m.[CouncilID] AS councilId,
         m.[MemberFirstName] AS firstName, m.[MemberLastName] AS lastName,
         t.[Type] AS memberType
    FROM [Credentials] c
    JOIN [Member] m ON m.[CredentialID] = c.[id]
    JOIN [MemberType] t ON t.[id] = m.[MemberTypeID]`;

const ACTIVE_MEMBER_FILTER = `
  m.[CouncilID] = ?
  AND m.[StatusID] = (SELECT [id] FROM [MemberStatus] WHERE [Status] = 'Active')`;

interface SignInRow {
  credentialId: number;
  password: string;
  username: string;
  memberId: number;
  councilId: number;
  firstName: string;
  lastName: string;
  memberType: SessionUser['memberType'];
}

/** Longest `IN (...)` list sent in one statement; SQLite caps the number of bound variables. */
const IN_CHUNK = 500;
const marks = (n: number) => Array.from({ length: n }, () => '?').join(', ');

/** Runs `sql(marks)` for slices of `ids` so a long id list never exceeds the variable limit. */
async function selectIn<T>(
  db: SQLite.SQLiteDatabase,
  sql: (marks: string) => string,
  ids: readonly number[],
): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    const slice = ids.slice(i, i + IN_CHUNK);
    out.push(...(await db.getAllAsync<T>(sql(marks(slice.length)), slice)));
  }
  return out;
}

type Bind = string | number | null;

export interface SqliteDataServiceOptions {
  /** Clock used for seeding and the history-window rules. Tests pin it. Default: real time. */
  now?: () => Date;
}

export class SqliteDataService implements DataService {
  private opening: Promise<SQLite.SQLiteDatabase> | null = null;
  private readonly now: () => Date;

  constructor(options: SqliteDataServiceOptions = {}) {
    this.now = options.now ?? (() => new Date());
  }

  // ---- lifecycle ---------------------------------------------------------

  async init(): Promise<void> {
    await this.ready();
  }

  async reset(): Promise<void> {
    const opening = this.opening;
    this.opening = null;
    if (opening) {
      try {
        await (await opening).closeAsync();
      } catch {
        // a failed open has nothing to close
      }
    }
    await SQLite.deleteDatabaseAsync(DB_NAME);
    await this.init();
  }

  private ready(): Promise<SQLite.SQLiteDatabase> {
    if (!this.opening) {
      this.opening = this.open().catch((err) => {
        this.opening = null; // let the next call retry
        throw err;
      });
    }
    return this.opening;
  }

  private async open(): Promise<SQLite.SQLiteDatabase> {
    const db = await SQLite.openDatabaseAsync(DB_NAME);
    // Must be set per connection, and cannot be changed inside a transaction.
    await db.execAsync('PRAGMA foreign_keys = ON;');
    const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    if ((row?.user_version ?? 0) < SCHEMA_VERSION) await this.createAndSeed(db);
    return db;
  }

  /** First launch: schema + Seed.sql + dev meetings, all-or-nothing. */
  private async createAndSeed(db: SQLite.SQLiteDatabase): Promise<void> {
    await db.withTransactionAsync(async () => {
      for (const statement of SCHEMA_STATEMENTS) await db.execAsync(statement);
      for (const statement of SEED_STATEMENTS) await db.execAsync(statement);
      await this.hashSeededPasswords(db);
      await this.seedDevMemberAndActivity(db);
      await this.seedDevMeetings(db);
      await this.seedDevEvents(db);
      await this.seedDevExtras(db);
      await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION};`);
    });
  }

  private async seedDevMeetings(db: SQLite.SQLiteDatabase): Promise<void> {
    const council = await db.getFirstAsync<{ id: number }>(
      'SELECT [id] FROM [Council] WHERE [CouncilNumber] = ?',
      [DEV_COUNCIL_NUMBER],
    );
    if (!council) throw new Error(`Seed.sql did not create Council ${DEV_COUNCIL_NUMBER}`);
    const types = await db.getAllAsync<{ id: number; Type: DevMeetingTypeName }>('SELECT [id], [Type] FROM [MeetingType]');
    const typeIds = Object.fromEntries(types.map((t) => [t.Type, t.id])) as Record<DevMeetingTypeName, number>;
    for (const { meeting, invite } of buildDevMeetings(council.id, typeIds, this.now())) {
      await this.insertMeeting(db, meeting, invite);
    }
  }

  /** Seed.sql stores dev passwords in plaintext; hash them so signIn only ever sees digests. */
  private async hashSeededPasswords(db: SQLite.SQLiteDatabase): Promise<void> {
    const rows = await db.getAllAsync<{ id: number; Password: string }>('SELECT [id], [Password] FROM [Credentials]');
    for (const { id, Password } of rows) {
      if (Password === UNREGISTERED_PASSWORD || isSha256Hex(Password)) continue;
      await db.runAsync('UPDATE [Credentials] SET [Password] = ? WHERE [id] = ?', [await sha256Hex(Password), id]);
    }
  }

  /** A pre-provisioned member with a placeholder Credentials row, plus one council activity. */
  private async seedDevMemberAndActivity(db: SQLite.SQLiteDatabase): Promise<void> {
    const council = await db.getFirstAsync<{ id: number }>('SELECT [id] FROM [Council] WHERE [CouncilNumber] = ?', [
      DEV_COUNCIL_NUMBER,
    ]);
    const template = council
      ? await db.getFirstAsync<{ DegreeID: number }>(
          'SELECT [DegreeID] FROM [Member] WHERE [CouncilID] = ? ORDER BY [id] LIMIT 1',
          [council.id],
        )
      : null;
    if (!council || !template) throw new Error(`Seed.sql did not create Council ${DEV_COUNCIL_NUMBER} with members`);
    const m = DEV_UNREGISTERED_MEMBER;
    const cred = await db.runAsync('INSERT INTO [Credentials] ([Username], [Password]) VALUES (?, ?)', [
      m.Email,
      UNREGISTERED_PASSWORD,
    ]);
    await db.runAsync(
      `INSERT INTO [Member] ([CouncilID], [MemberNumber], [MemberFirstName], [MemberLastName], [Phone],
                             [StreetAddress1], [City], [State], [ZipCode], [Email], [DateOfBirth],
                             [StatusID], [DegreeID], [MemberTypeID], [CredentialID])
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
               (SELECT [id] FROM [MemberStatus] WHERE [Status] = 'Active'), ?,
               (SELECT [id] FROM [MemberType] WHERE [Type] = 'Member'), ?)`,
      [
        council.id,
        m.MemberNumber,
        m.MemberFirstName,
        m.MemberLastName,
        m.Phone,
        m.StreetAddress1,
        m.City,
        m.State,
        m.ZipCode,
        m.Email,
        m.DateOfBirth,
        template.DegreeID,
        cred.lastInsertRowId,
      ],
    );
    await db.runAsync(
      `INSERT INTO [Activities] ([ActivityName], [ActivityDescription], [CategoryID], [CouncilID])
       VALUES (?, ?, (SELECT [id] FROM [Category] WHERE [Category] = 'Service'), ?)`,
      [DEV_ACTIVITY.ActivityName, DEV_ACTIVITY.ActivityDescription, council.id],
    );
  }

  private async seedDevEvents(db: SQLite.SQLiteDatabase): Promise<void> {
    const council = await db.getFirstAsync<{ id: number }>('SELECT [id] FROM [Council] WHERE [CouncilNumber] = ?', [
      DEV_COUNCIL_NUMBER,
    ]);
    const owner = await db.getFirstAsync<{ id: number }>('SELECT [id] FROM [Member] WHERE [Email] = ?', [
      'testadmin@kofc.org',
    ]);
    const category = await db.getFirstAsync<{ id: number }>('SELECT [id] FROM [Category] WHERE [Category] = ?', [
      'Service',
    ]);
    if (!council || !owner || !category) throw new Error('Seed.sql is missing the test council, admin or Service category');
    for (const { event, shifts } of buildDevEvents(this.now())) {
      const ev = await db.runAsync(
        `INSERT INTO [Event] ([EventName], [EventDescription], [OwnerID], [StartDate], [EndDate], [Location], [CategoryID])
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [event.EventName, event.EventDescription, owner.id, event.StartDate, event.EndDate, event.Location, category.id],
      );
      await db.runAsync('INSERT INTO [EventCouncils] ([EventID], [CouncilID]) VALUES (?, ?)', [
        ev.lastInsertRowId,
        council.id,
      ]);
      for (const { shift, signedUp } of shifts) {
        const sh = await db.runAsync(
          `INSERT INTO [Shift] ([ShiftName], [ShiftDescription], [ShiftDate], [StartTime], [EndTime], [EventID],
                                [MinNumberVolunteers], [NumberVolunteersSignedUp])
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            shift.ShiftName,
            shift.ShiftDescription,
            shift.ShiftDate,
            shift.StartTime,
            shift.EndTime,
            ev.lastInsertRowId,
            shift.MinNumberVolunteers,
            signedUp.length,
          ],
        );
        for (const email of signedUp) {
          await db.runAsync(
            'INSERT INTO [EventSignup] ([ShiftID], [MemberID], [NoShow]) VALUES (?, (SELECT [id] FROM [Member] WHERE [Email] = ?), 0)',
            [sh.lastInsertRowId, email],
          );
        }
      }
    }
  }

  // ---- auth --------------------------------------------------------------

  auth: DataService['auth'] = {
    signIn: async (username, password) => {
      const db = await this.ready();
      const row = await db.getFirstAsync<SignInRow>(`${SIGN_IN_SELECT} WHERE c.[Username] = ? COLLATE NOCASE`, [username]);
      if (!row || !(await passwordMatches(row.password, password))) return null;
      return this.buildSession(db, row);
    },

    signUp: async (email, password) => {
      assertPasswordAcceptable(password);
      const hash = await sha256Hex(password);
      const db = await this.ready();
      let credentialId = 0;
      await db.withTransactionAsync(async () => {
        const member = await db.getFirstAsync<{ id: number; Email: string; CredentialID: number }>(
          'SELECT [id], [Email], [CredentialID] FROM [Member] WHERE [Email] = ? COLLATE NOCASE',
          [email.trim()],
        );
        if (!member) {
          throw new BusinessRuleError(
            'MEMBER_NOT_FOUND',
            `No member record has the email ${email.trim()}. Contact your council admin to be added.`,
            { email },
          );
        }
        // The WHERE clause makes claiming the placeholder atomic: a second signUp changes nothing.
        const res = await db.runAsync(
          'UPDATE [Credentials] SET [Password] = ?, [Username] = ? WHERE [id] = ? AND [Password] = ?',
          [hash, member.Email, member.CredentialID, UNREGISTERED_PASSWORD],
        );
        if (res.changes === 0) {
          const cred = await db.getFirstAsync<{ id: number }>('SELECT [id] FROM [Credentials] WHERE [id] = ?', [
            member.CredentialID,
          ]);
          throw cred
            ? new BusinessRuleError('ALREADY_REGISTERED', `${member.Email} has already registered. Sign in instead.`, {
                memberId: member.id,
              })
            : new BusinessRuleError(
                'CREDENTIALS_MISSING',
                `Member ${member.id} has no Credentials row (CredentialID ${member.CredentialID}).`,
                { memberId: member.id },
              );
        }
        credentialId = member.CredentialID;
      });
      const row = await db.getFirstAsync<SignInRow>(`${SIGN_IN_SELECT} WHERE c.[id] = ?`, [credentialId]);
      return this.buildSession(db, row!);
    },
  };

  private async buildSession(db: SQLite.SQLiteDatabase, row: SignInRow): Promise<SessionUser> {
    const roles = await this.rolesFor(db, row.memberId);
    return {
      credentialId: row.credentialId,
      memberId: row.memberId,
      councilId: row.councilId,
      username: row.username,
      firstName: row.firstName,
      lastName: row.lastName,
      memberType: row.memberType,
      roles: roles.map((r) => r.Role),
      isOfficer: roles.some((r) => r.Officer === 1),
    };
  }

  // ---- lookups / councils / members -------------------------------------

  lookups: DataService['lookups'] = {
    list: async <T extends LookupTableName>(table: T): Promise<LookupRowMap[T][]> => {
      if (!LOOKUP_TABLES[table]) throw new Error(`Unknown lookup table: ${String(table)}`);
      const db = await this.ready();
      return db.getAllAsync<LookupRowMap[T]>(`SELECT * FROM [${table}] ORDER BY [id]`);
    },
    create: async <T extends LookupTableName>(table: T, values: LookupValues): Promise<LookupRowMap[T]> => {
      if (!LOOKUP_TABLES[table]) throw new Error(`Unknown lookup table: ${String(table)}`);
      const cleaned = cleanLookupValues(table, values);
      const cols = LOOKUP_META[table].fields.map((f) => f.key);
      const db = await this.ready();
      let id = 0;
      await db.withTransactionAsync(async () => {
        assertLookupKeyUnique(table, await db.getAllAsync(`SELECT * FROM [${table}]`), cleaned);
        const res = await db.runAsync(
          `INSERT INTO [${table}] (${cols.map((c) => `[${c}]`).join(', ')}) VALUES (${marks(cols.length)})`,
          cols.map((c) => cleaned[c]),
        );
        id = res.lastInsertRowId;
      });
      return (await db.getFirstAsync<LookupRowMap[T]>(`SELECT * FROM [${table}] WHERE [id] = ?`, [id]))!;
    },

    update: async <T extends LookupTableName>(table: T, id: number, values: LookupValues): Promise<LookupRowMap[T]> => {
      if (!LOOKUP_TABLES[table]) throw new Error(`Unknown lookup table: ${String(table)}`);
      const cleaned = cleanLookupValues(table, values);
      const cols = LOOKUP_META[table].fields.map((f) => f.key);
      const db = await this.ready();
      await db.withTransactionAsync(async () => {
        const row = await this.requireLookupRow(db, table, id);
        assertLookupNotProtected(table, row, cleaned);
        assertLookupKeyUnique(table, await db.getAllAsync(`SELECT * FROM [${table}]`), cleaned, id);
        await db.runAsync(`UPDATE [${table}] SET ${cols.map((c) => `[${c}] = ?`).join(', ')} WHERE [id] = ?`, [
          ...cols.map((c) => cleaned[c]),
          id,
        ]);
      });
      return (await db.getFirstAsync<LookupRowMap[T]>(`SELECT * FROM [${table}] WHERE [id] = ?`, [id]))!;
    },

    remove: async (table, id) => {
      if (!LOOKUP_TABLES[table]) throw new Error(`Unknown lookup table: ${String(table)}`);
      const db = await this.ready();
      await db.withTransactionAsync(async () => {
        const row = await this.requireLookupRow(db, table, id);
        assertLookupNotProtected(table, row, null);
        const usage = [];
        for (const ref of LOOKUP_META[table].references) {
          const found = await db.getFirstAsync<{ n: number }>(
            `SELECT COUNT(*) AS n FROM [${ref.table}] WHERE [${ref.column}] = ?`,
            [id],
          );
          usage.push({ ...ref, count: found?.n ?? 0 });
        }
        assertLookupUnused(table, row, usage);
        await db.runAsync(`DELETE FROM [${table}] WHERE [id] = ?`, [id]);
      });
    },
  };

  private async requireLookupRow(
    db: SQLite.SQLiteDatabase,
    table: LookupTableName,
    id: number,
  ): Promise<Record<string, unknown>> {
    const row = await db.getFirstAsync<Record<string, unknown>>(`SELECT * FROM [${table}] WHERE [id] = ?`, [id]);
    if (!row) {
      throw new BusinessRuleError('INVALID_INPUT', `${LOOKUP_META[table].label} ${id} does not exist.`, { table, id });
    }
    return row;
  }

  councils: DataService['councils'] = {
    list: async () => {
      const db = await this.ready();
      return db.getAllAsync<Council>('SELECT * FROM [Council] ORDER BY [CouncilNumber], [CouncilName]');
    },
    get: async (id) => {
      const db = await this.ready();
      return (await db.getFirstAsync<Council>('SELECT * FROM [Council] WHERE [id] = ?', [id])) ?? null;
    },
    listAffiliated: async (councilId) => {
      const db = await this.ready();
      return db.getAllAsync<Council>(
        `SELECT * FROM [Council]
          WHERE [id] <> ?
            AND [id] IN (SELECT [AffiliatedCouncilID] FROM [AffiliatedCouncils] WHERE [PrimaryCouncilID] = ?
                         UNION
                         SELECT [PrimaryCouncilID] FROM [AffiliatedCouncils] WHERE [AffiliatedCouncilID] = ?)
          ORDER BY [CouncilNumber], [CouncilName]`,
        [councilId, councilId, councilId],
      );
    },
  };

  activities: DataService['activities'] = {
    listByCouncil: async (councilId) => {
      const db = await this.ready();
      return db.getAllAsync<Activities>('SELECT * FROM [Activities] WHERE [CouncilID] = ? ORDER BY [ActivityName], [id]', [
        councilId,
      ]);
    },
  };

  members: DataService['members'] = {
    get: async (id) => {
      const db = await this.ready();
      return (await db.getFirstAsync<Member>('SELECT * FROM [Member] WHERE [id] = ?', [id])) ?? null;
    },
    getByEmail: async (email) => {
      const db = await this.ready();
      return (
        (await db.getFirstAsync<Member>('SELECT * FROM [Member] WHERE [Email] = ? COLLATE NOCASE', [email])) ?? null
      );
    },
    listByCouncil: async (councilId, options) => {
      const db = await this.ready();
      const active = options?.activeOnly
        ? " AND [StatusID] = (SELECT [id] FROM [MemberStatus] WHERE [Status] = 'Active')"
        : '';
      return db.getAllAsync<Member>(
        `SELECT * FROM [Member] WHERE [CouncilID] = ?${active} ORDER BY [MemberLastName], [MemberFirstName]`,
        [councilId],
      );
    },
    listRoles: async (memberId) => this.rolesFor(await this.ready(), memberId),
  };

  private rolesFor(db: SQLite.SQLiteDatabase, memberId: number): Promise<Role[]> {
    return db.getAllAsync<Role>(
      `SELECT r.* FROM [MemberRoles] mr JOIN [Role] r ON r.[id] = mr.[RoleID]
        WHERE mr.[MemberID] = ? ORDER BY r.[id]`,
      [memberId],
    );
  }

  // ---- events, shifts and time logs -------------------------------------

  events: DataService['events'] = {
    get: async (id) => {
      const db = await this.ready();
      return (await db.getFirstAsync<CouncilEvent>('SELECT * FROM [Event] WHERE [id] = ?', [id])) ?? null;
    },

    getShift: async (id) => {
      const db = await this.ready();
      return (await db.getFirstAsync<Shift>('SELECT * FROM [Shift] WHERE [id] = ?', [id])) ?? null;
    },

    listShiftsBetween: async (fromDate, toDate) => {
      const db = await this.ready();
      return db.getAllAsync<Shift>(
        'SELECT * FROM [Shift] WHERE [ShiftDate] BETWEEN ? AND ? ORDER BY [ShiftDate], [StartTime], [id]',
        [fromDate, toDate],
      );
    },

    listSignups: async (shiftId) => {
      const db = await this.ready();
      return db.getAllAsync<EventSignup>('SELECT * FROM [EventSignup] WHERE [ShiftID] = ? ORDER BY [id]', [shiftId]);
    },

    signupForShift: async (memberId, shiftId) => {
      const db = await this.ready();
      let signupId = 0;
      await db.withTransactionAsync(async () => {
        const shift = await this.requireShift(db, shiftId);
        await this.requireMember(db, memberId);
        const dup = await db.getFirstAsync<{ id: number }>(
          'SELECT [id] FROM [EventSignup] WHERE [ShiftID] = ? AND [MemberID] = ?',
          [shiftId, memberId],
        );
        if (dup) {
          throw new BusinessRuleError(
            'ALREADY_SIGNED_UP',
            `Member ${memberId} is already signed up for shift "${shift.ShiftName}" (id ${shiftId}).`,
            { memberId, shiftId },
          );
        }
        assertShiftHasRoom(shift);
        // The WHERE clause re-checks the cap in the same statement, so two racing signups cannot both take the last seat.
        const res = await db.runAsync(
          `UPDATE [Shift] SET [NumberVolunteersSignedUp] = [NumberVolunteersSignedUp] + 1
            WHERE [id] = ? AND [NumberVolunteersSignedUp] < [MinNumberVolunteers]`,
          [shiftId],
        );
        if (res.changes === 0) {
          assertShiftHasRoom(await this.requireShift(db, shiftId));
          throw new Error(`Could not reserve a seat on shift ${shiftId}`);
        }
        const ins = await db.runAsync('INSERT INTO [EventSignup] ([ShiftID], [MemberID], [NoShow]) VALUES (?, ?, 0)', [
          shiftId,
          memberId,
        ]);
        signupId = ins.lastInsertRowId;
      });
      return (await db.getFirstAsync<EventSignup>('SELECT * FROM [EventSignup] WHERE [id] = ?', [signupId]))!;
    },

    listMemberShifts: async (memberId, range) => {
      const db = await this.ready();
      const shifts = await db.getAllAsync<Shift>(
        `SELECT s.* FROM [Shift] s
          WHERE s.[ShiftDate] BETWEEN ? AND ?
            AND EXISTS (SELECT 1 FROM [EventSignup] es WHERE es.[ShiftID] = s.[id] AND es.[MemberID] = ?)
          ORDER BY s.[ShiftDate], s.[StartTime], s.[id]`,
        [range?.fromDate ?? '0000-01-01', range?.toDate ?? '9999-12-31', memberId],
      );
      if (shifts.length === 0) return [];
      const signups = new Map(
        (await db.getAllAsync<EventSignup>('SELECT * FROM [EventSignup] WHERE [MemberID] = ?', [memberId])).map((e) => [
          e.ShiftID,
          e,
        ]),
      );
      const events = new Map(
        (
          await selectIn<CouncilEvent>(
            db,
            (m) => `SELECT * FROM [Event] WHERE [id] IN (${m})`,
            [...new Set(shifts.map((s) => s.EventID))],
          )
        ).map((e) => [e.id, e]),
      );
      const hours = new Map(
        (
          await db.getAllAsync<{ ShiftID: number; Hours: number }>(
            'SELECT [ShiftID], [Hours] FROM [EventTime] WHERE [MemberID] = ?',
            [memberId],
          )
        ).map((t) => [t.ShiftID, t.Hours]),
      );
      const out: MemberShift[] = [];
      for (const shift of shifts) {
        const signup = signups.get(shift.id);
        const event = events.get(shift.EventID);
        if (signup && event) out.push({ signup, shift, event, hoursLogged: hours.get(shift.id) ?? null });
      }
      return out;
    },

    listShiftFeed: async ({ memberId, councilIds, fromDate, toDate }) => {
      if (councilIds.length === 0) return [];
      const db = await this.ready();
      const shifts = await db.getAllAsync<Shift>(
        `SELECT s.* FROM [Shift] s
          WHERE s.[ShiftDate] BETWEEN ? AND ?
            AND s.[EventID] IN (SELECT [EventID] FROM [EventCouncils] WHERE [CouncilID] IN (${marks(councilIds.length)}))
          ORDER BY s.[ShiftDate], s.[StartTime], s.[id]`,
        [fromDate, toDate, ...councilIds],
      );
      if (shifts.length === 0) return [];
      const eventIds = [...new Set(shifts.map((s) => s.EventID))];
      const events = new Map(
        (await selectIn<CouncilEvent>(db, (m) => `SELECT * FROM [Event] WHERE [id] IN (${m})`, eventIds)).map((e) => [e.id, e]),
      );
      const links = await selectIn<{ EventID: number; CouncilID: number }>(
        db,
        (m) => `SELECT [EventID], [CouncilID] FROM [EventCouncils] WHERE [EventID] IN (${m}) ORDER BY [CouncilID]`,
        eventIds,
      );
      const mine = new Set(
        (await db.getAllAsync<{ ShiftID: number }>('SELECT [ShiftID] FROM [EventSignup] WHERE [MemberID] = ?', [memberId])).map(
          (r) => r.ShiftID,
        ),
      );
      const out: ShiftFeedItem[] = [];
      for (const shift of shifts) {
        const event = events.get(shift.EventID);
        if (!event) continue;
        out.push({
          shift,
          event,
          councilIds: links.filter((l) => l.EventID === shift.EventID).map((l) => l.CouncilID),
          isSignedUp: mine.has(shift.id),
        });
      }
      return out;
    },

    countNoShows: async (memberId, sinceDate) => {
      const db = await this.ready();
      const row = await db.getFirstAsync<{ n: number }>(
        `SELECT COUNT(*) AS n FROM [EventSignup] es JOIN [Shift] s ON s.[id] = es.[ShiftID]
          WHERE es.[MemberID] = ? AND es.[NoShow] = 1 AND s.[ShiftDate] >= ?`,
        [memberId, sinceDate],
      );
      return row?.n ?? 0;
    },

    listByCouncil: async (councilId) => {
      const db = await this.ready();
      return db.getAllAsync<CouncilEvent>(
        `SELECT * FROM [Event] WHERE [id] IN (SELECT [EventID] FROM [EventCouncils] WHERE [CouncilID] = ?)
          ORDER BY [StartDate] DESC, [id] DESC`,
        [councilId],
      );
    },

    listShifts: async (eventId) => {
      const db = await this.ready();
      return db.getAllAsync<Shift>('SELECT * FROM [Shift] WHERE [EventID] = ? ORDER BY [ShiftDate], [StartTime], [id]', [
        eventId,
      ]);
    },

    listCouncilIds: async (eventId) => {
      const db = await this.ready();
      return this.councilIdsOf(db, eventId);
    },

    create: async (event, councilIds) => {
      const clean = cleanNewEvent(event);
      assertEventRange(clean.StartDate, clean.EndDate);
      const ids = cleanCouncilIds(councilIds);
      const db = await this.ready();
      let id = 0;
      await db.withTransactionAsync(async () => {
        id = await this.insertEventRow(db, clean, ids);
      });
      return this.requireEvent(db, id);
    },

    update: async (id, changes: EventChanges) => {
      const clean = cleanEventFields(changes);
      const db = await this.ready();
      await db.withTransactionAsync(async () => {
        const row = await this.requireEvent(db, id);
        assertEventRange(clean.StartDate ?? row.StartDate, clean.EndDate ?? row.EndDate);
        await this.assertOwnerAndCategory(db, clean);
        if (clean.StartDate !== undefined || clean.EndDate !== undefined) {
          const merged = { ...row, ...clean } as unknown as CouncilEvent;
          for (const sh of await db.getAllAsync<Shift>('SELECT * FROM [Shift] WHERE [EventID] = ?', [id])) {
            assertShiftInsideEvent(sh.ShiftDate, merged);
          }
        }
        const cols = EVENT_COLUMNS.filter((c) => clean[c] !== undefined);
        if (cols.length > 0) {
          await db.runAsync(`UPDATE [Event] SET ${cols.map((c) => `[${c}] = ?`).join(', ')} WHERE [id] = ?`, [
            ...cols.map((c) => clean[c] as Bind),
            id,
          ]);
        }
      });
      return this.requireEvent(db, id);
    },

    setCouncils: async (eventId, councilIds) => {
      const ids = cleanCouncilIds(councilIds);
      const db = await this.ready();
      await db.withTransactionAsync(async () => {
        await this.requireEvent(db, eventId);
        await this.assertCouncilsExist(db, ids);
        await db.runAsync('DELETE FROM [EventCouncils] WHERE [EventID] = ?', [eventId]);
        for (const councilId of ids) {
          await db.runAsync('INSERT INTO [EventCouncils] ([EventID], [CouncilID]) VALUES (?, ?)', [eventId, councilId]);
        }
      });
    },

    copy: async (eventId, options) => {
      const db = await this.ready();
      let id = 0;
      await db.withTransactionAsync(async () => {
        const original = await this.requireEvent(db, eventId);
        const shifts = await db.getAllAsync<Shift>('SELECT * FROM [Shift] WHERE [EventID] = ? ORDER BY [ShiftDate], [id]', [
          eventId,
        ]);
        const plan = planEventCopy(original, shifts, options);
        id = await this.insertEventRow(db, cleanNewEvent(plan.event), await this.councilIdsOf(db, eventId));
        for (const shift of plan.shifts) await this.insertShiftRow(db, id, shift);
      });
      return this.requireEvent(db, id);
    },

    createShift: async (shift) => {
      const clean = cleanNewShift(shift);
      const db = await this.ready();
      let id = 0;
      await db.withTransactionAsync(async () => {
        assertShiftInsideEvent(clean.ShiftDate, await this.requireEvent(db, clean.EventID));
        id = await this.insertShiftRow(db, clean.EventID, clean);
      });
      return this.requireShift(db, id);
    },

    updateShift: async (id, changes: ShiftChanges) => {
      const clean = cleanShiftFields(changes);
      const db = await this.ready();
      await db.withTransactionAsync(async () => {
        const row = await this.requireShift(db, id);
        if (clean.MinNumberVolunteers !== undefined && clean.MinNumberVolunteers < row.NumberVolunteersSignedUp) {
          throw new BusinessRuleError(
            'INVALID_INPUT',
            `Shift "${row.ShiftName}" already has ${row.NumberVolunteersSignedUp} volunteers signed up, so the volunteer target cannot be lowered to ${clean.MinNumberVolunteers}.`,
            { shiftId: id, signedUp: row.NumberVolunteersSignedUp, requested: clean.MinNumberVolunteers },
          );
        }
        if (clean.ShiftDate !== undefined) assertShiftInsideEvent(clean.ShiftDate, await this.requireEvent(db, row.EventID));
        const cols = SHIFT_COLUMNS.filter((c) => clean[c] !== undefined);
        if (cols.length > 0) {
          await db.runAsync(`UPDATE [Shift] SET ${cols.map((c) => `[${c}] = ?`).join(', ')} WHERE [id] = ?`, [
            ...cols.map((c) => clean[c] as Bind),
            id,
          ]);
        }
      });
      return this.requireShift(db, id);
    },

    deleteShift: async (id) => {
      const db = await this.ready();
      await db.withTransactionAsync(async () => {
        const row = await this.requireShift(db, id);
        const found = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM [EventSignup] WHERE [ShiftID] = ?', [id]);
        const signups = found?.n ?? 0;
        if (signups > 0) {
          throw new BusinessRuleError(
            'SHIFT_HAS_SIGNUPS',
            `Shift "${row.ShiftName}" (id ${id}) has ${signups} volunteer${signups === 1 ? '' : 's'} signed up and cannot be deleted.`,
            { shiftId: id, signups },
          );
        }
        await db.runAsync('DELETE FROM [Shift] WHERE [id] = ?', [id]);
      });
    },
  };

  private async councilIdsOf(db: SQLite.SQLiteDatabase, eventId: number): Promise<number[]> {
    const rows = await db.getAllAsync<{ CouncilID: number }>(
      'SELECT [CouncilID] FROM [EventCouncils] WHERE [EventID] = ? ORDER BY [CouncilID]',
      [eventId],
    );
    return rows.map((r) => r.CouncilID);
  }

  private async requireEvent(db: SQLite.SQLiteDatabase, eventId: number): Promise<CouncilEvent> {
    const event = await db.getFirstAsync<CouncilEvent>('SELECT * FROM [Event] WHERE [id] = ?', [eventId]);
    if (!event) throw new BusinessRuleError('EVENT_NOT_FOUND', `No event with id ${eventId}.`, { eventId });
    return event;
  }

  private async assertCouncilsExist(db: SQLite.SQLiteDatabase, ids: readonly number[]): Promise<void> {
    for (const id of ids) {
      if (!(await db.getFirstAsync('SELECT [id] FROM [Council] WHERE [id] = ?', [id]))) {
        throw new BusinessRuleError('INVALID_INPUT', `No council with id ${id}.`, { councilId: id });
      }
    }
  }

  /** Friendly errors for the two foreign keys the generic constraint message would explain poorly. */
  private async assertOwnerAndCategory(db: SQLite.SQLiteDatabase, fields: EventChanges): Promise<void> {
    if (fields.OwnerID != null) await this.requireMember(db, fields.OwnerID);
    if (
      fields.CategoryID != null &&
      !(await db.getFirstAsync('SELECT [id] FROM [Category] WHERE [id] = ?', [fields.CategoryID]))
    ) {
      throw new BusinessRuleError('INVALID_INPUT', `No event category with id ${fields.CategoryID}.`, {
        categoryId: fields.CategoryID,
      });
    }
  }

  private async insertEventRow(db: SQLite.SQLiteDatabase, event: NewEvent, councilIds: readonly number[]): Promise<number> {
    await this.assertOwnerAndCategory(db, event);
    await this.assertCouncilsExist(db, councilIds);
    const cols = EVENT_COLUMNS.filter((c) => event[c] !== undefined);
    const res = await db.runAsync(
      `INSERT INTO [Event] (${cols.map((c) => `[${c}]`).join(', ')}) VALUES (${marks(cols.length)})`,
      cols.map((c) => event[c] as Bind),
    );
    for (const councilId of councilIds) {
      await db.runAsync('INSERT INTO [EventCouncils] ([EventID], [CouncilID]) VALUES (?, ?)', [res.lastInsertRowId, councilId]);
    }
    return res.lastInsertRowId;
  }

  private async insertShiftRow(
    db: SQLite.SQLiteDatabase,
    eventId: number,
    shift: Omit<Shift, 'id' | 'EventID' | 'NumberVolunteersSignedUp'>,
  ): Promise<number> {
    const res = await db.runAsync(
      `INSERT INTO [Shift] ([ShiftName], [ShiftDescription], [ShiftDate], [StartTime], [EndTime], [EventID],
                            [MinNumberVolunteers], [NumberVolunteersSignedUp])
       VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
      [shift.ShiftName, shift.ShiftDescription ?? '', shift.ShiftDate, shift.StartTime, shift.EndTime, eventId, shift.MinNumberVolunteers],
    );
    return res.lastInsertRowId;
  }

  lessonsLearned: DataService['lessonsLearned'] = {
    list: async (eventId) => {
      const db = await this.ready();
      return db.getAllAsync<LessonsLearned>('SELECT * FROM [LessonsLearned] WHERE [EventID] = ? ORDER BY [id]', [eventId]);
    },

    add: async (eventId, categoryId, description) => {
      const text = assertText(description, 'Lesson learned', 255);
      const db = await this.ready();
      let id = 0;
      await db.withTransactionAsync(async () => {
        await this.requireEvent(db, eventId);
        if (!(await db.getFirstAsync('SELECT [id] FROM [LessonsLearnedCategory] WHERE [id] = ?', [categoryId]))) {
          throw new BusinessRuleError('INVALID_INPUT', `No lessons-learned category with id ${categoryId}.`, { categoryId });
        }
        const res = await db.runAsync(
          `INSERT INTO [LessonsLearned] ([EventID], [LeassonsLearnedCategoryID], [LessonsLearnedDescription]) VALUES (?, ?, ?)`,
          [eventId, categoryId, text],
        );
        id = res.lastInsertRowId;
      });
      return (await db.getFirstAsync<LessonsLearned>('SELECT * FROM [LessonsLearned] WHERE [id] = ?', [id]))!;
    },

    remove: async (id) => {
      const db = await this.ready();
      const res = await db.runAsync('DELETE FROM [LessonsLearned] WHERE [id] = ?', [id]);
      if (res.changes === 0) throw new BusinessRuleError('INVALID_INPUT', `No lesson learned with id ${id}.`, { id });
    },
  };

  eventTime: DataService['eventTime'] = {
    logHours: async (memberId, shiftId, hours, notes) => {
      assertValidHours(hours);
      const db = await this.ready();
      let timeId = 0;
      await db.withTransactionAsync(async () => {
        const shift = await this.requireShift(db, shiftId);
        await this.requireMember(db, memberId);
        assertShiftReportAllowed(shift.ShiftDate, this.now(), shiftId);
        const signup = await db.getFirstAsync<{ id: number }>(
          'SELECT [id] FROM [EventSignup] WHERE [ShiftID] = ? AND [MemberID] = ?',
          [shiftId, memberId],
        );
        if (!signup) {
          throw new BusinessRuleError(
            'NOT_SIGNED_UP',
            `Member ${memberId} never signed up for shift "${shift.ShiftName}" (id ${shiftId}), so no time can be logged against it.`,
            { memberId, shiftId },
          );
        }
        const existing = await db.getFirstAsync<{ id: number }>(
          'SELECT [id] FROM [EventTime] WHERE [ShiftID] = ? AND [MemberID] = ?',
          [shiftId, memberId],
        );
        if (existing) {
          await db.runAsync('UPDATE [EventTime] SET [Hours] = ?, [ShiftNotes] = ? WHERE [id] = ?', [
            hours,
            notes ?? null,
            existing.id,
          ]);
          timeId = existing.id;
        } else {
          const ins = await db.runAsync(
            'INSERT INTO [EventTime] ([ShiftID], [MemberID], [Hours], [ShiftNotes]) VALUES (?, ?, ?, ?)',
            [shiftId, memberId, hours, notes ?? null],
          );
          timeId = ins.lastInsertRowId;
        }
      });
      return (await db.getFirstAsync<EventTime>('SELECT * FROM [EventTime] WHERE [id] = ?', [timeId]))!;
    },
  };

  activityTime: DataService['activityTime'] = {
    logHours: async (memberId, activityId, hours, date, notes) => {
      assertValidHours(hours);
      assertActivityDateAllowed(date, this.now());
      const db = await this.ready();
      let timeId = 0;
      await db.withTransactionAsync(async () => {
        await this.requireMember(db, memberId);
        const activity = await db.getFirstAsync<{ id: number }>('SELECT [id] FROM [Activities] WHERE [id] = ?', [
          activityId,
        ]);
        if (!activity) throw new BusinessRuleError('ACTIVITY_NOT_FOUND', `No activity with id ${activityId}.`, { activityId });
        const ins = await db.runAsync(
          `INSERT INTO [ActivityTime] ([MemberID], [ActivityID], [ActivityDate], [Hours], [ActivityNotes])
           VALUES (?, ?, ?, ?, ?)`,
          [memberId, activityId, date, hours, notes ?? null],
        );
        timeId = ins.lastInsertRowId;
      });
      return (await db.getFirstAsync<ActivityTime>('SELECT * FROM [ActivityTime] WHERE [id] = ?', [timeId]))!;
    },
  };

  private async requireShift(db: SQLite.SQLiteDatabase, shiftId: number): Promise<Shift> {
    const shift = await db.getFirstAsync<Shift>('SELECT * FROM [Shift] WHERE [id] = ?', [shiftId]);
    if (!shift) throw new BusinessRuleError('SHIFT_NOT_FOUND', `No shift with id ${shiftId}.`, { shiftId });
    return shift;
  }

  private async requireMember(db: SQLite.SQLiteDatabase, memberId: number): Promise<void> {
    const member = await db.getFirstAsync<{ id: number }>('SELECT [id] FROM [Member] WHERE [id] = ?', [memberId]);
    if (!member) throw new BusinessRuleError('MEMBER_NOT_FOUND', `No member with id ${memberId}.`, { memberId });
  }

  // ---- meetings ----------------------------------------------------------

  meetings: DataService['meetings'] = {
    get: async (id) => {
      const db = await this.ready();
      return (await db.getFirstAsync<Meeting>('SELECT * FROM [Meeting] WHERE [id] = ?', [id])) ?? null;
    },

    listUpcoming: async (councilId, options) => {
      const db = await this.ready();
      const from = options?.fromDate ?? toIsoDate(new Date());
      const params: (string | number)[] = [councilId, from];
      let invited = '';
      if (options?.memberId !== undefined) {
        invited = ' AND [id] IN (SELECT [MeetingID] FROM [MeetingInvites] WHERE [MemberID] = ?)';
        params.push(options.memberId);
      }
      return db.getAllAsync<Meeting>(
        `SELECT * FROM [Meeting] WHERE [CouncilID] = ? AND [Date] >= ?${invited}
          ORDER BY [Date], [Time Start], [id]`,
        params,
      );
    },

    create: async (meeting, invite = 'none') => {
      const db = await this.ready();
      let id = 0;
      await db.withTransactionAsync(async () => {
        id = await this.insertMeeting(db, meeting, invite);
      });
      return (await db.getFirstAsync<Meeting>('SELECT * FROM [Meeting] WHERE [id] = ?', [id]))!;
    },

    listInvites: async (meetingId) => {
      const db = await this.ready();
      return db.getAllAsync<MeetingInvites>(
        'SELECT * FROM [MeetingInvites] WHERE [MeetingID] = ? ORDER BY [id]',
        [meetingId],
      );
    },

    invite: async (meetingId, memberIds) => {
      const db = await this.ready();
      let added = 0;
      await db.withTransactionAsync(async () => {
        added = await this.insertInvites(db, meetingId, memberIds);
      });
      return added;
    },

    setAttended: async (meetingId, memberId, attended) => {
      const db = await this.ready();
      const res = await db.runAsync(
        'UPDATE [MeetingInvites] SET [Attended] = ? WHERE [MeetingID] = ? AND [MemberID] = ?',
        [attended ? 1 : 0, meetingId, memberId],
      );
      if (res.changes === 0) throw new Error(`Member ${memberId} is not invited to meeting ${meetingId}`);
    },

    setMinutes: async (meetingId, minutesUrl) => {
      const url = minutesUrl === null ? null : assertText(minutesUrl, 'Minutes link', 255);
      const db = await this.ready();
      const res = await db.runAsync('UPDATE [Meeting] SET [MinutesURL] = ? WHERE [id] = ?', [url, meetingId]);
      if (res.changes === 0) throw new BusinessRuleError('MEETING_NOT_FOUND', `No meeting with id ${meetingId}.`, { meetingId });
      return (await db.getFirstAsync<Meeting>('SELECT * FROM [Meeting] WHERE [id] = ?', [meetingId]))!;
    },
  };

  private async insertMeeting(
    db: SQLite.SQLiteDatabase,
    m: NewMeeting,
    invite: MeetingInviteMode,
  ): Promise<number> {
    const res = await db.runAsync(
      `INSERT INTO [Meeting] ([CouncilID], [Meeting Name], [Meeting Description], [Date],
                              [Time Start], [Time End], [Location], [Agenda], [MinutesURL], [MeetingType])
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        m.CouncilID,
        m['Meeting Name'],
        m['Meeting Description'] ?? null,
        m.Date,
        m['Time Start'],
        m['Time End'],
        m.Location,
        m.Agenda ?? null,
        m.MinutesURL ?? null,
        m.MeetingType,
      ],
    );
    const meetingId = res.lastInsertRowId;
    await this.insertInvites(db, meetingId, await this.resolveInvitees(db, m.CouncilID, invite));
    return meetingId;
  }

  private async resolveInvitees(
    db: SQLite.SQLiteDatabase,
    councilId: number,
    mode: MeetingInviteMode,
  ): Promise<number[]> {
    if (mode === 'none') return [];
    if (typeof mode === 'object') return mode.memberIds;
    const officerOnly =
      mode === 'officers'
        ? ` AND EXISTS (SELECT 1 FROM [MemberRoles] mr JOIN [Role] r ON r.[id] = mr.[RoleID]
                         WHERE mr.[MemberID] = m.[id] AND r.[Officer] = 1)`
        : '';
    const rows = await db.getAllAsync<{ id: number }>(
      `SELECT m.[id] FROM [Member] m WHERE ${ACTIVE_MEMBER_FILTER}${officerOnly} ORDER BY m.[id]`,
      [councilId],
    );
    return rows.map((r) => r.id);
  }

  private async insertInvites(db: SQLite.SQLiteDatabase, meetingId: number, memberIds: number[]): Promise<number> {
    let added = 0;
    for (const memberId of new Set(memberIds)) {
      const res = await db.runAsync(
        `INSERT INTO [MeetingInvites] ([MeetingID], [MemberID], [Attended])
         SELECT ?, ?, 0
          WHERE NOT EXISTS (SELECT 1 FROM [MeetingInvites] WHERE [MeetingID] = ? AND [MemberID] = ?)`,
        [meetingId, memberId, meetingId, memberId],
      );
      added += res.changes;
    }
    return added;
  }

  // ---- messages ----------------------------------------------------------

  messages: DataService['messages'] = {
    getPage: async (threadId, options?: MessagePageOptions) => {
      const db = await this.ready();
      const limit = options?.limit ?? 20;
      if (options?.before === undefined) {
        return db.getAllAsync<Message>(
          'SELECT * FROM [Messages] WHERE [ThreadID] = ? ORDER BY [CreatedAt] DESC, [id] DESC LIMIT ?',
          [threadId, limit],
        );
      }
      return db.getAllAsync<Message>(
        `SELECT * FROM [Messages] WHERE [ThreadID] = ? AND [CreatedAt] < ?
          ORDER BY [CreatedAt] DESC, [id] DESC LIMIT ?`,
        [threadId, options.before, limit],
      );
    },

    createReadReceiptStubs: async (messageId, listId) => {
      const db = await this.ready();
      const res = await db.runAsync(
        `INSERT INTO [ReadReceipts] ([MessageID], [MemberID], [ReadAt], [IsFlagged])
         SELECT ?, [MemberID], NULL, 0 FROM [DistributionListMembers] WHERE [ListID] = ?`,
        [messageId, listId],
      );
      return res.changes;
    },

    listThreads: async (memberId) => {
      const db = await this.ready();
      const ids = await db.getAllAsync<{ ThreadID: number }>(
        `SELECT [ThreadID] FROM [Messages] WHERE [SenderID] = ? AND [ThreadID] IS NOT NULL
         UNION
         SELECT m.[ThreadID] FROM [ReadReceipts] r JOIN [Messages] m ON m.[id] = r.[MessageID]
          WHERE r.[MemberID] = ? AND m.[ThreadID] IS NOT NULL`,
        [memberId, memberId],
      );
      return buildThreadSummaries(memberId, await this.loadMessaging(db, ids.map((r) => r.ThreadID)));
    },

    listThread: async (threadId, memberId) => {
      const db = await this.ready();
      const rows = await this.loadMessaging(db, [threadId]);
      assertThreadParticipant(rows, threadId, memberId);
      return buildThreadMessages(memberId, threadId, rows);
    },

    send: async (input) => {
      const text = assertText(input.text, 'Message', 10_000);
      const db = await this.ready();
      let messageId = 0;
      await db.withTransactionAsync(async () => {
        await this.requireMember(db, input.senderId);
        let threadId: number;
        let recipients: number[];
        if (input.threadId !== undefined) {
          const rows = await this.loadMessaging(db, [input.threadId]);
          assertThreadParticipant(rows, input.threadId, input.senderId);
          threadId = input.threadId;
          recipients = participantIds(threadId, rows.messages, rows.receipts).filter((id) => id !== input.senderId);
        } else {
          recipients = [...new Set(input.recipientIds ?? [])].filter((id) => id !== input.senderId);
          if (input.councilId === undefined || recipients.length === 0) {
            throw new BusinessRuleError(
              'INVALID_INPUT',
              'A new conversation needs a council and at least one recipient other than the sender.',
              { councilId: input.councilId, recipientIds: input.recipientIds },
            );
          }
          for (const id of recipients) await this.requireMember(db, id);
          const created = await db.runAsync(
            'INSERT INTO [ChatThreads] ([CouncilID], [IsGroupChat], [CreatedAt]) VALUES (?, ?, ?)',
            [input.councilId, recipients.length > 1 ? 1 : 0, toTimestamp(this.now())],
          );
          threadId = created.lastInsertRowId;
        }
        await this.assertParent(db, threadId, input.parentMessageId);

        const stamp = toTimestamp(this.now());
        if (input.draftId !== undefined) {
          const draft = await this.requireDraft(db, input.draftId, input.senderId, threadId);
          await db.runAsync(
            'UPDATE [Messages] SET [MessageText] = ?, [IsDraft] = 0, [CreatedAt] = ?, [ParentMessageID] = ? WHERE [id] = ?',
            [text, stamp, input.parentMessageId !== undefined ? input.parentMessageId : (draft.ParentMessageID ?? null), draft.id],
          );
          messageId = draft.id;
        } else {
          const ins = await db.runAsync(
            `INSERT INTO [Messages] ([ThreadID], [SenderID], [ParentMessageID], [MessageText], [IsDraft], [CreatedAt])
             VALUES (?, ?, ?, ?, 0, ?)`,
            [threadId, input.senderId, input.parentMessageId ?? null, text, stamp],
          );
          messageId = ins.lastInsertRowId;
        }
        for (const memberId of recipients) {
          await db.runAsync('INSERT INTO [ReadReceipts] ([MessageID], [MemberID], [ReadAt], [IsFlagged]) VALUES (?, ?, NULL, 0)', [
            messageId,
            memberId,
          ]);
        }
      });
      return (await db.getFirstAsync<Message>('SELECT * FROM [Messages] WHERE [id] = ?', [messageId]))!;
    },

    saveDraft: async (input) => {
      const text = assertText(input.text, 'Draft', 10_000);
      const db = await this.ready();
      let messageId = 0;
      await db.withTransactionAsync(async () => {
        await this.requireMember(db, input.senderId);
        assertThreadParticipant(await this.loadMessaging(db, [input.threadId]), input.threadId, input.senderId);
        await this.assertParent(db, input.threadId, input.parentMessageId);
        const stamp = toTimestamp(this.now());
        if (input.draftId !== undefined) {
          const draft = await this.requireDraft(db, input.draftId, input.senderId, input.threadId);
          await db.runAsync('UPDATE [Messages] SET [MessageText] = ?, [CreatedAt] = ?, [ParentMessageID] = ? WHERE [id] = ?', [
            text,
            stamp,
            input.parentMessageId !== undefined ? input.parentMessageId : (draft.ParentMessageID ?? null),
            draft.id,
          ]);
          messageId = draft.id;
        } else {
          const ins = await db.runAsync(
            `INSERT INTO [Messages] ([ThreadID], [SenderID], [ParentMessageID], [MessageText], [IsDraft], [CreatedAt])
             VALUES (?, ?, ?, ?, 1, ?)`,
            [input.threadId, input.senderId, input.parentMessageId ?? null, text, stamp],
          );
          messageId = ins.lastInsertRowId;
        }
      });
      return (await db.getFirstAsync<Message>('SELECT * FROM [Messages] WHERE [id] = ?', [messageId]))!;
    },

    deleteDraft: async (messageId, memberId) => {
      const db = await this.ready();
      const res = await db.runAsync('DELETE FROM [Messages] WHERE [id] = ? AND [IsDraft] = 1 AND [SenderID] = ?', [
        messageId,
        memberId,
      ]);
      if (res.changes === 0) {
        throw new BusinessRuleError('MESSAGE_NOT_FOUND', `Member ${memberId} has no draft with id ${messageId}.`, {
          messageId,
          memberId,
        });
      }
    },

    setRead: async (messageId, memberId, read) => {
      const db = await this.ready();
      const res = await db.runAsync('UPDATE [ReadReceipts] SET [ReadAt] = ? WHERE [MessageID] = ? AND [MemberID] = ?', [
        read ? toTimestamp(this.now()) : null,
        messageId,
        memberId,
      ]);
      if (res.changes === 0) {
        throw new BusinessRuleError(
          'MESSAGE_NOT_FOUND',
          `Member ${memberId} did not receive message ${messageId}, so it has no read state for them.`,
          { messageId, memberId },
        );
      }
      return (await db.getFirstAsync<ReadReceipt>('SELECT * FROM [ReadReceipts] WHERE [MessageID] = ? AND [MemberID] = ?', [
        messageId,
        memberId,
      ]))!;
    },
  };

  /** Raw rows for the given threads, ready for the pure builders in @kofc/shared. */
  private async loadMessaging(db: SQLite.SQLiteDatabase, threadIds: readonly number[]): Promise<MessagingRows> {
    const threads = await selectIn<ChatThread>(db, (m) => `SELECT * FROM [ChatThreads] WHERE [id] IN (${m})`, threadIds);
    const messages = await selectIn<Message>(db, (m) => `SELECT * FROM [Messages] WHERE [ThreadID] IN (${m})`, threadIds);
    const messageIds = messages.map((m) => m.id);
    const receipts = await selectIn<ReadReceipt>(db, (m) => `SELECT * FROM [ReadReceipts] WHERE [MessageID] IN (${m})`, messageIds);
    const attachments = await selectIn<MessageAttachment>(
      db,
      (m) => `SELECT * FROM [MessageAttachments] WHERE [MessageID] IN (${m}) ORDER BY [id]`,
      messageIds,
    );
    const members = await db.getAllAsync<{ id: number; MemberFirstName: string; MemberLastName: string }>(
      'SELECT [id], [MemberFirstName], [MemberLastName] FROM [Member]',
    );
    return {
      threads,
      messages,
      receipts,
      attachments,
      names: new Map(members.map((m) => [m.id, `${m.MemberFirstName} ${m.MemberLastName}`])),
    };
  }

  private async assertParent(db: SQLite.SQLiteDatabase, threadId: number, parentId: number | null | undefined): Promise<void> {
    if (parentId == null) return;
    if (!(await db.getFirstAsync('SELECT [id] FROM [Messages] WHERE [id] = ? AND [ThreadID] = ?', [parentId, threadId]))) {
      throw new BusinessRuleError('MESSAGE_NOT_FOUND', `Thread ${threadId} has no message ${parentId} to reply to.`, {
        threadId,
        parentId,
      });
    }
  }

  private async requireDraft(db: SQLite.SQLiteDatabase, messageId: number, memberId: number, threadId: number): Promise<Message> {
    const draft = await db.getFirstAsync<Message>(
      'SELECT * FROM [Messages] WHERE [id] = ? AND [IsDraft] = 1 AND [SenderID] = ? AND [ThreadID] = ?',
      [messageId, memberId, threadId],
    );
    if (!draft) {
      throw new BusinessRuleError('MESSAGE_NOT_FOUND', `Member ${memberId} has no draft ${messageId} in thread ${threadId}.`, {
        messageId,
        memberId,
        threadId,
      });
    }
    return draft;
  }

  /** Extra councils, shared and historical events, no-show history and message threads for the new screens. */
  private async seedDevExtras(db: SQLite.SQLiteDatabase): Promise<void> {
    const idOf = async (sql: string, param: string | number) => (await db.getFirstAsync<{ id: number }>(sql, [param]))?.id as number;
    const insertCouncil = async (c: { CouncilNumber: number; CouncilName: string; State: string; Phone: string }) =>
      (
        await db.runAsync('INSERT INTO [Council] ([CouncilNumber], [CouncilName], [State], [Phone]) VALUES (?, ?, ?, ?)', [
          c.CouncilNumber,
          c.CouncilName,
          c.State,
          c.Phone,
        ])
      ).lastInsertRowId;

    const own = await idOf('SELECT [id] FROM [Council] WHERE [CouncilNumber] = ?', DEV_COUNCIL_NUMBER);
    const affiliated = await insertCouncil(DEV_AFFILIATED_COUNCIL);
    const unaffiliated = await insertCouncil(DEV_UNAFFILIATED_COUNCIL);
    await db.runAsync('INSERT INTO [AffiliatedCouncils] ([PrimaryCouncilID], [AffiliatedCouncilID]) VALUES (?, ?)', [own, affiliated]);
    const councilIds = { own, affiliated, unaffiliated };

    const memberId = (email: string) => idOf('SELECT [id] FROM [Member] WHERE [Email] = ?', email);
    const ownerId = await memberId('testadmin@kofc.org');
    const categoryId = await idOf('SELECT [id] FROM [Category] WHERE [Category] = ?', 'Service');

    for (const { event, councils, shifts } of buildDevExtraEvents(this.now())) {
      const ev = await db.runAsync(
        `INSERT INTO [Event] ([EventName], [EventDescription], [OwnerID], [StartDate], [EndDate], [Location], [CategoryID])
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [event.EventName, event.EventDescription, ownerId, event.StartDate, event.EndDate, event.Location, categoryId],
      );
      for (const c of councils) {
        await db.runAsync('INSERT INTO [EventCouncils] ([EventID], [CouncilID]) VALUES (?, ?)', [ev.lastInsertRowId, councilIds[c]]);
      }
      for (const { shift, signedUp, noShows } of shifts) {
        const sh = await this.insertShiftRow(db, ev.lastInsertRowId, shift);
        await db.runAsync('UPDATE [Shift] SET [NumberVolunteersSignedUp] = ? WHERE [id] = ?', [signedUp.length, sh]);
        for (const email of signedUp) {
          const code = noShows?.[email];
          await db.runAsync(
            'INSERT INTO [EventSignup] ([ShiftID], [MemberID], [NoShow], [NoShowReasonID]) VALUES (?, ?, ?, ?)',
            [
              sh,
              await memberId(email),
              code ? 1 : 0,
              code ? await idOf('SELECT [id] FROM [NoShowReason] WHERE [NoShowReasonCode] = ?', code) : null,
            ],
          );
        }
      }
    }

    const { threads, messages } = buildDevMessaging();
    const stampAt = (hoursAgo: number) => toTimestamp(new Date(this.now().getTime() - hoursAgo * 3_600_000));
    const threadIds = new Map<string, number>();
    const messageIds = new Map<string, number>();
    for (const t of threads) {
      const row = await db.runAsync('INSERT INTO [ChatThreads] ([CouncilID], [IsGroupChat], [CreatedAt]) VALUES (?, ?, ?)', [
        own,
        t.isGroup ? 1 : 0,
        stampAt(72),
      ]);
      threadIds.set(t.key, row.lastInsertRowId);
    }
    for (const m of messages) {
      const thread = threads.find((t) => t.key === m.thread)!;
      const row = await db.runAsync(
        `INSERT INTO [Messages] ([ThreadID], [SenderID], [ParentMessageID], [MessageText], [IsDraft], [CreatedAt])
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          threadIds.get(m.thread)!,
          await memberId(m.sender),
          m.parent ? (messageIds.get(m.parent) ?? null) : null,
          m.text,
          m.draft ? 1 : 0,
          stampAt(m.hoursAgo),
        ],
      );
      messageIds.set(m.key, row.lastInsertRowId);
      if (!m.draft) {
        for (const email of thread.participants.filter((e) => e !== m.sender)) {
          await db.runAsync('INSERT INTO [ReadReceipts] ([MessageID], [MemberID], [ReadAt], [IsFlagged]) VALUES (?, ?, ?, 0)', [
            row.lastInsertRowId,
            await memberId(email),
            m.readBy?.includes(email) ? stampAt(m.hoursAgo - 0.5) : null,
          ]);
        }
      }
      for (const a of m.attachments ?? []) {
        await db.runAsync(
          'INSERT INTO [MessageAttachments] ([MessageID], [Filename], [FileType], [StorageURL], [UploadedAt]) VALUES (?, ?, ?, ?, ?)',
          [row.lastInsertRowId, a.Filename, a.FileType, `placeholder://attachments/${encodeURIComponent(a.Filename)}`, stampAt(m.hoursAgo)],
        );
      }
    }
  }
}
