// One conversation: nested replies (ParentMessageID), read/unread state, attachment placeholders and
// a composer whose text is saved as a draft automatically.
//
// Opening a thread marks what was unread as read, but those messages keep a NEW marker for this visit,
// and "Mark unread" puts one back in the badge count. Draft saves run one at a time through a queue,
// so pressing Send can never race a save that is still in flight and leave a duplicate draft behind.
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { flattenReplies, isUnread, preview, type MessageAttachment, type ThreadMessage } from '@kofc/shared';
import { MessageNode } from '@/components/MessageNode';
import { AppInput, AppText, Button, EmptyState, Loading, Notice } from '@/components/ui';
import { useApp, useUser } from '@/lib/app-context';
import { color, space } from '@/lib/theme';
import { describeError, useLoad } from '@/lib/use-async';
import { db } from '@/services/db';

/** How long typing must pause before the draft is saved. */
const AUTOSAVE_MS = 1200;

type DraftStatus = 'loading' | 'idle' | 'loaded' | 'saving' | 'saved' | 'error';
const statusText: Record<DraftStatus, string> = {
  loading: 'Loading draft…',
  idle: '',
  loaded: 'Draft loaded',
  saving: 'Saving draft…',
  saved: 'Draft saved',
  error: 'Draft not saved',
};

