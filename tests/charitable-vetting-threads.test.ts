// Sprint 6H (Phase 6): Charitable Vetting Integration - schema 46's CharitableRequestThread and
// CharitableRequestThreadMessage. The vetting desk's "Request More Info" thread is private to a request's vetting officer
// and its Knight Shepherd; "Request Officer Input" is the officers' advisory forum, closed to the Shepherd. The expense
// forms' 'Link to Vetted Charity Request' dropdown reads charities.listLinkableCharitableRequests.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  canUseCharitableThread,
  charitableThreadAccess,
  isLinkableCharitableRequest,
  linkableCharitableRequests,
  type CharitableRequest,
  type DataService,
  type MemberWriteActor,
} from '@kofc/shared';
import { MemoryDataService } from '../apps/web/services/drivers/memory';
import { TABLES } from '../apps/web/services/generated/schema.generated';
import { drivers, expectRule, MEMBER, type DriverUnderTest } from './helpers';
import { openDatabases } from './shims/expo-sqlite';

const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');
const OWN = 1;
// Baseline seed: 1 Super Admin (Grand Knight), 2 Admin (Financial Secretary), 3 plain member (the Shepherd here). Each
// driver test adds a plain member and a member seated as Trustee 1, an officer without claim-override reach.
const SHEPHERD = MEMBER.member;

const request = (over: Partial<CharitableRequest> = {}): CharitableRequest => ({
  id: 7,
  CouncilID: OWN,
  OrganizationName: 'St. Jude Youth Ministry',
  AmountRequested: 800,
  RequestStatus: 'Claimed by Trustee',
  SubmittedAt: '2026-09-01 12:00:00',
  ShepherdMemberID: 3,
  Is501c3: 1,
  IsRecurring: 0,
  RequestTier: 1,
  VetterMemberID: 9,
  VoteStatus: 'Pending',
  AmountApproved: 0,
  ...over,
});

const writer = (over: Partial<MemberWriteActor> = {}): MemberWriteActor => ({
  memberId: 20,
  councilId: OWN,
  memberType: 'Member',
  active: true,
  roles: [],
  officer: false,
  ...over,
});

/** Gives a member a Role straight in the backing store; the data service has no role-assignment method. */
function grantRole(d: DriverUnderTest, db: DataService, memberId: number, role: string): void {
  if (d.name === 'memory') {
    const store = (db as MemoryDataService).debugStore;
    store.insert('MemberRoles', { RoleID: store.rows('Role').find((r) => r.Role === role)!.id, MemberID: memberId });
  } else {
    openDatabases.at(-1)!.prepare('INSERT INTO [MemberRoles] ([RoleID], [MemberID]) SELECT [id], ? FROM [Role] WHERE [Role] = ?').run(memberId, role);
  }
}

describe('schema 46: charitable request threads', () => {
  it('adds both tables with their keys and bumps the phone database version', () => {
    const schema = read('Schema.sql');
    expect(schema).toContain('CREATE TABLE [CharitableRequestThread] (');
    expect(schema).toContain('CREATE TABLE [CharitableRequestThreadMessage] (');
    expect(schema).toMatch(/CREATE UNIQUE INDEX \[CharitableRequestThread_Request_Type_Idx\] ON \[CharitableRequestThread\] \(\[request_id\], \[thread_type\]\);/);
    expect(TABLES.CharitableRequestThread.foreignKeys).toEqual(
      expect.arrayContaining([
        { column: 'request_id', refTable: 'CharitableRequest', refColumn: 'id' },
        { column: 'opened_by_member_id', refTable: 'Member', refColumn: 'id' },
      ]),
    );
    expect(TABLES.CharitableRequestThreadMessage.foreignKeys).toEqual(
      expect.arrayContaining([
        { column: 'thread_id', refTable: 'CharitableRequestThread', refColumn: 'id' },
        { column: 'author_member_id', refTable: 'Member', refColumn: 'id' },
      ]),
    );
    expect(read('apps/mobile/services/drivers/sqlite.ts')).toMatch(/const SCHEMA_VERSION = (4[6-9]|[5-9]\d);/);
    expect(read('data_dictionary.md')).toContain('[CharitableRequestThread]');
    expect(read('data_dictionary.md')).toContain('[CharitableRequestThreadMessage]');
  });
});

