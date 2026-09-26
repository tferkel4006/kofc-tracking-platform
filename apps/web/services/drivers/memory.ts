// In-memory mock driver for the web app.
// Backed by plain arrays, but it enforces the same rules the real database does
// (NOT NULL, defaults, IDENTITY ids, primary-key uniqueness, foreign keys) using
// the table metadata generated from Schema.sql, so UI bugs surface here instead
// of against Azure SQL. State is per browser tab and resets on reload.
// Nothing outside /services may import this file.
import {
  aggregateMeetingHours,
  assertActivityDateAllowed,
  assertDonationDateForEvent,
  assertDonationFitsMethod,
  assertEventRange,
  assertLookupKeyUnique,
  assertLookupNotProtected,
  assertLookupUnused,
  assertPasswordAcceptable,
  assertShiftHasRoom,
  assertShiftInsideEvent,
  assertText,
  assertValidHours,
  assertShiftReportAllowed,
  assertThreadParticipant,
  buildThreadMessages,
  buildThreadSummaries,
  buildWelcomeEmail,
  BusinessRuleError,
  cleanCouncilIds,
  cleanEventFields,
  cleanLookupValues,
  cleanMemberExtensions,
  cleanNewDonation,
  cleanNewEvent,
  cleanNewMember,
  cleanNewShift,
  cleanShiftFields,
  donationMethodKind,
  isSha256Hex,
  LOOKUP_META,
  MEMBER_COLUMNS,
  participantIds,
  planEventCopy,
  toTimestamp,
  trainingDateToYear,
  trainingYearToDate,
  UNREGISTERED_PASSWORD,
  type MessagingRows,
} from '@kofc/shared';
import type {
  Activities,
  ActivityTime,
  ChatThread,
  Council,
  CouncilDonationMethod,
  CouncilSkillEntry,
  DataService,
  Donation,
  DonationType,
  KOCTrainingClasses,
  MemberExtensions,
  MemberSkill,
  MemberTraining,
  Skill,
  SkillLevel,
  WorkingStatus,
  Event as CouncilEvent,
  EventChanges,
  EventSignup,
  EventTime,
  LessonsLearned,
  LookupRowMap,
  LookupTableName,
  Meeting,
  MeetingInvites,
  MeetingInviteMode,
  Member,
  MemberShift,
  Message,
  MessageAttachment,
  LookupValues,
  NewEvent,
  NewMeeting,
  ReadReceipt,
  Role,
  SessionUser,
  Shift,
  ShiftChanges,
  ShiftFeedItem,
} from '@kofc/shared';
import { SEED_DATA, TABLES, type SeedValue } from '../generated/schema.generated';
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

type Row = Record<string, SeedValue>;

/** Allow-list mirroring the mobile driver. Exhaustive by construction. */
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

const lower = (v: SeedValue | undefined) => String(v ?? '').toLowerCase();

/** Soonest first: date, then start time, then id. */
const compareShifts = (a: Shift, b: Shift) =>
  a.ShiftDate.localeCompare(b.ShiftDate) || a.StartTime.localeCompare(b.StartTime) || a.id - b.id;

/** Matches SQLite's CURRENT_TIMESTAMP format ('YYYY-MM-DD HH:MM:SS', UTC). */
const nowTimestamp = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

class MemoryStore {
  private tables = new Map<string, Row[]>();
  private lastId = new Map<string, number>();

  constructor() {
    for (const name of Object.keys(TABLES)) this.tables.set(name, []);
  }

  /** All-or-nothing, like a SQL transaction: if `fn` throws, every table and id counter is restored. */
  transaction<T>(fn: () => T): T {
    const tables = this.tables;
    const lastId = this.lastId;
    this.tables = new Map([...tables].map(([name, rows]) => [name, rows.map((r) => ({ ...r }))]));
    this.lastId = new Map(lastId);
    try {
      return fn();
    } catch (err) {
      this.tables = tables;
      this.lastId = lastId;
      throw err;
    }
  }

  /** Read-only view of the stored rows. Callers must copy before handing rows to the UI. */
  rows(table: string): readonly Row[] {
    const rows = this.tables.get(table);
    if (!rows) throw new Error(`no such table: ${table}`);
    return rows;
  }

  /** Deletes every row of `table` matching `predicate`; returns how many went. */
  remove(table: string, predicate: (row: Row) => boolean): number {
    const kept = this.rows(table).filter((r) => !predicate(r));
    const removed = this.rows(table).length - kept.length;
    this.tables.set(table, kept as Row[]);
    return removed;
  }

  insert(table: string, values: Record<string, SeedValue | boolean | undefined>): Row {
    const meta = TABLES[table];
    if (!meta) throw new Error(`no such table: ${table}`);
    for (const key of Object.keys(values)) {
      if (!meta.columns.some((c) => c.name === key)) throw new Error(`table ${table} has no column named ${key}`);
    }

    const row: Row = {};
    for (const col of meta.columns) {
      let v = values[col.name];
      if (typeof v === 'boolean') v = v ? 1 : 0;

      if ((v === undefined || v === null) && col.identity) {
        v = (this.lastId.get(table) ?? 0) + 1;
      } else if (v === undefined) {
        v = !col.default ? null : col.default.kind === 'now' ? nowTimestamp() : col.default.value;
      }

      if (v === null) {
        if (col.notNull) throw new Error(`NOT NULL constraint failed: ${table}.${col.name}`);
      } else if (col.kind === 'int' || col.kind === 'bit' || col.kind === 'real') {
        if (typeof v !== 'number') throw new Error(`datatype mismatch: ${table}.${col.name} expects a number`);
      } else if (typeof v !== 'string') {
        throw new Error(`datatype mismatch: ${table}.${col.name} expects text`);
      }
      row[col.name] = v;
    }

    const stored = this.rows(table);
    if (stored.some((r) => meta.primaryKey.every((k) => r[k] === row[k]))) {
      throw new Error(`UNIQUE constraint failed: ${meta.primaryKey.map((k) => `${table}.${k}`).join(', ')}`);
    }
    for (const fk of meta.foreignKeys) {
      const v = row[fk.column];
      if (v !== null && !this.rows(fk.refTable).some((r) => r[fk.refColumn] === v)) {
        throw new Error(`FOREIGN KEY constraint failed: ${table}.${fk.column} -> ${fk.refTable}.${fk.refColumn}`);
      }
    }

    const identity = meta.columns.find((c) => c.identity);
    if (identity) this.lastId.set(table, Math.max(this.lastId.get(table) ?? 0, row[identity.name] as number));
    (this.tables.get(table) as Row[]).push(row);
    return row;
  }
}

export interface MemoryDataServiceOptions {
  /** Clock used for seeding and the history-window rules. Tests pin it. Default: real time. */
  now?: () => Date;
  /** Where system emails (the new-member welcome) go. Default: console.log (no mail infrastructure exists yet). */
  log?: (...args: unknown[]) => void;
}

export class MemoryDataService implements DataService {
  private store = new MemoryStore();
  private initialised: Promise<void> | null = null;
  private readonly now: () => Date;
  private readonly log: (...args: unknown[]) => void;

  constructor(options: MemoryDataServiceOptions = {}) {
    this.now = options.now ?? (() => new Date());
    this.log = options.log ?? console.log;
  }

  // ---- lifecycle ---------------------------------------------------------

  init(): Promise<void> {
    if (!this.initialised) {
      this.initialised = Promise.resolve()
        .then(() => this.seed())
        .catch((err) => {
          this.initialised = null;
          this.store = new MemoryStore(); // discard any half-seeded state
          throw err;
        });
    }
    return this.initialised;
  }

  async reset(): Promise<void> {
    this.store = new MemoryStore();
    this.initialised = null;
    await this.init();
  }

