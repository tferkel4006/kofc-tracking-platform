// In-memory mock driver for the web app.
// Backed by plain arrays, but it enforces the same rules the real database does
// (NOT NULL, defaults, IDENTITY ids, primary-key uniqueness, foreign keys) using
// the table metadata generated from Schema.sql, so UI bugs surface here instead
// of against Azure SQL. State is per browser tab and resets on reload.
// Nothing outside /services may import this file.
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
  NewMeeting,
  Role,
  SessionUser,
  Shift,
} from '@kofc/shared';
import { SEED_DATA, TABLES, type SeedValue } from '../generated/schema.generated';
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
}

export class MemoryDataService implements DataService {
  private store = new MemoryStore();
  private initialised: Promise<void> | null = null;
  private readonly now: () => Date;

  constructor(options: MemoryDataServiceOptions = {}) {
    this.now = options.now ?? (() => new Date());
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
  };

  councils: DataService['councils'] = {
    list: async () => {
      const s = await this.ready();
      const rows = s.rows('Council').map((r) => ({ ...r })) as unknown as Council[];
      return rows.sort((a, b) => a.CouncilNumber - b.CouncilNumber || a.CouncilName.localeCompare(b.CouncilName));
    },
    get: async (id) => {
      const s = await this.ready();
      const row = s.rows('Council').find((c) => c.id === id);
      return row ? ({ ...row } as unknown as Council) : null;
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
      Agenda: m.Agenda ?? null,
      MinutesURL: m.MinutesURL ?? null,
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
  };

  /** Test/debug hook: direct access to the backing store. Not part of the DataService contract. */
  get debugStore(): MemoryStore {
    return this.store;
  }
}
