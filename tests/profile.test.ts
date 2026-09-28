// Sprint 5S: Member.ProfilePhotoURL and Member.Biography, written by the member themselves on My Profile
// (members.update, MEMBER_SELF_SERVICE_COLUMNS), and the SQLite schema that carries them.
import { describe, expect, it } from 'vitest';
import { MEMBER_BIOGRAPHY_MAX_LENGTH, MEMBER_COLUMNS, MEMBER_PHOTO_URL_MAX_LENGTH, MEMBER_SELF_SERVICE_COLUMNS } from '@kofc/shared';
import { SCHEMA_STATEMENTS } from '../apps/mobile/services/generated/schema.sqlite';
import { drivers, expectRule, MEMBER } from './helpers';

describe('profile photo and biography columns', () => {
  it('are member columns a member may change on their own record', () => {
    expect(MEMBER_COLUMNS).toEqual(expect.arrayContaining(['ProfilePhotoURL', 'Biography']));
    expect(MEMBER_SELF_SERVICE_COLUMNS).toEqual(expect.arrayContaining(['ProfilePhotoURL', 'Biography']));
  });

  it('are in the generated SQLite Member table', () => {
    const member = SCHEMA_STATEMENTS.find((s) => s.startsWith('CREATE TABLE [Member] ('))!;
    expect(member).toContain('[ProfilePhotoURL] TEXT');
    expect(member).toContain('[Biography] TEXT');
  });
});

describe.each(drivers)('profile photo and biography ($name driver)', (d) => {
  it('start empty and are saved, kept and cleared by the member', async () => {
    const db = await d.make();
    const before = await db.members.get(MEMBER.member);
    expect(before?.ProfilePhotoURL ?? null).toBeNull();
    expect(before?.Biography ?? null).toBeNull();

    const bio = 'Knight since 2004, parishioner of St. Mary. I run the Tootsie Roll drive every spring.';
    const saved = await db.members.update(MEMBER.member, MEMBER.member, { ProfilePhotoURL: 'blob:http://localhost/abc#me.jpg', Biography: `  ${bio}  ` });
    expect(saved).toMatchObject({ ProfilePhotoURL: 'blob:http://localhost/abc#me.jpg', Biography: bio });

    // A contact-detail edit leaves them alone.
    await db.members.update(MEMBER.member, MEMBER.member, { City: 'Salem' });
    expect(await db.members.get(MEMBER.member)).toMatchObject({ City: 'Salem', ProfilePhotoURL: 'blob:http://localhost/abc#me.jpg', Biography: bio });

    const cleared = await db.members.update(MEMBER.member, MEMBER.member, { ProfilePhotoURL: null, Biography: '   ' });
    expect(cleared.ProfilePhotoURL ?? null).toBeNull();
    expect(cleared.Biography ?? null).toBeNull();
  });

  it('refuses a biography or photo path over its limit, and writes nothing', async () => {
    const db = await d.make();
    await expectRule(db.members.update(MEMBER.member, MEMBER.member, { Biography: 'x'.repeat(MEMBER_BIOGRAPHY_MAX_LENGTH + 1) }), 'INVALID_INPUT');
    await expectRule(db.members.update(MEMBER.member, MEMBER.member, { ProfilePhotoURL: 'p'.repeat(MEMBER_PHOTO_URL_MAX_LENGTH + 1) }), 'INVALID_INPUT');
    expect((await db.members.get(MEMBER.member))?.Biography ?? null).toBeNull();
    await db.members.update(MEMBER.member, MEMBER.member, { Biography: 'x'.repeat(MEMBER_BIOGRAPHY_MAX_LENGTH) });
  });

  it('lets a member write only their own', async () => {
    const db = await d.make();
    await expectRule(db.members.update(MEMBER.member, MEMBER.admin, { Biography: 'Not mine to write.' }), 'ADMIN_REQUIRED');
  });
});