  private async seed(): Promise<void> {
    for (const { table, rows } of SEED_DATA) for (const row of rows) this.store.insert(table, row);

    // Seed.sql stores dev passwords in plaintext; hash them so signIn only ever sees digests.
    for (const cred of this.store.rows('Credentials')) {
      const stored = cred.Password as string;
      if (stored !== UNREGISTERED_PASSWORD && !isSha256Hex(stored)) (cred as Row).Password = await sha256Hex(stored);
    }
    this.seedDevMemberAndActivity();

    const council = this.store.rows('Council').find((c) => c.CouncilNumber === DEV_COUNCIL_NUMBER);
    if (!council) throw new Error(`Seed.sql did not create Council ${DEV_COUNCIL_NUMBER}`);
    const typeIds = Object.fromEntries(
      this.store.rows('MeetingType').map((t) => [t.Type as string, t.id]),
    ) as Record<DevMeetingTypeName, number>;
    for (const { meeting, invite } of buildDevMeetings(council.id as number, typeIds, this.now())) {
      this.insertMeeting(meeting, invite);
    }
    this.seedDevEvents(council.id as number);
    this.seedDevExtras(council.id as number);

    // Enables every donation method for the test council (Seed.sql has no CouncilDonationMethod rows).
    for (const { method, qrUrl } of DEV_COUNCIL_DONATION_METHODS) {
      const methodRow = this.store.rows('DonationMethod').find((m) => m.DonationMethod === method);
      if (!methodRow) throw new Error(`Seed.sql is missing donation method ${method}`);
      this.store.insert('CouncilDonationMethod', { CouncilID: council.id, DonationMethodID: methodRow.id, DonationMethodURL: qrUrl });
    }
  }

  /** A pre-provisioned member with a placeholder Credentials row, plus one council activity. */
  private seedDevMemberAndActivity(): void {
    const council = this.store.rows('Council').find((c) => c.CouncilNumber === DEV_COUNCIL_NUMBER);
    const template = this.store.rows('Member').find((m) => m.CouncilID === council?.id);
    if (!council || !template) throw new Error(`Seed.sql did not create Council ${DEV_COUNCIL_NUMBER} with members`);
    const cred = this.store.insert('Credentials', {
      Username: DEV_UNREGISTERED_MEMBER.Email,
      Password: UNREGISTERED_PASSWORD,
    });
    this.store.insert('Member', {
      ...DEV_UNREGISTERED_MEMBER,
      CouncilID: council.id,
      StatusID: this.activeStatusId(this.store),
      DegreeID: template.DegreeID,
      MemberTypeID: this.store.rows('MemberType').find((t) => t.Type === 'Member')?.id,
      CredentialID: cred.id,
    });
    this.store.insert('Activities', {
      ...DEV_ACTIVITY,
      CategoryID: this.store.rows('Category').find((c) => c.Category === 'Service')?.id,
      CouncilID: council.id,
    });
  }

  private seedDevEvents(councilId: number): void {
    const owner = this.store.rows('Member').find((m) => m.Email === 'testadmin@kofc.org');
    const category = this.store.rows('Category').find((c) => c.Category === 'Service');
    if (!owner || !category) throw new Error('Seed.sql is missing the test admin or the Service category');
    for (const { event, shifts } of buildDevEvents(this.now())) {
      const eventRow = this.store.insert('Event', { ...event, OwnerID: owner.id, CategoryID: category.id });
      this.store.insert('EventCouncils', { EventID: eventRow.id, CouncilID: councilId });
      for (const { shift, signedUp } of shifts) {
        const shiftRow = this.store.insert('Shift', {
          ...shift,
          EventID: eventRow.id,
          NumberVolunteersSignedUp: signedUp.length,
        });
        for (const email of signedUp) {
          const member = this.store.rows('Member').find((m) => m.Email === email);
          this.store.insert('EventSignup', { ShiftID: shiftRow.id, MemberID: member?.id, NoShow: 0 });
        }
      }
    }
  }

/** Extra councils, shared and historical events, no-show history and message threads for the new screens. */
  private seedDevExtras(ownCouncilId: number): void {
    const s = this.store;
    const affiliated = s.insert('Council', { ...DEV_AFFILIATED_COUNCIL });
    const unaffiliated = s.insert('Council', { ...DEV_UNAFFILIATED_COUNCIL });
    s.insert('AffiliatedCouncils', { PrimaryCouncilID: ownCouncilId, AffiliatedCouncilID: affiliated.id });
    const councilIds = { own: ownCouncilId, affiliated: affiliated.id as number, unaffiliated: unaffiliated.id as number };

    const memberId = (email: string) => s.rows('Member').find((m) => m.Email === email)?.id as number;
    const reasonId = (code: string) => s.rows('NoShowReason').find((r) => r.NoShowReasonCode === code)?.id as number;
    const ownerId = memberId('testadmin@kofc.org');
    const categoryId = s.rows('Category').find((c) => c.Category === 'Service')?.id as number;

    for (const { event, councils, shifts } of buildDevExtraEvents(this.now())) {
      const eventRow = s.insert('Event', { ...event, OwnerID: ownerId, CategoryID: categoryId });
      for (const c of councils) s.insert('EventCouncils', { EventID: eventRow.id, CouncilID: councilIds[c] });
      for (const { shift, signedUp, noShows } of shifts) {
        const shiftRow = s.insert('Shift', { ...shift, EventID: eventRow.id, NumberVolunteersSignedUp: signedUp.length });
        for (const email of signedUp) {
          const code = noShows?.[email];
          s.insert('EventSignup', {
            ShiftID: shiftRow.id,
            MemberID: memberId(email),
            NoShow: code ? 1 : 0,
            NoShowReasonID: code ? reasonId(code) : null,
          });
        }
      }
    }

    const { threads, messages } = buildDevMessaging();
    const stampAt = (hoursAgo: number) => toTimestamp(new Date(this.now().getTime() - hoursAgo * 3_600_000));
    const threadIds = new Map<string, number>();
    const messageIds = new Map<string, number>();
    for (const t of threads) {
      const row = s.insert('ChatThreads', { CouncilID: ownCouncilId, IsGroupChat: t.isGroup ? 1 : 0, CreatedAt: stampAt(72) });
      threadIds.set(t.key, row.id as number);
    }
    for (const m of messages) {
      const thread = threads.find((t) => t.key === m.thread)!;
      const row = s.insert('Messages', {
        ThreadID: threadIds.get(m.thread),
        SenderID: memberId(m.sender),
        ParentMessageID: m.parent ? (messageIds.get(m.parent) ?? null) : null,
        MessageText: m.text,
        IsDraft: m.draft ? 1 : 0,
        CreatedAt: stampAt(m.hoursAgo),
      });
      messageIds.set(m.key, row.id as number);
      if (!m.draft) {
        for (const email of thread.participants.filter((e) => e !== m.sender)) {
          s.insert('ReadReceipts', {
            MessageID: row.id,
            MemberID: memberId(email),
            ReadAt: m.readBy?.includes(email) ? stampAt(m.hoursAgo - 0.5) : null,
            IsFlagged: 0,
          });
        }
      }
      for (const a of m.attachments ?? []) {
        s.insert('MessageAttachments', {
          MessageID: row.id,
          Filename: a.Filename,
          FileType: a.FileType,
          StorageURL: `placeholder://attachments/${encodeURIComponent(a.Filename)}`,
          UploadedAt: stampAt(m.hoursAgo),
        });
      }
    }
  }

  /** Every public method starts here so callers never observe an unseeded store. */
  private async ready(): Promise<MemoryStore> {
    await this.init();
    return this.store;
  }

  // ---- auth --------------------------------------------------------------

