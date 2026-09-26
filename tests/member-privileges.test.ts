import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  assertMayGrantMemberType,
  BusinessRuleError,
  SecurityPrivilegeError,
  SUPER_ADMIN_TYPE,
  type DataService,
  type NewMember,
} from '@kofc/shared';
import { drivers, expectRule, MEMBER } from './helpers';

// Only an Active Super Admin may create a Super Admin or promote a member to one. The driver reads the
// caller's type from the database, so a Council Admin or Member is refused whatever the client sends.

async function typeId(db: DataService, type: string): Promise<number> {
  return (await db.lookups.list('MemberType')).find((t) => t.Type === type)!.id;
}

async function statusId(db: DataService, status: string): Promise<number> {
  return (await db.lookups.list('MemberStatus')).find((s) => s.Status === status)!.id;
}

async function recruit(db: DataService, type: string, email = 'new.recruit@example.org'): Promise<NewMember> {
  return {
    CouncilID: 1,
    MemberNumber: 9920001,
    MemberFirstName: 'New',
    MemberLastName: 'Recruit',
    Phone: '555-000-2222',
    StreetAddress1: '2 Council Way',
    City: 'Portland',
    State: 'OR',
    ZipCode: '97201',
    Email: email,
    DateOfBirth: '1980-01-01',
    StatusID: await statusId(db, 'Active'),
    DegreeID: 3,
    MemberTypeID: await typeId(db, type),
  };
}

/** Asserts the promise rejects with a SecurityPrivilegeError (code SUPER_ADMIN_REQUIRED). */
async function expectPrivilegeError(promise: Promise<unknown>): Promise<void> {
  const err = await expectRule(promise, 'SUPER_ADMIN_REQUIRED');
  expect(err).toBeInstanceOf(SecurityPrivilegeError);
  expect(err.name).toBe('SecurityPrivilegeError');
}

describe('assertMayGrantMemberType', () => {
  const superAdmin = { memberId: 1, memberType: SUPER_ADMIN_TYPE, active: true };
  const admin = { memberId: 2, memberType: 'Admin', active: true };

  it('lets an active Super Admin grant Super Admin and anyone grant the other types', () => {
    expect(() => assertMayGrantMemberType(superAdmin, SUPER_ADMIN_TYPE)).not.toThrow();
    expect(() => assertMayGrantMemberType(admin, 'Admin')).not.toThrow();
    expect(() => assertMayGrantMemberType(admin, 'Member')).not.toThrow();
  });

  it('refuses a Council Admin, a Member and an inactive Super Admin, as a BusinessRuleError', () => {
    for (const actor of [admin, { memberId: 3, memberType: 'Member', active: true }, { ...superAdmin, active: false }]) {
      const attempt = () => assertMayGrantMemberType(actor, SUPER_ADMIN_TYPE);
      expect(attempt).toThrow(SecurityPrivilegeError);
      expect(attempt).toThrow(BusinessRuleError);
    }
  });

  it('does not treat saving an existing Super Admin as a promotion', () => {
    expect(() => assertMayGrantMemberType(admin, SUPER_ADMIN_TYPE, SUPER_ADMIN_TYPE)).not.toThrow();
  });
});