describe('thread access rules (pure)', () => {
  const shepherd = writer({ memberId: 3 });
  const vetter = writer({ memberId: 9, officer: true, roles: ['Trustee 1'] });
  const otherOfficer = writer({ memberId: 11, officer: true, roles: ['Recorder'] });
  const grandKnight = writer({ memberId: 12, officer: true, roles: ['Grand Knight'] });
  const admin = writer({ memberId: 13, memberType: 'Admin' });
  const plain = writer({ memberId: 14 });
  const foreignAdmin = writer({ memberId: 15, memberType: 'Admin', councilId: 2 });

  it('keeps the Shepherd to answering the More Info thread', () => {
    expect(charitableThreadAccess(shepherd, request(), 'MORE_INFO')).toEqual({ read: true, open: false, post: true });
    expect(charitableThreadAccess(shepherd, request(), 'OFFICER_INPUT')).toEqual({ read: false, open: false, post: false });
  });

  it('gives the More Info thread only to the vetting officer', () => {
    expect(charitableThreadAccess(vetter, request(), 'MORE_INFO').open).toBe(true);
    expect(charitableThreadAccess(grandKnight, request(), 'MORE_INFO').open).toBe(true);
    expect(charitableThreadAccess(admin, request(), 'MORE_INFO').open).toBe(true);
    expect(charitableThreadAccess(otherOfficer, request(), 'MORE_INFO').read).toBe(false);
    expect(charitableThreadAccess(plain, request(), 'MORE_INFO').read).toBe(false);
  });

  it('opens the Officer Input forum to every officer and Admin of the council', () => {
    for (const a of [vetter, otherOfficer, grandKnight, admin]) expect(charitableThreadAccess(a, request(), 'OFFICER_INPUT')).toEqual({ read: true, open: true, post: true });
    for (const a of [plain, foreignAdmin, writer({ memberId: 16, officer: true, active: false })]) expect(charitableThreadAccess(a, request(), 'OFFICER_INPUT').read).toBe(false);
  });

  it('closes posting once the request is declined or voted on, but keeps the log readable', () => {
    for (const closed of [request({ RequestStatus: 'Declined' }), request({ RequestStatus: 'Advanced', VoteStatus: 'Approved' })]) {
      expect(charitableThreadAccess(vetter, closed, 'MORE_INFO')).toEqual({ read: true, open: false, post: false });
      expect(charitableThreadAccess(shepherd, closed, 'MORE_INFO')).toEqual({ read: true, open: false, post: false });
    }
  });

  it('mirrors the rules on screen', () => {
    const u = (over: object) => ({ memberId: 20, councilId: OWN, memberType: 'Member' as const, isOfficer: false, ...over });
    expect(canUseCharitableThread(u({ memberId: 3 }), request(), 'MORE_INFO')).toBe(true);
    expect(canUseCharitableThread(u({ memberId: 3, isOfficer: true }), request(), 'OFFICER_INPUT')).toBe(false);
    expect(canUseCharitableThread(u({ memberId: 9, isOfficer: true }), request(), 'MORE_INFO')).toBe(true);
    expect(canUseCharitableThread(u({ isOfficer: true }), request(), 'MORE_INFO')).toBe(false);
    expect(canUseCharitableThread(u({ isOfficer: true }), request(), 'OFFICER_INPUT')).toBe(true);
    expect(canUseCharitableThread(u({ isOfficer: true, roles: ['Deputy Grand Knight'] }), request(), 'MORE_INFO')).toBe(true);
    expect(canUseCharitableThread(u({}), request(), 'OFFICER_INPUT')).toBe(false);
  });

  it('links expenses only to vetted requests the council has not voted down', () => {
    expect(isLinkableCharitableRequest(request({ RequestStatus: 'Advanced' }))).toBe(true);
    expect(isLinkableCharitableRequest(request({ RequestStatus: 'Advanced', VoteStatus: 'Approved' }))).toBe(true);
    expect(isLinkableCharitableRequest(request({ RequestStatus: 'Advanced', VoteStatus: 'Rejected' }))).toBe(false);
    expect(isLinkableCharitableRequest(request({ RequestStatus: 'Claimed by Trustee' }))).toBe(false);
    expect(isLinkableCharitableRequest(request({ RequestStatus: 'Declined' }))).toBe(false);
    const rows = [
      request({ id: 3, RequestStatus: 'Advanced', OrganizationName: 'Zion Pantry' }),
      request({ id: 4, RequestStatus: 'Advanced', OrganizationName: 'Abbey Clinic' }),
      request({ id: 5, RequestStatus: 'Advanced', OrganizationName: 'Elsewhere', CouncilID: 2 }),
      request({ id: 6 }),
    ];
    expect(linkableCharitableRequests(rows, OWN).map((r) => r.id)).toEqual([4, 3]);
  });
});

