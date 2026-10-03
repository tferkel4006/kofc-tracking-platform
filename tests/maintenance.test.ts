import { describe, expect, it } from 'vitest';
import {
  assertMayMaintainCouncilRecords,
  assertMayMaintainCouncils,
  BusinessRuleError,
  cleanCouncil,
  cleanPastor,
  RECORD_REFERENCES,
  SecurityPrivilegeError,
  type DataService,
  type NewActivity,
  type NewParish,
} from '@kofc/shared';
import { TABLES } from '../apps/web/services/generated/schema.generated';
import { COUNCIL_ACTIVITIES, drivers, expectRule, MEMBER } from './helpers';

// Sprint 5G maintenance: councils are Super Admin only (SUPER_ADMIN_REQUIRED); parishes, pastors, activities and
// distribution lists belong to their council's Admins and any Super Admin (ADMIN_REQUIRED, COUNCIL_ACCESS_DENIED).
// Deletes never cascade (RECORD_IN_USE), except a distribution list's own member entries.
// Dev seed: council 1 is 15295 (seeded Super Admin 1, Admin 2, Member 3, new member 4), council 2 is 1024.
const OWN = 1;
const OTHER = 2;

// Council.Email is VARCHAR(100): these sit exactly on and one past the limit.
const EMAIL_AT_LIMIT = `${'a'.repeat(90)}@gmail.com`;
const EMAIL_OVER_LIMIT = `${'a'.repeat(91)}@gmail.com`;
const MALFORMED_EMAILS = ['kofc15295gmail.com', 'kofc15295@', 'kofc15295@gmail', '@gmail.com', 'kofc 15295@gmail.com'];

const parishFor =(councilId: number, name = 'St. Jude Parish'): NewParish => ({
  Name: name,
  StreetAddress1: '100 Church St',
  City: 'Portland',
  State: 'OR',
  Phone: '503-555-0100',
  CouncilID: councilId,
});

async function serviceCategory(db: DataService): Promise<number> {
  return (await db.lookups.list('Category')).find((c) => c.Category === 'Service')!.id;
}

async function activityFor(db: DataService, councilId: number, name = 'Rosary Rally'): Promise<NewActivity> {
  return { ActivityName: name, ActivityDescription: 'Winter coat collection', CategoryID: await serviceCategory(db), CouncilID: councilId };
}

/** An Admin of council 2, added by the seeded Super Admin; `inactive` also sets their status to Inactive. */
async function otherCouncilAdmin(db: DataService, inactive = false): Promise<number> {
  const types = await db.lookups.list('MemberType');
  const statuses = await db.lookups.list('MemberStatus');
  const admin = await db.members.create(MEMBER.superAdmin, {
    CouncilID: OTHER,
    MemberNumber: 7700001,
    MemberFirstName: 'Other',
    MemberLastName: 'Admin',
    Phone: '503-555-0142',
    StreetAddress1: '1 Peace Way',
    City: 'Salem',
    State: 'OR',
    ZipCode: '97301',
    Email: 'other.admin@example.org',
    DateOfBirth: '1970-05-05',
    StatusID: statuses.find((s) => s.Status === (inactive ? 'Inactive' : 'Active'))!.id,
    DegreeID: 3,
    MemberTypeID: types.find((t) => t.Type === 'Admin')!.id,
  });
  return admin.id;
}

async function expectPrivilege(promise: Promise<unknown>, code: 'ADMIN_REQUIRED' | 'SUPER_ADMIN_REQUIRED' | 'COUNCIL_ACCESS_DENIED') {
  const err = await expectRule(promise, code);
  expect(err).toBeInstanceOf(SecurityPrivilegeError);
}

