import { Pressable, View } from 'react-native';
import { attachmentKind, type MessageAttachment } from '@kofc/shared';
import { AppText } from '@/components/ui';
import { color, radius, space, touchTarget } from '@/lib/theme';

/**
 * Attachment placeholder: a kind tag (PDF, IMG, XLS, DOC) on a gold marker, the file name and a
 * "preview coming soon" note. Files stay in the chat history; previews and downloads arrive with the
 * remote storage driver.
 */
export function AttachmentChip({ attachment, onPress }: { attachment: MessageAttachment; onPress: (a: MessageAttachment) => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Attachment ${attachment.Filename}. Preview not available yet.`}
      onPress={() => onPress(attachment)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        minHeight: touchTarget,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: color.navy,
        borderRadius: radius.sm,
        padding: space.sm,
        backgroundColor: color.white,
      }}
    >
      <View style={{ backgroundColor: color.gold, borderRadius: radius.sm, paddingHorizontal: space.sm, paddingVertical: space.xs }}>
        <AppText variant="label">{attachmentKind(attachment.FileType)}</AppText>
      </View>
      <View style={{ flex: 1 }}>
        <AppText numberOfLines={1}>{attachment.Filename}</AppText>
        <AppText variant="small" tone="muted">
          Preview coming soon
        </AppText>
      </View>
    </Pressable>
  );
}
