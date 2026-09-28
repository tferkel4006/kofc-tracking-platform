// SQLite driver for the mobile app (expo-sqlite).
// The schema and seed statements are generated from Schema.sql / Seed.sql by
// scripts/gen-db-assets.mjs. Nothing outside /services may import this file.
import * as SQLite from 'expo-sqlite';
import {
  ACTIVITY_COLUMNS,
  aggregateMeetingHours,
  assertActivityDateAllowed,
  assertDonationDateForEvent,
  assertDonationFitsMethod,
  assertEventRange,
  assertFundsEditable,
  assertLookupKeyUnique,
  assertLookupNotProtected,
  assertLookupUnused,
  assertNoShowWithoutHours,
  assertMayChangeDonation,
  appendPhotoPaths,
  assertMayAttachEventMedia,
  assertMayChangeLesson,
  assertMayLinkMeetingDrive,
  buildCalendarEntries,
  cleanCalendarRange,
  cleanGoogleDriveUrl,
  assertMayManageCouncilLookups,
  assertMayMarkNoShow,
  assertMayReadFeedback,
  assertMayReadLessonsRegistry,
  assertMayCreateMember,
  assertMayEditMemberExtensions,
  assertMayMaintainCouncilRecords,
  assertMayMaintainCouncils,
  assertMayMaintainLookups,
  assertMayUpdateMember,
  assertPasswordAcceptable,
  assertRecordUnused,
  assertRecordValueUnique,
  assertShiftHasRoom,
  assertShiftInsideEvent,
  assertShiftReportAllowed,
  assertText,
  assertThreadParticipant,
  assertValidHours,
  buildActivityTimeLog,
  buildDonationHistory,
  buildFeedbackInbox,
  buildLessonsRegistry,
  buildNoShowAudit,
  buildShiftsAwaitingHours,
  buildThreadMessages,
  buildThreadSummaries,
  buildWelcomeEmail,
  BusinessRuleError,
  cleanActivity,
  cleanCouncil,
  cleanCouncilIds,
  cleanFeedbackText,
  cleanDistributionListChanges,
  cleanEventFields,
  cleanLessonsRegistryFilters,
  cleanLookupValues,
  cleanMemberExtensions,
  cleanNewDistributionList,
  cleanNewDonation,
  cleanNewEvent,
  cleanNewMember,
  cleanNewShift,
  cleanParish,
  cleanPastor,
  cleanShiftFields,
  COUNCIL_COLUMNS,
  COUNCIL_LOOKUP_META,
  DONATION_EDITABLE_COLUMNS,
  donationMethodKind,
  EVENT_COLUMNS,
  isSha256Hex,
  LOOKUP_META,
  mergeDonationChanges,
  mergeMemberChanges,
  mergeRecordChanges,
  monthBounds,
  noShowReasonFor,
  noShowAuditThreshold,
  planCouncilLookupSave,
  nextEventFunds,
  MEMBER_COLUMNS,
  PARISH_COLUMNS,
  participantIds,
  PASTOR_COLUMNS,
  planEventCopy,
  RECORD_REFERENCES,
  recordNotFound,
  rollupEventFunds,
  signupNotFound,
  sortCouncilLookupRows,
  SHIFT_COLUMNS,
  summarizeActivities,
  summarizeMonth,
  toTimestamp,
  trainingDateToYear,
  trainingYearToDate,
  UNREGISTERED_PASSWORD,
  type CleanDonation,
  type CouncilAdminDetails,
  type EventFunds,
  type MaintainedTable,
  type MemberWriteActor,
  type MessagingRows,
  type SignupContextRow,
} from '@kofc/shared';
import type {
  Activities,
  ActivityTime,
  ChatThread,
  Council,
  CouncilDonationMethod,
  CouncilLookupRowMap,
  CouncilLookupTableName,
  CouncilSkillEntry,
  DataService,
  DistributionLists,
  DistributionListSummary,
  Donation,
  DonationMethod,
  DonationType,
  KOCTrainingClasses,
  MemberExtensions,
  MemberSkill,
  MemberTraining,
  NewActivity,
  NewCouncil,
  NewMember,
  NewParish,
  NewPastor,
  Parish,
  Pastor,
  ProfileOptions,
  Skill,
  SkillLevel,
  SystemFeedback,
  WorkingStatus,
  Event as CouncilEvent,
  EventChanges,
  EventSignup,
  EventTime,
  LessonsLearned,
  LessonsLearnedCategory,
  Category,
  LookupRowMap,
  LookupTableName,
  LookupValues,
  Meeting,
  MeetingInvites,
  MeetingInviteMode,
  Member,
  MemberShift,
  VolunteerTurnout,
  Message,
  MessageAttachment,
  NoShowReason,
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
  DEV_COUNCIL_DONATION_METHODS,
  DEV_COUNCIL_NUMBER,
  DEV_UNAFFILIATED_COUNCIL,
  DEV_UNREGISTERED_MEMBER,
  toIsoDate,
  type DevMeetingTypeName,
} from '../seed-dev';

const DB_NAME = 'kofc.db';
/**
 * Bump when Schema.sql changes; stored in PRAGMA user_version. Migrations are a later concern:
 * a dev database created at an older version must be wiped with reset() (or the app reinstalled).
 * 2: Phase 2 donations, skills, training and working status.
 * 3: Donation.RecordedBy (Sprint 5K).
 * 4: view_NoShows LEFT JOINs NoShowReason (Sprint 5L).
 * 5: SystemFeedback (Sprint 5P).
 * 6: Event.PhotoGalleryURL, Meeting.GoogleDriveMinutesURL and GoogleDriveFlyerURL (Sprint 5Q).
 * 7: Meeting.OwnerID (Sprint 5Q).
 */
const SCHEMA_VERSION = 7;

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

const noParish = (parishId: number) => new BusinessRuleError('INVALID_INPUT', `No parish with id ${parishId}.`, { parishId });

export interface SqliteDataServiceOptions {
  /** Clock used for seeding and the history-window rules. Tests pin it. Default: real time. */
  now?: () => Date;
  /** Where system emails (the new-member welcome) go. Default: console.log (no mail infrastructure exists yet). */
  log?: (...args: unknown[]) => void;
}

export class SqliteDataService implements DataService {
  private opening: Promise<SQLite.SQLiteDatabase> | null = null;
  private readonly now: () => Date;
  private readonly log: (...args: unknown[]) => void;

