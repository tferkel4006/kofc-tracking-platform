'use client';
// Communications Hub: every signed-in member's message threads (messages.listThreads) on the left and the open
// thread on the right, laid out as a nested conversation (replies sit under the message they answer). Any
// message can be answered inline, and opening a thread marks what the member received as read. Admins also get
// "New message", which opens the skills filter drawer to message everyone in the council with a chosen trade.
import { useEffect, useRef, useState } from 'react';
import {
  attachmentKind,
  canAdministerCouncil,
  describeError,
  flattenReplies,
  formatTimestamp,
  isUnread,
  preview,
  type ThreadMessage,
  type ThreadSummary,
} from '@kofc/shared';
import { RequireArea } from '@/components/CouncilScope';
import { SkillFilterDrawer } from '@/components/SkillFilterDrawer';
import { Button, cx, Empty, Field, Notice, PageTitle, Panel, Pill, Textarea } from '@/components/ui';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

/** Deepest visual indent; deeper replies line up with it so long chains stay readable. */
const MAX_INDENT = 4;

function ThreadList({ threads, openId, onOpen }: { threads: ThreadSummary[]; openId: number | null; onOpen: (id: number) => void }) {
  if (threads.length === 0) return <Empty>No conversations yet. Messages sent to you will appear here.</Empty>;
  return (
    <ul className="flex flex-col gap-2" aria-label="Conversations">
      {threads.map((t) => {
        const open = t.thread.id === openId;
        return (
          <li key={t.thread.id}>
            <button
              type="button"
              aria-current={open ? 'true' : undefined}
              onClick={() => onOpen(t.thread.id)}
              className={cx('w-full rounded border-2 bg-white px-3 py-2 text-left', open ? 'border-gold' : 'border-line hover:border-navy')}
            >
              <span className="flex items-start justify-between gap-2">
                <span className={cx('text-sm', t.unreadCount > 0 && 'font-bold')}>{t.participantNames.join(', ') || 'Just you'}</span>
                <span className="flex shrink-0 gap-1">
                  {t.unreadCount > 0 ? <Pill tone="red">{t.unreadCount} new</Pill> : null}
                  {t.draftCount > 0 ? <Pill tone="outline">Draft</Pill> : null}
                </span>
              </span>
              <span className="mt-1 block text-xs text-muted">
                {t.lastMessage ? `${t.lastSenderName ?? 'Someone'}: ${preview(t.lastMessage.MessageText, 70)}` : 'Only drafts so far'}
              </span>
              <span className="block text-xs text-muted">
                {t.thread.IsGroupChat ? 'Group · ' : ''}
                {formatTimestamp(t.lastMessage?.CreatedAt ?? t.thread.CreatedAt)}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function MessageBlock({ item, depth, onReply, replying }: { item: ThreadMessage; depth: number; onReply: () => void; replying: boolean }) {
  const user = useUser();
  const mine = item.message.SenderID === user.memberId;
  const draft = item.message.IsDraft === 1;
  return (
    <li style={{ marginLeft: `${Math.min(depth, MAX_INDENT) * 1.5}rem` }}>
      <article className={cx('rounded border-l-4 bg-white px-3 py-2 ring-1 ring-line', replying ? 'border-gold' : mine ? 'border-navy' : 'border-line')}>
        <header className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-sm font-bold">{mine ? 'You' : item.senderName}</span>
          <span className="text-muted">{formatTimestamp(item.message.CreatedAt)}</span>
          {draft ? <Pill tone="outline">Draft</Pill> : null}
          {isUnread(item) ? <Pill tone="red">New</Pill> : null}
        </header>
        <p className="mt-1 whitespace-pre-wrap text-sm">{item.message.MessageText}</p>
        {item.attachments.length > 0 ? (
          <ul className="mt-2 flex flex-wrap gap-2 text-xs">
            {item.attachments.map((a) => (
              <li key={a.id}>
                <a href={a.StorageURL} target="_blank" rel="noreferrer" className="underline">
                  [{attachmentKind(a.FileType)}] {a.Filename}
                </a>
              </li>
            ))}
          </ul>
        ) : null}
        {!draft ? (
          <div className="mt-2">
            <Button size="sm" variant="secondary" onClick={onReply} aria-pressed={replying}>
              Reply
            </Button>
          </div>
        ) : null}
      </article>
    </li>
  );
}

function OpenThread({ threadId, onChanged }: { threadId: number; onChanged: () => void }) {
  const user = useUser();
  const messages = useLoad(() => db.messages.listThread(threadId, user.memberId), [threadId, user.memberId]);
  const [replyTo, setReplyTo] = useState<ThreadMessage | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const markedFor = useRef<number | null>(null);

  useEffect(() => {
    setReplyTo(null);
    setText('');
    setError(null);
  }, [threadId]);

  // Opening a thread reads it: mark every unread message the member received, once per thread load.
  useEffect(() => {
    const unread = (messages.data ?? []).filter(isUnread);
    if (unread.length === 0 || markedFor.current === threadId) return;
    markedFor.current = threadId;
    void Promise.all(unread.map((m) => db.messages.setRead(m.message.id, user.memberId, true))).then(onChanged, () => undefined);
  }, [messages.data, threadId, user.memberId, onChanged]);

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      await db.messages.send({ senderId: user.memberId, threadId, text, parentMessageId: replyTo?.message.id ?? null });
      setText('');
      setReplyTo(null);
      await messages.reload();
      onChanged();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  if (messages.error) return <Notice tone="error">{messages.error}</Notice>;
  if (!messages.data) return <p className="text-sm text-muted">Loading the conversation…</p>;
  const flat = flattenReplies(messages.data);

  return (
    <div className="flex flex-col gap-4">
      <ol className="flex flex-col gap-2" aria-label="Messages">
        {flat.map(({ item, depth }) => (
          <MessageBlock
            key={item.message.id}
            item={item}
            depth={depth}
            replying={replyTo?.message.id === item.message.id}
            onReply={() => {
              setReplyTo(item);
              box.current?.focus();
            }}
          />
        ))}
      </ol>
      <form
        className="flex flex-col gap-2 border-t-2 border-navy pt-3"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        {error ? <Notice tone="error">{error}</Notice> : null}
        {replyTo ? (
          <p className="flex items-center gap-2 text-xs">
            <span>
              Replying to <span className="font-bold">{replyTo.message.SenderID === user.memberId ? 'yourself' : replyTo.senderName}</span>: “
              {preview(replyTo.message.MessageText, 60)}”
            </span>
            <button type="button" className="font-bold underline" onClick={() => setReplyTo(null)}>
              Reply to everyone instead
            </button>
          </p>
        ) : null}
        <Field label={replyTo ? 'Your reply' : 'Message everyone in this conversation'}>
          {(id) => <Textarea id={id} ref={box} value={text} maxLength={4000} onChange={(e) => setText(e.target.value)} />}
        </Field>
        <div>
          <Button type="submit" disabled={busy || text.trim() === ''}>
            {busy ? 'Sending…' : replyTo ? 'Send reply' : 'Send'}
          </Button>
        </div>
      </form>
    </div>
  );
}

function Hub() {
  const user = useUser();
  const threads = useLoad(() => db.messages.listThreads(user.memberId), [user.memberId]);
  const [openId, setOpenId] = useState<number | null>(null);
  const [composing, setComposing] = useState(false);
  const canBroadcast = canAdministerCouncil(user, user.councilId);
  const reloadThreads = threads.reload;
  const unread = (threads.data ?? []).reduce((n, t) => n + t.unreadCount, 0);

  useEffect(() => {
    if (openId === null && threads.data && threads.data.length > 0) setOpenId(threads.data[0].thread.id);
  }, [threads.data, openId]);
  const open = threads.data?.find((t) => t.thread.id === openId);

  return (
    <>
      <PageTitle
        actions={
          canBroadcast ? (
            <Button onClick={() => setComposing(true)} aria-expanded={composing}>
              New message
            </Button>
          ) : null
        }
      >
        Communications Hub
      </PageTitle>
      {threads.error ? <Notice tone="error">{threads.error}</Notice> : null}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <Panel title={`Conversations${unread > 0 ? ` (${unread} unread)` : ''}`}>
          {threads.data ? <ThreadList threads={threads.data} openId={openId} onOpen={setOpenId} /> : null}
        </Panel>
        {open ? (
          <Panel title={open.participantNames.join(', ') || 'Conversation'}>
            <OpenThread key={open.thread.id} threadId={open.thread.id} onChanged={() => void reloadThreads()} />
          </Panel>
        ) : (
          <Empty>Choose a conversation to read it and reply.</Empty>
        )}
      </div>
      {composing ? (
        <SkillFilterDrawer
          councilId={user.councilId}
          title="New message to a trade team"
          onClose={() => setComposing(false)}
          onSent={(threadId) => {
            void reloadThreads().then(() => setOpenId(threadId));
          }}
        />
      ) : null}
    </>
  );
}

export default function MessagesPage() {
  return (
    <RequireArea area="messages">
      <Hub />
    </RequireArea>
  );
}