  auth: DataService['auth'] = {
    signIn: async (username, password) => {
      const s = await this.ready();
      const cred = s.rows('Credentials').find((c) => lower(c.Username) === username.toLowerCase());
      if (!cred || !(await passwordMatches(cred.Password as string, password))) return null;
      const member = s.rows('Member').find((m) => m.CredentialID === cred.id);
      return member ? this.sessionFor(s, member, cred) : null;
    },

    signUp: async (email, password) => {
      assertPasswordAcceptable(password);
      const hash = await sha256Hex(password); // hash first: the check-and-write below must not span an await
      const s = await this.ready();
      const member = s.rows('Member').find((m) => lower(m.Email) === email.trim().toLowerCase());
      if (!member) {
        throw new BusinessRuleError(
          'MEMBER_NOT_FOUND',
          `No member record has the email ${email.trim()}. Contact your council admin to be added.`,
          { email },
        );
      }
      const cred = s.rows('Credentials').find((c) => c.id === member.CredentialID);
      if (!cred) {
        throw new BusinessRuleError(
          'CREDENTIALS_MISSING',
          `Member ${member.id} has no Credentials row (CredentialID ${member.CredentialID}).`,
          { memberId: member.id },
        );
      }
      if (cred.Password !== UNREGISTERED_PASSWORD) {
        throw new BusinessRuleError('ALREADY_REGISTERED', `${member.Email} has already registered. Sign in instead.`, {
          memberId: member.id,
        });
      }
      (cred as Row).Password = hash;
      (cred as Row).Username = member.Email;
      return this.sessionFor(s, member, cred);
    },
  };

  private sessionFor(s: MemoryStore, member: Row, cred: Row): SessionUser {
    const type = s.rows('MemberType').find((t) => t.id === member.MemberTypeID);
    const roles = this.rolesFor(s, member.id as number);
    return {
      credentialId: cred.id as number,
      memberId: member.id as number,
      councilId: member.CouncilID as number,
      username: cred.Username as string,
      firstName: member.MemberFirstName as string,
      lastName: member.MemberLastName as string,
      memberType: type?.Type as SessionUser['memberType'],
      roles: roles.map((r) => r.Role),
      isOfficer: roles.some((r) => r.Officer === 1),
    };
  }

  // ---- lookups / councils / members -------------------------------------

  lookups: DataService['lookups'] = {
    list: async <T extends LookupTableName>(table: T): Promise<LookupRowMap[T][]> => {
      if (!LOOKUP_TABLES[table]) throw new Error(`Unknown lookup table: ${String(table)}`);
      const s = await this.ready();
      return s.rows(table).map((r) => ({ ...r })) as unknown as LookupRowMap[T][];
    },

    create: async <T extends LookupTableName>(table: T, values: LookupValues): Promise<LookupRowMap[T]> => {
      if (!LOOKUP_TABLES[table]) throw new Error(`Unknown lookup table: ${String(table)}`);
      const cleaned = cleanLookupValues(table, values);
      const s = await this.ready();
      return s.transaction(() => {
        assertLookupKeyUnique(table, s.rows(table), cleaned);
        return { ...s.insert(table, cleaned) } as unknown as LookupRowMap[T];
      });
    },

    update: async <T extends LookupTableName>(table: T, id: number, values: LookupValues): Promise<LookupRowMap[T]> => {
      if (!LOOKUP_TABLES[table]) throw new Error(`Unknown lookup table: ${String(table)}`);
      const cleaned = cleanLookupValues(table, values);
      const s = await this.ready();
      const row = this.requireLookupRow(s, table, id);
      assertLookupNotProtected(table, row, cleaned);
      assertLookupKeyUnique(table, s.rows(table), cleaned, id);
      Object.assign(row, cleaned);
      return { ...row } as unknown as LookupRowMap[T];
    },

    remove: async (table, id) => {
      if (!LOOKUP_TABLES[table]) throw new Error(`Unknown lookup table: ${String(table)}`);
      const s = await this.ready();
      const row = this.requireLookupRow(s, table, id);
      assertLookupNotProtected(table, row, null);
      assertLookupUnused(
        table,
        row,
        LOOKUP_META[table].references.map((ref) => ({
          ...ref,
          count: s.rows(ref.table).filter((r) => r[ref.column] === id).length,
        })),
      );
      s.remove(table, (r) => r.id === id);
    },
  };

  private requireLookupRow(s: MemoryStore, table: LookupTableName, id: number): Row {
    const row = s.rows(table).find((r) => r.id === id);
    if (!row) {
      throw new BusinessRuleError('INVALID_INPUT', `${LOOKUP_META[table].label} ${id} does not exist.`, { table, id });
    }
    return row;
  }

  councils: DataService['councils'] = {
    list: async () => this.sortedCouncils(await this.ready()),
    get: async (id) => {
      const s = await this.ready();
      const row = s.rows('Council').find((c) => c.id === id);
      return row ? ({ ...row } as unknown as Council) : null;
    },
    listAffiliated: async (councilId) => {
      const s = await this.ready();
      const linked = new Set<number>();
      for (const a of s.rows('AffiliatedCouncils')) {
        if (a.PrimaryCouncilID === councilId) linked.add(a.AffiliatedCouncilID as number);
        if (a.AffiliatedCouncilID === councilId) linked.add(a.PrimaryCouncilID as number);
      }
      linked.delete(councilId);
      return this.sortedCouncils(s).filter((c) => linked.has(c.id));
    },
  };

  private sortedCouncils(s: MemoryStore): Council[] {
    const rows = s.rows('Council').map((r) => ({ ...r })) as unknown as Council[];
    return rows.sort((a, b) => a.CouncilNumber - b.CouncilNumber || a.CouncilName.localeCompare(b.CouncilName));
  }

  activities: DataService['activities'] = {
    listByCouncil: async (councilId) => {
      const s = await this.ready();
      const rows = s
        .rows('Activities')
        .filter((a) => a.CouncilID === councilId)
        .map((a) => ({ ...a })) as unknown as Activities[];
      return rows.sort((a, b) => a.ActivityName.localeCompare(b.ActivityName) || a.id - b.id);
    },
  };

  members: DataService['members'] = {
    get: async (id) => {
      const s = await this.ready();
      const row = s.rows('Member').find((m) => m.id === id);
      return row ? ({ ...row } as unknown as Member) : null;
    },
    getByEmail: async (email) => {
      const s = await this.ready();
      const row = s.rows('Member').find((m) => lower(m.Email) === email.toLowerCase());
      return row ? ({ ...row } as unknown as Member) : null;
    },
    listByCouncil: async (councilId, options) => {
      const s = await this.ready();
      const activeId = options?.activeOnly ? this.activeStatusId(s) : null;
      const rows = s
        .rows('Member')
        .filter((m) => m.CouncilID === councilId && (activeId === null || m.StatusID === activeId))
        .map((m) => ({ ...m })) as unknown as Member[];
      return rows.sort(
        (a, b) => a.MemberLastName.localeCompare(b.MemberLastName) || a.MemberFirstName.localeCompare(b.MemberFirstName),
      );
    },
    listRoles: async (memberId) => this.rolesFor(await this.ready(), memberId),

    create: async (member) => {
      const clean = cleanNewMember(member, this.now());
      const s = await this.ready();
      const row = s.transaction(() => {
        this.assertCouncilsExist(s, [clean.CouncilID]);
        this.assertRowExists(s, 'MemberStatus', clean.StatusID, 'member status');
        this.assertRowExists(s, 'Degree', clean.DegreeID, 'degree');
        this.assertRowExists(s, 'MemberType', clean.MemberTypeID, 'member type');
        if (clean.WorkingStatusID != null) this.assertRowExists(s, 'WorkingStatus', clean.WorkingStatusID, 'working status');
        const email = clean.Email.toLowerCase();
        if (s.rows('Member').some((m) => lower(m.Email) === email) || s.rows('Credentials').some((c) => lower(c.Username) === email)) {
          throw new BusinessRuleError('INVALID_INPUT', `The email ${clean.Email} already belongs to a member or login.`, {
            email: clean.Email,
          });
        }
        const cred = s.insert('Credentials', { Username: clean.Email, Password: UNREGISTERED_PASSWORD });
        const values: Record<string, SeedValue | undefined> = { CredentialID: cred.id };
        for (const c of MEMBER_COLUMNS) values[c] = clean[c] ?? null;
        return s.insert('Member', values);
      });
      const created = { ...row } as unknown as Member;
      this.sendWelcomeEmail(s, created);
      return created;
    },
  };

