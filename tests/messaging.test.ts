import { describe, expect, it } from 'vitest';
import { drivers, expectRule, MEMBER } from './helpers';
import type { DataService } from '@kofc/shared';

// Dev seed: the test member is in the "food" thread (5 sent messages, nested replies, 3 unread, 1 own draft)
// and the "hours" thread (1 unread). The officers thread is between the super admin and admin only.
async function threadsFor(db: DataService, memberId: number) {
  const threads = await db.messages.listThreads(memberId);
  const byText = (needle: string) => threads.find((t) => t.lastMessage?.MessageText?.includes(needle));
  return { threads, hours: byText('log your hours')!, food: byText('pantry map')! };
}

describe.each(drivers)('$name driver: message threads', (d) => {
  it('lists only the member’s threads, most recent first, with unread and draft counts', async () => {
    const db = await d.make();
    const { threads, hours, food } = await threadsFor(db, MEMBER.member);
    expect(threads).toHaveLength(2); // never the officers thread
    expect(threads[0].thread.id).toBe(hours.thread.id); // 8 hours ago beats 20
    expect(hours).toMatchObject({ unreadCount: 1, draftCount: 0 });
    expect(hours.thread.IsGroupChat).toBe(0);
    expect(food).toMatchObject({ unreadCount: 3, draftCount: 1 });
    expect(food.thread.IsGroupChat).toBe(1);
    expect(food.participantIds).toEqual([1, 2, 3]);
    expect(food.participantNames).toHaveLength(3);
    expect(food.lastSenderName).toBe(food.participantNames[0]); // sent by the super admin (id 1)
  });

  it('shows the thread with nested replies, attachments, read state and only the member’s own drafts', async () => {
    const db = await d.make();
    const { food } = await threadsFor(db, MEMBER.member);
    const messages = await db.messages.listThread(food.thread.id, MEMBER.member);
    expect(messages).toHaveLength(6); // 5 sent + own draft

    const text = (needle: string) => messages.find((m) => m.message.MessageText?.includes(needle))!;
    const root = text('food drive is coming up');
    expect(root.message.ParentMessageID ?? null).toBeNull();
    expect(text('Packing Shift Thursday').message.ParentMessageID).toBe(root.message.id);
    expect(text('pallet jack').message.ParentMessageID).toBe(text('Packing Shift Thursday').message.id);
    expect(text('pantry map').message.ParentMessageID).toBe(text('extra boxes').message.id); // a reply to a reply

    expect(text('extra boxes').attachments.map((a) => [a.Filename, a.FileType])).toEqual([['Food Drive Checklist.pdf', 'application/pdf']]);
    expect(root.receipt?.ReadAt).toBeTruthy(); // read
    expect(text('pallet jack').receipt?.ReadAt ?? null).toBeNull(); // unread
    expect(text('Packing Shift Thursday').receipt).toBeNull(); // the member's own message
    expect(text('See you Thursday').message.IsDraft).toBe(1);

    const admin = await db.messages.listThread(food.thread.id, MEMBER.admin);
    expect(admin).toHaveLength(5); // the member's draft is private
    expect(admin.some((m) => m.message.IsDraft === 1)).toBe(false);
    expect(messages.map((m) => m.message.CreatedAt)).toEqual([...messages.map((m) => m.message.CreatedAt)].sort());
  });

  it('refuses a thread the member takes no part in', async () => {
    const db = await d.make();
    const officers = (await threadsFor(db, MEMBER.admin)).threads.find((t) => t.lastMessage?.MessageText?.includes('Budget'))!;
    await expectRule(db.messages.listThread(officers.thread.id, MEMBER.member), 'THREAD_NOT_FOUND');
    await expectRule(db.messages.listThread(9999, MEMBER.member), 'THREAD_NOT_FOUND');
  });

  it('marks a message read and unread, and only for a message the member received', async () => {
    const db = await d.make();
    const { food } = await threadsFor(db, MEMBER.member);
    const messages = await db.messages.listThread(food.thread.id, MEMBER.member);
    const unread = messages.find((m) => m.message.MessageText?.includes('pallet jack'))!;

    expect((await db.messages.setRead(unread.message.id, MEMBER.member, true)).ReadAt).toBeTruthy();
    expect((await threadsFor(db, MEMBER.member)).food.unreadCount).toBe(2);
    expect((await db.messages.setRead(unread.message.id, MEMBER.member, false)).ReadAt ?? null).toBeNull();
    expect((await threadsFor(db, MEMBER.member)).food.unreadCount).toBe(3);

    const own = messages.find((m) => m.message.MessageText?.includes('Packing Shift Thursday'))!;
    await expectRule(db.messages.setRead(own.message.id, MEMBER.member, true), 'MESSAGE_NOT_FOUND');
  });
});