describe('maintenance rules', () => {
  const superAdmin = { memberId: 1, councilId: 1, memberType: 'Super Admin', active: true };
  const admin = { memberId: 2, councilId: 1, memberType: 'Admin', active: true };
  const member = { memberId: 3, councilId: 1, memberType: 'Member', active: true };

  it('lets only an active Super Admin maintain councils', () => {
    expect(() => assertMayMaintainCouncils(superAdmin, 'add councils')).not.toThrow();
    for (const actor of [admin, member, { ...superAdmin, active: false }]) {
      expect(() => assertMayMaintainCouncils(actor, 'add councils')).toThrow(SecurityPrivilegeError);
    }
  });

  it('confines an Admin to their own council and refuses members and inactive admins outright', () => {
    expect(() => assertMayMaintainCouncilRecords(admin, 1, 'add parishes')).not.toThrow();
    expect(() => assertMayMaintainCouncilRecords(superAdmin, 9, 'add parishes')).not.toThrow();
    expect(() => assertMayMaintainCouncilRecords(admin, 9, 'add parishes')).toThrow(/own council/);
    expect(() => assertMayMaintainCouncilRecords(member, 1, 'add parishes')).toThrow(/Only an active Admin/);
    expect(() => assertMayMaintainCouncilRecords({ ...admin, active: false }, 1, 'add parishes')).toThrow(/inactive Admin/);
  });

  it('trims fields, clears blank optional text and rejects unknown fields and bad emails', () => {
    expect(cleanCouncil({ CouncilNumber: 42, CouncilName: '  Holy Family ', State: 'OR', Phone: '  ' })).toEqual({
      CouncilNumber: 42,
      CouncilName: 'Holy Family',
      State: 'OR',
      Phone: undefined,
    });
    expect(() => cleanCouncil({ CouncilNumber: 0, CouncilName: 'x', State: 'OR' })).toThrow(/whole number/);
    expect(() => cleanCouncil({ CouncilNumber: 1, CouncilName: 'x', State: 'OR', Motto: 'x' } as never)).toThrow(/no field "Motto"/);
    expect(() => cleanPastor({ FirstName: 'John', LastName: 'Doe', Email: 'not-an-email', ParishID: 1 })).toThrow(/not a valid address/);
  });

  it('keeps a valid council email, clears a blank one and rejects malformed or overlong addresses', () => {
    const council = { CouncilNumber: 42, CouncilName: 'Holy Family', State: 'OR' };
    expect(cleanCouncil({ ...council, Email: '  kofc15295@gmail.com ' }).Email).toBe('kofc15295@gmail.com');
    expect(cleanCouncil({ ...council, Email: '   ' }).Email).toBeUndefined();
    expect(cleanCouncil(council).Email).toBeUndefined();
    expect(cleanCouncil({ ...council, Email: EMAIL_AT_LIMIT }).Email).toBe(EMAIL_AT_LIMIT);

    const rejection = (Email: string) => {
      try {
        cleanCouncil({ ...council, Email });
      } catch (e) {
        expect(e).toBeInstanceOf(BusinessRuleError);
        expect((e as BusinessRuleError).code).toBe('INVALID_INPUT');
        return (e as BusinessRuleError).message;
      }
      throw new Error(`expected "${Email}" to be rejected`);
    };
    for (const email of MALFORMED_EMAILS) expect(rejection(email)).toContain('not a valid address');
    expect(rejection(EMAIL_OVER_LIMIT)).toBe('Email must be at most 100 characters; received 101.');
  });

  it('lists every schema column that points at a maintained table, so no delete can orphan a row', () => {
    const targets: Record<string, keyof typeof RECORD_REFERENCES> = {
      Council: 'Council',
      Parish: 'Parish',
      Activities: 'Activities',
      DistributionLists: 'DistributionLists',
    };
    for (const [table, meta] of Object.entries(TABLES)) {
      for (const fk of meta.foreignKeys) {
        const target = targets[fk.refTable];
        if (!target || (table === 'DistributionListMembers' && fk.column === 'ListID')) continue;
        expect(RECORD_REFERENCES[target], `${table}.${fk.column}`).toContainEqual(expect.objectContaining({ table, column: fk.column }));
      }
      for (const col of meta.columns) {
        // Columns that name a council without a declared foreign key (EventCouncils, AffiliatedCouncils, DistributionLists).
        if (/CouncilID$/.test(col.name) && table !== 'Council') {
          expect(RECORD_REFERENCES.Council, `${table}.${col.name}`).toContainEqual(expect.objectContaining({ table, column: col.name }));
        }
      }
    }
  });
});

