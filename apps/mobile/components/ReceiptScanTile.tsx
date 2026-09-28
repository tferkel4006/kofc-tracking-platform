// A large camera action tile for paper evidence: "Scan Paper Receipt" on expense line items and "Take Verification
// Photo" on physical item donations. A tap opens the phone's camera (usePhotoCapture, asking for permission the
// first time); the shot is copied out of the camera's temporary cache into the app's media folder, and the stored
// file:// path is handed to `onCaptured`. Once a photo is attached it shows as a thumbnail with Remove, and the tile
// offers a retake.
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from 'react-native';
import { AppText, Button, Notice, Pill } from '@/components/ui';
import { color, radius, space, touchTarget } from '@/lib/theme';
import { usePhotoCapture } from '@/lib/use-photo-capture';

export const SCAN_RECEIPT_TITLE = 'Scan Paper Receipt';
export const VERIFICATION_PHOTO_TITLE = 'Take Verification Photo';

/** A camera outline drawn in navy, so the tile needs no icon font. */
function CameraGlyph() {
  return (
    <View accessible={false} style={styles.camera}>
      <View style={styles.cameraBump} />
      <View style={styles.cameraLens} />
    </View>
  );
}

export function ReceiptScanTile({
  prefix,
  title,
  hint,
  photoPath,
  photoLabel,
  onCaptured,
  onRemove,
}: {
  /** File-name prefix inside the media folder, e.g. "receipt". */
  prefix: string;
  title: string;
  hint: string;
  /** The attached photo's stored path, or null. */
  photoPath: string | null;
  /** Screen-reader description of the attached photo. */
  photoLabel: string;
  onCaptured: (path: string) => Promise<void> | void;
  onRemove: () => void;
}) {
  const { capture, busy, error, clearError } = usePhotoCapture(prefix, onCaptured);
  const label = photoPath ? `Retake: ${title}` : title;
  return (
    <View style={{ gap: space.sm }}>
      {error ? <Notice tone="error" message={error} onDismiss={clearError} /> : null}
      {photoPath ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <Image source={{ uri: photoPath }} style={styles.thumb} accessibilityLabel={photoLabel} />
          <View style={{ flex: 1, gap: space.xs }}>
            <Pill label="PHOTO SAVED ON THIS PHONE" tone="navy" />
            <Button title="Remove photo" variant="secondary" onPress={onRemove} />
          </View>
        </View>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={hint}
        accessibilityState={{ busy, disabled: busy }}
        disabled={busy}
        onPress={() => void capture()}
        style={({ pressed }) => [styles.tile, { opacity: busy ? 0.6 : pressed ? 0.85 : 1, borderStyle: photoPath ? 'solid' : 'dashed' }]}
      >
        {busy ? <ActivityIndicator color={color.navy} /> : <CameraGlyph />}
        <AppText variant="title" style={{ textAlign: 'center' }}>
          {busy ? 'Opening the camera…' : label}
        </AppText>
        {!photoPath && !busy ? (
          <AppText variant="small" tone="muted" style={{ textAlign: 'center' }}>
            {hint}
          </AppText>
        ) : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    minHeight: touchTarget * 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    padding: space.lg,
    borderWidth: 2,
    borderColor: color.navy,
    borderRadius: radius.md,
    backgroundColor: color.white,
  },
  thumb: { width: 88, height: 88, borderRadius: 6 },
  camera: { width: 40, height: 28, borderWidth: 3, borderColor: color.navy, borderRadius: 5, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  cameraBump: { position: 'absolute', top: -8, width: 14, height: 6, backgroundColor: color.navy, borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  cameraLens: { width: 14, height: 14, borderWidth: 3, borderColor: color.gold, borderRadius: 7 },
});