  /** System hook after members.create commits: compiles the welcome email and logs it (no mail server yet). */
  private sendWelcomeEmail(s: MemoryStore, member: Member): void {
    try {
      const council = { ...s.rows('Council').find((c) => c.id === member.CouncilID)! } as unknown as Council;
      const activeId = this.activeStatusId(s);
      const adminType = s.rows('MemberType').find((t) => t.Type === 'Admin')?.id;
      const admin = (s.rows('Member').filter(
        (m) => m.CouncilID === member.CouncilID && m.id !== member.id && m.StatusID === activeId && m.MemberTypeID === adminType,
      ) as unknown as Member[]).sort(
        (a, b) =>
          a.MemberLastName.localeCompare(b.MemberLastName) || a.MemberFirstName.localeCompare(b.MemberFirstName) || a.id - b.id,
      )[0];
      const details = admin
        ? { name: `${admin.MemberFirstName} ${admin.MemberLastName}`, email: admin.Email, phone: admin.Phone }
        : null;
      this.log('[notification]', JSON.stringify(buildWelcomeEmail({ member, council, admin: details }), null, 2));
    } catch (err) {
      // The member is already saved; a failed notification must not undo or fail that.
      console.error('[notification] welcome email failed:', err);
    }
  }

  /** Friendly INVALID_INPUT for a foreign key the generic constraint message would explain poorly. */
  private assertRowExists(s: MemoryStore, table: string, id: number, label: string): void {
    if (!s.rows(table).some((r) => r.id === id)) {
      throw new BusinessRuleError('INVALID_INPUT', `No ${label} with id ${id}.`, { table, id });
    }
  }

  // ---- Phase 2: member profiles, skill messaging, donations -------------

  memberProfiles: DataService['memberProfiles'] = {
    getExtensions: async (memberId) => {
      const s = await this.ready();
      this.requireMember(s, memberId);
      return this.extensionsOf(s, memberId);
    },

    updateExtensions: async (memberId, skills, training, workingStatusId) => {
      const clean = cleanMemberExtensions(skills, training, workingStatusId, this.now());
      const s = await this.ready();
      s.transaction(() => {
        const member = this.requireMember(s, memberId);
        for (const sk of clean.skills) {
          this.assertRowExists(s, 'Skill', sk.skillId, 'skill');
          this.assertRowExists(s, 'SkillLevel', sk.skillLevelId, 'skill level');
        }
        for (const t of clean.training) this.assertRowExists(s, 'KOCTrainingClasses', t.trainingClassId, 'training class');
        if (clean.workingStatusId !== null) this.assertRowExists(s, 'WorkingStatus', clean.workingStatusId, 'working status');

        s.remove('MemberSkill', (r) => r.MemberID === memberId);
        for (const sk of clean.skills) {
          s.insert('MemberSkill', { SkillID: sk.skillId, SkillLevelID: sk.skillLevelId, MemberID: memberId });
        }
        s.remove('MemberTraining', (r) => r.MemberID === memberId);
        for (const t of clean.training) {
          s.insert('MemberTraining', { MemberID: memberId, TrainingClassID: t.trainingClassId, YearTaken: trainingYearToDate(t.year) });
        }
        (member as Row).WorkingStatusID = clean.workingStatusId;
      });
      return this.extensionsOf(s, memberId);
    },
  };

  private extensionsOf(s: MemoryStore, memberId: number): MemberExtensions {
    const find = <T>(table: string, id: unknown) => ({ ...s.rows(table).find((r) => r.id === id)! }) as unknown as T;
    const member = s.rows('Member').find((m) => m.id === memberId)!;
    const skills = (s.rows('MemberSkill').filter((r) => r.MemberID === memberId).map((r) => ({ ...r })) as unknown as MemberSkill[]).sort(
      (a, b) => a.id - b.id,
    );
    const training = (
      s.rows('MemberTraining').filter((r) => r.MemberID === memberId).map((r) => ({ ...r })) as unknown as MemberTraining[]
    ).sort((a, b) => b.YearTaken.localeCompare(a.YearTaken) || a.id - b.id);
    return {
      workingStatus: member.WorkingStatusID == null ? null : find<WorkingStatus>('WorkingStatus', member.WorkingStatusID),
      skills: skills.map((row) => ({ row, skill: find<Skill>('Skill', row.SkillID), level: find<SkillLevel>('SkillLevel', row.SkillLevelID) })),
      training: training.map((row) => ({
        row,
        trainingClass: find<KOCTrainingClasses>('KOCTrainingClasses', row.TrainingClassID),
        year: trainingDateToYear(row.YearTaken),
      })),
    };
  }

  communication: DataService['communication'] = {
    listCouncilSkills: async (councilId) => {
      const s = await this.ready();
      const out: CouncilSkillEntry[] = [];
      for (const ms of s.rows('MemberSkill')) {
        const m = s.rows('Member').find((r) => r.id === ms.MemberID);
        const skill = s.rows('Skill').find((r) => r.id === ms.SkillID);
        const level = s.rows('SkillLevel').find((r) => r.id === ms.SkillLevelID);
        if (!m || !skill || !level || m.CouncilID !== councilId) continue;
        out.push({
          memberId: m.id as number,
          firstName: m.MemberFirstName as string,
          lastName: m.MemberLastName as string,
          phone: m.Phone as string,
          email: m.Email as string,
          skill: { ...skill } as unknown as Skill,
          level: { ...level } as unknown as SkillLevel,
        });
      }
      return out.sort(
        (a, b) =>
          a.skill.SkillName.localeCompare(b.skill.SkillName) ||
          a.lastName.localeCompare(b.lastName) ||
          a.firstName.localeCompare(b.firstName) ||
          a.memberId - b.memberId,
      );
    },

    sendBulkToSkills: async (councilId, skillId, messageText, senderId) => {
      assertText(messageText, 'Message', 10_000);
      const s = await this.ready();
      this.assertCouncilsExist(s, [councilId]);
      const skill = s.rows('Skill').find((r) => r.id === skillId);
      if (!skill) throw new BusinessRuleError('INVALID_INPUT', `No skill with id ${skillId}.`, { skillId });
      const activeId = this.activeStatusId(s);
      const holders = new Set(s.rows('MemberSkill').filter((r) => r.SkillID === skillId).map((r) => r.MemberID));
      const recipientIds = s
        .rows('Member')
        .filter((m) => m.CouncilID === councilId && m.StatusID === activeId && m.id !== senderId && holders.has(m.id))
        .map((m) => m.id as number)
        .sort((a, b) => a - b);
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
      const s = await this.ready();
      const out = [];
      for (const link of s.rows('CouncilDonationMethod').filter((r) => r.CouncilID === councilId)) {
        const method = s.rows('DonationMethod').find((m) => m.id === link.DonationMethodID)!;
        out.push({
          method: { id: method.id as number, DonationMethod: method.DonationMethod as string },
          kind: donationMethodKind(method.DonationMethod as string),
          link: { ...link } as unknown as CouncilDonationMethod,
          qrCodeUrl: (link.DonationMethodURL as string | null) || null,
        });
      }
      return out.sort((a, b) => a.method.id - b.method.id || a.link.id - b.link.id);
    },

    listTypes: async (councilId) => {
      const s = await this.ready();
      return (s.rows('DonationType').filter((t) => t.CouncilID === councilId).map((t) => ({ ...t })) as unknown as DonationType[]).sort(
        (a, b) => a.DonationType.localeCompare(b.DonationType) || a.id - b.id,
      );
    },

    list: async (councilId, options) => {
      const s = await this.ready();
      const rows = s
        .rows('Donation')
        .filter((d) => d.CouncilID === councilId && (options?.eventId === undefined || d.EventID === options.eventId))
        .map((d) => ({ ...d })) as unknown as Donation[];
      return rows.sort((a, b) => b.DonationDate.localeCompare(a.DonationDate) || b.id - a.id);
    },

    record: async (donation) => {
      const clean = cleanNewDonation(donation, this.now());
      const s = await this.ready();
      return s.transaction(() => {
        this.assertCouncilsExist(s, [clean.CouncilID]);
        const method = s.rows('DonationMethod').find((m) => m.id === clean.DonationMethodID);
        if (!method) {
          throw new BusinessRuleError('INVALID_INPUT', `No donation method with id ${clean.DonationMethodID}.`, {
            donationMethodId: clean.DonationMethodID,
          });
        }
        if (!s.rows('CouncilDonationMethod').some((r) => r.CouncilID === clean.CouncilID && r.DonationMethodID === clean.DonationMethodID)) {
          throw new BusinessRuleError(
            'DONATION_METHOD_NOT_ENABLED',
            `Council ${clean.CouncilID} has not enabled ${method.DonationMethod} donations.`,
            { councilId: clean.CouncilID, donationMethodId: clean.DonationMethodID },
          );
        }
        assertDonationFitsMethod(donationMethodKind(method.DonationMethod as string), clean);
        if (!s.rows('DonationType').some((t) => t.id === clean.DonationTypeID && t.CouncilID === clean.CouncilID)) {
          throw new BusinessRuleError('INVALID_INPUT', `Council ${clean.CouncilID} has no donation type with id ${clean.DonationTypeID}.`, {
            councilId: clean.CouncilID,
            donationTypeId: clean.DonationTypeID,
          });
        }
        if (clean.EventID != null) {
          const event = this.requireEvent(s, clean.EventID) as unknown as CouncilEvent;
          if (!this.councilIdsOf(s, event.id).includes(clean.CouncilID)) {
            throw new BusinessRuleError('INVALID_INPUT', `"${event.EventName}" is not linked to council ${clean.CouncilID}.`, {
              eventId: event.id,
              councilId: clean.CouncilID,
            });
          }
          assertDonationDateForEvent(clean.DonationDate, event);
        }
        return { ...s.insert('Donation', { ...clean }) } as unknown as Donation;
      });
    },
  };