describe.each(drivers)('$name driver: council maintenance', (d) => {
  it('lets a Super Admin add, edit and delete an unused council', async () => {
    const db = await d.make();
    const created = await db.councils.create(MEMBER.superAdmin, { CouncilNumber: 8080, CouncilName: 'Holy Family Council', State: 'OR' });
    expect(created).toMatchObject({ CouncilNumber: 8080, CouncilName: 'Holy Family Council', State: 'OR' });
    expect((await db.councils.list()).map((c) => c.CouncilNumber)).toContain(8080);

    const renamed = await db.councils.update(MEMBER.superAdmin, created.id, { CouncilName: 'Holy Family Council #8080', Phone: '503-555-0111' });
    expect(renamed).toMatchObject({ CouncilNumber: 8080, CouncilName: 'Holy Family Council #8080', Phone: '503-555-0111' });
    expect((await db.councils.update(MEMBER.superAdmin, created.id, { Phone: null })).Phone ?? null).toBeNull();

    await db.councils.remove(MEMBER.superAdmin, created.id);
    expect(await db.councils.get(created.id)).toBeNull();
  });

  it('refuses Admins, Members and an inactive Super Admin without writing', async () => {
    const db = await d.make();
    const before = d.count(db, 'Council');
    const council = { CouncilNumber: 8081, CouncilName: 'Refused Council', State: 'OR' };
    await expectPrivilege(db.councils.create(MEMBER.admin, council), 'SUPER_ADMIN_REQUIRED');
    await expectPrivilege(db.councils.create(MEMBER.member, council), 'SUPER_ADMIN_REQUIRED');
    await expectPrivilege(db.councils.update(MEMBER.admin, OWN, { CouncilName: 'Renamed by an Admin' }), 'SUPER_ADMIN_REQUIRED');
    await expectPrivilege(db.councils.remove(MEMBER.admin, OTHER), 'SUPER_ADMIN_REQUIRED');
    await expectRule(db.councils.create(9999, council), 'MEMBER_NOT_FOUND');
    expect(d.count(db, 'Council')).toBe(before);
    expect((await db.councils.get(OWN))?.CouncilName).toBe('St. Jude Council');

    // A Super Admin whose status lapses loses the tier.
    const statuses = await db.lookups.list('MemberStatus');
    const types = await db.lookups.list('MemberType');
    const lapsed = await db.members.create(MEMBER.superAdmin, {
      CouncilID: OWN,
      MemberNumber: 7700002,
      MemberFirstName: 'Lapsed',
      MemberLastName: 'Super',
      Phone: '503-555-0000',
      StreetAddress1: '3 Main St',
      City: 'Portland',
      State: 'OR',
      ZipCode: '97201',
      Email: 'lapsed.super@example.org',
      DateOfBirth: '1960-01-01',
      StatusID: statuses.find((s) => s.Status === 'Inactive')!.id,
      DegreeID: 3,
      MemberTypeID: types.find((t) => t.Type === 'Super Admin')!.id,
    });
    await expectPrivilege(db.councils.create(lapsed.id, council), 'SUPER_ADMIN_REQUIRED');
    expect(d.count(db, 'Council')).toBe(before);
  });

  it('rejects a council number already in use and bad fields', async () => {
    const db = await d.make();
    const err = await expectRule(
      db.councils.create(MEMBER.superAdmin, { CouncilNumber: 15295, CouncilName: 'Copy', State: 'OR' }),
      'INVALID_INPUT',
    );
    expect(err.message).toContain('already used by another council');
    await expectRule(db.councils.update(MEMBER.superAdmin, OTHER, { CouncilNumber: 15295 }), 'INVALID_INPUT');
    await expectRule(db.councils.update(MEMBER.superAdmin, OTHER, { CouncilName: '   ' }), 'INVALID_INPUT');
    await expectRule(db.councils.update(MEMBER.superAdmin, 999, { CouncilName: 'Ghost' }), 'RECORD_NOT_FOUND');
    expect((await db.councils.get(OTHER))?.CouncilNumber).toBe(1024);
  });

  it('refuses to delete a council anything points at, naming what is in use', async () => {
    const db = await d.make();
    const before = d.count(db, 'Council');
    const err = await expectRule(db.councils.remove(MEMBER.superAdmin, OWN), 'RECORD_IN_USE');
    expect(err.message).toMatch(/\d+ members/);
    expect(err.message).toContain('11 activities');
    expect(d.count(db, 'Council')).toBe(before);

    const fresh = await db.councils.create(MEMBER.superAdmin, { CouncilNumber: 8082, CouncilName: 'Parish Holder', State: 'OR' });
    await db.parishes.create(MEMBER.superAdmin, parishFor(fresh.id));
    const inUse = await expectRule(db.councils.remove(MEMBER.superAdmin, fresh.id), 'RECORD_IN_USE');
    expect(inUse.message).toContain('1 parish');
    expect(await db.councils.get(fresh.id)).not.toBeNull();
  });
});

