import { Pressable, View } from 'react-native';
import { formatTimestamp, isUnread, preview, type FlatReply, type MessageAttachment, type ThreadMessage } from '@kofc/shared';
import { AttachmentChip } from '@/components/AttachmentChip';
import { AppText, Pill } from '@/components/ui';
import { color, space, touchTarget } from '@/lib/theme';

const Action = ({ label, onPress, tone = 'navy' }: { label: string; onPress: () => void; tone?: 'navy' | 'red' }) => (
  <Pressable
    accessibilityRole="button"
    onPress={onPress}
    style={{ minHeight: touchTarget, justifyContent: 'center', paddingRight: space.md }}
  >
    <AppText variant="label" tone={tone} style={{ textDecorationLine: 'underline' }}>
      {label}
    </AppText>
  </Pressable>
);

export function MessageNode({
  node,
  replyTo,
  isNew,
  onReply,
  onToggleRead,
  onEditDraft,
  onDiscardDraft,
  onPreview,
}: {
  node: FlatReply;
  /** The message this one answers, named above the text since the chat log is flat (Sprint 5Z-Final-Polish). */
  replyTo?: ThreadMessage;
  /** Unread when the thread was opened; keeps its marker for this visit even though opening marks it read. */
  isNew: boolean;
  onReply: () => void;
  onToggleRead: () => void;
  onEditDraft: () => void;
  onDiscardDraft: () => void;
  onPreview: (a: MessageAttachment) => void;
}) {
  const { message, senderName, attachments, receipt } = node.item;
  const isDraft = message.IsDraft === 1;
  const unread = isUnread(node.item);
  return (
    <View
      style={{
        borderLeftWidth: isNew ? 3 : 0,
        borderLeftColor: color.gold,
        paddingLeft: isNew ? space.md : 0,
        gap: space.xs,
      }}
    >
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm }}>
        <AppText variant="title">{isDraft ? 'Your draft' : senderName}</AppText>
        {isDraft ? <Pill label="DRAFT" tone="outline" /> : null}
        {isNew || unread ? <Pill label="NEW" tone="gold" /> : null}
        <AppText variant="small" tone="muted">
          {formatTimestamp(message.CreatedAt)}
        </AppText>
      </View>
      {replyTo ? (
        <AppText variant="small" tone="muted" numberOfLines={1}>
          ↳ Replying to {replyTo.senderName}: {preview(replyTo.message.MessageText, 60)}
        </AppText>
      ) : null}
      <AppText>{message.MessageText}</AppText>
      {attachments.map((a) => (
        <AttachmentChip key={a.id} attachment={a} onPress={onPreview} />
      ))}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {isDraft ? (
          <>
            <Action label="Edit draft" onPress={onEditDraft} />
            <Action label="Discard" tone="red" onPress={onDiscardDraft} />
          </>
        ) : (
          <>
            <Action label="Reply" onPress={onReply} />
            {receipt ? <Action label={unread ? 'Mark read' : 'Mark unread'} onPress={onToggleRead} /> : null}
          </>
        )}
      </View>
    </View>
  );
}