  private activeStatusId(s: MemoryStore): number | undefined {
    return s.rows('MemberStatus').find((st) => st.Status === 'Active')?.id as number | undefined;
  }

  private rolesFor(s: MemoryStore, memberId: number): Role[] {
    return s
      .rows('MemberRoles')
      .filter((mr) => mr.MemberID === memberId)
      .map((mr) => s.rows('Role').find((r) => r.id === mr.RoleID))
      .filter((r): r is Row => r !== undefined)
      .map((r) => ({ ...r }) as unknown as Role)
      .sort((a, b) => a.id - b.id);
  }

  // ---- events, shifts and time logs -------------------------------------

  events: DataService['events'] = {
    get: async (id) => {
      const s = await this.ready();
      const row = s.rows('Event').find((e) => e.id === id);
      return row ? ({ ...row } as unknown as CouncilEvent) : null;
    },

    getShift: async (id) => {
      const s = await this.ready();
      const row = s.rows('Shift').find((sh) => sh.id === id);
      return row ? ({ ...row } as unknown as Shift) : null;
    },

    listShiftsBetween: async (fromDate, toDate) => {
      const s = await this.ready();
      const rows = s
        .rows('Shift')
        .filter((sh) => (sh.ShiftDate as string) >= fromDate && (sh.ShiftDate as string) <= toDate)
        .map((sh) => ({ ...sh })) as unknown as Shift[];
      return rows.sort(
        (a, b) => a.ShiftDate.localeCompare(b.ShiftDate) || a.StartTime.localeCompare(b.StartTime) || a.id - b.id,
      );
    },

    listSignups: async (shiftId) => {
      const s = await this.ready();
      return s
        .rows('EventSignup')
        .filter((e) => e.ShiftID === shiftId)
        .map((e) => ({ ...e })) as unknown as EventSignup[];
    },

    signupForShift: async (memberId, shiftId) => {
      const s = await this.ready();
      return s.transaction(() => {
        const shift = this.requireShift(s, shiftId);
        this.requireMember(s, memberId);
        if (s.rows('EventSignup').some((e) => e.ShiftID === shiftId && e.MemberID === memberId)) {
          throw new BusinessRuleError(
            'ALREADY_SIGNED_UP',
            `Member ${memberId} is already signed up for shift "${shift.ShiftName}" (id ${shiftId}).`,
            { memberId, shiftId },
          );
        }
        assertShiftHasRoom(shift as unknown as Shift);
        const row = s.insert('EventSignup', { ShiftID: shiftId, MemberID: memberId, NoShow: 0 });
        (shift as Row).NumberVolunteersSignedUp = (shift.NumberVolunteersSignedUp as number) + 1;
        return { ...row } as unknown as EventSignup;
      });
    },

    listMemberShifts: async (memberId, range) => {
      const s = await this.ready();
      const from = range?.fromDate ?? '0000-01-01';
      const to = range?.toDate ?? '9999-12-31';
      const out: MemberShift[] = [];
      for (const signup of s.rows('EventSignup').filter((e) => e.MemberID === memberId)) {
        const shift = s.rows('Shift').find((sh) => sh.id === signup.ShiftID);
        const event = shift && s.rows('Event').find((ev) => ev.id === shift.EventID);
        if (!shift || !event || (shift.ShiftDate as string) < from || (shift.ShiftDate as string) > to) continue;
        const time = s.rows('EventTime').find((t) => t.ShiftID === shift.id && t.MemberID === memberId);
        out.push({
          signup: { ...signup } as unknown as EventSignup,
          shift: { ...shift } as unknown as Shift,
          event: { ...event } as unknown as CouncilEvent,
          hoursLogged: time ? (time.Hours as number) : null,
        });
      }
      return out.sort((a, b) => compareShifts(a.shift, b.shift));
    },

    listShiftFeed: async ({ memberId, councilIds, fromDate, toDate }) => {
      const s = await this.ready();
      const wanted = new Set(councilIds);
      const mine = new Set(s.rows('EventSignup').filter((e) => e.MemberID === memberId).map((e) => e.ShiftID));
      const out: ShiftFeedItem[] = [];
      for (const shift of s.rows('Shift')) {
        if ((shift.ShiftDate as string) < fromDate || (shift.ShiftDate as string) > toDate) continue;
        const linked = this.councilIdsOf(s, shift.EventID as number);
        const event = s.rows('Event').find((ev) => ev.id === shift.EventID);
        if (!event || !linked.some((id) => wanted.has(id))) continue;
        out.push({
          shift: { ...shift } as unknown as Shift,
          event: { ...event } as unknown as CouncilEvent,
          councilIds: linked,
          isSignedUp: mine.has(shift.id),
        });
      }
      return out.sort((a, b) => compareShifts(a.shift, b.shift));
    },

    countNoShows: async (memberId, sinceDate) => {
      const s = await this.ready();
      return s.rows('EventSignup').filter((e) => {
        if (e.MemberID !== memberId || e.NoShow !== 1) return false;
        const shift = s.rows('Shift').find((sh) => sh.id === e.ShiftID);
        return shift !== undefined && (shift.ShiftDate as string) >= sinceDate;
      }).length;
    },

    listByCouncil: async (councilId) => {
      const s = await this.ready();
      const linked = new Set(s.rows('EventCouncils').filter((ec) => ec.CouncilID === councilId).map((ec) => ec.EventID));
      const rows = s
        .rows('Event')
        .filter((e) => linked.has(e.id))
        .map((e) => ({ ...e })) as unknown as CouncilEvent[];
      return rows.sort((a, b) => b.StartDate.localeCompare(a.StartDate) || b.id - a.id);
    },

    listShifts: async (eventId) => {
      const s = await this.ready();
      return (s
        .rows('Shift')
        .filter((sh) => sh.EventID === eventId)
        .map((sh) => ({ ...sh })) as unknown as Shift[]).sort(compareShifts);
    },

    listCouncilIds: async (eventId) => this.councilIdsOf(await this.ready(), eventId),

    create: async (event, councilIds) => {
      const clean = cleanNewEvent(event);
      assertEventRange(clean.StartDate, clean.EndDate);
      const ids = cleanCouncilIds(councilIds);
      const s = await this.ready();
      return s.transaction(() => ({ ...this.insertEvent(s, clean, ids) }) as unknown as CouncilEvent);
    },

    update: async (id, changes: EventChanges) => {
      const clean = cleanEventFields(changes);
      const s = await this.ready();
      return s.transaction(() => {
        const row = this.requireEvent(s, id);
        assertEventRange((clean.StartDate ?? row.StartDate) as string, (clean.EndDate ?? row.EndDate) as string);
        this.assertOwnerAndCategory(s, clean);
        if (clean.StartDate !== undefined || clean.EndDate !== undefined) {
          const event = { ...row, ...clean } as unknown as CouncilEvent;
          for (const sh of s.rows('Shift').filter((x) => x.EventID === id)) {
            assertShiftInsideEvent(sh.ShiftDate as string, event);
          }
        }
        Object.assign(row, clean);
        return { ...row } as unknown as CouncilEvent;
      });
    },

    setCouncils: async (eventId, councilIds) => {
      const ids = cleanCouncilIds(councilIds);
      const s = await this.ready();
      s.transaction(() => {
        this.requireEvent(s, eventId);
        this.assertCouncilsExist(s, ids);
        s.remove('EventCouncils', (ec) => ec.EventID === eventId);
        for (const CouncilID of ids) s.insert('EventCouncils', { EventID: eventId, CouncilID });
      });
    },

    copy: async (eventId, options) => {
      const s = await this.ready();
      return s.transaction(() => {
        const original = { ...this.requireEvent(s, eventId) } as unknown as CouncilEvent;
        const shifts = s.rows('Shift').filter((sh) => sh.EventID === eventId) as unknown as Shift[];
        const plan = planEventCopy(original, shifts, options);
        const clean = cleanNewEvent(plan.event);
        const row = this.insertEvent(s, clean, this.councilIdsOf(s, eventId));
        for (const shift of plan.shifts) this.insertShift(s, row.id as number, shift);
        return { ...row } as unknown as CouncilEvent;
      });
    },

    createShift: async (shift) => {
      const clean = cleanNewShift(shift);
      const s = await this.ready();
      return s.transaction(() => {
        const event = this.requireEvent(s, clean.EventID);
        assertShiftInsideEvent(clean.ShiftDate, event as unknown as CouncilEvent);
        return { ...this.insertShift(s, clean.EventID, clean) } as unknown as Shift;
      });
    },

    updateShift: async (id, changes: ShiftChanges) => {
      const clean = cleanShiftFields(changes);
      const s = await this.ready();
      return s.transaction(() => {
        const row = this.requireShift(s, id);
        if (clean.MinNumberVolunteers !== undefined && clean.MinNumberVolunteers < (row.NumberVolunteersSignedUp as number)) {
          throw new BusinessRuleError(
            'INVALID_INPUT',
            `Shift "${row.ShiftName}" already has ${row.NumberVolunteersSignedUp} volunteers signed up, so the volunteer target cannot be lowered to ${clean.MinNumberVolunteers}.`,
            { shiftId: id, signedUp: row.NumberVolunteersSignedUp, requested: clean.MinNumberVolunteers },
          );
        }
        if (clean.ShiftDate !== undefined) {
          assertShiftInsideEvent(clean.ShiftDate, this.requireEvent(s, row.EventID as number) as unknown as CouncilEvent);
        }
        Object.assign(row, clean);
        return { ...row } as unknown as Shift;
      });
    },

    deleteShift: async (id) => {
      const s = await this.ready();
      s.transaction(() => {
        const row = this.requireShift(s, id);
        const signups = s.rows('EventSignup').filter((e) => e.ShiftID === id).length;
        if (signups > 0) {
          throw new BusinessRuleError(
            'SHIFT_HAS_SIGNUPS',
            `Shift "${row.ShiftName}" (id ${id}) has ${signups} volunteer${signups === 1 ? '' : 's'} signed up and cannot be deleted.`,
            { shiftId: id, signups },
          );
        }
        s.remove('Shift', (sh) => sh.id === id);
      });
    },
  };

