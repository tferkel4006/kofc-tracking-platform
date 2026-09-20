// =========================================================================
// MESSAGE THREAD ASSEMBLY
// The schema has no thread-participant table, so who belongs to a thread, what
// is unread and which drafts are visible are all derived from Messages and
// ReadReceipts. Drivers fetch the raw rows and hand them to these pure
// functions, so both drivers answer identically.
// =========================================================================
import type { ThreadMessage, ThreadSummary } from './contract';
import { BusinessRuleError } from './rules';
import type { ChatThread, Message, MessageAttachment, ReadReceipt } from './types';

/** Matches SQLite's CURRENT_TIMESTAMP format ('YYYY-MM-DD HH:MM:SS', UTC), which Messages.CreatedAt uses. */
export const toTimestamp = (d: Date): string => d.toISOString().slice(0, 19).replace('T', ' ');

export interface MessagingRows {
  threads: readonly ChatThread[];
  messages: readonly Message[];
  receipts: readonly ReadReceipt[];
  attachments: readonly MessageAttachment[];
  /** memberId -> "First Last" */
  names: ReadonlyMap<number, string>;
}

const byTimeThenId = (a: Message, b: Message) => (a.CreatedAt ?? '').localeCompare(b.CreatedAt ?? '') || a.id - b.id;
const unknownName = 'Former member';

/** Everyone who sent a message in the thread or holds a receipt for one, ascending by id. */
export function participantIds(
  threadId: number,
  messages: readonly Message[],
  receipts: readonly ReadReceipt[],
): number[] {
  const inThread = messages.filter((m) => m.ThreadID === threadId);
  const ids = new Set<number>();
  for (const m of inThread) if (m.SenderID != null) ids.add(m.SenderID);
  const messageIds = new Set(inThread.map((m) => m.id));
  for (const r of receipts) if (r.MessageID != null && r.MemberID != null && messageIds.has(r.MessageID)) ids.add(r.MemberID);
  return [...ids].sort((a, b) => a - b);
}

/** The member's threads, most recent activity first. Threads they take no part in are dropped. */
export function buildThreadSummaries(memberId: number, rows: MessagingRows): ThreadSummary[] {
  const summaries: { summary: ThreadSummary; activity: string }[] = [];
  for (const thread of rows.threads) {
    const participants = participantIds(thread.id, rows.messages, rows.receipts);
    if (!participants.includes(memberId)) continue;

    const inThread = rows.messages.filter((m) => m.ThreadID === thread.id);
    const sent = inThread.filter((m) => m.IsDraft !== 1).sort(byTimeThenId);
    const lastMessage = sent.at(-1) ?? null;
    const ownDrafts = inThread.filter((m) => m.IsDraft === 1 && m.SenderID === memberId).sort(byTimeThenId);
    const sentIds = new Set(sent.map((m) => m.id));
    const unreadCount = rows.receipts.filter(
      (r) => r.MemberID === memberId && r.ReadAt == null && r.MessageID != null && sentIds.has(r.MessageID),
    ).length;

    summaries.push({
      activity: lastMessage?.CreatedAt ?? ownDrafts.at(-1)?.CreatedAt ?? thread.CreatedAt ?? '',
      summary: {
        thread: { ...thread },
        lastMessage: lastMessage ? { ...lastMessage } : null,
        lastSenderName: lastMessage?.SenderID != null ? (rows.names.get(lastMessage.SenderID) ?? unknownName) : null,
        unreadCount,
        draftCount: ownDrafts.length,
        participantIds: participants,
        participantNames: participants.map((id) => rows.names.get(id) ?? unknownName),
      },
    });
  }
  return summaries
    .sort((a, b) => b.activity.localeCompare(a.activity) || b.summary.thread.id - a.summary.thread.id)
    .map((s) => s.summary);
}

/** The thread as `memberId` sees it: sent messages plus their own drafts, oldest first. */
export function buildThreadMessages(memberId: number, threadId: number, rows: MessagingRows): ThreadMessage[] {
  return rows.messages
    .filter((m) => m.ThreadID === threadId && (m.IsDraft !== 1 || m.SenderID === memberId))
    .sort(byTimeThenId)
    .map((m) => {
      const receipt = rows.receipts.find((r) => r.MessageID === m.id && r.MemberID === memberId);
      return {
        message: { ...m },
        senderName: m.SenderID != null ? (rows.names.get(m.SenderID) ?? unknownName) : unknownName,
        attachments: rows.attachments.filter((a) => a.MessageID === m.id).map((a) => ({ ...a })),
        receipt: receipt ? { ...receipt } : null,
      };
    });
}

/** Throws THREAD_NOT_FOUND unless the thread exists and the member sent to it or received from it. */
export function assertThreadParticipant(
  rows: Pick<MessagingRows, 'threads' | 'messages' | 'receipts'>,
  threadId: number,
  memberId: number,
): void {
  if (
    !rows.threads.some((t) => t.id === threadId) ||
    !participantIds(threadId, rows.messages, rows.receipts).includes(memberId)
  ) {
    throw new BusinessRuleError('THREAD_NOT_FOUND', `Member ${memberId} takes part in no message thread with id ${threadId}.`, {
      threadId,
      memberId,
    });
  }
}