describe.each(drivers)('$name driver: council email', (d) => {
  it('seeds the shared address on St. Jude Council #15295', async () => {
    const db = await d.make();
    expect(await db.councils.get(OWN)).toMatchObject({ CouncilNumber: 15295, Email: 'kofc15295@gmail.com' });
  });

  it('stores an email on create, then changes and clears it on update', async () => {
    const db = await d.make();
    const created = await db.councils.create(MEMBER.superAdmin, {
      CouncilNumber: 8090,
      CouncilName: 'Email Council',
      State: 'OR',
      Email: ' kofc8090@gmail.com ',
    });
    expect(created.Email).toBe('kofc8090@gmail.com');
    expect((await db.councils.get(created.id))?.Email).toBe('kofc8090@gmail.com');

    await db.councils.update(MEMBER.superAdmin, created.id, { Email: EMAIL_AT_LIMIT });
    expect((await db.councils.get(created.id))?.Email).toBe(EMAIL_AT_LIMIT);

    await db.councils.update(MEMBER.superAdmin, created.id, { Email: null });
    expect((await db.councils.get(created.id))?.Email ?? null).toBeNull();

    const noEmail = await db.councils.create(MEMBER.superAdmin, { CouncilNumber: 8091, CouncilName: 'No Email Council', State: 'OR' });
    expect((await db.councils.get(noEmail.id))?.Email ?? null).toBeNull();
  });

  it('rejects a malformed or overlong email on create without adding a council', async () => {
    const db = await d.make();
    const before = d.count(db, 'Council');
    for (const [i, Email] of [...MALFORMED_EMAILS, EMAIL_OVER_LIMIT].entries()) {
      const council = { CouncilNumber: 8100 + i, CouncilName: `Bad Email Council ${i}`, State: 'OR', Email };
      await expectRule(db.councils.create(MEMBER.superAdmin, council), 'INVALID_INPUT');
    }
    expect(d.count(db, 'Council')).toBe(before);
  });

  it('rejects a malformed or overlong email on update and keeps the stored one', async () => {
    const db = await d.make();
    for (const Email of [...MALFORMED_EMAILS, EMAIL_OVER_LIMIT]) {
      await expectRule(db.councils.update(MEMBER.superAdmin, OWN, { Email }), 'INVALID_INPUT');
    }
    expect((await db.councils.get(OWN))?.Email).toBe('kofc15295@gmail.com');
  });
});