  private councilIdsOf(s: MemoryStore, eventId: number): number[] {
    return s
      .rows('EventCouncils')
      .filter((ec) => ec.EventID === eventId)
      .map((ec) => ec.CouncilID as number)
      .sort((a, b) => a - b);
  }

  private requireEvent(s: MemoryStore, eventId: number): Row {
    const event = s.rows('Event').find((e) => e.id === eventId);
    if (!event) throw new BusinessRuleError('EVENT_NOT_FOUND', `No event with id ${eventId}.`, { eventId });
    return event;
  }

  private assertCouncilsExist(s: MemoryStore, ids: readonly number[]): void {
    for (const id of ids) {
      if (!s.rows('Council').some((c) => c.id === id)) {
        throw new BusinessRuleError('INVALID_INPUT', `No council with id ${id}.`, { councilId: id });
      }
    }
  }

  /** Friendly errors for the two foreign keys the generic constraint message would explain poorly. */
  private assertOwnerAndCategory(s: MemoryStore, fields: EventChanges): void {
    if (fields.OwnerID != null) this.requireMember(s, fields.OwnerID);
    if (fields.CategoryID != null && !s.rows('Category').some((c) => c.id === fields.CategoryID)) {
      throw new BusinessRuleError('INVALID_INPUT', `No event category with id ${fields.CategoryID}.`, {
        categoryId: fields.CategoryID,
      });
    }
  }

  private insertEvent(s: MemoryStore, event: NewEvent, councilIds: readonly number[]): Row {
    this.assertOwnerAndCategory(s, event);
    this.assertCouncilsExist(s, councilIds);
    const row = s.insert('Event', event as unknown as Record<string, SeedValue | undefined>);
    for (const CouncilID of councilIds) s.insert('EventCouncils', { EventID: row.id, CouncilID });
    return row;
  }

  private insertShift(s: MemoryStore, eventId: number, shift: Omit<Shift, 'id' | 'EventID' | 'NumberVolunteersSignedUp'>): Row {
    return s.insert('Shift', {
      ShiftName: shift.ShiftName,
      ShiftDescription: shift.ShiftDescription ?? '',
      ShiftDate: shift.ShiftDate,
      StartTime: shift.StartTime,
      EndTime: shift.EndTime,
      EventID: eventId,
      MinNumberVolunteers: shift.MinNumberVolunteers,
      NumberVolunteersSignedUp: 0,
    });
  }

  lessonsLearned: DataService['lessonsLearned'] = {
    list: async (eventId) => {
      const s = await this.ready();
      return s
        .rows('LessonsLearned')
        .filter((l) => l.EventID === eventId)
        .map((l) => ({ ...l })) as unknown as LessonsLearned[];
    },

    add: async (eventId, categoryId, description) => {
      const text = assertText(description, 'Lesson learned', 255);
      const s = await this.ready();
      return s.transaction(() => {
        this.requireEvent(s, eventId);
        if (!s.rows('LessonsLearnedCategory').some((c) => c.id === categoryId)) {
          throw new BusinessRuleError('INVALID_INPUT', `No lessons-learned category with id ${categoryId}.`, { categoryId });
        }
        const row = s.insert('LessonsLearned', {
          EventID: eventId,
          LeassonsLearnedCategoryID: categoryId,
          LessonsLearnedDescription: text,
        });
        return { ...row } as unknown as LessonsLearned;
      });
    },

    remove: async (id) => {
      const s = await this.ready();
      if (s.remove('LessonsLearned', (l) => l.id === id) === 0) {
        throw new BusinessRuleError('INVALID_INPUT', `No lesson learned with id ${id}.`, { id });
      }
    },
  };

