'use client';
// Charitable vetting threads (Sprint 6H), shared by the Pooled Vetting Desk and Propose Charity Grant. Each request may
// carry two threads (charities.listRequestThreads, openRequestThread, postRequestThreadMessage):
//   - 💬 Request More Info (MORE_INFO): the vetting officer's private exchange with the request's Knight Shepherd. The
//     vetting officer starts it; the Shepherd reads and answers it from My requests.
//   - 📣 Request Officer Input (OFFICER_INPUT): the officers' advisory forum. Every officer and Admin of the council
//     reads and posts; the Shepherd never sees it (the Four-Eyes Principle).
// The drawer shows only the thread it was opened for, so the two conversations never mix. The data service decides who
// may read and post; the buttons only mirror it (canUseCharitableThread).
import { useState } from 'react';
import {
  CHARITABLE_THREAD_BUTTON_LABELS,
  CHARITABLE_THREAD_MESSAGE_MAX_LENGTH,
  CHARITABLE_THREAD_TITLES,
  CHARITABLE_THREAD_TYPES,
  canUseCharitableThread,
  describeError,
  formatTimestamp,
  type CharitableRequest,
  type CharitableRequestThreadDetail,
  type CharitableThreadType,
} from '@kofc/shared';
import { Drawer } from '@/components/Drawer';
import { Button, cx, Empty, Field, Notice, Textarea } from '@/components/ui';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

/** High contrast: bold white on black inside an hc-gold border. */
const THREAD_BUTTON_CLASS = 'whitespace-nowrap border-hc-gold bg-black text-white';

/** The thread buttons the viewer may use on one request, in CHARITABLE_THREAD_TYPES order. */
export function RequestThreadButtons({
  request,
  types = CHARITABLE_THREAD_TYPES,
  onOpen,
}: {
  request: Pick<CharitableRequest, 'id' | 'CouncilID' | 'ShepherdMemberID' | 'VetterMemberID'>;
  types?: readonly CharitableThreadType[];
  onOpen: (threadType: CharitableThreadType) => void;
}) {
  const user = useUser();
  const allowed = types.filter((t) => canUseCharitableThread(user, request, t));
  if (allowed.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {allowed.map((t) => (
        <Button key={t} size="sm" className={THREAD_BUTTON_CLASS} aria-label={`${CHARITABLE_THREAD_BUTTON_LABELS[t]} on request #${request.id}`} onClick={() => onOpen(t)}>
          {CHARITABLE_THREAD_BUTTON_LABELS[t]}
        </Button>
      ))}
    </div>
  );
}

/** One thread's posts, oldest first; the viewer's own posts sit on a navy edge. */
function ThreadLog({ detail }: { detail: CharitableRequestThreadDetail }) {
  const user = useUser();
  return (
    <ol className="flex flex-col gap-2" aria-label={`${CHARITABLE_THREAD_TITLES[detail.thread.thread_type]} messages`}>
      {detail.messages.map(({ message, authorFirstName, authorLastName }) => (
        <li
          key={message.id}
          className={cx('rounded border-2 bg-white px-3 py-2', message.author_member_id === user.memberId ? 'border-navy border-l-8' : 'border-line')}
        >
          <p className="flex flex-wrap justify-between gap-2 text-xs">
            <span className="font-bold">
              {`${authorFirstName} ${authorLastName}`.trim() || `Member ${message.author_member_id}`}
              {message.author_member_id === user.memberId ? ' (you)' : ''}
            </span>
            <span className="text-muted">{formatTimestamp(message.posted_at)}</span>
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm">{message.message_body}</p>
        </li>
      ))}
    </ol>
  );
}

/** The drawer for one thread type on one request: its log and a reply box, or the box that starts it. */
export function RequestThreadDrawer({
  request,
  threadType,
  onClose,
}: {
  request: Pick<CharitableRequest, 'id' | 'OrganizationName'>;
  threadType: CharitableThreadType;
  onClose: () => void;
}) {
  const user = useUser();
  const load = useLoad(() => db.charities.listRequestThreads(user.memberId, request.id), [user.memberId, request.id]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const thread = load.data?.threads.find((t) => t.thread.thread_type === threadType) ?? null;
  const canStart = load.data?.canOpen.includes(threadType) ?? false;
  const title = CHARITABLE_THREAD_TITLES[threadType];

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      if (thread) await db.charities.postRequestThreadMessage(user.memberId, thread.thread.id, text);
      else await db.charities.openRequestThread(user.memberId, request.id, threadType, text);
      setText('');
      await load.reload();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  const audience =
    threadType === 'MORE_INFO'
      ? 'Private: only the Knight Shepherd and the vetting officer (the claiming vetter, an Admin, the Grand Knight or the Deputy Grand Knight) see this thread.'
      : "Officers only: every officer and Admin of the council sees this thread. The request's Knight Shepherd does not.";

  return (
    <Drawer title={`${title}: #${request.id} ${request.OrganizationName}`} onClose={onClose} wide>
      <p className="rounded border-2 border-navy px-3 py-2 text-xs font-bold">{audience}</p>
      {load.error ? <Notice tone="error">{load.error}</Notice> : null}
      {error ? (
        <Notice tone="error" onDismiss={() => setError(null)}>
          {error}
        </Notice>
      ) : null}
      {load.loading && !load.data ? (
        <p className="text-sm text-muted">Loading the thread…</p>
      ) : thread ? (
        <ThreadLog detail={thread} />
      ) : load.data ? (
        <Empty>
          {canStart
            ? 'No thread yet. Your first message starts it.'
            : threadType === 'MORE_INFO'
              ? 'The vetting officer has not asked for more information.'
              : 'No officer has asked for input on this request yet.'}
        </Empty>
      ) : null}
      {(thread?.canPost ?? canStart) ? (
        <form
          className="flex flex-col gap-2 border-t-4 border-gold pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <Field label={thread ? 'Your reply' : 'Your first message'}>
            {(id) => <Textarea id={id} rows={4} required maxLength={CHARITABLE_THREAD_MESSAGE_MAX_LENGTH} value={text} onChange={(e) => setText(e.target.value)} />}
          </Field>
          <div className="flex gap-3">
            <Button type="submit" className={THREAD_BUTTON_CLASS} disabled={busy || text.trim() === ''}>
              {busy ? 'Sending…' : thread ? 'Send reply' : CHARITABLE_THREAD_BUTTON_LABELS[threadType]}
            </Button>
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              Close
            </Button>
          </div>
        </form>
      ) : thread ? (
        <p className="text-xs text-muted">This thread is closed: the request was declined or the council has voted on it.</p>
      ) : null}
    </Drawer>
  );
}