/** An Active plain member of council 1. */
async function addMember(db: DataService, email: string): Promise<number> {
  const types = await db.lookups.list('MemberType');
  const statuses = await db.lookups.list('MemberStatus');
  const member = await db.members.create(MEMBER.superAdmin, {
    CouncilID: OWN,
    MemberNumber: 7800000 + email.length,
    MemberFirstName: 'Thread',
    MemberLastName: 'Tester',
    Phone: '503-555-0171',
    StreetAddress1: '1 Vetting Way',
    City: 'Salem',
    State: 'OR',
    ZipCode: '97301',
    Email: email,
    DateOfBirth: '1970-05-05',
    StatusID: statuses.find((s) => s.Status === 'Active')!.id,
    DegreeID: 3,
    MemberTypeID: types.find((t) => t.Type === 'Member')!.id,
  });
  return member.id;
}

describe.each(drivers)('charitable vetting threads ($name driver)', (d) => {
  let TRUSTEE = 0;
  let PLAIN = 0;

  /** A request member 3 shepherds, claimed by a Trustee; also adds a plain member. */
  async function setup(): Promise<{ db: DataService; requestId: number }> {
    const db = await d.make();
    PLAIN = await addMember(db, 'plain.threads@example.org');
    TRUSTEE = await addMember(db, 'trustee.threads@example.org');
    grantRole(d, db, TRUSTEE, 'Trustee 1');
    const { request: filed } = await db.charities.submitCharitableRequest(SHEPHERD, { OrganizationName: 'St. Jude Youth Ministry', AmountRequested: 800, RelationshipTypeID: 1, Is501c3: true });
    await db.charities.triageRequestStatus(TRUSTEE, filed.id, { action: 'claim' });
    return { db, requestId: filed.id };
  }

  it('lets the vetting officer ask the Shepherd for more information and the Shepherd answer', async () => {
    const { db, requestId } = await setup();
    const opened = await db.charities.openRequestThread(TRUSTEE, requestId, 'MORE_INFO', '  Please send the 990 form.  ');
    expect(opened.thread).toMatchObject({ request_id: requestId, thread_type: 'MORE_INFO', opened_by_member_id: TRUSTEE });
    expect(opened.messages.map((m) => m.message.message_body)).toEqual(['Please send the 990 form.']);
    expect(opened.canPost).toBe(true);

    const seen = await db.charities.listRequestThreads(SHEPHERD, requestId);
    expect(seen.threads.map((t) => t.thread.thread_type)).toEqual(['MORE_INFO']);
    expect(seen.canOpen).toEqual([]);
    const reply = await db.charities.postRequestThreadMessage(SHEPHERD, opened.thread.id, 'Attached to the email I sent today.');
    expect(reply.messages.map((m) => [m.message.author_member_id, m.authorFirstName])).toEqual([
      [TRUSTEE, expect.any(String)],
      [SHEPHERD, 'Brother'],
    ]);

    // Starting it again adds to the same thread.
    const again = await db.charities.openRequestThread(TRUSTEE, requestId, 'MORE_INFO', 'Thank you.');
    expect(again.thread.id).toBe(opened.thread.id);
    expect(again.messages).toHaveLength(3);
    expect(d.count(db, 'CharitableRequestThread')).toBe(1);
  });

  it('keeps the More Info thread private to the Shepherd and the vetting officer', async () => {
    const { db, requestId } = await setup();
    await expectRule(db.charities.openRequestThread(SHEPHERD, requestId, 'MORE_INFO', 'Can I start it?'), 'SELF_VETTING_BLOCKED');
    const opened = await db.charities.openRequestThread(TRUSTEE, requestId, 'MORE_INFO', 'Who signs for the bus?');
    await expectRule(db.charities.postRequestThreadMessage(PLAIN, opened.thread.id, 'Hello'), 'VETTING_AUTHORITY_REQUIRED');
    await expectRule(db.charities.listRequestThreads(PLAIN, requestId), 'VETTING_AUTHORITY_REQUIRED');
    // The council's Admin and Grand Knight may step in as vetting officer.
    expect((await db.charities.listRequestThreads(MEMBER.admin, requestId)).threads.map((t) => t.thread.thread_type)).toEqual(['MORE_INFO']);
    expect((await db.charities.postRequestThreadMessage(MEMBER.superAdmin, opened.thread.id, 'Following up.')).messages).toHaveLength(2);
  });

  it('opens the Officer Input forum to the officers and never to the Shepherd', async () => {
    const { db, requestId } = await setup();
    const forum = await db.charities.openRequestThread(MEMBER.admin, requestId, 'OFFICER_INPUT', 'Is $800 within the youth line?');
    await db.charities.postRequestThreadMessage(TRUSTEE, forum.thread.id, 'Yes, with $200 to spare.');
    const trustee = await db.charities.listRequestThreads(TRUSTEE, requestId);
    expect(trustee.threads.map((t) => t.thread.thread_type)).toEqual(['OFFICER_INPUT']);
    expect(trustee.canOpen).toEqual(['MORE_INFO']);
    expect(trustee.threads[0].messages).toHaveLength(2);

    await expectRule(db.charities.postRequestThreadMessage(SHEPHERD, forum.thread.id, 'May I weigh in?'), 'SELF_VETTING_BLOCKED');
    await expectRule(db.charities.openRequestThread(SHEPHERD, requestId, 'OFFICER_INPUT', 'Me too'), 'SELF_VETTING_BLOCKED');
    expect((await db.charities.listRequestThreads(SHEPHERD, requestId)).threads).toEqual([]);
    await expectRule(db.charities.openRequestThread(PLAIN, requestId, 'OFFICER_INPUT', 'Hi'), 'VETTING_AUTHORITY_REQUIRED');
  });

  it('refuses bad input and closes the threads once the request is declined', async () => {
    const { db, requestId } = await setup();
    await expectRule(db.charities.openRequestThread(TRUSTEE, requestId, 'GOSSIP' as never, 'x'), 'INVALID_INPUT');
    await expectRule(db.charities.openRequestThread(TRUSTEE, requestId, 'MORE_INFO', '   '), 'INVALID_INPUT');
    await expectRule(db.charities.openRequestThread(TRUSTEE, requestId, 'MORE_INFO', 'x'.repeat(2001)), 'INVALID_INPUT');
    await expectRule(db.charities.openRequestThread(TRUSTEE, 9999, 'MORE_INFO', 'x'), 'RECORD_NOT_FOUND');
    await expectRule(db.charities.postRequestThreadMessage(TRUSTEE, 9999, 'x'), 'THREAD_NOT_FOUND');
    expect(d.count(db, 'CharitableRequestThread')).toBe(0);

    const forum = await db.charities.openRequestThread(TRUSTEE, requestId, 'OFFICER_INPUT', 'Thoughts?');
    await db.charities.triageRequestStatus(TRUSTEE, requestId, { action: 'decline' });
    await expectRule(db.charities.postRequestThreadMessage(TRUSTEE, forum.thread.id, 'Too late'), 'REQUEST_STATUS_CONFLICT');
    const after = await db.charities.listRequestThreads(TRUSTEE, requestId);
    expect(after.threads[0].canPost).toBe(false);
    expect(after.canOpen).toEqual([]);
    expect(d.count(db, 'CharitableRequestThreadMessage')).toBe(1);
  });

  it('lists only vetted requests for the expense link and saves the pick on the sheet', async () => {
    const { db, requestId } = await setup();
    expect(await db.charities.listLinkableCharitableRequests(PLAIN, OWN)).toEqual([]);
    await db.charities.triageRequestStatus(TRUSTEE, requestId, { action: 'advance' });
    const linkable = await db.charities.listLinkableCharitableRequests(PLAIN, OWN);
    expect(linkable).toEqual([{ id: requestId, OrganizationName: 'St. Jude Youth Ministry', AmountRequested: 800, RequestStatus: 'Advanced', VoteStatus: 'Pending' }]);
    await expectRule(db.charities.listLinkableCharitableRequests(PLAIN, 2), 'COUNCIL_ACCESS_DENIED');

    const { report } = await db.expenses.submitReport(PLAIN, { Status: 'Draft', charity_request_id: linkable[0].id }, []);
    expect(report.charity_request_id).toBe(requestId);
  });
});