  constructor(options: SqliteDataServiceOptions = {}) {
    this.now = options.now ?? (() => new Date());
    this.log = options.log ?? console.log;
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
      await this.seedDevDonationMethods(db);
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
    create: async <T extends LookupTableName>(actorId: number, table: T, values: LookupValues): Promise<LookupRowMap[T]> => {
      if (!LOOKUP_TABLES[table]) throw new Error(`Unknown lookup table: ${String(table)}`);
      const cols = LOOKUP_META[table].fields.map((f) => f.key);
      const db = await this.ready();
      assertMayMaintainLookups(await this.memberWriteActor(db, actorId), table);
      const cleaned = cleanLookupValues(table, values);
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

    update: async <T extends LookupTableName>(actorId: number, table: T, id: number, values: LookupValues): Promise<LookupRowMap[T]> => {
      if (!LOOKUP_TABLES[table]) throw new Error(`Unknown lookup table: ${String(table)}`);
      const cols = LOOKUP_META[table].fields.map((f) => f.key);
      const db = await this.ready();
      assertMayMaintainLookups(await this.memberWriteActor(db, actorId), table);
      const cleaned = cleanLookupValues(table, values);
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

    remove: async (actorId, table, id) => {
      if (!LOOKUP_TABLES[table]) throw new Error(`Unknown lookup table: ${String(table)}`);
      const db = await this.ready();
      await db.withTransactionAsync(async () => {
        assertMayMaintainLookups(await this.memberWriteActor(db, actorId), table);
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

    listForMaintenance: async <T extends LookupTableName>(actorId: number, table: T): Promise<LookupRowMap[T][]> => {
      if (!LOOKUP_TABLES[table]) throw new Error(`Unknown lookup table: ${String(table)}`);
      const db = await this.ready();
      assertMayMaintainLookups(await this.memberWriteActor(db, actorId), table, 'view');
      return db.getAllAsync<LookupRowMap[T]>(`SELECT * FROM [${table}] ORDER BY [id]`);
    },

    listCouncilSpecific: async <T extends CouncilLookupTableName>(actorId: number, councilId: number, table: T) => {
      const db = await this.ready();
      await this.assertMayManageCouncilLookups(db, actorId, councilId, table, `view the council's ${table} lookups`);
      return this.councilLookupRows(db, councilId, table);
    },

    saveCouncilSpecific: async <T extends CouncilLookupTableName>(actorId: number, councilId: number, table: T, records: unknown) => {
      const meta = COUNCIL_LOOKUP_META[table];
      const db = await this.ready();
      await db.withTransactionAsync(async () => {
        await this.assertMayManageCouncilLookups(db, actorId, councilId, table, `change the council's ${table} lookups`);
        const current = await db.getAllAsync<Record<string, unknown>>(`SELECT * FROM [${table}] WHERE [CouncilID] = ?`, [councilId]);
        const plan = planCouncilLookupSave(table, councilId, current, records);
        for (const values of [...plan.inserts, ...plan.updates.map((u) => u.values)]) {
          for (const fk of meta.foreignKeys) await this.assertRowExists(db, fk.table, values[fk.column] as number, fk.label);
        }
        for (const { id, values } of plan.updates) {
          await db.runAsync(`UPDATE [${table}] SET ${meta.columns.map((c) => `[${c}] = ?`).join(', ')} WHERE [id] = ?`, [
            ...meta.columns.map((c) => values[c] ?? null),
            id,
          ]);
        }
        for (const values of plan.inserts) {
          await db.runAsync(
            `INSERT INTO [${table}] (${meta.columns.map((c) => `[${c}]`).join(', ')}, [CouncilID]) VALUES (${marks(meta.columns.length + 1)})`,
            [...meta.columns.map((c) => values[c] ?? null), councilId],
          );
        }
      });
      return this.councilLookupRows(db, councilId, table);
    },

    removeCouncilSpecific: async (actorId, councilId, table, id) => {
      const db = await this.ready();
      await db.withTransactionAsync(async () => {
        await this.assertMayManageCouncilLookups(db, actorId, councilId, table, `delete the council's ${table} lookups`);
        const row = await db.getFirstAsync<Record<string, unknown>>(`SELECT * FROM [${table}] WHERE [id] = ? AND [CouncilID] = ?`, [
          id,
          councilId,
        ]);
        if (!row) {
          throw new BusinessRuleError('RECORD_NOT_FOUND', `${table} ${id} does not exist in council ${councilId}.`, { table, id, councilId });
        }
        await this.assertRecordUnused(db, table, id, String(row[COUNCIL_LOOKUP_META[table].keyField]));
        await db.runAsync(`DELETE FROM [${table}] WHERE [id] = ?`, [id]);
      });
    },
  };

  /**
   * Loads the actor, checks the council exists and applies assertMayManageCouncilLookups. Also the allow-list
   * for the council lookup table names interpolated into SQL.
   */
  private async assertMayManageCouncilLookups(
    db: SQLite.SQLiteDatabase,
    actorId: number,
    councilId: number,
    table: CouncilLookupTableName,
    action: string,
  ): Promise<void> {
    if (!COUNCIL_LOOKUP_META[table]) throw new Error(`Unknown council lookup table: ${String(table)}`);
    const actor = await this.memberWriteActor(db, actorId);
    await this.assertCouncilsExist(db, [councilId]);
    assertMayManageCouncilLookups(actor, councilId, table, action);
  }

  private async councilLookupRows<T extends CouncilLookupTableName>(
    db: SQLite.SQLiteDatabase,
    councilId: number,
    table: T,
  ): Promise<CouncilLookupRowMap[T][]> {
    const rows = await db.getAllAsync<CouncilLookupRowMap[T]>(`SELECT * FROM [${table}] WHERE [CouncilID] = ?`, [councilId]);
    return sortCouncilLookupRows(table, rows);
  }

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

    create: async (actorId, council) => {
      const db = await this.ready();
      assertMayMaintainCouncils(await this.memberWriteActor(db, actorId), 'add councils');
      const clean = cleanCouncil(council);
      let id = 0;
      await db.withTransactionAsync(async () => {
        const rows = await db.getAllAsync<Record<string, unknown>>('SELECT [id], [CouncilNumber] FROM [Council]');
        assertRecordValueUnique('Council', rows, 'CouncilNumber', clean.CouncilNumber, 'by another council');
        id = await this.insertRecord(db, 'Council', COUNCIL_COLUMNS, clean);
      });
      return (await db.getFirstAsync<Council>('SELECT * FROM [Council] WHERE [id] = ?', [id]))!;
    },

    update: async (actorId, id, changes) => {
      const db = await this.ready();
      assertMayMaintainCouncils(await this.memberWriteActor(db, actorId), `change council ${id}`);
      await db.withTransactionAsync(async () => {
        const row = await this.requireRecord(db, 'Council', id);
        const clean = cleanCouncil(mergeRecordChanges<NewCouncil>(row, changes, COUNCIL_COLUMNS));
        const rows = await db.getAllAsync<Record<string, unknown>>('SELECT [id], [CouncilNumber] FROM [Council]');
        assertRecordValueUnique('Council', rows, 'CouncilNumber', clean.CouncilNumber, 'by another council', id);
        await this.updateRecord(db, 'Council', id, COUNCIL_COLUMNS, clean);
      });
      return (await db.getFirstAsync<Council>('SELECT * FROM [Council] WHERE [id] = ?', [id]))!;
    },

    remove: async (actorId, id) => {
      const db = await this.ready();
      await db.withTransactionAsync(async () => {
        assertMayMaintainCouncils(await this.memberWriteActor(db, actorId), `delete council ${id}`);
        const row = await this.requireRecord(db, 'Council', id);
        await this.assertRecordUnused(db, 'Council', id, `${String(row.CouncilNumber)} ${String(row.CouncilName)}`);
        await db.runAsync('DELETE FROM [Council] WHERE [id] = ?', [id]);
      });
    },
  };

  // ---- council-level maintenance: parishes, pastors, activities, lists ----

  parishes: DataService['parishes'] = {
    listByCouncil: async (councilId) => {
      const db = await this.ready();
      return db.getAllAsync<Parish>('SELECT * FROM [Parish] WHERE [CouncilID] = ? ORDER BY [Name] COLLATE NOCASE, [id]', [councilId]);
    },

    get: async (id) => {
      const db = await this.ready();
      return (await db.getFirstAsync<Parish>('SELECT * FROM [Parish] WHERE [id] = ?', [id])) ?? null;
    },

    create: async (actorId, parish) => {
      const clean = cleanParish(parish);
      const db = await this.ready();
      assertMayMaintainCouncilRecords(await this.memberWriteActor(db, actorId), clean.CouncilID, 'add parishes');
      let id = 0;
      await db.withTransactionAsync(async () => {
        await this.assertCouncilsExist(db, [clean.CouncilID]);
        await this.assertParishNameUnique(db, clean);
        id = await this.insertRecord(db, 'Parish', PARISH_COLUMNS, clean);
      });
      return (await db.getFirstAsync<Parish>('SELECT * FROM [Parish] WHERE [id] = ?', [id]))!;
    },

    update: async (actorId, id, changes) => {
      const db = await this.ready();
      await db.withTransactionAsync(async () => {
        const actor = await this.memberWriteActor(db, actorId);
        const row = await this.requireRecord(db, 'Parish', id);
        assertMayMaintainCouncilRecords(actor, row.CouncilID as number, `change parish ${id}`);
        const clean = cleanParish(mergeRecordChanges<NewParish>(row, changes, PARISH_COLUMNS));
        if (clean.CouncilID !== row.CouncilID) {
          assertMayMaintainCouncilRecords(actor, clean.CouncilID, `move parish ${id}`);
          await this.assertCouncilsExist(db, [clean.CouncilID]);
        }
        await this.assertParishNameUnique(db, clean, id);
        await this.updateRecord(db, 'Parish', id, PARISH_COLUMNS, clean);
      });
      return (await db.getFirstAsync<Parish>('SELECT * FROM [Parish] WHERE [id] = ?', [id]))!;
    },

    remove: async (actorId, id) => {
      const db = await this.ready();
      await db.withTransactionAsync(async () => {
        const actor = await this.memberWriteActor(db, actorId);
        const row = await this.requireRecord(db, 'Parish', id);
        assertMayMaintainCouncilRecords(actor, row.CouncilID as number, `delete parish ${id}`);
        await this.assertRecordUnused(db, 'Parish', id, String(row.Name));
        await db.runAsync('DELETE FROM [Parish] WHERE [id] = ?', [id]);
      });
    },
  };

  private async assertParishNameUnique(db: SQLite.SQLiteDatabase, clean: NewParish, ignoreId?: number): Promise<void> {
    const siblings = await db.getAllAsync<Record<string, unknown>>('SELECT [id], [Name] FROM [Parish] WHERE [CouncilID] = ?', [
      clean.CouncilID,
    ]);
    assertRecordValueUnique('Parish', siblings, 'Name', clean.Name, `in council ${clean.CouncilID}`, ignoreId);
  }

  pastors: DataService['pastors'] = {
    listByParish: async (parishId) => {
      const db = await this.ready();
      return db.getAllAsync<Pastor>(
        'SELECT * FROM [Pastor] WHERE [ParishID] = ? ORDER BY [LastName] COLLATE NOCASE, [FirstName] COLLATE NOCASE, [id]',
        [parishId],
      );
    },

    listByCouncil: async (councilId) => {
      const db = await this.ready();
      return db.getAllAsync<Pastor>(
        `SELECT p.* FROM [Pastor] p JOIN [Parish] pa ON pa.[id] = p.[ParishID]
          WHERE pa.[CouncilID] = ?
          ORDER BY p.[LastName] COLLATE NOCASE, p.[FirstName] COLLATE NOCASE, p.[id]`,
        [councilId],
      );
    },

    create: async (actorId, pastor) => {
      const clean = cleanPastor(pastor);
      const db = await this.ready();
      let id = 0;
      await db.withTransactionAsync(async () => {
        const actor = await this.memberWriteActor(db, actorId);
        const councilId = await this.parishCouncilId(db, clean.ParishID);
        // A non-admin hears ADMIN_REQUIRED even for an unknown parish; the parish only decides the tenant.
        assertMayMaintainCouncilRecords(actor, councilId ?? actor.councilId, 'add pastors');
        if (councilId === null) throw noParish(clean.ParishID);
        id = await this.insertRecord(db, 'Pastor', PASTOR_COLUMNS, clean);
      });
      return (await db.getFirstAsync<Pastor>('SELECT * FROM [Pastor] WHERE [id] = ?', [id]))!;
    },

    update: async (actorId, id, changes) => {
      const db = await this.ready();
      await db.withTransactionAsync(async () => {
        const actor = await this.memberWriteActor(db, actorId);
        const row = await this.requireRecord(db, 'Pastor', id);
        assertMayMaintainCouncilRecords(actor, (await this.parishCouncilId(db, row.ParishID as number))!, `change pastor ${id}`);
        const clean = cleanPastor(mergeRecordChanges<NewPastor>(row, changes, PASTOR_COLUMNS));
        if (clean.ParishID !== row.ParishID) {
          const councilId = await this.parishCouncilId(db, clean.ParishID);
          assertMayMaintainCouncilRecords(actor, councilId ?? actor.councilId, `move pastor ${id}`);
          if (councilId === null) throw noParish(clean.ParishID);
        }
        await this.updateRecord(db, 'Pastor', id, PASTOR_COLUMNS, clean);
      });
      return (await db.getFirstAsync<Pastor>('SELECT * FROM [Pastor] WHERE [id] = ?', [id]))!;
    },

    remove: async (actorId, id) => {
      const db = await this.ready();
      await db.withTransactionAsync(async () => {
        const actor = await this.memberWriteActor(db, actorId);
        const row = await this.requireRecord(db, 'Pastor', id);
        assertMayMaintainCouncilRecords(actor, (await this.parishCouncilId(db, row.ParishID as number))!, `delete pastor ${id}`);
        await db.runAsync('DELETE FROM [Pastor] WHERE [id] = ?', [id]);
      });
    },
  };

  /** The parish's council, or null when there is no such parish. */
  private async parishCouncilId(db: SQLite.SQLiteDatabase, parishId: number): Promise<number | null> {
    return (await db.getFirstAsync<{ CouncilID: number }>('SELECT [CouncilID] FROM [Parish] WHERE [id] = ?', [parishId]))?.CouncilID ?? null;
  }

  activities: DataService['activities'] = {
    listByCouncil: async (councilId) => {
      const db = await this.ready();
      return db.getAllAsync<Activities>('SELECT * FROM [Activities] WHERE [CouncilID] = ? ORDER BY [ActivityName], [id]', [
        councilId,
      ]);
    },

    get: async (id) => {
      const db = await this.ready();
      return (await db.getFirstAsync<Activities>('SELECT * FROM [Activities] WHERE [id] = ?', [id])) ?? null;
    },

    create: async (actorId, activity) => {
      const clean = cleanActivity(activity);
      const db = await this.ready();
      assertMayMaintainCouncilRecords(await this.memberWriteActor(db, actorId), clean.CouncilID, 'add activities');
      let id = 0;
      await db.withTransactionAsync(async () => {
        await this.assertActivityReferences(db, clean);
        await this.assertActivityNameUnique(db, clean);
        id = await this.insertRecord(db, 'Activities', ACTIVITY_COLUMNS, clean);
      });
      return (await db.getFirstAsync<Activities>('SELECT * FROM [Activities] WHERE [id] = ?', [id]))!;
    },

    update: async (actorId, id, changes) => {
      const db = await this.ready();
      await db.withTransactionAsync(async () => {
        const actor = await this.memberWriteActor(db, actorId);
        const row = await this.requireRecord(db, 'Activities', id);
        assertMayMaintainCouncilRecords(actor, row.CouncilID as number, `change activity ${id}`);
        const clean = cleanActivity(mergeRecordChanges<NewActivity>(row, changes, ACTIVITY_COLUMNS));
        if (clean.CouncilID !== row.CouncilID) assertMayMaintainCouncilRecords(actor, clean.CouncilID, `move activity ${id}`);
        await this.assertActivityReferences(db, clean);
        await this.assertActivityNameUnique(db, clean, id);
        await this.updateRecord(db, 'Activities', id, ACTIVITY_COLUMNS, clean);
      });
      return (await db.getFirstAsync<Activities>('SELECT * FROM [Activities] WHERE [id] = ?', [id]))!;
    },

    remove: async (actorId, id) => {
      const db = await this.ready();
      await db.withTransactionAsync(async () => {
        const actor = await this.memberWriteActor(db, actorId);
        const row = await this.requireRecord(db, 'Activities', id);
        assertMayMaintainCouncilRecords(actor, row.CouncilID as number, `delete activity ${id}`);
        await this.assertRecordUnused(db, 'Activities', id, String(row.ActivityName));
        await db.runAsync('DELETE FROM [Activities] WHERE [id] = ?', [id]);
      });
    },

    listSummaries: async (councilId) => {
      const activities = await this.activities.listByCouncil(councilId);
      const db = await this.ready();
      const times = await db.getAllAsync<Pick<ActivityTime, 'ActivityID' | 'ActivityDate' | 'Hours'>>(
        `SELECT t.[ActivityID], t.[ActivityDate], t.[Hours] FROM [ActivityTime] t
           JOIN [Activities] a ON a.[id] = t.[ActivityID]
          WHERE a.[CouncilID] = ?`,
        [councilId],
      );
      return summarizeActivities(activities, times);
    },
  };

  private async assertActivityReferences(db: SQLite.SQLiteDatabase, clean: NewActivity): Promise<void> {
    await this.assertCouncilsExist(db, [clean.CouncilID]);
    await this.assertRowExists(db, 'Category', clean.CategoryID, 'activity category');
  }

  private async assertActivityNameUnique(db: SQLite.SQLiteDatabase, clean: NewActivity, ignoreId?: number): Promise<void> {
    const siblings = await db.getAllAsync<Record<string, unknown>>(
      'SELECT [id], [ActivityName] FROM [Activities] WHERE [CouncilID] = ?',
      [clean.CouncilID],
    );
    assertRecordValueUnique('Activities', siblings, 'ActivityName', clean.ActivityName, `in council ${clean.CouncilID}`, ignoreId);
  }

  distributionLists: DataService['distributionLists'] = {
    listByCouncil: async (councilId) => {
      const db = await this.ready();
      const lists = await db.getAllAsync<DistributionLists>(
        'SELECT * FROM [DistributionLists] WHERE [CouncilID] = ? ORDER BY [ListName] COLLATE NOCASE, [id]',
        [councilId],
      );
      const members = await db.getAllAsync<{ ListID: number; MemberID: number }>(
        `SELECT m.[ListID], m.[MemberID] FROM [DistributionListMembers] m
           JOIN [DistributionLists] l ON l.[id] = m.[ListID]
          WHERE l.[CouncilID] = ? ORDER BY m.[MemberID]`,
        [councilId],
      );
      return lists.map((list) => ({ list, memberIds: members.filter((m) => m.ListID === list.id).map((m) => m.MemberID) }));
    },

    create: async (actorId, list) => {
      const clean = cleanNewDistributionList(list);
      const db = await this.ready();
      assertMayMaintainCouncilRecords(await this.memberWriteActor(db, actorId), clean.CouncilID, 'create distribution lists');
      let id = 0;
      await db.withTransactionAsync(async () => {
        await this.assertCouncilsExist(db, [clean.CouncilID]);
        await this.assertListNameUnique(db, clean.CouncilID, clean.ListName);
        await this.assertListMembers(db, clean.CouncilID, clean.memberIds);
        const res = await db.runAsync('INSERT INTO [DistributionLists] ([ListName], [CouncilID], [CreatedBy]) VALUES (?, ?, ?)', [
          clean.ListName,
          clean.CouncilID,
          actorId,
        ]);
        id = res.lastInsertRowId;
        await this.insertListMembers(db, id, clean.memberIds);
      });
      return this.listSummary(db, id);
    },

    update: async (actorId, id, changes) => {
      const db = await this.ready();
      await db.withTransactionAsync(async () => {
        const actor = await this.memberWriteActor(db, actorId);
        const row = await this.requireRecord(db, 'DistributionLists', id);
        const councilId = (row.CouncilID as number | null) ?? 0;
        assertMayMaintainCouncilRecords(actor, councilId, `change distribution list ${id}`);
        const clean = cleanDistributionListChanges(changes);
        if (clean.ListName !== undefined) {
          await this.assertListNameUnique(db, councilId, clean.ListName, id);
          await db.runAsync('UPDATE [DistributionLists] SET [ListName] = ? WHERE [id] = ?', [clean.ListName, id]);
        }
        if (clean.memberIds !== undefined) {
          await this.assertListMembers(db, councilId, clean.memberIds);
          await db.runAsync('DELETE FROM [DistributionListMembers] WHERE [ListID] = ?', [id]);
          await this.insertListMembers(db, id, clean.memberIds);
        }
      });
      return this.listSummary(db, id);
    },

    remove: async (actorId, id) => {
      const db = await this.ready();
      await db.withTransactionAsync(async () => {
        const actor = await this.memberWriteActor(db, actorId);
        const row = await this.requireRecord(db, 'DistributionLists', id);
        assertMayMaintainCouncilRecords(actor, (row.CouncilID as number | null) ?? 0, `delete distribution list ${id}`);
        await db.runAsync('DELETE FROM [DistributionListMembers] WHERE [ListID] = ?', [id]);
        await db.runAsync('DELETE FROM [DistributionLists] WHERE [id] = ?', [id]);
      });
    },
  };

  private async listSummary(db: SQLite.SQLiteDatabase, id: number): Promise<DistributionListSummary> {
    const list = (await db.getFirstAsync<DistributionLists>('SELECT * FROM [DistributionLists] WHERE [id] = ?', [id]))!;
    const members = await db.getAllAsync<{ MemberID: number }>(
      'SELECT [MemberID] FROM [DistributionListMembers] WHERE [ListID] = ? ORDER BY [MemberID]',
      [id],
    );
    return { list, memberIds: members.map((m) => m.MemberID) };
  }

  private async assertListNameUnique(db: SQLite.SQLiteDatabase, councilId: number, name: string, ignoreId?: number): Promise<void> {
    const siblings = await db.getAllAsync<Record<string, unknown>>(
      'SELECT [id], [ListName] FROM [DistributionLists] WHERE [CouncilID] = ?',
      [councilId],
    );
    assertRecordValueUnique('DistributionLists', siblings, 'ListName', name, `in council ${councilId}`, ignoreId);
  }

  /** Every list member must exist and belong to the list's council. */
  private async assertListMembers(db: SQLite.SQLiteDatabase, councilId: number, memberIds: readonly number[]): Promise<void> {
    const found = await selectIn<{ id: number; CouncilID: number }>(
      db,
      (m) => `SELECT [id], [CouncilID] FROM [Member] WHERE [id] IN (${m})`,
      memberIds,
    );
    for (const memberId of memberIds) {
      const member = found.find((f) => f.id === memberId);
      if (!member || member.CouncilID !== councilId) {
        throw new BusinessRuleError(
          'INVALID_INPUT',
          member
            ? `Member ${memberId} belongs to council ${member.CouncilID}, not council ${councilId}; a distribution list holds only its own council's members.`
            : `No member with id ${memberId}.`,
          { memberId, councilId },
        );
      }
    }
  }

  private async insertListMembers(db: SQLite.SQLiteDatabase, listId: number, memberIds: readonly number[]): Promise<void> {
    for (const memberId of memberIds) {
      await db.runAsync('INSERT INTO [DistributionListMembers] ([ListID], [MemberID]) VALUES (?, ?)', [listId, memberId]);
    }
  }

  // ---- maintenance helpers ------------------------------------------------
  // `table` is always a MaintainedTable and `columns` one of the shared *_COLUMNS lists, never caller input.

  private async requireRecord(db: SQLite.SQLiteDatabase, table: MaintainedTable, id: number): Promise<Record<string, unknown>> {
    const row = await db.getFirstAsync<Record<string, unknown>>(`SELECT * FROM [${table}] WHERE [id] = ?`, [id]);
    if (!row) throw recordNotFound(table, id);
    return row;
  }

  private async insertRecord<T extends object>(
    db: SQLite.SQLiteDatabase,
    table: MaintainedTable,
    columns: readonly (keyof T & string)[],
    clean: T,
  ): Promise<number> {
    const res = await db.runAsync(
      `INSERT INTO [${table}] (${columns.map((c) => `[${c}]`).join(', ')}) VALUES (${marks(columns.length)})`,
      columns.map((c) => (clean[c] ?? null) as Bind),
    );
    return res.lastInsertRowId;
  }

  private async updateRecord<T extends object>(
    db: SQLite.SQLiteDatabase,
    table: MaintainedTable,
    id: number,
    columns: readonly (keyof T & string)[],
    clean: T,
  ): Promise<void> {
    await db.runAsync(`UPDATE [${table}] SET ${columns.map((c) => `[${c}] = ?`).join(', ')} WHERE [id] = ?`, [
      ...columns.map((c) => (clean[c] ?? null) as Bind),
      id,
    ]);
  }

  private async assertRecordUnused(db: SQLite.SQLiteDatabase, table: MaintainedTable, id: number, name: string): Promise<void> {
    const usage = [];
    for (const ref of RECORD_REFERENCES[table]) {
      const found = await db.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM [${ref.table}] WHERE [${ref.column}] = ?`, [id]);
      usage.push({ ...ref, count: found?.n ?? 0 });
    }
    assertRecordUnused(table, id, name, usage);
  }

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

    create: async (actorId, member) => {
      const clean = cleanNewMember(member, this.now());
      const db = await this.ready();
      let id = 0;
      await db.withTransactionAsync(async () => {
        assertMayCreateMember(await this.memberWriteActor(db, actorId), clean, await this.memberTypeName(db, clean.MemberTypeID));
        await this.assertMemberReferences(db, clean);
        const taken = await db.getFirstAsync<{ n: number }>(
          `SELECT (SELECT COUNT(*) FROM [Member] WHERE [Email] = ? COLLATE NOCASE)
                + (SELECT COUNT(*) FROM [Credentials] WHERE [Username] = ? COLLATE NOCASE) AS n`,
          [clean.Email, clean.Email],
        );
        if ((taken?.n ?? 0) > 0) {
          throw new BusinessRuleError('INVALID_INPUT', `The email ${clean.Email} already belongs to a member or login.`, {
            email: clean.Email,
          });
        }
        const cred = await db.runAsync('INSERT INTO [Credentials] ([Username], [Password]) VALUES (?, ?)', [
          clean.Email,
          UNREGISTERED_PASSWORD,
        ]);
        const cols = MEMBER_COLUMNS.filter((c) => clean[c] != null);
        const res = await db.runAsync(
          `INSERT INTO [Member] (${cols.map((c) => `[${c}]`).join(', ')}, [CredentialID]) VALUES (${marks(cols.length + 1)})`,
          [...cols.map((c) => clean[c] as Bind), cred.lastInsertRowId],
        );
        id = res.lastInsertRowId;
      });
      const created = (await db.getFirstAsync<Member>('SELECT * FROM [Member] WHERE [id] = ?', [id]))!;
      await this.sendWelcomeEmail(db, created);
      return created;
    },

    update: async (actorId, id, changes) => {
      const db = await this.ready();
      await db.withTransactionAsync(async () => {
        const actor = await this.memberWriteActor(db, actorId);
        const existing = await db.getFirstAsync<Member>('SELECT * FROM [Member] WHERE [id] = ?', [id]);
        if (!existing) throw new BusinessRuleError('MEMBER_NOT_FOUND', `No member with id ${id}.`, { memberId: id });
        const clean = mergeMemberChanges(existing, changes, this.now());
        assertMayUpdateMember(actor, existing, clean, {
          current: await this.memberTypeName(db, existing.MemberTypeID),
          next: await this.memberTypeName(db, clean.MemberTypeID),
        });
        await this.assertMemberReferences(db, clean);
        const taken = await db.getFirstAsync<{ n: number }>(
          `SELECT (SELECT COUNT(*) FROM [Member] WHERE [Email] = ? COLLATE NOCASE AND [id] <> ?)
                + (SELECT COUNT(*) FROM [Credentials] WHERE [Username] = ? COLLATE NOCASE AND [id] <> ?) AS n`,
          [clean.Email, id, clean.Email, existing.CredentialID],
        );
        if ((taken?.n ?? 0) > 0) {
          throw new BusinessRuleError('INVALID_INPUT', `The email ${clean.Email} already belongs to a member or login.`, {
            email: clean.Email,
          });
        }
        await db.runAsync('UPDATE [Credentials] SET [Username] = ? WHERE [id] = ?', [clean.Email, existing.CredentialID]);
        await db.runAsync(`UPDATE [Member] SET ${MEMBER_COLUMNS.map((c) => `[${c}] = ?`).join(', ')} WHERE [id] = ?`, [
          ...MEMBER_COLUMNS.map((c) => (clean[c] ?? null) as Bind),
          id,
        ]);
      });
      return (await db.getFirstAsync<Member>('SELECT * FROM [Member] WHERE [id] = ?', [id]))!;
    },
  };

  /** The caller of a member write, read from the database so the client cannot claim a type it does not hold. */
  private async memberWriteActor(db: SQLite.SQLiteDatabase, actorId: number): Promise<MemberWriteActor> {
    const actor = await db.getFirstAsync<{ councilId: number; type: string | null; active: number }>(
      `SELECT m.[CouncilID] AS councilId, t.[Type] AS type, (st.[Status] = 'Active') AS active FROM [Member] m
         LEFT JOIN [MemberType] t ON t.[id] = m.[MemberTypeID]
         LEFT JOIN [MemberStatus] st ON st.[id] = m.[StatusID]
        WHERE m.[id] = ?`,
      [actorId],
    );
    if (!actor) throw new BusinessRuleError('MEMBER_NOT_FOUND', `No member with id ${actorId}.`, { memberId: actorId });
    const roles = await db.getAllAsync<{ Role: string }>(
      'SELECT r.[Role] FROM [MemberRoles] mr JOIN [Role] r ON r.[id] = mr.[RoleID] WHERE mr.[MemberID] = ? ORDER BY r.[id]',
      [actorId],
    );
    return {
      memberId: actorId,
      councilId: actor.councilId,
      memberType: actor.type ?? undefined,
      active: actor.active === 1,
      roles: roles.map((r) => r.Role),
    };
  }

  private async memberTypeName(db: SQLite.SQLiteDatabase, typeId: number): Promise<string | undefined> {
    return (await db.getFirstAsync<{ Type: string }>('SELECT [Type] FROM [MemberType] WHERE [id] = ?', [typeId]))?.Type;
  }

  /** The council and lookup ids a member row points at must exist. */
  private async assertMemberReferences(db: SQLite.SQLiteDatabase, clean: NewMember): Promise<void> {
    await this.assertCouncilsExist(db, [clean.CouncilID]);
    await this.assertRowExists(db, 'MemberStatus', clean.StatusID, 'member status');
    await this.assertRowExists(db, 'Degree', clean.DegreeID, 'degree');
    await this.assertRowExists(db, 'MemberType', clean.MemberTypeID, 'member type');
    if (clean.WorkingStatusID != null) await this.assertRowExists(db, 'WorkingStatus', clean.WorkingStatusID, 'working status');
  }

  /** System hook after members.create commits: compiles the welcome email and logs it (no mail server yet). */
  private async sendWelcomeEmail(db: SQLite.SQLiteDatabase, member: Member): Promise<void> {
    try {
      const council = (await db.getFirstAsync<Council>('SELECT * FROM [Council] WHERE [id] = ?', [member.CouncilID]))!;
      const admin = await db.getFirstAsync<{ first: string; last: string; Email: string; Phone: string }>(
        `SELECT m.[MemberFirstName] AS first, m.[MemberLastName] AS last, m.[Email], m.[Phone] FROM [Member] m
          WHERE ${ACTIVE_MEMBER_FILTER} AND m.[id] <> ?
            AND m.[MemberTypeID] = (SELECT [id] FROM [MemberType] WHERE [Type] = 'Admin')
          ORDER BY m.[MemberLastName], m.[MemberFirstName], m.[id] LIMIT 1`,
        [member.CouncilID, member.id],
      );
      const details: CouncilAdminDetails | null = admin
        ? { name: `${admin.first} ${admin.last}`, email: admin.Email, phone: admin.Phone }
        : null;
      this.log('[notification]', JSON.stringify(buildWelcomeEmail({ member, council, admin: details }), null, 2));
    } catch (err) {
      // The member is already saved; a failed notification must not undo or fail that.
      console.error('[notification] welcome email failed:', err);
    }
  }

  /** Friendly INVALID_INPUT for a foreign key the generic constraint message would explain poorly. `table` is always a literal. */
  private async assertRowExists(db: SQLite.SQLiteDatabase, table: string, id: number, label: string): Promise<void> {
    if (!(await db.getFirstAsync(`SELECT [id] FROM [${table}] WHERE [id] = ?`, [id]))) {
      throw new BusinessRuleError('INVALID_INPUT', `No ${label} with id ${id}.`, { table, id });
    }
  }

  // ---- Phase 2: member profiles, skill messaging, donations -------------

  memberProfiles: DataService['memberProfiles'] = {
    listOptions: async () => {
      const db = await this.ready();
      const options: ProfileOptions = {
        skills: await db.getAllAsync<Skill>('SELECT * FROM [Skill] ORDER BY [SkillName], [id]'),
        skillLevels: await db.getAllAsync<SkillLevel>('SELECT * FROM [SkillLevel] ORDER BY [id]'),
        trainingClasses: await db.getAllAsync<KOCTrainingClasses>('SELECT * FROM [KOCTrainingClasses] ORDER BY [ClassName], [id]'),
        workingStatuses: await db.getAllAsync<WorkingStatus>('SELECT * FROM [WorkingStatus] ORDER BY [id]'),
      };
      return options;
    },

    getExtensions: async (memberId) => {
      const db = await this.ready();
      await this.requireMember(db, memberId);
      return this.extensionsOf(db, memberId);
    },

    updateExtensions: async (actorId, memberId, skills, training, workingStatusId) => {
      const clean = cleanMemberExtensions(skills, training, workingStatusId, this.now());
      const db = await this.ready();
      await db.withTransactionAsync(async () => {
        const actor = await this.memberWriteActor(db, actorId);
        await this.requireMember(db, memberId);
        const target = (await db.getFirstAsync<{ CouncilID: number }>('SELECT [CouncilID] FROM [Member] WHERE [id] = ?', [memberId]))!;
        assertMayEditMemberExtensions(actor, { id: memberId, CouncilID: target.CouncilID });
        for (const s of clean.skills) {
          await this.assertRowExists(db, 'Skill', s.skillId, 'skill');
          await this.assertRowExists(db, 'SkillLevel', s.skillLevelId, 'skill level');
        }
        for (const t of clean.training) await this.assertRowExists(db, 'KOCTrainingClasses', t.trainingClassId, 'training class');
        if (clean.workingStatusId !== null) await this.assertRowExists(db, 'WorkingStatus', clean.workingStatusId, 'working status');

        await db.runAsync('DELETE FROM [MemberSkill] WHERE [MemberID] = ?', [memberId]);
        for (const s of clean.skills) {
          await db.runAsync('INSERT INTO [MemberSkill] ([SkillID], [SkillLevelID], [MemberID]) VALUES (?, ?, ?)', [
            s.skillId,
            s.skillLevelId,
            memberId,
          ]);
        }
        await db.runAsync('DELETE FROM [MemberTraining] WHERE [MemberID] = ?', [memberId]);
        for (const t of clean.training) {
          await db.runAsync('INSERT INTO [MemberTraining] ([MemberID], [TrainingClassID], [YearTaken]) VALUES (?, ?, ?)', [
            memberId,
            t.trainingClassId,
            trainingYearToDate(t.year),
          ]);
        }
        await db.runAsync('UPDATE [Member] SET [WorkingStatusID] = ? WHERE [id] = ?', [clean.workingStatusId, memberId]);
      });
      return this.extensionsOf(db, memberId);
    },
  };

  private async extensionsOf(db: SQLite.SQLiteDatabase, memberId: number): Promise<MemberExtensions> {
    const member = await db.getFirstAsync<{ WorkingStatusID: number | null }>('SELECT [WorkingStatusID] FROM [Member] WHERE [id] = ?', [
      memberId,
    ]);
    const workingStatus =
      member?.WorkingStatusID == null
        ? null
        : ((await db.getFirstAsync<WorkingStatus>('SELECT * FROM [WorkingStatus] WHERE [id] = ?', [member.WorkingStatusID])) ?? null);
    const skills = new Map((await db.getAllAsync<Skill>('SELECT * FROM [Skill]')).map((r) => [r.id, r]));
    const levels = new Map((await db.getAllAsync<SkillLevel>('SELECT * FROM [SkillLevel]')).map((r) => [r.id, r]));
    const classes = new Map((await db.getAllAsync<KOCTrainingClasses>('SELECT * FROM [KOCTrainingClasses]')).map((r) => [r.id, r]));
    const skillRows = await db.getAllAsync<MemberSkill>('SELECT * FROM [MemberSkill] WHERE [MemberID] = ? ORDER BY [id]', [memberId]);
    const trainingRows = await db.getAllAsync<MemberTraining>(
      'SELECT * FROM [MemberTraining] WHERE [MemberID] = ? ORDER BY [YearTaken] DESC, [id]',
      [memberId],
    );
    return {
      workingStatus,
      skills: skillRows.map((row) => ({ row, skill: skills.get(row.SkillID)!, level: levels.get(row.SkillLevelID)! })),
      training: trainingRows.map((row) => ({
        row,
        trainingClass: classes.get(row.TrainingClassID)!,
        year: trainingDateToYear(row.YearTaken),
      })),
    };
  }

  communication: DataService['communication'] = {
    listCouncilSkills: async (councilId) => {
      const db = await this.ready();
      const rows = await db.getAllAsync<{
        memberId: number;
        firstName: string;
        lastName: string;
        phone: string;
        email: string;
        skillId: number;
        SkillName: string;
        levelId: number;
        SkillLevel: string;
      }>(
        `SELECT m.[id] AS memberId, m.[MemberFirstName] AS firstName, m.[MemberLastName] AS lastName,
                m.[Phone] AS phone, m.[Email] AS email,
                s.[id] AS skillId, s.[SkillName], sl.[id] AS levelId, sl.[SkillLevel]
           FROM [MemberSkill] ms
           JOIN [Member] m ON m.[id] = ms.[MemberID]
           JOIN [Skill] s ON s.[id] = ms.[SkillID]
           JOIN [SkillLevel] sl ON sl.[id] = ms.[SkillLevelID]
          WHERE m.[CouncilID] = ?
          ORDER BY s.[SkillName], m.[MemberLastName], m.[MemberFirstName], m.[id]`,
        [councilId],
      );
      return rows.map(
        (r): CouncilSkillEntry => ({
          memberId: r.memberId,
          firstName: r.firstName,
          lastName: r.lastName,
          phone: r.phone,
          email: r.email,
          skill: { id: r.skillId, SkillName: r.SkillName },
          level: { id: r.levelId, SkillLevel: r.SkillLevel },
        }),
      );
    },

    sendBulkToSkills: async (councilId, skillId, messageText, senderId) => {
      assertText(messageText, 'Message', 10_000);
      const db = await this.ready();
      await this.assertCouncilsExist(db, [councilId]);
      const skill = await db.getFirstAsync<Skill>('SELECT * FROM [Skill] WHERE [id] = ?', [skillId]);
      if (!skill) throw new BusinessRuleError('INVALID_INPUT', `No skill with id ${skillId}.`, { skillId });
      const rows = await db.getAllAsync<{ id: number }>(
        `SELECT m.[id] FROM [Member] m
          WHERE ${ACTIVE_MEMBER_FILTER} AND m.[id] <> ?
            AND EXISTS (SELECT 1 FROM [MemberSkill] ms WHERE ms.[MemberID] = m.[id] AND ms.[SkillID] = ?)
          ORDER BY m.[id]`,
        [councilId, senderId, skillId],
      );
      const recipientIds = rows.map((r) => r.id);
      if (recipientIds.length === 0) {
        throw new BusinessRuleError(
          'NO_RECIPIENTS',
          `No other active member of council ${councilId} has the skill "${skill.SkillName}", so there is nobody to message.`,
          { councilId, skillId },
        );
      }
      const message = await this.messages.send({ senderId, councilId, recipientIds, text: messageText });
      return { message, recipientIds };
    },
  };

  donations: DataService['donations'] = {
    listMethods: async (councilId) => {
      const db = await this.ready();
      const rows = await db.getAllAsync<CouncilDonationMethod & { MethodName: string }>(
        `SELECT cdm.*, dm.[DonationMethod] AS MethodName FROM [CouncilDonationMethod] cdm
           JOIN [DonationMethod] dm ON dm.[id] = cdm.[DonationMethodID]
          WHERE cdm.[CouncilID] = ? ORDER BY dm.[id], cdm.[id]`,
        [councilId],
      );
      return rows.map(({ MethodName, ...link }) => ({
        method: { id: link.DonationMethodID, DonationMethod: MethodName },
        kind: donationMethodKind(MethodName),
        link,
        qrCodeUrl: link.DonationMethodURL || null,
      }));
    },

    listAllMethods: async () => {
      const db = await this.ready();
      return db.getAllAsync<DonationMethod>('SELECT [id], [DonationMethod] FROM [DonationMethod] ORDER BY [id]');
    },

    listTypes: async (councilId) => {
      const db = await this.ready();
      return db.getAllAsync<DonationType>('SELECT * FROM [DonationType] WHERE [CouncilID] = ? ORDER BY [DonationType], [id]', [
        councilId,
      ]);
    },

    list: async (councilId, options) => {
      const db = await this.ready();
      const byEvent = options?.eventId !== undefined;
      return db.getAllAsync<Donation>(
        `SELECT * FROM [Donation] WHERE [CouncilID] = ?${byEvent ? ' AND [EventID] = ?' : ''}
          ORDER BY [DonationDate] DESC, [id] DESC`,
        byEvent ? [councilId, options!.eventId!] : [councilId],
      );
    },

    listHistory: async (councilId, eventId) => {
      const db = await this.ready();
      let events: CouncilEvent[];
      let donations: Donation[];
      if (eventId === undefined) {
        events = await db.getAllAsync<CouncilEvent>(
          'SELECT * FROM [Event] WHERE [id] IN (SELECT [EventID] FROM [EventCouncils] WHERE [CouncilID] = ?)',
          [councilId],
        );
        donations = await db.getAllAsync<Donation>(
          `SELECT * FROM [Donation]
            WHERE ([EventID] IS NULL AND [CouncilID] = ?)
               OR [EventID] IN (SELECT [EventID] FROM [EventCouncils] WHERE [CouncilID] = ?)`,
          [councilId, councilId],
        );
      } else {
        const event = await this.requireEvent(db, eventId);
        await this.assertEventLinked(db, event, councilId);
        events = [event];
        donations = await db.getAllAsync<Donation>('SELECT * FROM [Donation] WHERE [EventID] = ?', [eventId]);
      }
      const recorders = [...new Set(donations.map((d) => d.RecordedBy).filter((id): id is number => id != null))];
      const members = await selectIn<{ id: number; MemberFirstName: string; MemberLastName: string }>(
        db,
        (m) => `SELECT [id], [MemberFirstName], [MemberLastName] FROM [Member] WHERE [id] IN (${m})`,
        recorders,
      );
      return buildDonationHistory(councilId, eventId, {
        donations,
        events,
        methods: await db.getAllAsync<DonationMethod>('SELECT * FROM [DonationMethod]'),
        types: await db.getAllAsync<DonationType>('SELECT * FROM [DonationType]'),
        names: new Map(members.map((m) => [m.id, `${m.MemberFirstName} ${m.MemberLastName}`])),
      });
    },

    record: async (actorId, donation) => {
      const clean = cleanNewDonation(donation, this.now());
      const db = await this.ready();
      let id = 0;
      await db.withTransactionAsync(async () => {
        await this.requireMember(db, actorId);
        await this.assertDonationReferences(db, clean);
        await this.withFundsSync(db, [clean.EventID], async () => {
          const res = await db.runAsync(
            `INSERT INTO [Donation] ([CouncilID], [DonationDate], [DonationMethodID], [DonationTypeID], [Donor],
                                     [DonationDesciption], [EventID], [DonationAmount], [DonationPhotoURL], [RecordedBy])
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              clean.CouncilID,
              clean.DonationDate,
              clean.DonationMethodID,
              clean.DonationTypeID,
              clean.Donor ?? null,
              clean.DonationDesciption ?? null,
              clean.EventID ?? null,
              clean.DonationAmount,
              clean.DonationPhotoURL ?? null,
              actorId,
            ],
          );
          id = res.lastInsertRowId;
        });
      });
      return (await db.getFirstAsync<Donation>('SELECT * FROM [Donation] WHERE [id] = ?', [id]))!;
    },

    update: async (actorId, id, changes) => {
      const db = await this.ready();
      await db.withTransactionAsync(async () => {
        const actor = await this.memberWriteActor(db, actorId);
        const existing = await this.requireDonation(db, id);
        assertMayChangeDonation(actor, existing, await this.eventOwnerOf(db, existing.EventID), `change donation ${id}`);
        const clean = mergeDonationChanges(existing, changes, this.now());
        if ((clean.EventID ?? null) !== (existing.EventID ?? null)) {
          assertMayChangeDonation(actor, existing, await this.eventOwnerOf(db, clean.EventID), `move donation ${id} to another event`);
        }
        await this.assertDonationReferences(db, clean);
        await this.withFundsSync(db, [existing.EventID, clean.EventID], async () => {
          await db.runAsync(`UPDATE [Donation] SET ${DONATION_EDITABLE_COLUMNS.map((c) => `[${c}] = ?`).join(', ')} WHERE [id] = ?`, [
            ...DONATION_EDITABLE_COLUMNS.map((c) => (clean[c] ?? null) as Bind),
            id,
          ]);
        });
      });
      return this.requireDonation(db, id);
    },

    remove: async (actorId, id) => {
      const db = await this.ready();
      await db.withTransactionAsync(async () => {
        const actor = await this.memberWriteActor(db, actorId);
        const existing = await this.requireDonation(db, id);
        assertMayChangeDonation(actor, existing, await this.eventOwnerOf(db, existing.EventID), `delete donation ${id}`);
        await this.withFundsSync(db, [existing.EventID], async () => {
          await db.runAsync('DELETE FROM [Donation] WHERE [id] = ?', [id]);
        });
      });
    },
  };

  /** The ids a donation points at must exist and belong together (method enabled, the council's type and event). */
  private async assertDonationReferences(db: SQLite.SQLiteDatabase, clean: CleanDonation): Promise<void> {
    await this.assertCouncilsExist(db, [clean.CouncilID]);
    const method = await db.getFirstAsync<{ DonationMethod: string }>('SELECT [DonationMethod] FROM [DonationMethod] WHERE [id] = ?', [
      clean.DonationMethodID,
    ]);
    if (!method) {
      throw new BusinessRuleError('INVALID_INPUT', `No donation method with id ${clean.DonationMethodID}.`, {
        donationMethodId: clean.DonationMethodID,
      });
    }
    const enabled = await db.getFirstAsync(
      'SELECT [id] FROM [CouncilDonationMethod] WHERE [CouncilID] = ? AND [DonationMethodID] = ?',
      [clean.CouncilID, clean.DonationMethodID],
    );
    if (!enabled) {
      throw new BusinessRuleError(
        'DONATION_METHOD_NOT_ENABLED',
        `Council ${clean.CouncilID} has not enabled ${method.DonationMethod} donations.`,
        { councilId: clean.CouncilID, donationMethodId: clean.DonationMethodID },
      );
    }
    assertDonationFitsMethod(donationMethodKind(method.DonationMethod), clean);
    if (!(await db.getFirstAsync('SELECT [id] FROM [DonationType] WHERE [id] = ? AND [CouncilID] = ?', [clean.DonationTypeID, clean.CouncilID]))) {
      throw new BusinessRuleError('INVALID_INPUT', `Council ${clean.CouncilID} has no donation type with id ${clean.DonationTypeID}.`, {
        councilId: clean.CouncilID,
        donationTypeId: clean.DonationTypeID,
      });
    }
    if (clean.EventID != null) {
      const event = await this.requireEvent(db, clean.EventID);
      await this.assertEventLinked(db, event, clean.CouncilID);
      assertDonationDateForEvent(clean.DonationDate, event);
    }
  }

  private async assertEventLinked(db: SQLite.SQLiteDatabase, event: CouncilEvent, councilId: number): Promise<void> {
    if (!(await this.councilIdsOf(db, event.id)).includes(councilId)) {
      throw new BusinessRuleError('INVALID_INPUT', `"${event.EventName}" is not linked to council ${councilId}.`, {
        eventId: event.id,
        councilId,
      });
    }
  }

  private async requireDonation(db: SQLite.SQLiteDatabase, id: number): Promise<Donation> {
    const row = await db.getFirstAsync<Donation>('SELECT * FROM [Donation] WHERE [id] = ?', [id]);
    if (!row) throw new BusinessRuleError('RECORD_NOT_FOUND', `No donation with id ${id}.`, { table: 'Donation', id });
    return row;
  }

  private async eventOwnerOf(db: SQLite.SQLiteDatabase, eventId: number | null | undefined): Promise<number | null> {
    if (eventId == null) return null;
    return (await db.getFirstAsync<{ OwnerID: number }>('SELECT [OwnerID] FROM [Event] WHERE [id] = ?', [eventId]))?.OwnerID ?? null;
  }

  /** The event's funds rollup from every donation now stored against it. */
  private async eventFunds(db: SQLite.SQLiteDatabase, eventId: number): Promise<EventFunds | null> {
    const rows = await db.getAllAsync<{ DonationAmount: number; MethodName: string }>(
      `SELECT d.[DonationAmount], dm.[DonationMethod] AS MethodName FROM [Donation] d
         JOIN [DonationMethod] dm ON dm.[id] = d.[DonationMethodID]
        WHERE d.[EventID] = ?`,
      [eventId],
    );
    return rollupEventFunds(rows.map((r) => ({ DonationAmount: r.DonationAmount, kind: donationMethodKind(r.MethodName) })));
  }

  /**
   * The donation write hook: runs `write`, then overwrites the funds columns of every event it touched with
   * the new rollup (see nextEventFunds). Callers are already inside a transaction, so both land together.
   */
  private async withFundsSync(db: SQLite.SQLiteDatabase, eventIds: readonly (number | null | undefined)[], write: () => Promise<void>): Promise<void> {
    const ids = [...new Set(eventIds.filter((id): id is number => id != null))];
    const before: (EventFunds | null)[] = [];
    for (const id of ids) before.push(await this.eventFunds(db, id));
    await write();
    for (const [i, id] of ids.entries()) {
      const next = nextEventFunds(before[i], await this.eventFunds(db, id));
      if (next) {
        await db.runAsync('UPDATE [Event] SET [FundsRaised-Cash] = ?, [FundsRaised-Electronic] = ? WHERE [id] = ?', [
          next['FundsRaised-Cash'],
          next['FundsRaised-Electronic'],
          id,
        ]);
      }
    }
  }

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

    setNoShow: async (actorId, signupId, noShow, reasonId) => {
      const db = await this.ready();
      await db.withTransactionAsync(async () => {
        const actor = await this.memberWriteActor(db, actorId);
        const signup = await db.getFirstAsync<EventSignup>('SELECT * FROM [EventSignup] WHERE [id] = ?', [signupId]);
        if (!signup) throw signupNotFound(signupId);
        const shift = await this.requireShift(db, signup.ShiftID);
        const target = {
          signupId,
          memberId: signup.MemberID,
          eventId: shift.EventID,
          eventCouncilIds: await this.councilIdsOf(db, shift.EventID),
        };
        assertMayMarkNoShow(actor, target, noShow);
        const reasons = await db.getAllAsync<{ id: number }>('SELECT [id] FROM [NoShowReason]');
        const reason = noShowReasonFor(noShow, reasonId, reasons.map((r) => r.id));
        if (noShow) {
          const time = await db.getFirstAsync<{ Hours: number }>('SELECT [Hours] FROM [EventTime] WHERE [ShiftID] = ? AND [MemberID] = ?', [
            shift.id,
            signup.MemberID,
          ]);
          assertNoShowWithoutHours(target, time ? time.Hours : null);
        }
        await db.runAsync('UPDATE [EventSignup] SET [NoShow] = ?, [NoShowReasonID] = ? WHERE [id] = ?', [noShow ? 1 : 0, reason, signupId]);
      });
      return (await db.getFirstAsync<EventSignup>('SELECT * FROM [EventSignup] WHERE [id] = ?', [signupId]))!;
    },

    listCalendarRange: async (councilId, startDate, endDate) => {
      const range = cleanCalendarRange(startDate, endDate);
      const db = await this.ready();
      await this.assertCouncilsExist(db, [councilId]);
      const events = await db.getAllAsync<CouncilEvent>(
        `SELECT * FROM [Event] WHERE [id] IN (SELECT [EventID] FROM [EventCouncils] WHERE [CouncilID] = ?)
            AND [StartDate] <= ? AND [EndDate] >= ?`,
        [councilId, range.endDate, range.startDate],
      );
      const meetings = await db.getAllAsync<Meeting>('SELECT * FROM [Meeting] WHERE [CouncilID] = ? AND [Date] BETWEEN ? AND ?', [
        councilId,
        range.startDate,
        range.endDate,
      ]);
      return buildCalendarEntries(range, events, meetings);
    },

    uploadPhotos: async (actorId, eventId, photoPaths) => {
      const db = await this.ready();
      await db.withTransactionAsync(async () => {
        const actor = await this.memberWriteActor(db, actorId);
        const event = await this.requireEvent(db, eventId);
        assertMayAttachEventMedia(actor, event, await this.councilIdsOf(db, eventId), `add photos to event ${eventId}`);
        const gallery = appendPhotoPaths(event.PhotoGalleryURL, photoPaths);
        await db.runAsync('UPDATE [Event] SET [PhotoGalleryURL] = ? WHERE [id] = ?', [gallery, eventId]);
      });
      return this.requireEvent(db, eventId);
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

    listTurnout: async (eventId) => {
      const db = await this.ready();
      const rows = await db.getAllAsync<{ SignupID: number; MemberFirstName: string; MemberLastName: string; Hours: number | null }>(
        `SELECT es.[id] AS SignupID, m.[MemberFirstName], m.[MemberLastName], et.[Hours]
           FROM [EventSignup] es
           JOIN [Shift] s ON s.[id] = es.[ShiftID]
           JOIN [Member] m ON m.[id] = es.[MemberID]
           LEFT JOIN [EventTime] et ON et.[ShiftID] = es.[ShiftID] AND et.[MemberID] = es.[MemberID]
          WHERE s.[EventID] = ?
          ORDER BY s.[ShiftDate], s.[StartTime], s.[id], m.[MemberLastName], m.[MemberFirstName], es.[id]`,
        [eventId],
      );
      if (rows.length === 0) return [];
      const shifts = new Map(
        (await db.getAllAsync<Shift>('SELECT * FROM [Shift] WHERE [EventID] = ?', [eventId])).map((s) => [s.id, s]),
      );
      const signups = new Map(
        (
          await selectIn<EventSignup>(
            db,
            (m) => `SELECT * FROM [EventSignup] WHERE [id] IN (${m})`,
            rows.map((r) => r.SignupID),
          )
        ).map((e) => [e.id, e]),
      );
      const out: VolunteerTurnout[] = [];
      for (const row of rows) {
        const signup = signups.get(row.SignupID);
        const shift = signup && shifts.get(signup.ShiftID);
        if (!signup || !shift) continue;
        out.push({
          signup,
          shift,
          MemberFirstName: row.MemberFirstName,
          MemberLastName: row.MemberLastName,
          hoursLogged: row.Hours ?? null,
        });
      }
      return out;
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
        assertFundsEditable(row, clean, await this.eventFunds(db, id));
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

    add: async (actorId, eventId, categoryId, description) => {
      const text = assertText(description, 'Lesson learned', 255);
      const db = await this.ready();
      let id = 0;
      await db.withTransactionAsync(async () => {
        const actor = await this.memberWriteActor(db, actorId);
        const event = await this.requireEvent(db, eventId);
        assertMayChangeLesson(actor, event, await this.councilIdsOf(db, eventId), `add lessons to event ${eventId}`);
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

    remove: async (actorId, id) => {
      const db = await this.ready();
      await db.withTransactionAsync(async () => {
        const actor = await this.memberWriteActor(db, actorId);
        const lesson = await db.getFirstAsync<LessonsLearned>('SELECT * FROM [LessonsLearned] WHERE [id] = ?', [id]);
        if (!lesson) throw new BusinessRuleError('INVALID_INPUT', `No lesson learned with id ${id}.`, { id });
        const event = await this.requireEvent(db, lesson.EventID);
        assertMayChangeLesson(actor, event, await this.councilIdsOf(db, event.id), `remove lesson ${id}`);
        await db.runAsync('DELETE FROM [LessonsLearned] WHERE [id] = ?', [id]);
      });
    },

    listGlobalRegistry: async (actorId, filters) => {
      const clean = cleanLessonsRegistryFilters(filters);
      const db = await this.ready();
      const actor = await this.memberWriteActor(db, actorId);
      assertMayReadLessonsRegistry(actor);
      const lessonEvents = 'SELECT [EventID] FROM [LessonsLearned]';
      return buildLessonsRegistry(actor, clean, {
        lessons: await db.getAllAsync<LessonsLearned>('SELECT * FROM [LessonsLearned]'),
        events: await db.getAllAsync<CouncilEvent>(
          `SELECT [id], [EventName], [StartDate], [CategoryID], [OwnerID] FROM [Event] WHERE [id] IN (${lessonEvents})`,
        ),
        eventCouncils: await db.getAllAsync<{ EventID: number; CouncilID: number }>(
          `SELECT [EventID], [CouncilID] FROM [EventCouncils] WHERE [EventID] IN (${lessonEvents})`,
        ),
        councils: await db.getAllAsync<Council>('SELECT [id], [CouncilNumber], [CouncilName] FROM [Council]'),
        categories: await db.getAllAsync<Category>('SELECT * FROM [Category]'),
        lessonCategories: await db.getAllAsync<LessonsLearnedCategory>('SELECT * FROM [LessonsLearnedCategory]'),
      });
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

    listByActivity: async (activityId) => {
      const db = await this.ready();
      const activity = await db.getFirstAsync<Activities>('SELECT * FROM [Activities] WHERE [id] = ?', [activityId]);
      if (!activity) throw new BusinessRuleError('ACTIVITY_NOT_FOUND', `No activity with id ${activityId}.`, { activityId });
      const times = await db.getAllAsync<ActivityTime>('SELECT * FROM [ActivityTime] WHERE [ActivityID] = ?', [activityId]);
      const members = await db.getAllAsync<{ id: number; MemberFirstName: string; MemberLastName: string }>(
        `SELECT [id], [MemberFirstName], [MemberLastName] FROM [Member]
          WHERE [id] IN (SELECT [MemberID] FROM [ActivityTime] WHERE [ActivityID] = ?)`,
        [activityId],
      );
      return buildActivityTimeLog(activity, times, new Map(members.map((m) => [m.id, m])));
    },
  };

  reports: DataService['reports'] = {
    monthlySummary: async (councilId, year, month) => {
      const { fromDate, toDate } = monthBounds(year, month);
      const db = await this.ready();
      await this.assertCouncilsExist(db, [councilId]);
      const councilEvents = 'SELECT [EventID] FROM [EventCouncils] WHERE [CouncilID] = ?';
      return summarizeMonth(councilId, year, month, {
        events: await db.getAllAsync<CouncilEvent>(
          `SELECT * FROM [Event] WHERE [id] IN (${councilEvents}) AND [StartDate] BETWEEN ? AND ?`,
          [councilId, fromDate, toDate],
        ),
        eventTime: await db.getAllAsync<{ MemberID: number; Hours: number }>(
          `SELECT t.[MemberID], t.[Hours] FROM [EventTime] t
             JOIN [Shift] sh ON sh.[id] = t.[ShiftID]
            WHERE sh.[EventID] IN (${councilEvents}) AND sh.[ShiftDate] BETWEEN ? AND ?`,
          [councilId, fromDate, toDate],
        ),
        activityTime: await db.getAllAsync<{ MemberID: number; Hours: number }>(
          `SELECT t.[MemberID], t.[Hours] FROM [ActivityTime] t
             JOIN [Activities] a ON a.[id] = t.[ActivityID]
            WHERE a.[CouncilID] = ? AND t.[ActivityDate] BETWEEN ? AND ?`,
          [councilId, fromDate, toDate],
        ),
      });
    },

    listNoShowsAudit: async (councilId, dateThreshold) => {
      const threshold = noShowAuditThreshold(dateThreshold, this.now());
      const db = await this.ready();
      await this.assertCouncilsExist(db, [councilId]);
      // LEFT JOIN, like view_NoShows: a no-show without a recorded reason is still audited.
      const found = await db.getAllAsync<{
        signupId: number;
        reasonId: number | null;
        code: NoShowReason['NoShowReasonCode'] | null;
        description: string | null;
      }>(
        `SELECT su.[id] AS signupId, r.[id] AS reasonId, r.[NoShowReasonCode] AS code, r.[NoShowReasonDescription] AS description
           FROM [EventSignup] su
           JOIN [Shift] sh ON sh.[id] = su.[ShiftID]
           JOIN [Member] m ON m.[id] = su.[MemberID]
           LEFT JOIN [NoShowReason] r ON r.[id] = su.[NoShowReasonID]
          WHERE su.[NoShow] = 1 AND m.[CouncilID] = ? AND sh.[ShiftDate] >= ?`,
        [councilId, threshold],
      );
      const context = await this.signupContexts(db, found.map((f) => f.signupId));
      return buildNoShowAudit(
        found.map((f) => ({
          ...context.get(f.signupId)!,
          reason: f.reasonId === null ? null : { id: f.reasonId, NoShowReasonCode: f.code!, NoShowReasonDescription: f.description! },
        })),
      );
    },

    listShiftsAwaitingHours: async (councilId) => {
      const now = this.now();
      const db = await this.ready();
      await this.assertCouncilsExist(db, [councilId]);
      const found = await db.getAllAsync<{ signupId: number }>(
        `SELECT su.[id] AS signupId
           FROM [EventSignup] su
           JOIN [Shift] sh ON sh.[id] = su.[ShiftID]
          WHERE su.[NoShow] = 0 AND sh.[ShiftDate] < ?
            AND sh.[EventID] IN (SELECT [EventID] FROM [EventCouncils] WHERE [CouncilID] = ?)
            AND NOT EXISTS (SELECT 1 FROM [EventTime] t WHERE t.[ShiftID] = su.[ShiftID] AND t.[MemberID] = su.[MemberID])`,
        [toIsoDate(now), councilId],
      );
      const context = await this.signupContexts(db, found.map((f) => f.signupId));
      return buildShiftsAwaitingHours(found.map((f) => context.get(f.signupId)!), now);
    },
  };

  /** Each signup with its shift, event and member, keyed by signup id, for the audits. */
  private async signupContexts(db: SQLite.SQLiteDatabase, signupIds: readonly number[]): Promise<Map<number, SignupContextRow>> {
    const distinct = (ids: number[]) => [...new Set(ids)];
    const signups = await selectIn<EventSignup>(db, (m) => `SELECT * FROM [EventSignup] WHERE [id] IN (${m})`, signupIds);
    const shifts = new Map(
      (await selectIn<Shift>(db, (m) => `SELECT * FROM [Shift] WHERE [id] IN (${m})`, distinct(signups.map((s) => s.ShiftID)))).map((s) => [s.id, s]),
    );
    const events = new Map(
      (
        await selectIn<CouncilEvent>(db, (m) => `SELECT * FROM [Event] WHERE [id] IN (${m})`, distinct([...shifts.values()].map((s) => s.EventID)))
      ).map((e) => [e.id, e]),
    );
    const members = new Map(
      (
        await selectIn<SignupContextRow['member']>(
          db,
          (m) => `SELECT [id], [MemberNumber], [MemberFirstName], [MemberLastName], [Phone], [Email] FROM [Member] WHERE [id] IN (${m})`,
          distinct(signups.map((s) => s.MemberID)),
        )
      ).map((mb) => [mb.id, mb]),
    );
    return new Map(
      signups.map((signup) => {
        const shift = shifts.get(signup.ShiftID)!;
        return [signup.id, { signup, shift, event: events.get(shift.EventID)!, member: members.get(signup.MemberID)! }];
      }),
    );
  }

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
      // MinutesURL is NOT NULL in Schema.sql, so "no minutes" is stored as ''.
      const url = minutesUrl === null ? '' : assertText(minutesUrl, 'Minutes link', 255);
      const db = await this.ready();
      const res = await db.runAsync('UPDATE [Meeting] SET [MinutesURL] = ? WHERE [id] = ?', [url, meetingId]);
      if (res.changes === 0) throw new BusinessRuleError('MEETING_NOT_FOUND', `No meeting with id ${meetingId}.`, { meetingId });
      return (await db.getFirstAsync<Meeting>('SELECT * FROM [Meeting] WHERE [id] = ?', [meetingId]))!;
    },

    linkGoogleDrive: async (actorId, meetingId, minutesUrl, flyerUrl) => {
      const minutes = cleanGoogleDriveUrl(minutesUrl, 'Google Drive minutes link');
      const flyer = cleanGoogleDriveUrl(flyerUrl, 'Google Drive flyer link');
      const db = await this.ready();
      await db.withTransactionAsync(async () => {
        const actor = await this.memberWriteActor(db, actorId);
        const meeting = await db.getFirstAsync<Meeting>('SELECT * FROM [Meeting] WHERE [id] = ?', [meetingId]);
        if (!meeting) throw new BusinessRuleError('MEETING_NOT_FOUND', `No meeting with id ${meetingId}.`, { meetingId });
        assertMayLinkMeetingDrive(actor, meeting, `link Google Drive files to meeting ${meetingId}`);
        await db.runAsync('UPDATE [Meeting] SET [GoogleDriveMinutesURL] = ?, [GoogleDriveFlyerURL] = ? WHERE [id] = ?', [
          minutes,
          flyer,
          meetingId,
        ]);
      });
      return (await db.getFirstAsync<Meeting>('SELECT * FROM [Meeting] WHERE [id] = ?', [meetingId]))!;
    },

    memberHours: async (memberId, range) => {
      const db = await this.ready();
      await this.requireMember(db, memberId);
      const attended = await db.getAllAsync<Meeting>(
        `SELECT m.* FROM [MeetingInvites] i JOIN [Meeting] m ON m.[id] = i.[MeetingID]
          WHERE i.[MemberID] = ? AND i.[Attended] = 1 AND m.[Date] BETWEEN ? AND ?`,
        [memberId, range?.fromDate ?? '0000-01-01', range?.toDate ?? '9999-12-31'],
      );
      return { memberId, ...aggregateMeetingHours(attended) };
    },
  };

  private async insertMeeting(
    db: SQLite.SQLiteDatabase,
    m: NewMeeting,
    invite: MeetingInviteMode,
  ): Promise<number> {
    const ownerId = m.OwnerID ?? null;
    if (ownerId !== null && !(await db.getFirstAsync('SELECT [id] FROM [Member] WHERE [id] = ?', [ownerId]))) {
      throw new BusinessRuleError('INVALID_INPUT', `No member with id ${ownerId} to own the meeting.`, { ownerId });
    }
    const res = await db.runAsync(
      `INSERT INTO [Meeting] ([CouncilID], [Meeting Name], [Meeting Description], [Date],
                              [Time Start], [Time End], [Location], [Agenda], [MinutesURL], [MeetingType], [OwnerID])
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        m.CouncilID,
        m['Meeting Name'],
        m['Meeting Description'] ?? null,
        m.Date,
        m['Time Start'],
        m['Time End'],
        m.Location,
        m.Agenda ?? '', // Agenda and MinutesURL are NOT NULL in Schema.sql: '' means "none yet"
        m.MinutesURL ?? '',
        m.MeetingType,
        ownerId,
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

  // ---- system feedback ---------------------------------------------------

  feedback: DataService['feedback'] = {
    submit: async (memberId, text) => {
      const clean = cleanFeedbackText(text);
      const db = await this.ready();
      await this.requireMember(db, memberId);
      const res = await db.runAsync('INSERT INTO [SystemFeedback] ([MemberID], [SubmittedAt], [FeedbackText]) VALUES (?, ?, ?)', [
        memberId,
        toTimestamp(this.now()),
        clean,
      ]);
      return (await db.getFirstAsync<SystemFeedback>('SELECT * FROM [SystemFeedback] WHERE [id] = ?', [res.lastInsertRowId]))!;
    },

    listInbox: async (actorId) => {
      const db = await this.ready();
      assertMayReadFeedback(await this.memberWriteActor(db, actorId));
      const [feedback, members, councils] = await Promise.all([
        db.getAllAsync<SystemFeedback>('SELECT * FROM [SystemFeedback]'),
        db.getAllAsync<Member>(
          `SELECT m.[id], m.[CouncilID], m.[MemberFirstName], m.[MemberLastName], m.[Phone], m.[Email]
             FROM [Member] m WHERE m.[id] IN (SELECT [MemberID] FROM [SystemFeedback])`,
        ),
        db.getAllAsync<Council>('SELECT [id], [CouncilNumber] FROM [Council]'),
      ]);
      return buildFeedbackInbox(feedback, members, councils);
    },
  };

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

  /** Enables every donation method for the test council (Seed.sql has no CouncilDonationMethod rows). */
  private async seedDevDonationMethods(db: SQLite.SQLiteDatabase): Promise<void> {
    for (const { method, qrUrl } of DEV_COUNCIL_DONATION_METHODS) {
      const res = await db.runAsync(
        `INSERT INTO [CouncilDonationMethod] ([CouncilID], [DonationMethodID], [DonationMethodURL])
         SELECT c.[id], dm.[id], ? FROM [Council] c, [DonationMethod] dm WHERE c.[CouncilNumber] = ? AND dm.[DonationMethod] = ?`,
        [qrUrl, DEV_COUNCIL_NUMBER, method],
      );
      if (res.changes !== 1) throw new Error(`Seed.sql is missing Council ${DEV_COUNCIL_NUMBER} or donation method ${method}`);
    }
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
