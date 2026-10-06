// The four electronic collection channels' QR codes (Sprint 5Z-Mobile-Intake). Tapping Venmo, ParishSoft, Zeffy or Zelle
// on the Donate screen opens a full-screen pop-up showing only that channel's code, so the donor scans exactly one.
// Sprint 5Z-WhiteLabel: the council's own uploaded code (CouncilDonationOption.qrCodeUrl) comes first; when it is
// missing, blank, a placeholder:// link, or fails to load, the code bundled with the app from
// apps/mobile/assets/images/qr/ is shown instead.
// Sprint 5Z-Mobile-Scale: the code is sized from the viewport (never taller than half the screen) and the layout sits in
// a SafeAreaView, so a high-resolution upload cannot push the Continue button off a short phone.
// Sprint 6A: the code's source comes from the in-memory QR cache (lib/qr-cache.ts), which the Donate screen warms ahead
// of the tap, and an upload that failed once is skipped for the rest of the run; the button now reads "Continue".
import { useState } from 'react';
import type { ImageSourcePropType } from 'react-native';
import { Image, Modal, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText, Button } from '@/components/ui';
import { cachedQrSource, markQrUploadFailed } from '@/lib/qr-cache';
import { color, radius, space } from '@/lib/theme';
import parishsoftQr from '../assets/images/qr/parishsoft-collection.png';
import venmoQr from '../assets/images/qr/venmo-collection.png';
import zeffyQr from '../assets/images/qr/zeffy-collection.png';
import zelleQr from '../assets/images/qr/zelle-collection.png';

/** Each channel's bundled code, keyed by the DonationMethod name in lower case. */
const COLLECTION_QR: Record<string, ImageSourcePropType> = {
  venmo: venmoQr,
  parishsoft: parishsoftQr,
  zeffy: zeffyQr,
  zelle: zelleQr,
};

/** The code's gold frame: border width, and border plus inner padding on each side. */
const FRAME_BORDER = 6;
const FRAME_INSET = FRAME_BORDER + space.md;
const MAX_FRAME_WIDTH = 420;
/** The code is never taller than this share of the screen, leaving room for the heading, hint and Done button. */
const MAX_HEIGHT_SHARE = 0.5;

/** The bundled code for a DonationMethod name, or null when the app carries none for it. */
export const collectionQrFor = (methodName: string): ImageSourcePropType | null => COLLECTION_QR[methodName.trim().toLowerCase()] ?? null;

export function CollectionQrModal({
  methodName,
  uploadedUrl,
  fallback,
  visible,
  onClose,
}: {
  methodName: string;
  /** The council's uploaded code for this channel, shown first when the phone can load it. */
  uploadedUrl: string | null;
  /** The code bundled with the app, shown when the council has none or it fails to load. */
  fallback: ImageSourcePropType;
  visible: boolean;
  onClose: () => void;
}) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  // Bumped when the upload fails, so the cache's fallback is read again.
  const [, setFailures] = useState(0);
  const { source, uploaded: useUpload } = cachedQrSource(uploadedUrl, fallback);
  // A square that fits inside the frame at the screen's width (less gutters) and is at most half the screen tall.
  const frameWidth = Math.min(screenWidth - 2 * space.lg, MAX_FRAME_WIDTH);
  const qrSize = Math.max(0, Math.floor(Math.min(frameWidth - 2 * FRAME_INSET, screenHeight * MAX_HEIGHT_SHARE)));
  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: color.white }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg, padding: space.lg }}>
          <AppText variant="heading" accessibilityRole="header" style={{ textAlign: 'center' }}>
            Scan to pay with {methodName}
          </AppText>
          <View style={{ padding: space.md, borderWidth: FRAME_BORDER, borderColor: color.gold, borderRadius: radius.md }}>
            <Image
              key={useUpload ? 'uploaded' : 'bundled'}
              source={source}
              onError={
                useUpload
                  ? () => {
                      markQrUploadFailed(uploadedUrl);
                      setFailures((n) => n + 1);
                    }
                  : undefined
              }
              fadeDuration={0}
              accessibilityLabel={`${methodName} QR code for the donor to scan`}
              resizeMode="contain"
              style={{ width: qrSize, height: qrSize }}
            />
          </View>
          <AppText tone="muted" style={{ textAlign: 'center' }}>
            Turn the phone toward the donor. When they show you the payment confirmation, tap Continue and record the amount.
          </AppText>
          <Button title="Continue" style={{ alignSelf: 'stretch' }} onPress={onClose} />
        </View>
      </SafeAreaView>
    </Modal>
  );
}