describe.each(drivers)('$name driver: parishes and pastors', (d) => {
  it('lets a council Admin maintain their parishes and pastors', async () => {
    const db = await d.make();
    const parish = await db.parishes.create(MEMBER.admin, { ...parishFor(OWN), StreetAddress2: '  ' });
    expect(parish).toMatchObject({ Name: 'St. Jude Parish', CouncilID: OWN });
    expect(parish.StreetAddress2 ?? null).toBeNull();

    const pastor = await db.pastors.create(MEMBER.admin, { FirstName: 'Thomas', LastName: 'Aquino', Email: 'fr.thomas@example.org', ParishID: parish.id });
    await db.pastors.create(MEMBER.admin, { FirstName: 'Anne', LastName: 'Burke', ParishID: parish.id });
    expect((await db.pastors.listByParish(parish.id)).map((p) => p.LastName)).toEqual(['Aquino', 'Burke']);
    expect((await db.pastors.listByCouncil(OWN)).map((p) => p.LastName)).toEqual(['Aquino', 'Burke']);

    expect(await db.pastors.update(MEMBER.admin, pastor.id, { Phone: '503-555-0101' })).toMatchObject({ Phone: '503-555-0101', LastName: 'Aquino' });
    expect(await db.parishes.update(MEMBER.admin, parish.id, { City: 'Beaverton' })).toMatchObject({ City: 'Beaverton', Name: 'St. Jude Parish' });
    expect((await db.parishes.listByCouncil(OWN)).map((p) => p.id)).toEqual([parish.id]);
    expect(await db.parishes.get(parish.id)).toMatchObject({ City: 'Beaverton' });
  });

  it('keeps an Admin out of other councils, including moving a parish or pastor there', async () => {
    const db = await d.make();
    const own = await db.parishes.create(MEMBER.admin, parishFor(OWN));
    const other = await db.parishes.create(MEMBER.superAdmin, parishFor(OTHER, 'Our Lady of Peace Parish'));
    const pastor = await db.pastors.create(MEMBER.admin, { FirstName: 'Thomas', LastName: 'Aquino', ParishID: own.id });
    const parishes = d.count(db, 'Parish');
    const pastors = d.count(db, 'Pastor');

    await expectPrivilege(db.parishes.create(MEMBER.admin, parishFor(OTHER, 'Sneaky Parish')), 'COUNCIL_ACCESS_DENIED');
    await expectPrivilege(db.parishes.update(MEMBER.admin, other.id, { Name: 'Renamed' }), 'COUNCIL_ACCESS_DENIED');
    await expectPrivilege(db.parishes.update(MEMBER.admin, own.id, { CouncilID: OTHER }), 'COUNCIL_ACCESS_DENIED');
    await expectPrivilege(db.parishes.remove(MEMBER.admin, other.id), 'COUNCIL_ACCESS_DENIED');
    await expectPrivilege(db.pastors.create(MEMBER.admin, { FirstName: 'X', LastName: 'Y', ParishID: other.id }), 'COUNCIL_ACCESS_DENIED');
    await expectPrivilege(db.pastors.update(MEMBER.admin, pastor.id, { ParishID: other.id }), 'COUNCIL_ACCESS_DENIED');

    const otherAdmin = await otherCouncilAdmin(db);
    await expectPrivilege(db.pastors.remove(otherAdmin, pastor.id), 'COUNCIL_ACCESS_DENIED');

    expect(d.count(db, 'Parish')).toBe(parishes);
    expect(d.count(db, 'Pastor')).toBe(pastors);
    expect((await db.parishes.get(own.id))?.CouncilID).toBe(OWN);
    expect((await db.pastors.listByParish(own.id)).map((p) => p.id)).toEqual([pastor.id]);

    // A Super Admin may move them anywhere.
    expect((await db.pastors.update(MEMBER.superAdmin, pastor.id, { ParishID: other.id })).ParishID).toBe(other.id);
    expect((await db.parishes.update(MEMBER.superAdmin, own.id, { CouncilID: OTHER, Name: 'Moved Parish' })).CouncilID).toBe(OTHER);
  });

  it('refuses Members and inactive Admins, and unknown parishes', async () => {
    const db = await d.make();
    await expectPrivilege(db.parishes.create(MEMBER.member, parishFor(OWN)), 'ADMIN_REQUIRED');
    await expectPrivilege(db.pastors.create(MEMBER.member, { FirstName: 'X', LastName: 'Y', ParishID: 999 }), 'ADMIN_REQUIRED');
    const inactive = await otherCouncilAdmin(db, true);
    await expectPrivilege(db.parishes.create(inactive, parishFor(OTHER)), 'ADMIN_REQUIRED');
    expect(d.count(db, 'Parish')).toBe(0);

    await expectRule(db.pastors.create(MEMBER.admin, { FirstName: 'X', LastName: 'Y', ParishID: 999 }), 'INVALID_INPUT');
    await expectRule(db.parishes.create(MEMBER.superAdmin, parishFor(999)), 'INVALID_INPUT');
    await expectRule(db.parishes.remove(MEMBER.admin, 999), 'RECORD_NOT_FOUND');
    expect(d.count(db, 'Pastor')).toBe(0);
  });

  it('rejects a duplicate parish name within a council but allows it in another', async () => {
    const db = await d.make();
    await db.parishes.create(MEMBER.admin, parishFor(OWN));
    await expectRule(db.parishes.create(MEMBER.admin, parishFor(OWN, 'st. jude parish')), 'INVALID_INPUT');
    await db.parishes.create(MEMBER.superAdmin, parishFor(OTHER));
    expect(d.count(db, 'Parish')).toBe(2);
  });

  it('keeps a parish while it has pastors, then deletes it once they are gone', async () => {
    const db = await d.make();
    const parish = await db.parishes.create(MEMBER.admin, parishFor(OWN));
    const pastor = await db.pastors.create(MEMBER.admin, { FirstName: 'Thomas', LastName: 'Aquino', ParishID: parish.id });

    const err = await expectRule(db.parishes.remove(MEMBER.admin, parish.id), 'RECORD_IN_USE');
    expect(err.message).toContain('1 pastor');
    expect(d.count(db, 'Pastor')).toBe(1);

    await db.pastors.remove(MEMBER.admin, pastor.id);
    await db.parishes.remove(MEMBER.admin, parish.id);
    expect(await db.parishes.get(parish.id)).toBeNull();
  });
});