  eventTime: DataService['eventTime'] = {
    logHours: async (memberId, shiftId, hours, notes) => {
      assertValidHours(hours);
      const s = await this.ready();
      return s.transaction(() => {
        const shift = this.requireShift(s, shiftId);
        this.requireMember(s, memberId);
        assertShiftReportAllowed(shift.ShiftDate as string, this.now(), shiftId);
        if (!s.rows('EventSignup').some((e) => e.ShiftID === shiftId && e.MemberID === memberId)) {
          throw new BusinessRuleError(
            'NOT_SIGNED_UP',
            `Member ${memberId} never signed up for shift "${shift.ShiftName}" (id ${shiftId}), so no time can be logged against it.`,
            { memberId, shiftId },
          );
        }
        const existing = s.rows('EventTime').find((t) => t.ShiftID === shiftId && t.MemberID === memberId);
        if (existing) {
          (existing as Row).Hours = hours;
          (existing as Row).ShiftNotes = notes ?? null;
          return { ...existing } as unknown as EventTime;
        }
        const row = s.insert('EventTime', { ShiftID: shiftId, MemberID: memberId, Hours: hours, ShiftNotes: notes ?? null });
        return { ...row } as unknown as EventTime;
      });
    },
  };

  activityTime: DataService['activityTime'] = {
    logHours: async (memberId, activityId, hours, date, notes) => {
      assertValidHours(hours);
      assertActivityDateAllowed(date, this.now());
      const s = await this.ready();
      return s.transaction(() => {
        this.requireMember(s, memberId);
        if (!s.rows('Activities').some((a) => a.id === activityId)) {
          throw new BusinessRuleError('ACTIVITY_NOT_FOUND', `No activity with id ${activityId}.`, { activityId });
        }
        const row = s.insert('ActivityTime', {
          MemberID: memberId,
          ActivityID: activityId,
          ActivityDate: date,
          Hours: hours,
          ActivityNotes: notes ?? null,
        });
        return { ...row } as unknown as ActivityTime;
      });
    },
  };

  private requireShift(s: MemoryStore, shiftId: number): Row {
    const shift = s.rows('Shift').find((sh) => sh.id === shiftId);
    if (!shift) throw new BusinessRuleError('SHIFT_NOT_FOUND', `No shift with id ${shiftId}.`, { shiftId });
    return shift;
  }

  private requireMember(s: MemoryStore, memberId: number): Row {
    const member = s.rows('Member').find((m) => m.id === memberId);
    if (!member) throw new BusinessRuleError('MEMBER_NOT_FOUND', `No member with id ${memberId}.`, { memberId });
    return member;
  }

  // ---- meetings ----------------------------------------------------------

  meetings: DataService['meetings'] = {
    get: async (id) => {
      const s = await this.ready();
      const row = s.rows('Meeting').find((m) => m.id === id);
      return row ? ({ ...row } as unknown as Meeting) : null;
    },

    listUpcoming: async (councilId, options) => {
      const s = await this.ready();
      const from = options?.fromDate ?? toIsoDate(new Date());
      const invitedTo =
        options?.memberId === undefined
          ? null
          : new Set(s.rows('MeetingInvites').filter((i) => i.MemberID === options.memberId).map((i) => i.MeetingID));
      const rows = s
        .rows('Meeting')
        .filter((m) => m.CouncilID === councilId && (m.Date as string) >= from && (!invitedTo || invitedTo.has(m.id)))
        .map((m) => ({ ...m })) as unknown as Meeting[];
      return rows.sort(
        (a, b) => a.Date.localeCompare(b.Date) || a['Time Start'].localeCompare(b['Time Start']) || a.id - b.id,
      );
    },

    create: async (meeting, invite = 'none') => {
      const s = await this.ready();
      const id = s.transaction(() => this.insertMeeting(meeting, invite));
      return { ...s.rows('Meeting').find((m) => m.id === id)! } as unknown as Meeting;
    },

    listInvites: async (meetingId) => {
      const s = await this.ready();
      return s
        .rows('MeetingInvites')
        .filter((i) => i.MeetingID === meetingId)
        .map((i) => ({ ...i })) as unknown as MeetingInvites[];
    },

    invite: async (meetingId, memberIds) => {
      const s = await this.ready();
      return s.transaction(() => this.insertInvites(meetingId, memberIds));
    },

    setAttended: async (meetingId, memberId, attended) => {
      const s = await this.ready();
      const invite = s.rows('MeetingInvites').find((i) => i.MeetingID === meetingId && i.MemberID === memberId);
      if (!invite) throw new Error(`Member ${memberId} is not invited to meeting ${meetingId}`);
      (invite as Row).Attended = attended ? 1 : 0;
    },

    setMinutes: async (meetingId, minutesUrl) => {
      // MinutesURL is NOT NULL in Schema.sql, so "no minutes" is stored as ''.
      const url = minutesUrl === null ? '' : assertText(minutesUrl, 'Minutes link', 255);
      const s = await this.ready();
      const row = s.rows('Meeting').find((m) => m.id === meetingId);
      if (!row) throw new BusinessRuleError('MEETING_NOT_FOUND', `No meeting with id ${meetingId}.`, { meetingId });
      (row as Row).MinutesURL = url;
      return { ...row } as unknown as Meeting;
    },

    memberHours: async (memberId, range) => {
      const s = await this.ready();
      this.requireMember(s, memberId);
      const from = range?.fromDate ?? '0000-01-01';
      const to = range?.toDate ?? '9999-12-31';
      const attendedIds = new Set(s.rows('MeetingInvites').filter((i) => i.MemberID === memberId && i.Attended === 1).map((i) => i.MeetingID));
      const attended = s
        .rows('Meeting')
        .filter((m) => attendedIds.has(m.id) && (m.Date as string) >= from && (m.Date as string) <= to)
        .map((m) => ({ ...m })) as unknown as Meeting[];
      return { memberId, ...aggregateMeetingHours(attended) };
    },
  };

  private insertMeeting(m: NewMeeting, invite: MeetingInviteMode): number {
    const row = this.store.insert('Meeting', {
      CouncilID: m.CouncilID,
      'Meeting Name': m['Meeting Name'],
      'Meeting Description': m['Meeting Description'] ?? null,
      Date: m.Date,
      'Time Start': m['Time Start'],
      'Time End': m['Time End'],
      Location: m.Location,
      Agenda: m.Agenda ?? '', // Agenda and MinutesURL are NOT NULL in Schema.sql: '' means "none yet"
      MinutesURL: m.MinutesURL ?? '',
      MeetingType: m.MeetingType,
    });
    const meetingId = row.id as number;
    this.insertInvites(meetingId, this.resolveInvitees(m.CouncilID, invite));
    return meetingId;
  }

  private resolveInvitees(councilId: number, mode: MeetingInviteMode): number[] {
    if (mode === 'none') return [];
    if (typeof mode === 'object') return mode.memberIds;
    const activeId = this.activeStatusId(this.store);
    return this.store
      .rows('Member')
      .filter((m) => m.CouncilID === councilId && m.StatusID === activeId)
      .filter((m) => mode === 'allActive' || this.rolesFor(this.store, m.id as number).some((r) => r.Officer === 1))
      .map((m) => m.id as number)
      .sort((a, b) => a - b);
  }