describe.each(drivers)('$name driver: sending, replying and drafts', (d) => {
  it('sends a nested reply and creates an unread receipt for every other participant', async () => {
    const db = await d.make();
    const { food } = await threadsFor(db, MEMBER.member);
    const parent = (await db.messages.listThread(food.thread.id, MEMBER.member)).find((m) => m.message.MessageText?.includes('pantry map'))!;
    const receipts = d.count(db, 'ReadReceipts');

    const sent = await db.messages.send({ senderId: MEMBER.member, threadId: food.thread.id, text: '  Thanks for the map!  ', parentMessageId: parent.message.id });
    expect(sent).toMatchObject({ ThreadID: food.thread.id, SenderID: MEMBER.member, ParentMessageID: parent.message.id, MessageText: 'Thanks for the map!', IsDraft: 0 });
    expect(d.count(db, 'ReadReceipts')).toBe(receipts + 2); // the super admin and the admin

    const adminView = await threadsFor(db, MEMBER.admin);
    expect(adminView.threads.find((t) => t.thread.id === food.thread.id)?.lastMessage?.MessageText).toBe('Thanks for the map!');
    const back = (await db.messages.listThread(food.thread.id, MEMBER.member)).at(-1)!;
    expect(back.message.id).toBe(sent.id);
    expect(back.receipt).toBeNull();
  });

  it('rejects empty text, foreign parents and outsiders without writing', async () => {
    const db = await d.make();
    const { food, hours } = await threadsFor(db, MEMBER.member);
    const foreignParent = (await db.messages.listThread(hours.thread.id, MEMBER.member))[0];
    const messages = d.count(db, 'Messages');
    const receipts = d.count(db, 'ReadReceipts');

    await expectRule(db.messages.send({ senderId: MEMBER.member, threadId: food.thread.id, text: '   ' }), 'INVALID_INPUT');
    await expectRule(
      db.messages.send({ senderId: MEMBER.member, threadId: food.thread.id, text: 'hi', parentMessageId: foreignParent.message.id }),
      'MESSAGE_NOT_FOUND',
    );
    await expectRule(db.messages.send({ senderId: MEMBER.newMember, threadId: food.thread.id, text: 'hi' }), 'THREAD_NOT_FOUND');
    await expectRule(db.messages.send({ senderId: 999, threadId: food.thread.id, text: 'hi' }), 'MEMBER_NOT_FOUND');
    expect(d.count(db, 'Messages')).toBe(messages);
    expect(d.count(db, 'ReadReceipts')).toBe(receipts);
  });

  it('starts a direct or group thread with one unread receipt per recipient', async () => {
    const db = await d.make();
    const threads = d.count(db, 'ChatThreads');
    const direct = await db.messages.send({ senderId: MEMBER.member, councilId: 1, recipientIds: [MEMBER.admin], text: 'Quick question' });
    const group = await db.messages.send({ senderId: MEMBER.member, councilId: 1, recipientIds: [MEMBER.admin, MEMBER.superAdmin, MEMBER.member, MEMBER.admin], text: 'Hello all' });
    expect(d.count(db, 'ChatThreads')).toBe(threads + 2);

    const list = await db.messages.listThreads(MEMBER.admin);
    expect(list.find((t) => t.thread.id === direct.ThreadID)).toMatchObject({ unreadCount: 1, thread: { IsGroupChat: 0 } });
    expect(list.find((t) => t.thread.id === group.ThreadID)).toMatchObject({ unreadCount: 1, thread: { IsGroupChat: 1 } });

    await expectRule(db.messages.send({ senderId: MEMBER.member, councilId: 1, recipientIds: [], text: 'x' }), 'INVALID_INPUT');
    await expectRule(db.messages.send({ senderId: MEMBER.member, councilId: 1, recipientIds: [MEMBER.member], text: 'x' }), 'INVALID_INPUT');
    await expectRule(db.messages.send({ senderId: MEMBER.member, recipientIds: [MEMBER.admin], text: 'x' }), 'INVALID_INPUT');
    await expectRule(db.messages.send({ senderId: MEMBER.member, councilId: 1, recipientIds: [999], text: 'x' }), 'MEMBER_NOT_FOUND');
    expect(d.count(db, 'ChatThreads')).toBe(threads + 2);
  });

  it('sends a saved draft in place instead of creating a second message', async () => {
    const db = await d.make();
    const { food } = await threadsFor(db, MEMBER.member);
    const draft = (await db.messages.listThread(food.thread.id, MEMBER.member)).find((m) => m.message.IsDraft === 1)!;
    const messages = d.count(db, 'Messages');
    const receipts = d.count(db, 'ReadReceipts');

    const sent = await db.messages.send({ senderId: MEMBER.member, threadId: food.thread.id, draftId: draft.message.id, text: 'Yes, on my way with the jack.' });
    expect(sent).toMatchObject({ id: draft.message.id, IsDraft: 0, MessageText: 'Yes, on my way with the jack.', ParentMessageID: draft.message.ParentMessageID });
    expect(d.count(db, 'Messages')).toBe(messages);
    expect(d.count(db, 'ReadReceipts')).toBe(receipts + 2);
    const after = (await db.messages.listThreads(MEMBER.member)).find((t) => t.thread.id === food.thread.id);
    expect(after).toMatchObject({ draftCount: 0, lastMessage: { id: draft.message.id } });
  });

  it('saves, updates and deletes a private draft', async () => {
    const db = await d.make();
    const { hours } = await threadsFor(db, MEMBER.member);
    const messages = d.count(db, 'Messages');

    const first = await db.messages.saveDraft({ senderId: MEMBER.member, threadId: hours.thread.id, text: 'Will do' });
    expect(first).toMatchObject({ IsDraft: 1, MessageText: 'Will do' });
    const second = await db.messages.saveDraft({ senderId: MEMBER.member, threadId: hours.thread.id, text: 'Will do tonight', draftId: first.id });
    expect(second).toMatchObject({ id: first.id, MessageText: 'Will do tonight' });
    expect(d.count(db, 'Messages')).toBe(messages + 1);
    expect((await threadsFor(db, MEMBER.member)).hours.draftCount).toBe(1);
    expect((await threadsFor(db, MEMBER.admin)).threads.some((t) => t.draftCount > 0)).toBe(false);

    await expectRule(db.messages.deleteDraft(first.id, MEMBER.admin), 'MESSAGE_NOT_FOUND'); // not theirs
    await db.messages.deleteDraft(first.id, MEMBER.member);
    expect(d.count(db, 'Messages')).toBe(messages);
    await expectRule(db.messages.deleteDraft(first.id, MEMBER.member), 'MESSAGE_NOT_FOUND');
    await expectRule(db.messages.saveDraft({ senderId: MEMBER.member, threadId: hours.thread.id, text: ' ' }), 'INVALID_INPUT');
    await expectRule(db.messages.saveDraft({ senderId: MEMBER.newMember, threadId: hours.thread.id, text: 'hi' }), 'THREAD_NOT_FOUND');
  });
});
