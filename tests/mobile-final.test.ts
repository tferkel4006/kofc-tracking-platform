// Sprint 5Y-Mobile final: message Distribution Lists (All Members, Active Officers) and the
// Home feed's eviction of shifts and meetings that have already ended by the device clock.
import { describe, expect, it } from 'vitest';
import {
  DISTRIBUTION_GROUPS,
  distributionGroupLabel,
  distributionGroupMemberIds,
  meetingEnd,
  shiftEnd,
  withoutEndedMeetings,
  withoutEndedShifts,
  type DistributionGroup,
} from '@kofc/shared';
import { drivers, expectRule, MEMBER, NOW } from './helpers';

const roster = [
  { memberId: 5, roles: [{ Role: 'Trustee 2', Officer: 1 as const }] },
  { memberId: 1, roles: [{ Role: 'Grand Knight', Officer: 1 as const }] },
  { memberId: 2, roles: [{ Role: 'Financial Secretary', Officer: 1 as const }] },
  { memberId: 3, roles: [{ Role: 'Member', Officer: 0 as const }] },
  { memberId: 4, roles: [] },
];

describe('distribution groups', () => {
  it('offers only the two built-in lists with their labels (Sprint 5Y-5 retired Board of Trustees)', () => {
    expect(DISTRIBUTION_GROUPS.map((g) => g.label)).toEqual(['All Members', 'Active Officers']);
    expect(distributionGroupLabel('active_officers')).toBe('Active Officers');
  });

  it('resolves each list against the roster, ascending by id', () => {
    expect(distributionGroupMemberIds('all_members', roster)).toEqual([1, 2, 3, 4, 5]);
    expect(distributionGroupMemberIds('active_officers', roster)).toEqual([1, 2, 5]);
  });

  it('rejects an unknown list, including the retired Board of Trustees', () => {
    expect(() => distributionGroupMemberIds('everyone' as DistributionGroup, roster)).toThrow(/Unknown distribution list/);
    expect(() => distributionGroupMemberIds('board_of_trustees' as DistributionGroup, roster)).toThrow(/Unknown distribution list/);
  });
});

describe.each(drivers)('$name driver: sending to a distribution list', (d) => {
  it('sends to every Active officer of the council, with an unread receipt each, never to the sender', async () => {
    const db = await d.make();
    const receipts = d.count(db, 'ReadReceipts');
    const sent = await db.messages.send({
      senderId: MEMBER.admin,
      councilId: 1,
      distributionGroups: ['active_officers'],
      text: 'Officers meeting moved to Thursday.',
    });
    const thread = (await db.messages.listThreads(MEMBER.superAdmin)).find((t) => t.thread.id === sent.ThreadID);
    expect(thread).toMatchObject({ unreadCount: 1 });
    expect(thread!.participantIds).toEqual([MEMBER.superAdmin, MEMBER.admin]); // the Grand Knight and the sender
    expect(d.count(db, 'ReadReceipts')).toBe(receipts + 1);
    expect((await db.messages.listThreads(MEMBER.member)).some((t) => t.thread.id === sent.ThreadID)).toBe(false);
  });

  it('merges lists and people picked one by one without duplicates', async () => {
    const db = await d.make();
    const sent = await db.messages.send({
      senderId: MEMBER.member,
      councilId: 1,
      recipientIds: [MEMBER.superAdmin],
      distributionGroups: ['active_officers'],
      text: 'Question for leadership.',
    });
    const thread = (await db.messages.listThreads(MEMBER.member)).find((t) => t.thread.id === sent.ThreadID)!;
    expect(thread.participantIds).toEqual([MEMBER.superAdmin, MEMBER.admin, MEMBER.member]);
    expect(thread.thread.IsGroupChat).toBe(1);
  });

  it('reaches every Active member with All Members', async () => {
    const db = await d.make();
    const active = (await db.members.listByCouncil(1, { activeOnly: true })).map((m) => m.id).filter((id) => id !== MEMBER.superAdmin);
    const sent = await db.messages.send({ senderId: MEMBER.superAdmin, councilId: 1, distributionGroups: ['all_members'], text: 'Council news.' });
    const thread = (await db.messages.listThreads(MEMBER.superAdmin)).find((t) => t.thread.id === sent.ThreadID)!;
    expect(thread.participantIds).toEqual([MEMBER.superAdmin, ...active].sort((a, b) => a - b));
  });

  it('rejects a list that reaches nobody but the sender', async () => {
    const db = await d.make();
    const messages = d.count(db, 'Messages');
    // A brand-new council has no members, so its officers list is empty.
    const council = await db.councils.create(MEMBER.superAdmin, { CouncilNumber: 99002, CouncilName: 'Empty Council', State: 'OR' });
    await expectRule(
      db.messages.send({ senderId: MEMBER.superAdmin, councilId: council.id, distributionGroups: ['active_officers'], text: 'Officers only.' }),
      'NO_RECIPIENTS',
    );
    expect(d.count(db, 'Messages')).toBe(messages);
  });
});

describe('Home feed eviction by the device clock', () => {
  // NOW is 2026-09-20 12:00 local.
  const shift = (ShiftDate: string, StartTime: string, EndTime: string) => ({ shift: { ShiftDate, StartTime, EndTime } });
  const meeting = (Date: string, start: string, end: string) => ({ Date, 'Time Start': start, 'Time End': end });

  it('works out local end times, rolling an overnight end into the next day', () => {
    expect(shiftEnd({ ShiftDate: '2026-09-20', StartTime: '09:00:00', EndTime: '11:30:00' })).toEqual(new Date(2026, 8, 20, 11, 30));
    expect(shiftEnd({ ShiftDate: '2026-09-20', StartTime: '22:00:00', EndTime: '02:00:00' })).toEqual(new Date(2026, 8, 21, 2, 0));
    expect(meetingEnd(meeting('2026-09-20', '19:00', '20:30'))).toEqual(new Date(2026, 8, 20, 20, 30));
  });

  it('drops shifts that ended earlier today and keeps the rest', () => {
    const items = [
      shift('2026-09-20', '08:00:00', '11:59:00'), // ended this morning
      shift('2026-09-20', '11:00:00', '13:00:00'), // under way
      shift('2026-09-20', '12:00:00', '12:00:00'), // overnight into tomorrow
      shift('2026-09-21', '09:00:00', '10:00:00'),
    ];
    expect(withoutEndedShifts(items, NOW)).toEqual(items.slice(1));
  });

  it('drops a meeting the moment it ends', () => {
    const items = [meeting('2026-09-20', '10:00:00', '12:00:00'), meeting('2026-09-20', '11:00:00', '12:01:00'), meeting('2026-09-25', '19:00:00', '20:00:00')];
    expect(withoutEndedMeetings(items, NOW)).toEqual(items.slice(1));
  });
});