describe.each(drivers)('$name driver: Super Admin privilege guard', (d) => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {}); // members.create logs the welcome email
  });

  it('lets a Super Admin create another Super Admin', async () => {
    const db = await d.make();
    const created = await db.members.create(MEMBER.superAdmin, await recruit(db, SUPER_ADMIN_TYPE));
    expect(created.MemberTypeID).toBe(await typeId(db, SUPER_ADMIN_TYPE));
    expect(await db.members.get(created.id)).toMatchObject({ Email: 'new.recruit@example.org' });
  });

  it('refuses a Council Admin creating a Super Admin and writes nothing', async () => {
    const db = await d.make();
    const members = d.count(db, 'Member');
    const logins = d.count(db, 'Credentials');
    await expectPrivilegeError(db.members.create(MEMBER.admin, await recruit(db, SUPER_ADMIN_TYPE)));
    expect(d.count(db, 'Member')).toBe(members);
    expect(d.count(db, 'Credentials')).toBe(logins);
    expect(await db.members.getByEmail('new.recruit@example.org')).toBeNull();
  });

  it('refuses a standard Member creating a Super Admin', async () => {
    const db = await d.make();
    await expectPrivilegeError(db.members.create(MEMBER.member, await recruit(db, SUPER_ADMIN_TYPE)));
  });

  it('still lets a Council Admin create Admins and Members', async () => {
    const db = await d.make();
    const member = await db.members.create(MEMBER.admin, await recruit(db, 'Member'));
    const admin = await db.members.create(MEMBER.admin, { ...(await recruit(db, 'Admin', 'second.admin@example.org')), MemberNumber: 9920002 });
    expect(member.MemberTypeID).toBe(await typeId(db, 'Member'));
    expect(admin.MemberTypeID).toBe(await typeId(db, 'Admin'));
  });

  it('refuses a Council Admin promoting a member, or themselves, to Super Admin and leaves the row unchanged', async () => {
    const db = await d.make();
    const superType = await typeId(db, SUPER_ADMIN_TYPE);
    const before = await db.members.get(MEMBER.member);
    await expectPrivilegeError(db.members.update(MEMBER.admin, MEMBER.member, { MemberTypeID: superType, Phone: '555-999-0000' }));
    await expectPrivilegeError(db.members.update(MEMBER.admin, MEMBER.admin, { MemberTypeID: superType }));
    expect(await db.members.get(MEMBER.member)).toEqual(before);
    expect((await db.members.get(MEMBER.admin))!.MemberTypeID).not.toBe(superType);
  });

  it('lets a Super Admin promote a member to Super Admin', async () => {
    const db = await d.make();
    const superType = await typeId(db, SUPER_ADMIN_TYPE);
    const updated = await db.members.update(MEMBER.superAdmin, MEMBER.member, { MemberTypeID: superType });
    expect(updated.MemberTypeID).toBe(superType);
    expect((await db.members.get(MEMBER.member))!.MemberTypeID).toBe(superType);
  });

  it('lets a Council Admin edit an existing Super Admin’s other fields', async () => {
    const db = await d.make();
    const updated = await db.members.update(MEMBER.admin, MEMBER.superAdmin, { Phone: '555-123-4567' });
    expect(updated).toMatchObject({ Phone: '555-123-4567', MemberTypeID: await typeId(db, SUPER_ADMIN_TYPE) });
  });

  it('refuses a Super Admin who is no longer Active', async () => {
    const db = await d.make();
    await db.members.update(MEMBER.superAdmin, MEMBER.superAdmin, { StatusID: await statusId(db, 'Inactive') });
    await expectPrivilegeError(db.members.create(MEMBER.superAdmin, await recruit(db, SUPER_ADMIN_TYPE)));
  });

  it('rejects an unknown caller or member', async () => {
    const db = await d.make();
    await expectRule(db.members.create(999, await recruit(db, 'Member')), 'MEMBER_NOT_FOUND');
    await expectRule(db.members.update(MEMBER.superAdmin, 999, { Phone: '555-000-0000' }), 'MEMBER_NOT_FOUND');
  });

  it('renames the login with the email and refuses an email another member uses', async () => {
    const db = await d.make();
    const taken = (await db.members.get(MEMBER.admin))!.Email;
    await expectRule(db.members.update(MEMBER.superAdmin, MEMBER.member, { Email: taken.toUpperCase() }), 'INVALID_INPUT');
    await db.members.update(MEMBER.superAdmin, MEMBER.member, { Email: 'renamed.member@example.org' });
    expect(d.credentials(db).map((c) => c.Username)).toContain('renamed.member@example.org');
    expect(await db.members.getByEmail('renamed.member@example.org')).toMatchObject({ id: MEMBER.member });
  });
});