  private insertInvites(meetingId: number, memberIds: number[]): number {
    let added = 0;
    for (const memberId of new Set(memberIds)) {
      const exists = this.store.rows('MeetingInvites').some((i) => i.MeetingID === meetingId && i.MemberID === memberId);
      if (exists) continue;
      this.store.insert('MeetingInvites', { MeetingID: meetingId, MemberID: memberId, Attended: 0 });
      added++;
    }
    return added;
  }

  // ---- messages ----------------------------------------------------------

  messages: DataService['messages'] = {
    getPage: async (threadId, options) => {
      const s = await this.ready();
      const limit = options?.limit ?? 20;
      const before = options?.before;
      const rows = s
        .rows('Messages')
        .filter((m) => m.ThreadID === threadId && (before === undefined || (m.CreatedAt as string) < before))
        .map((m) => ({ ...m })) as unknown as Message[];
      return rows
        .sort((a, b) => (b.CreatedAt ?? '').localeCompare(a.CreatedAt ?? '') || b.id - a.id)
        .slice(0, limit);
    },

    createReadReceiptStubs: async (messageId, listId) => {
      const s = await this.ready();
      const members = s.rows('DistributionListMembers').filter((m) => m.ListID === listId);
      for (const m of members) {
        this.store.insert('ReadReceipts', { MessageID: messageId, MemberID: m.MemberID, ReadAt: null, IsFlagged: 0 });
      }
      return members.length;
    },

    listThreads: async (memberId) => buildThreadSummaries(memberId, this.messagingRows(await this.ready())),

    listThread: async (threadId, memberId) => {
      const s = await this.ready();
      const rows = this.messagingRows(s);
      assertThreadParticipant(rows, threadId, memberId);
      return buildThreadMessages(memberId, threadId, rows);
    },

    send: async (input) => {
      const text = assertText(input.text, 'Message', 10_000);
      const s = await this.ready();
      return s.transaction(() => {
        this.requireMember(s, input.senderId);
        const rows = this.messagingRows(s);
        let thread: Row;
        let recipients: number[];
        if (input.threadId !== undefined) {
          thread = this.requireThread(s, input.threadId);
          assertThreadParticipant(rows, input.threadId, input.senderId);
          recipients = participantIds(input.threadId, rows.messages, rows.receipts).filter((id) => id !== input.senderId);
        } else {
          recipients = [...new Set(input.recipientIds ?? [])].filter((id) => id !== input.senderId);
          if (input.councilId === undefined || recipients.length === 0) {
            throw new BusinessRuleError(
              'INVALID_INPUT',
              'A new conversation needs a council and at least one recipient other than the sender.',
              { councilId: input.councilId, recipientIds: input.recipientIds },
            );
          }
          for (const id of recipients) this.requireMember(s, id);
          thread = s.insert('ChatThreads', {
            CouncilID: input.councilId,
            IsGroupChat: recipients.length > 1 ? 1 : 0,
            CreatedAt: toTimestamp(this.now()),
          });
        }
        this.assertParent(s, thread.id as number, input.parentMessageId);

        const stamp = toTimestamp(this.now());
        let message: Row;
        if (input.draftId !== undefined) {
          message = this.requireDraft(s, input.draftId, input.senderId, thread.id as number);
          Object.assign(message, {
            MessageText: text,
            IsDraft: 0,
            CreatedAt: stamp,
            ParentMessageID: input.parentMessageId !== undefined ? input.parentMessageId : message.ParentMessageID,
          });
        } else {
          message = s.insert('Messages', {
            ThreadID: thread.id,
            SenderID: input.senderId,
            ParentMessageID: input.parentMessageId ?? null,
            MessageText: text,
            IsDraft: 0,
            CreatedAt: stamp,
          });
        }
        for (const MemberID of recipients) {
          s.insert('ReadReceipts', { MessageID: message.id, MemberID, ReadAt: null, IsFlagged: 0 });
        }
        return { ...message } as unknown as Message;
      });
    },

    saveDraft: async (input) => {
      const text = assertText(input.text, 'Draft', 10_000);
      const s = await this.ready();
      return s.transaction(() => {
        this.requireMember(s, input.senderId);
        this.requireThread(s, input.threadId);
        assertThreadParticipant(this.messagingRows(s), input.threadId, input.senderId);
        this.assertParent(s, input.threadId, input.parentMessageId);
        const stamp = toTimestamp(this.now());
        if (input.draftId !== undefined) {
          const draft = this.requireDraft(s, input.draftId, input.senderId, input.threadId);
          Object.assign(draft, {
            MessageText: text,
            CreatedAt: stamp,
            ParentMessageID: input.parentMessageId !== undefined ? input.parentMessageId : draft.ParentMessageID,
          });
          return { ...draft } as unknown as Message;
        }
        const row = s.insert('Messages', {
          ThreadID: input.threadId,
          SenderID: input.senderId,
          ParentMessageID: input.parentMessageId ?? null,
          MessageText: text,
          IsDraft: 1,
          CreatedAt: stamp,
        });
        return { ...row } as unknown as Message;
      });
    },

    deleteDraft: async (messageId, memberId) => {
      const s = await this.ready();
      const draft = s.rows('Messages').find((m) => m.id === messageId && m.IsDraft === 1 && m.SenderID === memberId);
      if (!draft) {
        throw new BusinessRuleError('MESSAGE_NOT_FOUND', `Member ${memberId} has no draft with id ${messageId}.`, {
          messageId,
          memberId,
        });
      }
      s.remove('Messages', (m) => m.id === messageId);
    },

    setRead: async (messageId, memberId, read) => {
      const s = await this.ready();
      const receipt = s.rows('ReadReceipts').find((r) => r.MessageID === messageId && r.MemberID === memberId);
      if (!receipt) {
        throw new BusinessRuleError(
          'MESSAGE_NOT_FOUND',
          `Member ${memberId} did not receive message ${messageId}, so it has no read state for them.`,
          { messageId, memberId },
        );
      }
      (receipt as Row).ReadAt = read ? toTimestamp(this.now()) : null;
      return { ...receipt } as unknown as ReadReceipt;
    },
  };

  private messagingRows(s: MemoryStore): MessagingRows {
    const copy = <T>(table: string) => s.rows(table).map((r) => ({ ...r })) as unknown as T[];
    return {
      threads: copy<ChatThread>('ChatThreads'),
      messages: copy<Message>('Messages'),
      receipts: copy<ReadReceipt>('ReadReceipts'),
      attachments: copy<MessageAttachment>('MessageAttachments'),
      names: new Map(s.rows('Member').map((m) => [m.id as number, `${m.MemberFirstName} ${m.MemberLastName}`])),
    };
  }

  private requireThread(s: MemoryStore, threadId: number): Row {
    const thread = s.rows('ChatThreads').find((t) => t.id === threadId);
    if (!thread) throw new BusinessRuleError('THREAD_NOT_FOUND', `No message thread with id ${threadId}.`, { threadId });
    return thread;
  }

  private assertParent(s: MemoryStore, threadId: number, parentId: number | null | undefined): void {
    if (parentId == null) return;
    if (!s.rows('Messages').some((m) => m.id === parentId && m.ThreadID === threadId)) {
      throw new BusinessRuleError('MESSAGE_NOT_FOUND', `Thread ${threadId} has no message ${parentId} to reply to.`, {
        threadId,
        parentId,
      });
    }
  }

  private requireDraft(s: MemoryStore, messageId: number, memberId: number, threadId: number): Row {
    const draft = s.rows('Messages').find((m) => m.id === messageId && m.IsDraft === 1 && m.SenderID === memberId && m.ThreadID === threadId);
    if (!draft) {
      throw new BusinessRuleError('MESSAGE_NOT_FOUND', `Member ${memberId} has no draft ${messageId} in thread ${threadId}.`, {
        messageId,
        memberId,
        threadId,
      });
    }
    return draft;
  }

  /** Test/debug hook: direct access to the backing store. Not part of the DataService contract. */
  get debugStore(): MemoryStore {
    return this.store;
  }
}