describe.each(drivers)('$name driver: activities', (d) => {
  it('lets a council Admin add, edit and delete an activity', async () => {
    const db = await d.make();
    const created = await db.activities.create(MEMBER.admin, await activityFor(db, OWN));
    expect(created).toMatchObject({ ActivityName: 'Rosary Rally', CouncilID: OWN });
    expect((await db.activities.listByCouncil(OWN)).map((a) => a.ActivityName)).toEqual(
      [...COUNCIL_ACTIVITIES, 'Rosary Rally'].sort((a, b) => a.localeCompare(b)),
    );

    expect(await db.activities.update(MEMBER.admin, created.id, { ActivityDescription: 'Coats for local schools' })).toMatchObject({
      ActivityName: 'Rosary Rally',
      ActivityDescription: 'Coats for local schools',
    });
    expect(await db.activities.get(created.id)).toMatchObject({ ActivityDescription: 'Coats for local schools' });

    await db.activities.remove(MEMBER.admin, created.id);
    expect(await db.activities.get(created.id)).toBeNull();
  });

  it('confines Admins to their council and refuses Members, without writing', async () => {
    const db = await d.make();
    const before = d.count(db, 'Activities');
    await expectPrivilege(db.activities.create(MEMBER.admin, await activityFor(db, OTHER)), 'COUNCIL_ACCESS_DENIED');
    await expectPrivilege(db.activities.create(MEMBER.member, await activityFor(db, OWN)), 'ADMIN_REQUIRED');
    await expectPrivilege(db.activities.update(MEMBER.admin, 1, { CouncilID: OTHER }), 'COUNCIL_ACCESS_DENIED');
    const otherAdmin = await otherCouncilAdmin(db);
    await expectPrivilege(db.activities.update(otherAdmin, 1, { ActivityName: 'Hijacked' }), 'COUNCIL_ACCESS_DENIED');
    await expectPrivilege(db.activities.remove(otherAdmin, 1), 'COUNCIL_ACCESS_DENIED');
    expect(d.count(db, 'Activities')).toBe(before);
    expect((await db.activities.get(1))?.ActivityName).toBe('Bedding drive');
  });

  it('rejects an unknown category, a duplicate name and a blank description', async () => {
    const db = await d.make();
    await expectRule(db.activities.create(MEMBER.admin, { ...(await activityFor(db, OWN)), CategoryID: 999 }), 'INVALID_INPUT');
    await expectRule(db.activities.create(MEMBER.admin, await activityFor(db, OWN, 'coats FOR kids')), 'INVALID_INPUT');
    await expectRule(db.activities.update(MEMBER.admin, 1, { ActivityDescription: '' }), 'INVALID_INPUT');
  });

  it('keeps an activity once time has been logged against it', async () => {
    const db = await d.make();
    await db.activityTime.logHours(MEMBER.member, 1, 1.25, '2026-09-19');
    const err = await expectRule(db.activities.remove(MEMBER.admin, 1), 'RECORD_IN_USE');
    expect(err.message).toContain('1 time entry');
    expect(await db.activities.get(1)).not.toBeNull();
  });
});

