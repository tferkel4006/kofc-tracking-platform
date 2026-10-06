// "Capture & Upload Verification Photos": opens the phone camera, saves the shot into the app's media folder
// and passes the stored path to `onCaptured`, which records it against the event or donation.
import { View } from 'react-native';
import { Button, Notice } from '@/components/ui';
import { useTheme } from '@/lib/layout-mode';
import { usePhotoCapture } from '@/lib/use-photo-capture';

export const CAPTURE_TITLE = 'Capture & Upload Verification Photos';

export function CapturePhotoButton({
  prefix,
  onCaptured,
  title = CAPTURE_TITLE,
  variant = 'secondary',
}: {
  /** File-name prefix inside the media folder, e.g. "event-12". */
  prefix: string;
  onCaptured: (path: string) => Promise<void> | void;
  title?: string;
  variant?: 'primary' | 'secondary';
}) {
  const { space } = useTheme();
  const { capture, busy, error, clearError } = usePhotoCapture(prefix, onCaptured);
  return (
    <View style={{ gap: space.sm }}>
      {error ? <Notice tone="error" message={error} onDismiss={clearError} /> : null}
      <Button title={busy ? 'Opening the camera…' : title} variant={variant} busy={busy} onPress={() => void capture()} />
    </View>
  );
}
