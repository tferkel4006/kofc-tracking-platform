// SQLite driver for the mobile app (expo-sqlite).
// The schema and seed statements are generated from Schema.sql / Seed.sql by
// scripts/gen-db-assets.mjs. Nothing outside /services may import this file.
import * as SQLite from 'expo-sqlite';
import type {
  Council,
  DataService,
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
} from '@kofc/shared';
import { SCHEMA_STATEMENTS, SEED_STATEMENTS } from '../generated/schema.sqlite';
import { buildDevMeetings, DEV_COUNCIL_NUMBER, toIsoDate, type DevMeetingTypeName } from '../seed-dev';

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

/** Dev stub: plaintext comparison, as seeded. Phase 3 replaces this with SHA-256. */
const passwordMatches = (stored: string, supplied: string) => stored === supplied;

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

export class SqliteDataService implements DataService {
  private opening: Promise<SQLite.SQLiteDatabase> | null = null;

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
      await this.seedDevMeetings(db);
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
    for (const { meeting, invite } of buildDevMeetings(council.id, typeIds)) {
      await this.insertMeeting(db, meeting, invite);
    }
  }

  // ---- auth --------------------------------------------------------------

  auth: DataService['auth'] = {
    signIn: async (username, password) => {
      const db = await this.ready();
      const row = await db.getFirstAsync<SignInRow>(
        `SELECT c.[id] AS credentialId, c.[Password] AS password, c.[Username] AS username,
                m.[id] AS memberId, m.[CouncilID] AS councilId,
                m.[MemberFirstName] AS firstName, m.[MemberLastName] AS lastName,
                t.[Type] AS memberType
           FROM [Credentials] c
           JOIN [Member] m ON m.[CredentialID] = c.[id]
           JOIN [MemberType] t ON t.[id] = m.[MemberTypeID]
          WHERE c.[Username] = ? COLLATE NOCASE`,
        [username],
      );
      if (!row || !passwordMatches(row.password, password)) return null;
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
    },
  };

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
