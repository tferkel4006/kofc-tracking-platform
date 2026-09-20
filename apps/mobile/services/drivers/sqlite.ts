// SQLite driver for the mobile app (expo-sqlite).
// The schema and seed statements are generated from Schema.sql / Seed.sql by
// scripts/gen-db-assets.mjs. Nothing outside /services may import this file.
import * as SQLite from 'expo-sqlite';
import {
  assertActivityDateAllowed,
  assertPasswordAcceptable,
  assertShiftHasRoom,
  assertShiftReportAllowed,
  assertValidHours,
  BusinessRuleError,
  isSha256Hex,
  UNREGISTERED_PASSWORD,
} from '@kofc/shared';
import type {
  ActivityTime,
  Council,
  DataService,
  Event as CouncilEvent,
  EventSignup,
  EventTime,
  LookupRowMap,
  LookupTableName,
  Meeting,
  MeetingInvites,
  MeetingInviteMode,
  Member,
  Message,
  MessagePageOptions,
  NewMeeting,
  Role,
  SessionUser,
  Shift,
} from '@kofc/shared';
import { SCHEMA_STATEMENTS, SEED_STATEMENTS } from '../generated/schema.sqlite';
import { sha256Hex } from '../password';
import {
  buildDevEvents,
  buildDevMeetings,
  DEV_ACTIVITY,
  DEV_COUNCIL_NUMBER,
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
  };

  councils: DataService['councils'] = {
    list: async () => {
      const db = await this.ready();
      return db.getAllAsync<Council>('SELECT * FROM [Council] ORDER BY [CouncilNumber], [CouncilName]');
    },
    get: async (id) => {
      const db = await this.ready();
      return (await db.getFirstAsync<Council>('SELECT * FROM [Council] WHERE [id] = ?', [id])) ?? null;
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
  };
}