describe.each(drivers)('$name driver: distribution lists', (d) => {
  it('creates a council-wide list owned by the Admin, then renames it and replaces its members', async () => {
    const db = await d.make();
    const created = await db.distributionLists.create(MEMBER.admin, {
      ListName: ' Fish Fry Crew ',
      CouncilID: OWN,
      memberIds: [MEMBER.member, MEMBER.superAdmin, MEMBER.member],
      IsCouncilWide: true,
    });
    expect(created.list).toMatchObject({ ListName: 'Fish Fry Crew', CouncilID: OWN, CreatedBy: MEMBER.admin, IsCouncilWide: 1 });
    expect(created.memberIds).toEqual([MEMBER.superAdmin, MEMBER.member]);

    const renamed = await db.distributionLists.update(MEMBER.admin, created.list.id, { ListName: 'Fish Fry Volunteers' });
    expect(renamed).toMatchObject({ list: { ListName: 'Fish Fry Volunteers' }, memberIds: [MEMBER.superAdmin, MEMBER.member] });

    const replaced = await db.distributionLists.update(MEMBER.admin, created.list.id, { memberIds: [MEMBER.newMember] });
    expect(replaced.memberIds).toEqual([MEMBER.newMember]);
    expect(d.count(db, 'DistributionListMembers')).toBe(1);

    const listed = await db.distributionLists.listByCouncil(OWN);
    expect(listed.map((l) => [l.list.ListName, l.memberIds])).toEqual([['Fish Fry Volunteers', [MEMBER.newMember]]]);
  });

  it('refuses members of another council and unknown members, all or nothing', async () => {
    const db = await d.make();
    const otherAdmin = await otherCouncilAdmin(db);
    const err = await expectRule(
      db.distributionLists.create(MEMBER.admin, { ListName: 'Mixed', CouncilID: OWN, memberIds: [MEMBER.member, otherAdmin] }),
      'INVALID_INPUT',
    );
    expect(err.message).toContain('own council');
    await expectRule(db.distributionLists.create(MEMBER.admin, { ListName: 'Ghost', CouncilID: OWN, memberIds: [9999] }), 'INVALID_INPUT');
    expect(d.count(db, 'DistributionLists')).toBe(0);
    expect(d.count(db, 'DistributionListMembers')).toBe(0);

    const list = await db.distributionLists.create(MEMBER.admin, { ListName: 'Officers', CouncilID: OWN, memberIds: [MEMBER.member], IsCouncilWide: true });
    await expectRule(db.distributionLists.update(MEMBER.admin, list.list.id, { ListName: 'Renamed', memberIds: [otherAdmin] }), 'INVALID_INPUT');
    const [kept] = await db.distributionLists.listByCouncil(OWN);
    expect(kept).toMatchObject({ list: { ListName: 'Officers' }, memberIds: [MEMBER.member] });
  });

  it('rejects a duplicate list name within the council', async () => {
    const db = await d.make();
    await db.distributionLists.create(MEMBER.admin, { ListName: 'Officers', CouncilID: OWN, memberIds: [] });
    await expectRule(db.distributionLists.create(MEMBER.admin, { ListName: 'OFFICERS', CouncilID: OWN, memberIds: [] }), 'INVALID_INPUT');
    await expectRule(db.distributionLists.create(MEMBER.admin, { ListName: '', CouncilID: OWN, memberIds: [] }), 'INVALID_INPUT');
    expect(d.count(db, 'DistributionLists')).toBe(1);
  });

  it('confines Admins to their council and keeps council-wide lists from Members', async () => {
    const db = await d.make();
    const list = await db.distributionLists.create(MEMBER.admin, { ListName: 'Officers', CouncilID: OWN, memberIds: [MEMBER.member], IsCouncilWide: true });
    const otherAdmin = await otherCouncilAdmin(db);
    await expectPrivilege(db.distributionLists.create(MEMBER.member, { ListName: 'Mine', CouncilID: OWN, memberIds: [], IsCouncilWide: true }), 'ADMIN_REQUIRED');
    await expectPrivilege(db.distributionLists.create(MEMBER.admin, { ListName: 'Theirs', CouncilID: OTHER, memberIds: [] }), 'COUNCIL_ACCESS_DENIED');
    await expectPrivilege(db.distributionLists.update(otherAdmin, list.list.id, { memberIds: [] }), 'COUNCIL_ACCESS_DENIED');
    await expectPrivilege(db.distributionLists.remove(otherAdmin, list.list.id), 'COUNCIL_ACCESS_DENIED');
    await expectPrivilege(db.distributionLists.remove(MEMBER.member, list.list.id), 'ADMIN_REQUIRED');
    expect(d.count(db, 'DistributionLists')).toBe(1);
    expect(d.count(db, 'DistributionListMembers')).toBe(1);

    // A Super Admin maintains any council's lists.
    const theirs = await db.distributionLists.create(MEMBER.superAdmin, { ListName: 'Theirs', CouncilID: OTHER, memberIds: [otherAdmin] });
    expect(theirs.list.CreatedBy).toBe(MEMBER.superAdmin);
  });

  it('deletes a list together with its member entries', async () => {
    const db = await d.make();
    const keep = await db.distributionLists.create(MEMBER.admin, { ListName: 'Keep', CouncilID: OWN, memberIds: [MEMBER.admin], IsCouncilWide: true });
    const drop = await db.distributionLists.create(MEMBER.admin, { ListName: 'Drop', CouncilID: OWN, memberIds: [MEMBER.member, MEMBER.newMember], IsCouncilWide: true });
    await db.distributionLists.remove(MEMBER.admin, drop.list.id);
    expect(d.count(db, 'DistributionListMembers')).toBe(1);
    expect((await db.distributionLists.listByCouncil(OWN)).map((l) => l.list.id)).toEqual([keep.list.id]);
    await expectRule(db.distributionLists.remove(MEMBER.admin, drop.list.id), 'RECORD_NOT_FOUND');
  });

  // Sprint 5Z-10.8: personal distribution lists.
  it('lets any Active member build private lists that only they can see or change', async () => {
    const db = await d.make();
    const mine = await db.distributionLists.create(MEMBER.member, { ListName: 'My Fish Fry Team', CouncilID: OWN, memberIds: [MEMBER.admin] });
    expect(mine.list).toMatchObject({ CreatedBy: MEMBER.member, IsCouncilWide: 0 });
    const shared = await db.distributionLists.create(MEMBER.admin, { ListName: 'Officers', CouncilID: OWN, memberIds: [], IsCouncilWide: true });

    // The owner sees their private list beside the council-wide ones; nobody else sees it, Admins included.
    const names = async (actorId: number) => (await db.distributionLists.listForMember(actorId, OWN)).map((l) => l.list.ListName);
    expect(await names(MEMBER.member)).toEqual(['My Fish Fry Team', 'Officers']);
    expect(await names(MEMBER.admin)).toEqual(['Officers']);
    expect((await db.distributionLists.listByCouncil(OWN)).map((l) => l.list.id)).toEqual([shared.list.id]);
    await expectRule(db.distributionLists.listForMember(9999, OWN), 'MEMBER_NOT_FOUND');

    // Only the owner changes it; to anyone else its id does not exist.
    expect((await db.distributionLists.update(MEMBER.member, mine.list.id, { memberIds: [MEMBER.admin, MEMBER.superAdmin] })).memberIds).toEqual([MEMBER.superAdmin, MEMBER.admin]);
    await expectRule(db.distributionLists.update(MEMBER.admin, mine.list.id, { ListName: 'Taken' }), 'RECORD_NOT_FOUND');
    await expectRule(db.distributionLists.remove(MEMBER.superAdmin, mine.list.id), 'RECORD_NOT_FOUND');
    // A member cannot touch a council-wide list, nor publish their own.
    await expectPrivilege(db.distributionLists.update(MEMBER.member, shared.list.id, { ListName: 'Mine now' }), 'ADMIN_REQUIRED');
    await expectPrivilege(db.distributionLists.update(MEMBER.member, mine.list.id, { IsCouncilWide: true }), 'ADMIN_REQUIRED');
    await db.distributionLists.remove(MEMBER.member, mine.list.id);
    expect(d.count(db, 'DistributionLists')).toBe(1);
  });

  it('keeps private list names apart per member, and lets an Admin publish or withdraw their own list', async () => {
    const db = await d.make();
    await db.distributionLists.create(MEMBER.member, { ListName: 'Team', CouncilID: OWN, memberIds: [] });
    // Another member's private list of the same name is no clash; the owner's own duplicate is.
    const admins = await db.distributionLists.create(MEMBER.admin, { ListName: 'Team', CouncilID: OWN, memberIds: [] });
    await expectRule(db.distributionLists.create(MEMBER.member, { ListName: 'TEAM', CouncilID: OWN, memberIds: [] }), 'INVALID_INPUT');
    await expectPrivilege(db.distributionLists.create(MEMBER.member, { ListName: 'Elsewhere', CouncilID: OTHER, memberIds: [] }), 'COUNCIL_ACCESS_DENIED');

    const published = await db.distributionLists.update(MEMBER.admin, admins.list.id, { IsCouncilWide: true });
    expect(published.list.IsCouncilWide).toBe(1);
    expect((await db.distributionLists.listForMember(MEMBER.member, OWN)).map((l) => [l.list.ListName, l.list.CreatedBy])).toEqual([
      // Same name: the older list (the member's) first.
      ['Team', MEMBER.member],
      ['Team', MEMBER.admin],
    ]);
    // Another Admin of the council may keep the published list but not take it private from its creator.
    await expectRule(db.distributionLists.update(MEMBER.superAdmin, admins.list.id, { IsCouncilWide: false }), 'INVALID_INPUT');
    expect((await db.distributionLists.update(MEMBER.admin, admins.list.id, { IsCouncilWide: false })).list.IsCouncilWide).toBe(0);
    await expectRule(db.distributionLists.create(MEMBER.admin, { ListName: 'Team', CouncilID: OWN, memberIds: [], IsCouncilWide: 'yes' as never }), 'INVALID_INPUT');
  });
});
