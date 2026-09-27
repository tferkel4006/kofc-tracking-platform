import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  assertMayGrantMemberType,
  BusinessRuleError,
  canCreateMembers,
  canEditMember,
  grantableMemberTypes,
  SecurityPrivilegeError,
  SUPER_ADMIN_TYPE,
  type DataService,
  type NewMember,
  type SessionUser,
} from '@kofc/shared';
import { drivers, expectRule, MEMBER } from './helpers';

// Member writes are gated by the caller's tier, which the driver reads from the database, so a Council Admin
// or Member is refused whatever the client sends:
//  - only an Active Admin or Super Admin adds members (ADMIN_REQUIRED), an Admin only in their own council (COUNCIL_ACCESS_DENIED);
//  - a Member changes only their own contact details, skills and training (ADMIN_REQUIRED);
//  - only an Active Super Admin creates or promotes a Super Admin, or changes one's type or status (SUPER_ADMIN_REQUIRED).

// Dev seed: council 1 is 15295, home of the seeded Super Admin, Admin and Member; council 2 is affiliated 1024.
const OWN_COUNCIL = 1;
const OTHER_COUNCIL = 2;

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

/** Asserts the promise rejects with a SecurityPrivilegeError carrying `code`. */
async function expectPrivilegeError(
  promise: Promise<unknown>,
  code: 'ADMIN_REQUIRED' | 'SUPER_ADMIN_REQUIRED' = 'SUPER_ADMIN_REQUIRED',
): Promise<void> {
  const err = await expectRule(promise, code);
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

  it('refuses a standard Member creating any member, Super Admin or not, and writes nothing', async () => {
    const db = await d.make();
    const members = d.count(db, 'Member');
    const logins = d.count(db, 'Credentials');
    await expectPrivilegeError(db.members.create(MEMBER.member, await recruit(db, 'Member')), 'ADMIN_REQUIRED');
    await expectPrivilegeError(db.members.create(MEMBER.member, await recruit(db, SUPER_ADMIN_TYPE)), 'ADMIN_REQUIRED');
    expect(d.count(db, 'Member')).toBe(members);
    expect(d.count(db, 'Credentials')).toBe(logins);
  });

  it('refuses an Admin who is no longer Active adding members', async () => {
    const db = await d.make();
    await db.members.update(MEMBER.superAdmin, MEMBER.admin, { StatusID: await statusId(db, 'Inactive') });
    await expectPrivilegeError(db.members.create(MEMBER.admin, await recruit(db, 'Member')), 'ADMIN_REQUIRED');
  });

  it('lets a standard Member update their own contact details', async () => {
    const db = await d.make();
    const updated = await db.members.update(MEMBER.member, MEMBER.member, { Phone: '555-321-0000', City: 'Salem' });
    expect(updated).toMatchObject({ Phone: '555-321-0000', City: 'Salem' });
  });

  it('refuses a standard Member modifying another member’s profile, skills or training', async () => {
    const db = await d.make();
    const before = await db.members.get(MEMBER.admin);
    const extensions = await db.memberProfiles.getExtensions(MEMBER.admin);
    await expectPrivilegeError(db.members.update(MEMBER.member, MEMBER.admin, { Phone: '555-000-0000' }), 'ADMIN_REQUIRED');
    await expectPrivilegeError(db.members.update(MEMBER.member, MEMBER.superAdmin, { Phone: '555-000-0000' }), 'ADMIN_REQUIRED');
    await expectPrivilegeError(db.memberProfiles.updateExtensions(MEMBER.member, MEMBER.admin, [], [], null), 'ADMIN_REQUIRED');
    expect(await db.members.get(MEMBER.admin)).toEqual(before);
    expect(await db.memberProfiles.getExtensions(MEMBER.admin)).toEqual(extensions);
  });

  it('refuses a standard Member changing their own type, status, council or name', async () => {
    const db = await d.make();
    const before = await db.members.get(MEMBER.member);
    for (const changes of [
      { MemberTypeID: await typeId(db, 'Admin') },
      { MemberTypeID: await typeId(db, SUPER_ADMIN_TYPE) },
      { StatusID: await statusId(db, 'Inactive') },
      { CouncilID: 2 },
      { MemberLastName: 'Renamed' },
    ]) {
      await expectPrivilegeError(db.members.update(MEMBER.member, MEMBER.member, changes), 'ADMIN_REQUIRED');
    }
    expect(await db.members.get(MEMBER.member)).toEqual(before);
  });

  it('lets a Council Admin create and edit members of their own council', async () => {
    const db = await d.make();
    const created = await db.members.create(MEMBER.admin, await recruit(db, 'Member'));
    expect(created.CouncilID).toBe(OWN_COUNCIL);
    expect(await db.members.update(MEMBER.admin, created.id, { Phone: '555-444-0000' })).toMatchObject({ Phone: '555-444-0000' });
    expect(await db.members.update(MEMBER.admin, MEMBER.member, { City: 'Salem' })).toMatchObject({ City: 'Salem' });
  });

  it('refuses a Council Admin adding a member to another council and writes nothing', async () => {
    const db = await d.make();
    const members = d.count(db, 'Member');
    const logins = d.count(db, 'Credentials');
    const err = await expectRule(
      db.members.create(MEMBER.admin, { ...(await recruit(db, 'Member')), CouncilID: OTHER_COUNCIL }),
      'COUNCIL_ACCESS_DENIED',
    );
    expect(err).toBeInstanceOf(SecurityPrivilegeError);
    expect(err.details).toMatchObject({ actorId: MEMBER.admin, actorCouncilId: OWN_COUNCIL, councilId: OTHER_COUNCIL });
    expect(d.count(db, 'Member')).toBe(members);
    expect(d.count(db, 'Credentials')).toBe(logins);
  });

  it('refuses a Council Admin editing, or pulling in, a member of another council and leaves the row unchanged', async () => {
    const db = await d.make();
    const outsider = await db.members.create(MEMBER.superAdmin, { ...(await recruit(db, 'Member')), CouncilID: OTHER_COUNCIL });
    const before = await db.members.get(outsider.id);
    const extensions = await db.memberProfiles.getExtensions(outsider.id);
    await expectRule(db.members.update(MEMBER.admin, outsider.id, { Phone: '555-000-0000' }), 'COUNCIL_ACCESS_DENIED');
    await expectRule(db.members.update(MEMBER.admin, outsider.id, { CouncilID: OWN_COUNCIL }), 'COUNCIL_ACCESS_DENIED');
    await expectRule(db.memberProfiles.updateExtensions(MEMBER.admin, outsider.id, [], [], null), 'COUNCIL_ACCESS_DENIED');
    expect(await db.members.get(outsider.id)).toEqual(before);
    expect(await db.memberProfiles.getExtensions(outsider.id)).toEqual(extensions);
  });

  it('refuses a Council Admin moving their own council’s member to another council', async () => {
    const db = await d.make();
    const before = await db.members.get(MEMBER.member);
    await expectRule(db.members.update(MEMBER.admin, MEMBER.member, { CouncilID: OTHER_COUNCIL }), 'COUNCIL_ACCESS_DENIED');
    expect(await db.members.get(MEMBER.member)).toEqual(before);
  });

  it('lets a Super Admin add and edit members of any council', async () => {
    const db = await d.make();
    const outsider = await db.members.create(MEMBER.superAdmin, { ...(await recruit(db, 'Member')), CouncilID: OTHER_COUNCIL });
    expect(await db.members.update(MEMBER.superAdmin, outsider.id, { Phone: '555-777-0000' })).toMatchObject({ Phone: '555-777-0000' });
    expect(await db.members.update(MEMBER.superAdmin, outsider.id, { CouncilID: OWN_COUNCIL })).toMatchObject({ CouncilID: OWN_COUNCIL });
  });

  it('lets a Council Admin maintain another member’s skills and training', async () => {
    const db = await d.make();
    const ext = await db.memberProfiles.updateExtensions(MEMBER.admin, MEMBER.member, [], [], null);
    expect(ext).toEqual({ workingStatus: null, skills: [], training: [] });
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

  it('refuses a Council Admin demoting a Super Admin or changing their status, and leaves the row unchanged', async () => {
    const db = await d.make();
    const before = await db.members.get(MEMBER.superAdmin);
    await expectPrivilegeError(db.members.update(MEMBER.admin, MEMBER.superAdmin, { MemberTypeID: await typeId(db, 'Member') }));
    await expectPrivilegeError(db.members.update(MEMBER.admin, MEMBER.superAdmin, { MemberTypeID: await typeId(db, 'Admin') }));
    await expectPrivilegeError(db.members.update(MEMBER.admin, MEMBER.superAdmin, { StatusID: await statusId(db, 'Inactive') }));
    expect(await db.members.get(MEMBER.superAdmin)).toEqual(before);
  });

  it('lets a Super Admin demote another Super Admin', async () => {
    const db = await d.make();
    const second = await db.members.create(MEMBER.superAdmin, await recruit(db, SUPER_ADMIN_TYPE));
    const demoted = await db.members.update(MEMBER.superAdmin, second.id, { MemberTypeID: await typeId(db, 'Member') });
    expect(demoted.MemberTypeID).toBe(await typeId(db, 'Member'));
  });

  it('lets a Council Admin edit an existing Super Admin’s other fields', async () => {
    const db = await d.make();
    const updated = await db.members.update(MEMBER.admin, MEMBER.superAdmin, { Phone: '555-123-4567' });
    expect(updated).toMatchObject({ Phone: '555-123-4567', MemberTypeID: await typeId(db, SUPER_ADMIN_TYPE) });
  });

  it('treats a Super Admin who is no longer Active as having no admin rights', async () => {
    const db = await d.make();
    await db.members.update(MEMBER.superAdmin, MEMBER.superAdmin, { StatusID: await statusId(db, 'Inactive') });
    await expectPrivilegeError(db.members.create(MEMBER.superAdmin, await recruit(db, SUPER_ADMIN_TYPE)), 'ADMIN_REQUIRED');
    await expectPrivilegeError(
      db.members.update(MEMBER.superAdmin, MEMBER.member, { MemberTypeID: await typeId(db, SUPER_ADMIN_TYPE) }),
      'ADMIN_REQUIRED',
    );
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

describe('member UI gates (permissions.ts)', () => {
  const user = (memberType: SessionUser['memberType'], memberId: number) => ({ memberId, councilId: 1, memberType, isOfficer: false });
  const superAdmin = user('Super Admin', MEMBER.superAdmin);
  const admin = user('Admin', MEMBER.admin);
  const member = user('Member', MEMBER.member);

  it('offers "Add member" to Super Admins anywhere and to Admins in their own council only', () => {
    expect(canCreateMembers(superAdmin, OTHER_COUNCIL)).toBe(true);
    expect(canCreateMembers(admin, OWN_COUNCIL)).toBe(true);
    expect(canCreateMembers(admin, OTHER_COUNCIL)).toBe(false);
    expect(canCreateMembers(member, OWN_COUNCIL)).toBe(false);
  });

  it('lets a Member open only their own profile, and an Admin only their own council’s', () => {
    const own = (id: number) => ({ id, CouncilID: OWN_COUNCIL });
    expect(canEditMember(member, own(MEMBER.member))).toBe(true);
    expect(canEditMember(member, own(MEMBER.admin))).toBe(false);
    expect(canEditMember(admin, own(MEMBER.member))).toBe(true);
    expect(canEditMember(admin, { id: 99, CouncilID: OTHER_COUNCIL })).toBe(false);
    expect(canEditMember(superAdmin, { id: 99, CouncilID: OTHER_COUNCIL })).toBe(true);
  });

  it('hides type and promotion controls from Members, and from Admins on a Super Admin', () => {
    expect(grantableMemberTypes(member)).toEqual([]);
    expect(grantableMemberTypes(member, 'Member')).toEqual([]);
    expect(grantableMemberTypes(admin)).toEqual(['Admin', 'Member']);
    expect(grantableMemberTypes(admin, 'Super Admin')).toEqual([]);
    expect(grantableMemberTypes(superAdmin, 'Super Admin')).toEqual(['Super Admin', 'Admin', 'Member']);
  });
});