export default function ThreadScreen() {
  const { threadId } = useLocalSearchParams<{ threadId: string }>();
  const id = Number(threadId);
  const user = useUser();
  const router = useRouter();
  const { refreshUnread } = useApp();

  const state = useLoad(() => db.messages.listThread(id, user.memberId), [id, user.memberId]);
  const [newIds, setNewIds] = useState<ReadonlySet<number>>(new Set());
  const [notice, setNotice] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);

  // composer
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<ThreadMessage | null>(null);
  const [draftStatus, setDraftStatus] = useState<DraftStatus>('loading');
  const [sending, setSending] = useState(false);
  const draftId = useRef<number | null>(null);
  const saved = useRef({ text: '', parent: null as number | null });
  const queue = useRef<Promise<void>>(Promise.resolve());
  const opened = useRef(false);

  const enqueue = useCallback((job: () => Promise<void>) => (queue.current = queue.current.then(job, job)), []);
  const parentId = replyTo?.message.id ?? null;

  /** Writes the composer as the draft (or removes the draft when it is empty). Serialised. */
  const persist = useCallback(
    (body: string, parent: number | null) =>
      enqueue(async () => {
        const trimmed = body.trim();
        if (trimmed === saved.current.text && parent === saved.current.parent) return;
        setDraftStatus('saving');
        try {
          if (trimmed === '') {
            if (draftId.current !== null) await db.messages.deleteDraft(draftId.current, user.memberId);
            draftId.current = null;
            setDraftStatus('idle');
          } else {
            const draft = await db.messages.saveDraft({
              senderId: user.memberId,
              threadId: id,
              text: trimmed,
              parentMessageId: parent,
              draftId: draftId.current ?? undefined,
            });
            draftId.current = draft.id;
            setDraftStatus('saved');
          }
          saved.current = { text: trimmed, parent };
        } catch (err) {
          setDraftStatus('error');
          setNotice({ tone: 'error', text: describeError(err) });
        }
      }),
    [enqueue, id, user.memberId],
  );

  // Autosave after a pause in typing; flush immediately when leaving the screen.
  const latest = useRef({ text, parentId, sending });
  latest.current = { text, parentId, sending };
  useEffect(() => {
    if (!opened.current || sending) return;
    const timer = setTimeout(() => void persist(text, parentId), AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [text, parentId, sending, persist]);
  useEffect(
    () => () => {
      if (!latest.current.sending) void persist(latest.current.text, latest.current.parentId);
    },
    [persist],
  );

  // First load: remember what was unread, mark it read, and bring the latest draft into the composer.
  useEffect(() => {
    const messages = state.data;
    if (!messages || opened.current) return;
    opened.current = true;

    const unread = messages.filter(isUnread);
    setNewIds(new Set(unread.map((m) => m.message.id)));

    const latestDraft = messages.filter((m) => m.message.IsDraft === 1).at(-1);
    if (latestDraft) {
      const body = latestDraft.message.MessageText ?? '';
      const parent = latestDraft.message.ParentMessageID ?? null;
      draftId.current = latestDraft.message.id;
      saved.current = { text: body.trim(), parent };
      setText(body);
      setReplyTo(messages.find((m) => m.message.id === parent) ?? null);
      setDraftStatus('loaded');
    } else {
      setDraftStatus('idle');
    }

    if (unread.length > 0) {
      void (async () => {
        try {
          for (const m of unread) await db.messages.setRead(m.message.id, user.memberId, true);
          await refreshUnread();
          await state.reload();
        } catch (err) {
          setNotice({ tone: 'error', text: describeError(err) });
        }
      })();
    }
  }, [state.data, state.reload, refreshUnread, user.memberId]);

  const toggleRead = async (m: ThreadMessage) => {
    try {
      const nowRead = isUnread(m);
      await db.messages.setRead(m.message.id, user.memberId, nowRead);
      if (nowRead) setNewIds((s) => new Set([...s].filter((x) => x !== m.message.id)));
      await state.reload();
      await refreshUnread();
    } catch (err) {
      setNotice({ tone: 'error', text: describeError(err) });
    }
  };

  const editDraft = async (m: ThreadMessage) => {
    await persist(text, parentId); // keep whatever is in the composer before swapping it out
    const body = m.message.MessageText ?? '';
    const parent = m.message.ParentMessageID ?? null;
    draftId.current = m.message.id;
    saved.current = { text: body.trim(), parent };
    setText(body);
    setReplyTo(state.data?.find((x) => x.message.id === parent) ?? null);
    setDraftStatus('loaded');
    await state.reload();
  };

  const discardDraft = async (m: ThreadMessage) => {
    const wasInComposer = draftId.current === m.message.id;
    try {
      await enqueue(async () => {
        await db.messages.deleteDraft(m.message.id, user.memberId);
        if (wasInComposer) {
          draftId.current = null;
          saved.current = { text: '', parent: null };
        }
      });
      if (wasInComposer) {
        setText('');
        setReplyTo(null);
        setDraftStatus('idle');
      }
      await state.reload();
    } catch (err) {
      setNotice({ tone: 'error', text: describeError(err) });
    }
  };

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    setSending(true);
    setNotice(null);
    try {
      await queue.current; // let any draft save finish so the draft id is final
      await db.messages.send({ senderId: user.memberId, threadId: id, text: body, parentMessageId: parentId, draftId: draftId.current ?? undefined });
      draftId.current = null;
      saved.current = { text: '', parent: null };
      setText('');
      setReplyTo(null);
      setDraftStatus('idle');
      await state.reload();
      await refreshUnread();
    } catch (err) {
      setNotice({ tone: 'error', text: describeError(err) });
    } finally {
      setSending(false);
    }
  };

  const previewAttachment = (a: MessageAttachment) =>
    setNotice({ tone: 'info', text: `Attachment previews are not available in this version. "${a.Filename}" stays with this message in the chat history.` });

  const nodes = flattenReplies((state.data ?? []).filter((m) => !(m.message.IsDraft === 1 && m.message.id === draftId.current)));

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: color.white }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: space.lg, gap: space.lg }}
        data={nodes}
        keyExtractor={(n) => String(n.item.message.id)}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={{ gap: space.md }}>
            <Pressable accessibilityRole="button" onPress={() => router.back()} style={{ minHeight: 44, justifyContent: 'center' }}>
              <AppText variant="label" style={{ textDecorationLine: 'underline' }}>
                ‹ Messages
              </AppText>
            </Pressable>
            {notice ? <Notice tone={notice.tone} message={notice.text} onDismiss={() => setNotice(null)} /> : null}
            {state.error ? <Notice tone="error" message={state.error} /> : null}
          </View>
        }
        ListEmptyComponent={!state.data && state.loading ? <Loading /> : <EmptyState message="No messages in this conversation yet." />}
        renderItem={({ item: node }) => (
          <MessageNode
            node={node}
            isNew={newIds.has(node.item.message.id)}
            onReply={() => setReplyTo(node.item)}
            onToggleRead={() => void toggleRead(node.item)}
            onEditDraft={() => void editDraft(node.item)}
            onDiscardDraft={() => void discardDraft(node.item)}
            onPreview={previewAttachment}
          />
        )}
      />

      <View style={{ borderTopWidth: 2, borderTopColor: color.navy, padding: space.md, gap: space.sm, backgroundColor: color.white }}>
        {replyTo ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, borderLeftWidth: 4, borderLeftColor: color.gold, paddingLeft: space.sm }}>
            <AppText variant="small" style={{ flex: 1 }} numberOfLines={2}>
              Replying to {replyTo.senderName}: {preview(replyTo.message.MessageText, 80)}
            </AppText>
            <Pressable accessibilityRole="button" accessibilityLabel="Cancel reply" onPress={() => setReplyTo(null)} hitSlop={12}>
              <AppText variant="title">×</AppText>
            </Pressable>
          </View>
        ) : null}
        <AppInput
          value={text}
          onChangeText={setText}
          placeholder={replyTo ? 'Write a reply…' : 'Write a message…'}
          multiline
          editable={!sending}
          style={{ maxHeight: 140, textAlignVertical: 'top', paddingTop: space.md }}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <AppText variant="small" tone={draftStatus === 'error' ? 'red' : 'muted'} style={{ flex: 1 }} accessibilityLiveRegion="polite">
            {statusText[draftStatus]}
          </AppText>
          <Button title="Send" busy={sending} disabled={!text.trim()} onPress={() => void send()} style={{ minWidth: 110 }} />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
